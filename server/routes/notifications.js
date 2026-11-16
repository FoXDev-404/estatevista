import { Router } from 'express';
import { ApiError, asyncHandler } from '../lib/errors.js';
import { paginated, parsePagination } from '../lib/pagination.js';

export function createNotificationsRouter({ auth, repository }) {
  const router = Router();
  const signedIn = [auth.requireAuth];
  const write = [auth.requireAuth, auth.requireCsrf];

  async function unreadCount(req) {
    return repository.countUnreadNotifications(req.auth.company.id, req.auth.user.id);
  }

  router.get(
    '/',
    ...signedIn,
    asyncHandler(async (req, res) => {
      const companyId = req.auth.company.id;
      const userId = req.auth.user.id;
      const { page, limit, from } = parsePagination(req.query, {
        defaultLimit: 10,
        maxLimit: 50,
      });
      const unreadOnly = ['1', 'true', 'yes'].includes(String(req.query.unread || ''));

      const [rows, total, unread] = await Promise.all([
        repository.listNotifications(companyId, userId, {
          unreadOnly,
          limit,
          offset: from,
        }),
        repository.countNotifications(companyId, userId, { unreadOnly }),
        unreadCount(req),
      ]);

      const response = paginated(rows, total, page, limit);
      response.meta.unread_count = unread;
      res.json(response);
    }),
  );

  router.post(
    '/read-all',
    ...write,
    asyncHandler(async (req, res) => {
      const updated = await repository.markAllNotificationsRead(
        req.auth.company.id,
        req.auth.user.id,
      );
      res.json({ data: { updated, unread_count: 0 } });
    }),
  );

  router.post(
    '/:id/read',
    ...write,
    asyncHandler(async (req, res) => {
      const notification = await repository.markNotificationRead(
        req.auth.company.id,
        req.auth.user.id,
        req.params.id,
      );
      if (!notification) throw new ApiError(404, 'Notification not found.');
      res.json({
        data: {
          notification,
          unread_count: await unreadCount(req),
        },
      });
    }),
  );

  return router;
}

export default createNotificationsRouter;
