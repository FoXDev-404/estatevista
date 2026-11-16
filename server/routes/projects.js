import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import {
  booleanish,
  nullableDate,
  nullableString,
  nullableUuid,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import {
  LAND_AREA_UNITS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  UNIT_AREA_UNITS,
  UNIT_STATUSES,
  generateUnitNumbers,
  slugify,
  validateNumberPattern,
} from '../lib/inventory.js';

const emptyToNull = (value) => (value === '' || value === undefined || value === null ? null : value);
const nullableNumber = z.preprocess(
  emptyToNull,
  z.coerce.number().finite('Enter a number.').nullable(),
);
const numberOrZero = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? 0 : value),
  z.coerce.number().finite('Enter a number.').min(0, 'Enter zero or more.'),
);
const optionalInteger = z.preprocess(emptyToNull, z.coerce.number().int().nullable());
const stringList = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) {
    return value.map((row) => String(row).trim()).filter(Boolean);
  }
  return String(value)
    .split(/\r?\n|,/)
    .map((row) => row.trim())
    .filter(Boolean);
}, z.array(z.string().max(300)).max(150));

const slugField = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .toLowerCase()
    .max(160, 'Use 160 characters or fewer.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.')
    .nullable(),
);

const currencyField = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Use a three-letter currency code.')
    .transform((value) => value.toUpperCase())
    .nullable(),
);

const projectBase = {
  name: z.string().trim().min(1, 'Enter the project name.').max(160),
  code: nullableString(40),
  type: z.enum(PROJECT_TYPES, { message: 'Choose a project type.' }),
  status: z.enum(PROJECT_STATUSES, { message: 'Choose a project status.' }),
  description: nullableString(4000),
  location: nullableString(200),
  city: nullableString(120),
  address: nullableString(500),
  land_area: nullableNumber,
  land_area_unit: z.enum(LAND_AREA_UNITS),
  latitude: z.preprocess(
    emptyToNull,
    z.coerce.number().finite().min(-90).max(90).nullable(),
  ),
  longitude: z.preprocess(
    emptyToNull,
    z.coerce.number().finite().min(-180).max(180).nullable(),
  ),
  booking_amount: numberOrZero,
  budget: numberOrZero,
  currency: currencyField,
  start_date: nullableDate(),
  expected_completion_date: nullableDate(),
  actual_completion_date: nullableDate(),
  is_published: booleanish,
  is_featured: booleanish,
  amenities: stringList,
  specifications: stringList,
  nearby_places: stringList,
  video_url: nullableString(500),
  payment_note: nullableString(4000),
  branch_id: nullableUuid(),
  project_manager_id: nullableUuid(),
  slug: slugField,
};

const createProjectSchema = z.object({
  ...projectBase,
  land_area_unit: z.enum(LAND_AREA_UNITS).default('sqft'),
  booking_amount: numberOrZero.default(0),
  budget: numberOrZero.default(0),
  currency: currencyField.optional(),
  is_published: booleanish.default(false),
  is_featured: booleanish.default(false),
  amenities: stringList.default([]),
  specifications: stringList.default([]),
  nearby_places: stringList.default([]),
  slug: slugField.optional(),
});

const updateProjectSchema = z.object(
  Object.fromEntries(Object.entries(projectBase).map(([key, schema]) => [key, schema.optional()])),
);

const buildingCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter the building code.')
    .max(20, 'Use 20 characters or fewer.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens or underscores.'),
  name: z.string().trim().min(1, 'Enter the building name.').max(120),
  floors_count: z.coerce.number().int().min(1).max(100).default(1),
});

const buildingUpdateSchema = z.object({
  code: buildingCreateSchema.shape.code,
  name: buildingCreateSchema.shape.name,
});

const floorSchema = z.object({
  number: z.coerce.number().int().min(-10).max(200),
  name: nullableString(120),
});

const generateSchema = z.object({
  building_id: z.string().uuid('Choose a building.'),
  floor_from: z.coerce.number().int(),
  floor_to: z.coerce.number().int(),
  units_per_floor: z.coerce
    .number()
    .int()
    .min(1, 'Generate at least one unit per floor.')
    .max(100, 'Generate at most 100 units per floor.'),
  number_pattern: z.string().trim().min(1, 'Enter a numbering pattern.').max(60),
  number_padding: z.coerce.number().int().min(1).max(6).default(2),
  unit_type_id: nullableUuid(),
  area: nullableNumber,
  area_unit: z.enum(UNIT_AREA_UNITS).default('sqft'),
  bedrooms: optionalInteger,
  bathrooms: optionalInteger,
  sale_price: numberOrZero.default(0),
  rent_price: numberOrZero.default(0),
  status: z.enum(UNIT_STATUSES).default('available'),
  description: nullableString(2000),
});

const PROJECT_FIELDS = [
  'name',
  'code',
  'type',
  'status',
  'description',
  'location',
  'city',
  'address',
  'land_area',
  'land_area_unit',
  'latitude',
  'longitude',
  'booking_amount',
  'budget',
  'currency',
  'start_date',
  'expected_completion_date',
  'actual_completion_date',
  'is_published',
  'is_featured',
  'amenities',
  'specifications',
  'nearby_places',
  'video_url',
  'payment_note',
  'branch_id',
  'project_manager_id',
  'slug',
];

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));
}

function titleCase(value) {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function createProjectsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('projects.view')];
  const create = [auth.requireAuth, auth.requirePermission('projects.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('projects.edit'), auth.requireCsrf];
  const remove = [auth.requireAuth, auth.requirePermission('projects.delete'), auth.requireCsrf];

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

  async function requireProject(companyId, projectId) {
    const project = await repository.getProject(companyId, projectId);
    if (!project) throw new ApiError(404, 'Project not found.');
    return project;
  }

  async function validateLinks(companyId, input) {
    if (input.branch_id) {
      const branch = await repository.getBranch(companyId, input.branch_id);
      if (!branch) throw validationError({ branch_id: 'Choose a branch from this company.' });
    }
    if (input.project_manager_id) {
      const manager = await repository.getTeamMember(companyId, input.project_manager_id);
      if (!manager) {
        throw validationError({ project_manager_id: 'Choose a team member from this company.' });
      }
    }
  }

  async function uniqueSlug(companyId, base, excludeId = null) {
    const root = base || 'project';
    let candidate = root;
    let suffix = 2;
    while (await repository.findProjectBySlug(companyId, candidate, excludeId)) {
      candidate = `${root}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit, from, to } = parsePagination(req.query, { defaultLimit: 100 });
      const search = String(req.query.search || '').trim().toLowerCase();
      const type = String(req.query.type || '');
      const status = String(req.query.status || '');

      let rows = await repository.listProjects(companyId);
      if (search) {
        rows = rows.filter((project) =>
          [project.name, project.number, project.code, project.city, project.location]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search)),
        );
      }
      if (type) rows = rows.filter((project) => project.type === type);
      if (status) rows = rows.filter((project) => project.status === status);

      res.json(paginated(rows.slice(from, to + 1), rows.length, page, limit));
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      project.buildings = await repository.listBuildings(companyId, project.id);
      res.json({ data: project });
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createProjectSchema, req.body);
      await validateLinks(companyId, input);

      const number = await repository.nextDocumentNumber(companyId, 'project');
      const slugSource = input.slug || slugify(input.name);
      const slug = input.slug
        ? await (async () => {
            if (await repository.findProjectBySlug(companyId, slugSource)) {
              throw validationError({ slug: 'This web address is already in use.' });
            }
            return slugSource;
          })()
        : await uniqueSlug(companyId, slugSource);

      const project = await repository.createProject(companyId, {
        ...input,
        number,
        code: input.code ? input.code.toUpperCase() : number,
        slug,
        currency: input.currency || req.auth.company.currency || 'USD',
        created_by: req.auth.user.id,
        updated_by: req.auth.user.id,
      });

      await writeAudit(req, 'Project', project.id, 'created', null, pick(project, PROJECT_FIELDS));
      res.status(201).json({ data: project });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const before = await requireProject(companyId, req.params.id);
      const input = parseBody(updateProjectSchema, req.body);
      await validateLinks(companyId, input);

      const merged = { ...before, ...input };
      if ('code' in input) merged.code = input.code ? String(input.code).toUpperCase() : before.code;
      if ('slug' in input) {
        if (input.slug) {
          if (await repository.findProjectBySlug(companyId, input.slug, before.id)) {
            throw validationError({ slug: 'This web address is already in use.' });
          }
          merged.slug = input.slug;
        } else {
          merged.slug = before.slug;
        }
      }
      if ('currency' in input && !input.currency) merged.currency = before.currency;

      const project = await repository.updateProject(
        companyId,
        before.id,
        { ...pick(merged, PROJECT_FIELDS), updated_by: req.auth.user.id },
      );

      await writeAudit(
        req,
        'Project',
        project.id,
        'updated',
        pick(before, PROJECT_FIELDS),
        pick(project, PROJECT_FIELDS),
      );
      res.json({ data: project });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      const units = await repository.countProjectUnits(companyId, project.id);
      if (units) {
        throw new ApiError(
          409,
          'This project still has units. Archive it instead of deleting it, or remove the units first.',
        );
      }

      await repository.deleteProject(companyId, project.id);
      await writeAudit(req, 'Project', project.id, 'deleted', pick(project, PROJECT_FIELDS), null);
      res.json({ data: { ok: true } });
    }),
  );

  router.get(
    '/:id/buildings',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      res.json({ data: await repository.listBuildings(companyId, project.id) });
    }),
  );

  router.post(
    '/:id/buildings',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      const input = parseBody(buildingCreateSchema, req.body);
      const building = await repository.createBuilding(companyId, project.id, input);
      await writeAudit(req, 'Building', building.id, 'created', null, {
        project_id: project.id,
        code: building.code,
        name: building.name,
        floors_count: building.floors_count,
      });
      res.status(201).json({ data: building });
    }),
  );

  router.patch(
    '/:id/buildings/:buildingId',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      const building = await repository.getBuilding(companyId, req.params.buildingId);
      if (!building || building.project_id !== project.id) {
        throw new ApiError(404, 'Building not found.');
      }
      const input = parseBody(buildingUpdateSchema, req.body);
      const updated = await repository.updateBuilding(companyId, building.id, input);
      await writeAudit(
        req,
        'Building',
        building.id,
        'updated',
        { code: building.code, name: building.name },
        { code: updated.code, name: updated.name },
      );
      res.json({ data: updated });
    }),
  );

  router.delete(
    '/:id/buildings/:buildingId',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      const building = await repository.getBuilding(companyId, req.params.buildingId);
      if (!building || building.project_id !== project.id) {
        throw new ApiError(404, 'Building not found.');
      }
      if (building.units_count) {
        throw new ApiError(409, 'This building still has units. Move or delete them first.');
      }
      await repository.deleteBuilding(companyId, building.id);
      await writeAudit(req, 'Building', building.id, 'deleted', {
        project_id: project.id,
        code: building.code,
        name: building.name,
      }, null);
      res.json({ data: { ok: true } });
    }),
  );

  router.post(
    '/:id/buildings/:buildingId/floors',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      const building = await repository.getBuilding(companyId, req.params.buildingId);
      if (!building || building.project_id !== project.id) {
        throw new ApiError(404, 'Building not found.');
      }
      const input = parseBody(floorSchema, req.body);
      const floor = await repository.createFloor(companyId, building.id, input);
      await writeAudit(req, 'Building', building.id, 'updated', null, {
        added_floor: floor.number,
        name: floor.name,
      });
      res.status(201).json({ data: floor });
    }),
  );

  router.delete(
    '/:id/buildings/:buildingId/floors/:floorId',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      const building = await repository.getBuilding(companyId, req.params.buildingId);
      if (!building || building.project_id !== project.id) {
        throw new ApiError(404, 'Building not found.');
      }
      const floor = building.floors.find((row) => row.id === req.params.floorId);
      if (!floor) throw new ApiError(404, 'Floor not found.');
      if (floor.units_count) {
        throw new ApiError(409, 'This floor still has units. Move or delete them first.');
      }
      await repository.deleteFloor(companyId, building.id, floor.id);
      await writeAudit(req, 'Building', building.id, 'updated', { removed_floor: floor.number }, null);
      res.json({ data: { ok: true } });
    }),
  );

  router.post(
    '/:id/units/generate',
    ...edit,
    auth.requirePermission('units.create'),
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const project = await requireProject(companyId, req.params.id);
      const input = parseBody(generateSchema, req.body);

      const patternError = validateNumberPattern(input.number_pattern);
      if (patternError) throw validationError({ number_pattern: patternError });

      const building = await repository.getBuilding(companyId, input.building_id);
      if (!building || building.project_id !== project.id) {
        throw validationError({ building_id: 'Choose a building from this project.' });
      }
      const floors = building.floors.filter(
        (floor) => floor.number >= input.floor_from && floor.number <= input.floor_to,
      );
      if (!floors.length || input.floor_to < input.floor_from) {
        throw validationError({ floor_to: 'Choose a floor range that exists in the building.' });
      }
      const total = floors.length * input.units_per_floor;
      if (total > 200) {
        throw validationError({
          units_per_floor: 'Generate at most 200 units at a time.',
        });
      }

      if (input.unit_type_id) {
        const unitType = await repository.getUnitType(companyId, input.unit_type_id);
        if (!unitType) {
          throw validationError({ unit_type_id: 'Choose a unit type from this company.' });
        }
      }

      const existing = new Set(await repository.listProjectUnitNumbers(companyId, project.id));
      const rows = [];
      const duplicates = new Set();
      for (const floor of floors) {
        const numbers = generateUnitNumbers({
          floors: [floor],
          unitsPerFloor: input.units_per_floor,
          numberPattern: input.number_pattern,
          numberPadding: input.number_padding,
        });
        for (const unitNumber of numbers) {
          if (existing.has(unitNumber) || duplicates.has(unitNumber)) {
            duplicates.add(unitNumber);
            continue;
          }
          existing.add(unitNumber);
          rows.push({
            project_id: project.id,
            building_id: building.id,
            floor_id: floor.id,
            unit_type_id: input.unit_type_id,
            unit_number: unitNumber,
            area: input.area,
            area_unit: input.area_unit,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            sale_price: input.sale_price,
            rent_price: input.rent_price,
            status: input.status,
            description: input.description,
          });
        }
      }

      if (duplicates.size) {
        throw new ApiError(
          422,
          `Some of these unit numbers already exist: ${[...duplicates].slice(0, 10).join(', ')}.`,
        );
      }

      const units = await repository.createUnits(companyId, rows);
      await writeAudit(req, 'Unit', project.id, 'created', null, {
        project_id: project.id,
        building_id: building.id,
        count: units.length,
        unit_numbers: units.map((unit) => unit.unit_number),
      });
      res.status(201).json({ data: units, meta: { created: units.length } });
    }),
  );

  return router;
}

export { titleCase };
export default createProjectsRouter;
