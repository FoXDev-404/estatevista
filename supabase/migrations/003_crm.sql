-- ====================================================================
-- EstateVista CRM schema (lookups, leads, follow-ups, visits, customers)
-- ====================================================================

create table if not exists public.lookups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  list_key text not null,
  name text not null,
  color text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, list_key, name),
  unique (id, company_id)
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  source_id uuid references public.lookups(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  name text not null,
  phone text,
  email text,
  status text not null default 'new'
    check (status in ('new','contacted','qualified','visit_scheduled','negotiation','won','lost')),
  lost_reason text,
  budget_min numeric(18,2),
  budget_max numeric(18,2),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, company_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid unique references public.leads(id) on delete set null,
  source_id uuid references public.lookups(id) on delete set null,
  name text not null,
  type text not null default 'individual' check (type in ('individual','company')),
  phone text,
  alternate_phone text,
  email text,
  national_id text,
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

create table if not exists public.lead_followups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid not null,
  type text not null default 'note'
    check (type in ('call','meeting','note','email','whatsapp','site_visit')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  outcome text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (lead_id, company_id) references public.leads(id, company_id) on delete cascade
);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  salesperson_id uuid references public.users(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','completed','cancelled','no_show')),
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lookups_company_list on public.lookups (company_id, list_key);
create index if not exists idx_leads_company_status on public.leads (company_id, status);
create index if not exists idx_leads_company_assigned on public.leads (company_id, assigned_to);
create index if not exists idx_leads_project on public.leads (project_id);
create index if not exists idx_customers_company on public.customers (company_id);
create index if not exists idx_lead_followups_lead on public.lead_followups (lead_id, created_at desc);
create index if not exists idx_visits_company_scheduled on public.visits (company_id, scheduled_at);
create index if not exists idx_visits_lead on public.visits (lead_id);

drop trigger if exists trg_lookups_updated_at on public.lookups;
create trigger trg_lookups_updated_at before update on public.lookups
for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists trg_visits_updated_at on public.visits;
create trigger trg_visits_updated_at before update on public.visits
for each row execute function public.set_updated_at();

alter table public.lookups enable row level security;
alter table public.leads enable row level security;
alter table public.customers enable row level security;
alter table public.lead_followups enable row level security;
alter table public.visits enable row level security;
