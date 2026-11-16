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
      .eq('branch_id', branchId)
      .is('deleted_at', null);
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

  async nextDocumentNumber(companyId, documentType) {
    const { data, error } = await this.client().rpc('next_document_number', {
      p_company_id: companyId,
      p_document_type: documentType,
    });
    if (error) {
      if (String(error.message || '').includes('is not configured')) {
        throw new ApiError(500, `The ${documentType} number sequence is not configured.`);
      }
      fail('nextDocumentNumber', error);
    }
    return data;
  }

  // --- Projects, buildings and units ---------------------------------

  async listProjects(companyId) {
    const [projectsResult, unitsResult, buildingsResult] = await Promise.all([
      this.client()
        .from('projects')
        .select(
          '*, branch:branches(id, name, code), project_manager:users!projects_project_manager_id_fkey(id, name, email)',
        )
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('name'),
      this.client()
        .from('units')
        .select('project_id, status')
        .eq('company_id', companyId)
        .is('deleted_at', null),
      this.client().from('buildings').select('project_id').eq('company_id', companyId),
    ]);

    if (projectsResult.error) fail('listProjects', projectsResult.error);
    if (unitsResult.error) fail('listProjectUnits', unitsResult.error);
    if (buildingsResult.error) fail('listProjectBuildings', buildingsResult.error);

    const units = unitsResult.data || [];
    const buildings = buildingsResult.data || [];

    return (projectsResult.data || []).map((project) => {
      const projectUnits = units.filter((unit) => unit.project_id === project.id);
      return {
        ...project,
        buildings_count: buildings.filter((row) => row.project_id === project.id).length,
        units_count: projectUnits.length,
        available_units: projectUnits.filter((unit) => unit.status === 'available').length,
        sold_units: projectUnits.filter((unit) => unit.status === 'sold').length,
      };
    });
  }

  async getProject(companyId, id) {
    const projects = await this.listProjects(companyId);
    return projects.find((project) => project.id === id) || null;
  }

  async findProjectBySlug(companyId, slug, excludeId = null) {
    let query = this.client()
      .from('projects')
      .select('id, slug')
      .eq('company_id', companyId)
      .ilike('slug', String(slug).toLowerCase());
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) fail('findProjectBySlug', error);
    return data || null;
  }

  async createProject(companyId, patch) {
    const { data, error } = await this.client()
      .from('projects')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A project with this number, code or web address already exists.', {
          code: 'This project number or code is already in use.',
        });
      }
      fail('createProject', error);
    }
    return this.getProject(companyId, data.id);
  }

  async updateProject(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('projects')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A project with this code or web address already exists.', {
          code: 'This project code is already in use.',
        });
      }
      fail('updateProject', error);
    }
    if (!data) throw notFound('Project not found.');
    return this.getProject(companyId, data.id);
  }

  async deleteProject(companyId, id) {
    const { data, error } = await this.client()
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('deleteProject', error);
    if (!data) throw notFound('Project not found.');
  }

  async countProjectUnits(companyId, projectId) {
    const { count, error } = await this.client()
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('project_id', projectId)
      .is('deleted_at', null);
    if (error) fail('countProjectUnits', error);
    return count || 0;
  }

  async listProjectUnitNumbers(companyId, projectId) {
    const { data, error } = await this.client()
      .from('units')
      .select('unit_number')
      .eq('company_id', companyId)
      .eq('project_id', projectId);
    if (error) fail('listProjectUnitNumbers', error);
    return (data || []).map((row) => row.unit_number);
  }

  async listBuildings(companyId, projectId) {
    const buildingsResult = await this.client()
      .from('buildings')
      .select('*')
      .eq('company_id', companyId)
      .eq('project_id', projectId)
      .order('code');

    if (buildingsResult.error) fail('listBuildings', buildingsResult.error);
    const buildings = buildingsResult.data || [];
    if (!buildings.length) return [];

    const buildingIds = buildings.map((building) => building.id);
    const [floorsResult, unitsResult] = await Promise.all([
      this.client()
        .from('floors')
        .select('*')
        .eq('company_id', companyId)
        .in('building_id', buildingIds)
        .order('number'),
      this.client()
        .from('units')
        .select('building_id, floor_id')
        .eq('company_id', companyId)
        .eq('project_id', projectId)
        .is('deleted_at', null),
    ]);

    if (floorsResult.error) fail('listBuildingFloors', floorsResult.error);
    if (unitsResult.error) fail('listBuildingUnits', unitsResult.error);

    const floors = floorsResult.data || [];
    const units = unitsResult.data || [];

    return buildings.map((building) => ({
      ...building,
      units_count: units.filter((unit) => unit.building_id === building.id).length,
      floors: floors
        .filter((floor) => floor.building_id === building.id)
        .map((floor) => ({
          ...floor,
          units_count: units.filter((unit) => unit.floor_id === floor.id).length,
        })),
    }));
  }

  async getBuilding(companyId, id) {
    const { data: building, error } = await this.client()
      .from('buildings')
      .select('id, project_id')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) fail('getBuilding', error);
    if (!building) return null;

    const rows = await this.listBuildings(companyId, building.project_id);
    return rows.find((row) => row.id === id) || null;
  }

  async createBuilding(companyId, projectId, patch) {
    const { data, error } = await this.client()
      .from('buildings')
      .insert({
        company_id: companyId,
        project_id: projectId,
        code: patch.code,
        name: patch.name,
        floors_count: patch.floors_count,
      })
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A building with this code already exists in the project.', {
          code: 'Choose a different building code.',
        });
      }
      fail('createBuilding', error);
    }

    const floors = Array.from({ length: patch.floors_count }, (_, index) => ({
      company_id: companyId,
      building_id: data.id,
      number: index + 1,
      name: null,
    }));
    const { error: floorError } = await this.client().from('floors').insert(floors);
    if (floorError) {
      await this.client().from('buildings').delete().eq('id', data.id).eq('company_id', companyId);
      fail('createBuildingFloors', floorError);
    }

    return this.getBuilding(companyId, data.id);
  }

  async updateBuilding(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('buildings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'A building with this code already exists in the project.', {
          code: 'Choose a different building code.',
        });
      }
      fail('updateBuilding', error);
    }
    if (!data) throw notFound('Building not found.');
    return this.getBuilding(companyId, data.id);
  }

  async deleteBuilding(companyId, id) {
    // Soft-deleted units keep their building and floor references, which would
    // otherwise block the foreign key when their building is removed. Live
    // units are rejected by the route, so only detached rows are touched.
    const { error: detachError } = await this.client()
      .from('units')
      .update({ building_id: null, floor_id: null })
      .eq('company_id', companyId)
      .eq('building_id', id)
      .not('deleted_at', 'is', null);
    if (detachError) fail('deleteBuilding', detachError);

    const { error } = await this.client()
      .from('buildings')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) fail('deleteBuilding', error);
  }

  async createFloor(companyId, buildingId, patch) {
    const { data, error } = await this.client()
      .from('floors')
      .insert({
        company_id: companyId,
        building_id: buildingId,
        number: patch.number,
        name: patch.name ?? null,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'This floor number already exists in the building.', {
          number: 'Choose a different floor number.',
        });
      }
      fail('createFloor', error);
    }
    return { ...data, units_count: 0 };
  }

  async deleteFloor(companyId, buildingId, floorId) {
    // See deleteBuilding: soft-deleted units still point at their floor.
    const { error: detachError } = await this.client()
      .from('units')
      .update({ floor_id: null })
      .eq('company_id', companyId)
      .eq('floor_id', floorId)
      .not('deleted_at', 'is', null);
    if (detachError) fail('deleteFloor', detachError);

    const { error } = await this.client()
      .from('floors')
      .delete()
      .eq('id', floorId)
      .eq('building_id', buildingId)
      .eq('company_id', companyId);
    if (error) fail('deleteFloor', error);
  }

  async listUnitTypes(companyId) {
    const { data, error } = await this.client()
      .from('unit_types')
      .select('id, name, sort_order, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) fail('listUnitTypes', error);
    return data || [];
  }

  async getUnitType(companyId, id) {
    const { data, error } = await this.client()
      .from('unit_types')
      .select('id, name, sort_order, is_active')
      .eq('id', id)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) fail('getUnitType', error);
    return data || null;
  }

  async listUnits(companyId, filters = {}) {
    const pageSize = Number.isFinite(filters.from) && Number.isFinite(filters.to)
      ? filters.to - filters.from + 1
      : 25;
    let query = this.client()
      .from('units')
      .select(
        '*, project:projects(id, name, number, code, currency), building:buildings(id, code, name), floor:floors(id, number, name), unit_type:unit_types(id, name)',
        { count: 'exact' },
      )
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (filters.project_id) query = query.eq('project_id', filters.project_id);
    if (filters.building_id) query = query.eq('building_id', filters.building_id);
    if (filters.unit_type_id) query = query.eq('unit_type_id', filters.unit_type_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.search) query = query.ilike('unit_number', `%${filters.search}%`);

    if (Number.isFinite(filters.from) && Number.isFinite(filters.to)) {
      query = query.range(filters.from, filters.to);
    } else {
      query = query.limit(pageSize);
    }

    const { data, error, count } = await query.order('unit_number');
    if (error) fail('listUnits', error);
    return { data: data || [], total: count || 0 };
  }

  async getUnit(companyId, id) {
    const { data, error } = await this.client()
      .from('units')
      .select(
        '*, project:projects(id, name, number, code, currency), building:buildings(id, code, name), floor:floors(id, number, name), unit_type:unit_types(id, name)',
      )
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('getUnit', error);
    return data || null;
  }

  async findUnitByNumber(companyId, projectId, unitNumber, excludeId = null) {
    let query = this.client()
      .from('units')
      .select('id, unit_number')
      .eq('company_id', companyId)
      .eq('project_id', projectId)
      .eq('unit_number', unitNumber);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) fail('findUnitByNumber', error);
    return data || null;
  }

  async createUnit(companyId, patch) {
    const { data, error } = await this.client()
      .from('units')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'This unit number is already used in the project.', {
          unit_number: 'This unit number is already used in the project.',
        });
      }
      fail('createUnit', error);
    }
    return this.getUnit(companyId, data.id);
  }

  async createUnits(companyId, rows) {
    if (!rows.length) return [];
    const { data, error } = await this.client()
      .from('units')
      .insert(rows.map((row) => ({ company_id: companyId, ...row })))
      .select('id');
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'Some of these unit numbers already exist.');
      }
      fail('createUnits', error);
    }

    const ids = (data || []).map((row) => row.id);
    if (!ids.length) return [];
    const { data: units, error: readError } = await this.client()
      .from('units')
      .select(
        '*, project:projects(id, name, number, code, currency), building:buildings(id, code, name), floor:floors(id, number, name), unit_type:unit_types(id, name)',
      )
      .in('id', ids);
    if (readError) fail('createUnitsRead', readError);

    return (units || []).sort((a, b) =>
      String(a.unit_number).localeCompare(String(b.unit_number), undefined, { numeric: true }),
    );
  }

  async updateUnit(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('units')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(422, 'This unit number is already used in the project.', {
          unit_number: 'This unit number is already used in the project.',
        });
      }
      fail('updateUnit', error);
    }
    if (!data) throw notFound('Unit not found.');
    return this.getUnit(companyId, data.id);
  }

  async updateUnitStatus(companyId, id, { status, reason, changedBy }) {
    const before = await this.getUnit(companyId, id);
    if (!before) throw notFound('Unit not found.');

    const { error } = await this.client()
      .from('units')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null);
    if (error) fail('updateUnitStatus', error);

    const { error: historyError } = await this.client().from('unit_status_history').insert({
      company_id: companyId,
      unit_id: id,
      from_status: before.status,
      to_status: status,
      reason: reason || null,
      changed_by: changedBy || null,
    });
    if (historyError) fail('updateUnitStatusHistory', historyError);

    return this.getUnit(companyId, id);
  }

  async listUnitHistory(companyId, unitId) {
    const { data, error } = await this.client()
      .from('unit_status_history')
      .select('*, changed_by_user:users!unit_status_history_changed_by_fkey(id, name)')
      .eq('company_id', companyId)
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false });
    if (error) fail('listUnitHistory', error);
    return data || [];
  }

  async deleteUnit(companyId, id) {
    const { data, error } = await this.client()
      .from('units')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('deleteUnit', error);
    if (!data) throw notFound('Unit not found.');
  }

  async countActiveUnitContracts(companyId, unitId) {
    const [reservations, sales, leases] = await Promise.all([
      this.client()
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('unit_id', unitId)
        .eq('status', 'active'),
      this.client()
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('unit_id', unitId)
        .eq('status', 'active')
        .is('deleted_at', null),
      this.client()
        .from('leases')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('unit_id', unitId)
        .eq('status', 'active')
        .is('deleted_at', null),
    ]);

    if (reservations.error) fail('countUnitReservations', reservations.error);
    if (sales.error) fail('countUnitSales', sales.error);
    if (leases.error) fail('countUnitLeases', leases.error);

    return {
      reservations: reservations.count || 0,
      sales: sales.count || 0,
      leases: leases.count || 0,
    };
  }

  // --- Documents -----------------------------------------------------

  async listDocuments(companyId, { ownerType = null, ownerId = null } = {}) {
    let query = this.client()
      .from('documents')
      .select('*')
      .eq('company_id', companyId);
    if (ownerType) query = query.eq('owner_type', ownerType);
    if (ownerId) query = query.eq('owner_id', ownerId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) fail('listDocuments', error);
    return data || [];
  }

  async createDocument(companyId, document) {
    const storagePath = `${companyId}/${document.ownerType}/${document.ownerId}/${Date.now()}-${document.fileName}`;
    const { error: uploadError } = await this.client()
      .storage.from('documents')
      .upload(storagePath, document.data, {
        contentType: document.mimeType,
        upsert: false,
      });
    if (uploadError) {
      console.error('[admin] uploadDocument:', uploadError.message);
      throw new ApiError(500, 'The file could not be uploaded. Try again.');
    }

    const { data, error } = await this.client()
      .from('documents')
      .insert({
        company_id: companyId,
        owner_type: document.ownerType,
        owner_id: document.ownerId,
        category: document.category,
        file_name: document.fileName,
        storage_path: storagePath,
        mime_type: document.mimeType,
        size_bytes: document.sizeBytes,
        uploaded_by: document.uploadedBy,
      })
      .select('*')
      .single();

    if (error) {
      await this.client().storage.from('documents').remove([storagePath]);
      fail('createDocument', error);
    }
    return data;
  }

  async getDocument(companyId, id) {
    const { data, error } = await this.client()
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) fail('getDocument', error);
    return data || null;
  }

  async deleteDocument(companyId, id) {
    const document = await this.getDocument(companyId, id);
    if (!document) throw notFound('Document not found.');

    const { error: storageError } = await this.client()
      .storage.from('documents')
      .remove([document.storage_path]);
    if (storageError) {
      console.error('[admin] deleteDocumentFile:', storageError.message);
    }

    const { error } = await this.client()
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) fail('deleteDocument', error);
  }

  async getLookups(companyId) {
    const [branchesResult, rolesResult, usersResult, unitTypesResult] = await Promise.all([
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
      this.client()
        .from('unit_types')
        .select('id, name, sort_order, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('sort_order')
        .order('name'),
    ]);

    if (branchesResult.error) fail('lookupBranches', branchesResult.error);
    if (rolesResult.error) fail('lookupRoles', rolesResult.error);
    if (usersResult.error) fail('lookupUsers', usersResult.error);
    if (unitTypesResult.error) fail('lookupUnitTypes', unitTypesResult.error);

    return {
      branches: branchesResult.data || [],
      roles: rolesResult.data || [],
      users: usersResult.data || [],
      unit_types: unitTypesResult.data || [],
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
