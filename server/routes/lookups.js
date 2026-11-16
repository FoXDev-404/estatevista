import { Router } from 'express';
import { asyncHandler } from '../lib/errors.js';

export function createLookupsRouter({ auth, repository }) {
  const router = Router();

  router.get(
    '/',
    auth.requireAuth,
    asyncHandler(async (req, res) => {
      const lookups = await repository.getLookups(req.auth.company.id);
      res.json({ data: lookups });
    }),
  );

  return router;
}

export default createLookupsRouter;
