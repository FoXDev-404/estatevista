import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { matchesSearch } from './salesSupport.js';

export function createInstallmentsRouter({ auth, repository }) {
  const router = Router();
  const view = [auth.requireAuth, auth.requirePermission('sales.view')];

  router.get(
    '/',
    ...view,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit } = parsePagination(req.query, { defaultLimit: 25 });
      const filters = {
        search: String(req.query.search || '').trim(),
        status: String(req.query.status || '') || null,
        project_id: String(req.query.project_id || '') || null,
        sale_id: String(req.query.sale_id || '') || null,
        date_from: String(req.query.date_from || '') || null,
        date_to: String(req.query.date_to || '') || null,
      };

      let rows = await repository.listInstallments(companyId);
      if (filters.sale_id) rows = rows.filter((row) => row.sale_id === filters.sale_id);
      if (filters.status === 'open') {
        rows = rows.filter((row) => !['paid', 'waived', 'cancelled'].includes(row.status));
      } else if (filters.status) {
        rows = rows.filter((row) => row.status === filters.status);
      }
      if (filters.project_id) {
        rows = rows.filter((row) => row.sale?.project_id === filters.project_id);
      }
      if (filters.date_from) rows = rows.filter((row) => row.due_date >= filters.date_from);
      if (filters.date_to) rows = rows.filter((row) => row.due_date <= filters.date_to);
      if (filters.search) {
        rows = rows.filter((row) =>
          matchesSearch(filters.search, [
            row.sale?.number,
            row.sale?.customer?.name,
            row.sale?.unit?.unit_number,
          ]),
        );
      }

      rows = [...rows].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
      const total = rows.length;
      const start = (page - 1) * limit;
      res.json(paginated(rows.slice(start, start + limit), total, page, limit));
    }),
  );

  return router;
}

export default createInstallmentsRouter;
