import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import {
  nullableString,
  nullableUuid,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import {
  VISIT_STATUSES,
  canTransitionVisit,
  visitTransitionMessage,
} from '../lib/crm.js';
import {
  loadProject,
  loadTeamMember,
  loadUnit,
  requireCustomer,
  requireLead,
} from './crmSupport.js';

const scheduledAt = z.preprocess(
  (value) => (value === undefined || value === null ? '' : value),
  z
    .string()
    .trim()
    .min(1, 'Choose the visit date and time.')
    .refine((value) => !Number.isNaN(Date.parse(value)), 'Choose a valid date and time.'),
);

const visitFields = {
  lead_id: nullableUuid(),
  customer_id: nullableUuid(),
  project_id: z.string().uuid('Choose a project.'),
  unit_id: nullableUuid(),
  salesperson_id: nullableUuid(),
  scheduled_at: scheduledAt,
  status: z.enum(VISIT_STATUSES, { message: 'Choose a visit status.' }),
  notes: nullableString(2000),
};

const createVisitSchema = z
  .object({
    ...visitFields,
    status: visitFields.status.default('scheduled'),
  })
  .superRefine((data, ctx) => {
    if (!data.lead_id && !data.customer_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['lead_id'],
        message: 'Choose a lead or a customer.',
      });
    }
  });

const updateVisitSchema = z.object(
  Object.fromEntries(
    Object.entries(visitFields).map(([key, schema]) => [key, schema.optional()]),
  ),
);

const VISIT_FIELDS = [
  'lead_id',
  'customer_id',
  'project_id',
  'unit_id',
  'salesperson_id',
  'scheduled_at',
  'status',
  'notes',
];

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));
}

function assertParty(leadId, customerId) {
  if (!leadId && !customerId) {
    throw validationError({ lead_id: 'Choose a lead or a customer.' });
  }
}

async function validateVisitLinks(repository, companyId, input) {
  if (input.lead_id) await requireLead(repository, companyId, input.lead_id);
  if (input.customer_id) await requireCustomer(repository, companyId, input.customer_id);
  await loadProject(repository, companyId, input.project_id);
  if (input.unit_id) {
    const unit = await loadUnit(repository, companyId, input.unit_id);
    if (unit.project_id !== input.project_id) {
      throw validationError({ unit_id: 'Choose a unit from the selected project.' });
    }
  }
  await loadTeamMember(repository, companyId, input.salesperson_id, 'salesperson_id');
}

export function createVisitsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('visits.view')];
  const create = [auth.requireAuth, auth.requirePermission('visits.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('visits.edit'), auth.requireCsrf];
  const remove = [auth.requireAuth, auth.requirePermission('visits.delete'), auth.requireCsrf];

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
      const when = String(req.query.when || '');
      const status = String(req.query.status || '');
      const projectId = String(req.query.project_id || '');
      const salespersonId = String(req.query.salesperson_id || '');
      const leadId = String(req.query.lead_id || '');
      const customerId = String(req.query.customer_id || '');

      let rows = await repository.listVisits(companyId);
      if (when === 'upcoming') {
        rows = rows.filter((visit) => Date.parse(visit.scheduled_at) >= Date.now());
      }
      if (when === 'past') {
        rows = rows.filter((visit) => Date.parse(visit.scheduled_at) < Date.now());
      }
      if (status) rows = rows.filter((visit) => visit.status === status);
      if (projectId) rows = rows.filter((visit) => visit.project_id === projectId);
      if (salespersonId) rows = rows.filter((visit) => visit.salesperson_id === salespersonId);
      if (leadId) rows = rows.filter((visit) => visit.lead_id === leadId);
      if (customerId) rows = rows.filter((visit) => visit.customer_id === customerId);

      res.json(paginated(rows.slice(from, to + 1), rows.length, page, limit));
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const visit = await repository.getVisit(req.auth.company.id, req.params.id);
      if (!visit) throw new ApiError(404, 'Visit not found.');
      res.json({ data: visit });
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createVisitSchema, req.body);
      assertParty(input.lead_id, input.customer_id);
      await validateVisitLinks(repository, companyId, input);

      const visit = await repository.createVisit(companyId, {
        ...input,
        created_by: req.auth.user.id,
      });
      await writeAudit(req, 'Visit', visit.id, 'created', null, pick(visit, VISIT_FIELDS));
      res.status(201).json({ data: visit });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const before = await repository.getVisit(companyId, req.params.id);
      if (!before) throw new ApiError(404, 'Visit not found.');
      const input = parseBody(updateVisitSchema, req.body);
      const merged = { ...before, ...input };
      assertParty(merged.lead_id, merged.customer_id);
      await validateVisitLinks(repository, companyId, merged);

      if (input.status && !canTransitionVisit(before.status, input.status)) {
        throw validationError({ status: visitTransitionMessage(input.status) });
      }

      const visit = await repository.updateVisit(companyId, before.id, input);
      await writeAudit(
        req,
        'Visit',
        visit.id,
        input.status && input.status !== before.status ? 'status_changed' : 'updated',
        pick(before, VISIT_FIELDS),
        pick(visit, VISIT_FIELDS),
      );
      res.json({ data: visit });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const visit = await repository.getVisit(companyId, req.params.id);
      if (!visit) throw new ApiError(404, 'Visit not found.');
      await repository.deleteVisit(companyId, visit.id);
      await writeAudit(req, 'Visit', visit.id, 'deleted', pick(visit, VISIT_FIELDS), null);
      res.json({ data: { id: visit.id } });
    }),
  );

  return router;
}

export default createVisitsRouter;
