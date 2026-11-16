import { randomUUID } from 'node:crypto';
import { ApiError, notFound } from '../lib/errors.js';
import { sortSequences } from './catalog.js';

/**
 * In-memory implementation of the admin repository contract. It mirrors the
 * Supabase implementation closely enough for route tests: company scoping,
 * joined role/branch summaries, audit rows and the safety counts used before
 * deactivating a full-access administrator.
 */
export class MemoryAdminRepository {
  constructor({
    companies = [],
    settings = [],
    sequences = [],
    branches = [],
    projects = [],
    team = [],
    roles = [],
    rolePermissions = {},
  } = {}) {
    this.companies = companies.map((row) => ({ ...row }));
    this.settings = settings.map((row) => ({ ...row }));
    this.sequences = sequences.map((row) => ({ ...row }));
    this.branches = branches.map((row) => ({ ...row }));
    this.projects = projects.map((row) => ({ ...row }));
    this.team = team.map((row) => ({ ...row, roles: [...(row.roles || [])] }));
    this.roles = roles.map((row) => ({ ...row }));
    this.rolePermissions = new Map(
      Object.entries(rolePermissions).map(([roleId, keys]) => [roleId, [...keys]]),
    );
    this.auditLogs = [];
    this.deletedSessionsFor = [];
  }

  async getCompany(companyId) {
    const company = this.companies.find((row) => row.id === companyId);
    if (!company) throw notFound('Company not found.');
    return { ...company };
  }

  async updateCompany(companyId, patch) {
    const company = this.companies.find((row) => row.id === companyId);
    if (!company) throw notFound('Company not found.');
    Object.assign(company, patch, { updated_at: new Date().toISOString() });
    return { ...company };
  }

  async getSettings(companyId) {
    let settings = this.settings.find((row) => row.company_id === companyId);
    if (!settings) {
      settings = { company_id: companyId, updated_at: new Date().toISOString() };
      this.settings.push(settings);
    }
    return { ...settings };
  }

  async updateSettings(companyId, patch) {
    let settings = this.settings.find((row) => row.company_id === companyId);
    if (!settings) {
      settings = { company_id: companyId };
      this.settings.push(settings);
    }
    Object.assign(settings, patch, { updated_at: new Date().toISOString() });
    return { ...settings };
  }

  async listSequences(companyId) {
    return sortSequences(this.sequences.filter((row) => row.company_id === companyId)).map(
      (row) => ({ ...row }),
    );
  }

  async updateSequence(companyId, id, patch) {
    const sequence = this.sequences.find(
      (row) => row.company_id === companyId && row.id === id,
    );
    if (!sequence) throw notFound('Number sequence not found.');
    Object.assign(sequence, patch, { updated_at: new Date().toISOString() });
    return { ...sequence };
  }

  async listBranches(companyId) {
    const companyTeam = this.team.filter((row) => row.company_id === companyId);
    return this.branches
      .filter((row) => row.company_id === companyId)
      .map((branch) => {
        const manager = companyTeam.find((member) => member.id === branch.manager_id) || null;
        return {
          ...branch,
          team_count: companyTeam.filter((member) => member.branch_id === branch.id).length,
          manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getBranch(companyId, id) {
    const branches = await this.listBranches(companyId);
    return branches.find((branch) => branch.id === id) || null;
  }

  async createBranch(companyId, patch) {
    const duplicate = this.branches.find(
      (row) => row.company_id === companyId && row.code.toLowerCase() === patch.code.toLowerCase(),
    );
    if (duplicate) {
      throw new ApiError(422, 'A branch with this code already exists.', {
        code: 'Choose a different branch code.',
      });
    }

    const row = {
      id: randomUUID(),
      company_id: companyId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    };
    this.branches.push(row);
    return this.getBranch(companyId, row.id);
  }

  async updateBranch(companyId, id, patch) {
    const branch = this.branches.find((row) => row.company_id === companyId && row.id === id);
    if (!branch) throw notFound('Branch not found.');
    Object.assign(branch, patch, { updated_at: new Date().toISOString() });
    return this.getBranch(companyId, id);
  }

  async deleteBranch(companyId, id) {
    this.branches = this.branches.filter(
      (row) => !(row.company_id === companyId && row.id === id),
    );
  }

  async countBranchTeam(companyId, branchId) {
    return this.team.filter(
      (row) => row.company_id === companyId && row.branch_id === branchId,
    ).length;
  }

  async countBranchProjects(companyId, branchId) {
    return this.projects.filter(
      (row) => row.company_id === companyId && row.branch_id === branchId,
    ).length;
  }

  async listTeam(companyId) {
    const branches = this.branches.filter((row) => row.company_id === companyId);
    return this.team
      .filter((row) => row.company_id === companyId)
      .map((member) => {
        const { password_hash: _ignored, ...safe } = member;
        const branch = branches.find((row) => row.id === member.branch_id) || null;
        return {
          ...safe,
          branch: branch ? { id: branch.id, name: branch.name, code: branch.code } : null,
          roles: [...(member.roles || [])],
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTeamMember(companyId, id) {
    const members = await this.listTeam(companyId);
    return members.find((member) => member.id === id) || null;
  }

  async findTeamMemberByEmail(companyId, email) {
    const member = this.team.find(
      (row) =>
        row.company_id === companyId &&
        row.email.toLowerCase() === String(email).trim().toLowerCase(),
    );
    return member ? { id: member.id, email: member.email } : null;
  }

  async createTeamMember(companyId, user, roleIds = []) {
    const row = {
      id: randomUUID(),
      company_id: companyId,
      branch_id: null,
      full_access: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      roles: roleIds
        .map((roleId) => this.roles.find((role) => role.id === roleId))
        .filter(Boolean)
        .map((role) => ({ id: role.id, name: role.name })),
      ...user,
    };
    this.team.push(row);
    return this.getTeamMember(companyId, row.id);
  }

  async updateTeamMember(companyId, id, patch, roleIds) {
    const member = this.team.find((row) => row.company_id === companyId && row.id === id);
    if (!member) throw notFound('Team member not found.');
    Object.assign(member, patch, { updated_at: new Date().toISOString() });

    if (Array.isArray(roleIds)) {
      member.roles = roleIds
        .map((roleId) => this.roles.find((role) => role.id === roleId))
        .filter(Boolean)
        .map((role) => ({ id: role.id, name: role.name }));
    }
    return this.getTeamMember(companyId, id);
  }

  async countActiveFullAccess(companyId, excludeId = null) {
    return this.team.filter(
      (row) =>
        row.company_id === companyId &&
        row.full_access &&
        row.is_active &&
        row.id !== excludeId,
    ).length;
  }

  async deleteSessionsForUser(userId) {
    this.deletedSessionsFor.push(userId);
  }

  async listRoles(companyId) {
    return this.roles
      .filter((row) => row.company_id === companyId)
      .map((role) => ({
        ...role,
        member_count: this.team.filter((member) =>
          (member.roles || []).some((assigned) => assigned.id === role.id),
        ).length,
        permission_count: (this.rolePermissions.get(role.id) || []).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getRole(companyId, id) {
    const role = this.roles.find((row) => row.company_id === companyId && row.id === id);
    if (!role) return null;
    return {
      ...role,
      permission_keys: [...(this.rolePermissions.get(role.id) || [])].sort(),
      member_count: this.team.filter((member) =>
        (member.roles || []).some((assigned) => assigned.id === role.id),
      ).length,
    };
  }

  async listPermissions() {
    const keys = new Set();
    for (const values of this.rolePermissions.values()) {
      for (const key of values) keys.add(key);
    }
    return [...keys].sort().map((key, index) => ({ id: index + 1, key }));
  }

  async permissionIdsForKeys(keys = []) {
    const rows = await this.listPermissions();
    const wanted = new Set(keys);
    return rows.filter((row) => wanted.has(row.key)).map((row) => row.id);
  }

  async replaceRolePermissions(roleId, permissionKeys) {
    this.rolePermissions.set(roleId, [...new Set(permissionKeys)].sort());
  }

  async createRole(companyId, role, permissionKeys) {
    const duplicate = this.roles.find(
      (row) => row.company_id === companyId && row.name.toLowerCase() === role.name.toLowerCase(),
    );
    if (duplicate) {
      throw new ApiError(422, 'A role with this name already exists.', {
        name: 'Choose a different role name.',
      });
    }

    const row = {
      id: randomUUID(),
      company_id: companyId,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...role,
    };
    this.roles.push(row);
    await this.replaceRolePermissions(row.id, permissionKeys);
    return this.getRole(companyId, row.id);
  }

  async updateRole(companyId, id, patch, permissionKeys) {
    const role = this.roles.find((row) => row.company_id === companyId && row.id === id);
    if (!role) throw notFound('Role not found.');
    Object.assign(role, patch, { updated_at: new Date().toISOString() });
    if (Array.isArray(permissionKeys)) {
      await this.replaceRolePermissions(id, permissionKeys);
    }
    return this.getRole(companyId, id);
  }

  async deleteRole(companyId, id) {
    this.roles = this.roles.filter(
      (row) => !(row.company_id === companyId && row.id === id),
    );
    this.rolePermissions.delete(id);
  }

  async listAuditLogs(companyId, filters = {}) {
    const { page = 1, limit = 25, userId, module, event, dateFrom, dateTo } = filters;
    let rows = this.auditLogs.filter((row) => row.company_id === companyId);

    if (userId) rows = rows.filter((row) => row.user_id === userId);
    if (module) rows = rows.filter((row) => row.module === module);
    if (event) rows = rows.filter((row) => row.event === event);
    if (dateFrom) rows = rows.filter((row) => row.created_at >= dateFrom);
    if (dateTo) rows = rows.filter((row) => row.created_at <= dateTo);

    rows = [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const total = rows.length;
    const from = (page - 1) * limit;

    return {
      data: rows.slice(from, from + limit).map((row) => ({
        ...row,
        user: this.team.find((member) => member.id === row.user_id) || null,
      })),
      total,
    };
  }

  async listAuditOptions(companyId) {
    const rows = this.auditLogs.filter((row) => row.company_id === companyId);
    return {
      modules: [...new Set(rows.map((row) => row.module).filter(Boolean))].sort(),
      users: this.team
        .filter((row) => row.company_id === companyId)
        .map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          is_active: row.is_active,
        })),
    };
  }

  async getLookups(companyId) {
    return {
      branches: this.branches
        .filter((row) => row.company_id === companyId)
        .map((row) => ({ id: row.id, name: row.name, code: row.code, is_active: row.is_active })),
      roles: this.roles
        .filter((row) => row.company_id === companyId)
        .map((row) => ({ id: row.id, name: row.name, is_default: row.is_default })),
      users: this.team
        .filter((row) => row.company_id === companyId)
        .map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          is_active: row.is_active,
          full_access: row.full_access,
          branch_id: row.branch_id,
        })),
    };
  }

  async writeAudit(entry) {
    const row = {
      id: this.auditLogs.length + 1,
      created_at: new Date().toISOString(),
      ...entry,
      company_id: entry.companyId ?? entry.company_id,
      user_id: entry.userId ?? entry.user_id ?? null,
      before_data: entry.before ?? entry.before_data ?? null,
      after_data: entry.after ?? entry.after_data ?? null,
    };
    delete row.companyId;
    delete row.userId;
    delete row.before;
    delete row.after;
    this.auditLogs.push(row);
  }
}

export default MemoryAdminRepository;
