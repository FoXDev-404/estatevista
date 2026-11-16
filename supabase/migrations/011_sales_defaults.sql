-- ====================================================================
-- EstateVista sales defaults and collection functions
-- Adds the "no late fee" plan option and atomic receipt posting/voiding.
-- ====================================================================

alter table public.installment_plans
  drop constraint if exists installment_plans_late_fee_type_check;

alter table public.installment_plans
  add constraint installment_plans_late_fee_type_check
  check (late_fee_type in ('none', 'fixed', 'percentage'));

-- Posts a receipt and its allocations atomically. Every allocation is checked
-- against the locked installment balance, then the affected sales have their
-- collected amount and paid status refreshed.
create or replace function public.post_sale_receipt(
  p_company_id uuid,
  p_customer_id uuid,
  p_number text,
  p_received_on date,
  p_amount numeric,
  p_reference text default null,
  p_notes text default null,
  p_created_by uuid default null,
  p_allocations jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt_id uuid;
  v_allocation jsonb;
  v_installment public.installments%rowtype;
  v_sale_number text;
  v_sale_customer_id uuid;
  v_sale_ids uuid[] := '{}';
  v_installment_id uuid;
  v_amount numeric;
  v_total numeric := 0;
  v_sale record;
  v_down numeric;
  v_allocated numeric;
  v_collected numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a receipt amount greater than zero.';
  end if;
  if jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
    raise exception 'Allocate the receipt to at least one installment.';
  end if;

  insert into public.receipts (
    company_id, customer_id, number, received_on, amount, status, reference, notes, created_by
  ) values (
    p_company_id, p_customer_id, p_number, coalesce(p_received_on, current_date),
    p_amount, 'completed', p_reference, p_notes, p_created_by
  )
  returning id into v_receipt_id;

  for v_allocation in select * from jsonb_array_elements(p_allocations)
  loop
    v_installment_id := (v_allocation ->> 'installment_id')::uuid;
    v_amount := (v_allocation ->> 'amount')::numeric;

    if v_amount is null or v_amount <= 0 then
      raise exception 'Allocation amounts must be greater than zero.';
    end if;

    select * into v_installment
    from public.installments
    where id = v_installment_id and company_id = p_company_id
    for update;

    if not found then
      raise exception 'Choose an installment from this company.';
    end if;

    select customer_id, number into v_sale_customer_id, v_sale_number
    from public.sales
    where id = v_installment.sale_id and company_id = p_company_id;

    if v_sale_customer_id is null then
      raise exception 'Choose an installment from this company.';
    end if;
    if v_sale_customer_id <> p_customer_id then
      raise exception 'The installment belongs to a different customer.';
    end if;

    if v_installment.status in ('waived', 'cancelled') then
      raise exception 'This installment cannot receive a payment.';
    end if;

    if v_installment.paid_amount + v_amount
       > v_installment.amount + v_installment.late_fee + 0.005 then
      raise exception 'The allocation exceeds the installment balance for %.', v_sale_number;
    end if;

    update public.installments
    set paid_amount = paid_amount + v_amount,
        balance = greatest(0, amount + late_fee - (paid_amount + v_amount)),
        status = case
          when paid_amount + v_amount >= amount + late_fee - 0.005 then 'paid'
          else 'partly_paid'
        end,
        updated_at = now()
    where id = v_installment.id;

    insert into public.receipt_allocations (
      company_id, receipt_id, installment_id, amount
    ) values (
      p_company_id, v_receipt_id, v_installment.id, v_amount
    );

    v_total := v_total + v_amount;
    v_sale_ids := array_append(v_sale_ids, v_installment.sale_id);
  end loop;

  if abs(v_total - p_amount) > 0.005 then
    raise exception 'Allocations must equal the receipt amount.';
  end if;

  for v_sale in select * from public.sales where id = any(v_sale_ids)
  loop
    select coalesce(down_payment, 0) into v_down
    from public.installment_plans where sale_id = v_sale.id;

    select coalesce(sum(ra.amount), 0) into v_allocated
    from public.receipt_allocations ra
    join public.receipts r on r.id = ra.receipt_id
    join public.installments i on i.id = ra.installment_id
    where i.sale_id = v_sale.id and r.status = 'completed';

    v_collected := coalesce(v_down, 0) + v_allocated;

    update public.sales
    set collected_amount = v_collected,
        status = case
          when status = 'cancelled' then 'cancelled'
          when v_collected + 0.005 >= net_price then 'fully_paid'
          else 'active'
        end,
        updated_at = now()
    where id = v_sale.id;
  end loop;

  return v_receipt_id;
end;
$$;

-- Voids a completed receipt, reopens its installments and refreshes the
-- affected sales. The receipt row is kept for the audit trail.
create or replace function public.void_sale_receipt(
  p_company_id uuid,
  p_receipt_id uuid,
  p_reason text default null,
  p_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.receipts%rowtype;
  v_allocation record;
  v_sale_ids uuid[] := '{}';
  v_sale record;
  v_down numeric;
  v_allocated numeric;
  v_collected numeric;
begin
  select * into v_receipt
  from public.receipts
  where id = p_receipt_id and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Receipt not found.';
  end if;
  if v_receipt.status <> 'completed' then
    raise exception 'Only a completed receipt can be voided.';
  end if;

  for v_allocation in
    select * from public.receipt_allocations
    where receipt_id = v_receipt.id and installment_id is not null
    for update
  loop
    update public.installments
    set paid_amount = greatest(0, paid_amount - v_allocation.amount),
        balance = amount + late_fee - greatest(0, paid_amount - v_allocation.amount),
        status = case
          when paid_amount - v_allocation.amount > 0.005 then 'partly_paid'
          else 'upcoming'
        end,
        updated_at = now()
    where id = v_allocation.installment_id;

    v_sale_ids := array_append(
      v_sale_ids,
      (select sale_id from public.installments where id = v_allocation.installment_id)
    );
  end loop;

  update public.receipts
  set status = 'voided',
      voided_at = now(),
      void_reason = p_reason,
      updated_at = now()
  where id = v_receipt.id;

  for v_sale in select * from public.sales where id = any(v_sale_ids)
  loop
    select coalesce(down_payment, 0) into v_down
    from public.installment_plans where sale_id = v_sale.id;

    select coalesce(sum(ra.amount), 0) into v_allocated
    from public.receipt_allocations ra
    join public.receipts r on r.id = ra.receipt_id
    join public.installments i on i.id = ra.installment_id
    where i.sale_id = v_sale.id and r.status = 'completed';

    v_collected := coalesce(v_down, 0) + v_allocated;

    update public.sales
    set collected_amount = v_collected,
        status = case
          when status = 'cancelled' then 'cancelled'
          when v_collected + 0.005 >= net_price then 'fully_paid'
          else 'active'
        end,
        updated_at = now()
    where id = v_sale.id;
  end loop;

  return v_receipt.id;
end;
$$;

revoke all on function public.post_sale_receipt(
  uuid, uuid, text, date, numeric, text, text, uuid, jsonb
) from public;
revoke all on function public.void_sale_receipt(
  uuid, uuid, text, uuid
) from public;

grant execute on function public.post_sale_receipt(
  uuid, uuid, text, date, numeric, text, text, uuid, jsonb
) to service_role;
grant execute on function public.void_sale_receipt(
  uuid, uuid, text, uuid
) to service_role;
