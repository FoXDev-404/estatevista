import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { nullableDate, nullableString, parseBody } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { loadCustomer, matchesSearch, todayIso } from './salesSupport.js';

const money = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);

const createSchema = z.object({
  customer_id: z.string().uuid('Choose a customer.'),
  received_on: nullableDate(),
  amount: money,
  reference: nullableString(255),
  notes: nullableString(2000),
  allocations: z
    .array(
      z.object({
        installment_id: z.string().uuid('Choose an installment.'),
        amount: money,
      }),
    )
    .min(1, 'Allocate the receipt to at least one installment.'),
});

const voidSchema = z.object({
  reason: z.string().trim().min(1, 'Enter a reason for voiding this receipt.').max(500),
});

export function createCollectionsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('collections.view')];
  const create = [auth.requireAuth, auth.requirePermission('collections.create'), auth.requireCsrf];
  const voidReceipt = [auth.requireAuth, auth.requirePermission('collections.void'), auth.requireCsrf];

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
      const { page, limit } = parsePagination(req.query, { defaultLimit: 20 });
      const filters = {
        search: String(req.query.search || '').trim(),
        customer_id: String(req.query.customer_id || '') || null,
        status: String(req.query.status || '') || null,
        date_from: String(req.query.date_from || '') || null,
        date_to: String(req.query.date_to || '') || null,
      };

      let rows = await repository.listReceipts(companyId);
      if (filters.customer_id) rows = rows.filter((row) => row.customer_id === filters.customer_id);
      if (filters.status) rows = rows.filter((row) => row.status === filters.status);
      if (filters.date_from) rows = rows.filter((row) => row.received_on >= filters.date_from);
      if (filters.date_to) rows = rows.filter((row) => row.received_on <= filters.date_to);
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [row.number, row.customer?.name, row.reference]),
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
      await loadCustomer(repository, companyId, input.customer_id);
      if (Number(input.amount) <= 0) {
        throw validationError({ amount: 'Enter a receipt amount greater than zero.' });
      }

      const installments = await repository.listInstallments(companyId);
      const byId = new Map(installments.map((row) => [row.id, row]));
      const seen = new Set();
      let total = 0;
      for (const allocation of input.allocations) {
        if (Number(allocation.amount) <= 0) {
          throw validationError({ allocations: 'Allocation amounts must be greater than zero.' });
        }
        if (seen.has(allocation.installment_id)) {
          throw validationError({ allocations: 'Each installment can only appear once.' });
        }
        seen.add(allocation.installment_id);

        const installment = byId.get(allocation.installment_id);
        if (!installment) {
          throw validationError({ allocations: 'Choose an installment from this company.' });
        }
        if (installment.sale?.customer_id !== input.customer_id) {
          throw validationError({ allocations: 'The installment belongs to a different customer.' });
        }
        if (['waived', 'cancelled'].includes(installment.status)) {
          throw validationError({ allocations: 'This installment cannot receive a payment.' });
        }
        if (Number(allocation.amount) > Number(installment.balance)) {
          const message = `The allocation exceeds the installment balance for ${installment.sale?.number || 'this sale'}.`;
          throw new ApiError(422, message, { allocations: message });
        }
        total += Number(allocation.amount);
      }

      if (Math.abs(total - Number(input.amount)) > 0.005) {
        throw validationError({
          allocations: 'Allocations must equal the receipt amount.',
        });
      }

      const number = await repository.nextDocumentNumber(companyId, 'payment_receipt');
      const receipt = await repository.createReceipt(companyId, {
        customer_id: input.customer_id,
        number,
        received_on: input.received_on || todayIso(),
        amount: input.amount,
        status: 'completed',
        reference: input.reference,
        notes: input.notes,
        created_by: req.auth.user.id,
        allocations: input.allocations,
      });

      await writeAudit(req, 'Receipt', receipt.id, 'created', null, {
        number: receipt.number,
        customer_id: receipt.customer_id,
        amount: receipt.amount,
        allocations: input.allocations.length,
      });
      res.status(201).json({ data: await repository.getReceipt(companyId, receipt.id) });
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const receipt = await repository.getReceipt(companyId, req.params.id);
      if (!receipt) throw new ApiError(404, 'Receipt not found.');
      res.json({ data: receipt });
    }),
  );

  router.post(
    '/:id/void',
    ...voidReceipt,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const receipt = await repository.getReceipt(companyId, req.params.id);
      if (!receipt) throw new ApiError(404, 'Receipt not found.');
      const input = parseBody(voidSchema, req.body);
      if (receipt.status !== 'completed') {
        throw new ApiError(422, 'Only a completed receipt can be voided.');
      }
      await repository.voidReceipt(companyId, receipt.id, {
        reason: input.reason,
        userId: req.auth.user.id,
      });
      await writeAudit(req, 'Receipt', receipt.id, 'status_changed', {
        status: receipt.status,
      }, { status: 'voided', reason: input.reason });
      res.json({ data: await repository.getReceipt(companyId, receipt.id) });
    }),
  );

  return router;
}

export default createCollectionsRouter;
