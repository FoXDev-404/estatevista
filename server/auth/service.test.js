import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './service.js';
import { MemoryAuthRepository } from './memoryRepository.js';
import { hashPassword } from './password.js';

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

async function makeRepo(overrides = {}) {
  const user = {
    id: 'user-1',
    company_id: company.id,
    name: 'Avery Stone',
    email: 'avery@example.com',
    password_hash: await hashPassword('Password123'),
    full_access: false,
    is_active: true,
    last_login_at: null,
    ...overrides.user,
  };

  const repo = new MemoryAuthRepository({
    companies: [company],
    users: [user],
    roles: [
      { id: 'role-1', company_id: company.id, name: 'Sales Manager', description: '', is_default: true },
    ],
    userRoles: [{ user_id: user.id, role_id: 'role-1' }],
    rolePermissions: [{ role_id: 'role-1', permission_key: 'leads.view' }],
    permissions: [
      {
        id: 1,
        key: 'leads.view',
        module: 'leads',
        action: 'view',
        label: 'Leads: View',
        sort_order: 1,
      },
    ],
    ...overrides,
  });

  return { repo, user };
}

function makeService(repo, nowRef) {
  return new AuthService({
    repository: repo,
    sessionSecret: 'test-secret',
    now: () => new Date(nowRef.value),
  });
}

describe('AuthService', () => {
  let nowRef;

  beforeEach(() => {
    nowRef = { value: '2026-11-16T10:00:00.000Z' };
  });

  it('signs in an active user and returns a session, CSRF token and permissions', async () => {
    const { repo, user } = await makeRepo();
    const service = makeService(repo, nowRef);

    const result = await service.login({
      email: '  AVERY@example.com ',
      password: 'Password123',
      ip: '203.0.113.10',
      userAgent: 'vitest',
    });

    expect(result.user.id).toBe(user.id);
    expect(result.user.password_hash).toBeUndefined();
    expect(result.company.id).toBe(company.id);
    expect(result.permissions).toEqual(['leads.view']);
    expect(result.token).toBeTruthy();
    expect(result.csrfToken).toBeTruthy();
    expect(repo.sessions).toHaveLength(1);
    expect(repo.users[0].last_login_at).toBe(nowRef.value);
  });

  it('signs in users from different companies that share an email', async () => {
    const secondCompany = {
      ...company,
      id: 'company-2',
      name: 'Second Company',
      slug: 'second-company',
    };
    const first = {
      id: 'user-1',
      company_id: company.id,
      name: 'First User',
      email: 'shared@example.com',
      password_hash: await hashPassword('FirstPass123'),
      full_access: false,
      is_active: true,
    };
    const second = {
      id: 'user-2',
      company_id: secondCompany.id,
      name: 'Second User',
      email: 'shared@example.com',
      password_hash: await hashPassword('SecondPass123'),
      full_access: false,
      is_active: true,
    };
    const { repo } = await makeRepo({
      companies: [company, secondCompany],
      users: [first, second],
      userRoles: [],
      rolePermissions: [],
    });
    const service = makeService(repo, nowRef);

    const firstLogin = await service.login({
      email: 'shared@example.com',
      password: 'FirstPass123',
      ip: '203.0.113.10',
    });
    expect(firstLogin.user.id).toBe('user-1');
    expect(firstLogin.company.id).toBe(company.id);

    const secondLogin = await service.login({
      email: 'shared@example.com',
      password: 'SecondPass123',
      ip: '203.0.113.10',
    });
    expect(secondLogin.user.id).toBe('user-2');
    expect(secondLogin.company.id).toBe(secondCompany.id);
  });

  it('rejects a shared email when two accounts accept the same password', async () => {
    const secondCompany = {
      ...company,
      id: 'company-2',
      name: 'Second Company',
      slug: 'second-company',
    };
    const passwordHash = await hashPassword('SharedPass123');
    const first = {
      id: 'user-1',
      company_id: company.id,
      name: 'First User',
      email: 'shared@example.com',
      password_hash: passwordHash,
      full_access: false,
      is_active: true,
    };
    const second = {
      id: 'user-2',
      company_id: secondCompany.id,
      name: 'Second User',
      email: 'shared@example.com',
      password_hash: passwordHash,
      full_access: false,
      is_active: true,
    };
    const { repo } = await makeRepo({
      companies: [company, secondCompany],
      users: [first, second],
      userRoles: [],
      rolePermissions: [],
    });
    const service = makeService(repo, nowRef);

    await expect(
      service.login({
        email: 'shared@example.com',
        password: 'SharedPass123',
        ip: '203.0.113.10',
      }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid email or password.' });

    expect(repo.sessions).toHaveLength(0);
    expect(repo.loginAttempts).toEqual([
      expect.objectContaining({ email: 'shared@example.com', successful: false }),
    ]);
  });

  it('rejects a wrong password and records a failed attempt', async () => {
    const { repo } = await makeRepo();
    const service = makeService(repo, nowRef);

    await expect(
      service.login({ email: 'avery@example.com', password: 'wrong', ip: '203.0.113.10' }),
    ).rejects.toMatchObject({ status: 401, message: 'Invalid email or password.' });

    expect(repo.loginAttempts).toEqual([
      expect.objectContaining({ email: 'avery@example.com', successful: false }),
    ]);
  });

  it('throttles after ten failed attempts in the window', async () => {
    const { repo } = await makeRepo();
    const service = makeService(repo, nowRef);

    for (let i = 0; i < 10; i += 1) {
      await expect(
        service.login({ email: 'avery@example.com', password: 'wrong', ip: '203.0.113.10' }),
      ).rejects.toMatchObject({ status: 401 });
    }

    await expect(
      service.login({ email: 'avery@example.com', password: 'Password123', ip: '203.0.113.10' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('authenticates a valid session and rejects it after the absolute expiry', async () => {
    const { repo } = await makeRepo();
    const service = makeService(repo, nowRef);

    const login = await service.login({
      email: 'avery@example.com',
      password: 'Password123',
      ip: '203.0.113.10',
    });

    const current = await service.authenticate(login.token);
    expect(current.user.id).toBe('user-1');

    nowRef.value = '2026-12-17T10:00:00.000Z';
    await expect(service.authenticate(login.token)).resolves.toBeNull();
    expect(repo.sessions).toHaveLength(0);
  });

  it('rejects a session after eight idle hours', async () => {
    const { repo } = await makeRepo();
    const service = makeService(repo, nowRef);

    const login = await service.login({
      email: 'avery@example.com',
      password: 'Password123',
      ip: '203.0.113.10',
    });

    nowRef.value = '2026-11-16T18:00:01.000Z';
    await expect(service.authenticate(login.token)).resolves.toBeNull();
  });

  it('rotates and validates the CSRF token bound to a session', async () => {
    const { repo } = await makeRepo();
    const service = makeService(repo, nowRef);

    const login = await service.login({
      email: 'avery@example.com',
      password: 'Password123',
      ip: '203.0.113.10',
    });
    const current = await service.authenticate(login.token);

    expect(service.validateCsrf(current, login.csrfToken)).toBe(true);
    expect(service.validateCsrf(current, 'wrong')).toBe(false);

    const rotated = await service.rotateCsrf(current);
    expect(rotated).not.toBe(login.csrfToken);
    const refreshed = await service.authenticate(login.token);
    expect(service.validateCsrf(refreshed, rotated)).toBe(true);
    expect(service.validateCsrf(refreshed, login.csrfToken)).toBe(false);
  });

  it('logs out by deleting the session', async () => {
    const { repo } = await makeRepo();
    const service = makeService(repo, nowRef);

    const login = await service.login({
      email: 'avery@example.com',
      password: 'Password123',
      ip: '203.0.113.10',
    });
    const current = await service.authenticate(login.token);

    await service.logout({ auth: current, ip: '203.0.113.10' });

    expect(repo.sessions).toHaveLength(0);
    await expect(service.authenticate(login.token)).resolves.toBeNull();
  });

  it('changes the password and invalidates every session', async () => {
    const { repo } = await makeRepo();
    const service = makeService(repo, nowRef);

    const login = await service.login({
      email: 'avery@example.com',
      password: 'Password123',
      ip: '203.0.113.10',
    });
    const current = await service.authenticate(login.token);

    await expect(
      service.changePassword({
        auth: current,
        currentPassword: 'wrong',
        newPassword: 'NewPassword456',
        ip: '203.0.113.10',
      }),
    ).rejects.toMatchObject({ status: 422, fields: { currentPassword: expect.any(String) } });

    await service.changePassword({
      auth: current,
      currentPassword: 'Password123',
      newPassword: 'NewPassword456',
      ip: '203.0.113.10',
    });

    expect(repo.sessions).toHaveLength(0);
    await expect(
      service.login({ email: 'avery@example.com', password: 'Password123', ip: '203.0.113.10' }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      service.login({ email: 'avery@example.com', password: 'NewPassword456', ip: '203.0.113.10' }),
    ).resolves.toMatchObject({ user: { id: 'user-1' } });
  });

  it('returns wildcard permissions for a full-access user', async () => {
    const { repo } = await makeRepo({ user: { full_access: true } });
    const service = makeService(repo, nowRef);

    const login = await service.login({
      email: 'avery@example.com',
      password: 'Password123',
      ip: '203.0.113.10',
    });

    expect(login.permissions).toEqual(['*']);
  });
});
