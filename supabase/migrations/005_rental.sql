-- ====================================================================
-- EstateVista rental schema (tenants, leases, rent schedules, deposits)
-- ====================================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type text not null default 'individual' check (type in ('individual','company')),
  phone text,
  alternate_phone text,
  email text,
  national_id_type text,
  national_id_number text,
  date_of_birth date,
  occupation text,
  address text,
  city text,
  country text,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, company_id)
);

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  previous_lease_id uuid references public.leases(id) on delete set null,
  number text not null,
  start_date date not null,
  end_date date not null,
  frequency text not null default 'monthly'
    check (frequency in ('monthly','quarterly','half_yearly','yearly')),
  rent_amount numeric(18,2) not null default 0,
  due_day integer not null default 1 check (due_day between 1 and 28),
  grace_days integer not null default 5,
  late_fee_type text not null default 'fixed' check (late_fee_type in ('fixed','percentage')),
  late_fee_value numeric(18,2) not null default 0,
  notice_period_days integer not null default 30,
  security_deposit_amount numeric(18,2) not null default 0,
  utilities_included jsonb not null default '[]'::jsonb,
  terms text,
  status text not null default 'draft'
    check (status in ('draft','active','expired','terminated','renewed')),
  terminated_at timestamptz,
  termination_reason text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (end_date >= start_date),
  unique (company_id, number)
);

create table if not exists public.rent_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_label text not null,
  period_start date not null,
  period_end date not null,
  due_date date not null,
  rent_amount numeric(18,2) not null default 0,
  adjustments numeric(18,2) not null default 0,
  late_fee numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0,
  balance numeric(18,2) not null default 0,
  status text not null default 'upcoming'
    check (status in ('upcoming','due','partly_paid','paid','overdue','waived','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, period_start)
);

create table if not exists public.rent_adjustments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rent_schedule_id uuid not null references public.rent_schedules(id) on delete cascade,
  type text not null check (type in ('extra_charge','discount','waiver')),
  amount numeric(18,2) not null check (amount > 0),
  reason text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.security_deposits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lease_id uuid not null unique references public.leases(id) on delete cascade,
  required_amount numeric(18,2) not null default 0,
  received_amount numeric(18,2) not null default 0,
  deducted_amount numeric(18,2) not null default 0,
  refunded_amount numeric(18,2) not null default 0,
  held_amount numeric(18,2) not null default 0,
  status text not null default 'awaiting_settlement'
    check (status in ('awaiting_settlement','to_collect','held','settled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deposit_transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  deposit_id uuid not null references public.security_deposits(id) on delete cascade,
  type text not null check (type in ('receipt','deduction','refund')),
  amount numeric(18,2) not null check (amount > 0),
  reason text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Cross-module links that could not exist when 004_sales.sql was applied.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'receipts_tenant_id_fkey' and conrelid = 'public.receipts'::regclass
  ) then
    alter table public.receipts
      add constraint receipts_tenant_id_fkey
      foreign key (tenant_id) references public.tenants(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'receipt_allocations_rent_schedule_id_fkey'
      and conrelid = 'public.receipt_allocations'::regclass
  ) then
    alter table public.receipt_allocations
      add constraint receipt_allocations_rent_schedule_id_fkey
      foreign key (rent_schedule_id) references public.rent_schedules(id) on delete set null;
  end if;
end $$;

create unique index if not exists uniq_active_lease_per_unit
  on public.leases (unit_id) where status = 'active';

create index if not exists idx_tenants_company on public.tenants (company_id);
create index if not exists idx_leases_company_status on public.leases (company_id, status);
create index if not exists idx_leases_unit on public.leases (unit_id);
create index if not exists idx_rent_schedules_company_status on public.rent_schedules (company_id, status, due_date);
create index if not exists idx_rent_schedules_lease on public.rent_schedules (lease_id);
create index if not exists idx_rent_adjustments_schedule on public.rent_adjustments (rent_schedule_id);
create index if not exists idx_security_deposits_company on public.security_deposits (company_id, status);
create index if not exists idx_deposit_transactions_deposit on public.deposit_transactions (deposit_id);

drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists trg_leases_updated_at on public.leases;
create trigger trg_leases_updated_at before update on public.leases
for each row execute function public.set_updated_at();

drop trigger if exists trg_rent_schedules_updated_at on public.rent_schedules;
create trigger trg_rent_schedules_updated_at before update on public.rent_schedules
for each row execute function public.set_updated_at();

drop trigger if exists trg_security_deposits_updated_at on public.security_deposits;
create trigger trg_security_deposits_updated_at before update on public.security_deposits
for each row execute function public.set_updated_at();

alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.rent_schedules enable row level security;
alter table public.rent_adjustments enable row level security;
alter table public.security_deposits enable row level security;
alter table public.deposit_transactions enable row level security;
