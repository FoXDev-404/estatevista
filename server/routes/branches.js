import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler, validationError } from '../lib/errors.js';
import {
  booleanish,
  nullableEmail,
  nullableString,
  nullableUuid,
  parseBody,
} from '../lib/validation.js';
import { clientIp } from '../lib/scoping.js';
import { paginated, parsePagination } from '../lib/pagination.js';

const branchSchema = z.object({
  name: z.string().trim().min(1, 'Enter the branch name.').max(120),
  code: z
    .string()
    .trim()
    .min(1, 'Enter a branch code.')
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, hyphens or underscores.'),
  phone: nullableString(50),
  email: nullableEmail(),
  address: nullableString(500),
  manager_id: nullableUuid(),
  is_active: booleanish,
});

const statusSchema = z.object({
  is_active: booleanish,
});

const BRANCH_FIELDS = ['name', 'code', 'phone', 'email', 'address', 'manager_id', 'is_active'];

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source?.[field] ?? null]));
}

export function createBranchesRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('branches.view')];
  const create = [auth.requireAuth, auth.requirePermission('branches.create'), auth.requireCsrf];
  const edit = [auth.requireAuth, auth.requirePermission('branches.edit'), auth.requireCsrf];
  const remove = [auth.requireAuth, auth.requirePermission('branches.delete'), auth.requireCsrf];

  const writeAudit = (req, branch, event, before, after) =>
    repository.writeAudit({
      companyId: req.auth.company.id,
      userId: req.auth.user.id,
      module: 'Branch',
      recordId: branch.id,
      event,
      before,
      after,
      ip: clientIp(req),
    });

  async function validateManager(companyId, managerId) {
    if (!managerId) return;
    const manager = await repository.getTeamMember(companyId, managerId);
    if (!manager) {
      throw validationError({ manager_id: 'Choose a team member from this company.' });
    }
  }

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit, from, to } = parsePagination(req.query, { defaultLimit: 50 });
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '');

      let rows = await repository.listBranches(companyId);

      if (search) {
        rows = rows.filter(
          (branch) =>
            branch.name.toLowerCase().includes(search) ||
            branch.code.toLowerCase().includes(search) ||
            branch.email?.toLowerCase().includes(search) ||
            branch.phone?.toLowerCase().includes(search),
        );
      }
      if (status === 'active') rows = rows.filter((branch) => branch.is_active);
      if (status === 'inactive') rows = rows.filter((branch) => !branch.is_active);

      return res.json(paginated(rows.slice(from, to + 1), rows.length, page, limit));
    }),
  );

  router.get(
    '/:id',
    ...view,
    asyncHandler(async (req, res) => {
      const branch = await repository.getBranch(req.auth.company.id, req.params.id);
      if (!branch) throw new ApiError(404, 'Branch not found.');
      res.json({ data: branch });
    }),
  );

  router.post(
    '/',
    ...create,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const input = parseBody(branchSchema, req.body);
      await validateManager(companyId, input.manager_id);

      const branch = await repository.createBranch(companyId, input);
      await writeAudit(req, branch, 'created', null, pick(branch, BRANCH_FIELDS));
      res.status(201).json({ data: branch });
    }),
  );

  router.patch(
    '/:id',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const branchId = req.params.id;
      const input = parseBody(branchSchema, req.body);
      const before = await repository.getBranch(companyId, branchId);
      if (!before) throw new ApiError(404, 'Branch not found.');
      await validateManager(companyId, input.manager_id);

      const branch = await repository.updateBranch(companyId, branchId, input);
      await writeAudit(
        req,
        branch,
        'updated',
        pick(before, BRANCH_FIELDS),
        pick(branch, BRANCH_FIELDS),
      );
      res.json({ data: branch });
    }),
  );

  router.patch(
    '/:id/status',
    ...edit,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const branchId = req.params.id;
      const input = parseBody(statusSchema, req.body);
      const before = await repository.getBranch(companyId, branchId);
      if (!before) throw new ApiError(404, 'Branch not found.');

      const branch = await repository.updateBranch(companyId, branchId, {
        is_active: input.is_active,
      });
      await writeAudit(
        req,
        branch,
        'updated',
        { is_active: before.is_active },
        { is_active: branch.is_active },
      );
      res.json({ data: branch });
    }),
  );

  router.delete(
    '/:id',
    ...remove,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const branchId = req.params.id;
      const branch = await repository.getBranch(companyId, branchId);
      if (!branch) throw new ApiError(404, 'Branch not found.');

      const [teamCount, projectCount] = await Promise.all([
        repository.countBranchTeam(companyId, branchId),
        repository.countBranchProjects(companyId, branchId),
      ]);

      if (teamCount || projectCount) {
        throw new ApiError(
          409,
          'This branch is linked to team members or projects. Deactivate it instead of deleting it.',
        );
      }

      await repository.deleteBranch(companyId, branchId);
      await writeAudit(req, branch, 'deleted', pick(branch, BRANCH_FIELDS), null);
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}

export default createBranchesRouter;
