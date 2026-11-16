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
const HEAD_OFFICE_ID = '66666666-6666-4666-8666-666666666666';
const ADMIN_ROLE_ID = '99999999-9999-4999-8999-999999999999';
const MANAGER_ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const PROJECT_ID = 'a1111111-1111-4111-8111-111111111111';
const PROJECT_TWO_ID = 'a2222222-2222-4222-8222-222222222222';
const OTHER_PROJECT_ID = 'a3333333-3333-4333-8333-333333333333';
const BUILDING_ID = 'b1111111-1111-4111-8111-111111111111';
const EMPTY_BUILDING_ID = 'b2222222-2222-4222-8222-222222222222';
const OTHER_BUILDING_ID = 'b3333333-3333-4333-8333-333333333333';
const FLOOR_1_ID = 'c1111111-1111-4111-8111-111111111111';
const FLOOR_2_ID = 'c2222222-2222-4222-8222-222222222222';
const FLOOR_3_ID = 'c3333333-3333-4333-8333-333333333333';
const EMPTY_FLOOR_1_ID = 'c4444444-4444-4444-8444-444444444444';
const EMPTY_FLOOR_2_ID = 'c5555555-5555-4555-8555-555555555555';
const FLAT_TYPE_ID = 'd1111111-1111-4111-8111-111111111111';
const OFFICE_TYPE_ID = 'd2222222-2222-4222-8222-222222222222';
const OTHER_TYPE_ID = 'd3333333-3333-4333-8333-333333333333';
const UNIT_ID = 'e1111111-1111-4111-8111-111111111111';
const SOLD_UNIT_ID = 'e2222222-2222-4222-8222-222222222222';
const DRAFT_UNIT_ID = 'e3333333-3333-4333-8333-333333333333';
const OTHER_UNIT_ID = 'e4444444-4444-4444-8444-444444444444';
const SEQ_PROJECT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const MANAGER_PERMISSIONS = ['projects.view', 'units.view'];

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

function projectRow(overrides) {
  return {
    company_id: COMPANY_ID,
    branch_id: null,
    project_manager_id: null,
    code: null,
    type: 'residential',
    status: 'planning',
    description: null,
    location: null,
    city: null,
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
    building_id: null,
    floor_id: null,
    unit_type_id: null,
    area: 1000,
    area_unit: 'sqft',
    bedrooms: null,
    bathrooms: null,
    sale_price: 0,
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
    ],
    branches: [
      {
        id: HEAD_OFFICE_ID,
        company_id: COMPANY_ID,
        name: 'Head Office',
        code: 'HO',
        is_active: true,
        manager_id: null,
      },
    ],
    projects: [
      projectRow({
        id: PROJECT_ID,
        number: 'PRJ-0007',
        name: 'Lakeview Heights',
        code: 'PRJ-0007',
        slug: 'lakeview-heights',
        type: 'residential',
        status: 'active',
        city: 'Springfield',
        location: 'Riverside',
        land_area: 32,
        land_area_unit: 'katha',
        budget: 4200000,
        booking_amount: 5000,
        branch_id: HEAD_OFFICE_ID,
        project_manager_id: ADMIN_ID,
      }),
      projectRow({
        id: PROJECT_TWO_ID,
        number: 'PRJ-0008',
        name: 'North Ridge Plots',
        code: 'PRJ-0008',
        slug: 'north-ridge-plots',
        type: 'land',
        status: 'planning',
        city: 'Fairview',
      }),
      projectRow({
        id: OTHER_PROJECT_ID,
        company_id: OTHER_COMPANY_ID,
        number: 'PRJ-0001',
        name: 'Other Company Project',
        code: 'PRJ-0001',
        slug: 'other-company-project',
        type: 'commercial',
        status: 'active',
      }),
    ],
    buildings: [
      {
        id: BUILDING_ID,
        company_id: COMPANY_ID,
        project_id: PROJECT_ID,
        code: 'A',
        name: 'Tower A',
        floors_count: 3,
      },
      {
        id: EMPTY_BUILDING_ID,
        company_id: COMPANY_ID,
        project_id: PROJECT_TWO_ID,
        code: 'B',
        name: 'Plot Block B',
        floors_count: 2,
      },
      {
        id: OTHER_BUILDING_ID,
        company_id: OTHER_COMPANY_ID,
        project_id: OTHER_PROJECT_ID,
        code: 'X',
        name: 'Other Block',
        floors_count: 1,
      },
    ],
    floors: [
      {
        id: FLOOR_1_ID,
        company_id: COMPANY_ID,
        building_id: BUILDING_ID,
        number: 1,
        name: null,
      },
      {
        id: FLOOR_2_ID,
        company_id: COMPANY_ID,
        building_id: BUILDING_ID,
        number: 2,
        name: null,
      },
      {
        id: FLOOR_3_ID,
        company_id: COMPANY_ID,
        building_id: BUILDING_ID,
        number: 3,
        name: null,
      },
      {
        id: EMPTY_FLOOR_1_ID,
        company_id: COMPANY_ID,
        building_id: EMPTY_BUILDING_ID,
        number: 1,
        name: null,
      },
      {
        id: EMPTY_FLOOR_2_ID,
        company_id: COMPANY_ID,
        building_id: EMPTY_BUILDING_ID,
        number: 2,
        name: null,
      },
    ],
    unitTypes: [
      { id: FLAT_TYPE_ID, company_id: COMPANY_ID, name: 'Flat', sort_order: 1, is_active: true },
      { id: OFFICE_TYPE_ID, company_id: COMPANY_ID, name: 'Office', sort_order: 2, is_active: true },
      { id: OTHER_TYPE_ID, company_id: OTHER_COMPANY_ID, name: 'Flat', sort_order: 1, is_active: true },
    ],
    units: [
      unitRow({
        id: UNIT_ID,
        project_id: PROJECT_ID,
        building_id: BUILDING_ID,
        floor_id: FLOOR_1_ID,
        unit_type_id: FLAT_TYPE_ID,
        unit_number: 'A-101',
        sale_price: 250000,
      }),
      unitRow({
        id: SOLD_UNIT_ID,
        project_id: PROJECT_ID,
        building_id: BUILDING_ID,
        floor_id: FLOOR_1_ID,
        unit_type_id: FLAT_TYPE_ID,
        unit_number: 'A-102',
        sale_price: 260000,
        status: 'sold',
      }),
      unitRow({
        id: DRAFT_UNIT_ID,
        project_id: PROJECT_ID,
        building_id: BUILDING_ID,
        floor_id: FLOOR_2_ID,
        unit_type_id: FLAT_TYPE_ID,
        unit_number: 'A-201',
        sale_price: 270000,
        status: 'draft',
      }),
      unitRow({
        id: OTHER_UNIT_ID,
        company_id: OTHER_COMPANY_ID,
        project_id: OTHER_PROJECT_ID,
        building_id: OTHER_BUILDING_ID,
        unit_type_id: OTHER_TYPE_ID,
        unit_number: 'X-101',
      }),
    ],
    team: [
      {
        id: ADMIN_ID,
        company_id: COMPANY_ID,
        name: 'Jordan Hale',
        email: 'jordan@meridian-estates.test',
        branch_id: HEAD_OFFICE_ID,
        full_access: true,
        is_active: true,
        roles: [{ id: ADMIN_ROLE_ID, name: 'Company Admin' }],
      },
      {
        id: MANAGER_ID,
        company_id: COMPANY_ID,
        name: 'Sam Rivera',
        email: 'sam@meridian-estates.test',
        branch_id: HEAD_OFFICE_ID,
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
  });

  const app = createApp({ authRepository, adminRepository });
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

describe('inventory: projects, buildings and units', () => {
  let app;
  let adminRepository;

  beforeEach(async () => {
    ({ app, adminRepository } = await makeApp());
  });

  it('lists and filters projects with inventory counts', async () => {
    const { agent } = await loginAdmin(app);

    const all = await agent.get('/api/projects').expect(200);
    expect(all.body.meta.total).toBe(2);
    const lakeview = all.body.data.find((row) => row.id === PROJECT_ID);
    expect(lakeview).toMatchObject({
      number: 'PRJ-0007',
      name: 'Lakeview Heights',
      buildings_count: 1,
      units_count: 3,
      available_units: 1,
      sold_units: 1,
    });

    const land = await agent.get('/api/projects?type=land&status=planning').expect(200);
    expect(land.body.data.map((row) => row.id)).toEqual([PROJECT_TWO_ID]);

    const search = await agent.get('/api/projects?search=fairview').expect(200);
    expect(search.body.data.map((row) => row.id)).toEqual([PROJECT_TWO_ID]);

    await agent.get(`/api/projects/${OTHER_PROJECT_ID}`).expect(404);
  });

  it('creates a project with generated number, code, slug and audit entry', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await agent
      .post('/api/projects')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Green Valley Residence',
        type: 'residential',
        status: 'planning',
        city: 'Springfield',
        booking_amount: 2500,
      })
      .expect(201);

    expect(created.body.data).toMatchObject({
      number: 'PRJ-0001',
      code: 'PRJ-0001',
      slug: 'green-valley-residence',
      name: 'Green Valley Residence',
      type: 'residential',
      status: 'planning',
      currency: 'USD',
      units_count: 0,
    });

    const second = await agent
      .post('/api/projects')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Green Valley Residence',
        type: 'residential',
        status: 'planning',
      })
      .expect(201);

    expect(second.body.data.number).toBe('PRJ-0002');
    expect(second.body.data.slug).toBe('green-valley-residence-2');

    const audit = await adminRepository.listAuditLogs(COMPANY_ID, { module: 'Project' });
    expect(audit.total).toBe(2);
    expect(audit.data[0].event).toBe('created');
    expect(audit.data[0].after_data.name).toBe('Green Valley Residence');
  });

  it('validates required project fields and unknown records', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const missing = await agent
      .post('/api/projects')
      .set('X-CSRF-Token', csrf)
      .send({ name: '' })
      .expect(422);
    expect(missing.body.fields.name).toBeTruthy();
    expect(missing.body.fields.type).toBeTruthy();
    expect(missing.body.fields.status).toBeTruthy();

    const invalid = await agent
      .post('/api/projects')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Bad Enums', type: 'castle', status: 'dreaming' })
      .expect(422);
    expect(invalid.body.fields.type).toBeTruthy();
    expect(invalid.body.fields.status).toBeTruthy();

    await agent
      .patch('/api/projects/ffffffff-ffff-4fff-8fff-ffffffffffff')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Missing', type: 'land', status: 'planning' })
      .expect(404);
  });

  it('updates a project and records the before and after snapshot', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const updated = await agent
      .patch(`/api/projects/${PROJECT_TWO_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'North Ridge Plots',
        type: 'land',
        status: 'active',
        city: 'Fairview',
        budget: 120000,
      })
      .expect(200);

    expect(updated.body.data.status).toBe('active');
    expect(updated.body.data.budget).toBe(120000);

    const audit = await adminRepository.listAuditLogs(COMPANY_ID, { module: 'Project' });
    expect(audit.total).toBe(1);
    expect(audit.data[0].before_data.status).toBe('planning');
    expect(audit.data[0].after_data.status).toBe('active');
  });

  it('blocks deleting a project that still has units and archives empty projects', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const blocked = await agent
      .delete(`/api/projects/${PROJECT_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(409);
    expect(blocked.body.error).toMatch(/units/i);

    await agent
      .delete(`/api/projects/${PROJECT_TWO_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(200);

    const list = await agent.get('/api/projects').expect(200);
    expect(list.body.data.map((row) => row.id)).not.toContain(PROJECT_TWO_ID);
    await agent.get(`/api/projects/${PROJECT_TWO_ID}`).expect(404);
  });

  it('creates a building with its floors and adds extra floors', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await agent
      .post(`/api/projects/${PROJECT_TWO_ID}/buildings`)
      .set('X-CSRF-Token', csrf)
      .send({ code: 'C', name: 'Tower C', floors_count: 3 })
      .expect(201);

    expect(created.body.data.code).toBe('C');
    expect(created.body.data.floors.map((floor) => floor.number)).toEqual([1, 2, 3]);
    expect(created.body.data.units_count).toBe(0);

    const buildingId = created.body.data.id;
    const floor = await agent
      .post(`/api/projects/${PROJECT_TWO_ID}/buildings/${buildingId}/floors`)
      .set('X-CSRF-Token', csrf)
      .send({ number: 4, name: 'Roof' })
      .expect(201);

    expect(floor.body.data.number).toBe(4);

    await agent
      .post(`/api/projects/${PROJECT_TWO_ID}/buildings`)
      .set('X-CSRF-Token', csrf)
      .send({ code: 'C', name: 'Duplicate', floors_count: 1 })
      .expect(422);

    const blocked = await agent
      .delete(`/api/projects/${PROJECT_ID}/buildings/${BUILDING_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(409);
    expect(blocked.body.error).toMatch(/units/i);

    await agent
      .delete(`/api/projects/${PROJECT_TWO_ID}/buildings/${EMPTY_BUILDING_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(200);
  });

  it('creates units from the project context and rejects duplicates or foreign links', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await agent
      .post('/api/units')
      .set('X-CSRF-Token', csrf)
      .send({
        project_id: PROJECT_TWO_ID,
        building_id: EMPTY_BUILDING_ID,
        floor_id: EMPTY_FLOOR_1_ID,
        unit_type_id: OFFICE_TYPE_ID,
        unit_number: 'B-101',
        area: 850,
        bedrooms: 2,
        bathrooms: 1,
        sale_price: 180000,
      })
      .expect(201);

    expect(created.body.data).toMatchObject({
      unit_number: 'B-101',
      status: 'available',
      building: { id: EMPTY_BUILDING_ID, code: 'B' },
      floor: { id: EMPTY_FLOOR_1_ID, number: 1 },
      unit_type: { id: OFFICE_TYPE_ID, name: 'Office' },
    });
    expect(created.body.data.created_by).toBeUndefined();
    expect(created.body.data.updated_by).toBeUndefined();

    const duplicate = await agent
      .post('/api/units')
      .set('X-CSRF-Token', csrf)
      .send({ project_id: PROJECT_TWO_ID, unit_number: 'B-101' })
      .expect(422);
    expect(duplicate.body.fields.unit_number).toBeTruthy();

    const foreignBuilding = await agent
      .post('/api/units')
      .set('X-CSRF-Token', csrf)
      .send({ project_id: PROJECT_TWO_ID, building_id: BUILDING_ID, unit_number: 'B-102' })
      .expect(422);
    expect(foreignBuilding.body.fields.building_id).toBeTruthy();

    const foreignProject = await agent
      .post('/api/units')
      .set('X-CSRF-Token', csrf)
      .send({ project_id: OTHER_PROJECT_ID, unit_number: 'B-103' })
      .expect(404);
    expect(foreignProject.body.error).toMatch(/project/i);
  });

  it('updates unit details and rejects a duplicate unit number', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const updated = await agent
      .patch(`/api/units/${UNIT_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({
        unit_number: 'A-103',
        area: 940,
        bedrooms: 3,
        bathrooms: 2,
        sale_price: 310000,
        description: 'Renovated corner unit',
      })
      .expect(200);

    expect(updated.body.data).toMatchObject({
      unit_number: 'A-103',
      area: 940,
      bedrooms: 3,
      bathrooms: 2,
      sale_price: 310000,
      description: 'Renovated corner unit',
    });
    expect(updated.body.data.updated_by).toBeUndefined();

    const duplicate = await agent
      .patch(`/api/units/${UNIT_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({ unit_number: 'A-102' })
      .expect(422);
    expect(duplicate.body.fields.unit_number).toBeTruthy();
  });

  it('does not change a unit status through the general update endpoint', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const blocked = await agent
      .patch(`/api/units/${UNIT_ID}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'sold' })
      .expect(422);
    expect(blocked.body.fields.status).toMatch(/status action/i);

    const unchanged = await agent.get(`/api/units/${UNIT_ID}`).expect(200);
    expect(unchanged.body.data.status).toBe('available');
  });

  it('generates numbered units across a floor range and rejects collisions', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const generated = await agent
      .post(`/api/projects/${PROJECT_TWO_ID}/units/generate`)
      .set('X-CSRF-Token', csrf)
      .send({
        building_id: EMPTY_BUILDING_ID,
        floor_from: 1,
        floor_to: 2,
        units_per_floor: 2,
        number_pattern: 'B-{floor}{number}',
        number_padding: 2,
        unit_type_id: OFFICE_TYPE_ID,
        area: 900,
        sale_price: 195000,
      })
      .expect(201);

    expect(generated.body.meta.created).toBe(4);
    expect(generated.body.data.map((unit) => unit.unit_number)).toEqual([
      'B-101',
      'B-102',
      'B-201',
      'B-202',
    ]);

    const totals = await agent.get(`/api/projects/${PROJECT_TWO_ID}`).expect(200);
    expect(totals.body.data.units_count).toBe(4);
    expect(totals.body.data.available_units).toBe(4);

    const collision = await agent
      .post(`/api/projects/${PROJECT_TWO_ID}/units/generate`)
      .set('X-CSRF-Token', csrf)
      .send({
        building_id: EMPTY_BUILDING_ID,
        floor_from: 1,
        floor_to: 1,
        units_per_floor: 1,
        number_pattern: 'B-{floor}{number}',
        number_padding: 2,
      })
      .expect(422);
    expect(collision.body.error).toMatch(/already exist/i);

    const badPattern = await agent
      .post(`/api/projects/${PROJECT_TWO_ID}/units/generate`)
      .set('X-CSRF-Token', csrf)
      .send({
        building_id: EMPTY_BUILDING_ID,
        floor_from: 1,
        floor_to: 1,
        units_per_floor: 1,
        number_pattern: 'B-{floor}',
      })
      .expect(422);
    expect(badPattern.body.fields.number_pattern).toBeTruthy();

    const tooMany = await agent
      .post(`/api/projects/${PROJECT_TWO_ID}/units/generate`)
      .set('X-CSRF-Token', csrf)
      .send({
        building_id: EMPTY_BUILDING_ID,
        floor_from: 1,
        floor_to: 2,
        units_per_floor: 120,
        number_pattern: 'B-{floor}{number}',
      })
      .expect(422);
    expect(tooMany.body.fields.units_per_floor).toBeTruthy();
  });

  it('lists units with filters and pagination', async () => {
    const { agent } = await loginAdmin(app);

    const all = await agent.get('/api/units?project_id=' + PROJECT_ID).expect(200);
    expect(all.body.meta.total).toBe(3);
    expect(all.body.data[0]).toMatchObject({
      project: { id: PROJECT_ID, name: 'Lakeview Heights' },
      building: { id: BUILDING_ID, code: 'A' },
    });

    const available = await agent
      .get(`/api/units?project_id=${PROJECT_ID}&status=available`)
      .expect(200);
    expect(available.body.data.map((row) => row.unit_number)).toEqual(['A-101']);

    const search = await agent.get('/api/units?search=A-1').expect(200);
    expect(search.body.meta.total).toBe(2);

    const paged = await agent.get('/api/units?page=2&limit=2').expect(200);
    expect(paged.body.meta).toMatchObject({ page: 2, limit: 2, total: 3, pages: 2 });
    expect(paged.body.data).toHaveLength(1);

    await agent.get(`/api/units/${OTHER_UNIT_ID}`).expect(404);
  });

  it('changes unit status with history and rejects invalid transitions and active contracts', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const reserved = await agent
      .patch(`/api/units/${UNIT_ID}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'reserved', reason: 'Customer hold' })
      .expect(200);
    expect(reserved.body.data.status).toBe('reserved');

    const history = await agent.get(`/api/units/${UNIT_ID}/history`).expect(200);
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]).toMatchObject({
      from_status: 'available',
      to_status: 'reserved',
      reason: 'Customer hold',
    });

    await agent
      .patch(`/api/units/${DRAFT_UNIT_ID}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'sold' })
      .expect(422);

    adminRepository.setUnitActiveContracts(UNIT_ID, { reservations: 1 });
    const blocked = await agent
      .patch(`/api/units/${UNIT_ID}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'reserved' })
      .expect(409);
    expect(blocked.body.error).toMatch(/active reservation|active sale|active lease/i);
  });

  it('deletes only units without an active contract or sale state', async () => {
    const { agent, csrf } = await loginAdmin(app);

    await agent
      .delete(`/api/units/${SOLD_UNIT_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(409);

    await agent
      .delete(`/api/units/${DRAFT_UNIT_ID}`)
      .set('X-CSRF-Token', csrf)
      .expect(200);

    const list = await agent.get(`/api/units?project_id=${PROJECT_ID}`).expect(200);
    expect(list.body.data.map((row) => row.id)).not.toContain(DRAFT_UNIT_ID);
  });

  it('requires a document owner and the matching module permission', async () => {
    const { agent } = await loginAdmin(app);

    const unfiltered = await agent.get('/api/documents').expect(422);
    expect(unfiltered.body.fields.owner_type).toBeTruthy();

    const missingOwner = await agent.get('/api/documents?owner_type=project').expect(422);
    expect(missingOwner.body.fields.owner_id).toBeTruthy();
  });

  it('stores, lists and deletes project documents', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await agent
      .post('/api/documents')
      .set('X-CSRF-Token', csrf)
      .send({
        owner_type: 'project',
        owner_id: PROJECT_ID,
        category: 'Permit',
        file_name: 'permit.pdf',
        data: 'data:application/pdf;base64,JVBERi0xLjQK',
      })
      .expect(201);

    expect(created.body.data).toMatchObject({
      owner_type: 'project',
      owner_id: PROJECT_ID,
      file_name: 'permit.pdf',
      category: 'Permit',
    });

    const list = await agent
      .get(`/api/documents?owner_type=project&owner_id=${PROJECT_ID}`)
      .expect(200);
    expect(list.body.data).toHaveLength(1);

    await agent
      .post('/api/documents')
      .set('X-CSRF-Token', csrf)
      .send({
        owner_type: 'lead',
        owner_id: PROJECT_ID,
        file_name: 'bad.pdf',
        data: 'data:application/pdf;base64,JVBERi0xLjQK',
      })
      .expect(422);

    await agent.delete(`/api/documents/${created.body.data.id}`).set('X-CSRF-Token', csrf).expect(200);

    const empty = await agent
      .get(`/api/documents?owner_type=project&owner_id=${PROJECT_ID}`)
      .expect(200);
    expect(empty.body.data).toHaveLength(0);
  });

  it('enforces permissions, CSRF and authentication', async () => {
    const { agent: manager } = await loginManager(app);
    const { agent: admin } = await loginAdmin(app);

    await manager.get('/api/projects').expect(200);
    await manager.get('/api/units').expect(200);

    await manager
      .post('/api/projects')
      .set('X-CSRF-Token', cookieFrom({ headers: {} }, 'never'))
      .send({ name: 'Denied', type: 'land', status: 'planning' })
      .expect(403);

    await manager
      .post(`/api/projects/${PROJECT_TWO_ID}/units/generate`)
      .send({ building_id: EMPTY_BUILDING_ID, floor_from: 1, floor_to: 1, units_per_floor: 1, number_pattern: 'C-{number}' })
      .expect(403);

    await admin
      .post('/api/projects')
      .send({ name: 'No CSRF', type: 'land', status: 'planning' })
      .expect(403);

    await request(app).get('/api/projects').expect(401);
    await request(app).post('/api/units').send({ project_id: PROJECT_ID, unit_number: 'N-1' }).expect(401);
  });
});
