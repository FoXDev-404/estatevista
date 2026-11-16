-- ====================================================================
-- EstateVista public bridge (website inquiries -> CRM leads/visits)
-- ====================================================================

create table if not exists public.website_inquiries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null default 'general'
    check (type in ('general','project','property','visit')),
  name text not null,
  phone text,
  email text,
  project_id uuid references public.projects(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  property_id varchar(32) references public.properties(id) on delete set null,
  message text,
  source_page text,
  locale text not null default 'en',
  status text not null default 'new'
    check (status in ('new','converted','closed')),
  lead_id uuid references public.leads(id) on delete set null,
  visit_id uuid references public.visits(id) on delete set null,
  submission_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_website_inquiries_company_created
  on public.website_inquiries (company_id, created_at desc);
create index if not exists idx_website_inquiries_company_status
  on public.website_inquiries (company_id, status);
create index if not exists idx_website_inquiries_lead
  on public.website_inquiries (lead_id);

drop trigger if exists trg_website_inquiries_updated_at on public.website_inquiries;
create trigger trg_website_inquiries_updated_at before update on public.website_inquiries
for each row execute function public.set_updated_at();

alter table public.website_inquiries enable row level security;
