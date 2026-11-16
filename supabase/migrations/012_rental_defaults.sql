-- ====================================================================
-- EstateVista rental defaults and rent receipt functions
-- Adds weekly leases, a "no late fee" option, tenant notes and atomic
-- rent receipt posting/voiding.
-- ====================================================================

alter table public.tenants
  add column if not exists notes text;

alter table public.leases
  drop constraint if exists leases_frequency_check;

alter table public.leases
  add constraint leases_frequency_check
  check (frequency in ('weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'));

alter table public.leases
  drop constraint if exists leases_late_fee_type_check;

alter table public.leases
  add constraint leases_late_fee_type_check
  check (late_fee_type in ('none', 'fixed', 'percentage'));

-- Posts a rent receipt and its allocations atomically. Every allocation is
-- checked against the locked rent balance, then the period is marked paid or
-- partly paid.
create or replace function public.post_rent_receipt(
  p_company_id uuid,
  p_tenant_id uuid,
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
  v_schedule public.rent_schedules%rowtype;
  v_lease_number text;
  v_lease_tenant_id uuid;
  v_schedule_id uuid;
  v_amount numeric;
  v_total numeric := 0;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a receipt amount greater than zero.';
  end if;

  if p_tenant_id is null or not exists (
    select 1
    from public.tenants
    where id = p_tenant_id
      and company_id = p_company_id
      and deleted_at is null
  ) then
    raise exception 'Choose a tenant from this company.';
  end if;

  if jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
    raise exception 'Allocate the receipt to at least one rent period.';
  end if;

  insert into public.receipts (
    company_id, tenant_id, number, received_on, amount, status, reference, notes, created_by
  ) values (
    p_company_id, p_tenant_id, p_number, coalesce(p_received_on, current_date),
    p_amount, 'completed', p_reference, p_notes, p_created_by
  )
  returning id into v_receipt_id;

  for v_allocation in select * from jsonb_array_elements(p_allocations)
  loop
    v_schedule_id := (v_allocation ->> 'rent_schedule_id')::uuid;
    v_amount := (v_allocation ->> 'amount')::numeric;

    if v_amount is null or v_amount <= 0 then
      raise exception 'Allocation amounts must be greater than zero.';
    end if;

    select * into v_schedule
    from public.rent_schedules
    where id = v_schedule_id and company_id = p_company_id
    for update;

    if not found then
      raise exception 'Choose a rent period from this company.';
    end if;

    select l.number, l.tenant_id into v_lease_number, v_lease_tenant_id
    from public.leases l
    where l.id = v_schedule.lease_id and l.company_id = p_company_id;

    if v_lease_tenant_id is null or v_lease_tenant_id <> p_tenant_id then
      raise exception 'The rent period belongs to a different tenant.';
    end if;

    if v_schedule.status in ('waived', 'cancelled') then
      raise exception 'This rent period cannot receive a payment.';
    end if;

    if v_schedule.paid_amount + v_amount
       > v_schedule.rent_amount + v_schedule.adjustments + v_schedule.late_fee + 0.005 then
      raise exception 'The allocation exceeds the rent balance for %.', v_lease_number;
    end if;

    update public.rent_schedules
    set paid_amount = paid_amount + v_amount,
        balance = greatest(
          0,
          rent_amount + adjustments + late_fee - (paid_amount + v_amount)
        ),
        status = case
          when paid_amount + v_amount
               >= rent_amount + adjustments + late_fee - 0.005 then 'paid'
          else 'partly_paid'
        end,
        updated_at = now()
    where id = v_schedule.id;

    insert into public.receipt_allocations (
      company_id, receipt_id, rent_schedule_id, amount
    ) values (
      p_company_id, v_receipt_id, v_schedule.id, v_amount
    );

    v_total := v_total + v_amount;
  end loop;

  if abs(v_total - p_amount) > 0.005 then
    raise exception 'Allocations must equal the receipt amount.';
  end if;

  return v_receipt_id;
end;
$$;

-- Voids a completed rent receipt and reopens its periods. The receipt row is
-- kept for the audit trail.
create or replace function public.void_rent_receipt(
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
begin
  select * into v_receipt
  from public.receipts
  where id = p_receipt_id
    and company_id = p_company_id
    and tenant_id is not null
  for update;

  if not found then
    raise exception 'Receipt not found.';
  end if;
  if v_receipt.status <> 'completed' then
    raise exception 'Only a completed receipt can be voided.';
  end if;

  for v_allocation in
    select * from public.receipt_allocations
    where receipt_id = v_receipt.id and rent_schedule_id is not null
    for update
  loop
    update public.rent_schedules
    set paid_amount = greatest(0, paid_amount - v_allocation.amount),
        balance = greatest(
          0,
          rent_amount + adjustments + late_fee
            - greatest(0, paid_amount - v_allocation.amount)
        ),
        status = case
          when status in ('waived', 'cancelled') then status
          when paid_amount - v_allocation.amount > 0.005 then 'partly_paid'
          when current_date > due_date then 'overdue'
          when current_date >= due_date then 'due'
          else 'upcoming'
        end,
        updated_at = now()
    where id = v_allocation.rent_schedule_id;
  end loop;

  update public.receipts
  set status = 'voided',
      voided_at = now(),
      void_reason = p_reason,
      updated_at = now()
  where id = v_receipt.id;

  return v_receipt.id;
end;
$$;

revoke all on function public.post_rent_receipt(
  uuid, uuid, text, date, numeric, text, text, uuid, jsonb
) from public;
revoke all on function public.void_rent_receipt(
  uuid, uuid, text, uuid
) from public;

grant execute on function public.post_rent_receipt(
  uuid, uuid, text, date, numeric, text, text, uuid, jsonb
) to service_role;
grant execute on function public.void_rent_receipt(
  uuid, uuid, text, uuid
) to service_role;
