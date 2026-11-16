-- ====================================================================
-- EstateVista review fixes
-- Keeps waived/cancelled sale installments terminal when a receipt is
-- voided after the sale was cancelled.
-- ====================================================================

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
        balance = case
          when status in ('waived', 'cancelled') then 0
          else amount + late_fee - greatest(0, paid_amount - v_allocation.amount)
        end,
        status = case
          when status in ('waived', 'cancelled') then status
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

revoke all on function public.void_sale_receipt(
  uuid, uuid, text, uuid
) from public;

grant execute on function public.void_sale_receipt(
  uuid, uuid, text, uuid
) to service_role;
