import { ApiError } from '../lib/errors.js';
import { SESSION_COOKIE } from '../lib/cookies.js';

export function createAuthMiddleware({ service, cookieName = SESSION_COOKIE }) {
  async function attachAuth(req, _res, next) {
    try {
      const token = req.cookies?.[cookieName];
      req.auth = token ? await service.authenticate(token) : null;
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireAuth(req, _res, next) {
    if (!req.auth) return next(new ApiError(401, 'Sign in to continue.'));
    return next();
  }

  function requirePermission(permission) {
    return function permissionGuard(req, _res, next) {
      if (!req.auth) return next(new ApiError(401, 'Sign in to continue.'));

      const permissions = req.auth.permissions || [];
      const allowed =
        req.auth.user?.full_access ||
        permissions.includes('*') ||
        permissions.includes(permission);

      if (!allowed) {
        return next(new ApiError(403, 'You do not have permission to do that.'));
      }
      return next();
    };
  }

  function requireCsrf(req, _res, next) {
    if (!req.auth) return next(new ApiError(401, 'Sign in to continue.'));

    const token = req.get('x-csrf-token') || req.body?._csrf;
    if (!service.validateCsrf(req.auth, token)) {
      return next(
        new ApiError(403, 'Your session could not be verified. Refresh the page and try again.'),
      );
    }
    return next();
  }

  return { attachAuth, requireAuth, requirePermission, requireCsrf };
}
