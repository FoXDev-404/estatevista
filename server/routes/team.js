import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, forbidden, validationError } from '../lib/errors.js';
import {
  booleanish,
  nullableString,
  nullableUuid,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { hashPassword } from '../auth/password.js';

const passwordRule = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(200)
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

const sharedFields = {
  name: z.string().trim().min(1, 'Enter the team member name.').max(120),
  email: z.string().trim().min(1, 'Enter an email address.').email('Enter a valid email address.'),
  phone: nullableString(50),
  branch_id: nullableUuid(),
  full_access: booleanish,
};

const createSchema = z
  .object({
    ...sharedFields,
    role_ids: z.array(z.string().uuid('Choose a valid role.')).default([]),
    password: z.string().min(1, 'Enter a password.'),
    password_confirmation: z.string().min(1, 'Confirm the password.'),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.password_confirmation) {
      ctx.addIssue({
        code: 'custom',
        path: ['password_confirmation'],
        message: 'The passwords do not match.',
      });
      return;
    }
    const result = passwordRule.safeParse(value.password);
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: result.error.issues[0].message,
      });
    }
  });

const updateSchema = z
  .object({
    ...sharedFields,
    is_active: booleanish,
    role_ids: z.array(z.string().uuid('Choose a valid role.')).optional(),
    password: z.string().optional(),
    password_confirmation: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasPassword = Boolean(value.password);
    const hasConfirmation = Boolean(value.password_confirmation);
    if (hasPassword !== hasConfirmation) {
      ctx.addIssue({
        code: 'custom',
        path: ['password_confirmation'],
        message: 'Enter and confirm the new password.',
      });
      return;
    }
    if (!hasPassword) return;
    if (value.password !== value.password_confirmation) {
      ctx.addIssue({
        code: 'custom',
        path: ['password_confirmation'],
        message: 'The passwords do not match.',
      });
      return;
    }
    const result = passwordRule.safeParse(value.password);
    if (!result.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['password'],
        message: result.error.issues[0].message,
      });
    }
  });

const statusSchema = z.object({ is_active: booleanish });

function memberSnapshot(member) {
  if (!member) return null;
  return {
    name: member.name,
    email: member.email,
    phone: member.phone,
    branch_id: member.branch_id,
    branch: member.branch?.name || null,
    full_access: member.full_access,
    is_active: member.is_active,
    roles: (member.roles || []).map((role) => role.name),
  };
}

function roleIdsOf(member) {
  return (member?.roles || []).map((role) => role.id).sort();
}

function sameIds(left = [], right = []) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function createTeamRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('team.view')];
  const create = [auth.requireAuth, auth.requirePermission('team.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('team.edit'), auth.requireCsrf];

  const writeAudit = (req, member, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module: 'User',
      recordId: member.id,
      event,
      before,
      after,
      ip: clientIp(req),
    });

  async function validateReferences(companyId, input) {
    if (input.branch_id) {
      const branch = await repository.getBranch(companyId, input.branch_id);
      if (!branch) {
        throw validationError({ branch_id: 'Choose a branch from this company.' });
      }
    }

    if (input.role_ids?.length) {
      const roles = await repository.listRoles(companyId);
      const validIds = new Set(roles.map((role) => role.id));
      const invalid = input.role_ids.find((roleId) => !validIds.has(roleId));
      if (invalid) {
        throw validationError({ role_ids: 'Choose roles from this company.' });
      }
    }
  }

  async function ensureEmailAvailable(companyId, email, currentId = null) {
    const existing = await repository.findTeamMemberByEmail(companyId, email);
    if (existing && existing.id !== currentId) {
      throw validationError({
        email: 'This email is already used by another team member.',
      });
    }
  }

  function assertCanSetFullAccess(req, nextValue, currentValue = false) {
    if (nextValue === currentValue) return;
    if (!req.auth.user.full_access) {
      throw forbidden('Only a full-access administrator can change full-access access.');
    }
    if (nextValue && !req.auth.user.full_access) {
      throw forbidden('Only a full-access administrator can grant full access.');
    }
  }

  async function ensureFullAccessRemains(companyId, member, nextActive, nextFullAccess) {
    if (!member.full_access) return;
    if (nextActive && nextFullAccess) return;
    const remaining = await repository.countActiveFullAccess(companyId, member.id);
    if (!remaining) {
      throw validationError({
        is_active: 'At least one active full-access administrator must remain.',
      });
    }
  }

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit, from, to } = parsePagination(req.query, { defaultLimit: 50 });
      const search = String(req.query.search || '').trim().toLowerCase();
      const branchId = String(req.query.branch_id || '');
      const status = String(req.query.status || '');

      let rows = await repository.listTeam(companyId);

      if (search) {
        rows = rows.filter(
          (member) =>
            member.name.toLowerCase().includes(search) ||
            member.email.toLowerCase().includes(search) ||
            member.phone?.toLowerCase().includes(search),
        );
      }
      if (branchId) rows = rows.filter((member) => member.branch_id === branchId);
      if (status === 'active') rows = rows.filter((member) => member.is_active);
      if (status === 'inactive') rows = rows.filter((member) => !member.is_active);

      return res.json(paginated(rows.slice(from, to + 1), rows.length, page, limit));
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const member = await repository.getTeamMember(req.auth.company.id, req.params.id);
      if (!member) throw new ApiError(404, 'Team member not found.');
      res.json({ data: member });
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(createSchema, req.body);
      assertCanSetFullAccess(req, input.full_access, false);
      await validateReferences(companyId, input);
      await ensureEmailAvailable(companyId, input.email);

      const member = await repository.createTeamMember(
        companyId,
        {
          name: input.name,
          email: input.email.toLowerCase(),
          phone: input.phone,
          branch_id: input.branch_id,
          full_access: input.full_access,
          is_active: true,
          password_hash: await hashPassword(input.password),
        },
        input.role_ids,
      );

      await writeAudit(req, member, 'created', null, memberSnapshot(member));
      res.status(201).json({ data: member });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const memberId = req.params.id;
      const input = parseBody(updateSchema, req.body);
      const before = await repository.getTeamMember(companyId, memberId);
      if (!before) throw new ApiError(404, 'Team member not found.');

      const isSelf = memberId === req.auth.user.id;
      if (isSelf && !input.is_active) {
        throw validationError({ is_active: 'You cannot deactivate your own account.' });
      }
      if (isSelf && input.full_access !== before.full_access) {
        throw validationError({ full_access: 'You cannot change your own access mode.' });
      }
      if (isSelf && input.role_ids && !sameIds(input.role_ids, roleIdsOf(before))) {
        throw validationError({ role_ids: 'You cannot change your own roles.' });
      }

      assertCanSetFullAccess(req, input.full_access, before.full_access);
      await validateReferences(companyId, input);
      await ensureEmailAvailable(companyId, input.email, memberId);
      await ensureFullAccessRemains(companyId, before, input.is_active, input.full_access);

      const patch = {
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone,
        branch_id: input.branch_id,
        full_access: input.full_access,
        is_active: input.is_active,
      };
      if (input.password) patch.password_hash = await hashPassword(input.password);

      const member = await repository.updateTeamMember(companyId, memberId, patch, input.role_ids);

      if (!input.is_active || input.password) {
        await repository.deleteSessionsForUser(memberId);
      }

      await writeAudit(req, member, 'updated', memberSnapshot(before), memberSnapshot(member));
      res.json({ data: member });
    }),
  );

  router.patch(
    '/:id/status',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const memberId = req.params.id;
      const input = parseBody(statusSchema, req.body);
      const before = await repository.getTeamMember(companyId, memberId);
      if (!before) throw new ApiError(404, 'Team member not found.');

      if (memberId === req.auth.user.id && !input.is_active) {
        throw validationError({ is_active: 'You cannot deactivate your own account.' });
      }
      await ensureFullAccessRemains(companyId, before, input.is_active, before.full_access);

      const member = await repository.updateTeamMember(companyId, memberId, {
        is_active: input.is_active,
      });

      if (!input.is_active) await repository.deleteSessionsForUser(memberId);

      await writeAudit(
        req,
        member,
        'updated',
        { is_active: before.is_active },
        { is_active: member.is_active },
      );
      res.json({ data: member });
    }),
  );

  return router;
}

export default createTeamRouter;
