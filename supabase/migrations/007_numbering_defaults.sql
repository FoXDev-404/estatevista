-- ====================================================================
-- WP2 numbering defaults
-- ====================================================================
-- Brings earlier development databases in line with the full numbering
-- catalog used by the settings screen. All statements are idempotent and
-- only touch values that still match the previous defaults.
-- ====================================================================

-- The first R1 seed used `receipt` for payment receipts. Rename it when the
-- canonical key is still free for that company.
update public.number_sequences ns
set document_type = 'payment_receipt',
    prefix = 'RCP-',
    padding = 6,
    updated_at = now()
where ns.document_type = 'receipt'
  and not exists (
    select 1
    from public.number_sequences other
    where other.company_id = ns.company_id
      and other.document_type = 'payment_receipt'
  );

delete from public.number_sequences
where document_type = 'receipt';

-- These two keys were placeholders in the first seed and are not part of the
-- documented numbering catalog.
delete from public.number_sequences
where document_type in ('rent_receipt', 'deposit_receipt')
  and next_value = 1;

-- Normalise early defaults without overwriting a company's own changes.
update public.number_sequences
set prefix = 'SAL-', padding = 5, updated_at = now()
where document_type = 'sale' and prefix = 'SA-' and next_value = 1;

update public.number_sequences
set padding = 5, updated_at = now()
where document_type = 'quotation' and padding = 4 and next_value = 1;

update public.number_sequences
set padding = 5, updated_at = now()
where document_type = 'reservation' and padding = 4 and next_value = 1;

update public.number_sequences
set padding = 5, updated_at = now()
where document_type = 'lease' and padding = 4 and next_value = 1;

-- Insert any missing catalog rows for every existing company.
insert into public.number_sequences (company_id, document_type, prefix, padding, reset_period)
select company.id, seed.document_type, seed.prefix, seed.padding, seed.reset_period
from public.companies company
cross join (
  values
    ('contractor', 'CTR-', 4, 'never'),
    ('contractor_bill', 'BILL-', 5, 'yearly'),
    ('contractor_contract', 'CON-', 4, 'never'),
    ('customer', 'CUS-', 5, 'never'),
    ('employee', 'EMP-', 4, 'never'),
    ('employee_advance', 'ADV-', 4, 'yearly'),
    ('expense', 'EXP-', 5, 'yearly'),
    ('income', 'INC-', 5, 'yearly'),
    ('journal_entry', 'JE-', 6, 'yearly'),
    ('laborer', 'LAB-', 4, 'never'),
    ('lease', 'LSE-', 5, 'yearly'),
    ('loan', 'LN-', 4, 'never'),
    ('loan_payment', 'LNP-', 5, 'yearly'),
    ('maintenance_request', 'MNT-', 5, 'yearly'),
    ('material', 'MAT-', 4, 'never'),
    ('material_issue', 'MI-', 5, 'yearly'),
    ('payment_receipt', 'RCP-', 6, 'yearly'),
    ('payout', 'PAY-', 5, 'yearly'),
    ('payroll_run', 'PR-', 3, 'yearly'),
    ('project', 'PRJ-', 4, 'never'),
    ('purchase', 'PUR-', 5, 'yearly'),
    ('purchase_order', 'PO-', 5, 'yearly'),
    ('purchase_return', 'PRN-', 5, 'yearly'),
    ('quotation', 'QT-', 5, 'yearly'),
    ('refund', 'RFD-', 5, 'yearly'),
    ('reservation', 'RSV-', 5, 'yearly'),
    ('sale', 'SAL-', 5, 'yearly'),
    ('supplier', 'SUP-', 4, 'never'),
    ('tenant', 'TEN-', 5, 'never'),
    ('transfer', 'TRF-', 5, 'yearly')
) as seed(document_type, prefix, padding, reset_period)
on conflict (company_id, document_type) do nothing;
