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
const UNIT_ONE_ID = 'e1111111-1111-4111-8111-111111111111';
const UNIT_TWO_ID = 'e2222222-2222-4222-8222-222222222222';
const UNIT_OTHER_ID = 'e3333333-3333-4333-8333-333333333333';
const CUSTOMER_ID = '22222222-aaaa-4aaa-8aaa-222222222222';
const CUSTOMER_OTHER_ID = '22222222-cccc-4ccc-8ccc-222222222222';
const LEAD_ID = '11111111-aaaa-4aaa-8aaa-111111111111';

const MANAGER_PERMISSIONS = ['customers.view'];

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
    rent_price: 0,
    status: 'available',
    description: null,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

function customerRow(overrides) {
  return {
    company_id: COMPANY_ID,
    lead_id: null,
    source_id: null,
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

function cookieFrom(response, name) {
  const header = response.headers['set-cookie'] || [];
  const match = header.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split(';')[0].slice(name.length + 1));
}

const ROUTE_REPOSITORY_METHODS = new Set([
  'createCommissionRule',
  'createQuotation',
  'createReceipt',
  'createReservation',
  'createSale',
  'createSalesCommission',
  'deleteCommissionRule',
  'deleteQuotation',
  'expireReservations',
  'findActiveReservationForUnit',
  'findActiveSaleForUnit',
  'getCommissionRule',
  'getCustomer',
  'getInstallment',
  'getProject',
  'getQuotation',
  'getReservation',
  'getSale',
  'getTeamMember',
  'getUnit',
  'listCommissionRules',
  'listInstallments',
  'listQuotations',
  'listReceipts',
  'listReservations',
  'listSales',
  'listSalesCommissions',
  'updateCommissionRule',
  'updateInstallment',
  'updateQuotation',
  'updateReservation',
  'updateSale',
  'updateSalesCommission',
  'updateUnitStatus',
  'voidReceipt',
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
    sequences: [
      sequenceRow('quotation', 'QT-'),
      sequenceRow('reservation', 'RSV-'),
      sequenceRow('sale', 'SAL-'),
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
    unitTypes: [],
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
    customers: [
      customerRow({ id: CUSTOMER_ID }),
      customerRow({
        id: CUSTOMER_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Customer',
      }),
    ],
    leads: [
      {
        id: LEAD_ID,
        company_id: COMPANY_ID,
        name: 'Avery Stone',
        phone: '555-0100',
        email: 'avery@example.test',
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

async function createQuotation(agent, csrf, overrides = {}) {
  const response = await agent
    .post('/api/quotations')
    .set('X-CSRF-Token', csrf)
    .send({
      lead_id: LEAD_ID,
      unit_id: UNIT_ONE_ID,
      salesperson_id: MANAGER_ID,
      quotation_date: '2026-11-01',
      valid_until: '2026-12-01',
      unit_price: 300000,
      discount_amount: 10000,
      tax_amount: 15000,
      terms: 'Booking within 14 days.',
      ...overrides,
    });
  return response;
}

async function createReservation(agent, csrf, overrides = {}) {
  return agent
    .post('/api/reservations')
    .set('X-CSRF-Token', csrf)
    .send({
      customer_id: CUSTOMER_ID,
      unit_id: UNIT_ONE_ID,
      booking_amount: 5000,
      reserved_on: '2026-11-01',
      expires_at: '2030-12-31',
      notes: 'Corner unit',
      ...overrides,
    });
}

async function createSale(agent, csrf, overrides = {}) {
  return agent
    .post('/api/sales')
    .set('X-CSRF-Token', csrf)
    .send({
      customer_id: CUSTOMER_ID,
      unit_id: UNIT_ONE_ID,
      salesperson_id: MANAGER_ID,
      agreement_date: '2026-11-01',
      sale_price: 100000,
      discount_amount: 5000,
      tax_amount: 5000,
      payment_type: 'installments',
      notes: 'Two-bedroom apartment',
      plan: {
        down_payment: 10000,
        number_of_installments: 3,
        frequency: 'monthly',
        start_date: '2027-01-01',
        due_day: 1,
        grace_days: 5,
        late_fee_type: 'none',
        late_fee_value: 0,
      },
      ...overrides,
    });
}

describe('sales: quotations, reservations, sales, collections and commissions', () => {
  let app;
  let adminRepository;

  beforeEach(async () => {
    ({ app, adminRepository } = await makeApp());
  });

  it('keeps rent receipts out of the sales collections endpoints', async () => {
    adminRepository.receipts.push({
      id: 'f1111111-1111-4111-8111-111111111111',
      company_id: COMPANY_ID,
      tenant_id: 'f2222222-2222-4222-8222-222222222222',
      customer_id: null,
      number: 'RCP-2026-000001',
      status: 'completed',
      received_on: '2026-11-10',
      amount: 1200,
      created_at: '2026-11-10T00:00:00.000Z',
    });

    const { agent, csrf } = await loginAdmin(app);
    const listed = await agent.get('/api/collections').expect(200);
    expect(listed.body.data).toHaveLength(0);

    await agent
      .get('/api/collections/f1111111-1111-4111-8111-111111111111')
      .expect(404);
    await agent
      .post('/api/collections/f1111111-1111-4111-8111-111111111111/void')
      .set('X-CSRF-Token', csrf)
      .send({ reason: 'Wrong module' })
      .expect(404);
  });

  it('creates and filters a quotation from a lead, then enforces status transitions', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await createQuotation(agent, csrf);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      number: 'QT-2026-00001',
      lead_id: LEAD_ID,
      customer_id: null,
      unit_price: 300000,
      discount_amount: 10000,
      tax_amount: 15000,
      net_amount: 305000,
      status: 'draft',
    });

    const list = await agent.get('/api/quotations?search=QT-2026&status=draft&project_id=' + PROJECT_ID).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].lead.name).toBe('Avery Stone');

    const invalid = await agent
      .post(`/api/quotations/${created.body.data.id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'accepted' })
      .expect(422);
    expect(invalid.body.error).toMatch(/draft/i);

    const sent = await agent
      .post(`/api/quotations/${created.body.data.id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'sent' })
      .expect(200);
    expect(sent.body.data.status).toBe('sent');

    const accepted = await agent
      .post(`/api/quotations/${created.body.data.id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'accepted' })
      .expect(200);
    expect(accepted.body.data.status).toBe('accepted');

    await agent.get('/api/quotations?status=sent').expect(200).expect((response) => {
      expect(response.body.data).toHaveLength(0);
    });
  });

  it('keeps quotation status changes and edits on their own endpoints', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const created = await createQuotation(agent, csrf);

    const statusBypass = await agent
      .patch(`/api/quotations/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'sent', unit_price: 1 })
      .expect(422);
    expect(statusBypass.body.fields.status).toMatch(/status action/i);

    const unchanged = await agent.get(`/api/quotations/${created.body.data.id}`).expect(200);
    expect(unchanged.body.data).toMatchObject({ status: 'draft', unit_price: 300000 });

    await agent
      .post(`/api/quotations/${created.body.data.id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'sent' })
      .expect(200);
    await agent
      .post(`/api/quotations/${created.body.data.id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'accepted' })
      .expect(200);

    const locked = await agent
      .patch(`/api/quotations/${created.body.data.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ unit_price: 1 })
      .expect(409);
    expect(locked.body.error).toMatch(/draft/i);
  });

  it('reserves a unit, blocks duplicates, cancels and expires reservations', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await createReservation(agent, csrf);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      number: 'RSV-2026-00001',
      status: 'active',
      booking_amount: 5000,
    });
    expect(created.body.data.unit.status).toBe('reserved');

    expect((await createReservation(agent, csrf)).status).toBe(409);

    const cancelled = await agent
      .post(`/api/reservations/${created.body.data.id}/cancel`)
      .set('X-CSRF-Token', csrf)
      .send({ reason: 'Customer chose another unit' })
      .expect(200);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect(cancelled.body.data.unit.status).toBe('available');

    const expiring = await createReservation(agent, csrf, { expires_at: '2020-01-01' });
    expect(expiring.status).toBe(201);
    expect(expiring.body.data.status).toBe('expired');
    expect(expiring.body.data.unit.status).toBe('available');
  });

  it('converts a matching reservation when the sale is created directly', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const reservation = await createReservation(agent, csrf);
    expect(reservation.status).toBe(201);

    const sale = await createSale(agent, csrf);
    expect(sale.status).toBe(201);
    const converted = await agent
      .get(`/api/reservations/${reservation.body.data.id}`)
      .expect(200);
    expect(converted.body.data).toMatchObject({
      status: 'converted',
      converted_sale_id: sale.body.data.id,
    });
    expect(sale.body.data.unit.status).toBe('sold');
  });

  it('rejects a quotation that belongs to a different customer', async () => {
    adminRepository.customers.push(
      customerRow({
        id: '22222222-bbbb-4bbb-8bbb-222222222222',
        name: 'Jordan Blake',
        email: 'jordan.blake@example.test',
      }),
    );
    const { agent, csrf } = await loginAdmin(app);
    const quotation = await createQuotation(agent, csrf, {
      lead_id: null,
      customer_id: CUSTOMER_ID,
    });
    expect(quotation.status).toBe(201);
    await agent
      .post(`/api/quotations/${quotation.body.data.id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'sent' })
      .expect(200);
    await agent
      .post(`/api/quotations/${quotation.body.data.id}/status`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'accepted' })
      .expect(200);

    const response = await createSale(agent, csrf, {
      customer_id: '22222222-bbbb-4bbb-8bbb-222222222222',
      quotation_id: quotation.body.data.id,
    });
    expect(response.status).toBe(422);
    expect(response.body.fields?.quotation_id || response.body.error).toMatch(/customer/i);
  });

  it('creates an installment sale with a generated schedule and a full-payment sale', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const created = await createSale(agent, csrf);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      number: 'SAL-2026-00001',
      net_price: 100000,
      collected_amount: 10000,
      status: 'active',
      payment_type: 'installments',
    });
    expect(created.body.data.unit.status).toBe('sold');
    expect(created.body.data.installments).toHaveLength(3);
    expect(created.body.data.installments.map((row) => row.amount)).toEqual([
      30000, 30000, 30000,
    ]);
    expect(created.body.data.installments.reduce((sum, row) => sum + row.balance, 0)).toBe(90000);

    const detail = await agent.get(`/api/sales/${created.body.data.id}`).expect(200);
    expect(detail.body.data.installments[0].due_date).toBe('2027-01-01');

    const full = await createSale(agent, csrf, {
      unit_id: UNIT_TWO_ID,
      payment_type: 'full',
      plan: null,
    });
    expect(full.status).toBe(201);
    expect(full.body.data.payment_type).toBe('full');
    expect(full.body.data.installments).toHaveLength(1);
    expect(full.body.data.installments[0].amount).toBe(100000);
    expect(full.body.data.installments[0].due_date).toBe('2026-11-01');
    expect(full.body.data.unit.status).toBe('sold');
  });

  it('reschedules and waives an installment', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const sale = (await createSale(agent, csrf)).body.data;
    const installment = sale.installments[0];

    const rescheduled = await agent
      .patch(`/api/sales/${sale.id}/installments/${installment.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ action: 'reschedule', due_date: '2027-06-15' })
      .expect(200);
    expect(rescheduled.body.data.due_date).toBe('2027-06-15');
    expect(rescheduled.body.data.status).toBe('upcoming');

    const waived = await agent
      .patch(`/api/sales/${sale.id}/installments/${installment.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ action: 'waive', reason: 'Goodwill adjustment' })
      .expect(200);
    expect(waived.body.data.status).toBe('waived');
    expect(waived.body.data.balance).toBe(0);

    const afterWaive = await agent.get(`/api/sales/${sale.id}`).expect(200);
    expect(afterWaive.body.data.balance_due).toBe(60000);

    await agent
      .patch(`/api/sales/${sale.id}/installments/${installment.id}`)
      .set('X-CSRF-Token', csrf)
      .send({ action: 'pay', amount: 100 })
      .expect(422);
  });

  it('records partial and full receipts, rejects over-allocation and voids a receipt', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const sale = (await createSale(agent, csrf)).body.data;
    const [first, second, third] = sale.installments;

    const invalid = await agent
      .post('/api/collections')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        received_on: '2026-11-10',
        amount: 31000,
        allocations: [{ installment_id: first.id, amount: 31000 }],
      })
      .expect(422);
    expect(invalid.body.error).toMatch(/balance/i);

    await agent
      .post('/api/collections')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        received_on: '2026-11-10',
        amount: 40000,
        allocations: [{ installment_id: first.id, amount: 40000 }],
      })
      .expect(422);

    const partial = await agent
      .post('/api/collections')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        received_on: '2026-11-10',
        amount: 4000,
        reference: 'UPI-1001',
        allocations: [{ installment_id: first.id, amount: 4000 }],
      })
      .expect(201);
    expect(partial.body.data).toMatchObject({
      number: 'RCP-2026-000001',
      amount: 4000,
      status: 'completed',
    });

    let detail = await agent.get(`/api/sales/${sale.id}`).expect(200);
    expect(detail.body.data.collected_amount).toBe(14000);
    expect(detail.body.data.status).toBe('active');
    expect(detail.body.data.installments[0]).toMatchObject({
      paid_amount: 4000,
      balance: 26000,
      status: 'partly_paid',
    });

    const final = await agent
      .post('/api/collections')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        received_on: '2026-11-11',
        amount: 86000,
        allocations: [
          { installment_id: first.id, amount: 26000 },
          { installment_id: second.id, amount: 30000 },
          { installment_id: third.id, amount: 30000 },
        ],
      })
      .expect(201);

    detail = await agent.get(`/api/sales/${sale.id}`).expect(200);
    expect(detail.body.data.collected_amount).toBe(100000);
    expect(detail.body.data.balance_due).toBe(0);
    expect(detail.body.data.status).toBe('fully_paid');
    expect(detail.body.data.installments.every((row) => row.status === 'paid')).toBe(true);

    const voided = await agent
      .post(`/api/collections/${final.body.data.id}/void`)
      .set('X-CSRF-Token', csrf)
      .send({ reason: 'Cheque returned' })
      .expect(200);
    expect(voided.body.data.status).toBe('voided');

    detail = await agent.get(`/api/sales/${sale.id}`).expect(200);
    expect(detail.body.data.collected_amount).toBe(14000);
    expect(detail.body.data.installments[0].paid_amount).toBe(4000);
    expect(detail.body.data.installments[1].paid_amount).toBe(0);
    expect(detail.body.data.installments[1].balance).toBe(30000);

    const voidList = await agent.get('/api/collections?status=voided').expect(200);
    expect(voidList.body.data).toHaveLength(1);
  });

  it('keeps cancelled installments cancelled when a receipt is voided after sale cancellation', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const sale = (await createSale(agent, csrf)).body.data;
    const first = sale.installments[0];

    const receipt = await agent
      .post('/api/collections')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        received_on: '2026-11-10',
        amount: 4000,
        allocations: [{ installment_id: first.id, amount: 4000 }],
      })
      .expect(201);

    await agent
      .post(`/api/sales/${sale.id}/cancel`)
      .set('X-CSRF-Token', csrf)
      .send({ reason: 'Customer withdrew' })
      .expect(200);

    await agent
      .post(`/api/collections/${receipt.body.data.id}/void`)
      .set('X-CSRF-Token', csrf)
      .send({ reason: 'Cheque returned' })
      .expect(200);

    const detail = await agent.get(`/api/sales/${sale.id}`).expect(200);
    expect(detail.body.data.status).toBe('cancelled');
    expect(detail.body.data.balance_due).toBe(0);
    expect(detail.body.data.installments.every((row) => row.status === 'cancelled')).toBe(true);
    expect(detail.body.data.installments.every((row) => Number(row.balance) === 0)).toBe(true);
    expect(detail.body.data.installments[0].paid_amount).toBe(0);

    const rejected = await agent
      .post('/api/collections')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        received_on: '2026-11-12',
        amount: 4000,
        allocations: [{ installment_id: first.id, amount: 4000 }],
      })
      .expect(422);
    expect(rejected.body.fields.allocations).toMatch(/cannot receive/i);
  });

  it('requires a zero open balance before handover and releases the unit on cancel', async () => {
    const { agent, csrf } = await loginAdmin(app);
    const sale = (await createSale(agent, csrf)).body.data;

    await agent
      .post(`/api/sales/${sale.id}/handover`)
      .set('X-CSRF-Token', csrf)
      .send({ handover_date: '2026-12-01' })
      .expect(422);

    await agent
      .post('/api/collections')
      .set('X-CSRF-Token', csrf)
      .send({
        customer_id: CUSTOMER_ID,
        received_on: '2026-11-11',
        amount: 90000,
        allocations: sale.installments.map((row) => ({
          installment_id: row.id,
          amount: row.balance,
        })),
      })
      .expect(201);

    const handover = await agent
      .post(`/api/sales/${sale.id}/handover`)
      .set('X-CSRF-Token', csrf)
      .send({ handover_date: '2026-12-01', notes: 'Keys handed to customer' })
      .expect(200);
    expect(handover.body.data.handover_date).toBe('2026-12-01');
    expect(handover.body.data.status).toBe('fully_paid');

    const second = (await createSale(agent, csrf, { unit_id: UNIT_TWO_ID })).body.data;
    const cancelled = await agent
      .post(`/api/sales/${second.id}/cancel`)
      .set('X-CSRF-Token', csrf)
      .send({ reason: 'Customer withdrew' })
      .expect(200);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect(cancelled.body.data.unit.status).toBe('available');
    expect(cancelled.body.data.installments.every((row) => row.status === 'cancelled')).toBe(true);
  });

  it('generates commission ledger entries from active rules and updates their status', async () => {
    const { agent, csrf } = await loginAdmin(app);

    const rule = await agent
      .post('/api/commissions/rules')
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Standard 2%',
        applicability: 'all',
        rate_type: 'percentage',
        rate_value: 2,
        payable_trigger: 'sale',
        is_active: true,
      })
      .expect(201);
    expect(rule.body.data.name).toBe('Standard 2%');

    const sale = (await createSale(agent, csrf)).body.data;

    const ledger = await agent.get('/api/commissions?status=pending').expect(200);
    expect(ledger.body.data).toHaveLength(1);
    expect(ledger.body.data[0]).toMatchObject({
      sale_id: sale.id,
      salesperson_id: MANAGER_ID,
      base_amount: 100000,
      commission_amount: 2000,
      status: 'pending',
    });

    const approved = await agent
      .patch(`/api/commissions/${ledger.body.data[0].id}`)
      .set('X-CSRF-Token', csrf)
      .send({ status: 'approved' })
      .expect(200);
    expect(approved.body.data.status).toBe('approved');

    await agent
      .post('/api/commissions/rules')
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Bad rule', rate_type: 'percentage', rate_value: -1 })
      .expect(422);
  });

  it('enforces permissions and company scoping', async () => {
    const { agent, csrf } = await loginAdmin(app);

    expect((await createQuotation(agent, csrf, { unit_id: UNIT_OTHER_ID })).status).toBe(422);
    expect((await createSale(agent, csrf, { unit_id: UNIT_OTHER_ID })).status).toBe(422);
    await agent.get(`/api/sales/00000000-0000-4000-8000-000000000000`).expect(404);

    const manager = await loginManager(app);
    await manager.agent.get('/api/sales').expect(403);
    await manager.agent.get('/api/quotations').expect(403);
    await manager.agent.get('/api/collections').expect(403);
  });
});
