import { ApiError, validationError } from '../lib/errors.js';
import { hashPassword, verifyPassword } from './password.js';
import {
  hashToken,
  randomToken,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  SESSION_ABSOLUTE_MS,
  SESSION_IDLE_MS,
  tokensMatch,
} from './tokens.js';

const PASSWORD_MIN_LENGTH = 8;
let dummyHashPromise = null;

function withoutPasswordHash(user) {
  const { password_hash: _ignored, ...safe } = user;
  return safe;
}

function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(randomToken(24));
  return dummyHashPromise;
}

export class AuthService {
  constructor({ repository, now = () => new Date(), sessionSecret = '' } = {}) {
    if (!repository) throw new Error('AuthService requires a repository.');
    this.repository = repository;
    this.now = now;
    this.sessionSecret = sessionSecret;
  }

  async permissionsFor(user) {
    if (user.full_access) return ['*'];
    return this.repository.listPermissionKeys(user.id);
  }

  async rolesFor(user) {
    if (typeof this.repository.listRoleNames !== 'function') return [];
    return this.repository.listRoleNames(user.id);
  }

  async login({ email, password, ip, userAgent }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const ipAddress = ip || 'unknown';
    const now = this.now();
    const windowStart = new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString();

    const failures = await this.repository.countRecentFailedAttempts({
      email: normalizedEmail,
      ip: ipAddress,
      since: windowStart,
    });

    if (failures >= LOGIN_MAX_FAILURES) {
      throw new ApiError(429, 'Too many failed sign-in attempts. Try again in 15 minutes.');
    }

    const candidates = await this.repository.findUsersByEmail(normalizedEmail);
    const matches = [];
    if (candidates.length) {
      for (const candidate of candidates) {
        if (await verifyPassword(password, candidate.password_hash)) matches.push(candidate);
      }
    } else {
      // Keep the response time close to a real user lookup.
      await verifyPassword(password, await getDummyHash());
    }

    // A shared email is only safe while exactly one account accepts the
    // password; two matches would make the company ambiguous.
    const user = matches.length === 1 ? matches[0] : null;
    const company = user ? await this.repository.findCompanyById(user.company_id) : null;
    const companyActive = company && company.is_active !== false;

    if (!user || !companyActive) {
      await this.repository.recordLoginAttempt({
        email: normalizedEmail,
        ip: ipAddress,
        successful: false,
      });
      throw new ApiError(401, 'Invalid email or password.');
    }

    await this.repository.recordLoginAttempt({
      email: normalizedEmail,
      ip: ipAddress,
      successful: true,
    });
    await this.repository.markLoginSuccess(user.id, now.toISOString());

    const token = randomToken();
    const csrfToken = randomToken();
    const expiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS).toISOString();

    const session = await this.repository.createSession({
      user_id: user.id,
      company_id: user.company_id,
      token_hash: hashToken(token),
      csrf_token_hash: hashToken(csrfToken),
      ip_address: ipAddress,
      user_agent: userAgent || null,
      expires_at: expiresAt,
      last_seen_at: now.toISOString(),
    });

    const permissions = await this.permissionsFor(user);
    const roles = await this.rolesFor(user);

    await this.repository.writeAudit({
      companyId: company.id,
      userId: user.id,
      module: 'auth',
      recordId: user.id,
      event: 'login',
      after: { email: user.email, session_id: session.id },
      ip: ipAddress,
    });

    return {
      token,
      csrfToken,
      expiresAt,
      user: withoutPasswordHash({ ...user, last_login_at: now.toISOString() }),
      company,
      permissions,
      roles,
    };
  }

  async authenticate(token) {
    if (typeof token !== 'string' || !token) return null;

    const now = this.now();
    const nowMs = now.getTime();
    const session = await this.repository.findSessionByTokenHash(hashToken(token));
    if (!session) return null;

    const expiresAt = new Date(session.expires_at).getTime();
    const lastSeenAt = new Date(session.last_seen_at).getTime();
    const expired = !Number.isFinite(expiresAt) || expiresAt <= nowMs;
    const idle = !Number.isFinite(lastSeenAt) || nowMs - lastSeenAt > SESSION_IDLE_MS;

    if (expired || idle) {
      await this.repository.deleteSession(session.id);
      return null;
    }

    const user = await this.repository.findUserById(session.user_id);
    if (!user || user.is_active === false) {
      await this.repository.deleteSession(session.id);
      return null;
    }

    const company = await this.repository.findCompanyById(session.company_id);
    if (!company || company.is_active === false) {
      await this.repository.deleteSession(session.id);
      return null;
    }

    await this.repository.touchSession(session.id, now.toISOString());
    const permissions = await this.permissionsFor(user);
    const roles = await this.rolesFor(user);

    return {
      sessionId: session.id,
      tokenHash: session.token_hash,
      csrfTokenHash: session.csrf_token_hash,
      expiresAt: session.expires_at,
      user: withoutPasswordHash(user),
      company,
      permissions,
      roles,
    };
  }

  validateCsrf(auth, csrfToken) {
    if (!auth?.csrfTokenHash || typeof csrfToken !== 'string' || !csrfToken) return false;
    return tokensMatch(hashToken(csrfToken), auth.csrfTokenHash);
  }

  async rotateCsrf(auth) {
    if (!auth?.sessionId) throw new ApiError(401, 'Sign in to continue.');
    const csrfToken = randomToken();
    await this.repository.updateSessionCsrf(auth.sessionId, hashToken(csrfToken));
    return csrfToken;
  }

  async logout({ auth, ip }) {
    if (!auth?.sessionId) return;
    await this.repository.deleteSession(auth.sessionId);
    await this.repository.writeAudit({
      companyId: auth.company.id,
      userId: auth.user.id,
      module: 'auth',
      recordId: auth.sessionId,
      event: 'logout',
      ip: ip || null,
    });
  }

  async changePassword({ auth, currentPassword, newPassword, ip }) {
    const user = await this.repository.findUserById(auth?.user?.id);
    if (!user) throw new ApiError(401, 'Sign in to continue.');

    const currentMatches = await verifyPassword(currentPassword, user.password_hash);
    if (!currentMatches) {
      throw validationError({ currentPassword: 'Your current password is incorrect.' });
    }

    if (
      typeof newPassword !== 'string' ||
      newPassword.length < PASSWORD_MIN_LENGTH ||
      !/[A-Za-z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      throw validationError({
        newPassword: 'Use at least 8 characters including a letter and a number.',
      });
    }

    if (currentPassword === newPassword) {
      throw validationError({
        newPassword: 'Choose a password that is different from your current one.',
      });
    }

    await this.repository.updateUserPassword(user.id, await hashPassword(newPassword));
    await this.repository.deleteSessionsForUser(user.id);
    await this.repository.writeAudit({
      companyId: user.company_id,
      userId: user.id,
      module: 'auth',
      recordId: user.id,
      event: 'password_changed',
      ip: ip || null,
    });
  }
}
