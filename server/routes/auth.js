import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors.js';
import { parseBody } from '../lib/validation.js';
import {
  clearAuthCookies,
  setCsrfCookie,
  setSessionCookie,
} from '../lib/cookies.js';
import { clientIp } from '../lib/scoping.js';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(200),
});

function sessionPayload(auth) {
  return {
    user: auth.user,
    company: auth.company,
    permissions: auth.permissions,
    roles: auth.roles || [],
    expiresAt: auth.expiresAt,
  };
}

export function createAuthRouter({ service, auth }) {
  const router = Router();

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const input = parseBody(loginSchema, req.body);
      const result = await service.login({
        ...input,
        ip: clientIp(req),
        userAgent: req.get('user-agent') || null,
      });

      setSessionCookie(res, result.token);
      setCsrfCookie(res, result.csrfToken);

      res.json({
        data: {
          ...sessionPayload({
            user: result.user,
            company: result.company,
            permissions: result.permissions,
            roles: result.roles,
            expiresAt: result.expiresAt,
          }),
          csrfToken: result.csrfToken,
        },
      });
    }),
  );

  router.post(
    '/logout',
    auth.requireAuth,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      await service.logout({ auth: req.auth, ip: clientIp(req) });
      clearAuthCookies(res);
      res.json({ data: { ok: true } });
    }),
  );

  router.get('/me', auth.requireAuth, (req, res) => {
    res.json({ data: sessionPayload(req.auth) });
  });

  router.post(
    '/password',
    auth.requireAuth,
    auth.requireCsrf,
    asyncHandler(async (req, res) => {
      const input = parseBody(changePasswordSchema, req.body);
      await service.changePassword({
        auth: req.auth,
        ...input,
        ip: clientIp(req),
      });
      clearAuthCookies(res);
      res.json({ data: { ok: true } });
    }),
  );

  return router;
}
