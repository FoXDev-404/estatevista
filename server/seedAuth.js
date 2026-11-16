import { supabase } from './supabaseClient.js';
import { config } from './lib/config.js';
import { DEFAULT_ROLES, PERMISSIONS } from './auth/permissions.js';
import { hashPassword } from './auth/password.js';

const SEQUENCES = [
  { document_type: 'quotation', prefix: 'QT-' },
  { document_type: 'reservation', prefix: 'RSV-' },
  { document_type: 'sale', prefix: 'SA-' },
  { document_type: 'receipt', prefix: 'RCP-' },
  { document_type: 'lease', prefix: 'LSE-' },
  { document_type: 'rent_receipt', prefix: 'RR-' },
  { document_type: 'deposit_receipt', prefix: 'DR-' },
];

async function upsertPermissions() {
  const { error } = await supabase
    .from('permissions')
    .upsert(PERMISSIONS, { onConflict: 'key' });

  if (error) throw new Error(`permissions: ${error.message}`);

  const { data, error: readError } = await supabase.from('permissions').select('id,key');
  if (readError) throw new Error(`permissions read: ${readError.message}`);
  return data || [];
}

async function upsertCompany(seed) {
  const numberDecimals = Number.isFinite(seed.numberDecimals) ? seed.numberDecimals : 2;

  const { data, error } = await supabase
    .from('companies')
    .upsert(
      {
        slug: seed.companySlug,
        name: seed.companyName,
        email: seed.companyEmail || null,
        currency: seed.currency,
        timezone: seed.timezone,
        date_format: seed.dateFormat,
        number_decimals: numberDecimals,
        is_active: true,
        is_demo: false,
      },
      { onConflict: 'slug' },
    )
    .select()
    .single();

  if (error) throw new Error(`company: ${error.message}`);
  return data;
}

async function upsertBranch(companyId) {
  const { data, error } = await supabase
    .from('branches')
    .upsert(
      { company_id: companyId, name: 'Head Office', code: 'HO' },
      { onConflict: 'company_id,code' },
    )
    .select()
    .single();

  if (error) throw new Error(`branch: ${error.message}`);
  return data;
}

async function seedSettingsAndSequences(companyId) {
  const { error: settingsError } = await supabase
    .from('settings')
    .upsert({ company_id: companyId }, { onConflict: 'company_id', ignoreDuplicates: true });
  if (settingsError) throw new Error(`settings: ${settingsError.message}`);

  const rows = SEQUENCES.map((sequence) => ({
    company_id: companyId,
    document_type: sequence.document_type,
    prefix: sequence.prefix,
    padding: 4,
    reset_period: 'yearly',
  }));

  const { error } = await supabase
    .from('number_sequences')
    .upsert(rows, { onConflict: 'company_id,document_type', ignoreDuplicates: true });
  if (error) throw new Error(`number sequences: ${error.message}`);
}

async function seedRoles(companyId, permissions) {
  const rows = DEFAULT_ROLES.map((role) => ({
    company_id: companyId,
    name: role.name,
    description: role.description,
    is_default: true,
  }));

  const { data: roles, error } = await supabase
    .from('roles')
    .upsert(rows, { onConflict: 'company_id,name' })
    .select('id,name');

  if (error) throw new Error(`roles: ${error.message}`);

  const permissionIdByKey = new Map(permissions.map((row) => [row.key, row.id]));
  const allKeys = permissions.map((row) => row.key);

  for (const role of roles) {
    const definition = DEFAULT_ROLES.find((entry) => entry.name === role.name);
    if (!definition) continue;

    const keys = definition.keys === '*' ? allKeys : definition.keys;
    const permissionIds = keys.map((key) => permissionIdByKey.get(key)).filter(Boolean);

    const { error: clearError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', role.id);
    if (clearError) throw new Error(`role permissions clear: ${clearError.message}`);

    if (permissionIds.length) {
      const { error: grantError } = await supabase.from('role_permissions').insert(
        permissionIds.map((permissionId) => ({
          role_id: role.id,
          permission_id: permissionId,
        })),
      );
      if (grantError) throw new Error(`role permissions: ${grantError.message}`);
    }
  }

  return roles;
}

async function seedAdmin(companyId, branchId, roles, seed) {
  const email = String(seed.adminEmail).trim().toLowerCase();

  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', email)
    .maybeSingle();

  if (findError) throw new Error(`admin lookup: ${findError.message}`);

  let adminId = existing?.id;
  let created = false;

  if (!adminId) {
    const { data, error } = await supabase
      .from('users')
      .insert({
        company_id: companyId,
        branch_id: branchId,
        name: seed.adminName,
        email,
        password_hash: await hashPassword(seed.adminPassword),
        full_access: true,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw new Error(`admin: ${error.message}`);
    adminId = data.id;
    created = true;
  } else if (process.env.SEED_RESET_ADMIN_PASSWORD === 'true') {
    const { error } = await supabase
      .from('users')
      .update({ password_hash: await hashPassword(seed.adminPassword) })
      .eq('id', adminId);
    if (error) throw new Error(`admin password reset: ${error.message}`);
  }

  const adminRole = roles.find((role) => role.name === 'Company Admin');
  if (adminRole) {
    const { error } = await supabase.from('user_roles').upsert(
      { user_id: adminId, role_id: adminRole.id },
      { onConflict: 'user_id,role_id', ignoreDuplicates: true },
    );
    if (error) throw new Error(`admin role: ${error.message}`);
  }

  return { email, created };
}

/**
 * Seed the permission catalog, default roles and the first company admin.
 * Runs only when SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are present, so a
 * normal property seed never creates a login silently.
 */
export async function seedAuthData() {
  const { seed } = config;

  if (!seed.adminEmail || !seed.adminPassword) {
    console.log(
      'Auth seed skipped: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the first company admin.',
    );
    return;
  }

  if (seed.adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
  }

  console.log('Seeding permissions, default roles and the first admin...');

  const permissions = await upsertPermissions();
  const company = await upsertCompany(seed);
  const branch = await upsertBranch(company.id);
  await seedSettingsAndSequences(company.id);
  const roles = await seedRoles(company.id, permissions);
  const admin = await seedAdmin(company.id, branch?.id, roles, seed);

  console.log(
    `Auth seed ready for ${company.name} — ${roles.length} roles, ${permissions.length} permissions, admin ${admin.email}${admin.created ? ' created' : ' already existed'}.`,
  );
}
