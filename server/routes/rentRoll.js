import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { matchesSearch, todayIso } from './salesSupport.js';
import { rentSummary } from '../lib/rental.js';

const OPEN_STATUSES = ['upcoming', 'due', 'partly_paid', 'overdue'];

export function createRentRollRouter({ auth, repository }) {
  const router = Router();

  router.get(
    '/',
    auth.requireAuth,
    auth.requirePermission('rent.view'),
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 200 });
      const filters = {
        search: String(req.query.search || '').trim(),
        status: String(req.query.status || '') || null,
        lease_id: String(req.query.lease_id || '') || null,
        tenant_id: String(req.query.tenant_id || '') || null,
        project_id: String(req.query.project_id || '') || null,
        date_from: String(req.query.date_from || '') || null,
        date_to: String(req.query.date_to || '') || null,
      };

      let rows = await repository.listRentSchedules(companyId);
      if (filters.status === 'open') {
        rows = rows.filter((row) => OPEN_STATUSES.includes(row.status));
      } else if (filters.status) {
        rows = rows.filter((row) => row.status === filters.status);
      }
      if (filters.lease_id) rows = rows.filter((row) => row.lease_id === filters.lease_id);
      if (filters.tenant_id) rows = rows.filter((row) => row.tenant_id === filters.tenant_id);
      if (filters.project_id) {
        rows = rows.filter((row) => row.unit?.project_id === filters.project_id);
      }
      if (filters.date_from) rows = rows.filter((row) => row.due_date >= filters.date_from);
      if (filters.date_to) rows = rows.filter((row) => row.due_date <= filters.date_to);
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [
            row.lease_number,
            row.tenant?.name,
            row.unit?.unit_number,
            row.unit?.project?.name,
            row.period_label,
          ]),
        );
      }

      const total = rows.length;
      const start = (page - 1) * limit;
      res.json({
        ...paginated(rows.slice(start, start + limit), total, page, limit),
        summary: rentSummary(rows, { today: todayIso() }),
      });
    }),
  );

  return router;
}

export default createRentRollRouter;
