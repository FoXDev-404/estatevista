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
import { createSettingsRouter } from './routes/settings.js';
import { createBranchesRouter } from './routes/branches.js';
import { createTeamRouter } from './routes/team.js';
import { createRolesRouter } from './routes/roles.js';
import { createAuditRouter } from './routes/audit.js';
import { createLookupsRouter } from './routes/lookups.js';
import { createProjectsRouter } from './routes/projects.js';
import { createUnitsRouter } from './routes/units.js';
import { createDocumentsRouter } from './routes/documents.js';
import { createLeadsRouter } from './routes/leads.js';
import { createCustomersRouter } from './routes/customers.js';
import { createVisitsRouter } from './routes/visits.js';
import { createQuotationsRouter } from './routes/quotations.js';
import { createReservationsRouter } from './routes/reservations.js';
import { createSalesRouter } from './routes/sales.js';
import { createInstallmentsRouter } from './routes/installments.js';
import { createCollectionsRouter } from './routes/collections.js';
import { createCommissionsRouter } from './routes/commissions.js';
import { createTenantsRouter } from './routes/tenants.js';
import { createLeasesRouter } from './routes/leases.js';
import { createRentRollRouter } from './routes/rentRoll.js';
import { createRentCollectionsRouter } from './routes/rentCollections.js';
import { createDepositsRouter } from './routes/deposits.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { createPropertiesRouter } from './routes/properties.js';
import { createEnquiriesRouter } from './routes/enquiries.js';
import { createUploadRouter } from './routes/upload.js';
import { SupabaseAdminRepository } from './admin/repository.js';

export function createApp({ authRepository, adminRepository } = {}) {
  const repository = authRepository || new SupabaseAuthRepository();
  const admin = adminRepository || new SupabaseAdminRepository();
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
  app.use('/api/settings', createSettingsRouter({ auth, repository: admin }));
  app.use('/api/branches', createBranchesRouter({ auth, repository: admin }));
  app.use('/api/team', createTeamRouter({ auth, repository: admin }));
  app.use('/api/roles', createRolesRouter({ auth, repository: admin }));
  app.use('/api/audit-logs', createAuditRouter({ auth, repository: admin }));
  app.use('/api/lookups', createLookupsRouter({ auth, repository: admin }));
  app.use('/api/projects', createProjectsRouter({ auth, repository: admin }));
  app.use('/api/units', createUnitsRouter({ auth, repository: admin }));
  app.use('/api/documents', createDocumentsRouter({ auth, repository: admin }));
  app.use('/api/leads', createLeadsRouter({ auth, repository: admin }));
  app.use('/api/customers', createCustomersRouter({ auth, repository: admin }));
  app.use('/api/visits', createVisitsRouter({ auth, repository: admin }));
  app.use('/api/quotations', createQuotationsRouter({ auth, repository: admin }));
  app.use('/api/reservations', createReservationsRouter({ auth, repository: admin }));
  app.use('/api/sales', createSalesRouter({ auth, repository: admin }));
  app.use('/api/installments', createInstallmentsRouter({ auth, repository: admin }));
  app.use('/api/collections', createCollectionsRouter({ auth, repository: admin }));
  app.use('/api/commissions', createCommissionsRouter({ auth, repository: admin }));
  app.use('/api/tenants', createTenantsRouter({ auth, repository: admin }));
  app.use('/api/leases', createLeasesRouter({ auth, repository: admin }));
  app.use('/api/rent-roll', createRentRollRouter({ auth, repository: admin }));
  app.use('/api/rent-collections', createRentCollectionsRouter({ auth, repository: admin }));
  app.use('/api/deposits', createDepositsRouter({ auth, repository: admin }));
  app.use('/api/dashboard', createDashboardRouter({ auth, repository: admin }));
  app.use('/api/notifications', createNotificationsRouter({ auth, repository: admin }));
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
