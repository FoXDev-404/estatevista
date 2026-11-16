-- ====================================================================
-- EstateVista CRM defaults
-- ====================================================================

-- Shared lead/customer source catalogue for every company.
insert into public.lookups (company_id, list_key, name, sort_order, is_default)
select c.id, 'source', s.name, s.sort_order, s.sort_order = 1
from public.companies c
cross join (
  values
    ('Website', 1),
    ('Walk-in', 2),
    ('Referral', 3),
    ('Facebook', 4),
    ('Phone call', 5),
    ('Agent', 6)
) as s(name, sort_order)
on conflict (company_id, list_key, name) do nothing;
