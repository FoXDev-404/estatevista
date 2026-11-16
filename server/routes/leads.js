import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import {
  nullableDateTime,
  nullableEmail,
  nullableString,
  nullableUuid,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import {
  FOLLOWUP_TYPES,
  LEAD_OPEN_STATUSES,
  LEAD_STATUSES,
} from '../lib/crm.js';
import {
  loadSource,
  loadTeamMember,
  requireLead,
  resolveProjectUnit,
} from './crmSupport.js';

const emptyToNull = (value) => (value === '' || value === undefined ? null : value);
const nullableBudget = z.preprocess(
  emptyToNull,
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.').nullable(),
);

const leadFields = {
  name: z.string().trim().min(1, 'Enter the lead name.').max(160),
  phone: nullableString(40),
  email: nullableEmail(),
  source_id: nullableUuid(),
  assigned_to: nullableUuid(),
  project_id: nullableUuid(),
  unit_id: nullableUuid(),
  status: z.enum(LEAD_STATUSES, { message: 'Choose a lead stage.' }),
  lost_reason: nullableString(500),
  budget_min: nullableBudget,
  budget_max: nullableBudget,
  notes: nullableString(2000),
};

const createLeadSchema = z
  .object({
    ...leadFields,
    status: leadFields.status.default('new'),
  })
  .superRefine((data, ctx) => {
    if (!data.phone && !data.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a phone number or an email address.',
      });
    }
    if (data.status === 'lost' && !String(data.lost_reason || '').trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['lost_reason'],
        message: 'Explain why this lead was lost.',
      });
    }
  });

const updateLeadSchema = z.object(
  Object.fromEntries(Object.entries(leadFields).map(([key, schema]) => [key, schema.optional()])),
);

const statusSchema = z.object({
  status: z.enum(LEAD_STATUSES, { message: 'Choose a lead stage.' }),
  lost_reason: nullableString(500),
});

const followupCreateSchema = z.object({
  type: z.enum(FOLLOWUP_TYPES, { message: 'Choose a follow-up type.' }).default('note'),
  scheduled_at: nullableDateTime(),
  notes: nullableString(2000),
});

const followupUpdateSchema = z.object({
  type: z.enum(FOLLOWUP_TYPES, { message: 'Choose a follow-up type.' }).optional(),
  scheduled_at: nullableDateTime().optional(),
  notes: nullableString(2000).optional(),
  outcome: nullableString(2000).optional(),
  completed: z.boolean().optional(),
});

const LEAD_FIELDS = [
  'name',
  'phone',
  'email',
  'source_id',
  'assigned_to',
  'project_id',
  'unit_id',
  'status',
  'lost_reason',
  'budget_min',
  'budget_max',
  'notes',
];

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));
}

function assertContact(phone, email) {
  if (!phone && !email) {
    throw validationError({ phone: 'Enter a phone number or an email address.' });
  }
}

function assertLostReason(status, lostReason) {
  if (status === 'lost' && !String(lostReason || '').trim()) {
    throw validationError({ lost_reason: 'Explain why this lead was lost.' });
  }
}

function assertBudget(min, max) {
  if (min !== null && max !== null && Number(min) > Number(max)) {
    throw validationError({ budget_max: 'The maximum budget must be at least the minimum.' });
  }
}

async function validateLeadLinks(repository, companyId, input) {
  await loadSource(repository, companyId, input.source_id);
  await loadTeamMember(repository, companyId, input.assigned_to, 'assigned_to');
  return resolveProjectUnit(repository, companyId, input);
}

export function createLeadsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('leads.view')];
  const create = [auth.requireAuth, auth.requirePermission('leads.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('leads.edit'), auth.requireCsrf];
  const remove = [auth.requireAuth, auth.requirePermission('leads.delete'), auth.requireCsrf];
  const convert = [
    auth.requireAuth,
    auth.requirePermission('leads.edit'),
    auth.requirePermission('customers.create'),
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
      const status = String(req.query.status || '');
      const sourceId = String(req.query.source_id || '');
      const assignedTo = String(req.query.assigned_to || '');
      const projectId = String(req.query.project_id || '');

      let rows = await repository.listLeads(companyId);
      if (search) {
        rows = rows.filter((lead) =>
          [lead.name, lead.phone, lead.email]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search)),
        );
      }
      if (status === 'open') {
        rows = rows.filter((lead) => LEAD_OPEN_STATUSES.includes(lead.status));
      } else if (status) {
        rows = rows.filter((lead) => lead.status === status);
      }
      if (sourceId) rows = rows.filter((lead) => lead.source_id === sourceId);
      if (assignedTo) rows = rows.filter((lead) => lead.assigned_to === assignedTo);
      if (projectId) rows = rows.filter((lead) => lead.project_id === projectId);

      res.json(paginated(rows.slice(from, to + 1), rows.length, page, limit));
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lead = await requireLead(repository, companyId, req.params.id);
      lead.followups = await repository.listLeadFollowups(companyId, lead.id);
      lead.visits = (await repository.listVisits(companyId)).filter(
        (visit) => visit.lead_id === lead.id,
      );
      const customer = await repository.findCustomerByLead(companyId, lead.id);
      lead.customer = customer ? { id: customer.id, name: customer.name } : null;
      res.json({ data: lead });
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createLeadSchema, req.body);
      assertContact(input.phone, input.email);
      assertLostReason(input.status, input.lost_reason);
      assertBudget(input.budget_min, input.budget_max);
      const validated = await validateLeadLinks(repository, companyId, input);

      const lead = await repository.createLead(companyId, {
        ...validated,
        lost_reason: validated.status === 'lost' ? validated.lost_reason : null,
        created_by: req.auth.user.id,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, 'Lead', lead.id, 'created', null, pick(lead, LEAD_FIELDS));
      res.status(201).json({ data: lead });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const before = await requireLead(repository, companyId, req.params.id);
      const input = parseBody(updateLeadSchema, req.body);
      const merged = { ...before, ...input };
      assertContact(merged.phone, merged.email);
      assertLostReason(merged.status, merged.lost_reason);
      assertBudget(merged.budget_min, merged.budget_max);
      const validated = await validateLeadLinks(repository, companyId, merged);

      const patch = { ...input, updated_by: req.auth.user.id };
      if (input.project_id !== undefined || input.unit_id !== undefined) {
        patch.project_id = validated.project_id;
      }
      if (input.status !== undefined || input.lost_reason !== undefined) {
        patch.lost_reason = merged.status === 'lost' ? merged.lost_reason : null;
      }

      const lead = await repository.updateLead(companyId, before.id, patch);
      await writeAudit(
        req,
        'Lead',
        lead.id,
        'updated',
        pick(before, LEAD_FIELDS),
        pick(lead, LEAD_FIELDS),
      );
      res.json({ data: lead });
    }),
  );

  router.post(
    '/:id/status',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const before = await requireLead(repository, companyId, req.params.id);
      const input = parseBody(statusSchema, req.body);
      assertLostReason(input.status, input.lost_reason ?? before.lost_reason);

      const lead = await repository.updateLead(companyId, before.id, {
        status: input.status,
        lost_reason: input.status === 'lost' ? input.lost_reason ?? before.lost_reason : null,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, 'Lead', lead.id, 'status_changed', before.status, lead.status);
      res.json({ data: lead });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lead = await requireLead(repository, companyId, req.params.id);
      await repository.deleteLead(companyId, lead.id);
      await writeAudit(req, 'Lead', lead.id, 'deleted', pick(lead, LEAD_FIELDS), null);
      res.json({ data: { id: lead.id } });
    }),
  );

  router.post(
    '/:id/followups',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lead = await requireLead(repository, companyId, req.params.id);
      const input = parseBody(followupCreateSchema, req.body);

      const followup = await repository.createLeadFollowup(companyId, lead.id, {
        ...input,
        created_by: req.auth.user.id,
      });
      await writeAudit(req, 'Lead', lead.id, 'followup_added', null, {
        followup_id: followup.id,
        type: followup.type,
        scheduled_at: followup.scheduled_at,
      });
      res.status(201).json({ data: followup });
    }),
  );

  router.patch(
    '/:id/followups/:followupId',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lead = await requireLead(repository, companyId, req.params.id);
      const input = parseBody(followupUpdateSchema, req.body);

      const patch = { ...input };
      delete patch.completed;
      if (input.completed === false) {
        patch.completed_at = null;
      } else if (input.completed === true || input.outcome !== undefined) {
        patch.completed_at = new Date().toISOString();
      }

      const followup = await repository.updateLeadFollowup(
        companyId,
        lead.id,
        req.params.followupId,
        patch,
      );
      if (!followup) throw new ApiError(404, 'Follow-up not found.');
      await writeAudit(req, 'Lead', lead.id, 'followup_completed', null, {
        followup_id: followup.id,
        outcome: followup.outcome,
      });
      res.json({ data: followup });
    }),
  );

  router.post(
    '/:id/convert',
    ...convert,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lead = await requireLead(repository, companyId, req.params.id);
      if (await repository.findCustomerByLead(companyId, lead.id)) {
        throw new ApiError(409, 'This lead has already been converted to a customer.');
      }

      const customer = await repository.createCustomer(companyId, {
        lead_id: lead.id,
        source_id: lead.source_id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        type: 'individual',
        created_by: req.auth.user.id,
        updated_by: req.auth.user.id,
      });
      const updatedLead = await repository.updateLead(companyId, lead.id, {
        status: 'won',
        lost_reason: null,
        updated_by: req.auth.user.id,
      });

      await writeAudit(req, 'Customer', customer.id, 'created', null, {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        lead_id: lead.id,
      });
      await writeAudit(req, 'Lead', lead.id, 'converted', lead.status, {
        status: updatedLead.status,
        customer_id: customer.id,
      });
      res.status(201).json({ data: { lead: updatedLead, customer } });
    }),
  );

  return router;
}

export default createLeadsRouter;
