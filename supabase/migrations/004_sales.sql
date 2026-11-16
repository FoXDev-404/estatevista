-- ====================================================================
-- EstateVista sales schema (quotations, reservations, sales, schedules,
-- receipts and commissions)
-- ====================================================================

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  salesperson_id uuid references public.users(id) on delete set null,
  number text not null,
  quotation_date date not null default current_date,
  valid_until date,
  unit_price numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  net_amount numeric(18,2) not null default 0,
  terms text,
  status text not null default 'draft'
    check (status in ('draft','sent','accepted','rejected','expired','converted')),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, number)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  salesperson_id uuid references public.users(id) on delete set null,
  number text not null,
  agreement_date date not null default current_date,
  sale_price numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  net_price numeric(18,2) not null default 0,
  collected_amount numeric(18,2) not null default 0,
  payment_type text not null default 'installments'
    check (payment_type in ('full','installments')),
  status text not null default 'active'
    check (status in ('pending_approval','active','fully_paid','cancelled')),
  notes text,
  handover_date date,
  handover_notes text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, number)
);

create table if not exists public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_id uuid not null unique references public.sales(id) on delete cascade,
  down_payment numeric(18,2) not null default 0,
  number_of_installments integer not null default 0 check (number_of_installments >= 0),
  frequency text not null default 'monthly'
    check (frequency in ('monthly','quarterly','half_yearly','yearly')),
  start_date date not null default current_date,
  due_day integer not null default 1 check (due_day between 1 and 28),
  grace_days integer not null default 5,
  late_fee_type text not null default 'fixed' check (late_fee_type in ('fixed','percentage')),
  late_fee_value numeric(18,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.installments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  sequence integer not null,
  due_date date not null,
  amount numeric(18,2) not null default 0,
  late_fee numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0,
  balance numeric(18,2) not null default 0,
  status text not null default 'upcoming'
    check (status in ('upcoming','due','partly_paid','paid','overdue','waived','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, sequence)
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  converted_sale_id uuid references public.sales(id) on delete set null,
  number text not null,
  booking_amount numeric(18,2) not null default 0,
  reserved_on date not null default current_date,
  expires_at date not null,
  status text not null default 'active'
    check (status in ('active','converted','cancelled','expired')),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, number)
);

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  tenant_id uuid,
  account_id uuid,
  number text not null,
  received_on date not null default current_date,
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'completed'
    check (status in ('completed','refunded','voided')),
  reference text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  unique (company_id, number)
);

create table if not exists public.receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  installment_id uuid references public.installments(id) on delete set null,
  rent_schedule_id uuid,
  amount numeric(18,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls(installment_id, rent_schedule_id) = 1)
);

create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  applicability text not null default 'all' check (applicability in ('all','project','unit_type')),
  project_id uuid references public.projects(id) on delete set null,
  unit_type_id uuid references public.unit_types(id) on delete set null,
  rate_type text not null default 'percentage' check (rate_type in ('percentage','fixed')),
  rate_value numeric(18,2) not null default 0,
  payable_trigger text not null default 'sale'
    check (payable_trigger in ('reservation','sale','collection')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_commissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  salesperson_id uuid references public.users(id) on delete set null,
  rule_id uuid references public.commission_rules(id) on delete set null,
  base_amount numeric(18,2) not null default 0,
  rate_type text not null default 'percentage' check (rate_type in ('percentage','fixed')),
  rate_value numeric(18,2) not null default 0,
  commission_amount numeric(18,2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending','approved','paid','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz
);

create unique index if not exists uniq_active_sale_per_unit
  on public.sales (unit_id) where status in ('pending_approval','active','fully_paid');
create unique index if not exists uniq_active_reservation_per_unit
  on public.reservations (unit_id) where status = 'active';

create index if not exists idx_quotations_company on public.quotations (company_id, status);
create index if not exists idx_sales_company on public.sales (company_id, status);
create index if not exists idx_sales_customer on public.sales (customer_id);
create index if not exists idx_installments_sale on public.installments (sale_id);
create index if not exists idx_installments_company_status on public.installments (company_id, status, due_date);
create index if not exists idx_reservations_company on public.reservations (company_id, status);
create index if not exists idx_receipts_company on public.receipts (company_id, received_on desc);
create index if not exists idx_receipt_allocations_receipt on public.receipt_allocations (receipt_id);
create index if not exists idx_receipt_allocations_installment on public.receipt_allocations (installment_id);
create index if not exists idx_commission_rules_company on public.commission_rules (company_id, is_active);
create index if not exists idx_sales_commissions_company on public.sales_commissions (company_id, status);

drop trigger if exists trg_quotations_updated_at on public.quotations;
create trigger trg_quotations_updated_at before update on public.quotations
for each row execute function public.set_updated_at();

drop trigger if exists trg_sales_updated_at on public.sales;
create trigger trg_sales_updated_at before update on public.sales
for each row execute function public.set_updated_at();

drop trigger if exists trg_installments_updated_at on public.installments;
create trigger trg_installments_updated_at before update on public.installments
for each row execute function public.set_updated_at();

drop trigger if exists trg_reservations_updated_at on public.reservations;
create trigger trg_reservations_updated_at before update on public.reservations
for each row execute function public.set_updated_at();

drop trigger if exists trg_receipts_updated_at on public.receipts;
create trigger trg_receipts_updated_at before update on public.receipts
for each row execute function public.set_updated_at();

drop trigger if exists trg_commission_rules_updated_at on public.commission_rules;
create trigger trg_commission_rules_updated_at before update on public.commission_rules
for each row execute function public.set_updated_at();

drop trigger if exists trg_sales_commissions_updated_at on public.sales_commissions;
create trigger trg_sales_commissions_updated_at before update on public.sales_commissions
for each row execute function public.set_updated_at();

alter table public.quotations enable row level security;
alter table public.sales enable row level security;
alter table public.installment_plans enable row level security;
alter table public.installments enable row level security;
alter table public.reservations enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_allocations enable row level security;
alter table public.commission_rules enable row level security;
alter table public.sales_commissions enable row level security;
