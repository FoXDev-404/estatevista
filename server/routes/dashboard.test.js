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
const LIMITED_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ROLE_ID = '99999999-9999-4999-8999-999999999999';
const LIMITED_ROLE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NO_DASHBOARD_ROLE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NO_DASHBOARD_ID = '44444444-4444-4444-8444-444444444444';

const CUSTOMER_ID = 'c1111111-1111-4111-8111-111111111111';
const OTHER_CUSTOMER_ID = 'c2222222-2222-4222-8222-222222222222';
const PROJECT_ONE_ID = 'a1111111-1111-4111-8111-111111111111';
const PROJECT_TWO_ID = 'a2222222-2222-4222-8222-222222222222';
const OTHER_PROJECT_ID = 'a3333333-3333-4333-8333-333333333333';
const UNIT_ONE_ID = 'e1111111-1111-4111-8111-111111111111';
const UNIT_TWO_ID = 'e2222222-2222-4222-8222-222222222222';
const UNIT_THREE_ID = 'e3333333-3333-4333-8333-333333333333';
const UNIT_FOUR_ID = 'e4444444-4444-4444-8444-444444444444';
const OTHER_UNIT_ID = 'e5555555-5555-4555-8555-555555555555';
const SALE_ONE_ID = 'f1111111-1111-4111-8111-111111111111';
const SALE_TWO_ID = 'f2222222-2222-4222-8222-222222222222';
const SALE_CANCELLED_ID = 'f4444444-4444-4444-8444-444444444444';
const OTHER_SALE_ID = 'f3333333-3333-4333-8333-333333333333';
const PLAN_ONE_ID = 'b1111111-1111-4111-8111-111111111111';
const PLAN_TWO_ID = 'b2222222-2222-4222-8222-222222222222';
const PLAN_OTHER_ID = 'b3333333-3333-4333-8333-333333333333';
const INSTALLMENT_ONE_ID = 'd1111111-1111-4111-8111-111111111111';
const INSTALLMENT_TWO_ID = 'd2222222-2222-4222-8222-222222222222';
const INSTALLMENT_THREE_ID = 'd3333333-3333-4333-8333-333333333333';
const OTHER_INSTALLMENT_ID = 'd4444444-4444-4444-8444-444444444444';
const RECEIPT_ONE_ID = '11111111-aaaa-4aaa-8aaa-111111111111';
const RECEIPT_TWO_ID = '22222222-aaaa-4aaa-8aaa-222222222222';
const RECEIPT_THREE_ID = '33333333-aaaa-4aaa-8aaa-333333333333';
const RECEIPT_FOUR_ID = '44444444-aaaa-4aaa-8aaa-444444444444';
const RECEIPT_RENT_ID = '55555555-aaaa-4aaa-8aaa-555555555555';
const RECEIPT_VOID_ID = '66666666-aaaa-4aaa-8aaa-666666666666';
const RECEIPT_PREVIOUS_ID = '77777777-aaaa-4aaa-8aaa-777777777777';
const RECEIPT_OTHER_ID = '88888888-aaaa-4aaa-8aaa-888888888888';
const LEASE_ID = '12121212-1212-4212-8212-121212121212';
const SCHEDULE_ONE_ID = '13131313-1313-4313-8313-131313131313';
const SCHEDULE_TWO_ID = '14141414-1414-4414-8414-141414141414';
const SCHEDULE_OTHER_ID = '15151515-1515-4515-8515-151515151515';
const LEAD_ONE_ID = '16161616-1616-4616-8616-161616161616';
const LEAD_TWO_ID = '17171717-1717-4717-8717-171717171717';
const LEAD_THREE_ID = '18181818-1818-4818-8818-181818181818';
const LEAD_FOUR_ID = '19191919-1919-4919-8919-191919191919';
const LEAD_OTHER_ID = '20202020-2020-4020-8020-202020202020';

const LIMITED_PERMISSIONS = ['dashboard.view', 'leads.view'];
const NO_DASHBOARD_PERMISSIONS = ['leads.view'];

const PERMISSION_ROWS = [
  ...new Set([...LIMITED_PERMISSIONS, ...NO_DASHBOARD_PERMISSIONS]),
].map((key, index) => ({
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

const pad = (value) => String(value).padStart(2, '0');

function dateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function currentMonthDay(day) {
  const date = new Date();
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(day)}`;
}

function previousMonthDay(day) {
  const date = new Date();
  const previous = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, day));
  return previous.toISOString().slice(0, 10);
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
    project_id: PROJECT_ONE_ID,
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

function saleRow(overrides) {
  return {
    company_id: COMPANY_ID,
    customer_id: CUSTOMER_ID,
    unit_id: UNIT_ONE_ID,
    salesperson_id: ADMIN_ID,
    number: 'SAL-2026-00001',
    agreement_date: dateOffset(-2),
    sale_price: 100000,
    discount: 0,
    tax: 0,
    net_price: 100000,
    collected_amount: 0,
    payment_type: 'installments',
    status: 'active',
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function planRow(overrides) {
  return {
    company_id: COMPANY_ID,
    sale_id: SALE_ONE_ID,
    number_of_installments: 2,
    down_payment: 0,
    frequency: 'monthly',
    start_date: dateOffset(-60),
    due_day: 5,
    grace_days: 0,
    late_fee_type: 'none',
    late_fee_value: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function installmentRow(overrides) {
  return {
    company_id: COMPANY_ID,
    plan_id: PLAN_ONE_ID,
    sale_id: SALE_ONE_ID,
    sequence: 1,
    due_date: dateOffset(-40),
    amount: 1000,
    paid_amount: 200,
    late_fee: 0,
    status: 'upcoming',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function receiptRow(overrides) {
  return {
    company_id: COMPANY_ID,
    customer_id: CUSTOMER_ID,
    tenant_id: null,
    number: 'RCP-2026-00001',
    received_on: currentMonthDay(1),
    amount: 0,
    status: 'completed',
    reference: null,
    notes: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function allocationRow(overrides) {
  return {
    company_id: COMPANY_ID,
    receipt_id: RECEIPT_ONE_ID,
    installment_id: INSTALLMENT_ONE_ID,
    rent_schedule_id: null,
    amount: 300,
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
    national_id_type: null,
    national_id_number: null,
    date_of_birth: null,
    occupation: null,
    address: null,
    city: null,
    country: null,
    notes: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function leaseRow(overrides) {
  return {
    company_id: COMPANY_ID,
    tenant_id: '31313131-3131-4131-8131-313131313131',
    unit_id: UNIT_FOUR_ID,
    number: 'LSE-2026-00001',
    start_date: dateOffset(-120),
    end_date: dateOffset(240),
    frequency: 'monthly',
    rent_amount: 1500,
    due_day: 1,
    grace_days: 0,
    late_fee_type: 'none',
    late_fee_value: 0,
    notice_period_days: 0,
    security_deposit_amount: 3000,
    utilities_included: [],
    terms: null,
    status: 'active',
    previous_lease_id: null,
    termination_date: null,
    termination_reason: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function scheduleRow(overrides) {
  return {
    company_id: COMPANY_ID,
    lease_id: LEASE_ID,
    sequence: 1,
    period_label: 'Month 1',
    period_start: currentMonthDay(1),
    period_end: currentMonthDay(28),
    due_date: currentMonthDay(1),
    rent_amount: 2000,
    adjustments: 0,
    late_fee: 0,
    paid_amount: 800,
    status: 'upcoming',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function leadRow(overrides) {
  return {
    company_id: COMPANY_ID,
    name: 'Priya Nair',
    phone: '555-0100',
    email: null,
    source_id: null,
    assigned_to: null,
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
    ...overrides,
  };
}

function cookieFrom(response, name) {
  const header = response.headers['set-cookie'] || [];
  const match = header.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split(';')[0].slice(name.length + 1));
}

const ROUTE_REPOSITORY_METHODS = new Set(['listUnitStatusCounts', 'writeAudit']);

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
  const limitedHash = await hashPassword('LimitedPass123');
  const noDashboardHash = await hashPassword('NoDashboardPass123');

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
        id: LIMITED_ID,
        company_id: COMPANY_ID,
        name: 'Casey Reed',
        email: 'casey@meridian-estates.test',
        password_hash: limitedHash,
        full_access: false,
        is_active: true,
      },
      {
        id: NO_DASHBOARD_ID,
        company_id: COMPANY_ID,
        name: 'No Dash',
        email: 'nodash@meridian-estates.test',
        password_hash: noDashboardHash,
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
        id: LIMITED_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Limited',
        description: '',
        is_default: false,
      },
      {
        id: NO_DASHBOARD_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'No dashboard',
        description: '',
        is_default: false,
      },
    ],
    userRoles: [
      { user_id: ADMIN_ID, role_id: ADMIN_ROLE_ID },
      { user_id: LIMITED_ID, role_id: LIMITED_ROLE_ID },
      { user_id: NO_DASHBOARD_ID, role_id: NO_DASHBOARD_ROLE_ID },
    ],
    rolePermissions: [
      ...LIMITED_PERMISSIONS.map((key) => ({ role_id: LIMITED_ROLE_ID, permission_key: key })),
      ...NO_DASHBOARD_PERMISSIONS.map((key) => ({
        role_id: NO_DASHBOARD_ROLE_ID,
        permission_key: key,
      })),
    ],
    permissions: PERMISSION_ROWS,
  });

  const adminRepository = new MemoryAdminRepository({
    companies: [company, otherCompany],
    settings: [{ company_id: COMPANY_ID }],
    projects: [
      projectRow({ id: PROJECT_ONE_ID }),
      projectRow({
        id: PROJECT_TWO_ID,
        number: 'PRJ-0002',
        name: 'Lakeview Heights',
        code: 'LAKE',
        slug: 'lakeview-heights',
      }),
      projectRow({
        id: OTHER_PROJECT_ID,
        company_id: OTHER_COMPANY_ID,
        number: 'PRJ-9000',
        name: 'Other Project',
        code: 'OTHER',
        slug: 'other-project',
      }),
    ],
    units: [
      unitRow({ id: UNIT_ONE_ID, status: 'available' }),
      unitRow({ id: UNIT_TWO_ID, unit_number: 'A-102', status: 'available' }),
      unitRow({ id: UNIT_THREE_ID, unit_number: 'A-103', status: 'sold' }),
      unitRow({
        id: UNIT_FOUR_ID,
        unit_number: 'B-101',
        project_id: PROJECT_TWO_ID,
        status: 'rented',
      }),
      unitRow({
        id: OTHER_UNIT_ID,
        company_id: OTHER_COMPANY_ID,
        project_id: OTHER_PROJECT_ID,
        unit_number: 'X-101',
      }),
    ],
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
      {
        id: OTHER_CUSTOMER_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Customer',
        phone: '555-0199',
        email: null,
        type: 'individual',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ],
    sales: [
      saleRow({ id: SALE_ONE_ID }),
      saleRow({
        id: SALE_TWO_ID,
        number: 'SAL-2026-00002',
        unit_id: UNIT_THREE_ID,
        agreement_date: dateOffset(-1),
        net_price: 80000,
      }),
      saleRow({
        id: SALE_CANCELLED_ID,
        number: 'SAL-2026-00004',
        unit_id: UNIT_THREE_ID,
        agreement_date: dateOffset(0),
        net_price: 60000,
        status: 'cancelled',
      }),
      saleRow({
        id: OTHER_SALE_ID,
        company_id: OTHER_COMPANY_ID,
        customer_id: OTHER_CUSTOMER_ID,
        unit_id: OTHER_UNIT_ID,
        number: 'SAL-2026-90001',
        net_price: 50000,
      }),
    ],
    installmentPlans: [
      planRow({ id: PLAN_ONE_ID, sale_id: SALE_ONE_ID }),
      planRow({ id: PLAN_TWO_ID, sale_id: SALE_TWO_ID, number_of_installments: 1 }),
      planRow({ id: PLAN_OTHER_ID, sale_id: OTHER_SALE_ID, company_id: OTHER_COMPANY_ID }),
    ],
    installments: [
      installmentRow({ id: INSTALLMENT_ONE_ID }),
      installmentRow({
        id: INSTALLMENT_TWO_ID,
        sequence: 2,
        due_date: dateOffset(10),
        amount: 700,
        paid_amount: 0,
      }),
      installmentRow({
        id: INSTALLMENT_THREE_ID,
        plan_id: PLAN_TWO_ID,
        sale_id: SALE_TWO_ID,
        due_date: currentMonthDay(1),
        amount: 500,
        paid_amount: 500,
      }),
      installmentRow({
        id: OTHER_INSTALLMENT_ID,
        company_id: OTHER_COMPANY_ID,
        plan_id: PLAN_OTHER_ID,
        sale_id: OTHER_SALE_ID,
        due_date: dateOffset(-40),
        amount: 9000,
        paid_amount: 0,
      }),
    ],
    receipts: [
      receiptRow({ id: RECEIPT_ONE_ID, number: 'RCP-2026-00001', amount: 300 }),
      receiptRow({ id: RECEIPT_TWO_ID, number: 'RCP-2026-00002', amount: 500 }),
      receiptRow({
        id: RECEIPT_THREE_ID,
        number: 'RCP-2026-00003',
        amount: 250,
        status: 'voided',
      }),
      receiptRow({
        id: RECEIPT_FOUR_ID,
        number: 'RCP-2026-00004',
        amount: 300,
        received_on: previousMonthDay(15),
      }),
      receiptRow({
        id: RECEIPT_RENT_ID,
        number: 'RCP-2026-00005',
        tenant_id: '31313131-3131-4131-8131-313131313131',
        amount: 800,
      }),
      receiptRow({
        id: RECEIPT_VOID_ID,
        number: 'RCP-2026-00006',
        tenant_id: '31313131-3131-4131-8131-313131313131',
        amount: 200,
        status: 'voided',
      }),
      receiptRow({
        id: RECEIPT_PREVIOUS_ID,
        number: 'RCP-2026-00007',
        tenant_id: '31313131-3131-4131-8131-313131313131',
        amount: 300,
        received_on: previousMonthDay(10),
      }),
      receiptRow({
        id: RECEIPT_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        customer_id: OTHER_CUSTOMER_ID,
        number: 'RCP-2026-90001',
        amount: 9000,
      }),
    ],
    receiptAllocations: [
      allocationRow({ receipt_id: RECEIPT_ONE_ID, installment_id: INSTALLMENT_ONE_ID, amount: 300 }),
      allocationRow({ receipt_id: RECEIPT_TWO_ID, installment_id: INSTALLMENT_THREE_ID, amount: 500 }),
      allocationRow({ receipt_id: RECEIPT_THREE_ID, installment_id: INSTALLMENT_TWO_ID, amount: 250 }),
      allocationRow({ receipt_id: RECEIPT_FOUR_ID, installment_id: INSTALLMENT_ONE_ID, amount: 300 }),
      allocationRow({
        receipt_id: RECEIPT_RENT_ID,
        installment_id: null,
        rent_schedule_id: SCHEDULE_ONE_ID,
        amount: 800,
      }),
      allocationRow({
        receipt_id: RECEIPT_VOID_ID,
        installment_id: null,
        rent_schedule_id: SCHEDULE_TWO_ID,
        amount: 200,
      }),
      allocationRow({
        receipt_id: RECEIPT_PREVIOUS_ID,
        installment_id: null,
        rent_schedule_id: SCHEDULE_ONE_ID,
        amount: 300,
      }),
      allocationRow({
        receipt_id: RECEIPT_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        installment_id: OTHER_INSTALLMENT_ID,
        amount: 9000,
      }),
    ],
    tenants: [
      tenantRow({ id: '31313131-3131-4131-8131-313131313131', name: 'Rohan Kapoor' }),
    ],
    leases: [leaseRow({ id: LEASE_ID })],
    rentSchedules: [
      scheduleRow({ id: SCHEDULE_ONE_ID }),
      scheduleRow({
        id: SCHEDULE_TWO_ID,
        sequence: 2,
        period_label: 'Month 2',
        period_start: currentMonthDay(2),
        period_end: currentMonthDay(28),
        due_date: currentMonthDay(5),
        rent_amount: 1000,
        paid_amount: 0,
      }),
      scheduleRow({
        id: SCHEDULE_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        lease_id: LEASE_ID,
        due_date: currentMonthDay(1),
        rent_amount: 4000,
        paid_amount: 0,
      }),
    ],
    leads: [
      leadRow({ id: LEAD_ONE_ID }),
      leadRow({ id: LEAD_TWO_ID, name: 'Second Lead', status: 'new' }),
      leadRow({ id: LEAD_THREE_ID, name: 'Third Lead', status: 'contacted' }),
      leadRow({ id: LEAD_FOUR_ID, name: 'Fourth Lead', status: 'won' }),
      leadRow({
        id: LEAD_OTHER_ID,
        company_id: OTHER_COMPANY_ID,
        name: 'Other Lead',
        status: 'lost',
        lost_reason: 'Budget',
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
        id: LIMITED_ID,
        company_id: COMPANY_ID,
        name: 'Casey Reed',
        email: 'casey@meridian-estates.test',
        branch_id: null,
        full_access: false,
        is_active: true,
        roles: [{ id: LIMITED_ROLE_ID, name: 'Limited' }],
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
        id: LIMITED_ROLE_ID,
        company_id: COMPANY_ID,
        name: 'Limited',
        description: '',
        is_default: false,
      },
    ],
    rolePermissions: {
      [ADMIN_ROLE_ID]: [...LIMITED_PERMISSIONS],
      [LIMITED_ROLE_ID]: [...LIMITED_PERMISSIONS],
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

describe('dashboard routes', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await makeApp());
  });

  it('requires a session', async () => {
    await request(app).get('/api/dashboard').expect(401);
  });

  it('requires dashboard.view', async () => {
    const { agent } = await login(app, 'nodash@meridian-estates.test', 'NoDashboardPass123');
    const response = await agent.get('/api/dashboard').expect(403);
    expect(response.body.error).toMatch(/permission/i);
  });

  it('returns KPIs and lists backed by the company data', async () => {
    const { agent } = await login(app, 'jordan@meridian-estates.test', 'AdminPass123');
    const response = await agent.get('/api/dashboard').expect(200);
    const data = response.body.data;

    expect(data.sections).toMatchObject({
      sales: true,
      rent: true,
      inventory: true,
      projects: true,
      pipeline: true,
    });

    const kpi = Object.fromEntries(data.kpis.map((row) => [row.key, row]));
    expect(kpi.sales_collected.value).toBe(800);
    expect(kpi.sales_collected.count).toBe(2);
    expect(kpi.overdue_installments.value).toBe(800);
    expect(kpi.overdue_installments.count).toBe(1);
    expect(kpi.rent_collected.value).toBe(800);
    expect(kpi.rent_collected.count).toBe(1);
    expect(kpi.rent_collected.percent).toBe(27);
    expect(kpi.available_units.value).toBe(2);
    expect(kpi.available_units.total).toBe(4);

    expect(data.inventory.total).toBe(4);
    expect(data.inventory.by_status).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'available', count: 2 }),
        expect.objectContaining({ status: 'sold', count: 1 }),
        expect.objectContaining({ status: 'rented', count: 1 }),
      ]),
    );

    expect(data.installments_due).toHaveLength(2);
    expect(data.installments_due[0]).toMatchObject({
      id: INSTALLMENT_ONE_ID,
      status: 'overdue',
      balance: 800,
    });
    expect(data.installments_due[0].sale.number).toBe('SAL-2026-00001');

    expect(data.recent_sales).toHaveLength(2);
    expect(data.recent_sales[0].number).toBe('SAL-2026-00002');
    expect(data.recent_sales.some((row) => row.status === 'cancelled')).toBe(false);

    expect(data.project_progress).toHaveLength(2);
    const harbor = data.project_progress.find((row) => row.id === PROJECT_ONE_ID);
    expect(harbor).toMatchObject({
      units_count: 3,
      available_units: 2,
      sold_units: 1,
      rented_units: 0,
      percent: 33,
    });
    const lakeview = data.project_progress.find((row) => row.id === PROJECT_TWO_ID);
    expect(lakeview.percent).toBe(100);

    const pipeline = Object.fromEntries(data.lead_pipeline.map((row) => [row.stage, row.count]));
    expect(pipeline.new).toBe(2);
    expect(pipeline.contacted).toBe(1);
    expect(pipeline.won).toBe(1);
    expect(pipeline.lost).toBe(0);
    expect(data.lead_pipeline.reduce((sum, row) => sum + row.count, 0)).toBe(4);
  });

  it('omits sections the signed-in user cannot see', async () => {
    const { agent } = await login(app, 'casey@meridian-estates.test', 'LimitedPass123');
    const response = await agent.get('/api/dashboard').expect(200);
    const data = response.body.data;

    expect(data.sections).toMatchObject({
      sales: false,
      rent: false,
      inventory: false,
      projects: false,
      pipeline: true,
    });
    expect(data.kpis).toEqual([]);
    expect(data.installments_due).toEqual([]);
    expect(data.recent_sales).toEqual([]);
    expect(data.project_progress).toEqual([]);
    expect(data.inventory).toBeNull();
    expect(data.lead_pipeline).toHaveLength(7);
    expect(data.lead_pipeline.find((row) => row.stage === 'new').count).toBe(2);
  });
});
