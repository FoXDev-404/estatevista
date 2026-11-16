import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler } from '../lib/errors.js';
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
  unit_id: z.string().uuid('Choose a unit.'),
  booking_amount: money,
  reserved_on: nullableDate(),
  expires_at: z
    .string()
    .min(1, 'Choose an expiry date.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.'),
  notes: nullableString(2000),
});

const cancelSchema = z.object({
  reason: nullableString(500),
});

export function createReservationsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('reservations.view')];
  const create = [auth.requireAuth, auth.requirePermission('reservations.create'), auth.requireCsrf];
  const cancel = [auth.requireAuth, auth.requirePermission('reservations.cancel'), auth.requireCsrf];

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

  async function requireReservation(companyId, id) {
    await repository.expireReservations(companyId, todayIso());
    const reservation = await repository.getReservation(companyId, id);
    if (!reservation) throw new ApiError(404, 'Reservation not found.');
    return reservation;
  }

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      await repository.expireReservations(companyId, todayIso());
      const { page, limit } = parsePagination(req.query, { defaultLimit: 20 });
      const filters = {
        search: String(req.query.search || '').trim(),
        status: String(req.query.status || '') || null,
        project_id: String(req.query.project_id || '') || null,
      };

      let rows = await repository.listReservations(companyId);
      if (filters.status) rows = rows.filter((row) => row.status === filters.status);
      if (filters.project_id) {
        rows = rows.filter((row) => row.unit?.project_id === filters.project_id);
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
        throw new ApiError(422, 'Choose a unit from this company.', {
          unit_id: 'Choose a unit from this company.',
        });
      }

      const activeReservation = await repository.findActiveReservationForUnit(companyId, unit.id);
      if (activeReservation) {
        throw new ApiError(409, 'This unit already has an active reservation.');
      }
      if (unit.status !== 'available') {
        throw new ApiError(422, 'This unit is not available to reserve.', {
          unit_id: 'This unit is not available to reserve.',
        });
      }

      const number = await repository.nextDocumentNumber(companyId, 'reservation');
      const expired = input.expires_at < todayIso();
      const reservation = await repository.createReservation(companyId, {
        ...input,
        number,
        reserved_on: input.reserved_on || todayIso(),
        status: expired ? 'expired' : 'active',
        created_by: req.auth.user.id,
      });

      if (!expired) {
        await repository.updateUnitStatus(companyId, unit.id, {
          status: 'reserved',
          reason: `Reservation ${reservation.number}`,
          changedBy: req.auth.user.id,
        });
      }

      await writeAudit(req, 'Reservation', reservation.id, 'created', null, {
        number: reservation.number,
        unit_id: unit.id,
        customer_id: reservation.customer_id,
        expires_at: reservation.expires_at,
      });
      res.status(201).json({ data: await repository.getReservation(companyId, reservation.id) });
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const reservation = await requireReservation(req.auth.company.id, req.params.id);
      res.json({ data: reservation });
    }),
  );

  router.post(
    '/:id/cancel',
    ...cancel,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const reservation = await requireReservation(companyId, req.params.id);
      const { reason } = parseBody(cancelSchema, req.body);
      if (reservation.status !== 'active') {
        throw new ApiError(422, 'Only an active reservation can be cancelled.');
      }
      const updated = await repository.updateReservation(companyId, reservation.id, {
        status: 'cancelled',
        notes: reason ? [reservation.notes, `Cancelled: ${reason}`].filter(Boolean).join('\n') : reservation.notes,
      });
      const unit = await repository.getUnit(companyId, reservation.unit_id);
      if (unit) {
        const [otherReservation, activeSale] = await Promise.all([
          repository.findActiveReservationForUnit(companyId, unit.id),
          repository.findActiveSaleForUnit(companyId, unit.id),
        ]);
        if (!otherReservation && !activeSale && unit.status === 'reserved') {
          await repository.updateUnitStatus(companyId, unit.id, {
            status: 'available',
            reason: `Reservation ${reservation.number} cancelled`,
            changedBy: req.auth.user.id,
          });
        }
      }
      await writeAudit(req, 'Reservation', reservation.id, 'status_changed', {
        status: reservation.status,
      }, { status: 'cancelled', reason: reason || null });
      res.json({ data: await repository.getReservation(companyId, updated.id) });
    }),
  );

  return router;
}

export default createReservationsRouter;
