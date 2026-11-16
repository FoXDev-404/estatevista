import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of the auth repository contract. Used by the
 * server test suite and by local experiments where Supabase is not available.
 */
export class MemoryAuthRepository {
  constructor({
    companies = [],
    users = [],
    roles = [],
    userRoles = [],
    rolePermissions = [],
    permissions = [],
  } = {}) {
    this.companies = companies.map((row) => ({ ...row }));
    this.users = users.map((row) => ({ ...row }));
    this.roles = roles.map((row) => ({ ...row }));
    this.userRoles = userRoles.map((row) => ({ ...row }));
    this.rolePermissions = rolePermissions.map((row) => ({ ...row }));
    this.permissions = permissions.map((row) => ({ ...row }));
    this.sessions = [];
    this.loginAttempts = [];
    this.auditLogs = [];
  }

  async findUserByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const user = this.users.find(
      (row) => String(row.email).toLowerCase() === normalized && row.is_active !== false,
    );
    return user ? { ...user } : null;
  }

  async findUserById(id) {
    const user = this.users.find((row) => row.id === id);
    return user ? { ...user } : null;
  }

  async findCompanyById(id) {
    const company = this.companies.find((row) => row.id === id);
    return company ? { ...company } : null;
  }

  async listPermissionKeys(userId) {
    const roleIds = new Set(
      this.userRoles.filter((row) => row.user_id === userId).map((row) => row.role_id),
    );

    const keys = new Set();
    for (const grant of this.rolePermissions) {
      if (!roleIds.has(grant.role_id)) continue;
      if (grant.permission_key) keys.add(grant.permission_key);
      if (grant.permission_id) {
        const permission = this.permissions.find((row) => row.id === grant.permission_id);
        if (permission) keys.add(permission.key);
      }
    }
    return [...keys].sort();
  }

  async listRoleNames(userId) {
    const roleIds = new Set(
      this.userRoles.filter((row) => row.user_id === userId).map((row) => row.role_id),
    );
    return [...new Set(this.roles.filter((row) => roleIds.has(row.id)).map((row) => row.name))].sort();
  }

  async recordLoginAttempt({ email, ip, successful }) {
    this.loginAttempts.push({
      email: String(email || '').toLowerCase(),
      ip_address: ip || null,
      successful: Boolean(successful),
      created_at: new Date().toISOString(),
    });
  }

  async countRecentFailedAttempts({ email, ip, since }) {
    const sinceMs = new Date(since).getTime();
    return this.loginAttempts.filter(
      (row) =>
        row.email === String(email || '').toLowerCase() &&
        row.ip_address === (ip || null) &&
        row.successful === false &&
        new Date(row.created_at).getTime() >= sinceMs,
    ).length;
  }

  async createSession(session) {
    const row = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      ...session,
    };
    this.sessions.push(row);
    return { ...row };
  }

  async findSessionByTokenHash(tokenHash) {
    const row = this.sessions.find((session) => session.token_hash === tokenHash);
    return row ? { ...row } : null;
  }

  async touchSession(id, lastSeenAt) {
    const row = this.sessions.find((session) => session.id === id);
    if (row) row.last_seen_at = lastSeenAt;
  }

  async updateSessionCsrf(id, csrfTokenHash) {
    const row = this.sessions.find((session) => session.id === id);
    if (row) row.csrf_token_hash = csrfTokenHash;
  }

  async deleteSession(id) {
    this.sessions = this.sessions.filter((session) => session.id !== id);
  }

  async deleteSessionsForUser(userId) {
    this.sessions = this.sessions.filter((session) => session.user_id !== userId);
  }

  async markLoginSuccess(userId, at) {
    const user = this.users.find((row) => row.id === userId);
    if (user) user.last_login_at = at;
  }

  async updateUserPassword(userId, passwordHash) {
    const user = this.users.find((row) => row.id === userId);
    if (user) user.password_hash = passwordHash;
  }

  async writeAudit(entry) {
    this.auditLogs.push({ ...entry, created_at: new Date().toISOString() });
  }
}
