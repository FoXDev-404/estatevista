import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
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
const UNIT_ONE_ID = 'e1111111-1111-4111-8111-111111111111';
const UNIT_TWO_ID = 'e2222222-2222-4222-8222-222222222222';
const UNIT_OTHER_ID = 'e3333333-3333-4333-8333-333333333333';
const TENANT_ONE_ID = '44444444-4444-4444-8444-444444444444';
const TENANT_TWO_ID = '55555555-5555-4555-8555-555555555555';
const TENANT_OTHER_ID = '66666666-6666-4666-8666-666666666666';

const MANAGER_PERMISSIONS = ['tenants.view', 'leases.view', 'rent.view'];

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
    rent_price: 1200,
    status: 'available',
    description: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function tenantRow(overrides) {
  return {
    company_id: COMPANY_ID,
    name: 'Mira Patel',
    type: 'individual',
    phone: '555-0110',
    alternate_phone: null,
    email: 'mira@example.test',
    national_id_type: 'passport',
    national_id_number: 'P-12345',
    date_of_birth: null,
    occupation: 'Architect',
    address: null,
    city: 'Springfield',
    country: 'US',
    notes: null,
    is_active: true,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
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
  'countTenantActiveLeases',
  'createDeposit',
  'createDepositTransaction',
  'createLease',
  'createRentAdjustment',
  'createRentReceipt',
  'createRentSchedules',
  'createTenant',
  'deleteTenant',
  'findActiveLeaseForUnit',
  'getDeposit',
  'getDepositByLease',
  'getLease',
  'getRentReceipt',
  'getRentSchedule',
  'getTenant',
  'listDepositTransactions',
  'listDeposits',
  'listLeases',
  'listRentReceipts',
  'listRentSchedules',
  'listTenants',
  'updateDeposit',
  'updateLease',
  'updateRentSchedule',
  'updateTenant',
  'voidRentReceipt',
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
        name: 'Rental Manager',
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
      sequenceRow('lease', 'LSE-'),
      sequenceRow('payment_receipt', 'RCP-', 6),
    ],
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
    units: [
      unitRow({ id: UNIT_ONE_ID }),
      unitRow({ id: UNIT_TWO_ID, unit_number: 'A-102' }),
      unitRow({
        id: UNIT_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        project_id: OTHER_PROJECT_ID,
        unit_number: 'B-101',
      }),
    ],
    tenants: [
      tenantRow({ id: TENANT_ONE_ID }),
      tenantRow({ id: TENANT_TWO_ID, name: 'Dev Malhotra', type: 'company', phone: '555-0111' }),
      tenantRow({
        id: TENANT_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Tenant',
      }),
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
        roles: [{ id: MANAGER_ROLE_ID, name: 'Rental Manager' }],
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
        name: 'Rental Manager',
        description: '',
        is_default: true,
      },
    ],
    rolePermissions: {
      [ADMIN_ROLE_ID]: [...MANAGER_PERMISSIONS],
      [MANAGER_ROLE_ID]: [...MANAGER_PERMISSIONS],
    },
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

function leasePayload(overrides = {}) {
  return {
    unit_id: UNIT_ONE_ID,
    tenant_id: TENANT_ONE_ID,
    start_date: '2026-11-01',
    end_date: '2027-01-31',
    frequency: 'monthly',
    rent_amount: 1200,
    due_day: 5,
    grace_days: 5,
    late_fee_type: 'none',
    late_fee_value: 0,
    notice_period_days: 0,
    security_deposit_amount: 2400,
    utilities_included: ['water', 'internet'],
    terms: 'Quiet hours after 10pm.',
    activate: false,
    ...overrides,
  };
}

function createTenant(agent, csrf, overrides = {}) {
  return agent
    .post('/api/tenants')
    .set('X-CSRF-Token', csrf)
    .send({
      name: 'Mira Patel',
      type: 'individual',
      phone: '555-0110',
      email: 'mira@example.test',
      ...overrides,
    });
}

function createLease(agent, csrf, overrides = {}) {
  return agent
    .post('/api/leases')
    .set('X-CSRF-Token', csrf)
    .send(leasePayload(overrides));
}

function activateLease(agent, csrf, leaseId) {
  return agent.post(`/api/leases/${leaseId}/activate`).set('X-CSRF-Token', csrf).send({});
}

describe('rental routes', () => {
  let app;
  let adminRepository;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T12:00:00.000Z'));
    ({ app, adminRepository } = await makeApp());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('tenants', () => {
    it('creates, lists, updates and deletes a tenant', async () => {
      const { agent, csrf } = await loginAdmin(app);

      const created = await createTenant(agent, csrf, {
        name: 'Rhea Kapoor',
        occupation: 'Doctor',
      }).expect(201);
      expect(created.body.data).toMatchObject({
        name: 'Rhea Kapoor',
        type: 'individual',
        phone: '555-0110',
        occupation: 'Doctor',
        is_active: true,
      });

      const listed = await agent.get('/api/tenants?search=Rhea').expect(200);
      expect(listed.body.data).toHaveLength(1);
      expect(listed.body.data[0].name).toBe('Rhea Kapoor');

      const updated = await agent
        .patch(`/api/tenants/${created.body.data.id}`)
        .set('X-CSRF-Token', csrf)
        .send({ occupation: 'Surgeon', city: 'Pune' })
        .expect(200);
      expect(updated.body.data).toMatchObject({ occupation: 'Surgeon', city: 'Pune' });

      await agent
        .delete(`/api/tenants/${created.body.data.id}`)
        .set('X-CSRF-Token', csrf)
        .expect(200);

      const afterDelete = await agent.get('/api/tenants?search=Rhea').expect(200);
      expect(afterDelete.body.data).toHaveLength(0);
    });

    it('requires a tenant name and phone', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const response = await createTenant(agent, csrf, { name: '', phone: '' }).expect(422);
      expect(response.body.fields).toMatchObject({
        name: expect.any(String),
        phone: expect.any(String),
      });
    });

    it('filters tenants by occupancy and type', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const lease = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, lease.body.data.id).expect(200);

      const current = await agent.get('/api/tenants?occupancy=current').expect(200);
      expect(current.body.data.map((row) => row.id)).toContain(TENANT_ONE_ID);
      expect(current.body.data.find((row) => row.id === TENANT_ONE_ID)).toMatchObject({
        current_unit: 'A-101',
        lease_ends: '2027-01-31',
        balance_due: 3600,
      });

      const without = await agent.get('/api/tenants?occupancy=without').expect(200);
      expect(without.body.data.map((row) => row.id)).toEqual([TENANT_TWO_ID]);

      const companies = await agent.get('/api/tenants?type=company').expect(200);
      expect(companies.body.data.map((row) => row.id)).toEqual([TENANT_TWO_ID]);
    });

    it('does not expose tenants from another company', async () => {
      const { agent } = await loginAdmin(app);
      await agent.get(`/api/tenants/${TENANT_OTHER_ID}`).expect(404);
    });
  });

  describe('leases', () => {
    it('creates a draft lease without generating rent or occupying the unit', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const response = await createLease(agent, csrf).expect(201);

      expect(response.body.data).toMatchObject({
        number: 'LSE-2026-00001',
        status: 'draft',
        rent_amount: 1200,
        due_day: 5,
        tenant: { id: TENANT_ONE_ID, name: 'Mira Patel' },
        unit: { id: UNIT_ONE_ID, unit_number: 'A-101' },
        deposit: { required_amount: 2400, status: 'to_collect' },
      });
      expect(response.body.data.schedules).toEqual([]);
      expect(adminRepository.units.find((row) => row.id === UNIT_ONE_ID).status).toBe('available');
    });

    it('activates a lease, generates the rent schedule and marks the unit rented', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      const activated = await activateLease(agent, csrf, created.body.data.id).expect(200);

      expect(activated.body.data.status).toBe('active');
      expect(activated.body.data.schedules.map((row) => row.period_label)).toEqual([
        'Nov 2026',
        'Dec 2026',
        'Jan 2027',
      ]);
      expect(activated.body.data.schedules.map((row) => row.balance)).toEqual([1200, 1200, 1200]);
      expect(activated.body.data).toMatchObject({
        collected: 0,
        balance_due: 3600,
        overdue_amount: 1200,
      });
      expect(adminRepository.units.find((row) => row.id === UNIT_ONE_ID).status).toBe('rented');
    });

    it('rejects a second active lease for the same unit', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);

      const duplicate = await createLease(agent, csrf, { tenant_id: TENANT_TWO_ID }).expect(409);
      expect(duplicate.body.error).toMatch(/lease/i);
    });

    it('blocks activation when the unit has an active sale or reservation', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const saleLease = (await createLease(agent, csrf).expect(201)).body.data;

      adminRepository.sales.push({
        id: 'd9999999-9999-4999-8999-999999999999',
        company_id: COMPANY_ID,
        unit_id: UNIT_ONE_ID,
        number: 'SAL-2026-00009',
        customer_id: null,
        status: 'active',
      });
      await adminRepository.updateUnitStatus(COMPANY_ID, UNIT_ONE_ID, {
        status: 'sold',
        reason: 'Sale created',
        changedBy: ADMIN_ID,
      });

      const saleBlocked = await activateLease(agent, csrf, saleLease.id).expect(409);
      expect(saleBlocked.body.error).toMatch(/active sale|reservation/i);
      expect((await agent.get(`/api/leases/${saleLease.id}`).expect(200)).body.data.status).toBe(
        'draft',
      );
      expect(adminRepository.units.find((row) => row.id === UNIT_ONE_ID).status).toBe('sold');

      const reservationLease = (
        await createLease(agent, csrf, { unit_id: UNIT_TWO_ID }).expect(201)
      ).body.data;
      adminRepository.reservations.push({
        id: 'd8888888-8888-4888-8888-888888888888',
        company_id: COMPANY_ID,
        unit_id: UNIT_TWO_ID,
        number: 'RSV-2026-00009',
        customer_id: null,
        status: 'active',
      });
      await adminRepository.updateUnitStatus(COMPANY_ID, UNIT_TWO_ID, {
        status: 'reserved',
        reason: 'Reservation created',
        changedBy: ADMIN_ID,
      });

      const reservationBlocked = await activateLease(
        agent,
        csrf,
        reservationLease.id,
      ).expect(409);
      expect(reservationBlocked.body.error).toMatch(/active sale|reservation/i);
      expect(adminRepository.units.find((row) => row.id === UNIT_TWO_ID).status).toBe('reserved');
    });

    it('renews a lease, links the previous lease and keeps the unit rented', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf, { end_date: '2026-12-31' }).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);

      const renewed = await agent
        .post(`/api/leases/${created.body.data.id}/renew`)
        .set('X-CSRF-Token', csrf)
        .send({
          start_date: '2027-02-01',
          end_date: '2028-01-31',
          rent_amount: 1300,
          due_day: 5,
          grace_days: 5,
          late_fee_type: 'none',
          late_fee_value: 0,
          notice_period_days: 30,
          security_deposit_amount: 2600,
          activate: true,
        })
        .expect(201);

      expect(renewed.body.data).toMatchObject({
        previous_lease_id: created.body.data.id,
        status: 'active',
        rent_amount: 1300,
      });
      expect(renewed.body.data.schedules).toHaveLength(12);
      const oldLease = await agent
        .get(`/api/leases/${created.body.data.id}`)
        .expect(200);
      expect(oldLease.body.data.status).toBe('renewed');
      expect(oldLease.body.data.deposit).toMatchObject({
        status: 'settled',
        held_amount: 0,
      });
      expect(adminRepository.units.find((row) => row.id === UNIT_ONE_ID).status).toBe('rented');
    });

    it('keeps the deposit amount in step with a draft lease edit', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      const leaseId = created.body.data.id;
      const depositId = created.body.data.deposit.id;

      await agent
        .patch(`/api/leases/${leaseId}`)
        .set('X-CSRF-Token', csrf)
        .send({ security_deposit_amount: 3000 })
        .expect(200);

      const deposit = await agent.get(`/api/deposits/${depositId}`).expect(200);
      expect(deposit.body.data).toMatchObject({
        required_amount: 3000,
        status: 'to_collect',
      });
    });

    it('rejects a renewal that starts before the current lease ends', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);

      const response = await agent
        .post(`/api/leases/${created.body.data.id}/renew`)
        .set('X-CSRF-Token', csrf)
        .send({
          start_date: '2027-01-15',
          end_date: '2027-12-31',
          rent_amount: 1300,
        })
        .expect(422);
      expect(response.body.fields?.start_date || response.body.error).toMatch(/after/i);
    });

    it('revises rent for future unpaid periods only', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);
      const detail = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);
      const first = detail.body.data.schedules[0];

      await agent
        .post('/api/rent-collections')
        .set('X-CSRF-Token', csrf)
        .send({
          tenant_id: TENANT_ONE_ID,
          amount: 1200,
          allocations: [{ rent_schedule_id: first.id, amount: 1200 }],
        })
        .expect(201);

      const revised = await agent
        .post(`/api/leases/${created.body.data.id}/revise-rent`)
        .set('X-CSRF-Token', csrf)
        .send({ rent_amount: 1500, effective_date: '2026-12-01' })
        .expect(200);

      expect(revised.body.data.rent_amount).toBe(1500);
      expect(revised.body.data.schedules.map((row) => row.rent_amount)).toEqual([
        1200, 1500, 1500,
      ]);
      expect(revised.body.data.schedules[0].status).toBe('paid');
      expect(revised.body.data.balance_due).toBe(3000);
    });

    it('terminates a lease, cancels future rent and releases the unit', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);
      const detail = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);
      const depositId = detail.body.data.deposit.id;
      await agent
        .post(`/api/deposits/${depositId}/receipt`)
        .set('X-CSRF-Token', csrf)
        .send({ amount: 2400 })
        .expect(200);

      const terminated = await agent
        .post(`/api/leases/${created.body.data.id}/terminate`)
        .set('X-CSRF-Token', csrf)
        .send({ termination_date: '2026-11-17', reason: 'Tenant relocation' })
        .expect(200);

      expect(terminated.body.data.status).toBe('terminated');
      expect(terminated.body.data.termination_reason).toBe('Tenant relocation');
      expect(
        terminated.body.data.schedules.find((row) => row.period_label === 'Dec 2026').status,
      ).toBe('cancelled');
      expect(
        terminated.body.data.schedules.find((row) => row.period_label === 'Nov 2026').status,
      ).not.toBe('cancelled');
      expect(terminated.body.data.deposit.status).toBe('awaiting_settlement');
      expect(adminRepository.units.find((row) => row.id === UNIT_ONE_ID).status).toBe('available');
    });

    it('expires a finished lease, closes future periods and releases the unit', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf, {
        start_date: '2026-06-01',
        end_date: '2026-10-31',
      }).expect(201);
      const activated = await activateLease(agent, csrf, created.body.data.id).expect(200);
      const depositId = activated.body.data.deposit.id;

      await agent
        .post(`/api/deposits/${depositId}/receipt`)
        .set('X-CSRF-Token', csrf)
        .send({ amount: 2400 })
        .expect(200);

      adminRepository.rentSchedules.push({
        id: 'c9999999-9999-4999-8999-999999999999',
        company_id: COMPANY_ID,
        lease_id: created.body.data.id,
        period_label: 'Nov 2026',
        period_start: '2026-11-01',
        period_end: '2026-11-30',
        due_date: '2026-11-05',
        rent_amount: 1200,
        adjustments: 0,
        late_fee: 0,
        paid_amount: 0,
        status: 'upcoming',
        created_at: '2026-10-01T00:00:00.000Z',
        updated_at: '2026-10-01T00:00:00.000Z',
      });

      const expired = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);
      expect(expired.body.data.status).toBe('expired');
      expect(expired.body.data.deposit).toMatchObject({
        status: 'awaiting_settlement',
        held_amount: 2400,
      });
      expect(
        expired.body.data.schedules.find((row) => row.period_label === 'Nov 2026').status,
      ).toBe('cancelled');
      expect(
        expired.body.data.schedules.find((row) => row.period_label === 'Jun 2026').status,
      ).toBe('overdue');
      expect(adminRepository.units.find((row) => row.id === UNIT_ONE_ID).status).toBe('available');
    });

    it('applies extra charges, discounts and waivers to a rent period', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);
      const detail = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);
      const first = detail.body.data.schedules[0];
      const path = `/api/leases/${created.body.data.id}/schedule/${first.id}/adjustments`;

      const charged = await agent
        .post(path)
        .set('X-CSRF-Token', csrf)
        .send({ type: 'extra_charge', amount: 100, reason: 'Parking' })
        .expect(200);
      expect(charged.body.data).toMatchObject({ adjustments: 100, balance: 1300 });

      const discounted = await agent
        .post(path)
        .set('X-CSRF-Token', csrf)
        .send({ type: 'discount', amount: 50, reason: 'Loyalty' })
        .expect(200);
      expect(discounted.body.data).toMatchObject({ adjustments: 50, balance: 1250 });

      const waived = await agent
        .post(path)
        .set('X-CSRF-Token', csrf)
        .send({ type: 'waiver', reason: 'Goodwill' })
        .expect(200);
      expect(waived.body.data).toMatchObject({ status: 'waived', balance: 0 });
    });
  });

  describe('rent roll', () => {
    it('expires a finished lease while reading the rent roll', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf, {
        start_date: '2026-06-01',
        end_date: '2026-10-31',
      }).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);

      await agent.get('/api/rent-roll').expect(200);

      expect(
        adminRepository.leases.find((row) => row.id === created.body.data.id).status,
      ).toBe('expired');
      expect(adminRepository.units.find((row) => row.id === UNIT_ONE_ID).status).toBe('available');
    });

    it('filters open, overdue and date-ranged rent periods', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);

      const overdue = await agent.get('/api/rent-roll?status=overdue').expect(200);
      expect(overdue.body.data).toHaveLength(1);
      expect(overdue.body.data[0]).toMatchObject({
        lease_number: 'LSE-2026-00001',
        tenant: { name: 'Mira Patel' },
        unit: { unit_number: 'A-101' },
        period_label: 'Nov 2026',
        balance: 1200,
        status: 'overdue',
      });

      const upcoming = await agent
        .get('/api/rent-roll?status=upcoming&date_from=2026-12-01&date_to=2026-12-31')
        .expect(200);
      expect(upcoming.body.data.map((row) => row.period_label)).toEqual(['Dec 2026']);

      const open = await agent.get('/api/rent-roll?status=open').expect(200);
      expect(open.body.data).toHaveLength(3);
      expect(open.body.meta.total).toBe(3);
    });
  });

  describe('rent collections', () => {
    it('records a rent receipt and reopens the period when voided', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);
      const detail = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);
      const first = detail.body.data.schedules[0];

      const receipt = await agent
        .post('/api/rent-collections')
        .set('X-CSRF-Token', csrf)
        .send({
          tenant_id: TENANT_ONE_ID,
          received_on: '2026-11-17',
          amount: 1200,
          reference: 'BANK-88',
          allocations: [{ rent_schedule_id: first.id, amount: 1200 }],
        })
        .expect(201);

      expect(receipt.body.data).toMatchObject({
        number: 'RCP-2026-000001',
        status: 'completed',
        amount: 1200,
        settles: 'LSE-2026-00001',
        tenant: { id: TENANT_ONE_ID, name: 'Mira Patel' },
      });

      const afterReceipt = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);
      expect(afterReceipt.body.data.schedules[0].status).toBe('paid');
      expect(afterReceipt.body.data).toMatchObject({ collected: 1200, balance_due: 2400 });

      const voided = await agent
        .post(`/api/rent-collections/${receipt.body.data.id}/void`)
        .set('X-CSRF-Token', csrf)
        .send({ reason: 'Cheque bounced' })
        .expect(200);
      expect(voided.body.data.status).toBe('voided');

      const afterVoid = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);
      expect(afterVoid.body.data.schedules[0].status).toBe('overdue');
      expect(afterVoid.body.data.schedules[0].balance).toBe(1200);
      expect(afterVoid.body.data.collected).toBe(0);
    });

    it('rejects an allocation above the rent balance', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);
      const detail = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);

      const response = await agent
        .post('/api/rent-collections')
        .set('X-CSRF-Token', csrf)
        .send({
          tenant_id: TENANT_ONE_ID,
          amount: 2400,
          allocations: [{ rent_schedule_id: detail.body.data.schedules[0].id, amount: 2400 }],
        })
        .expect(422);
      expect(response.body.error).toMatch(/balance/i);
    });

    it('rejects allocations that do not equal the receipt amount', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const created = await createLease(agent, csrf).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);
      const detail = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);

      const response = await agent
        .post('/api/rent-collections')
        .set('X-CSRF-Token', csrf)
        .send({
          tenant_id: TENANT_ONE_ID,
          amount: 1200,
          allocations: [{ rent_schedule_id: detail.body.data.schedules[0].id, amount: 1000 }],
        })
        .expect(422);
      expect(response.body.fields?.allocations || response.body.error).toMatch(/equal/i);
    });
  });

  describe('security deposits', () => {
    async function activeLeaseWithDeposit(agent, csrf, depositAmount = 2400) {
      const created = await createLease(agent, csrf, {
        security_deposit_amount: depositAmount,
      }).expect(201);
      await activateLease(agent, csrf, created.body.data.id).expect(200);
      const detail = await agent.get(`/api/leases/${created.body.data.id}`).expect(200);
      return { lease: detail.body.data, deposit: detail.body.data.deposit };
    }

    it('tracks a deposit receipt, deduction, termination and refund', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const { lease, deposit } = await activeLeaseWithDeposit(agent, csrf);

      const received = await agent
        .post(`/api/deposits/${deposit.id}/receipt`)
        .set('X-CSRF-Token', csrf)
        .send({ amount: 2400 })
        .expect(200);
      expect(received.body.data).toMatchObject({
        status: 'held',
        received_amount: 2400,
        held_amount: 2400,
      });

      const deducted = await agent
        .post(`/api/deposits/${deposit.id}/deduction`)
        .set('X-CSRF-Token', csrf)
        .send({ amount: 500, reason: 'Wall repair' })
        .expect(200);
      expect(deducted.body.data).toMatchObject({
        status: 'held',
        deducted_amount: 500,
        held_amount: 1900,
      });

      await agent
        .post(`/api/leases/${lease.id}/terminate`)
        .set('X-CSRF-Token', csrf)
        .send({ termination_date: '2026-11-17', reason: 'End of tenancy' })
        .expect(200);

      const afterTermination = await agent.get(`/api/deposits/${deposit.id}`).expect(200);
      expect(afterTermination.body.data.status).toBe('awaiting_settlement');

      const refunded = await agent
        .post(`/api/deposits/${deposit.id}/refund`)
        .set('X-CSRF-Token', csrf)
        .send({ amount: 1900, reason: 'Balance returned' })
        .expect(200);
      expect(refunded.body.data).toMatchObject({
        status: 'settled',
        refunded_amount: 1900,
        held_amount: 0,
      });
    });

    it('rejects a refund above the held balance', async () => {
      const { agent, csrf } = await loginAdmin(app);
      const { deposit } = await activeLeaseWithDeposit(agent, csrf);
      await agent
        .post(`/api/deposits/${deposit.id}/receipt`)
        .set('X-CSRF-Token', csrf)
        .send({ amount: 2400 })
        .expect(200);

      const response = await agent
        .post(`/api/deposits/${deposit.id}/refund`)
        .set('X-CSRF-Token', csrf)
        .send({ amount: 2500 })
        .expect(422);
      expect(response.body.error).toMatch(/held balance/i);
    });

    it('lists deposits by status', async () => {
      const { agent, csrf } = await loginAdmin(app);
      await activeLeaseWithDeposit(agent, csrf);

      const toCollect = await agent.get('/api/deposits?status=to_collect').expect(200);
      expect(toCollect.body.data).toHaveLength(1);
      expect(toCollect.body.data[0]).toMatchObject({
        lease: { number: 'LSE-2026-00001' },
        tenant: { name: 'Mira Patel' },
        required_amount: 2400,
        held_amount: 0,
        status: 'to_collect',
      });
    });
  });

  describe('permissions', () => {
    it('limits a rental manager without lease-create or deposit permissions', async () => {
      const { agent, csrf } = await loginManager(app);
      await agent.get('/api/tenants').expect(200);
      await agent.get('/api/leases').expect(200);
      await agent.get('/api/rent-roll').expect(200);

      await createTenant(agent, csrf, { name: 'Blocked Tenant' }).expect(403);
      await agent.get('/api/deposits').expect(403);
      await agent.post('/api/leases').set('X-CSRF-Token', csrf).send(leasePayload()).expect(403);
    });
  });
});
