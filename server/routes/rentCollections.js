import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { nullableDate, nullableString, parseBody } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { matchesSearch, requireTenant, todayIso } from './rentalSupport.js';

const money = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);

const createSchema = z.object({
  tenant_id: z.string().uuid('Choose a tenant.'),
  received_on: nullableDate(),
  amount: money,
  reference: nullableString(255),
  notes: nullableString(2000),
  allocations: z
    .array(
      z.object({
        rent_schedule_id: z.string().uuid('Choose a rent period.'),
        amount: money,
      }),
    )
    .min(1, 'Allocate the receipt to at least one rent period.'),
});

const voidSchema = z.object({
  reason: z.string().trim().min(1, 'Enter a reason for voiding this receipt.').max(500),
});

export function createRentCollectionsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('rent.view')];
  const collect = [auth.requireAuth, auth.requirePermission('rent.collect'), auth.requireCsrf];

  const writeAudit = (req, recordId, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module: 'Rent receipt',
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
      const { page, limit } = parsePagination(req.query, { defaultLimit: 20 });
      const filters = {
        search: String(req.query.search || '').trim(),
        tenant_id: String(req.query.tenant_id || '') || null,
        status: String(req.query.status || '') || null,
        date_from: String(req.query.date_from || '') || null,
        date_to: String(req.query.date_to || '') || null,
      };

      let rows = await repository.listRentReceipts(companyId);
      if (filters.tenant_id) rows = rows.filter((row) => row.tenant_id === filters.tenant_id);
      if (filters.status) rows = rows.filter((row) => row.status === filters.status);
      if (filters.date_from) rows = rows.filter((row) => row.received_on >= filters.date_from);
      if (filters.date_to) rows = rows.filter((row) => row.received_on <= filters.date_to);
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [row.number, row.tenant?.name, row.reference]),
        );
      }

      const total = rows.length;
      const start = (page - 1) * limit;
      res.json(paginated(rows.slice(start, start + limit), total, page, limit));
    }),
  );

  router.post(
    '/',
    ...collect,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createSchema, req.body);
      const tenant = await requireTenant(repository, companyId, input.tenant_id);
      if (Number(input.amount) <= 0) {
        throw validationError({ amount: 'Enter a receipt amount greater than zero.' });
      }

      const schedules = await repository.listRentSchedules(companyId);
      const byId = new Map(schedules.map((row) => [row.id, row]));
      const seen = new Set();
      let total = 0;
      for (const allocation of input.allocations) {
        if (Number(allocation.amount) <= 0) {
          throw validationError({ allocations: 'Allocation amounts must be greater than zero.' });
        }
        if (seen.has(allocation.rent_schedule_id)) {
          throw validationError({ allocations: 'Each rent period can only appear once.' });
        }
        seen.add(allocation.rent_schedule_id);

        const schedule = byId.get(allocation.rent_schedule_id);
        if (!schedule) {
          throw validationError({ allocations: 'Choose a rent period from this company.' });
        }
        if (schedule.tenant_id !== tenant.id) {
          throw validationError({
            allocations: 'The rent period belongs to a different tenant.',
          });
        }
        if (['waived', 'cancelled'].includes(schedule.status)) {
          throw validationError({ allocations: 'This rent period cannot receive a payment.' });
        }
        if (Number(allocation.amount) > Number(schedule.balance)) {
          const message = `The allocation exceeds the rent balance for ${schedule.lease_number || 'this lease'}.`;
          throw new ApiError(422, message, { allocations: message });
        }
        total += Number(allocation.amount);
      }

      if (Math.abs(total - Number(input.amount)) > 0.005) {
        throw validationError({ allocations: 'Allocations must equal the receipt amount.' });
      }

      const number = await repository.nextDocumentNumber(companyId, 'payment_receipt');
      const receipt = await repository.createRentReceipt(companyId, {
        tenant_id: tenant.id,
        number,
        received_on: input.received_on || todayIso(),
        amount: input.amount,
        status: 'completed',
        reference: input.reference,
        notes: input.notes,
        created_by: req.auth.user.id,
        allocations: input.allocations,
      });

      await writeAudit(req, receipt.id, 'created', null, {
        number: receipt.number,
        tenant_id: receipt.tenant_id,
        amount: receipt.amount,
        allocations: input.allocations.length,
      });
      res.status(201).json({ data: receipt });
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const receipt = await repository.getRentReceipt(req.auth.company.id, req.params.id);
      if (!receipt) throw new ApiError(404, 'Receipt not found.');
      res.json({ data: receipt });
    }),
  );

  router.post(
    '/:id/void',
    ...collect,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const receipt = await repository.getRentReceipt(companyId, req.params.id);
      if (!receipt) throw new ApiError(404, 'Receipt not found.');
      const input = parseBody(voidSchema, req.body);
      if (receipt.status !== 'completed') {
        throw new ApiError(422, 'Only a completed receipt can be voided.');
      }
      const voided = await repository.voidRentReceipt(companyId, receipt.id, {
        reason: input.reason,
        userId: req.auth.user.id,
      });
      await writeAudit(req, receipt.id, 'status_changed', { status: receipt.status }, {
        status: 'voided',
        reason: input.reason,
      });
      res.json({ data: voided });
    }),
  );

  return router;
}

export default createRentCollectionsRouter;
