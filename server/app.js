import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './lib/config.js';
import { ApiError, errorHandler } from './lib/errors.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';
import { AuthService } from './auth/service.js';
import { createAuthMiddleware } from './auth/middleware.js';
import { SupabaseAuthRepository } from './auth/repository.js';
import { createAuthRouter } from './routes/auth.js';
import { createPropertiesRouter } from './routes/properties.js';
import { createEnquiriesRouter } from './routes/enquiries.js';
import { createUploadRouter } from './routes/upload.js';

export function createApp({ authRepository } = {}) {
  const repository = authRepository || new SupabaseAuthRepository();
  const authService = new AuthService({
    repository,
    sessionSecret: config.sessionSecret,
  });
  const auth = createAuthMiddleware({ service: authService });

  const app = express();
  app.disable('x-powered-by');
  app.locals.authService = authService;
  app.locals.authMiddleware = auth;

  app.use(
    cors(
      config.appOrigins.length
        ? { origin: config.appOrigins, credentials: true }
        : { origin: false, credentials: true },
    ),
  );
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  app.use(cookieParser());
  app.use(auth.attachAuth);

  app.use('/api/auth', createAuthRouter({ service: authService, auth }));
  app.use('/api/properties', createPropertiesRouter({ auth }));
  app.use('/api/enquiries', createEnquiriesRouter({ auth }));
  app.use('/api/upload', createUploadRouter({ auth }));

  app.get('/api/health', async (_req, res) => {
    let dbStatus;
    let propertiesCount = 0;

    if (isSupabaseConfigured && supabase) {
      try {
        const { count, error } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true });

        if (!error) {
          dbStatus = 'connected';
          propertiesCount = count || 0;
        } else {
          dbStatus = `error: ${error.message}`;
        }
      } catch (error) {
        dbStatus = `error: ${error.message}`;
      }
    } else {
      dbStatus = 'not configured (missing SUPABASE_URL or keys in .env)';
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      supabaseConfigured: isSupabaseConfigured,
      database: dbStatus,
      propertiesCount,
    });
  });

  app.use('/api', (_req, _res, next) => next(new ApiError(404, 'API route not found.')));
  app.use(errorHandler);

  return app;
}

export default createApp;
