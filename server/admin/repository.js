import { supabase } from '../supabaseClient.js';
import { ApiError, notFound } from '../lib/errors.js';
import { writeAudit as writeAuditLog } from '../lib/audit.js';
import { sortSequences } from './catalog.js';
import { installmentStatus, nextDueInstallment, roundMoney } from '../lib/sales.js';
import {
  depositHeld,
  rentScheduleView,
  rentSummary,
} from '../lib/rental.js';

function fail(context, error) {
  console.error(`[admin] ${context}:`, error?.message || error);
  throw new ApiError(500, 'The workspace data could not be loaded. Try again.');
}

function emptyToNull(value) {
  return value === '' || value === undefined ? null : value;
}

const LEAD_SELECT =
  '*, source:lookups(id, name), assigned_user:users!leads_assigned_to_fkey(id, name, email), project:projects(id, name), unit:units(id, unit_number, status)';
const CUSTOMER_SELECT = '*, source:lookups(id, name), lead:leads(id, name)';
const VISIT_SELECT =
  '*, lead:leads(id, name), customer:customers(id, name), project:projects(id, name), unit:units(id, unit_number), salesperson:users!visits_salesperson_id_fkey(id, name)';
const FOLLOWUP_SELECT = '*, created_by_user:users!lead_followups_created_by_fkey(id, name)';
const QUOTATION_SELECT =
  '*, customer:customers(id, name), lead:leads(id, name), salesperson:users!quotations_salesperson_id_fkey(id, name), unit:units(id, unit_number, status, project_id, project:projects(id, name))';
const RESERVATION_SELECT =
  '*, customer:customers(id, name), unit:units(id, unit_number, status, project_id, project:projects(id, name)), converted_sale:sales!reservations_converted_sale_id_fkey(id, number)';
const SALE_SELECT =
  '*, customer:customers(id, name), salesperson:users!sales_salesperson_id_fkey(id, name), unit:units(id, unit_number, status, project_id, project:projects(id, name)), plan:installment_plans(*), installments:installments(*)';
const INSTALLMENT_SELECT =
  '*, sale:sales!installments_sale_id_fkey(id, number, customer_id, unit_id, net_price, customer:customers(id, name), unit:units(id, unit_number, project_id), plan:installment_plans(grace_days))';
const RECEIPT_SELECT =
  '*, customer:customers(id, name), tenant:tenants!receipts_tenant_id_fkey(id, name), allocations:receipt_allocations(id, installment_id, rent_schedule_id, amount, installment:installments(id, sequence, due_date, amount, sale:sales(id, number)), rent_schedule:rent_schedules(id, period_label, period_start, due_date, lease:leases(id, number)))';
const COMMISSION_SELECT =
  '*, sale:sales(id, number, net_price), salesperson:users!sales_commissions_salesperson_id_fkey(id, name), rule:commission_rules(id, name)';
const TENANT_SELECT =
  '*, leases:leases(id, number, status, start_date, end_date, unit_id, unit:units(id, unit_number), schedules:rent_schedules(*))';
const LEASE_SELECT =
  '*, tenant:tenants(id, name, phone, email), unit:units(id, unit_number, status, project_id, project:projects(id, name)), deposit:security_deposits(*), schedules:rent_schedules(*)';
const RENT_SCHEDULE_SELECT =
  '*, lease:leases(id, number, status, tenant_id, unit_id, grace_days, tenant:tenants(id, name, phone), unit:units(id, unit_number, project_id, project:projects(id, name)))';
const DEPOSIT_SELECT =
  '*, lease:leases(id, number, status, start_date, end_date, tenant_id, unit_id, tenant:tenants(id, name, phone), unit:units(id, unit_number)), transactions:deposit_transactions(*)';
const WEBSITE_INQUIRY_SELECT =
  'id, company_id, type, name, phone, email, project_id, unit_id, property_id, message, source_page, locale, status, lead_id, visit_id, submission_key, created_at, updated_at, project:projects(id, name), unit:units(id, unit_number), property:properties(id, title), lead:leads(id, name, status)';

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
        rented_units: projectUnits.filter((unit) => unit.status === 'rented').length,
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

  async listUnitStatusCounts(companyId) {
    const { data, error } = await this.client()
      .from('units')
      .select('status')
      .eq('company_id', companyId)
      .is('deleted_at', null);
    if (error) fail('listUnitStatusCounts', error);
    return (data || []).reduce((counts, row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      return counts;
    }, {});
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

  // --- CRM: leads, follow-ups, customers and visits -------------------

  async listLeads(companyId) {
    const [leadsResult, followupsResult] = await Promise.all([
      this.client()
        .from('leads')
        .select(LEAD_SELECT)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
      this.client()
        .from('lead_followups')
        .select('lead_id, scheduled_at')
        .eq('company_id', companyId)
        .is('completed_at', null)
        .not('scheduled_at', 'is', null)
        .order('scheduled_at'),
    ]);
    if (leadsResult.error) fail('listLeads', leadsResult.error);
    if (followupsResult.error) fail('listLeadFollowups', followupsResult.error);

    const nextFollowup = new Map();
    for (const row of followupsResult.data || []) {
      if (!nextFollowup.has(row.lead_id)) nextFollowup.set(row.lead_id, row.scheduled_at);
    }

    return (leadsResult.data || []).map((lead) => ({
      ...lead,
      next_followup_at: nextFollowup.get(lead.id) || null,
    }));
  }

  async getLead(companyId, id) {
    const { data, error } = await this.client()
      .from('leads')
      .select(LEAD_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('getLead', error);
    if (!data) return null;

    const { data: followup, error: followupError } = await this.client()
      .from('lead_followups')
      .select('scheduled_at')
      .eq('company_id', companyId)
      .eq('lead_id', id)
      .is('completed_at', null)
      .not('scheduled_at', 'is', null)
      .order('scheduled_at')
      .limit(1)
      .maybeSingle();
    if (followupError) fail('getLeadFollowup', followupError);

    return { ...data, next_followup_at: followup?.scheduled_at || null };
  }

  async createLead(companyId, patch) {
    const { data, error } = await this.client()
      .from('leads')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) fail('createLead', error);
    return this.getLead(companyId, data.id);
  }

  async updateLead(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('leads')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('updateLead', error);
    if (!data) throw notFound('Lead not found.');
    return this.getLead(companyId, data.id);
  }

  async deleteLead(companyId, id) {
    const { data, error } = await this.client()
      .from('leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('deleteLead', error);
    if (!data) throw notFound('Lead not found.');
  }

  async listLeadFollowups(companyId, leadId) {
    const { data, error } = await this.client()
      .from('lead_followups')
      .select(FOLLOWUP_SELECT)
      .eq('company_id', companyId)
      .eq('lead_id', leadId)
      .order('created_at');
    if (error) fail('listLeadFollowups', error);
    return data || [];
  }

  async getLeadFollowup(companyId, id) {
    const { data, error } = await this.client()
      .from('lead_followups')
      .select(FOLLOWUP_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getLeadFollowup', error);
    return data || null;
  }

  async createLeadFollowup(companyId, leadId, patch) {
    const { data, error } = await this.client()
      .from('lead_followups')
      .insert({ company_id: companyId, lead_id: leadId, ...patch })
      .select('id')
      .single();
    if (error) fail('createLeadFollowup', error);
    return this.getLeadFollowup(companyId, data.id);
  }

  async updateLeadFollowup(companyId, leadId, followupId, patch) {
    const { data, error } = await this.client()
      .from('lead_followups')
      .update(patch)
      .eq('id', followupId)
      .eq('lead_id', leadId)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateLeadFollowup', error);
    return data ? this.getLeadFollowup(companyId, data.id) : null;
  }

  // --- Public bridge: website inquiries -> Website leads -----------------

  async getCompanyBySlug(slug) {
    const { data, error } = await this.client()
      .from('companies')
      .select('*')
      .ilike('slug', String(slug || '').trim())
      .eq('is_active', true)
      .maybeSingle();
    if (error) fail('getCompanyBySlug', error);
    return data || null;
  }

  async findSourceByName(companyId, name) {
    const { data, error } = await this.client()
      .from('lookups')
      .select('id, name, list_key')
      .eq('company_id', companyId)
      .eq('list_key', 'source')
      .eq('is_active', true)
      .ilike('name', String(name || '').trim())
      .maybeSingle();
    if (error) fail('findSourceByName', error);
    return data || null;
  }

  async getPublicProperty(id) {
    const { data, error } = await this.client()
      .from('properties')
      .select('id, title')
      .eq('id', String(id || '').trim().toUpperCase())
      .maybeSingle();
    if (error) fail('getPublicProperty', error);
    return data || null;
  }

  async getWebsiteInquiry(companyId, id) {
    const { data, error } = await this.client()
      .from('website_inquiries')
      .select(WEBSITE_INQUIRY_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getWebsiteInquiry', error);
    return data || null;
  }

  async listWebsiteInquiries(companyId) {
    const { data, error } = await this.client()
      .from('website_inquiries')
      .select(WEBSITE_INQUIRY_SELECT)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) fail('listWebsiteInquiries', error);
    return data || [];
  }

  async findWebsiteInquiryBySubmissionKey(companyId, submissionKey) {
    const { data, error } = await this.client()
      .from('website_inquiries')
      .select(WEBSITE_INQUIRY_SELECT)
      .eq('company_id', companyId)
      .eq('submission_key', submissionKey)
      .maybeSingle();
    if (error) fail('findWebsiteInquiryBySubmissionKey', error);
    return data || null;
  }

  async createWebsiteInquiry(companyId, patch) {
    const { data, error } = await this.client()
      .from('website_inquiries')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'Duplicate submission.');
      }
      fail('createWebsiteInquiry', error);
    }
    return this.getWebsiteInquiry(companyId, data.id);
  }

  async updateWebsiteInquiry(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('website_inquiries')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateWebsiteInquiry', error);
    if (!data) throw notFound('Website inquiry not found.');
    return this.getWebsiteInquiry(companyId, data.id);
  }

  customerWithTotals(row) {
    if (!row) return null;
    // Sales and installment data arrives with WP5; the list columns stay at 0.
    return { ...row, units_bought: 0, balance_due: 0 };
  }

  async listCustomers(companyId) {
    const { data, error } = await this.client()
      .from('customers')
      .select(CUSTOMER_SELECT)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name');
    if (error) fail('listCustomers', error);
    return (data || []).map((row) => this.customerWithTotals(row));
  }

  async getCustomer(companyId, id) {
    const { data, error } = await this.client()
      .from('customers')
      .select(CUSTOMER_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('getCustomer', error);
    return this.customerWithTotals(data);
  }

  async findCustomerByLead(companyId, leadId) {
    const { data, error } = await this.client()
      .from('customers')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('lead_id', leadId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('findCustomerByLead', error);
    return data || null;
  }

  async createCustomer(companyId, patch) {
    const { data, error } = await this.client()
      .from('customers')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'This lead has already been converted to a customer.');
      }
      fail('createCustomer', error);
    }
    return this.getCustomer(companyId, data.id);
  }

  async updateCustomer(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('customers')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('updateCustomer', error);
    if (!data) throw notFound('Customer not found.');
    return this.getCustomer(companyId, data.id);
  }

  async deleteCustomer(companyId, id) {
    const { data, error } = await this.client()
      .from('customers')
      .update({ deleted_at: new Date().toISOString(), lead_id: null })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('deleteCustomer', error);
    if (!data) throw notFound('Customer not found.');
  }

  async listVisits(companyId) {
    const { data, error } = await this.client()
      .from('visits')
      .select(VISIT_SELECT)
      .eq('company_id', companyId)
      .order('scheduled_at');
    if (error) fail('listVisits', error);
    return data || [];
  }

  async getVisit(companyId, id) {
    const { data, error } = await this.client()
      .from('visits')
      .select(VISIT_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getVisit', error);
    return data || null;
  }

  async createVisit(companyId, patch) {
    const { data, error } = await this.client()
      .from('visits')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) fail('createVisit', error);
    return this.getVisit(companyId, data.id);
  }

  async updateVisit(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('visits')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateVisit', error);
    if (!data) throw notFound('Visit not found.');
    return this.getVisit(companyId, data.id);
  }

  async deleteVisit(companyId, id) {
    const { error } = await this.client()
      .from('visits')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) fail('deleteVisit', error);
  }

  // --- Sales: quotations, reservations, sales, receipts, commissions ---

  async listQuotations(companyId) {
    const { data, error } = await this.client()
      .from('quotations')
      .select(QUOTATION_SELECT)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) fail('listQuotations', error);
    return data || [];
  }

  async getQuotation(companyId, id) {
    const { data, error } = await this.client()
      .from('quotations')
      .select(QUOTATION_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('getQuotation', error);
    return data || null;
  }

  async createQuotation(companyId, patch) {
    const { data, error } = await this.client()
      .from('quotations')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'This quotation number is already in use.');
      }
      fail('createQuotation', error);
    }
    return this.getQuotation(companyId, data.id);
  }

  async updateQuotation(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('quotations')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('updateQuotation', error);
    if (!data) throw notFound('Quotation not found.');
    return this.getQuotation(companyId, data.id);
  }

  async deleteQuotation(companyId, id) {
    const { data, error } = await this.client()
      .from('quotations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('deleteQuotation', error);
    if (!data) throw notFound('Quotation not found.');
  }

  async listReservations(companyId) {
    const { data, error } = await this.client()
      .from('reservations')
      .select(RESERVATION_SELECT)
      .eq('company_id', companyId)
      .order('reserved_on', { ascending: false });
    if (error) fail('listReservations', error);
    return data || [];
  }

  async getReservation(companyId, id) {
    const { data, error } = await this.client()
      .from('reservations')
      .select(RESERVATION_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getReservation', error);
    return data || null;
  }

  async createReservation(companyId, patch) {
    const { data, error } = await this.client()
      .from('reservations')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'This unit already has an active reservation.');
      }
      fail('createReservation', error);
    }
    return this.getReservation(companyId, data.id);
  }

  async updateReservation(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('reservations')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateReservation', error);
    if (!data) throw notFound('Reservation not found.');
    return this.getReservation(companyId, data.id);
  }

  async findActiveReservationForUnit(companyId, unitId, excludeId = null) {
    let query = this.client()
      .from('reservations')
      .select('id, number, customer_id, unit_id, status')
      .eq('company_id', companyId)
      .eq('unit_id', unitId)
      .eq('status', 'active');
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) fail('findActiveReservationForUnit', error);
    return data || null;
  }

  async findActiveSaleForUnit(companyId, unitId, excludeId = null) {
    let query = this.client()
      .from('sales')
      .select('id, number, customer_id, unit_id, status')
      .eq('company_id', companyId)
      .eq('unit_id', unitId)
      .in('status', ['pending_approval', 'active', 'fully_paid'])
      .is('deleted_at', null);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) fail('findActiveSaleForUnit', error);
    return data || null;
  }

  async expireReservations(companyId, today) {
    const { data, error } = await this.client()
      .from('reservations')
      .select('id, number, unit_id')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .lt('expires_at', today);
    if (error) fail('expireReservations', error);

    for (const reservation of data || []) {
      const { error: updateError } = await this.client()
        .from('reservations')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', reservation.id)
        .eq('company_id', companyId)
        .eq('status', 'active');
      if (updateError) fail('expireReservation', updateError);

      const unit = await this.getUnit(companyId, reservation.unit_id);
      if (!unit || unit.status !== 'reserved') continue;
      const [otherReservation, activeSale] = await Promise.all([
        this.findActiveReservationForUnit(companyId, unit.id),
        this.findActiveSaleForUnit(companyId, unit.id),
      ]);
      if (!otherReservation && !activeSale) {
        await this.updateUnitStatus(companyId, unit.id, {
          status: 'available',
          reason: `Reservation ${reservation.number} expired`,
          changedBy: null,
        });
      }
    }
    return (data || []).length;
  }

  installmentView(installment, plan = null) {
    const graceDays = Number(plan?.grace_days ?? installment.grace_days ?? 0);
    const status = installmentStatus(installment, {
      today: new Date().toISOString().slice(0, 10),
      graceDays,
    });
    const gross = Number(installment.amount || 0) + Number(installment.late_fee || 0);
    const balance =
      status === 'waived' || status === 'cancelled'
        ? 0
        : roundMoney(gross - Number(installment.paid_amount || 0));
    return { ...installment, status, grace_days: graceDays, balance };
  }

  saleView(row) {
    if (!row) return null;
    const plan = row.plan || null;
    const installments = [...(row.installments || [])]
      .sort((a, b) => a.sequence - b.sequence)
      .map((installment) => this.installmentView(installment, plan));
    const balanceDue = roundMoney(
      installments
        .filter((row) => !['waived', 'cancelled'].includes(row.status))
        .reduce((sum, row) => sum + Number(row.balance || 0), 0),
    );
    return {
      ...row,
      plan,
      installments,
      balance_due: balanceDue,
      overdue_amount: roundMoney(
        installments
          .filter((row) => row.status === 'overdue')
          .reduce((sum, row) => sum + Number(row.balance || 0), 0),
      ),
      next_due: nextDueInstallment(installments),
    };
  }

  async listSales(companyId) {
    const { data, error } = await this.client()
      .from('sales')
      .select(SALE_SELECT)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('agreement_date', { ascending: false })
      .order('sequence', { foreignTable: 'installments' });
    if (error) fail('listSales', error);
    return (data || []).map((row) => this.saleView(row));
  }

  async getSale(companyId, id) {
    const { data, error } = await this.client()
      .from('sales')
      .select(SALE_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .is('deleted_at', null)
      .order('sequence', { foreignTable: 'installments' })
      .maybeSingle();
    if (error) fail('getSale', error);
    return this.saleView(data);
  }

  async createSale(companyId, { sale, plan, installments }) {
    const { data: saleRow, error } = await this.client()
      .from('sales')
      .insert({ company_id: companyId, ...sale })
      .select('id, number, unit_id')
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new ApiError(409, 'This unit already has an active sale.');
      }
      fail('createSale', error);
    }

    const { data: planRow, error: planError } = await this.client()
      .from('installment_plans')
      .insert({ company_id: companyId, sale_id: saleRow.id, ...plan })
      .select('id')
      .single();
    if (planError) {
      await this.client().from('sales').delete().eq('id', saleRow.id).eq('company_id', companyId);
      fail('createSalePlan', planError);
    }

    const { error: installmentError } = await this.client().from('installments').insert(
      installments.map((row) => ({
        company_id: companyId,
        plan_id: planRow.id,
        sale_id: saleRow.id,
        sequence: row.sequence,
        due_date: row.due_date,
        amount: row.amount,
        balance: row.amount,
        status: 'upcoming',
      })),
    );
    if (installmentError) {
      await this.client().from('sales').delete().eq('id', saleRow.id).eq('company_id', companyId);
      fail('createSaleInstallments', installmentError);
    }

    await this.updateUnitStatus(companyId, saleRow.unit_id, {
      status: 'sold',
      reason: `Sale ${saleRow.number}`,
      changedBy: sale.created_by || null,
    });

    return this.getSale(companyId, saleRow.id);
  }

  async updateSale(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('sales')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('updateSale', error);
    if (!data) throw notFound('Sale not found.');
    return this.getSale(companyId, data.id);
  }

  async listInstallments(companyId) {
    const { data, error } = await this.client()
      .from('installments')
      .select(INSTALLMENT_SELECT)
      .eq('company_id', companyId)
      .order('due_date');
    if (error) fail('listInstallments', error);
    return (data || []).map((row) => {
      const { plan, ...sale } = row.sale || {};
      return this.installmentView({ ...row, sale: row.sale ? sale : null }, plan);
    });
  }

  async getInstallment(companyId, id) {
    const { data, error } = await this.client()
      .from('installments')
      .select(INSTALLMENT_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getInstallment', error);
    if (!data) return null;
    const { plan, ...sale } = data.sale || {};
    return this.installmentView({ ...data, sale: data.sale ? sale : null }, plan);
  }

  async updateInstallment(companyId, saleId, id, patch) {
    const { data, error } = await this.client()
      .from('installments')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('sale_id', saleId)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateInstallment', error);
    if (!data) throw notFound('Installment not found.');
    return this.getInstallment(companyId, data.id);
  }

  receiptView(row) {
    if (!row) return null;
    const allocations = (row.allocations || []).map((allocation) => ({
      ...allocation,
      sale: allocation.installment?.sale
        ? { id: allocation.installment.sale.id, number: allocation.installment.sale.number }
        : null,
      lease: allocation.rent_schedule?.lease
        ? {
            id: allocation.rent_schedule.lease.id,
            number: allocation.rent_schedule.lease.number,
          }
        : null,
    }));
    const settles = allocations
      .map((allocation) => allocation.sale?.number || allocation.lease?.number)
      .filter((value, index, all) => value && all.indexOf(value) === index)
      .join(', ');
    return { ...row, allocations, settles };
  }

  async listReceipts(companyId) {
    const { data, error } = await this.client()
      .from('receipts')
      .select(RECEIPT_SELECT)
      .eq('company_id', companyId)
      .order('received_on', { ascending: false });
    if (error) fail('listReceipts', error);
    return (data || []).map((row) => this.receiptView(row));
  }

  async getReceipt(companyId, id) {
    const { data, error } = await this.client()
      .from('receipts')
      .select(RECEIPT_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getReceipt', error);
    return this.receiptView(data);
  }

  async createReceipt(companyId, payload) {
    const { allocations = [], ...input } = payload;
    const { data, error } = await this.client().rpc('post_sale_receipt', {
      p_company_id: companyId,
      p_customer_id: input.customer_id,
      p_number: input.number,
      p_received_on: input.received_on,
      p_amount: input.amount,
      p_reference: input.reference || null,
      p_notes: input.notes || null,
      p_created_by: input.created_by || null,
      p_allocations: allocations.map((row) => ({
        installment_id: row.installment_id,
        amount: row.amount,
      })),
    });
    if (error) {
      const message = String(error.message || '');
      if (/balance|allocation|installment|amount/i.test(message)) {
        throw new ApiError(422, message.replace(/^.*?ERROR:\s*/i, ''));
      }
      fail('createReceipt', error);
    }
    return this.getReceipt(companyId, data);
  }

  async voidReceipt(companyId, id, { reason, userId }) {
    const { data, error } = await this.client().rpc('void_sale_receipt', {
      p_company_id: companyId,
      p_receipt_id: id,
      p_reason: reason || null,
      p_user_id: userId || null,
    });
    if (error) {
      const message = String(error.message || '');
      if (/void|receipt|completed/i.test(message)) {
        throw new ApiError(422, message.replace(/^.*?ERROR:\s*/i, ''));
      }
      fail('voidReceipt', error);
    }
    return this.getReceipt(companyId, data);
  }

  // --- Rental ---------------------------------------------------------

  depositView(row) {
    if (!row) return null;
    return {
      ...row,
      held_amount: depositHeld(row),
      transactions: [...(row.transactions || [])].sort((a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)),
      ),
    };
  }

  leaseSummary(row) {
    if (!row) return null;
    const today = new Date().toISOString().slice(0, 10);
    const graceDays = Number(row.grace_days || 0);
    const schedules = [...(row.schedules || [])]
      .sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)))
      .map((schedule) => rentScheduleView(schedule, { today, graceDays }));
    const depositRow = Array.isArray(row.deposit) ? row.deposit[0] : row.deposit;
    return {
      ...row,
      deposit: depositRow ? this.depositView(depositRow) : null,
      schedules,
      ...rentSummary(schedules, { today }),
      days_remaining: Math.ceil(
        (Date.parse(`${row.end_date}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) /
          86400000,
      ),
    };
  }

  tenantSummary(row) {
    if (!row) return null;
    const today = new Date().toISOString().slice(0, 10);
    const leases = (row.leases || []).filter((lease) => !lease.deleted_at);
    const active = leases.find((lease) => lease.status === 'active') || null;
    const schedules = active
      ? [...(active.schedules || [])]
          .sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)))
          .map((schedule) =>
            rentScheduleView(schedule, {
              today,
              graceDays: Number(active.grace_days || 0),
            }),
          )
      : [];
    const summary = rentSummary(schedules, { today });
    return {
      ...row,
      leases: leases.map((lease) => ({
        id: lease.id,
        number: lease.number,
        status: lease.status,
        start_date: lease.start_date,
        end_date: lease.end_date,
      })),
      current_lease: active
        ? {
            id: active.id,
            number: active.number,
            status: active.status,
            end_date: active.end_date,
            unit: active.unit || null,
            balance_due: summary.balance_due,
          }
        : null,
      current_unit: active?.unit?.unit_number || null,
      lease_ends: active?.end_date || null,
      balance_due: summary.balance_due,
    };
  }

  rentRollSummary(row) {
    if (!row) return null;
    const lease = row.lease || null;
    const view = rentScheduleView(row, {
      today: new Date().toISOString().slice(0, 10),
      graceDays: Number(lease?.grace_days || 0),
    });
    return {
      ...view,
      lease_id: lease?.id || row.lease_id || null,
      lease_number: lease?.number || null,
      lease_status: lease?.status || null,
      tenant_id: lease?.tenant_id || null,
      tenant: lease?.tenant || null,
      unit: lease?.unit || null,
      project: lease?.unit?.project || null,
    };
  }

  async listTenants(companyId) {
    const { data, error } = await this.client()
      .from('tenants')
      .select(TENANT_SELECT)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('name');
    if (error) fail('listTenants', error);
    return (data || []).map((row) => this.tenantSummary(row));
  }

  async getTenant(companyId, id) {
    const { data, error } = await this.client()
      .from('tenants')
      .select(TENANT_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('getTenant', error);
    return this.tenantSummary(data);
  }

  async createTenant(companyId, patch) {
    const { data, error } = await this.client()
      .from('tenants')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) fail('createTenant', error);
    return this.getTenant(companyId, data.id);
  }

  async updateTenant(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('tenants')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('updateTenant', error);
    if (!data) throw notFound('Tenant not found.');
    return this.getTenant(companyId, data.id);
  }

  async deleteTenant(companyId, id) {
    const { data, error } = await this.client()
      .from('tenants')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('deleteTenant', error);
    if (!data) throw notFound('Tenant not found.');
  }

  async countTenantActiveLeases(companyId, tenantId) {
    const { count, error } = await this.client()
      .from('leases')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .is('deleted_at', null);
    if (error) fail('countTenantActiveLeases', error);
    return count || 0;
  }

  async listLeases(companyId) {
    const { data, error } = await this.client()
      .from('leases')
      .select(LEASE_SELECT)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('start_date', { ascending: false });
    if (error) fail('listLeases', error);
    return (data || []).map((row) => this.leaseSummary(row));
  }

  async getLease(companyId, id) {
    const { data, error } = await this.client()
      .from('leases')
      .select(LEASE_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) fail('getLease', error);
    if (!data) return null;
    const lease = this.leaseSummary(data);
    const { data: nextLease, error: nextError } = await this.client()
      .from('leases')
      .select('id, number, status')
      .eq('company_id', companyId)
      .eq('previous_lease_id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (nextError) fail('getNextLease', nextError);
    return { ...lease, next_lease: nextLease || null };
  }

  async createLease(companyId, { lease, schedule = [], deposit = null }) {
    const { data, error } = await this.client()
      .from('leases')
      .insert({ company_id: companyId, ...lease })
      .select('id')
      .single();
    if (error) fail('createLease', error);

    if (schedule.length) {
      const { error: scheduleError } = await this.client().from('rent_schedules').insert(
        schedule.map((row) => ({
          company_id: companyId,
          lease_id: data.id,
          balance: row.rent_amount,
          status: 'upcoming',
          ...row,
        })),
      );
      if (scheduleError) fail('createLeaseSchedules', scheduleError);
    }

    if (deposit) {
      const { error: depositError } = await this.client()
        .from('security_deposits')
        .insert({ company_id: companyId, lease_id: data.id, ...deposit });
      if (depositError) fail('createLeaseDeposit', depositError);
    }

    return this.getLease(companyId, data.id);
  }

  async updateLease(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('leases')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();
    if (error) fail('updateLease', error);
    if (!data) throw notFound('Lease not found.');
    return this.getLease(companyId, data.id);
  }

  async findActiveLeaseForUnit(companyId, unitId, excludeId = null) {
    let query = this.client()
      .from('leases')
      .select('id, number, status')
      .eq('company_id', companyId)
      .eq('unit_id', unitId)
      .eq('status', 'active')
      .is('deleted_at', null);
    if (excludeId) query = query.neq('id', excludeId);
    const { data, error } = await query.maybeSingle();
    if (error) fail('findActiveLeaseForUnit', error);
    return data || null;
  }

  async listRentSchedules(companyId) {
    const { data, error } = await this.client()
      .from('rent_schedules')
      .select(RENT_SCHEDULE_SELECT)
      .eq('company_id', companyId)
      .order('due_date');
    if (error) fail('listRentSchedules', error);
    return (data || []).map((row) => this.rentRollSummary(row));
  }

  async getRentSchedule(companyId, id) {
    const { data, error } = await this.client()
      .from('rent_schedules')
      .select(RENT_SCHEDULE_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getRentSchedule', error);
    return this.rentRollSummary(data);
  }

  async createRentSchedules(companyId, leaseId, rows) {
    if (!rows.length) return [];
    const { error } = await this.client()
      .from('rent_schedules')
      .insert(
        rows.map((row) => ({
          company_id: companyId,
          lease_id: leaseId,
          balance: row.rent_amount,
          status: 'upcoming',
          ...row,
        })),
      );
    if (error) fail('createRentSchedules', error);
    const { data, error: listError } = await this.client()
      .from('rent_schedules')
      .select(RENT_SCHEDULE_SELECT)
      .eq('company_id', companyId)
      .eq('lease_id', leaseId)
      .order('period_start');
    if (listError) fail('listCreatedRentSchedules', listError);
    return (data || []).map((row) => this.rentRollSummary(row));
  }

  async updateRentSchedule(companyId, leaseId, scheduleId, patch) {
    const { data, error } = await this.client()
      .from('rent_schedules')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', scheduleId)
      .eq('lease_id', leaseId)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateRentSchedule', error);
    if (!data) throw notFound('Rent period not found.');
    return this.getRentSchedule(companyId, data.id);
  }

  async createRentAdjustment(companyId, payload) {
    const { data, error } = await this.client()
      .from('rent_adjustments')
      .insert({ company_id: companyId, ...payload })
      .select('*')
      .single();
    if (error) fail('createRentAdjustment', error);
    return data;
  }

  async listDeposits(companyId) {
    const { data, error } = await this.client()
      .from('security_deposits')
      .select(DEPOSIT_SELECT)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) fail('listDeposits', error);
    return (data || []).map((row) => this.depositView(row));
  }

  async getDeposit(companyId, id) {
    const { data, error } = await this.client()
      .from('security_deposits')
      .select(DEPOSIT_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getDeposit', error);
    return this.depositView(data);
  }

  async getDepositByLease(companyId, leaseId) {
    const { data, error } = await this.client()
      .from('security_deposits')
      .select(DEPOSIT_SELECT)
      .eq('company_id', companyId)
      .eq('lease_id', leaseId)
      .maybeSingle();
    if (error) fail('getDepositByLease', error);
    return this.depositView(data);
  }

  async createDeposit(companyId, payload) {
    const { data, error } = await this.client()
      .from('security_deposits')
      .insert({ company_id: companyId, ...payload })
      .select('id')
      .single();
    if (error) fail('createDeposit', error);
    return this.getDeposit(companyId, data.id);
  }

  async updateDeposit(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('security_deposits')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateDeposit', error);
    if (!data) throw notFound('Security deposit not found.');
    return this.getDeposit(companyId, data.id);
  }

  async createDepositTransaction(companyId, payload) {
    const { data, error } = await this.client()
      .from('deposit_transactions')
      .insert({ company_id: companyId, ...payload })
      .select('*')
      .single();
    if (error) fail('createDepositTransaction', error);
    return data;
  }

  async listDepositTransactions(companyId, depositId) {
    const { data, error } = await this.client()
      .from('deposit_transactions')
      .select('*')
      .eq('company_id', companyId)
      .eq('deposit_id', depositId)
      .order('created_at', { ascending: false });
    if (error) fail('listDepositTransactions', error);
    return data || [];
  }

  async listRentReceipts(companyId) {
    const { data, error } = await this.client()
      .from('receipts')
      .select(RECEIPT_SELECT)
      .eq('company_id', companyId)
      .not('tenant_id', 'is', null)
      .order('received_on', { ascending: false });
    if (error) fail('listRentReceipts', error);
    return (data || []).map((row) => this.receiptView(row));
  }

  async getRentReceipt(companyId, id) {
    const { data, error } = await this.client()
      .from('receipts')
      .select(RECEIPT_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .not('tenant_id', 'is', null)
      .maybeSingle();
    if (error) fail('getRentReceipt', error);
    return this.receiptView(data);
  }

  async createRentReceipt(companyId, payload) {
    const { allocations = [], ...input } = payload;
    const { data, error } = await this.client().rpc('post_rent_receipt', {
      p_company_id: companyId,
      p_tenant_id: input.tenant_id,
      p_number: input.number,
      p_received_on: input.received_on,
      p_amount: input.amount,
      p_reference: input.reference || null,
      p_notes: input.notes || null,
      p_created_by: input.created_by || null,
      p_allocations: allocations.map((row) => ({
        rent_schedule_id: row.rent_schedule_id,
        amount: row.amount,
      })),
    });
    if (error) {
      const message = String(error.message || '');
      if (/balance|allocation|rent|amount|equal/i.test(message)) {
        throw new ApiError(422, message.replace(/^.*?ERROR:\s*/i, ''));
      }
      fail('createRentReceipt', error);
    }
    return this.getRentReceipt(companyId, data);
  }

  async voidRentReceipt(companyId, id, { reason, userId }) {
    const { data, error } = await this.client().rpc('void_rent_receipt', {
      p_company_id: companyId,
      p_receipt_id: id,
      p_reason: reason || null,
      p_user_id: userId || null,
    });
    if (error) {
      const message = String(error.message || '');
      if (/void|receipt|completed/i.test(message)) {
        throw new ApiError(422, message.replace(/^.*?ERROR:\s*/i, ''));
      }
      fail('voidRentReceipt', error);
    }
    return this.getRentReceipt(companyId, data);
  }

  async listCommissionRules(companyId) {
    const { data, error } = await this.client()
      .from('commission_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (error) fail('listCommissionRules', error);
    return data || [];
  }

  async getCommissionRule(companyId, id) {
    const { data, error } = await this.client()
      .from('commission_rules')
      .select('*')
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getCommissionRule', error);
    return data || null;
  }

  async createCommissionRule(companyId, patch) {
    const { data, error } = await this.client()
      .from('commission_rules')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) fail('createCommissionRule', error);
    return this.getCommissionRule(companyId, data.id);
  }

  async updateCommissionRule(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('commission_rules')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateCommissionRule', error);
    if (!data) throw notFound('Commission rule not found.');
    return this.getCommissionRule(companyId, data.id);
  }

  async deleteCommissionRule(companyId, id) {
    const { error } = await this.client()
      .from('commission_rules')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId);
    if (error) fail('deleteCommissionRule', error);
  }

  async listSalesCommissions(companyId, filters = {}) {
    let query = this.client()
      .from('sales_commissions')
      .select(COMMISSION_SELECT)
      .eq('company_id', companyId);
    if (filters.sale_id) query = query.eq('sale_id', filters.sale_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.salesperson_id) query = query.eq('salesperson_id', filters.salesperson_id);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) fail('listSalesCommissions', error);
    return data || [];
  }

  async getSalesCommission(companyId, id) {
    const { data, error } = await this.client()
      .from('sales_commissions')
      .select(COMMISSION_SELECT)
      .eq('company_id', companyId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getSalesCommission', error);
    return data || null;
  }

  async createSalesCommission(companyId, patch) {
    const { data, error } = await this.client()
      .from('sales_commissions')
      .insert({ company_id: companyId, ...patch })
      .select('id')
      .single();
    if (error) fail('createSalesCommission', error);
    return this.getSalesCommission(companyId, data.id);
  }

  async updateSalesCommission(companyId, id, patch) {
    const { data, error } = await this.client()
      .from('sales_commissions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('company_id', companyId)
      .select('id')
      .maybeSingle();
    if (error) fail('updateSalesCommission', error);
    if (!data) throw notFound('Commission entry not found.');
    return this.getSalesCommission(companyId, data.id);
  }

  async getLookup(companyId, id, listKey = null) {
    let query = this.client()
      .from('lookups')
      .select('id, name, list_key, color, sort_order, is_active')
      .eq('company_id', companyId)
      .eq('id', id)
      .eq('is_active', true);
    if (listKey) query = query.eq('list_key', listKey);
    const { data, error } = await query.maybeSingle();
    if (error) fail('getLookup', error);
    return data || null;
  }

  async getLookups(companyId) {
    const [branchesResult, rolesResult, usersResult, unitTypesResult, sourcesResult] =
      await Promise.all([
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
        this.client()
          .from('lookups')
          .select('id, name, sort_order')
          .eq('company_id', companyId)
          .eq('list_key', 'source')
          .eq('is_active', true)
          .order('sort_order')
          .order('name'),
      ]);

    if (branchesResult.error) fail('lookupBranches', branchesResult.error);
    if (rolesResult.error) fail('lookupRoles', rolesResult.error);
    if (usersResult.error) fail('lookupUsers', usersResult.error);
    if (unitTypesResult.error) fail('lookupUnitTypes', unitTypesResult.error);
    if (sourcesResult.error) fail('lookupSources', sourcesResult.error);

    return {
      branches: branchesResult.data || [],
      roles: rolesResult.data || [],
      users: usersResult.data || [],
      unit_types: unitTypesResult.data || [],
      sources: sourcesResult.data || [],
    };
  }

  async listNotifications(companyId, userId, { unreadOnly = false, limit = 20, offset = 0 } = {}) {
    let query = this.client()
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (unreadOnly) query = query.eq('is_read', false);
    const { data, error } = await query;
    if (error) fail('listNotifications', error);
    return data || [];
  }

  async countUnreadNotifications(companyId, userId) {
    const { count, error } = await this.client()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) fail('countUnreadNotifications', error);
    return count || 0;
  }

  async countNotifications(companyId, userId, { unreadOnly = false } = {}) {
    let query = this.client()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('user_id', userId);
    if (unreadOnly) query = query.eq('is_read', false);
    const { count, error } = await query;
    if (error) fail('countNotifications', error);
    return count || 0;
  }

  async getNotification(companyId, userId, id) {
    const { data, error } = await this.client()
      .from('notifications')
      .select('*')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();
    if (error) fail('getNotification', error);
    return data || null;
  }

  async markNotificationRead(companyId, userId, id) {
    const { data, error } = await this.client()
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) fail('markNotificationRead', error);
    return data || null;
  }

  async markAllNotificationsRead(companyId, userId) {
    const { data, error } = await this.client()
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .eq('is_read', false)
      .select('id');
    if (error) fail('markAllNotificationsRead', error);
    return (data || []).length;
  }

  async createNotification(companyId, payload) {
    const { data, error } = await this.client()
      .from('notifications')
      .insert({ company_id: companyId, ...payload })
      .select('*')
      .single();
    if (error) fail('createNotification', error);
    return data;
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
