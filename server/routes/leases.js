import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import {
  booleanish,
  nullableDate,
  nullableString,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import {
  LEASE_FREQUENCIES,
  LATE_FEE_TYPES,
  buildRentSchedule,
  depositHeld,
  depositStatusAfter,
  roundMoney,
} from '../lib/rental.js';
import {
  matchesSearch,
  markUnitRented,
  releaseUnitIfFree,
  requireLease,
  scheduleBalance,
  todayIso,
} from './rentalSupport.js';

const money = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);

const integer = (min, max, message) =>
  z.coerce.number().int(message).min(min, message).max(max, message);

const leaseFields = {
  unit_id: z.string().uuid('Choose a unit.'),
  tenant_id: z.string().uuid('Choose a tenant.'),
  start_date: nullableDate(),
  end_date: nullableDate(),
  frequency: z.enum(LEASE_FREQUENCIES).default('monthly'),
  rent_amount: money,
  due_day: integer(1, 28, 'Use a due day between 1 and 28.').default(1),
  grace_days: integer(0, 60, 'Use a grace period between 0 and 60 days.').default(5),
  late_fee_type: z.enum(LATE_FEE_TYPES).default('none'),
  late_fee_value: money,
  notice_period_days: integer(0, 365, 'Use a notice period between 0 and 365 days.').default(30),
  security_deposit_amount: money,
  utilities_included: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  terms: nullableString(5000),
  activate: booleanish.default(false),
};

const createSchema = z.object(leaseFields);
const updateSchema = z
  .object({
    start_date: nullableDate(),
    end_date: nullableDate(),
    frequency: z.enum(LEASE_FREQUENCIES),
    rent_amount: money,
    due_day: integer(1, 28, 'Use a due day between 1 and 28.'),
    grace_days: integer(0, 60, 'Use a grace period between 0 and 60 days.'),
    late_fee_type: z.enum(LATE_FEE_TYPES),
    late_fee_value: money,
    notice_period_days: integer(0, 365, 'Use a notice period between 0 and 365 days.'),
    security_deposit_amount: money,
    utilities_included: z.array(z.string().trim().min(1).max(40)).max(20),
    terms: nullableString(5000),
  })
  .partial();

const renewSchema = z.object({
  start_date: nullableDate(),
  end_date: nullableDate(),
  frequency: z.enum(LEASE_FREQUENCIES).default('monthly'),
  rent_amount: money,
  due_day: integer(1, 28, 'Use a due day between 1 and 28.').default(1),
  grace_days: integer(0, 60, 'Use a grace period between 0 and 60 days.').default(5),
  late_fee_type: z.enum(LATE_FEE_TYPES).default('none'),
  late_fee_value: money,
  notice_period_days: integer(0, 365, 'Use a notice period between 0 and 365 days.').default(30),
  security_deposit_amount: money,
  utilities_included: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  terms: nullableString(5000),
  activate: booleanish.default(false),
});

const reviseSchema = z.object({
  rent_amount: z.coerce.number().finite('Enter a number.').positive('Enter a rent amount.'),
  effective_date: nullableDate(),
  reason: nullableString(500),
});

const terminateSchema = z.object({
  termination_date: nullableDate(),
  reason: z.string().trim().min(1, 'Enter a reason for ending the lease.').max(500),
});

const adjustmentSchema = z.object({
  type: z.enum(['extra_charge', 'discount', 'waiver']),
  amount: money,
  reason: nullableString(500),
});

function validateDates(input) {
  if (!input.start_date) {
    throw validationError({ start_date: 'Enter the lease start date.' });
  }
  if (!input.end_date) {
    throw validationError({ end_date: 'Enter the lease end date.' });
  }
  if (String(input.end_date) < String(input.start_date)) {
    throw validationError({ end_date: 'The end date must be on or after the start date.' });
  }
}

function payloadForLease(input) {
  return {
    start_date: input.start_date,
    end_date: input.end_date,
    frequency: input.frequency,
    rent_amount: roundMoney(input.rent_amount),
    due_day: input.due_day,
    grace_days: input.grace_days,
    late_fee_type: input.late_fee_type,
    late_fee_value: roundMoney(input.late_fee_value),
    notice_period_days: input.notice_period_days,
    security_deposit_amount: roundMoney(input.security_deposit_amount),
    utilities_included: input.utilities_included,
    terms: input.terms,
  };
}

async function validateParties(repository, companyId, unitId, tenantId) {
  const [unit, tenant] = await Promise.all([
    repository.getUnit(companyId, unitId),
    repository.getTenant(companyId, tenantId),
  ]);
  if (!unit) throw validationError({ unit_id: 'Choose a unit from this company.' });
  if (!tenant) throw validationError({ tenant_id: 'Choose a tenant from this company.' });
  return { unit, tenant };
}

async function createLeaseRecord(req, repository, { input, previousLease = null }) {
  const companyId = req.auth.company.id;
  const { unit, tenant } = await validateParties(
    repository,
    companyId,
    input.unit_id,
    input.tenant_id,
  );
  const active = await repository.findActiveLeaseForUnit(companyId, unit.id);
  if (active && !previousLease) {
    throw new ApiError(409, 'This unit already has an active lease.');
  }
  const number = await repository.nextDocumentNumber(companyId, 'lease');
  return repository.createLease(companyId, {
    lease: {
      ...payloadForLease(input),
      unit_id: unit.id,
      tenant_id: tenant.id,
      previous_lease_id: previousLease?.id || null,
      number,
      status: 'draft',
      created_by: req.auth.user.id,
      updated_by: req.auth.user.id,
    },
    deposit: {
      required_amount: roundMoney(input.security_deposit_amount),
      received_amount: 0,
      deducted_amount: 0,
      refunded_amount: 0,
      held_amount: 0,
      status: 'to_collect',
    },
  });
}

async function activateLeaseRecord(req, repository, lease, { previousLease = null } = {}) {
  const companyId = req.auth.company.id;
  if (lease.status !== 'draft') {
    throw new ApiError(422, 'Only a draft lease can be activated.');
  }
  const [otherLease, otherSale, otherReservation, unit] = await Promise.all([
    repository.findActiveLeaseForUnit(companyId, lease.unit_id, lease.id),
    repository.findActiveSaleForUnit(companyId, lease.unit_id),
    repository.findActiveReservationForUnit(companyId, lease.unit_id),
    repository.getUnit(companyId, lease.unit_id),
  ]);
  if (otherLease) {
    throw new ApiError(409, 'This unit already has an active lease.');
  }
  if (otherSale || otherReservation) {
    throw new ApiError(
      409,
      'This unit has an active sale or reservation. Close it before activating the lease.',
    );
  }
  if (!unit) throw new ApiError(404, 'Unit not found.');
  const allowedStatus = unit.status === 'available' || (previousLease && unit.status === 'rented');
  if (!allowedStatus) {
    throw new ApiError(
      409,
      `A ${String(unit.status).replaceAll('_', ' ')} unit cannot start a lease. Choose another unit.`,
    );
  }

  const rows = buildRentSchedule({
    start_date: lease.start_date,
    end_date: lease.end_date,
    frequency: lease.frequency,
    rent_amount: lease.rent_amount,
    due_day: lease.due_day,
  });
  await repository.createRentSchedules(companyId, lease.id, rows);

  if (lease.deposit) {
    await repository.updateDeposit(companyId, lease.deposit.id, {
      status: depositStatusAfter({ deposit: lease.deposit, leaseStatus: 'active' }),
      held_amount: depositHeld(lease.deposit),
    });
  }

  const updated = await repository.updateLease(companyId, lease.id, {
    status: 'active',
    updated_by: req.auth.user.id,
  });
  await markUnitRented(repository, companyId, lease.unit_id, lease.number, req.auth.user.id);
  return updated;
}

export function createLeasesRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('leases.view')];
  const create = [auth.requireAuth, auth.requirePermission('leases.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('leases.edit'), auth.requireCsrf];
  const terminate = [
    auth.requireAuth,
    auth.requirePermission('leases.terminate'),
    auth.requireCsrf,
  ];

  const writeAudit = (req, recordId, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module: 'Lease',
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
        status: String(req.query.status || '') || null,
        tenant_id: String(req.query.tenant_id || '') || null,
        unit_id: String(req.query.unit_id || '') || null,
        project_id: String(req.query.project_id || '') || null,
      };

      await repository.expireLeases(companyId, todayIso());
      let rows = await repository.listLeases(companyId);
      if (filters.status) rows = rows.filter((row) => row.status === filters.status);
      if (filters.tenant_id) rows = rows.filter((row) => row.tenant_id === filters.tenant_id);
      if (filters.unit_id) rows = rows.filter((row) => row.unit_id === filters.unit_id);
      if (filters.project_id) {
        rows = rows.filter((row) => row.unit?.project_id === filters.project_id);
      }
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [
            row.number,
            row.tenant?.name,
            row.unit?.unit_number,
            row.unit?.project?.name,
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
      const input = parseBody(createSchema, req.body);
      validateDates(input);
      if (Number(input.rent_amount) <= 0) {
        throw validationError({ rent_amount: 'Enter a monthly rent greater than zero.' });
      }
      let lease = await createLeaseRecord(req, repository, { input });
      if (input.activate) {
        lease = await activateLeaseRecord(req, repository, lease);
      }
      await writeAudit(req, lease.id, 'created', null, {
        number: lease.number,
        tenant_id: lease.tenant_id,
        unit_id: lease.unit_id,
        status: lease.status,
      });
      res.status(201).json({ data: lease });
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      await repository.expireLeases(companyId, todayIso());
      const lease = await repository.getLease(companyId, req.params.id);
      if (!lease) throw new ApiError(404, 'Lease not found.');
      res.json({ data: lease });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lease = await requireLease(repository, companyId, req.params.id);
      if (lease.status !== 'draft') {
        throw new ApiError(422, 'Only a draft lease can be edited.');
      }
      const input = parseBody(updateSchema, req.body);
      if (input.start_date || input.end_date) {
        validateDates({
          start_date: input.start_date || lease.start_date,
          end_date: input.end_date || lease.end_date,
        });
      }
      const updated = await repository.updateLease(companyId, lease.id, {
        ...input,
        updated_by: req.auth.user.id,
      });
      if (input.security_deposit_amount !== undefined && lease.deposit) {
        const deposit = {
          ...lease.deposit,
          required_amount: roundMoney(input.security_deposit_amount),
        };
        await repository.updateDeposit(companyId, lease.deposit.id, {
          required_amount: deposit.required_amount,
          held_amount: depositHeld(deposit),
          status: depositStatusAfter({ deposit, leaseStatus: updated.status }),
        });
      }
      await writeAudit(req, lease.id, 'updated', { status: lease.status }, { status: updated.status });
      res.json({ data: updated });
    }),
  );

  router.post(
    '/:id/activate',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lease = await requireLease(repository, companyId, req.params.id);
      const updated = await activateLeaseRecord(req, repository, lease);
      await writeAudit(req, lease.id, 'status_changed', { status: lease.status }, {
        status: updated.status,
      });
      res.json({ data: updated });
    }),
  );

  router.post(
    '/:id/renew',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lease = await requireLease(repository, companyId, req.params.id);
      if (lease.status !== 'active') {
        throw new ApiError(422, 'Only an active lease can be renewed.');
      }
      const input = parseBody(renewSchema, req.body);
      validateDates(input);
      if (String(input.start_date) <= String(lease.end_date)) {
        throw validationError({
          start_date: 'Choose a start date after the current lease ends.',
        });
      }
      if (Number(input.rent_amount) <= 0) {
        throw validationError({ rent_amount: 'Enter a monthly rent greater than zero.' });
      }

      const renewal = await createLeaseRecord(req, repository, {
        input: {
          ...input,
          unit_id: lease.unit_id,
          tenant_id: lease.tenant_id,
        },
        previousLease: lease,
      });

      let result = renewal;
      if (input.activate) {
        await repository.updateLease(companyId, lease.id, { status: 'renewed' });
        try {
          result = await activateLeaseRecord(req, repository, renewal, {
            previousLease: lease,
          });
        } catch (error) {
          await repository.updateLease(companyId, lease.id, { status: 'active' });
          throw error;
        }
        if (lease.deposit) {
          await repository.updateDeposit(companyId, lease.deposit.id, {
            status: depositStatusAfter({ deposit: lease.deposit, leaseStatus: 'renewed' }),
            held_amount: depositHeld(lease.deposit),
          });
        }
      }

      await writeAudit(req, result.id, 'created', { previous_lease_id: lease.id }, {
        number: result.number,
        status: result.status,
      });
      res.status(201).json({ data: result });
    }),
  );

  router.post(
    '/:id/revise-rent',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lease = await requireLease(repository, companyId, req.params.id);
      if (lease.status !== 'active') {
        throw new ApiError(422, 'Only an active lease can have its rent revised.');
      }
      const input = parseBody(reviseSchema, req.body);
      const effectiveDate = input.effective_date || new Date().toISOString().slice(0, 10);
      const amount = roundMoney(input.rent_amount);

      for (const schedule of lease.schedules) {
        if (String(schedule.period_start) < effectiveDate) continue;
        if (Number(schedule.paid_amount || 0) > 0.005) continue;
        if (['waived', 'cancelled'].includes(schedule.status)) continue;
        const adjustments = Number(schedule.adjustments || 0);
        const lateFee = Number(schedule.late_fee || 0);
        const balance = roundMoney(
          Math.max(0, amount + adjustments + lateFee - Number(schedule.paid_amount || 0)),
        );
        await repository.updateRentSchedule(companyId, lease.id, schedule.id, {
          rent_amount: amount,
          balance,
        });
      }

      const updated = await repository.updateLease(companyId, lease.id, {
        rent_amount: amount,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, lease.id, 'updated', { rent_amount: lease.rent_amount }, {
        rent_amount: amount,
        effective_date: effectiveDate,
      });
      res.json({ data: updated });
    }),
  );

  router.post(
    '/:id/terminate',
    ...terminate,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lease = await requireLease(repository, companyId, req.params.id);
      if (!['active', 'draft'].includes(lease.status)) {
        throw new ApiError(422, 'Only an active or draft lease can be terminated.');
      }
      const input = parseBody(terminateSchema, req.body);
      if (!input.termination_date) {
        throw validationError({ termination_date: 'Enter the termination date.' });
      }

      for (const schedule of lease.schedules) {
        if (String(schedule.period_start) <= input.termination_date) continue;
        if (Number(schedule.paid_amount || 0) > 0.005) continue;
        if (['waived', 'cancelled'].includes(schedule.status)) continue;
        await repository.updateRentSchedule(companyId, lease.id, schedule.id, {
          status: 'cancelled',
          balance: 0,
        });
      }

      if (lease.deposit) {
        await repository.updateDeposit(companyId, lease.deposit.id, {
          status: depositStatusAfter({ deposit: lease.deposit, leaseStatus: 'terminated' }),
          held_amount: depositHeld(lease.deposit),
        });
      }

      const updated = await repository.updateLease(companyId, lease.id, {
        status: 'terminated',
        terminated_at: input.termination_date,
        termination_reason: input.reason,
        updated_by: req.auth.user.id,
      });

      await releaseUnitIfFree(
        repository,
        companyId,
        lease.unit_id,
        `Lease ${lease.number} terminated`,
        req.auth.user.id,
      );
      await writeAudit(req, lease.id, 'status_changed', { status: lease.status }, {
        status: 'terminated',
        termination_date: input.termination_date,
        reason: input.reason,
      });
      res.json({ data: updated });
    }),
  );

  router.post(
    '/:id/schedule/:scheduleId/adjustments',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const lease = await requireLease(repository, companyId, req.params.id);
      const schedule = lease.schedules.find((row) => row.id === req.params.scheduleId);
      if (!schedule) throw new ApiError(404, 'Rent period not found.');
      if (['waived', 'cancelled'].includes(schedule.status)) {
        throw new ApiError(422, 'This rent period is already closed.');
      }
      const input = parseBody(adjustmentSchema, req.body);
      const balance = scheduleBalance(schedule);

      let adjustments = Number(schedule.adjustments || 0);
      let status = schedule.status;
      let nextBalance;

      if (input.type === 'waiver') {
        if (balance <= 0.005) {
          throw new ApiError(422, 'This rent period has no balance to waive.');
        }
        adjustments = roundMoney(adjustments - balance);
        status = 'waived';
        nextBalance = 0;
      } else {
        if (Number(input.amount) <= 0) {
          throw validationError({ amount: 'Enter an amount greater than zero.' });
        }
        adjustments = roundMoney(
          adjustments + (input.type === 'discount' ? -Number(input.amount) : Number(input.amount)),
        );
        nextBalance = roundMoney(
          Math.max(
            0,
            Number(schedule.rent_amount || 0) +
              adjustments +
              Number(schedule.late_fee || 0) -
              Number(schedule.paid_amount || 0),
          ),
        );
        if (nextBalance <= 0.005) status = 'paid';
        else if (Number(schedule.paid_amount || 0) > 0.005) status = 'partly_paid';
      }

      await repository.createRentAdjustment(companyId, {
        rent_schedule_id: schedule.id,
        type: input.type,
        amount:
          input.type === 'waiver' ? roundMoney(balance) : roundMoney(Number(input.amount)),
        reason: input.reason,
        created_by: req.auth.user.id,
      });

      const updated = await repository.updateRentSchedule(companyId, lease.id, schedule.id, {
        adjustments,
        status,
        balance: nextBalance,
      });
      await writeAudit(req, lease.id, 'updated', { schedule_id: schedule.id, balance }, {
        schedule_id: schedule.id,
        type: input.type,
        balance: nextBalance,
      });
      res.json({ data: updated });
    }),
  );

  return router;
}

export default createLeasesRouter;
