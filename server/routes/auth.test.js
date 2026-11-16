import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { MemoryAuthRepository } from '../auth/memoryRepository.js';
import { hashPassword } from '../auth/password.js';

const company = {
  id: 'company-1',
  name: 'Harbour Homes',
  slug: 'harbour-homes',
  currency: 'USD',
  timezone: 'UTC',
  date_format: 'YYYY-MM-DD',
  number_decimals: 2,
  is_active: true,
};

function cookieFrom(response, name) {
  const header = response.headers['set-cookie'] || [];
  const match = header.find((cookie) => cookie.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split(';')[0].slice(name.length + 1));
}

async function makeApp(overrides = {}) {
  const repo = new MemoryAuthRepository({
    companies: [company],
    users: [
      {
        id: 'user-1',
        company_id: company.id,
        name: 'Avery Stone',
        email: 'avery@example.com',
        password_hash: await hashPassword('Password123'),
        full_access: false,
        is_active: true,
        ...overrides.user,
      },
    ],
    roles: [{ id: 'role-1', company_id: company.id, name: 'Sales Manager', description: '' }],
    userRoles: [{ user_id: 'user-1', role_id: 'role-1' }],
    rolePermissions: [{ role_id: 'role-1', permission_key: 'leads.view' }],
    permissions: [
      { id: 1, key: 'leads.view', module: 'leads', action: 'view', label: 'Leads: View', sort_order: 1 },
      { id: 2, key: 'team.view', module: 'team', action: 'view', label: 'Team: View', sort_order: 2 },
    ],
  });

  const app = createApp({ authRepository: repo });
  return { app, repo };
}

describe('auth HTTP routes', () => {
  let app;
  let repo;

  beforeEach(async () => {
    ({ app, repo } = await makeApp());
  });

  it('requires authentication for /api/auth/me', async () => {
    await request(app).get('/api/auth/me').expect(401);
  });

  it('signs in with cookies and returns the current user', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'avery@example.com', password: 'Password123' })
      .expect(200);

    expect(login.body.data.user.email).toBe('avery@example.com');
    expect(login.body.data.user.password_hash).toBeUndefined();
    expect(login.body.data.permissions).toEqual(['leads.view']);
    expect(cookieFrom(login, 'ev_session')).toBeTruthy();
    expect(cookieFrom(login, 'ev_csrf')).toBeTruthy();
    expect(login.headers['set-cookie'].some((c) => c.includes('HttpOnly'))).toBe(true);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.data.user.id).toBe('user-1');
    expect(me.body.data.company.id).toBe('company-1');
  });

  it('returns a generic error for a wrong password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'avery@example.com', password: 'wrong' })
      .expect(401);

    expect(response.body).toEqual({ error: 'Invalid email or password.' });
  });

  it('rejects logout without a CSRF token and accepts it with one', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'avery@example.com', password: 'Password123' })
      .expect(200);

    await agent.post('/api/auth/logout').expect(403);

    const csrf = cookieFrom(login, 'ev_csrf');
    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf).expect(200);
    await agent.get('/api/auth/me').expect(401);
    expect(repo.sessions).toHaveLength(0);
  });

  it('changes the password with CSRF and clears the session', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/auth/login')
      .send({ email: 'avery@example.com', password: 'Password123' })
      .expect(200);
    const csrf = cookieFrom(login, 'ev_csrf');

    const changed = await agent
      .post('/api/auth/password')
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' })
      .expect(200);

    expect(changed.body.data.ok).toBe(true);
    await agent.get('/api/auth/me').expect(401);

    await request(app)
      .post('/api/auth/login')
      .send({ email: 'avery@example.com', password: 'NewPassword456' })
      .expect(200);
  });

  it('enforces permissions and lets full-access users through', async () => {
    const { requirePermission } = app.locals.authMiddleware;
    const denied = vi.fn();
    requirePermission('team.view')(
      { auth: { user: { full_access: false }, permissions: ['leads.view'] } },
      {},
      denied,
    );
    expect(denied).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));

    const allowed = vi.fn();
    requirePermission('leads.view')(
      { auth: { user: { full_access: false }, permissions: ['leads.view'] } },
      {},
      allowed,
    );
    expect(allowed).toHaveBeenCalledWith();

    const fullAccess = vi.fn();
    requirePermission('team.view')(
      { auth: { user: { full_access: true }, permissions: [] } },
      {},
      fullAccess,
    );
    expect(fullAccess).toHaveBeenCalledWith();
  });
});
