-- ====================================================================
-- EstateVista inventory defaults and document storage
-- ====================================================================

-- Every company gets the same starting unit-type catalogue.
insert into public.unit_types (company_id, name, sort_order)
select c.id, t.name, t.sort_order
from public.companies c
cross join (
  values
    ('Flat', 1),
    ('Plot', 2),
    ('Apartment', 3),
    ('Office', 4),
    ('Shop', 5),
    ('Parking', 6),
    ('Storage', 7)
) as t(name, sort_order)
on conflict (company_id, name) do nothing;

-- Private bucket for project and unit documents. The API uploads and removes
-- objects with the service role, so no anonymous storage policy is created.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
