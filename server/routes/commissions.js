import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { booleanish, nullableUuid, parseBody } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import {
  COMMISSION_APPLICABILITIES,
  COMMISSION_STATUSES,
  COMMISSION_TRIGGERS,
} from '../lib/sales.js';
import { matchesSearch } from './salesSupport.js';

const money = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);

const ruleBase = {
  name: z.string().trim().min(1, 'Enter a rule name.').max(120),
  applicability: z.enum(COMMISSION_APPLICABILITIES).default('all'),
  project_id: nullableUuid(),
  unit_type_id: nullableUuid(),
  rate_type: z.enum(['percentage', 'fixed']).default('percentage'),
  rate_value: money,
  payable_trigger: z.enum(COMMISSION_TRIGGERS).default('sale'),
  is_active: booleanish.default(true),
};

const ruleCreateSchema = z.object(ruleBase);
const ruleUpdateSchema = z.object(
  Object.fromEntries(
    Object.entries(ruleBase).map(([key, schema]) => [key, schema.optional()]),
  ),
);

const ledgerUpdateSchema = z.object({
  status: z.enum(COMMISSION_STATUSES, { message: 'Choose a commission status.' }),
});

const LEDGER_TRANSITIONS = {
  pending: ['approved', 'cancelled'],
  approved: ['paid', 'cancelled'],
  paid: ['cancelled'],
  cancelled: [],
};

async function validateRule(repository, companyId, input) {
  if (input.applicability === 'project' && !input.project_id) {
    throw validationError({ project_id: 'Choose a project for this rule.' });
  }
  if (input.applicability === 'unit_type' && !input.unit_type_id) {
    throw validationError({ unit_type_id: 'Choose a unit type for this rule.' });
  }
  if (input.project_id) {
    const project = await repository.getProject(companyId, input.project_id);
    if (!project) {
      throw validationError({ project_id: 'Choose a project from this company.' });
    }
  }
  if (input.unit_type_id) {
    const unitType = await repository.getUnitType(companyId, input.unit_type_id);
    if (!unitType) {
      throw validationError({ unit_type_id: 'Choose a unit type from this company.' });
    }
  }
  if (input.rate_type === 'percentage' && Number(input.rate_value) > 100) {
    throw validationError({ rate_value: 'Use a percentage between 0 and 100.' });
  }
  const patch = { ...input };
  if (input.applicability === 'all') {
    patch.project_id = null;
    patch.unit_type_id = null;
  } else if (input.applicability === 'project') {
    patch.unit_type_id = null;
  } else if (input.applicability === 'unit_type') {
    patch.project_id = null;
  }
  return patch;
}

export function createCommissionsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('commissions.view')];
  const manage = [auth.requireAuth, auth.requirePermission('commissions.manage'), auth.requireCsrf];

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
    '/rules',
    ...view,
    asyncHandler(async (req, res) => {
      const rules = await repository.listCommissionRules(req.auth.company.id);
      res.json({ data: rules });
    }),
  );

  router.post(
    '/rules',
    ...manage,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(ruleCreateSchema, req.body);
      const patch = await validateRule(repository, companyId, input);
      const rule = await repository.createCommissionRule(companyId, {
        ...patch,
        is_active: input.is_active !== false,
      });
      await writeAudit(req, 'Commission rule', rule.id, 'created', null, {
        name: rule.name,
        rate_type: rule.rate_type,
        rate_value: rule.rate_value,
      });
      res.status(201).json({ data: rule });
    }),
  );

  router.patch(
    '/rules/:id',
    ...manage,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const rule = await repository.getCommissionRule(companyId, req.params.id);
      if (!rule) throw new ApiError(404, 'Commission rule not found.');
      const input = parseBody(ruleUpdateSchema, req.body);
      const merged = { ...rule, ...input };
      const patch = await validateRule(repository, companyId, merged);
      const updated = await repository.updateCommissionRule(companyId, rule.id, patch);
      await writeAudit(req, 'Commission rule', rule.id, 'updated', {
        name: rule.name,
        rate_value: rule.rate_value,
        is_active: rule.is_active,
      }, {
        name: updated.name,
        rate_value: updated.rate_value,
        is_active: updated.is_active,
      });
      res.json({ data: updated });
    }),
  );

  router.delete(
    '/rules/:id',
    ...manage,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const rule = await repository.getCommissionRule(companyId, req.params.id);
      if (!rule) throw new ApiError(404, 'Commission rule not found.');
      await repository.deleteCommissionRule(companyId, rule.id);
      await writeAudit(req, 'Commission rule', rule.id, 'deleted', {
        name: rule.name,
      }, null);
      res.json({ data: { id: rule.id } });
    }),
  );

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit } = parsePagination(req.query, { defaultLimit: 20 });
      const filters = {
        search: String(req.query.search || '').trim(),
        status: String(req.query.status || '') || null,
        salesperson_id: String(req.query.salesperson_id || '') || null,
      };
      let rows = await repository.listSalesCommissions(companyId);
      if (filters.status) rows = rows.filter((row) => row.status === filters.status);
      if (filters.salesperson_id) {
        rows = rows.filter((row) => row.salesperson_id === filters.salesperson_id);
      }
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [row.sale?.number, row.salesperson?.name, row.rule?.name]),
        );
      }
      const total = rows.length;
      const start = (page - 1) * limit;
      res.json(paginated(rows.slice(start, start + limit), total, page, limit));
    }),
  );

  router.patch(
    '/:id',
    ...manage,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const commission = await repository.getSalesCommission(companyId, req.params.id);
      if (!commission) throw new ApiError(404, 'Commission entry not found.');
      const { status } = parseBody(ledgerUpdateSchema, req.body);
      if (status !== commission.status && !(LEDGER_TRANSITIONS[commission.status] || []).includes(status)) {
        throw new ApiError(422, `A ${commission.status} commission cannot move to ${status}.`);
      }
      const patch = { status };
      if (status === 'approved') patch.approved_at = new Date().toISOString();
      if (status === 'paid') patch.paid_at = new Date().toISOString();
      const updated = await repository.updateSalesCommission(companyId, commission.id, patch);
      await writeAudit(req, 'Commission', commission.id, 'status_changed', {
        status: commission.status,
      }, { status: updated.status });
      res.json({ data: updated });
    }),
  );

  return router;
}

export default createCommissionsRouter;
