create table if not exists public.properties (
  id text primary key check (id ~ '^[A-Z0-9-]+$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 120),
  type text not null check (type in ('apartment', 'house', 'villa', 'plot', 'commercial')),
  purpose text not null check (purpose in ('sale', 'rent')),
  price numeric(15, 2) not null check (price >= 0),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  location jsonb not null,
  specifications jsonb not null,
  images text[] not null default '{}',
  description text not null check (char_length(description) between 20 and 2500),
  amenities text[] not null default '{}',
  facilities text[] not null default '{}',
  status text not null check (status in ('available', 'sold', 'rented', 'unavailable')),
  featured boolean not null default false,
  trending boolean not null default false,
  created_at date not null default current_date
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.properties enable row level security;
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Public can read available properties" on public.properties;
create policy "Public can read available properties"
on public.properties for select
to anon, authenticated
using (status = 'available' or public.is_admin());

drop policy if exists "Admins can insert properties" on public.properties;
create policy "Admins can insert properties"
on public.properties for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update properties" on public.properties;
create policy "Admins can update properties"
on public.properties for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete properties" on public.properties;
create policy "Admins can delete properties"
on public.properties for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins can read their authorization row" on public.admin_users;
create policy "Admins can read their authorization row"
on public.admin_users for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.reset_properties_to_seed(seed_records jsonb)
returns setof public.properties
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  delete from public.properties;
  insert into public.properties
  select *
  from jsonb_to_recordset(seed_records) as seeded(
    id text,
    slug text,
    title text,
    type text,
    purpose text,
    price numeric,
    currency text,
    location jsonb,
    specifications jsonb,
    images text[],
    description text,
    amenities text[],
    facilities text[],
    status text,
    featured boolean,
    trending boolean,
    created_at date
  );

  return query select * from public.properties order by created_at desc;
end;
$$;

revoke all on function public.reset_properties_to_seed(jsonb) from public;
grant execute on function public.reset_properties_to_seed(jsonb) to authenticated;
