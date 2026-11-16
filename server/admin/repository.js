import { supabase } from '../supabaseClient.js';
import { ApiError, notFound } from '../lib/errors.js';
import { writeAudit as writeAuditLog } from '../lib/audit.js';
import { sortSequences } from './catalog.js';

function fail(context, error) {
  console.error(`[admin] ${context}:`, error?.message || error);
  throw new ApiError(500, 'The workspace data could not be loaded. Try again.');
}

function emptyToNull(value) {
  return value === '' || value === undefined ? null : value;
}

/**
 * Supabase-backed persistence for company settings, branches, team, roles and
 * the audit view. Routes own validation and permission checks; this class owns
 * query shape and company scoping.
 */
export class SupabaseAdminRepository {
  constructor(client = supabase) {
    this.supabase = client;
  }

  client() {
    if (!this.supabase) throw new ApiError(503, 'The workspace database is not configured.');
    return this.supabase;
  }

  async getCompany(companyId) {
    const { data, error } = await this.client()
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();
    if (error) fail('getCompany', error);
    if (!data) throw notFound('Company not found.');
    return data;
  }

  async updateCompany(companyId, patch) {
    const { data, error } = await this.client()
      .from('companies')
      .update(patch)
      .eq('id', companyId)
      .select()
      .maybeSingle();
    if (error) fail('updateCompany', error);
    if (!data) throw notFound('Company not found.');
    return data;
  }

  async getSettings(companyId) {
    const { error: ensureError } = await this.client()
      .from('settings')
      .upsert({ company_id: companyId }, { onConflict: 'company_id', ignoreDuplicates: true });
    if (ensureError) fail('ensureSettings', ensureError);

    const { data, error } = await this.client()
      .from('settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) fail('getSettings', error);
    if (!data) throw notFound('Settings not found.');
    return data;
  }

  async updateSettings(companyId, patch) {
    const { data, error } = await this.client()
      .from('settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .select()
      .maybeSingle();
    if (error) fail('updateSettings', error);
    if (!data) throw notFound('Settings not found.');
    return data;
  }

  async listSequences(companyId) {
    const { data, error } = await this.client()
      .from('number_sequences')
      .select('*')
      .eq('company_id', companyId);
    if (error) fail('listSequences', error);
    return sortSequences(data || []);
  }

  async updateSequence(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('number_sequences')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();
    if (error) fail('updateSequence', error);
    if (!data) throw notFound('Number sequence not found.');
    return data;
  }

  async listBranches(companyId) {
    const [{ data: branches, error: branchError }, { data: users, error: userError }] =
      await Promise.all([
        this.client().from('branches').select('*').eq('company_id', companyId).order('name'),
        this.client()
          .from('users')
          .select('id, name, email, branch_id, is_active')
          .eq('company_id', companyId),
      ]);

    if (branchError) fail('listBranches', branchError);
    if (userError) fail('listBranchUsers', userError);

    const team = users || [];
    return (branches || []).map((branch) => {
      const manager = team.find((user) => user.id === branch.manager_id) || null;
      return {
        ...branch,
        team_count: team.filter((user) => user.branch_id === branch.id).length,
        manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : null,
      };
    });
  }

  async getBranch(companyId, id) {
    const branches = await this.listBranches(companyId);
    return branches.find((branch) => branch.id === id) || null;
  }

  async createBranch(companyId, patch) {
    const { data, error } = await this.client()
      .from('branches')
      .insert({ company_id: companyId, ...patch })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A branch with this code already exists.', {
          code: 'Choose a different branch code.',
        });
      }
      fail('createBranch', error);
    }
    return this.getBranch(companyId, data.id);
  }

  async updateBranch(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('branches')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select()
      .maybeSingle();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A branch with this code already exists.', {
          code: 'Choose a different branch code.',
        });
      }
      fail('updateBranch', error);
    }
    if (!data) throw notFound('Branch not found.');
    return this.getBranch(companyId, data.id);
  }

  async deleteBranch(companyId, id) {
    const { error } = await this.client()
      .from('branches')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) fail('deleteBranch', error);
  }

  async countBranchTeam(companyId, branchId) {
    const { count, error } = await this.client()
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('branch_id', branchId);
    if (error) fail('countBranchTeam', error);
    return count || 0;
  }

  async countBranchProjects(companyId, branchId) {
    const { count, error } = await this.client()
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('branch_id', branchId);
    if (error) fail('countBranchProjects', error);
    return count || 0;
  }

  async listTeam(companyId) {
    const usersResult = await this.client()
      .from('users')
      .select(
        'id, company_id, branch_id, name, email, phone, full_access, is_active, last_login_at, created_at, updated_at',
      )
      .eq('company_id', companyId)
      .order('name');

    if (usersResult.error) fail('listTeamUsers', usersResult.error);

    const userIds = (usersResult.data || []).map((user) => user.id);
    const [rolesResult, branchResult] = await Promise.all([
      userIds.length
        ? this.client()
            .from('user_roles')
            .select('user_id, role_id, roles(id, name)')
            .in('user_id', userIds)
        : Promise.resolve({ data: [], error: null }),
      this.client().from('branches').select('id, name, code').eq('company_id', companyId),
    ]);

    if (rolesResult.error) fail('listTeamRoles', rolesResult.error);
    if (branchResult.error) fail('listTeamBranches', branchResult.error);

    const branches = new Map((branchResult.data || []).map((branch) => [branch.id, branch]));
    const rolesByUser = new Map();
    for (const row of rolesResult.data || []) {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      if (!role) continue;
      const list = rolesByUser.get(row.user_id) || [];
      list.push({ id: role.id, name: role.name });
      rolesByUser.set(row.user_id, list);
    }

    return (usersResult.data || []).map((user) => ({
      ...user,
      branch: user.branch_id ? branches.get(user.branch_id) || null : null,
      roles: (rolesByUser.get(user.id) || []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }

  async getTeamMember(companyId, id) {
    const members = await this.listTeam(companyId);
    return members.find((member) => member.id === id) || null;
  }

  async findTeamMemberByEmail(companyId, email) {
    const { data, error } = await this.client()
      .from('users')
      .select('id, email')
      .eq('company_id', companyId)
      .eq('email', String(email).trim().toLowerCase())
      .maybeSingle();
    if (error) fail('findTeamMemberByEmail', error);
    return data;
  }

  async createTeamMember(companyId, user, roleIds = []) {
    const { data, error } = await this.client()
      .from('users')
      .insert({ company_id: companyId, ...user })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A team member with this email already exists.', {
          email: 'This email is already used by another team member.',
        });
      }
      fail('createTeamMember', error);
    }

    if (roleIds.length) {
      const { error: roleError } = await this.client()
        .from('user_roles')
        .insert(roleIds.map((roleId) => ({ user_id: data.id, role_id: roleId })));
      if (roleError) {
        await this.client().from('users').delete().eq('id', data.id);
        fail('createTeamMemberRoles', roleError);
      }
    }

    return this.getTeamMember(companyId, data.id);
  }

  async updateTeamMember(companyId, id, patch, roleIds) {
    const { data, error } = await this.client()
      .from('users')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A team member with this email already exists.', {
          email: 'This email is already used by another team member.',
        });
      }
      fail('updateTeamMember', error);
    }
    if (!data) throw notFound('Team member not found.');

    if (Array.isArray(roleIds)) {
      const { error: clearError } = await this.client()
        .from('user_roles')
        .delete()
        .eq('user_id', id);
      if (clearError) fail('updateTeamMemberRolesClear', clearError);

      if (roleIds.length) {
        const { error: roleError } = await this.client()
          .from('user_roles')
          .insert(roleIds.map((roleId) => ({ user_id: id, role_id: roleId })));
        if (roleError) fail('updateTeamMemberRoles', roleError);
      }
    }

    return this.getTeamMember(companyId, id);
  }

  async countActiveFullAccess(companyId, excludeId = null) {
    let query = this.client()
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('full_access', true)
      .eq('is_active', true);

    if (excludeId) query = query.neq('id', excludeId);

    const { count, error } = await query;
    if (error) fail('countActiveFullAccess', error);
    return count || 0;
  }

  async deleteSessionsForUser(userId) {
    const { error } = await this.client().from('sessions').delete().eq('user_id', userId);
    if (error) fail('deleteSessionsForUser', error);
  }

  async listRoles(companyId) {
    const rolesResult = await this.client()
      .from('roles')
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (rolesResult.error) fail('listRoles', rolesResult.error);

    const roleIds = (rolesResult.data || []).map((role) => role.id);
    const [membersResult, grantsResult] = await Promise.all([
      roleIds.length
        ? this.client().from('user_roles').select('role_id').in('role_id', roleIds)
        : Promise.resolve({ data: [], error: null }),
      roleIds.length
        ? this.client().from('role_permissions').select('role_id').in('role_id', roleIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (membersResult.error) fail('listRoleMembers', membersResult.error);
    if (grantsResult.error) fail('listRoleGrants', grantsResult.error);

    const memberCounts = new Map();
    for (const row of membersResult.data || []) {
      memberCounts.set(row.role_id, (memberCounts.get(row.role_id) || 0) + 1);
    }
    const permissionCounts = new Map();
    for (const row of grantsResult.data || []) {
      permissionCounts.set(row.role_id, (permissionCounts.get(row.role_id) || 0) + 1);
    }

    return (rolesResult.data || []).map((role) => ({
      ...role,
      member_count: memberCounts.get(role.id) || 0,
      permission_count: permissionCounts.get(role.id) || 0,
    }));
  }

  async getRole(companyId, id) {
    const { data: role, error } = await this.client()
      .from('roles')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) fail('getRole', error);
    if (!role) return null;

    const [grantsResult, membersResult] = await Promise.all([
      this.client()
        .from('role_permissions')
        .select('permission_id, permissions(key)')
        .eq('role_id', id),
      this.client()
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', id),
    ]);

    if (grantsResult.error) fail('getRolePermissions', grantsResult.error);
    if (membersResult.error) fail('getRoleMembers', membersResult.error);

    return {
      ...role,
      permission_keys: (grantsResult.data || [])
        .map((row) => (Array.isArray(row.permissions) ? row.permissions[0]?.key : row.permissions?.key))
        .filter(Boolean)
        .sort(),
      member_count: membersResult.count || 0,
    };
  }

  async listPermissions() {
    const { data, error } = await this.client().from('permissions').select('id, key');
    if (error) fail('listPermissions', error);
    return data || [];
  }

  async permissionIdsForKeys(keys = []) {
    if (!keys.length) return [];
    const rows = await this.listPermissions();
    const wanted = new Set(keys);
    return rows.filter((row) => wanted.has(row.key)).map((row) => row.id);
  }

  async replaceRolePermissions(roleId, permissionKeys) {
    const { error: clearError } = await this.client()
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId);
    if (clearError) fail('replaceRolePermissionsClear', clearError);

    const permissionIds = await this.permissionIdsForKeys(permissionKeys);
    if (permissionIds.length) {
      const { error } = await this.client()
        .from('role_permissions')
        .insert(permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })));
      if (error) fail('replaceRolePermissionsInsert', error);
    }
  }

  async createRole(companyId, role, permissionKeys) {
    const { data, error } = await this.client()
      .from('roles')
      .insert({ company_id: companyId, ...role })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A role with this name already exists.', {
          name: 'Choose a different role name.',
        });
      }
      fail('createRole', error);
    }

    await this.replaceRolePermissions(data.id, permissionKeys);
    return this.getRole(companyId, data.id);
  }

  async updateRole(companyId, id, patch, permissionKeys) {
    const { data, error } = await this.client()
      .from('roles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A role with this name already exists.', {
          name: 'Choose a different role name.',
        });
      }
      fail('updateRole', error);
    }
    if (!data) throw notFound('Role not found.');

    if (Array.isArray(permissionKeys)) {
      await this.replaceRolePermissions(id, permissionKeys);
    }
    return this.getRole(companyId, id);
  }

  async deleteRole(companyId, id) {
    const { error } = await this.client()
      .from('roles')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) fail('deleteRole', error);
  }

  async listAuditLogs(companyId, filters = {}) {
    const { page = 1, limit = 25, userId, module, event, dateFrom, dateTo } = filters;
    const from = (page - 1) * limit;

    let query = this.client()
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId);

    if (userId) query = query.eq('user_id', userId);
    if (module) query = query.eq('module', module);
    if (event) query = query.eq('event', event);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (error) fail('listAuditLogs', error);

    const userIds = [...new Set((data || []).map((row) => row.user_id).filter(Boolean))];
    let users = [];
    if (userIds.length) {
      const { data: userRows, error: userError } = await this.client()
        .from('users')
        .select('id, name, email')
        .in('id', userIds);
      if (userError) fail('listAuditUsers', userError);
      users = userRows || [];
    }
    const userById = new Map(users.map((user) => [user.id, user]));

    return {
      data: (data || []).map((row) => ({
        ...row,
        user: row.user_id ? userById.get(row.user_id) || null : null,
      })),
      total: count || 0,
    };
  }

  async listAuditOptions(companyId) {
    const [logsResult, usersResult] = await Promise.all([
      this.client().from('audit_logs').select('module, user_id').eq('company_id', companyId),
      this.client()
        .from('users')
        .select('id, name, email, is_active')
        .eq('company_id', companyId)
        .order('name'),
    ]);

    if (logsResult.error) fail('listAuditOptionsModules', logsResult.error);
    if (usersResult.error) fail('listAuditOptionsUsers', usersResult.error);

    const modules = [...new Set((logsResult.data || []).map((row) => row.module).filter(Boolean))].sort();
    return { modules, users: usersResult.data || [] };
  }

  async getLookups(companyId) {
    const [branchesResult, rolesResult, usersResult] = await Promise.all([
      this.client()
        .from('branches')
        .select('id, name, code, is_active')
        .eq('company_id', companyId)
        .order('name'),
      this.client().from('roles').select('id, name, is_default').eq('company_id', companyId).order('name'),
      this.client()
        .from('users')
        .select('id, name, email, is_active, full_access, branch_id')
        .eq('company_id', companyId)
        .order('name'),
    ]);

    if (branchesResult.error) fail('lookupBranches', branchesResult.error);
    if (rolesResult.error) fail('lookupRoles', rolesResult.error);
    if (usersResult.error) fail('lookupUsers', usersResult.error);

    return {
      branches: branchesResult.data || [],
      roles: rolesResult.data || [],
      users: usersResult.data || [],
    };
  }

  async writeAudit(entry) {
    await writeAuditLog({ supabase: this.client(), ...entry });
  }
}

export function cleanPatch(patch) {
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, emptyToNull(value)]),
  );
}
