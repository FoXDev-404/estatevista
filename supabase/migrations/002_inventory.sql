-- ====================================================================
-- EstateVista inventory schema (projects, buildings, floors, units)
-- ====================================================================

create table if not exists public.unit_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name),
  unique (id, company_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  project_manager_id uuid references public.users(id) on delete set null,
  number text not null,
  name text not null,
  code text,
  slug text not null,
  type text not null default 'residential'
    check (type in ('residential','commercial','mixed_use','land','other')),
  status text not null default 'planning'
    check (status in ('planning','active','on_hold','completed','archived')),
  description text,
  location text,
  city text,
  address text,
  land_area numeric(18,2),
  land_area_unit text not null default 'sqft',
  latitude numeric(10,7),
  longitude numeric(10,7),
  booking_amount numeric(18,2) not null default 0,
  budget numeric(18,2) not null default 0,
  currency text not null default 'USD',
  start_date date,
  expected_completion_date date,
  actual_completion_date date,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  amenities jsonb not null default '[]'::jsonb,
  specifications jsonb not null default '[]'::jsonb,
  nearby_places jsonb not null default '[]'::jsonb,
  video_url text,
  payment_note text,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (company_id, number),
  unique (company_id, slug),
  unique (id, company_id)
);

create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  code text not null,
  name text not null,
  floors_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code),
  unique (id, company_id),
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade
);

create table if not exists public.floors (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  building_id uuid not null,
  number integer not null,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, number),
  unique (id, company_id),
  foreign key (building_id, company_id) references public.buildings(id, company_id) on delete cascade
);

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null,
  building_id uuid,
  floor_id uuid,
  unit_type_id uuid,
  unit_number text not null,
  area numeric(12,2),
  area_unit text not null default 'sqft',
  bedrooms integer,
  bathrooms integer,
  sale_price numeric(18,2) not null default 0,
  rent_price numeric(18,2) not null default 0,
  status text not null default 'available'
    check (status in ('draft','available','reserved','sold','rented','blocked','under_maintenance')),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (project_id, unit_number),
  unique (id, company_id),
  foreign key (project_id, company_id) references public.projects(id, company_id) on delete cascade,
  foreign key (building_id, company_id) references public.buildings(id, company_id) on delete no action,
  foreign key (floor_id, company_id) references public.floors(id, company_id) on delete no action,
  foreign key (unit_type_id, company_id) references public.unit_types(id, company_id) on delete no action
);

create table if not exists public.unit_status_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  unit_id uuid not null,
  from_status text,
  to_status text not null,
  reason text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (unit_id, company_id) references public.units(id, company_id) on delete cascade
);

create index if not exists idx_unit_types_company on public.unit_types (company_id);
create index if not exists idx_projects_company on public.projects (company_id);
create index if not exists idx_projects_company_status on public.projects (company_id, status);
create index if not exists idx_buildings_project on public.buildings (project_id);
create index if not exists idx_floors_building on public.floors (building_id);
create index if not exists idx_units_company on public.units (company_id);
create index if not exists idx_units_project on public.units (project_id);
create index if not exists idx_units_company_status on public.units (company_id, status);
create index if not exists idx_unit_status_history_unit on public.unit_status_history (unit_id, created_at desc);

drop trigger if exists trg_unit_types_updated_at on public.unit_types;
create trigger trg_unit_types_updated_at before update on public.unit_types
for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();

drop trigger if exists trg_buildings_updated_at on public.buildings;
create trigger trg_buildings_updated_at before update on public.buildings
for each row execute function public.set_updated_at();

drop trigger if exists trg_floors_updated_at on public.floors;
create trigger trg_floors_updated_at before update on public.floors
for each row execute function public.set_updated_at();

drop trigger if exists trg_units_updated_at on public.units;
create trigger trg_units_updated_at before update on public.units
for each row execute function public.set_updated_at();

alter table public.unit_types enable row level security;
alter table public.projects enable row level security;
alter table public.buildings enable row level security;
alter table public.floors enable row level security;
alter table public.units enable row level security;
alter table public.unit_status_history enable row level security;
