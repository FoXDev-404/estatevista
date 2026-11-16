import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function migrationFiles() {
  const base = path.join(root, 'supabase', 'schema.sql');
  const dir = path.join(root, 'supabase', 'migrations');

  const files = [];
  if (fs.existsSync(base)) files.push(base);
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith('.sql')).sort()) {
      files.push(path.join(dir, name));
    }
  }
  return files;
}

function printInstructions() {
  console.log('\nDATABASE_URL is not set.');
  console.log('Apply the schema in one of two ways:\n');
  console.log('1. Local / CI: add the direct PostgreSQL connection string to .env');
  console.log('   DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres');
  console.log('   then run: npm run db:migrate\n');
  console.log('2. Supabase dashboard: open SQL Editor and run, in order:');
  console.log('   supabase/schema.sql');
  for (const file of migrationFiles()) {
    const relative = path.relative(root, file);
    if (relative !== path.join('supabase', 'schema.sql')) console.log(`   ${relative}`);
  }
  console.log('');
}

async function run() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const files = migrationFiles();

  if (!files.length) {
    console.error('No schema or migration files were found under supabase/.');
    process.exit(1);
  }

  if (!databaseUrl) {
    printInstructions();
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected. Checking applied migrations...');

    await client.query(`
      create table if not exists public.schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    for (const file of files) {
      const name = path.basename(file);
      const { rows } = await client.query(
        'select 1 from public.schema_migrations where name = $1',
        [name],
      );

      if (rows.length) {
        console.log(`  = ${name} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(file, 'utf8');
      console.log(`  + ${name}`);

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into public.schema_migrations (name) values ($1)', [name]);
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw Object.assign(error, { migration: name });
      }
    }

    console.log('All migrations are up to date.');
  } catch (error) {
    console.error(`Migration failed${error.migration ? ` (${error.migration})` : ''}:`, error.message);
    if (error.position) console.error(`Error position: ${error.position}`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

run();
