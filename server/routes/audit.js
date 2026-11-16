import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors.js';
import { parseQuery } from '../lib/validation.js';
import { paginated, parsePagination } from '../lib/pagination.js';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format.')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date.');

const filterSchema = z.object({
  user_id: z.string().uuid('Choose a valid user.').optional(),
  module: z.string().trim().max(100).optional(),
  event: z.enum(['created', 'updated', 'deleted', 'login', 'logout', 'password_changed']).optional(),
  date_from: dateString.optional(),
  date_to: dateString.optional(),
});

const MODULE_LABELS = {
  auth: 'Authentication',
  Company: 'Company settings',
  Branch: 'Branch',
  User: 'Team member',
  Role: 'Role & permissions',
  NumberSequence: 'Number sequence',
};

function moduleLabel(module) {
  if (MODULE_LABELS[module]) return MODULE_LABELS[module];
  return module
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function createAuditRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('audit.view')];

  router.get(
    '/options',
    ...view,
    asyncHandler(async (req, res) => {
      const options = await repository.listAuditOptions(req.auth.company.id);
      const modules = [...new Set([...options.modules, ...Object.keys(MODULE_LABELS)])]
        .sort((a, b) => moduleLabel(a).localeCompare(moduleLabel(b)))
        .map((value) => ({ value, label: moduleLabel(value) }));

      res.json({
        data: {
          modules,
          users: options.users,
          events: [
            { value: 'created', label: 'Created' },
            { value: 'updated', label: 'Updated' },
            { value: 'deleted', label: 'Deleted' },
            { value: 'login', label: 'Signed in' },
            { value: 'logout', label: 'Signed out' },
            { value: 'password_changed', label: 'Password changed' },
          ],
        },
      });
    }),
  );

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const { page, limit } = parsePagination(req.query, { defaultLimit: 25 });
      const filters = parseQuery(filterSchema, req.query);

      const dateFrom = filters.date_from
        ? new Date(`${filters.date_from}T00:00:00.000Z`).toISOString()
        : undefined;
      const dateTo = filters.date_to
        ? new Date(`${filters.date_to}T23:59:59.999Z`).toISOString()
        : undefined;

      const result = await repository.listAuditLogs(req.auth.company.id, {
        page,
        limit,
        userId: filters.user_id,
        module: filters.module,
        event: filters.event,
        dateFrom,
        dateTo,
      });

      res.json(paginated(result.data, result.total, page, limit));
    }),
  );

  return router;
}

export default createAuditRouter;
