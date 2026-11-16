import { apiRequest } from './apiClient';

function queryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

export async function getSettings() {
  const response = await apiRequest('/settings');
  return { data: response?.data ?? null, meta: response?.meta ?? null };
}

export async function updateProfile(values) {
  const response = await apiRequest('/settings/profile', { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function updateLocalization(values) {
  const response = await apiRequest('/settings/localization', { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function updateNumbering(sequences) {
  const response = await apiRequest('/settings/numbering', {
    method: 'PATCH',
    body: { sequences },
  });
  return response?.data ?? [];
}

export async function listBranches(params) {
  const response = await apiRequest(`/branches${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getBranch(id) {
  const response = await apiRequest(`/branches/${id}`);
  return response?.data ?? null;
}

export async function createBranch(values) {
  const response = await apiRequest('/branches', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateBranch(id, values) {
  const response = await apiRequest(`/branches/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function updateBranchStatus(id, isActive) {
  const response = await apiRequest(`/branches/${id}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
  });
  return response?.data ?? null;
}

export async function deleteBranch(id) {
  const response = await apiRequest(`/branches/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

export async function listTeam(params) {
  const response = await apiRequest(`/team${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getTeamMember(id) {
  const response = await apiRequest(`/team/${id}`);
  return response?.data ?? null;
}

export async function createTeamMember(values) {
  const response = await apiRequest('/team', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateTeamMember(id, values) {
  const response = await apiRequest(`/team/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function updateTeamStatus(id, isActive) {
  const response = await apiRequest(`/team/${id}/status`, {
    method: 'PATCH',
    body: { is_active: isActive },
  });
  return response?.data ?? null;
}

export async function getPermissionCatalog() {
  const response = await apiRequest('/roles/permissions');
  return response?.data ?? { groups: [], total: 0 };
}

export async function listRoles() {
  const response = await apiRequest('/roles');
  return response?.data ?? [];
}

export async function getRole(id) {
  const response = await apiRequest(`/roles/${id}`);
  return response?.data ?? null;
}

export async function createRole(values) {
  const response = await apiRequest('/roles', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateRole(id, values) {
  const response = await apiRequest(`/roles/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function deleteRole(id) {
  const response = await apiRequest(`/roles/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

export async function listAuditLogs(params) {
  const response = await apiRequest(`/audit-logs${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getAuditOptions() {
  const response = await apiRequest('/audit-logs/options');
  return response?.data ?? { modules: [], users: [], events: [] };
}

export async function getLookups() {
  const response = await apiRequest('/lookups');
  return response?.data ?? { branches: [], roles: [], users: [] };
}

const adminApiService = {
  getSettings,
  updateProfile,
  updateLocalization,
  updateNumbering,
  listBranches,
  getBranch,
  createBranch,
  updateBranch,
  updateBranchStatus,
  deleteBranch,
  listTeam,
  getTeamMember,
  createTeamMember,
  updateTeamMember,
  updateTeamStatus,
  getPermissionCatalog,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  listAuditLogs,
  getAuditOptions,
  getLookups,
};

export default adminApiService;
