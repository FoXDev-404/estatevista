import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import { seedProperties } from '../src/data/properties.js';
import { toDbRow } from './models/propertyMapper.js';
import { seedAuthData } from './seedAuth.js';

async function seed() {
  console.log('EstateVista Database Seeder');

  if (!isSupabaseConfigured || !supabase) {
    console.error('Supabase is not configured.');
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
    process.exit(1);
  }

  try {
    console.log(`Preparing ${seedProperties.length} seed properties...`);

    const dbRows = seedProperties.map(toDbRow);
    const { data, error } = await supabase
      .from('properties')
      .upsert(dbRows, { onConflict: 'id' })
      .select('id, title');

    if (error) {
      console.error('Error seeding properties:', error.message);
      if (error.details) console.error('Details:', error.details);
      if (error.hint) console.error('Hint:', error.hint);
      process.exit(1);
    }

    console.log(`Seeded ${data?.length || dbRows.length} properties.`);

    await seedAuthData();

    console.log('Seed complete.');
  } catch (err) {
    console.error('Unexpected error during seeding:', err);
    process.exit(1);
  }
}

seed();
