import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { nullableString, nullableUuid, parseBody } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { UNIT_AREA_UNITS, UNIT_STATUSES, canTransitionUnit } from '../lib/inventory.js';

const emptyToNull = (value) => (value === '' || value === undefined || value === null ? null : value);
const nullableNumber = z.preprocess(
  emptyToNull,
  z.coerce.number().finite('Enter a number.').nullable(),
);
const optionalInteger = z.preprocess(emptyToNull, z.coerce.number().int().nullable());
const numberOrZero = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);

const unitNumber = z
  .string()
  .trim()
  .min(1, 'Enter the unit number.')
  .max(60, 'Use 60 characters or fewer.');

const unitBase = {
  unit_number: unitNumber,
  building_id: nullableUuid(),
  floor_id: nullableUuid(),
  unit_type_id: nullableUuid(),
  area: nullableNumber,
  area_unit: z.enum(UNIT_AREA_UNITS),
  bedrooms: optionalInteger,
  bathrooms: optionalInteger,
  sale_price: numberOrZero,
  rent_price: numberOrZero,
  status: z.enum(UNIT_STATUSES),
  description: nullableString(2000),
};

const createUnitSchema = z.object({
  project_id: z.string().uuid('Choose a project.'),
  ...unitBase,
  area_unit: z.enum(UNIT_AREA_UNITS).default('sqft'),
  sale_price: numberOrZero.default(0),
  rent_price: numberOrZero.default(0),
  status: z.enum(UNIT_STATUSES).default('available'),
});

const updateUnitSchema = z.object(
  Object.fromEntries(
    Object.entries(unitBase)
      .filter(([key]) => key !== 'status')
      .map(([key, schema]) => [key, schema.optional()]),
  ),
);

const statusSchema = z.object({
  status: z.enum(UNIT_STATUSES, { message: 'Choose a unit status.' }),
  reason: nullableString(500),
});

const UNIT_FIELDS = [
  'unit_number',
  'building_id',
  'floor_id',
  'unit_type_id',
  'area',
  'area_unit',
  'bedrooms',
  'bathrooms',
  'sale_price',
  'rent_price',
  'status',
  'description',
];

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));
}

export function createUnitsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('units.view')];
  const create = [auth.requireAuth, auth.requirePermission('units.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('units.edit'), auth.requireCsrf];
  const remove = [auth.requireAuth, auth.requirePermission('units.delete'), auth.requireCsrf];

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

  async function requireUnit(companyId, unitId) {
    const unit = await repository.getUnit(companyId, unitId);
    if (!unit) throw new ApiError(404, 'Unit not found.');
    return unit;
  }

  async function validateLinks(companyId, projectId, input) {
    const project = await repository.getProject(companyId, projectId);
    if (!project) throw new ApiError(404, 'Project not found.');

    let building = null;
    if (input.building_id) {
      building = await repository.getBuilding(companyId, input.building_id);
      if (!building || building.project_id !== project.id) {
        throw validationError({ building_id: 'Choose a building from this project.' });
      }
    }

    if (input.floor_id) {
      if (!input.building_id) {
        throw validationError({ floor_id: 'Choose a building before choosing the floor.' });
      }
      const floor = building?.floors.find((row) => row.id === input.floor_id);
      if (!floor) {
        throw validationError({ floor_id: 'Choose a floor from this building.' });
      }
    }

    if (input.unit_type_id) {
      const unitType = await repository.getUnitType(companyId, input.unit_type_id);
      if (!unitType) {
        throw validationError({ unit_type_id: 'Choose a unit type from this company.' });
      }
    }

    return project;
  }

  async function assertNumberAvailable(companyId, projectId, unitNumber, excludeId = null) {
    const existing = await repository.findUnitByNumber(companyId, projectId, unitNumber, excludeId);
    if (existing) {
      throw validationError({ unit_number: 'This unit number is already used in the project.' });
    }
  }

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit, from, to } = parsePagination(req.query, { defaultLimit: 25 });
      const filters = {
        search: String(req.query.search || '').trim(),
        project_id: String(req.query.project_id || '') || null,
        building_id: String(req.query.building_id || '') || null,
        unit_type_id: String(req.query.unit_type_id || '') || null,
        status: String(req.query.status || '') || null,
      };

      const { data, total } = await repository.listUnits(companyId, { ...filters, from, to });
      res.json(paginated(data, total, page, limit));
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const unit = await requireUnit(req.auth.company.id, req.params.id);
      res.json({ data: unit });
    }),
  );

  router.get(
    '/:id/history',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const unit = await requireUnit(companyId, req.params.id);
      res.json({ data: await repository.listUnitHistory(companyId, unit.id) });
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createUnitSchema, req.body);
      await validateLinks(companyId, input.project_id, input);
      await assertNumberAvailable(companyId, input.project_id, input.unit_number);

      if (input.status !== 'available' && input.status !== 'draft') {
        throw validationError({
          status: 'New units must start as available or draft.',
        });
      }

      const unit = await repository.createUnit(companyId, input);
      await writeAudit(req, 'Unit', unit.id, 'created', null, pick(unit, UNIT_FIELDS));
      res.status(201).json({ data: unit });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const before = await requireUnit(companyId, req.params.id);
      if (Object.hasOwn(req.body || {}, 'status')) {
        throw validationError({
          status: 'Use the status action to change the unit status.',
        });
      }
      const input = parseBody(updateUnitSchema, req.body);

      const merged = { ...before, ...input };
      await validateLinks(companyId, before.project_id, merged);

      if (input.unit_number && input.unit_number !== before.unit_number) {
        await assertNumberAvailable(companyId, before.project_id, input.unit_number, before.id);
      }

      const unit = await repository.updateUnit(companyId, before.id, pick(merged, UNIT_FIELDS));
      await writeAudit(
        req,
        'Unit',
        unit.id,
        'updated',
        pick(before, UNIT_FIELDS),
        pick(unit, UNIT_FIELDS),
      );
      res.json({ data: unit });
    }),
  );

  router.patch(
    '/:id/status',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const before = await requireUnit(companyId, req.params.id);
      const input = parseBody(statusSchema, req.body);

      if (!canTransitionUnit(before.status, input.status)) {
        throw validationError({
          status: `A ${before.status.replaceAll('_', ' ')} unit cannot move to ${input.status.replaceAll('_', ' ')}.`,
        });
      }

      const contracts = await repository.countActiveUnitContracts(companyId, before.id);
      const hasContract = contracts.reservations + contracts.sales + contracts.leases > 0;
      if (
        hasContract &&
        (['reserved', 'sold', 'rented'].includes(input.status) ||
          ['reserved', 'sold', 'rented'].includes(before.status))
      ) {
        throw new ApiError(
          409,
          'This unit has an active reservation, sale or lease. Close it before changing the unit status.',
        );
      }

      if (input.status === before.status) {
        return res.json({ data: before });
      }

      const unit = await repository.updateUnitStatus(companyId, before.id, {
        status: input.status,
        reason: input.reason,
        changedBy: req.auth.user.id,
      });
      await writeAudit(
        req,
        'Unit',
        unit.id,
        'updated',
        { status: before.status },
        { status: unit.status, reason: input.reason },
      );
      res.json({ data: unit });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const unit = await requireUnit(companyId, req.params.id);

      if (['reserved', 'sold', 'rented'].includes(unit.status)) {
        throw new ApiError(
          409,
          'Units that are reserved, sold or rented cannot be deleted. Close the active contract first.',
        );
      }
      const contracts = await repository.countActiveUnitContracts(companyId, unit.id);
      if (contracts.reservations + contracts.sales + contracts.leases > 0) {
        throw new ApiError(
          409,
          'This unit has an active reservation, sale or lease and cannot be deleted.',
        );
      }

      await repository.deleteUnit(companyId, unit.id);
      await writeAudit(req, 'Unit', unit.id, 'deleted', pick(unit, UNIT_FIELDS), null);
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}

export default createUnitsRouter;
