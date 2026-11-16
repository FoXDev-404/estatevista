import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import { nullableString, parseBody } from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { PERMISSION_GROUPS, PERMISSION_KEYS } from '../auth/permissions.js';

const roleSchema = z.object({
  name: z.string().trim().min(1, 'Enter the role name.').max(80),
  description: nullableString(500),
  permission_keys: z.array(z.string()).default([]),
});

const roleUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Enter the role name.').max(80),
  description: nullableString(500),
  permission_keys: z.array(z.string()).optional(),
});

function uniquePermissionKeys(keys) {
  return [...new Set(keys)].sort();
}

function validatePermissionKeys(keys) {
  const unknown = keys.find((key) => !PERMISSION_KEYS.includes(key));
  if (unknown) {
    throw validationError({ permission_keys: 'Choose permissions from the available catalog.' });
  }
}

function roleSnapshot(role) {
  if (!role) return null;
  return {
    name: role.name,
    description: role.description,
    permission_keys: role.permission_keys || [],
  };
}

export function createRolesRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('roles.view')];
  const create = [auth.requireAuth, auth.requirePermission('roles.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('roles.edit'), auth.requireCsrf];
  const remove = [auth.requireAuth, auth.requirePermission('roles.delete'), auth.requireCsrf];

  const writeAudit = (req, roleId, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module: 'Role',
      recordId: roleId,
      event,
      before,
      after,
      ip: clientIp(req),
    });

  router.get(
    '/permissions',
    ...view,
    asyncHandler(async (_req, res) => {
      res.json({
        data: {
          groups: PERMISSION_GROUPS,
          total: PERMISSION_KEYS.length,
        },
      });
    }),
  );

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const roles = await repository.listRoles(req.auth.company.id);
      res.json({ data: roles });
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const role = await repository.getRole(req.auth.company.id, req.params.id);
      if (!role) throw new ApiError(404, 'Role not found.');
      res.json({ data: role });
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(roleSchema, req.body);
      const permissionKeys = uniquePermissionKeys(input.permission_keys);
      validatePermissionKeys(permissionKeys);

      const role = await repository.createRole(
        companyId,
        { name: input.name, description: input.description, is_default: false },
        permissionKeys,
      );
      await writeAudit(req, role.id, 'created', null, roleSnapshot(role));
      res.status(201).json({ data: role });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const roleId = req.params.id;
      const input = parseBody(roleUpdateSchema, req.body);
      const permissionKeys = input.permission_keys
        ? uniquePermissionKeys(input.permission_keys)
        : undefined;
      if (permissionKeys) validatePermissionKeys(permissionKeys);

      const before = await repository.getRole(companyId, roleId);
      if (!before) throw new ApiError(404, 'Role not found.');

      const role = await repository.updateRole(
        companyId,
        roleId,
        { name: input.name, description: input.description },
        permissionKeys,
      );
      await writeAudit(req, roleId, 'updated', roleSnapshot(before), roleSnapshot(role));
      res.json({ data: role });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const roleId = req.params.id;
      const role = await repository.getRole(companyId, roleId);
      if (!role) throw new ApiError(404, 'Role not found.');

      if (role.is_default) {
        throw new ApiError(409, 'Default roles cannot be deleted. Edit their permissions instead.');
      }
      if ((role.member_count || 0) > 0) {
        throw new ApiError(409, 'This role is assigned to team members. Remove it from them first.');
      }

      await repository.deleteRole(companyId, roleId);
      await writeAudit(req, roleId, 'deleted', roleSnapshot(role), null);
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}

export default createRolesRouter;
