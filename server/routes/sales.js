import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { nullableDate, nullableString, nullableUuid, parseBody } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import {
  FREQUENCIES,
  LATE_FEE_TYPES,
  buildInstallmentSchedule,
  commissionFor,
  saleTotals,
} from '../lib/sales.js';
import {
  loadCustomer,
  loadSalesperson,
  matchesSearch,
  requireSale,
  saleOpenBalance,
  todayIso,
} from './salesSupport.js';
import { notifySaleCreated } from '../lib/notifications.js';

const money = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);

const planSchema = z.object({
  down_payment: money,
  number_of_installments: z.coerce
    .number()
    .int('Enter a whole number of installments.')
    .min(1, 'Use at least one installment.')
    .max(240, 'Use 240 installments or fewer.'),
  frequency: z.enum(FREQUENCIES, { message: 'Choose a payment frequency.' }),
  start_date: z
    .string()
    .min(1, 'Choose a plan start date.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.'),
  due_day: z.coerce.number().int().min(1).max(28),
  grace_days: z.coerce.number().int().min(0).max(90),
  late_fee_type: z.enum(LATE_FEE_TYPES).default('none'),
  late_fee_value: money,
});

const createSchema = z.object({
  customer_id: z.string().uuid('Choose a customer.'),
  unit_id: z.string().uuid('Choose a unit.'),
  salesperson_id: nullableUuid(),
  agreement_date: nullableDate(),
  sale_price: money,
  discount_amount: money,
  tax_amount: money,
  payment_type: z.enum(['full', 'installments'], { message: 'Choose a payment type.' }),
  notes: nullableString(2000),
  plan: planSchema.nullable().optional(),
  reservation_id: nullableUuid(),
  quotation_id: nullableUuid(),
});

const installmentSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reschedule'),
    due_date: z
      .string()
      .min(1, 'Choose a due date.')
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.'),
  }),
  z.object({
    action: z.literal('waive'),
    reason: nullableString(500),
  }),
]);

const handoverSchema = z.object({
  handover_date: nullableDate(),
  notes: nullableString(2000),
});

const cancelSchema = z.object({
  reason: nullableString(500),
});

function planDueDay(date) {
  const day = Number(String(date || todayIso()).slice(8, 10));
  return Math.min(Math.max(day, 1), 28);
}

function planForFullPayment(agreementDate) {
  return {
    down_payment: 0,
    number_of_installments: 1,
    frequency: 'monthly',
    start_date: agreementDate,
    due_day: planDueDay(agreementDate),
    grace_days: 0,
    late_fee_type: 'none',
    late_fee_value: 0,
  };
}

export function createSalesRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('sales.view')];
  const create = [auth.requireAuth, auth.requirePermission('sales.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('sales.edit'), auth.requireCsrf];
  const cancel = [auth.requireAuth, auth.requirePermission('sales.cancel'), auth.requireCsrf];

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

  async function findCommissionRule(companyId, unit) {
    const rules = (await repository.listCommissionRules(companyId)).filter(
      (rule) => rule.is_active !== false,
    );
    const rank = { project: 0, unit_type: 1, all: 2 };
    return (
      rules
        .filter((rule) => {
          if (rule.applicability === 'project') return rule.project_id === unit.project_id;
          if (rule.applicability === 'unit_type') return rule.unit_type_id === unit.unit_type_id;
          return true;
        })
        .sort((a, b) => rank[a.applicability] - rank[b.applicability])[0] || null
    );
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
        salesperson_id: String(req.query.salesperson_id || '') || null,
      };

      let rows = await repository.listSales(companyId);
      if (filters.status) rows = rows.filter((row) => row.status === filters.status);
      if (filters.project_id) {
        rows = rows.filter((row) => row.unit?.project_id === filters.project_id);
      }
      if (filters.salesperson_id) {
        rows = rows.filter((row) => row.salesperson_id === filters.salesperson_id);
      }
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [
            row.number,
            row.customer?.name,
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
      await loadCustomer(repository, companyId, input.customer_id);
      const unit = await repository.getUnit(companyId, input.unit_id);
      if (!unit) {
        throw validationError({ unit_id: 'Choose a unit from this company.' });
      }
      await loadSalesperson(repository, companyId, input.salesperson_id);

      const activeSale = await repository.findActiveSaleForUnit(companyId, unit.id);
      if (activeSale) throw new ApiError(409, 'This unit already has an active sale.');

      const activeReservation = await repository.findActiveReservationForUnit(companyId, unit.id);
      if (activeReservation && activeReservation.customer_id !== input.customer_id) {
        throw new ApiError(409, 'This unit is reserved for another customer.');
      }
      if (!['available', 'reserved'].includes(unit.status)) {
        throw validationError({ unit_id: 'This unit is not available to sell.' });
      }

      let reservation = activeReservation || null;
      if (input.reservation_id) {
        reservation = await repository.getReservation(companyId, input.reservation_id);
        if (!reservation) throw validationError({ reservation_id: 'Choose a reservation from this company.' });
        if (reservation.status !== 'active') {
          throw validationError({ reservation_id: 'Only an active reservation can be converted.' });
        }
        if (reservation.unit_id !== unit.id || reservation.customer_id !== input.customer_id) {
          throw validationError({ reservation_id: 'This reservation does not match the customer and unit.' });
        }
      }

      let quotation = null;
      if (input.quotation_id) {
        quotation = await repository.getQuotation(companyId, input.quotation_id);
        if (!quotation) throw validationError({ quotation_id: 'Choose a quotation from this company.' });
        if (quotation.status === 'converted') {
          throw new ApiError(409, 'This quotation has already been converted.');
        }
        if (quotation.status !== 'accepted') {
          throw validationError({ quotation_id: 'Only an accepted quotation can be converted.' });
        }
        if (quotation.unit_id !== unit.id) {
          throw validationError({ quotation_id: 'The quotation is for a different unit.' });
        }
        if (quotation.customer_id && quotation.customer_id !== input.customer_id) {
          throw validationError({
            quotation_id: 'The quotation belongs to a different customer.',
          });
        }
      }

      const totals = saleTotals(input);
      if (totals.net_price <= 0) {
        throw validationError({ sale_price: 'Enter a sale price greater than zero.' });
      }

      const agreementDate = input.agreement_date || todayIso();
      let plan;
      let schedule;
      if (input.payment_type === 'full') {
        plan = planForFullPayment(agreementDate);
        schedule = [{ sequence: 1, due_date: agreementDate, amount: totals.net_price }];
      } else {
        if (!input.plan) {
          throw validationError({ plan: 'Enter the installment plan.' });
        }
        if (input.plan.down_payment >= totals.net_price) {
          throw validationError({ plan: 'The down payment must be less than the net price.' });
        }
        plan = {
          ...input.plan,
          start_date: input.plan.start_date || agreementDate,
        };
        schedule = buildInstallmentSchedule({
          netPrice: totals.net_price,
          downPayment: plan.down_payment,
          count: plan.number_of_installments,
          frequency: plan.frequency,
          startDate: plan.start_date,
          dueDay: plan.due_day,
        });
      }

      const number = await repository.nextDocumentNumber(companyId, 'sale');
      const sale = await repository.createSale(companyId, {
        sale: {
          customer_id: input.customer_id,
          unit_id: unit.id,
          salesperson_id: input.salesperson_id,
          number,
          agreement_date: agreementDate,
          ...totals,
          collected_amount:
            input.payment_type === 'installments' ? Number(plan.down_payment || 0) : 0,
          payment_type: input.payment_type,
          status: 'active',
          notes: input.notes,
          created_by: req.auth.user.id,
          updated_by: req.auth.user.id,
        },
        plan: { ...plan, number_of_installments: schedule.length },
        installments: schedule,
      });

      if (reservation) {
        await repository.updateReservation(companyId, reservation.id, {
          status: 'converted',
          converted_sale_id: sale.id,
        });
      }
      if (quotation) {
        await repository.updateQuotation(companyId, quotation.id, {
          status: 'converted',
          updated_by: req.auth.user.id,
        });
      }

      const rule = await findCommissionRule(companyId, unit);
      if (rule && input.salesperson_id) {
        await repository.createSalesCommission(companyId, {
          sale_id: sale.id,
          salesperson_id: input.salesperson_id,
          rule_id: rule.id,
          base_amount: totals.net_price,
          rate_type: rule.rate_type,
          rate_value: rule.rate_value,
          commission_amount: commissionFor(rule, totals.net_price),
          status: 'pending',
        });
      }

      await writeAudit(req, 'Sale', sale.id, 'created', null, {
        number: sale.number,
        customer_id: sale.customer_id,
        unit_id: sale.unit_id,
        net_price: sale.net_price,
        payment_type: sale.payment_type,
      });
      const createdSale = await repository.getSale(companyId, sale.id);
      await notifySaleCreated(repository, {
        companyId,
        actorId: req.auth.user.id,
        actorName: req.auth.user.name,
        sale: createdSale,
      });
      res.status(201).json({ data: createdSale });
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const sale = await requireSale(repository, req.auth.company.id, req.params.id);
      res.json({ data: sale });
    }),
  );

  router.patch(
    '/:id/installments/:installmentId',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const sale = await requireSale(repository, companyId, req.params.id);
      const installment = (sale.installments || []).find(
        (row) => row.id === req.params.installmentId,
      );
      if (!installment) throw new ApiError(404, 'Installment not found.');

      const input = parseBody(installmentSchema, req.body);
      if (input.action === 'reschedule') {
        if (['paid', 'waived', 'cancelled'].includes(installment.status)) {
          throw new ApiError(422, 'This installment can no longer be rescheduled.');
        }
        const updated = await repository.updateInstallment(
          companyId,
          sale.id,
          installment.id,
          { due_date: input.due_date },
        );
        await writeAudit(req, 'Sale', sale.id, 'updated', {
          installment_id: installment.id,
          due_date: installment.due_date,
        }, { installment_id: installment.id, due_date: updated.due_date });
        res.json({ data: updated });
        return;
      }

      if (['paid', 'cancelled'].includes(installment.status)) {
        throw new ApiError(422, 'This installment can no longer be waived.');
      }
      if (Number(installment.paid_amount || 0) > 0) {
        throw new ApiError(422, 'A partly paid installment cannot be waived.');
      }
      const updated = await repository.updateInstallment(
        companyId,
        sale.id,
        installment.id,
        { status: 'waived', balance: 0 },
      );
      await writeAudit(req, 'Sale', sale.id, 'updated', {
        installment_id: installment.id,
        status: installment.status,
      }, {
        installment_id: installment.id,
        status: 'waived',
        reason: input.reason || null,
      });
      res.json({ data: updated });
    }),
  );

  router.post(
    '/:id/handover',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const sale = await requireSale(repository, companyId, req.params.id);
      if (sale.status === 'cancelled') {
        throw new ApiError(422, 'A cancelled sale cannot be handed over.');
      }
      const input = parseBody(handoverSchema, req.body);
      if (saleOpenBalance(sale) > 0) {
        throw new ApiError(422, 'Clear the outstanding balance before handover.');
      }
      const updated = await repository.updateSale(companyId, sale.id, {
        handover_date: input.handover_date || todayIso(),
        handover_notes: input.notes,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, 'Sale', sale.id, 'updated', {
        handover_date: sale.handover_date,
      }, { handover_date: updated.handover_date });
      res.json({ data: await repository.getSale(companyId, updated.id) });
    }),
  );

  router.post(
    '/:id/cancel',
    ...cancel,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const sale = await requireSale(repository, companyId, req.params.id);
      const { reason } = parseBody(cancelSchema, req.body);
      if (sale.status === 'cancelled') {
        throw new ApiError(409, 'This sale is already cancelled.');
      }

      await repository.updateSale(companyId, sale.id, {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || null,
        updated_by: req.auth.user.id,
      });
      for (const installment of sale.installments || []) {
        if (installment.status !== 'cancelled') {
          await repository.updateInstallment(companyId, sale.id, installment.id, {
            status: 'cancelled',
            balance: 0,
          });
        }
      }

      const unit = await repository.getUnit(companyId, sale.unit_id);
      if (unit && unit.status === 'sold') {
        const [otherSale, activeReservation] = await Promise.all([
          repository.findActiveSaleForUnit(companyId, unit.id),
          repository.findActiveReservationForUnit(companyId, unit.id),
        ]);
        if (!otherSale && !activeReservation) {
          await repository.updateUnitStatus(companyId, unit.id, {
            status: 'available',
            reason: `Sale ${sale.number} cancelled`,
            changedBy: req.auth.user.id,
          });
        }
      }

      for (const commission of await repository.listSalesCommissions(companyId, {
        sale_id: sale.id,
      })) {
        if (commission.status !== 'cancelled') {
          await repository.updateSalesCommission(companyId, commission.id, {
            status: 'cancelled',
          });
        }
      }

      await writeAudit(req, 'Sale', sale.id, 'status_changed', {
        status: sale.status,
      }, { status: 'cancelled', reason: reason || null });
      res.json({ data: await repository.getSale(companyId, sale.id) });
    }),
  );

  return router;
}

export default createSalesRouter;
