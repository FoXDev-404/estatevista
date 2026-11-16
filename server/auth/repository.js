import { supabase } from '../supabaseClient.js';
import { ApiError } from '../lib/errors.js';
import { writeAudit as writeAuditLog } from '../lib/audit.js';

function fail(context, error) {
  console.error(`[auth] ${context}:`, error?.message || error);
  throw new ApiError(500, 'Authentication is temporarily unavailable. Try again.');
}

/**
 * Supabase-backed implementation of the auth repository contract. The server
 * uses the service-role key, so company scoping is enforced in application
 * code and RLS remains a defense-in-depth layer.
 */
export class SupabaseAuthRepository {
  constructor(client = supabase) {
    this.supabase = client;
  }

  client() {
    if (!this.supabase) {
      throw new ApiError(503, 'Authentication is not configured.');
    }
    return this.supabase;
  }

  async findUserByEmail(email) {
    const { data, error } = await this.client()
      .from('users')
      .select('*')
      .eq('email', String(email || '').trim().toLowerCase())
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) fail('findUserByEmail', error);
    return data;
  }

  async findUserById(id) {
    const { data, error } = await this.client()
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) fail('findUserById', error);
    return data;
  }

  async findCompanyById(id) {
    const { data, error } = await this.client()
      .from('companies')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) fail('findCompanyById', error);
    return data;
  }

  async listPermissionKeys(userId) {
    const { data, error } = await this.client().rpc('user_permission_keys', {
      p_user_id: userId,
    });

    if (error) fail('listPermissionKeys', error);
    return (data || []).map((row) => row.permission_key ?? row.key ?? row).filter(Boolean);
  }

  async listRoleNames(userId) {
    const { data, error } = await this.client()
      .from('user_roles')
      .select('role_id, roles(name)')
      .eq('user_id', userId);

    if (error) fail('listRoleNames', error);
    return [
      ...new Set(
        (data || [])
          .map((row) => (Array.isArray(row.roles) ? row.roles[0]?.name : row.roles?.name))
          .filter(Boolean),
      ),
    ].sort();
  }

  async recordLoginAttempt({ email, ip, successful }) {
    const { error } = await this.client().from('login_attempts').insert({
      email: String(email || '').trim().toLowerCase(),
      ip_address: ip || null,
      successful: Boolean(successful),
    });

    if (error) fail('recordLoginAttempt', error);
  }

  async countRecentFailedAttempts({ email, ip, since }) {
    let query = this.client()
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', String(email || '').trim().toLowerCase())
      .eq('successful', false)
      .gte('created_at', since);

    query = ip ? query.eq('ip_address', ip) : query.is('ip_address', null);

    const { count, error } = await query;
    if (error) fail('countRecentFailedAttempts', error);
    return count || 0;
  }

  async createSession(session) {
    const { data, error } = await this.client()
      .from('sessions')
      .insert(session)
      .select()
      .single();

    if (error) fail('createSession', error);
    return data;
  }

  async findSessionByTokenHash(tokenHash) {
    const { data, error } = await this.client()
      .from('sessions')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error) fail('findSessionByTokenHash', error);
    return data;
  }

  async touchSession(id, lastSeenAt) {
    const { error } = await this.client()
      .from('sessions')
      .update({ last_seen_at: lastSeenAt })
      .eq('id', id);

    if (error) fail('touchSession', error);
  }

  async updateSessionCsrf(id, csrfTokenHash) {
    const { error } = await this.client()
      .from('sessions')
      .update({ csrf_token_hash: csrfTokenHash })
      .eq('id', id);

    if (error) fail('updateSessionCsrf', error);
  }

  async deleteSession(id) {
    const { error } = await this.client().from('sessions').delete().eq('id', id);
    if (error) fail('deleteSession', error);
  }

  async deleteSessionsForUser(userId) {
    const { error } = await this.client().from('sessions').delete().eq('user_id', userId);
    if (error) fail('deleteSessionsForUser', error);
  }

  async markLoginSuccess(userId, at) {
    const { error } = await this.client()
      .from('users')
      .update({ last_login_at: at })
      .eq('id', userId);

    if (error) fail('markLoginSuccess', error);
  }

  async updateUserPassword(userId, passwordHash) {
    const { error } = await this.client()
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', userId);

    if (error) fail('updateUserPassword', error);
  }

  async writeAudit(entry) {
    await writeAuditLog({ supabase: this.client(), ...entry });
  }
}
