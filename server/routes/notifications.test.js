import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { MemoryAuthRepository } from '../auth/memoryRepository.js';
import { MemoryAdminRepository } from '../admin/memoryRepository.js';
import { SupabaseAdminRepository } from '../admin/repository.js';
import { hashPassword } from '../auth/password.js';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_COMPANY_ID = '11111111-2222-4222-8222-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const MANAGER_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444';
const ADMIN_ROLE_ID = '99999999-9999-4999-8999-999999999999';
const MANAGER_ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const PROJECT_ID = 'a1111111-1111-4111-8111-111111111111';
const UNIT_ID = 'e1111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'c1111111-1111-4111-8111-111111111111';
const LEAD_ID = '16161616-1616-4616-8616-161616161616';
const NOTIFICATION_ADMIN_ID = 'n1111111-1111-4111-8111-111111111111';
const NOTIFICATION_ADMIN_READ_ID = 'n2222222-2222-4222-8222-222222222222';
const NOTIFICATION_MANAGER_ID = 'n3333333-3333-4333-8333-333333333333';
const NOTIFICATION_OTHER_ID = 'n4444444-4444-4444-8444-444444444444';

const MANAGER_PERMISSIONS = [
  'dashboard.view',
  'leads.view',
  'sales.view',
  'collections.view',
];

const PERMISSION_ROWS = [...new Set([...MANAGER_PERMISSIONS, 'leads.create', 'leads.edit', 'sales.create', 'collections.create'])]
  .map((key, index) => ({
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
  email: 'hello@other-company.test',
  currency: 'USD',
  timezone: 'UTC',
  date_format: 'YYYY-MM-DD',
  number_decimals: 2,
  is_active: true,
};

function sequenceRow(documentType, prefix, padding = 5) {
  return {
    id: `${documentType}-sequence`,
    company_id: COMPANY_ID,
    document_type: documentType,
    prefix,
    padding,
    reset_period: 'yearly',
    next_value: 1,
  };
}

function projectRow(overrides) {
  return {
    company_id: COMPANY_ID,
    branch_id: null,
    project_manager_id: null,
    number: 'PRJ-0001',
    name: 'Harbor Point',
    code: 'HARBOR',
    slug: 'harbor-point',
    type: 'residential',
    status: 'active',
    description: null,
    location: null,
    city: 'Springfield',
    address: null,
    land_area: null,
    land_area_unit: 'sqft',
    latitude: null,
    longitude: null,
    booking_amount: 0,
    budget: 0,
    currency: 'USD',
    start_date: null,
    expected_completion_date: null,
    actual_completion_date: null,
    is_published: false,
    is_featured: false,
    amenities: [],
    specifications: [],
    nearby_places: [],
    video_url: null,
    payment_note: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function unitRow(overrides) {
  return {
    company_id: COMPANY_ID,
    project_id: PROJECT_ID,
    building_id: null,
    floor_id: null,
    unit_type_id: null,
    unit_number: 'A-101',
    area: 1000,
    area_unit: 'sqft',
    bedrooms: 2,
    bathrooms: 2,
    sale_price: 250000,
    rent_price: 1500,
    status: 'available',
    description: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function cookieFrom(response, name) {
  const header = response.headers['set-cookie'] || [];
  const match = header.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split(';')[0].slice(name.length + 1));
}

const ROUTE_REPOSITORY_METHODS = new Set([
  'createNotification',
  'countNotifications',
  'countUnreadNotifications',
  'getNotification',
  'listNotifications',
  'markAllNotificationsRead',
  'markNotificationRead',
  'writeAudit',
]);

function guardAgainstSupabaseGaps(memoryRepository) {
  return new Proxy(memoryRepository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (
        typeof property === 'string' &&
        typeof value === 'function' &&
        ROUTE_REPOSITORY_METHODS.has(property) &&
        !(property in SupabaseAdminRepository.prototype)
      ) {
        throw new Error(`SupabaseAdminRepository is missing ${property}()`);
      }
      return value;
    },
  });
}

async function makeApp() {
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
        name: 'Sales Agent',
        description: '',
        is_default: true,
      },
    ],
    userRoles: [
      { user_id: ADMIN_ID, role_id: ADMIN_ROLE_ID },
      { user_id: MANAGER_ID, role_id: MANAGER_ROLE_ID },
    ],
    rolePermissions: [
      ...MANAGER_PERMISSIONS.map((key) => ({ role_id: MANAGER_ROLE_ID, permission_key: key })),
      ...['leads.create', 'leads.edit', 'sales.create', 'collections.create'].map((key) => ({
        role_id: ADMIN_ROLE_ID,
        permission_key: key,
      })),
    ],
    permissions: PERMISSION_ROWS,
  });

  const adminRepository = new MemoryAdminRepository({
    companies: [company, otherCompany],
    settings: [{ company_id: COMPANY_ID }],
    sequences: [sequenceRow('sale', 'SAL-'), sequenceRow('payment_receipt', 'RCP-', 6)],
    projects: [projectRow({ id: PROJECT_ID })],
    units: [unitRow({ id: UNIT_ID })],
    customers: [
      {
        id: CUSTOMER_ID,
        company_id: COMPANY_ID,
        name: 'Priya Nair',
        phone: '555-0100',
        email: null,
        type: 'individual',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ],
    leads: [
      {
        id: LEAD_ID,
        company_id: COMPANY_ID,
        name: 'Avery Stone',
        phone: '555-0101',
        email: null,
        source_id: null,
        assigned_to: MANAGER_ID,
        project_id: null,
        unit_id: null,
        status: 'new',
        lost_reason: null,
        budget_min: null,
        budget_max: null,
        notes: null,
        created_by: ADMIN_ID,
        updated_by: ADMIN_ID,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ],
    notifications: [
      {
        id: NOTIFICATION_ADMIN_ID,
        company_id: COMPANY_ID,
        user_id: ADMIN_ID,
        event_key: 'seed.one',
        title: 'Unread admin notification',
        body: null,
        url: '/admin/leads',
        is_read: false,
        read_at: null,
        created_at: '2026-11-17T09:00:00.000Z',
      },
      {
        id: NOTIFICATION_ADMIN_READ_ID,
        company_id: COMPANY_ID,
        user_id: ADMIN_ID,
        event_key: 'seed.two',
        title: 'Read admin notification',
        body: null,
        url: null,
        is_read: true,
        read_at: '2026-11-17T08:30:00.000Z',
        created_at: '2026-11-17T08:00:00.000Z',
      },
      {
        id: NOTIFICATION_MANAGER_ID,
        company_id: COMPANY_ID,
        user_id: MANAGER_ID,
        event_key: 'seed.three',
        title: 'Manager notification',
        body: null,
        url: null,
        is_read: false,
        read_at: null,
        created_at: '2026-11-17T07:00:00.000Z',
      },
      {
        id: NOTIFICATION_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        user_id: OTHER_USER_ID,
        event_key: 'seed.four',
        title: 'Other company notification',
        body: null,
        url: null,
        is_read: false,
        read_at: null,
        created_at: '2026-11-17T06:00:00.000Z',
      },
    ],
    team: [
      {
        id: ADMIN_ID,
        company_id: COMPANY_ID,
        name: 'Jordan Hale',
        email: 'jordan@meridian-estates.test',
        branch_id: null,
        full_access: true,
        is_active: true,
        roles: [{ id: ADMIN_ROLE_ID, name: 'Company Admin' }],
      },
      {
        id: MANAGER_ID,
        company_id: COMPANY_ID,
        name: 'Sam Rivera',
        email: 'sam@meridian-estates.test',
        branch_id: null,
        full_access: false,
        is_active: true,
        roles: [{ id: MANAGER_ROLE_ID, name: 'Sales Agent' }],
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
        name: 'Sales Agent',
        description: '',
        is_default: true,
      },
    ],
    rolePermissions: {
      [ADMIN_ROLE_ID]: [...MANAGER_PERMISSIONS, 'leads.create', 'leads.edit', 'sales.create', 'collections.create'],
      [MANAGER_ROLE_ID]: [...MANAGER_PERMISSIONS],
    },
  });

  const app = createApp({
    authRepository,
    adminRepository: guardAgainstSupabaseGaps(adminRepository),
  });
  return { app, adminRepository };
}

async function login(app, email, password) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ email, password }).expect(200);
  const csrf = cookieFrom(response, 'ev_csrf');
  expect(csrf).toBeTruthy();
  return { agent, csrf };
}

const loginAdmin = (app) => login(app, 'jordan@meridian-estates.test', 'AdminPass123');
const loginManager = (app) => login(app, 'sam@meridian-estates.test', 'ManagerPass123');

describe('notification routes', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await makeApp());
  });

  it('requires a session', async () => {
    await request(app).get('/api/notifications').expect(401);
  });

  it('lists only the signed-in user notifications with an unread count', async () => {
    const { agent } = await loginAdmin(app);
    const response = await agent.get('/api/notifications').expect(200);

    expect(response.body.data.map((row) => row.id)).toEqual([
      NOTIFICATION_ADMIN_ID,
      NOTIFICATION_ADMIN_READ_ID,
    ]);
    expect(response.body.meta.unread_count).toBe(1);

    const unread = await agent.get('/api/notifications?unread=1').expect(200);
    expect(unread.body.data.map((row) => row.id)).toEqual([NOTIFICATION_ADMIN_ID]);

    const manager = await loginManager(app);
    const managerList = await manager.agent.get('/api/notifications').expect(200);
    expect(managerList.body.data.map((row) => row.id)).toEqual([NOTIFICATION_MANAGER_ID]);
    expect(managerList.body.meta.unread_count).toBe(1);
  });

  it('marks one notification read and refuses another user notification', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const marked = await agent
      .post(`/api/notifications/${NOTIFICATION_ADMIN_ID}/read`)
      .set('X-CSRF-Token', csrf)
      .expect(200);

    expect(marked.body.data.notification.is_read).toBe(true);
    expect(marked.body.data.unread_count).toBe(0);

    const manager = await loginManager(app);
    await manager.agent
      .post(`/api/notifications/${NOTIFICATION_ADMIN_ID}/read`)
      .set('X-CSRF-Token', manager.csrf)
      .expect(404);

    await agent
      .post(`/api/notifications/${NOTIFICATION_ADMIN_ID}/read`)
      .expect(403);
  });

  it('marks all notifications read for the signed-in user only', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const response = await agent
      .post('/api/notifications/read-all')
      .set('X-CSRF-Token', csrf)
      .expect(200);

    expect(response.body.data.updated).toBe(1);
    expect(response.body.data.unread_count).toBe(0);

    const list = await agent.get('/api/notifications?unread=1').expect(200);
    expect(list.body.data).toEqual([]);

    const manager = await loginManager(app);
    const managerList = await manager.agent.get('/api/notifications').expect(200);
    expect(managerList.body.meta.unread_count).toBe(1);
  });

  it('notifies the assignee when a lead is assigned and when its stage changes', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await agent
      .post('/api/leads')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'New Assigned Lead',
        phone: '555-0188',
        assigned_to: MANAGER_ID,
        status: 'new',
      })
      .expect(201);
    const leadId = created.body.data.id;

    const manager = await loginManager(app);
    let list = await manager.agent.get('/api/notifications').expect(200);
    const assigned = list.body.data.find((row) => row.event_key === 'lead.assigned');
    expect(assigned).toMatchObject({
      title: 'New lead assigned: New Assigned Lead',
      url: `/admin/leads/${leadId}`,
      is_read: false,
    });
    expect(assigned.body).toMatch(/Jordan Hale/);

    await agent
      .post(`/api/leads/${leadId}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'contacted' })
      .expect(200);

    list = await manager.agent.get('/api/notifications').expect(200);
    const stage = list.body.data.find(
      (row) => row.event_key === 'lead.stage_changed' && row.url === `/admin/leads/${leadId}`,
    );
    expect(stage).toMatchObject({ title: 'Lead moved to Contacted' });
  });

  it('does not notify the actor about their own assignment or stage change', async () => {
    const { agent, csrf } = await loginAdmin(app);

    await agent
      .post('/api/leads')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Self Assigned Lead',
        phone: '555-0189',
        assigned_to: ADMIN_ID,
        status: 'new',
      })
      .expect(201);

    const list = await agent.get('/api/notifications').expect(200);
    expect(list.body.data.some((row) => row.event_key === 'lead.assigned')).toBe(false);
  });

  it('notifies the salesperson about a new sale and a recorded collection', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const sale = await agent
      .post('/api/sales')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        unit_id: UNIT_ID,
        salesperson_id: MANAGER_ID,
        agreement_date: '2026-11-01',
        sale_price: 100000,
        discount_amount: 0,
        tax_amount: 0,
        payment_type: 'installments',
        plan: {
          down_payment: 10000,
          number_of_installments: 2,
          frequency: 'monthly',
          start_date: '2027-01-01',
          due_day: 1,
          grace_days: 5,
          late_fee_type: 'none',
          late_fee_value: 0,
        },
      })
      .expect(201);

    const saleRow = sale.body.data;
    const installment = saleRow.installments[0];
    expect(installment).toBeTruthy();

    await agent
      .post('/api/collections')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        received_on: '2026-11-17',
        amount: Number(installment.balance),
        reference: 'BANK-1',
        allocations: [{ installment_id: installment.id, amount: Number(installment.balance) }],
      })
      .expect(201);

    const manager = await loginManager(app);
    const list = await manager.agent.get('/api/notifications').expect(200);
    const events = list.body.data.map((row) => row.event_key);
    expect(events).toContain('sale.created');
    expect(events).toContain('collection.received');

    const collection = list.body.data.find((row) => row.event_key === 'collection.received');
    expect(collection.url).toBe(`/admin/sales/${saleRow.id}`);
    expect(collection.body).toMatch(saleRow.number);
  });
});
