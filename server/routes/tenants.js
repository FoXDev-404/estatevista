import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import {
  nullableDate,
  nullableEmail,
  nullableString,
  optionalBooleanish,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { matchesSearch } from './salesSupport.js';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Enter the tenant name.').max(255),
  type: z.enum(['individual', 'company']).default('individual'),
  phone: z.string().trim().min(1, 'Enter a phone number.').max(50),
  alternate_phone: nullableString(50),
  email: nullableEmail(),
  national_id_type: nullableString(50),
  national_id_number: nullableString(80),
  date_of_birth: nullableDate(),
  occupation: nullableString(120),
  address: nullableString(500),
  city: nullableString(120),
  country: nullableString(80),
  notes: nullableString(2000),
  is_active: optionalBooleanish,
});

const updateSchema = createSchema.partial();

export function createTenantsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('tenants.view')];
  const create = [auth.requireAuth, auth.requirePermission('tenants.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('tenants.edit'), auth.requireCsrf];
  const remove = [auth.requireAuth, auth.requirePermission('tenants.delete'), auth.requireCsrf];

  const writeAudit = (req, recordId, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module: 'Tenant',
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
        occupancy: String(req.query.occupancy || '') || null,
        type: String(req.query.type || '') || null,
        is_active: String(req.query.is_active || '') || null,
      };

      let rows = await repository.listTenants(companyId);
      if (filters.type) rows = rows.filter((row) => row.type === filters.type);
      if (filters.occupancy === 'current') {
        rows = rows.filter((row) => row.current_lease);
      } else if (filters.occupancy === 'without') {
        rows = rows.filter((row) => !row.current_lease);
      }
      if (filters.is_active === 'true' || filters.is_active === 'false') {
        const active = filters.is_active === 'true';
        rows = rows.filter((row) => Boolean(row.is_active) === active);
      }
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [
            row.name,
            row.phone,
            row.email,
            row.national_id_number,
            row.current_unit,
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
      if (!input.phone) {
        throw validationError({ phone: 'Enter a phone number.' });
      }
      const tenant = await repository.createTenant(companyId, {
        ...input,
        created_by: req.auth.user.id,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, tenant.id, 'created', null, {
        name: tenant.name,
        phone: tenant.phone,
        type: tenant.type,
      });
      res.status(201).json({ data: tenant });
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const tenant = await repository.getTenant(req.auth.company.id, req.params.id);
      if (!tenant) throw new ApiError(404, 'Tenant not found.');
      res.json({ data: tenant });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const current = await repository.getTenant(companyId, req.params.id);
      if (!current) throw new ApiError(404, 'Tenant not found.');
      const input = parseBody(updateSchema, req.body);
      const tenant = await repository.updateTenant(companyId, current.id, {
        ...input,
        updated_by: req.auth.user.id,
      });
      await writeAudit(req, tenant.id, 'updated', { name: current.name }, { name: tenant.name });
      res.json({ data: tenant });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const tenant = await repository.getTenant(companyId, req.params.id);
      if (!tenant) throw new ApiError(404, 'Tenant not found.');
      const activeLeases = await repository.countTenantActiveLeases(companyId, tenant.id);
      if (activeLeases > 0) {
        throw new ApiError(409, 'End the tenant’s active lease before deleting the tenant.');
      }
      await repository.deleteTenant(companyId, tenant.id);
      await writeAudit(req, tenant.id, 'deleted', { name: tenant.name }, null);
      res.json({ data: { id: tenant.id } });
    }),
  );

  return router;
}

export default createTenantsRouter;
