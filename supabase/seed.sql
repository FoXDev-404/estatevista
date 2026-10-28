-- Run once after applying the migration. Replace this file's JSON with the
-- generated output from the trusted seed script when the catalogue changes.
-- The insert is idempotent and never deletes existing records.
insert into public.properties (
  id, slug, title, type, purpose, price, currency, location, specifications,
  images, description, amenities, facilities, status, featured, trending, created_at
)
select
  record->>'id',
  record->>'slug',
  record->>'title',
  record->>'type',
  record->>'purpose',
  (record->>'price')::numeric,
  coalesce(record->>'currency', 'INR'),
  record->'location',
  record->'specifications',
  array(select jsonb_array_elements_text(record->'images')),
  record->>'description',
  array(select jsonb_array_elements_text(record->'amenities')),
  array(select jsonb_array_elements_text(record->'facilities')),
  record->>'status',
  coalesce((record->>'featured')::boolean, false),
  coalesce((record->>'trending')::boolean, false),
  (record->>'createdAt')::date
from jsonb_array_elements('[]'::jsonb) as record
on conflict (id) do nothing;
