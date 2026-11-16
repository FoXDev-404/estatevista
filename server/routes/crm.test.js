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
const ADMIN_ROLE_ID = '99999999-9999-4999-8999-999999999999';
const MANAGER_ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const PROJECT_ID = 'a1111111-1111-4111-8111-111111111111';
const OTHER_PROJECT_ID = 'a3333333-3333-4333-8333-333333333333';
const UNIT_ID = 'e1111111-1111-4111-8111-111111111111';
const SOURCE_WEBSITE_ID = 'f1111111-1111-4111-8111-111111111111';
const SOURCE_REFERRAL_ID = 'f2222222-2222-4222-8222-222222222222';
const LEAD_ID = '11111111-aaaa-4aaa-8aaa-111111111111';
const LEAD_TWO_ID = '11111111-bbbb-4bbb-8bbb-111111111111';
const LEAD_OTHER_ID = '11111111-cccc-4ccc-8ccc-111111111111';
const CUSTOMER_ID = '22222222-aaaa-4aaa-8aaa-222222222222';
const CUSTOMER_TWO_ID = '22222222-bbbb-4bbb-8bbb-222222222222';
const CUSTOMER_OTHER_ID = '22222222-cccc-4ccc-8ccc-222222222222';
const FOLLOWUP_ID = '33333333-aaaa-4aaa-8aaa-333333333333';
const VISIT_ID = '44444444-aaaa-4aaa-8aaa-444444444444';
const VISIT_PAST_ID = '44444444-bbbb-4bbb-8bbb-444444444444';
const VISIT_OTHER_ID = '44444444-cccc-4ccc-8ccc-444444444444';

const MANAGER_PERMISSIONS = [
  'leads.view',
  'leads.create',
  'leads.edit',
  'visits.view',
  'visits.create',
  'visits.edit',
  'customers.view',
  'customers.create',
  'customers.edit',
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
  email: 'hello@other-company.test',
  currency: 'USD',
  timezone: 'UTC',
  date_format: 'YYYY-MM-DD',
  number_decimals: 2,
  is_active: true,
};

function leadRow(overrides) {
  return {
    company_id: COMPANY_ID,
    branch_id: null,
    source_id: SOURCE_WEBSITE_ID,
    assigned_to: null,
    project_id: null,
    unit_id: null,
    name: 'Avery Stone',
    phone: '555-0100',
    email: 'avery@example.test',
    status: 'new',
    lost_reason: null,
    budget_min: 100000,
    budget_max: 250000,
    notes: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function customerRow(overrides) {
  return {
    company_id: COMPANY_ID,
    lead_id: null,
    source_id: SOURCE_WEBSITE_ID,
    name: 'Avery Stone',
    type: 'individual',
    phone: '555-0100',
    alternate_phone: null,
    email: 'avery@example.test',
    national_id: null,
    date_of_birth: null,
    occupation: null,
    address: null,
    city: 'Springfield',
    country: 'US',
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function projectRow(overrides) {
  return {
    company_id: COMPANY_ID,
    branch_id: null,
    project_manager_id: null,
    number: 'PRJ-0007',
    name: 'Lakeview Heights',
    code: 'PRJ-0007',
    slug: 'lakeview-heights',
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
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
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
    rent_price: 0,
    status: 'available',
    description: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function cookieFrom(response, name) {
  const header = response.headers['set-cookie'] || [];
  const match = header.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split(';')[0].slice(name.length + 1));
}

/**
 * Fails the test the moment a CRM route calls a method the Supabase repository
 * does not implement. The route suite otherwise runs entirely against memory,
 * which previously hid a missing getLookup() until browser testing. Only
 * route-facing methods are checked so memory-internal helpers are ignored.
 */
const ROUTE_REPOSITORY_METHODS = new Set([
  'createCustomer',
  'createLead',
  'createLeadFollowup',
  'createVisit',
  'deleteCustomer',
  'deleteLead',
  'deleteVisit',
  'findCustomerByLead',
  'getCustomer',
  'getLead',
  'getLeadFollowup',
  'getLookup',
  'getProject',
  'getTeamMember',
  'getUnit',
  'getVisit',
  'listCustomers',
  'listLeadFollowups',
  'listLeads',
  'listVisits',
  'updateCustomer',
  'updateLead',
  'updateLeadFollowup',
  'updateVisit',
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
    branches: [],
    projects: [
      projectRow({ id: PROJECT_ID }),
      projectRow({
        id: OTHER_PROJECT_ID,
        company_id: OTHER_COMPANY_ID,
        number: 'PRJ-0001',
        name: 'Other Company Project',
        code: 'PRJ-0001',
        slug: 'other-company-project',
      }),
    ],
    unitTypes: [],
    units: [unitRow({ id: UNIT_ID })],
    lookups: [
      {
        id: SOURCE_WEBSITE_ID,
        company_id: COMPANY_ID,
        list_key: 'source',
        name: 'Website',
        sort_order: 1,
        is_active: true,
      },
      {
        id: SOURCE_REFERRAL_ID,
        company_id: COMPANY_ID,
        list_key: 'source',
        name: 'Referral',
        sort_order: 2,
        is_active: true,
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
        roles: [{ id: MANAGER_ROLE_ID, name: 'Sales Manager' }],
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
    rolePermissions: {
      [ADMIN_ROLE_ID]: [...MANAGER_PERMISSIONS],
      [MANAGER_ROLE_ID]: [...MANAGER_PERMISSIONS],
    },
    leads: [
      leadRow({
        id: LEAD_ID,
        assigned_to: MANAGER_ID,
        project_id: PROJECT_ID,
        unit_id: UNIT_ID,
        status: 'negotiation',
      }),
      leadRow({
        id: LEAD_TWO_ID,
        name: 'Blake Moore',
        phone: null,
        email: 'blake@example.test',
        source_id: SOURCE_REFERRAL_ID,
        status: 'won',
      }),
      leadRow({
        id: LEAD_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Lead',
        phone: '555-0199',
      }),
    ],
    customers: [
      customerRow({ id: CUSTOMER_ID }),
      customerRow({
        id: CUSTOMER_TWO_ID,
        name: 'Blake Moore',
        phone: null,
        email: 'blake@example.test',
        source_id: SOURCE_REFERRAL_ID,
        type: 'company',
      }),
      customerRow({
        id: CUSTOMER_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Customer',
      }),
    ],
    leadFollowups: [
      {
        id: FOLLOWUP_ID,
        company_id: COMPANY_ID,
        lead_id: LEAD_ID,
        type: 'call',
        scheduled_at: '2026-11-20T09:00:00.000Z',
        completed_at: null,
        outcome: null,
        notes: 'Discuss payment plan',
        created_by: ADMIN_ID,
        created_at: '2026-11-02T00:00:00.000Z',
      },
    ],
    visits: [
      {
        id: VISIT_ID,
        company_id: COMPANY_ID,
        lead_id: LEAD_ID,
        customer_id: null,
        project_id: PROJECT_ID,
        unit_id: UNIT_ID,
        salesperson_id: MANAGER_ID,
        scheduled_at: '2030-01-15T10:00:00.000Z',
        status: 'scheduled',
        notes: null,
        created_at: '2026-11-02T00:00:00.000Z',
        updated_at: '2026-11-02T00:00:00.000Z',
      },
      {
        id: VISIT_PAST_ID,
        company_id: COMPANY_ID,
        lead_id: null,
        customer_id: CUSTOMER_ID,
        project_id: PROJECT_ID,
        unit_id: null,
        salesperson_id: null,
        scheduled_at: '2020-01-15T10:00:00.000Z',
        status: 'completed',
        notes: 'First visit',
        created_at: '2020-01-10T00:00:00.000Z',
        updated_at: '2020-01-15T12:00:00.000Z',
      },
      {
        id: VISIT_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        lead_id: LEAD_OTHER_ID,
        customer_id: null,
        project_id: OTHER_PROJECT_ID,
        unit_id: null,
        salesperson_id: null,
        scheduled_at: '2030-01-15T10:00:00.000Z',
        status: 'scheduled',
        notes: null,
        created_at: '2026-11-02T00:00:00.000Z',
        updated_at: '2026-11-02T00:00:00.000Z',
      },
    ],
  });

  const app = createApp({
    authRepository,
    adminRepository: guardAgainstSupabaseGaps(adminRepository),
  });
  return { app, authRepository, adminRepository };
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

describe('crm: leads, follow-ups, visits and customers', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await makeApp());
  });

  it('lists and filters leads, including the open-lead view', async () => {
    const { agent } = await loginAdmin(app);

    const all = await agent.get('/api/leads').expect(200);
    expect(all.body.meta.total).toBe(2);
    expect(all.body.data.map((row) => row.id).sort()).toEqual([LEAD_ID, LEAD_TWO_ID].sort());

    const open = await agent.get('/api/leads?status=open').expect(200);
    expect(open.body.data.map((row) => row.id)).toEqual([LEAD_ID]);

    const search = await agent.get('/api/leads?search=blake').expect(200);
    expect(search.body.data.map((row) => row.id)).toEqual([LEAD_TWO_ID]);

    const source = await agent.get(`/api/leads?source_id=${SOURCE_REFERRAL_ID}`).expect(200);
    expect(source.body.data.map((row) => row.id)).toEqual([LEAD_TWO_ID]);

    const assigned = await agent.get(`/api/leads?assigned_to=${MANAGER_ID}`).expect(200);
    expect(assigned.body.data.map((row) => row.id)).toEqual([LEAD_ID]);

    const detail = await agent.get(`/api/leads/${LEAD_ID}`).expect(200);
    expect(detail.body.data).toMatchObject({
      id: LEAD_ID,
      project: { id: PROJECT_ID, name: 'Lakeview Heights' },
      unit: { id: UNIT_ID, unit_number: 'A-101' },
      assigned_user: { id: MANAGER_ID, name: 'Sam Rivera' },
      source: { id: SOURCE_WEBSITE_ID, name: 'Website' },
    });
    expect(detail.body.data.followups).toHaveLength(1);
    expect(detail.body.data.visits).toHaveLength(1);

    await agent.get(`/api/leads/${LEAD_OTHER_ID}`).expect(404);
  });

  it('requires a name and at least one contact channel for a lead', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const missing = await agent
      .post('/api/leads')
      .set('X-CSRF-Token', csrf)
      .send({ name: '', phone: '', email: '', status: 'new' })
      .expect(422);
    expect(missing.body.fields.name).toBe('Enter the lead name.');
    expect(missing.body.fields.phone).toBe('Enter a phone number or an email address.');

    const phoneOnly = await agent
      .post('/api/leads')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Casey Reed',
        phone: '555-0142',
        email: '',
        status: 'new',
        source_id: SOURCE_WEBSITE_ID,
        project_id: PROJECT_ID,
      })
      .expect(201);
    expect(phoneOnly.body.data).toMatchObject({
      name: 'Casey Reed',
      phone: '555-0142',
      email: null,
      status: 'new',
      source: { id: SOURCE_WEBSITE_ID, name: 'Website' },
      project: { id: PROJECT_ID },
    });

    const emailOnly = await agent
      .post('/api/leads')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Drew Lane',
        phone: '',
        email: 'drew@example.test',
        status: 'new',
      })
      .expect(201);
    expect(emailOnly.body.data.email).toBe('drew@example.test');
  });

  it('requires a lost reason and clears it when the lead is reopened', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const missingReason = await agent
      .patch(`/api/leads/${LEAD_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'lost' })
      .expect(422);
    expect(missingReason.body.fields.lost_reason).toBe(
      'Explain why this lead was lost.',
    );

    const lost = await agent
      .patch(`/api/leads/${LEAD_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'lost', lost_reason: 'Chose another project' })
      .expect(200);
    expect(lost.body.data).toMatchObject({
      status: 'lost',
      lost_reason: 'Chose another project',
    });

    const reopened = await agent
      .patch(`/api/leads/${LEAD_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'negotiation', lost_reason: '' })
      .expect(200);
    expect(reopened.body.data).toMatchObject({ status: 'negotiation', lost_reason: null });

    const direct = await agent
      .post(`/api/leads/${LEAD_TWO_ID}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'lost' })
      .expect(422);
    expect(direct.body.fields.lost_reason).toBe('Explain why this lead was lost.');

    const directLost = await agent
      .post(`/api/leads/${LEAD_TWO_ID}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'lost', lost_reason: 'Budget' })
      .expect(200);
    expect(directLost.body.data).toMatchObject({ status: 'lost', lost_reason: 'Budget' });
  });

  it('creates and completes a follow-up on a lead', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await agent
      .post(`/api/leads/${LEAD_ID}/followups`)
      .set('X-CSRF-Token', csrf)
      .send({
        type: 'meeting',
        scheduled_at: '2030-02-01T11:00:00.000Z',
        notes: 'Walk the customer through Tower A',
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      lead_id: LEAD_ID,
      type: 'meeting',
      completed_at: null,
      notes: 'Walk the customer through Tower A',
    });

    const completed = await agent
      .patch(`/api/leads/${LEAD_ID}/followups/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ outcome: 'Customer wants a corner unit' })
      .expect(200);
    expect(completed.body.data.outcome).toBe('Customer wants a corner unit');
    expect(completed.body.data.completed_at).toBeTruthy();

    const detail = await agent.get(`/api/leads/${LEAD_ID}`).expect(200);
    expect(detail.body.data.followups).toHaveLength(2);
  });

  it('converts a lead to one customer and links both records', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const converted = await agent
      .post(`/api/leads/${LEAD_ID}/convert`)
      .set('X-CSRF-Token', csrf)
      .send({})
      .expect(201);
    expect(converted.body.data.customer).toMatchObject({
      lead_id: LEAD_ID,
      name: 'Avery Stone',
      phone: '555-0100',
      email: 'avery@example.test',
      source_id: SOURCE_WEBSITE_ID,
      type: 'individual',
    });
    expect(converted.body.data.lead).toMatchObject({ id: LEAD_ID, status: 'won' });

    const duplicate = await agent
      .post(`/api/leads/${LEAD_ID}/convert`)
      .set('X-CSRF-Token', csrf)
      .send({})
      .expect(409);
    expect(duplicate.body.error).toBe('This lead has already been converted to a customer.');

    const customerId = converted.body.data.customer.id;
    const detail = await agent.get(`/api/customers/${customerId}`).expect(200);
    expect(detail.body.data).toMatchObject({
      id: customerId,
      lead: { id: LEAD_ID, name: 'Avery Stone' },
    });
  });

  it('allows a fresh conversion after the linked customer is deleted', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const first = await agent
      .post(`/api/leads/${LEAD_ID}/convert`)
      .set('X-CSRF-Token', csrf)
      .send({})
      .expect(201);
    await agent
      .delete(`/api/customers/${first.body.data.customer.id}`)
      .set('X-CSRF-Token', csrf)
      .expect(200);

    const detail = await agent.get(`/api/leads/${LEAD_ID}`).expect(200);
    expect(detail.body.data.customer).toBeNull();

    const second = await agent
      .post(`/api/leads/${LEAD_ID}/convert`)
      .set('X-CSRF-Token', csrf)
      .send({})
      .expect(201);
    expect(second.body.data.customer).toMatchObject({ lead_id: LEAD_ID, name: 'Avery Stone' });
  });

  it('lists and filters customers with source and status', async () => {
    const { agent } = await loginAdmin(app);

    const all = await agent.get('/api/customers').expect(200);
    expect(all.body.meta.total).toBe(2);

    const search = await agent.get('/api/customers?search=blake').expect(200);
    expect(search.body.data.map((row) => row.id)).toEqual([CUSTOMER_TWO_ID]);

    const byType = await agent.get('/api/customers?type=company').expect(200);
    expect(byType.body.data.map((row) => row.id)).toEqual([CUSTOMER_TWO_ID]);

    const bySource = await agent.get(`/api/customers?source_id=${SOURCE_REFERRAL_ID}`).expect(200);
    expect(bySource.body.data.map((row) => row.id)).toEqual([CUSTOMER_TWO_ID]);

    await agent.get(`/api/customers/${CUSTOMER_OTHER_ID}`).expect(404);
  });

  it('creates, edits and deactivates a customer', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const invalid = await agent
      .post('/api/customers')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'No Phone', type: 'individual', phone: '' })
      .expect(422);
    expect(invalid.body.fields.phone).toBe('Enter the customer phone number.');

    const created = await agent
      .post('/api/customers')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Emery Cole',
        type: 'individual',
        phone: '555-0133',
        email: 'emery@example.test',
        source_id: SOURCE_REFERRAL_ID,
        city: 'Fairview',
        country: 'US',
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      name: 'Emery Cole',
      phone: '555-0133',
      source: { id: SOURCE_REFERRAL_ID, name: 'Referral' },
      is_active: true,
    });

    const updated = await agent
      .patch(`/api/customers/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ occupation: 'Architect', is_active: false })
      .expect(200);
    expect(updated.body.data).toMatchObject({ occupation: 'Architect', is_active: false });

    const inactive = await agent.get('/api/customers?status=inactive').expect(200);
    expect(inactive.body.data.map((row) => row.id)).toEqual([created.body.data.id]);
  });

  it('soft deletes leads and customers', async () => {
    const { agent, csrf } = await loginAdmin(app);

    await agent.delete(`/api/leads/${LEAD_ID}`).set('X-CSRF-Token', csrf).expect(200);
    await agent.get(`/api/leads/${LEAD_ID}`).expect(404);
    const leads = await agent.get('/api/leads').expect(200);
    expect(leads.body.data.map((row) => row.id)).toEqual([LEAD_TWO_ID]);

    await agent.delete(`/api/customers/${CUSTOMER_ID}`).set('X-CSRF-Token', csrf).expect(200);
    await agent.get(`/api/customers/${CUSTOMER_ID}`).expect(404);
    const customers = await agent.get('/api/customers').expect(200);
    expect(customers.body.data.map((row) => row.id)).toEqual([CUSTOMER_TWO_ID]);
  });

  it('lists visits by when, status, project and salesperson', async () => {
    const { agent } = await loginAdmin(app);

    const all = await agent.get('/api/visits').expect(200);
    expect(all.body.meta.total).toBe(2);

    const upcoming = await agent.get('/api/visits?when=upcoming').expect(200);
    expect(upcoming.body.data.map((row) => row.id)).toEqual([VISIT_ID]);

    const past = await agent.get('/api/visits?when=past').expect(200);
    expect(past.body.data.map((row) => row.id)).toEqual([VISIT_PAST_ID]);

    const completed = await agent.get('/api/visits?status=completed').expect(200);
    expect(completed.body.data.map((row) => row.id)).toEqual([VISIT_PAST_ID]);

    const byProject = await agent.get(`/api/visits?project_id=${PROJECT_ID}`).expect(200);
    expect(byProject.body.meta.total).toBe(2);

    const bySalesperson = await agent.get(`/api/visits?salesperson_id=${MANAGER_ID}`).expect(200);
    expect(bySalesperson.body.data.map((row) => row.id)).toEqual([VISIT_ID]);
  });

  it('schedules a visit and enforces the status lifecycle', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const invalid = await agent
      .post('/api/visits')
      .set('X-CSRF-Token', csrf)
      .send({ project_id: PROJECT_ID, scheduled_at: '' })
      .expect(422);
    expect(invalid.body.fields.scheduled_at).toBe('Choose the visit date and time.');
    expect(invalid.body.fields.lead_id).toBe('Choose a lead or a customer.');

    const created = await agent
      .post('/api/visits')
      .set('X-CSRF-Token', csrf)
      .send({
        lead_id: LEAD_TWO_ID,
        project_id: PROJECT_ID,
        salesperson_id: MANAGER_ID,
        scheduled_at: '2030-02-05T15:30:00.000Z',
        notes: 'Meet at the sales office',
      })
      .expect(201);
    expect(created.body.data).toMatchObject({
      status: 'scheduled',
      lead: { id: LEAD_TWO_ID },
      project: { id: PROJECT_ID },
      salesperson: { id: MANAGER_ID },
    });

    const completed = await agent
      .patch(`/api/visits/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'completed' })
      .expect(200);
    expect(completed.body.data.status).toBe('completed');

    const invalidTransition = await agent
      .patch(`/api/visits/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'cancelled' })
      .expect(422);
    expect(invalidTransition.body.fields.status).toBe('Reopen the visit before cancelling it.');

    const reopened = await agent
      .patch(`/api/visits/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'scheduled' })
      .expect(200);
    expect(reopened.body.data.status).toBe('scheduled');
  });

  it('validates linked records belong to the company', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const badLead = await agent
      .post('/api/visits')
      .set('X-CSRF-Token', csrf)
      .send({ lead_id: LEAD_OTHER_ID, project_id: PROJECT_ID, scheduled_at: '2030-02-05T15:30:00.000Z' })
      .expect(404);
    expect(badLead.body.error).toBe('Lead not found.');

    const badProject = await agent
      .post('/api/leads')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Cross Link', phone: '555-0155', project_id: OTHER_PROJECT_ID })
      .expect(422);
    expect(badProject.body.fields.project_id).toBe('Choose a project from this company.');
  });

  it('enforces lead delete permissions and CSRF', async () => {
    const { agent, csrf } = await loginManager(app);

    await agent.delete(`/api/leads/${LEAD_ID}`).set('X-CSRF-Token', csrf).expect(403);

    const admin = await loginAdmin(app);
    await admin.agent.delete(`/api/leads/${LEAD_ID}`).expect(403);
  });

  it('exposes lead sources through the shared lookups endpoint', async () => {
    const { agent } = await loginAdmin(app);

    const response = await agent.get('/api/lookups').expect(200);
    expect(response.body.data.sources).toEqual([
      expect.objectContaining({ id: SOURCE_WEBSITE_ID, name: 'Website' }),
      expect.objectContaining({ id: SOURCE_REFERRAL_ID, name: 'Referral' }),
    ]);
  });
});
