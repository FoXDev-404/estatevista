-- ====================================================================
-- EstateVista review fixes: atomic security-deposit actions
-- Locks the deposit row so concurrent receipt/deduction/refund requests
-- cannot overwrite each other or spend the same held balance twice.
-- ====================================================================

create or replace function public.apply_deposit_transaction(
  p_company_id uuid,
  p_deposit_id uuid,
  p_type text,
  p_amount numeric,
  p_reason text default null,
  p_user_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit public.security_deposits%rowtype;
  v_lease_status text;
  v_held numeric;
  v_status text;
begin
  select * into v_deposit
  from public.security_deposits
  where id = p_deposit_id and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Security deposit not found.';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero.';
  end if;

  v_held := greatest(
    0,
    v_deposit.received_amount - v_deposit.deducted_amount - v_deposit.refunded_amount
  );

  if p_type = 'receipt' then
    v_deposit.received_amount := v_deposit.received_amount + p_amount;
  elsif p_type = 'deduction' then
    if p_amount > v_held + 0.005 then
      raise exception 'The deduction exceeds the held balance.';
    end if;
    v_deposit.deducted_amount := v_deposit.deducted_amount + p_amount;
  elsif p_type = 'refund' then
    if p_amount > v_held + 0.005 then
      raise exception 'The refund exceeds the held balance.';
    end if;
    v_deposit.refunded_amount := v_deposit.refunded_amount + p_amount;
  else
    raise exception 'Unknown deposit action.';
  end if;

  v_held := greatest(
    0,
    v_deposit.received_amount - v_deposit.deducted_amount - v_deposit.refunded_amount
  );

  select status into v_lease_status
  from public.leases
  where id = v_deposit.lease_id and company_id = p_company_id;

  if v_deposit.required_amount <= 0.005 then
    v_status := case
      when v_lease_status in ('terminated', 'renewed', 'expired') then 'settled'
      else 'held'
    end;
  elsif v_lease_status in ('terminated', 'renewed', 'expired') then
    v_status := case when v_held > 0.005 then 'awaiting_settlement' else 'settled' end;
  elsif v_deposit.received_amount + 0.005 >= v_deposit.required_amount and v_held > 0.005 then
    v_status := 'held';
  else
    v_status := 'to_collect';
  end if;

  update public.security_deposits
  set received_amount = v_deposit.received_amount,
      deducted_amount = v_deposit.deducted_amount,
      refunded_amount = v_deposit.refunded_amount,
      held_amount = v_held,
      status = v_status,
      updated_at = now()
  where id = v_deposit.id;

  insert into public.deposit_transactions (
    company_id, deposit_id, type, amount, reason, created_by
  ) values (
    p_company_id, v_deposit.id, p_type, p_amount, p_reason, p_user_id
  );

  return v_deposit.id;
end;
$$;

revoke all on function public.apply_deposit_transaction(
  uuid, uuid, text, numeric, text, uuid
) from public;

grant execute on function public.apply_deposit_transaction(
  uuid, uuid, text, numeric, text, uuid
) to service_role;
