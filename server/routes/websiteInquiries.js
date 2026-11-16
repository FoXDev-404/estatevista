import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';
import { paginated, parsePagination } from '../lib/pagination.js';
import { websiteInquiryView } from '../lib/inquiries.js';

export function createWebsiteInquiriesRouter({ auth, repository }) {
  const router = Router();

  // GET /api/website-inquiries — authenticated inbox for public form submissions.
  router.get(
    '/',
    auth.requireAuth,
    auth.requirePermission('inquiries.view'),
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const { page, limit, from, to } = parsePagination(req.query, { defaultLimit: 20 });
      const search = String(req.query.search || '').trim().toLowerCase();
      const type = String(req.query.type || '');
      const status = String(req.query.status || '');

      let rows = await repository.listWebsiteInquiries(companyId);
      if (type) rows = rows.filter((row) => row.type === type);
      if (status) rows = rows.filter((row) => row.status === status);
      if (search) {
        rows = rows.filter((row) =>
          [row.name, row.phone, row.email, row.message, row.source_page]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search)),
        );
      }

      res.json(
        paginated(
          rows.slice(from, to + 1).map((row) => websiteInquiryView(row)),
          rows.length,
          page,
          limit,
        ),
      );
    }),
  );

  return router;
}

export default createWebsiteInquiriesRouter;
