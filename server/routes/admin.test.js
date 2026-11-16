import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { MemoryAuthRepository } from '../auth/memoryRepository.js';
import { MemoryAdminRepository } from '../admin/memoryRepository.js';
import { hashPassword } from '../auth/password.js';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_COMPANY_ID = '11111111-2222-4222-8222-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const MANAGER_ID = '33333333-3333-4333-8333-333333333333';
const STAFF_ID = '44444444-4444-4444-8444-444444444444';
const SECOND_ADMIN_ID = '55555555-5555-4555-8555-555555555555';
const HEAD_OFFICE_ID = '66666666-6666-4666-8666-666666666666';
const EMPTY_BRANCH_ID = '77777777-7777-4777-8777-777777777777';
const OTHER_BRANCH_ID = '88888888-8888-4888-8888-888888888888';
const ADMIN_ROLE_ID = '99999999-9999-4999-8999-999999999999';
const MANAGER_ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUSTOM_ROLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SEQ_PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SEQ_SALE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OTHER_ROLE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const MANAGER_PERMISSIONS = [
  'settings.view',
  'branches.view',
  'team.view',
  'team.edit',
  'roles.view',
  'audit.view',
];

const PERMISSION_ROWS = MANAGER_PERMISSIONS.map((key, index) => ({
  id: index + 1,
  key,
  module: key.split('.')[0],
  action: key.split('.')[1],
  label: key,
  sort_order: index,
}));

const company = {
  id: COMPANY_ID,
  slug: 'meridian-estates',
  name: 'Meridian Estates',
  email: 'hello@meridian-estates.test',
  currency: 'USD',
  timezone: 'UTC',
  date_format: 'YYYY-MM-DD',
  number_decimals: 2,
  is_active: true,
};

const otherCompany = {
  id: OTHER_COMPANY_ID,
  slug: 'other-company',
  name: 'Other Company',
  currency: 'USD',
  timezone: 'UTC',
  date_format: 'YYYY-MM-DD',
  number_decimals: 2,
  is_active: true,
};

function teamRow(overrides) {
  return {
    company_id: COMPANY_ID,
    branch_id: null,
    phone: null,
    full_access: false,
    is_active: true,
    roles: [],
    ...overrides,
  };
}

function cookieFrom(response, name) {
  const header = response.headers['set-cookie'] || [];
  const match = header.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split(';')[0].slice(name.length + 1));
}

async function makeApp({ adminTeam = null } = {}) {
  const adminHash = await hashPassword('AdminPass123');
  const managerHash = await hashPassword('ManagerPass123');

  const authRepository = new MemoryAuthRepository({
    companies: [company, otherCompany],
    users: [
      {
        id: ADMIN_ID,
        company_id: COMPANY_ID,
        name: 'Jordan Hale',
        email: 'jordan@meridian-estates.test',
        password_hash: adminHash,
        full_access: true,
        is_active: true,
      },
      {
        id: MANAGER_ID,
        company_id: COMPANY_ID,
        name: 'Sam Rivera',
        email: 'sam@meridian-estates.test',
        password_hash: managerHash,
        full_access: false,
        is_active: true,
      },
    ],
    roles: [
      {
        id: ADMIN_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Company Admin',
        description: '',
        is_default: true,
      },
      {
        id: MANAGER_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Sales Manager',
        description: '',
        is_default: true,
      },
    ],
    userRoles: [
      { user_id: ADMIN_ID, role_id: ADMIN_ROLE_ID },
      { user_id: MANAGER_ID, role_id: MANAGER_ROLE_ID },
    ],
    rolePermissions: MANAGER_PERMISSIONS.map((key) => ({
      role_id: MANAGER_ROLE_ID,
      permission_key: key,
    })),
    permissions: PERMISSION_ROWS,
  });

  const adminRepository = new MemoryAdminRepository({
    companies: [company, otherCompany],
    settings: [{ company_id: COMPANY_ID }],
    sequences: [
      {
        id: SEQ_PROJECT_ID,
        company_id: COMPANY_ID,
        document_type: 'project',
        prefix: 'PRJ-',
        padding: 4,
        reset_period: 'never',
        next_value: 1,
      },
      {
        id: SEQ_SALE_ID,
        company_id: COMPANY_ID,
        document_type: 'sale',
        prefix: 'SAL-',
        padding: 5,
        reset_period: 'yearly',
        next_value: 3,
      },
    ],
    branches: [
      {
        id: HEAD_OFFICE_ID,
        company_id: COMPANY_ID,
        name: 'Head Office',
        code: 'HO',
        is_active: true,
        manager_id: MANAGER_ID,
      },
      {
        id: EMPTY_BRANCH_ID,
        company_id: COMPANY_ID,
        name: 'Uttara Office',
        code: 'UTT',
        is_active: true,
        manager_id: null,
      },
      {
        id: OTHER_BRANCH_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Branch',
        code: 'OB',
        is_active: true,
        manager_id: null,
      },
    ],
    projects: [],
    team:
      adminTeam ||
      [
        teamRow({
          id: ADMIN_ID,
          name: 'Jordan Hale',
          email: 'jordan@meridian-estates.test',
          branch_id: HEAD_OFFICE_ID,
          full_access: true,
          roles: [{ id: ADMIN_ROLE_ID, name: 'Company Admin' }],
        }),
        teamRow({
          id: MANAGER_ID,
          name: 'Sam Rivera',
          email: 'sam@meridian-estates.test',
          branch_id: HEAD_OFFICE_ID,
          roles: [{ id: MANAGER_ROLE_ID, name: 'Sales Manager' }],
        }),
        teamRow({
          id: STAFF_ID,
          name: 'Riley Chen',
          email: 'riley@meridian-estates.test',
          branch_id: null,
          roles: [{ id: CUSTOM_ROLE_ID, name: 'Site Supervisor' }],
        }),
        teamRow({
          id: SECOND_ADMIN_ID,
          name: 'Dana Cole',
          email: 'dana@meridian-estates.test',
          full_access: true,
          roles: [{ id: ADMIN_ROLE_ID, name: 'Company Admin' }],
        }),
      ],
    roles: [
      {
        id: ADMIN_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Company Admin',
        description: 'Full workspace',
        is_default: true,
      },
      {
        id: MANAGER_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Sales Manager',
        description: 'Leads and sales',
        is_default: true,
      },
      {
        id: CUSTOM_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Site Supervisor',
        description: 'Construction oversight',
        is_default: false,
      },
      {
        id: OTHER_ROLE_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Company Role',
        description: '',
        is_default: false,
      },
    ],
    rolePermissions: {
      [ADMIN_ROLE_ID]: [...MANAGER_PERMISSIONS],
      [MANAGER_ROLE_ID]: ['team.view', 'leads.view'],
      [CUSTOM_ROLE_ID]: ['projects.view'],
    },
  });

  const app = createApp({ authRepository, adminRepository });
  return { app, authRepository, adminRepository };
}

async function login(app, email, password) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ email, password }).expect(200);
  const csrf = cookieFrom(response, 'ev_csrf');
  expect(csrf).toBeTruthy();
  return { agent, csrf, response };
}

async function loginAdmin(app) {
  return login(app, 'jordan@meridian-estates.test', 'AdminPass123');
}

async function loginManager(app) {
  return login(app, 'sam@meridian-estates.test', 'ManagerPass123');
}

describe('settings, branches, team and roles', () => {
  let app;
  let adminRepository;

  beforeEach(async () => {
    ({ app, adminRepository } = await makeApp());
  });

  it('returns settings with the numbering catalog', async () => {
    const { agent } = await loginAdmin(app);

    const response = await agent.get('/api/settings').expect(200);
    expect(response.body.data.company.name).toBe('Meridian Estates');
    expect(response.body.data.sequences).toHaveLength(2);
    expect(response.body.data.sequences[0].label).toBe('Project');
    expect(response.body.meta.reset_periods.map((row) => row.value)).toEqual([
      'never',
      'yearly',
      'monthly',
    ]);
  });

  it('updates profile and localization and records both changes', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const profile = await agent
      .patch('/api/settings/profile')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Meridian Estates Group',
        legal_name: 'Meridian Estates Group LLC',
        registration_number: 'REG-100',
        tax_number: 'VAT-200',
        email: 'hello@meridian-estates.test',
        phone: '+1 555 0100',
        address: '10 Harbour Road',
        city: 'Springfield',
        state: 'IL',
        postal_code: '62701',
        country: 'United States',
      })
      .expect(200);

    expect(profile.body.data.name).toBe('Meridian Estates Group');

    const localization = await agent
      .patch('/api/settings/localization')
      .set('X-CSRF-Token', csrf)
      .send({
        currency: 'eur',
        timezone: 'Europe/Berlin',
        date_format: 'DD/MM/YYYY',
        number_decimals: 2,
      })
      .expect(200);

    expect(localization.body.data.currency).toBe('EUR');
    expect(localization.body.data.date_format).toBe('DD/MM/YYYY');

    const audit = await agent.get('/api/audit-logs?module=Company').expect(200);
    expect(audit.body.data).toHaveLength(2);
    expect(audit.body.data[0].module).toBe('Company');
  });

  it('validates localization values', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const response = await agent
      .patch('/api/settings/localization')
      .set('X-CSRF-Token', csrf)
      .send({
        currency: 'US',
        timezone: 'Mars/Olympus',
        date_format: 'YYYY-MM-DD',
        number_decimals: 9,
      })
      .expect(422);

    expect(response.body.fields.currency).toBeTruthy();
    expect(response.body.fields.timezone).toBeTruthy();
    expect(response.body.fields.number_decimals).toBeTruthy();
  });

  it('updates only supplied number sequence values and audits changes', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const response = await agent
      .patch('/api/settings/numbering')
      .set('X-CSRF-Token', csrf)
      .send({
        sequences: [
          {
            id: SEQ_PROJECT_ID,
            prefix: 'PROJ-',
            padding: 5,
            reset_period: 'never',
          },
          {
            id: SEQ_SALE_ID,
            prefix: 'SAL-',
            padding: 5,
            reset_period: 'yearly',
          },
        ],
      })
      .expect(200);

    expect(response.body.data[0].prefix).toBe('PROJ-');

    const audit = await adminRepository.listAuditLogs(COMPANY_ID, { module: 'NumberSequence' });
    expect(audit.total).toBe(1);
    expect(audit.data[0].after_data.prefix).toBe('PROJ-');
  });

  it('rejects unknown number sequences', async () => {
    const { agent, csrf } = await loginAdmin(app);

    await agent
      .patch('/api/settings/numbering')
      .set('X-CSRF-Token', csrf)
      .send({
        sequences: [
          {
            id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            prefix: 'X-',
            padding: 4,
            reset_period: 'never',
          },
        ],
      })
      .expect(404);
  });

  it('enforces permissions and CSRF on workspace routes', async () => {
    const { agent: manager, csrf: managerCsrf } = await loginManager(app);
    const { agent: admin, csrf } = await loginAdmin(app);

    await manager.get('/api/settings').expect(200);
    await manager
      .patch('/api/settings/profile')
      .set('X-CSRF-Token', managerCsrf)
      .send({ name: 'Hijacked' })
      .expect(403);

    await admin.get('/api/branches').expect(200);
    await admin.patch('/api/settings/profile').send({ name: 'No CSRF' }).expect(403);

    await admin
      .post('/api/branches')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'New Branch', code: 'NEW', is_active: true })
      .expect(201);
  });

  it('lists, creates, updates and deactivates branches', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const list = await agent.get('/api/branches?search=office&status=active').expect(200);
    expect(list.body.meta.total).toBe(2);
    expect(list.body.data.map((branch) => branch.code)).toEqual(['HO', 'UTT']);

    const created = await agent
      .post('/api/branches')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Gulshan Office',
        code: 'GUL',
        phone: '+1 555 0110',
        email: 'gulshan@meridian-estates.test',
        address: '22 Gulshan Avenue',
        manager_id: MANAGER_ID,
        is_active: true,
      })
      .expect(201);

    expect(created.body.data.manager.name).toBe('Sam Rivera');

    await agent
      .post('/api/branches')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Duplicate', code: 'GUL', is_active: true })
      .expect(422);

    const updated = await agent
      .patch(`/api/branches/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Gulshan Corporate Office',
        code: 'GUL',
        manager_id: MANAGER_ID,
        is_active: true,
      })
      .expect(200);

    expect(updated.body.data.name).toBe('Gulshan Corporate Office');

    const disabled = await agent
      .patch(`/api/branches/${created.body.data.id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ is_active: false })
      .expect(200);

    expect(disabled.body.data.is_active).toBe(false);
  });

  it('blocks deleting a branch with team members and allows an empty branch', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const blocked = await agent
      .delete(`/api/branches/${HEAD_OFFICE_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(409);

    expect(blocked.body.error).toContain('Deactivate it instead');

    await agent
      .delete(`/api/branches/${EMPTY_BRANCH_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(200);

    await agent.get(`/api/branches/${EMPTY_BRANCH_ID}`).expect(404);
  });

  it('keeps branches and roles scoped to the signed-in company', async () => {
    const { agent } = await loginAdmin(app);

    await agent.get(`/api/branches/${OTHER_BRANCH_ID}`).expect(404);
    await agent.get(`/api/roles/${OTHER_ROLE_ID}`).expect(404);
    await agent.get(`/api/roles/${CUSTOM_ROLE_ID}`).expect(200);
  });

  it('creates a team member with roles and rejects a duplicate email', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await agent
      .post('/api/team')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Alex Morgan',
        email: 'alex@meridian-estates.test',
        phone: '+1 555 0120',
        branch_id: EMPTY_BRANCH_ID,
        full_access: false,
        role_ids: [MANAGER_ROLE_ID],
        password: 'AlexPass123',
        password_confirmation: 'AlexPass123',
      })
      .expect(201);

    expect(created.body.data.roles.map((role) => role.name)).toEqual(['Sales Manager']);
    expect(created.body.data.password_hash).toBeUndefined();
    expect(created.body.data.branch.code).toBe('UTT');

    const duplicate = await agent
      .post('/api/team')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Alex Again',
        email: 'alex@meridian-estates.test',
        full_access: false,
        role_ids: [],
        password: 'AlexPass123',
        password_confirmation: 'AlexPass123',
      })
      .expect(422);

    expect(duplicate.body.fields.email).toBeTruthy();
  });

  it('updates a team member and revokes sessions on deactivation', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const updated = await agent
      .patch(`/api/team/${STAFF_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Riley Chen-Park',
        email: 'riley@meridian-estates.test',
        branch_id: HEAD_OFFICE_ID,
        full_access: false,
        is_active: true,
        role_ids: [CUSTOM_ROLE_ID],
      })
      .expect(200);

    expect(updated.body.data.name).toBe('Riley Chen-Park');
    expect(updated.body.data.branch.code).toBe('HO');
    expect(updated.body.data.roles[0].name).toBe('Site Supervisor');

    await agent
      .patch(`/api/team/${STAFF_ID}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ is_active: false })
      .expect(200);

    expect(adminRepository.deletedSessionsFor).toContain(STAFF_ID);
  });

  it('protects the signed-in account and full-access changes', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const { agent: manager, csrf: managerCsrf } = await loginManager(app);

    await agent
      .patch(`/api/team/${ADMIN_ID}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ is_active: false })
      .expect(422);

    await agent
      .patch(`/api/team/${ADMIN_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Jordan Hale',
        email: 'jordan@meridian-estates.test',
        full_access: false,
        is_active: true,
      })
      .expect(422);

    await manager
      .patch(`/api/team/${STAFF_ID}`)
      .set('X-CSRF-Token', managerCsrf)
      .send({
        name: 'Riley Chen',
        email: 'riley@meridian-estates.test',
        full_access: true,
        is_active: true,
      })
      .expect(403);
  });

  it('keeps at least one active full-access administrator', async () => {
    const onlySecondAdmin = [
      teamRow({
        id: SECOND_ADMIN_ID,
        name: 'Dana Cole',
        email: 'dana@meridian-estates.test',
        full_access: true,
        roles: [{ id: ADMIN_ROLE_ID, name: 'Company Admin' }],
      }),
    ];
    const { app: edgeApp } = await makeApp({ adminTeam: onlySecondAdmin });
    const { agent, csrf } = await loginManager(edgeApp);

    const response = await agent
      .patch(`/api/team/${SECOND_ADMIN_ID}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ is_active: false })
      .expect(422);

    expect(response.body.fields.is_active).toContain('full-access');
  });

  it('lists team members with branch and status filters', async () => {
    const { agent } = await loginAdmin(app);

    const list = await agent.get('/api/team?branch_id=' + HEAD_OFFICE_ID + '&status=active').expect(200);
    expect(list.body.meta.total).toBe(2);
    expect(list.body.data.every((member) => member.branch.code === 'HO')).toBe(true);
  });

  it('exposes the permission catalog for the role editor', async () => {
    const { agent } = await loginAdmin(app);

    const response = await agent.get('/api/roles/permissions').expect(200);
    const settingsGroup = response.body.data.groups.find((group) => group.key === 'workspace');
    const settingsModule = settingsGroup.modules.find((module) => module.key === 'settings');

    expect(response.body.data.total).toBeGreaterThan(1);
    expect(settingsModule.actions.map((action) => action.permission)).toContain('settings.edit');
  });

  it('creates, edits and deletes a custom role with permissions', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await agent
      .post('/api/roles')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Sales Coordinator',
        description: 'Coordinates quotations',
        permission_keys: ['quotations.view', 'leads.view', 'quotations.create'],
      })
      .expect(201);

    expect(created.body.data.permission_keys).toEqual([
      'leads.view',
      'quotations.create',
      'quotations.view',
    ]);

    const renamed = await agent
      .patch(`/api/roles/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Senior Sales Coordinator' })
      .expect(200);

    expect(renamed.body.data.name).toBe('Senior Sales Coordinator');
    expect(renamed.body.data.permission_keys).toHaveLength(3);

    await agent
      .delete(`/api/roles/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .expect(200);

    await agent.get(`/api/roles/${created.body.data.id}`).expect(404);
  });

  it('rejects unknown permissions and protects default or assigned roles', async () => {
    const { agent, csrf } = await loginAdmin(app);

    await agent
      .post('/api/roles')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Bad Role', permission_keys: ['not.a.permission'] })
      .expect(422);

    const defaultRole = await agent
      .delete(`/api/roles/${ADMIN_ROLE_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(409);
    expect(defaultRole.body.error).toContain('Default roles');

    const assignedRole = await agent
      .delete(`/api/roles/${CUSTOM_ROLE_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(409);
    expect(assignedRole.body.error).toContain('assigned');
  });

  it('lists audit entries with filters, pagination and options', async () => {
    const { agent, csrf } = await loginAdmin(app);

    await agent
      .post('/api/branches')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Audit Branch', code: 'AUD', is_active: true })
      .expect(201);

    const list = await agent.get('/api/audit-logs?module=Branch&limit=10').expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].event).toBe('created');
    expect(list.body.meta.total).toBe(1);

    const options = await agent.get('/api/audit-logs/options').expect(200);
    expect(options.body.data.modules.map((module) => module.value)).toContain('Branch');
    expect(options.body.data.events.map((event) => event.value)).toContain('updated');
  });

  it('returns form lookups for branches, roles and users', async () => {
    const { agent } = await loginAdmin(app);

    const response = await agent.get('/api/lookups').expect(200);
    expect(response.body.data.branches).toHaveLength(2);
    expect(response.body.data.roles).toHaveLength(3);
    expect(response.body.data.users).toHaveLength(4);
  });
});
