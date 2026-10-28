import { createClient } from '@supabase/supabase-js';
import seedProperties from '../src/data/properties.js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the local shell before seeding.');
}

const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const rows = seedProperties.map((property) => ({
  id: property.id,
  slug: property.slug,
  title: property.title,
  type: property.type,
  purpose: property.purpose,
  price: property.price,
  currency: property.currency,
  location: property.location,
  specifications: property.specifications,
  images: property.images,
  description: property.description,
  amenities: property.amenities,
  facilities: property.facilities,
  status: property.status,
  featured: property.featured,
  trending: property.trending,
  created_at: property.createdAt,
}));

const { error } = await client.from('properties').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
if (error) throw error;
console.log(`Seeded ${rows.length} records without overwriting existing IDs.`);
