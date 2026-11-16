import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { nullableString, parseBody } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import {
  depositHeld,
  depositStatusAfter,
  roundMoney,
} from '../lib/rental.js';
import { matchesSearch, requireDeposit } from './rentalSupport.js';

const money = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);

const amountSchema = z.object({
  amount: money,
  reason: nullableString(500),
  reference: nullableString(255),
});

export function createDepositsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('deposits.view')];
  const manage = [auth.requireAuth, auth.requirePermission('deposits.manage'), auth.requireCsrf];

  const writeAudit = (req, recordId, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module: 'Security deposit',
      recordId,
      event,
      before,
      after,
      ip: clientIp(req),
    });

  async function applyChange(req, deposit, input, type) {
    const companyId = req.auth.company.id;
    const amount = roundMoney(Number(input.amount));
    if (amount <= 0) {
      throw validationError({ amount: 'Enter an amount greater than zero.' });
    }

    const next = {
      ...deposit,
      received_amount: Number(deposit.received_amount || 0),
      deducted_amount: Number(deposit.deducted_amount || 0),
      refunded_amount: Number(deposit.refunded_amount || 0),
    };
    const held = depositHeld(deposit);

    if (type === 'receipt') {
      next.received_amount = roundMoney(next.received_amount + amount);
    } else if (type === 'deduction') {
      if (amount > held + 0.005) {
        throw new ApiError(422, 'The deduction exceeds the held balance.');
      }
      next.deducted_amount = roundMoney(next.deducted_amount + amount);
    } else {
      if (amount > held + 0.005) {
        throw new ApiError(422, 'The refund exceeds the held balance.');
      }
      next.refunded_amount = roundMoney(next.refunded_amount + amount);
    }

    const lease = await repository.getLease(companyId, deposit.lease_id);
    const status = depositStatusAfter({
      deposit: next,
      leaseStatus: lease?.status || 'active',
    });

    const updated = await repository.updateDeposit(companyId, deposit.id, {
      received_amount: next.received_amount,
      deducted_amount: next.deducted_amount,
      refunded_amount: next.refunded_amount,
      held_amount: depositHeld(next),
      status,
    });

    await repository.createDepositTransaction(companyId, {
      deposit_id: deposit.id,
      type,
      amount,
      reason: input.reason || input.reference || null,
      created_by: req.auth.user.id,
    });

    await writeAudit(req, deposit.id, 'updated', { status: deposit.status }, {
      type,
      amount,
      status: updated.status,
      held_amount: updated.held_amount,
    });
    return updated;
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
        lease_id: String(req.query.lease_id || '') || null,
      };

      let rows = await repository.listDeposits(companyId);
      if (filters.status) rows = rows.filter((row) => row.status === filters.status);
      if (filters.lease_id) rows = rows.filter((row) => row.lease_id === filters.lease_id);
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [
            row.lease?.number,
            row.tenant?.name,
            row.unit?.unit_number,
          ]),
        );
      }

      const total = rows.length;
      const start = (page - 1) * limit;
      res.json(paginated(rows.slice(start, start + limit), total, page, limit));
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const deposit = await repository.getDeposit(req.auth.company.id, req.params.id);
      if (!deposit) throw new ApiError(404, 'Security deposit not found.');
      res.json({ data: deposit });
    }),
  );

  router.post(
    '/:id/receipt',
    ...manage,
    asyncHandler(async (req, res) => {
      const deposit = await requireDeposit(repository, req.auth.company.id, req.params.id);
      const input = parseBody(amountSchema, req.body);
      const updated = await applyChange(req, deposit, input, 'receipt');
      res.json({ data: updated });
    }),
  );

  router.post(
    '/:id/deduction',
    ...manage,
    asyncHandler(async (req, res) => {
      const deposit = await requireDeposit(repository, req.auth.company.id, req.params.id);
      const input = parseBody(amountSchema, req.body);
      const updated = await applyChange(req, deposit, input, 'deduction');
      res.json({ data: updated });
    }),
  );

  router.post(
    '/:id/refund',
    ...manage,
    asyncHandler(async (req, res) => {
      const deposit = await requireDeposit(repository, req.auth.company.id, req.params.id);
      const input = parseBody(amountSchema, req.body);
      const updated = await applyChange(req, deposit, input, 'refund');
      res.json({ data: updated });
    }),
  );

  return router;
}

export default createDepositsRouter;
