import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors.js';
import {
  booleanish,
  nullableDate,
  nullableEmail,
  nullableString,
  nullableUuid,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { CUSTOMER_TYPES } from '../lib/crm.js';
import { loadSource, requireCustomer } from './crmSupport.js';

const customerFields = {
  name: z.string().trim().min(1, 'Enter the customer name.').max(160),
  type: z.enum(CUSTOMER_TYPES, { message: 'Choose the customer type.' }),
  phone: z.string().trim().min(1, 'Enter the customer phone number.').max(40),
  alternate_phone: nullableString(40),
  email: nullableEmail(),
  national_id: nullableString(80),
  date_of_birth: nullableDate(),
  occupation: nullableString(120),
  address: nullableString(500),
  city: nullableString(120),
  country: nullableString(120),
  source_id: nullableUuid(),
  is_active: booleanish,
};

const createCustomerSchema = z.object({
  ...customerFields,
  type: customerFields.type.default('individual'),
  is_active: customerFields.is_active.default(true),
});

const updateCustomerSchema = z.object(
  Object.fromEntries(
    Object.entries(customerFields).map(([key, schema]) => [key, schema.optional()]),
  ),
);

const CUSTOMER_FIELDS = [
  'name',
  'type',
  'phone',
  'alternate_phone',
  'email',
  'national_id',
  'date_of_birth',
  'occupation',
  'address',
  'city',
  'country',
  'source_id',
  'is_active',
];

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));
}

export function createCustomersRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('customers.view')];
  const create = [auth.requireAuth, auth.requirePermission('customers.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('customers.edit'), auth.requireCsrf];
  const remove = [
    auth.requireAuth,
    auth.requirePermission('customers.delete'),
    auth.requireCsrf,
  ];

  const writeAudit = (req, module, recordId, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module,
      recordId,
      event,
      before,
      after,
      ip: clientIp(req),
    });

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit, from, to } = parsePagination(req.query, { defaultLimit: 20 });
      const search = String(req.query.search || '').trim().toLowerCase();
      const type = String(req.query.type || '');
      const status = String(req.query.status || '');
      const sourceId = String(req.query.source_id || '');

      let rows = await repository.listCustomers(companyId);
      if (search) {
        rows = rows.filter((customer) =>
          [customer.name, customer.phone, customer.email, customer.alternate_phone]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search)),
        );
      }
      if (type) rows = rows.filter((customer) => customer.type === type);
      if (status === 'active') rows = rows.filter((customer) => customer.is_active);
      if (status === 'inactive') rows = rows.filter((customer) => !customer.is_active);
      if (sourceId) rows = rows.filter((customer) => customer.source_id === sourceId);

      res.json(paginated(rows.slice(from, to + 1), rows.length, page, limit));
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const customer = await requireCustomer(repository, req.auth.company.id, req.params.id);
      res.json({ data: customer });
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createCustomerSchema, req.body);
      await loadSource(repository, companyId, input.source_id);

      const customer = await repository.createCustomer(companyId, {
        ...input,
        created_by: req.auth.user.id,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, 'Customer', customer.id, 'created', null, pick(customer, CUSTOMER_FIELDS));
      res.status(201).json({ data: customer });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const before = await requireCustomer(repository, companyId, req.params.id);
      const input = parseBody(updateCustomerSchema, req.body);
      await loadSource(repository, companyId, input.source_id);

      const customer = await repository.updateCustomer(companyId, before.id, {
        ...input,
        updated_by: req.auth.user.id,
      });
      await writeAudit(
        req,
        'Customer',
        customer.id,
        'updated',
        pick(before, CUSTOMER_FIELDS),
        pick(customer, CUSTOMER_FIELDS),
      );
      res.json({ data: customer });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const customer = await requireCustomer(repository, companyId, req.params.id);
      await repository.deleteCustomer(companyId, customer.id);
      await writeAudit(req, 'Customer', customer.id, 'deleted', pick(customer, CUSTOMER_FIELDS), null);
      res.json({ data: { id: customer.id } });
    }),
  );

  return router;
}

export default createCustomersRouter;
