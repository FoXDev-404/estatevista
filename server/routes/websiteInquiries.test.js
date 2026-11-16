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
const AGENT_ID = '44444444-4444-4444-8444-444444444444';
const ADMIN_ROLE_ID = '99999999-9999-4999-8999-999999999999';
const MANAGER_ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AGENT_ROLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const PROJECT_ID = 'a1111111-1111-4111-8111-111111111111';
const OTHER_PROJECT_ID = 'a3333333-3333-4333-8333-333333333333';
const UNIT_ID = 'e1111111-1111-4111-8111-111111111111';
const SOURCE_WEBSITE_ID = 'f1111111-1111-4111-8111-111111111111';
const PROPERTY_ID = 'PROP-001';
const INQUIRY_ID = 'c1111111-1111-4111-8111-111111111111';
const INQUIRY_CLOSED_ID = 'c2222222-2222-4222-8222-222222222222';
const INQUIRY_OTHER_ID = 'c3333333-3333-4333-8333-333333333333';
const LEAD_ID = 'd1111111-1111-4111-8111-111111111111';
const LEAD_OTHER_ID = 'd3333333-3333-4333-8333-333333333333';
const PARTIAL_INQUIRY_ID = 'c4444444-4444-4444-8444-444444444444';

const MANAGER_PERMISSIONS = ['inquiries.view', 'leads.view', 'projects.view', 'units.view'];
const AGENT_PERMISSIONS = ['dashboard.view'];

const PERMISSION_ROWS = [...new Set([...MANAGER_PERMISSIONS, ...AGENT_PERMISSIONS])].map(
  (key, index) => ({
    id: index + 1,
    key,
    module: key.split('.')[0],
    action: key.split('.')[1],
    label: key,
    sort_order: index,
  }),
);

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

function projectRow(overrides) {
  return {
    id: PROJECT_ID,
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
    launch_date: null,
    completion_date: null,
    total_units: 2,
    sold_units: 0,
    rented_units: 0,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function unitRow(overrides) {
  return {
    id: UNIT_ID,
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

function leadRow(overrides) {
  return {
    id: LEAD_ID,
    company_id: COMPANY_ID,
    branch_id: null,
    source_id: SOURCE_WEBSITE_ID,
    assigned_to: null,
    project_id: null,
    unit_id: null,
    name: 'Priya Nair',
    phone: '555-0100',
    email: 'priya@example.test',
    status: 'new',
    lost_reason: null,
    budget_min: null,
    budget_max: null,
    notes: null,
    created_by: null,
    updated_by: null,
    deleted_at: null,
    created_at: '2026-11-10T09:00:00.000Z',
    updated_at: '2026-11-10T09:00:00.000Z',
    ...overrides,
  };
}

function inquiryRow(overrides) {
  return {
    id: INQUIRY_ID,
    company_id: COMPANY_ID,
    type: 'property',
    name: 'Priya Nair',
    phone: '555-0100',
    email: 'priya@example.test',
    project_id: PROJECT_ID,
    unit_id: UNIT_ID,
    property_id: PROPERTY_ID,
    message: 'I would like to arrange a viewing.',
    source_page: '/properties/marina-loft',
    locale: 'en',
    status: 'new',
    lead_id: LEAD_ID,
    visit_id: null,
    submission_key: 'seed-submission-0001',
    created_at: '2026-11-10T09:00:00.000Z',
    updated_at: '2026-11-10T09:00:00.000Z',
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
  'createLead',
  'createWebsiteInquiry',
  'findSourceByName',
  'findWebsiteInquiryBySubmissionKey',
  'getCompanyBySlug',
  'getProject',
  'getPublicProperty',
  'getUnit',
  'listWebsiteInquiries',
  'updateWebsiteInquiry',
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

function validInquiry(overrides) {
  return {
    type: 'property',
    name: 'Priya Nair',
    phone: '+1 555 0142',
    email: 'Priya@Example.test',
    message: 'I would like to arrange a viewing this weekend.',
    property_id: PROPERTY_ID,
    source_page: '/properties/marina-loft',
    submission_key: 'public-submission-0001',
    ...overrides,
  };
}

async function makeApp({ publicCompanySlug = 'meridian-estates' } = {}) {
  const adminHash = await hashPassword('AdminPass123');
  const managerHash = await hashPassword('ManagerPass123');
  const agentHash = await hashPassword('AgentPass123');

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
      {
        id: AGENT_ID,
        company_id: COMPANY_ID,
        name: 'Casey Reed',
        email: 'casey@meridian-estates.test',
        password_hash: agentHash,
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
      {
        id: AGENT_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Sales Agent',
        description: '',
        is_default: true,
      },
    ],
    userRoles: [
      { user_id: ADMIN_ID, role_id: ADMIN_ROLE_ID },
      { user_id: MANAGER_ID, role_id: MANAGER_ROLE_ID },
      { user_id: AGENT_ID, role_id: AGENT_ROLE_ID },
    ],
    rolePermissions: MANAGER_PERMISSIONS.map((key) => ({
      role_id: MANAGER_ROLE_ID,
      permission_key: key,
    })).concat(
      AGENT_PERMISSIONS.map((key) => ({ role_id: AGENT_ROLE_ID, permission_key: key })),
    ),
    permissions: PERMISSION_ROWS,
  });

  const otherLead = leadRow({
    id: LEAD_OTHER_ID,
    company_id: OTHER_COMPANY_ID,
    name: 'Other Lead',
    source_id: null,
  });

  const adminRepository = new MemoryAdminRepository({
    companies: [company, otherCompany],
    settings: [{ company_id: COMPANY_ID }, { company_id: OTHER_COMPANY_ID }],
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
    properties: [
      {
        id: PROPERTY_ID,
        title: 'Marina Loft',
        slug: 'marina-loft',
        type: 'apartment',
        purpose: 'sale',
      },
    ],
    lookups: [
      {
        id: SOURCE_WEBSITE_ID,
        company_id: COMPANY_ID,
        list_key: 'source',
        name: 'Website',
        sort_order: 1,
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
      {
        id: AGENT_ID,
        company_id: COMPANY_ID,
        name: 'Casey Reed',
        email: 'casey@meridian-estates.test',
        branch_id: null,
        full_access: false,
        is_active: true,
        roles: [{ id: AGENT_ROLE_ID, name: 'Sales Agent' }],
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
      {
        id: AGENT_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Sales Agent',
        description: '',
        is_default: true,
      },
    ],
    rolePermissions: {
      [ADMIN_ROLE_ID]: [...MANAGER_PERMISSIONS],
      [MANAGER_ROLE_ID]: [...MANAGER_PERMISSIONS],
      [AGENT_ROLE_ID]: [...AGENT_PERMISSIONS],
    },
    leads: [leadRow({ id: LEAD_ID }), otherLead],
    customers: [],
    leadFollowups: [],
    visits: [],
    websiteInquiries: [
      inquiryRow({ id: INQUIRY_ID }),
      inquiryRow({
        id: INQUIRY_CLOSED_ID,
        type: 'general',
        name: 'Blake Moore',
        phone: null,
        email: 'blake@example.test',
        project_id: null,
        unit_id: null,
        property_id: null,
        message: 'Please tell me about your services.',
        status: 'closed',
        lead_id: null,
        submission_key: 'seed-submission-0002',
        created_at: '2026-11-09T09:00:00.000Z',
      }),
      inquiryRow({
        id: INQUIRY_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Inquiry',
        email: 'other@example.test',
        project_id: null,
        unit_id: null,
        property_id: null,
        lead_id: LEAD_OTHER_ID,
        submission_key: 'seed-submission-0003',
      }),
    ],
  });

  const app = createApp({
    authRepository,
    adminRepository: guardAgainstSupabaseGaps(adminRepository),
    publicCompanySlug,
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

const loginManager = (app) => login(app, 'sam@meridian-estates.test', 'ManagerPass123');
const loginAgent = (app) => login(app, 'casey@meridian-estates.test', 'AgentPass123');

describe('WP8 public inquiry bridge', () => {
  let app;
  let adminRepository;

  beforeEach(async () => {
    ({ app, adminRepository } = await makeApp());
  });

  it('captures a public property inquiry and creates one Website lead without authentication', async () => {
    const beforeLeads = adminRepository.leads.length;

    const response = await request(app)
      .post('/api/public/inquiries')
      .send(validInquiry())
      .expect(201);

    expect(response.body).toMatchObject({ success: true, duplicate: false });
    expect(response.body).not.toHaveProperty('company_id');
    expect(response.body).not.toHaveProperty('submission_key');

    expect(adminRepository.websiteInquiries).toHaveLength(4);
    const inquiry = adminRepository.websiteInquiries.find(
      (row) => row.submission_key === 'public-submission-0001',
    );
    expect(inquiry).toMatchObject({
      company_id: COMPANY_ID,
      type: 'property',
      name: 'Priya Nair',
      phone: '+1 555 0142',
      email: 'priya@example.test',
      project_id: null,
      unit_id: null,
      property_id: PROPERTY_ID,
      source_page: '/properties/marina-loft',
      locale: 'en',
      status: 'new',
      visit_id: null,
    });
    expect(inquiry.lead_id).toBeTruthy();

    expect(adminRepository.leads).toHaveLength(beforeLeads + 1);
    const lead = adminRepository.leads.find((row) => row.id === inquiry.lead_id);
    expect(lead).toMatchObject({
      company_id: COMPANY_ID,
      source_id: SOURCE_WEBSITE_ID,
      name: 'Priya Nair',
      phone: '+1 555 0142',
      email: 'priya@example.test',
      status: 'new',
      assigned_to: null,
    });
    expect(lead.notes).toContain('I would like to arrange a viewing this weekend.');
    expect(lead.notes).toContain('Marina Loft (PROP-001)');
  });

  it('is idempotent for a repeated submission key', async () => {
    const payload = validInquiry({ submission_key: 'public-submission-0002' });
    const beforeLeads = adminRepository.leads.length;

    await request(app).post('/api/public/inquiries').send(payload).expect(201);
    const second = await request(app).post('/api/public/inquiries').send(payload).expect(200);

    expect(second.body).toMatchObject({ success: true, duplicate: true });
    expect(
      adminRepository.websiteInquiries.filter(
        (row) => row.submission_key === 'public-submission-0002',
      ),
    ).toHaveLength(1);
    expect(adminRepository.leads).toHaveLength(beforeLeads + 1);
  });

  it('validates the public payload and company links', async () => {
    const missing = await request(app)
      .post('/api/public/inquiries')
      .send({ name: '', phone: '', email: '', message: '', submission_key: 'short' })
      .expect(422);
    expect(missing.body.fields.name).toBe('Enter your name.');
    expect(missing.body.fields.phone).toBe('Enter a phone number or an email address.');
    expect(missing.body.fields.submission_key).toBeTruthy();

    const invalidEmail = await request(app)
      .post('/api/public/inquiries')
      .send(validInquiry({ email: 'not-an-email' }))
      .expect(422);
    expect(invalidEmail.body.fields.email).toBe('Enter a valid email address.');

    const invalidType = await request(app)
      .post('/api/public/inquiries')
      .send(validInquiry({ type: 'showing', submission_key: 'public-submission-0003' }))
      .expect(422);
    expect(invalidType.body.fields.type).toBeTruthy();

    const otherProject = await request(app)
      .post('/api/public/inquiries')
      .send(
        validInquiry({
          project_id: OTHER_PROJECT_ID,
          property_id: null,
          submission_key: 'public-submission-0004',
        }),
      )
      .expect(422);
    expect(otherProject.body.fields.project_id).toBe('Choose a project from this company.');

    expect(adminRepository.websiteInquiries).toHaveLength(3);
    expect(adminRepository.leads).toHaveLength(2);
  });

  it('folds a general contact subject into the stored message', async () => {
    await request(app)
      .post('/api/public/inquiries')
      .send(
        validInquiry({
          type: 'general',
          project_id: null,
          property_id: null,
          subject: 'Viewing a villa',
          message: 'Please share your availability for a call.',
          submission_key: 'public-submission-0005',
        }),
      )
      .expect(201);

    const inquiry = adminRepository.websiteInquiries.find(
      (row) => row.submission_key === 'public-submission-0005',
    );
    expect(inquiry.message).toContain('Subject: Viewing a villa');
    expect(inquiry.message).toContain('Please share your availability for a call.');
  });

  it('captures visit requests without scheduling a visit', async () => {
    await request(app)
      .post('/api/public/inquiries')
      .send(
        validInquiry({
          type: 'visit',
          subject: null,
          message: 'I would like to visit the show unit.',
          submission_key: 'public-submission-0006',
        }),
      )
      .expect(201);

    const inquiry = adminRepository.websiteInquiries.find(
      (row) => row.submission_key === 'public-submission-0006',
    );
    expect(inquiry.type).toBe('visit');
    expect(inquiry.visit_id).toBeNull();
    expect(adminRepository.visits).toHaveLength(0);
  });

  it('heals a partial capture when the same key is retried', async () => {
    adminRepository.websiteInquiries.push(
      inquiryRow({
        id: PARTIAL_INQUIRY_ID,
        lead_id: null,
        submission_key: 'public-submission-0007',
        name: 'Partial Capture',
      }),
    );

    const response = await request(app)
      .post('/api/public/inquiries')
      .send(
        validInquiry({
          name: 'Partial Capture',
          submission_key: 'public-submission-0007',
        }),
      )
      .expect(200);

    expect(response.body).toMatchObject({ success: true, duplicate: true });
    const inquiry = adminRepository.websiteInquiries.find(
      (row) => row.id === PARTIAL_INQUIRY_ID,
    );
    expect(inquiry.lead_id).toBeTruthy();
    expect(adminRepository.leads.find((row) => row.id === inquiry.lead_id)).toBeTruthy();
  });

  it('returns 503 when the configured public company does not resolve', async () => {
    const { app: unconfiguredApp, adminRepository: repository } = await makeApp({
      publicCompanySlug: 'missing-company',
    });

    await request(unconfiguredApp)
      .post('/api/public/inquiries')
      .send(validInquiry({ submission_key: 'public-submission-0008' }))
      .expect(503);

    expect(repository.websiteInquiries).toHaveLength(3);
    expect(repository.leads).toHaveLength(2);
  });

  it('creates only one lead for concurrent submits with the same key', async () => {
    const beforeLeads = adminRepository.leads.length;
    const payload = validInquiry({ submission_key: 'public-concurrent-0001' });

    const responses = await Promise.all([
      request(app).post('/api/public/inquiries').send(payload),
      request(app).post('/api/public/inquiries').send(payload),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(adminRepository.leads.length - beforeLeads).toBe(1);
    const inquiry = adminRepository.websiteInquiries.find(
      (row) => row.submission_key === 'public-concurrent-0001',
    );
    expect(inquiry.lead_id).toBeTruthy();
  });

  it('throttles new submissions from the same connection', async () => {
    for (let index = 1; index <= 10; index += 1) {
      await request(app)
        .post('/api/public/inquiries')
        .send(
          validInquiry({
            submission_key: `public-throttle-${String(index).padStart(4, '0')}`,
          }),
        )
        .expect(201);
    }

    const blocked = await request(app)
      .post('/api/public/inquiries')
      .send(
        validInquiry({
          submission_key: 'public-throttle-0011',
        }),
      )
      .expect(429);
    expect(blocked.body.error).toMatch(/too many/i);

    await request(app)
      .post('/api/public/inquiries')
      .send(validInquiry({ submission_key: 'public-throttle-0001' }))
      .expect(200);
  });

  it('requires inquiries.view and keeps the inbox company-scoped', async () => {
    await request(app).get('/api/website-inquiries').expect(401);

    const { agent: agentSession } = await loginAgent(app);
    await agentSession.get('/api/website-inquiries').expect(403);

    const { agent } = await loginManager(app);
    const response = await agent.get('/api/website-inquiries').expect(200);

    expect(response.body.meta.total).toBe(2);
    expect(response.body.data.map((row) => row.id).sort()).toEqual(
      [INQUIRY_ID, INQUIRY_CLOSED_ID].sort(),
    );
    const row = response.body.data.find((item) => item.id === INQUIRY_ID);
    expect(row).toMatchObject({
      type: 'property',
      name: 'Priya Nair',
      project: { id: PROJECT_ID, name: 'Lakeview Heights' },
      unit: { id: UNIT_ID, unit_number: 'A-101' },
      property: { id: PROPERTY_ID, title: 'Marina Loft' },
      lead: { id: LEAD_ID, name: 'Priya Nair', status: 'new' },
    });
    expect(row).not.toHaveProperty('company_id');
    expect(row).not.toHaveProperty('submission_key');
    expect(row).not.toHaveProperty('visit_id');
    expect(response.body.data.some((item) => item.id === INQUIRY_OTHER_ID)).toBe(false);
  });

  it('filters and paginates the inbox', async () => {
    const { agent } = await loginManager(app);

    const general = await agent.get('/api/website-inquiries?type=general').expect(200);
    expect(general.body.data.map((row) => row.id)).toEqual([INQUIRY_CLOSED_ID]);

    const closed = await agent.get('/api/website-inquiries?status=closed').expect(200);
    expect(closed.body.data.map((row) => row.id)).toEqual([INQUIRY_CLOSED_ID]);

    const search = await agent.get('/api/website-inquiries?search=blake').expect(200);
    expect(search.body.data.map((row) => row.id)).toEqual([INQUIRY_CLOSED_ID]);

    const paged = await agent.get('/api/website-inquiries?page=2&limit=1').expect(200);
    expect(paged.body.meta).toMatchObject({ page: 2, limit: 1, total: 2, pages: 2 });
    expect(paged.body.data.map((row) => row.id)).toEqual([INQUIRY_CLOSED_ID]);
  });
});
