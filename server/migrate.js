import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 EstateVista Database Migration');

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const schemaPath = path.resolve(__dirname, '../supabase/schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema file not found at ${schemaPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  if (!databaseUrl) {
    console.log('\nℹ️  DATABASE_URL is not set in your .env file.');
    console.log('You have two easy ways to apply the migration:\n');
    console.log('📌 Option 1: One-Click SQL Editor (Recommended)');
    console.log('   1. Open: https://supabase.com/dashboard/project/qhwcvwbgkvjwbryelexf/sql/new');
    console.log('   2. Copy and paste the contents of supabase/schema.sql');
    console.log('   3. Click "Run"\n');
    console.log('📌 Option 2: Automated CLI Migration');
    console.log('   1. In Supabase: Project Settings -> Database -> Connection string (URI)');
    console.log('   2. Add DATABASE_URL to your .env:');
    console.log('      DATABASE_URL="postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"');
    console.log('   3. Run: npm run db:migrate\n');
    process.exit(0);
  }

  console.log('Connecting to PostgreSQL database via DATABASE_URL...');

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL. Applying schema...');

    await client.query(sql);

    console.log('✅ Migration complete! Tables "properties" and "enquiries" are ready in Supabase.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.position) console.error(`Error position: ${err.position}`);
    try {
      await client.end();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

runMigration();

