import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import {
  nullableDate,
  nullableString,
  nullableUuid,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { QUOTATION_STATUSES, quotationTotals } from '../lib/sales.js';
import { loadCustomer, matchesSearch, todayIso } from './salesSupport.js';

const money = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);

const baseFields = {
  customer_id: nullableUuid(),
  lead_id: nullableUuid(),
  unit_id: z.string().uuid('Choose a unit.'),
  salesperson_id: nullableUuid(),
  quotation_date: nullableDate(),
  valid_until: nullableDate(),
  unit_price: money,
  discount_amount: money,
  tax_amount: money,
  terms: nullableString(5000),
  status: z.enum(['draft', 'sent']).default('draft'),
};

const createSchema = z.object(baseFields);
const updateSchema = z.object(
  Object.fromEntries(
    Object.entries(baseFields)
      .filter(([key]) => key !== 'status')
      .map(([key, schema]) => [key, schema.optional()]),
  ),
);
const statusSchema = z.object({
  status: z.enum(QUOTATION_STATUSES, { message: 'Choose a quotation status.' }),
});

const EDITABLE_FIELDS = [
  'customer_id',
  'lead_id',
  'unit_id',
  'salesperson_id',
  'quotation_date',
  'valid_until',
  'unit_price',
  'discount_amount',
  'tax_amount',
  'terms',
  'status',
];

const TRANSITIONS = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: ['converted'],
  rejected: [],
  expired: [],
  converted: [],
};

const STATUS_LABELS = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
  converted: 'Converted',
};

export function createQuotationsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('quotations.view')];
  const create = [auth.requireAuth, auth.requirePermission('quotations.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('quotations.edit'), auth.requireCsrf];
  const remove = [auth.requireAuth, auth.requirePermission('quotations.delete'), auth.requireCsrf];

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

  async function requireQuotation(companyId, id) {
    const quotation = await repository.getQuotation(companyId, id);
    if (!quotation) throw new ApiError(404, 'Quotation not found.');
    return quotation;
  }

  async function validateLinks(companyId, input) {
    if (!input.customer_id && !input.lead_id) {
      throw validationError({ customer_id: 'Choose a customer or a lead.' });
    }
    if (input.customer_id && input.lead_id) {
      throw validationError({ lead_id: 'Choose a customer or a lead, not both.' });
    }
    await loadCustomer(repository, companyId, input.customer_id);
    if (input.lead_id) {
      const lead = await repository.getLead(companyId, input.lead_id);
      if (!lead) {
        throw validationError({ lead_id: 'Choose a lead from this company.' });
      }
    }

    const unit = await repository.getUnit(companyId, input.unit_id);
    if (!unit) {
      throw validationError({ unit_id: 'Choose a unit from this company.' });
    }

    if (input.salesperson_id) {
      const member = await repository.getTeamMember(companyId, input.salesperson_id);
      if (!member) {
        throw validationError({ salesperson_id: 'Choose a team member from this company.' });
      }
    }
    return unit;
  }

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit } = parsePagination(req.query, { defaultLimit: 20 });
      const filters = {
        search: String(req.query.search || '').trim(),
        status: String(req.query.status || '') || null,
        project_id: String(req.query.project_id || '') || null,
      };

      let rows = await repository.listQuotations(companyId);
      if (filters.status) rows = rows.filter((row) => row.status === filters.status);
      if (filters.project_id) {
        rows = rows.filter((row) => row.unit?.project_id === filters.project_id);
      }
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [
            row.number,
            row.customer?.name,
            row.lead?.name,
            row.unit?.unit_number,
          ]),
        );
      }

      const total = rows.length;
      const start = (page - 1) * limit;
      res.json(paginated(rows.slice(start, start + limit), total, page, limit));
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createSchema, req.body);
      await validateLinks(companyId, input);

      const number = await repository.nextDocumentNumber(companyId, 'quotation');
      const quotation = await repository.createQuotation(companyId, {
        ...input,
        number,
        quotation_date: input.quotation_date || todayIso(),
        status: input.status || 'draft',
        ...quotationTotals(input),
        created_by: req.auth.user.id,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, 'Quotation', quotation.id, 'created', null, {
        number: quotation.number,
        lead_id: quotation.lead_id,
        customer_id: quotation.customer_id,
        net_amount: quotation.net_amount,
      });
      res.status(201).json({ data: quotation });
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const quotation = await requireQuotation(req.auth.company.id, req.params.id);
      res.json({ data: quotation });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const quotation = await requireQuotation(companyId, req.params.id);
      if (Object.hasOwn(req.body || {}, 'status')) {
        throw validationError({
          status: 'Use the status action to change the quotation status.',
        });
      }
      if (quotation.status !== 'draft') {
        throw new ApiError(409, 'Only draft quotations can be edited.');
      }
      const input = parseBody(updateSchema, req.body);
      const merged = {
        ...quotation,
        ...input,
      };
      await validateLinks(companyId, merged);

      const patch = Object.fromEntries(
        EDITABLE_FIELDS.filter((field) => input[field] !== undefined).map((field) => [
          field,
          input[field],
        ]),
      );
      const updated = await repository.updateQuotation(companyId, quotation.id, {
        ...patch,
        ...quotationTotals(merged),
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, 'Quotation', quotation.id, 'updated', {
        net_amount: quotation.net_amount,
        status: quotation.status,
      }, {
        net_amount: updated.net_amount,
        status: updated.status,
      });
      res.json({ data: updated });
    }),
  );

  router.post(
    '/:id/status',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const quotation = await requireQuotation(companyId, req.params.id);
      const { status } = parseBody(statusSchema, req.body);
      if (status === quotation.status) {
        res.json({ data: quotation });
        return;
      }
      if (!(TRANSITIONS[quotation.status] || []).includes(status)) {
        throw new ApiError(
          422,
          `A ${STATUS_LABELS[quotation.status]} quotation cannot move to ${STATUS_LABELS[status]}.`,
        );
      }
      const updated = await repository.updateQuotation(companyId, quotation.id, {
        status,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, 'Quotation', quotation.id, 'status_changed', {
        status: quotation.status,
      }, { status: updated.status });
      res.json({ data: updated });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const quotation = await requireQuotation(companyId, req.params.id);
      if (quotation.status !== 'draft') {
        throw new ApiError(409, 'Only draft quotations can be deleted.');
      }
      await repository.deleteQuotation(companyId, quotation.id);
      await writeAudit(req, 'Quotation', quotation.id, 'deleted', {
        number: quotation.number,
      }, null);
      res.json({ data: { id: quotation.id } });
    }),
  );

  return router;
}

export default createQuotationsRouter;
