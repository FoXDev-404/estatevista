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

export async function listProjects(params) {
  const response = await apiRequest(`/projects${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getProject(id) {
  const response = await apiRequest(`/projects/${id}`);
  return response?.data ?? null;
}

export async function createProject(values) {
  const response = await apiRequest('/projects', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateProject(id, values) {
  const response = await apiRequest(`/projects/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function deleteProject(id) {
  const response = await apiRequest(`/projects/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

export async function listBuildings(projectId) {
  const response = await apiRequest(`/projects/${projectId}/buildings`);
  return response?.data ?? [];
}

export async function createBuilding(projectId, values) {
  const response = await apiRequest(`/projects/${projectId}/buildings`, {
    method: 'POST',
    body: values,
  });
  return response?.data ?? null;
}

export async function updateBuilding(projectId, buildingId, values) {
  const response = await apiRequest(`/projects/${projectId}/buildings/${buildingId}`, {
    method: 'PATCH',
    body: values,
  });
  return response?.data ?? null;
}

export async function deleteBuilding(projectId, buildingId) {
  const response = await apiRequest(`/projects/${projectId}/buildings/${buildingId}`, {
    method: 'DELETE',
  });
  return response?.data ?? null;
}

export async function createFloor(projectId, buildingId, values) {
  const response = await apiRequest(`/projects/${projectId}/buildings/${buildingId}/floors`, {
    method: 'POST',
    body: values,
  });
  return response?.data ?? null;
}

export async function deleteFloor(projectId, buildingId, floorId) {
  const response = await apiRequest(
    `/projects/${projectId}/buildings/${buildingId}/floors/${floorId}`,
    { method: 'DELETE' },
  );
  return response?.data ?? null;
}

export async function generateUnits(projectId, values) {
  const response = await apiRequest(`/projects/${projectId}/units/generate`, {
    method: 'POST',
    body: values,
  });
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function listUnits(params) {
  const response = await apiRequest(`/units${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getUnit(id) {
  const response = await apiRequest(`/units/${id}`);
  return response?.data ?? null;
}

export async function createUnit(values) {
  const response = await apiRequest('/units', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateUnit(id, values) {
  const response = await apiRequest(`/units/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function updateUnitStatus(id, values) {
  const response = await apiRequest(`/units/${id}/status`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function getUnitHistory(id) {
  const response = await apiRequest(`/units/${id}/history`);
  return response?.data ?? [];
}

export async function deleteUnit(id) {
  const response = await apiRequest(`/units/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

export async function listDocuments(params) {
  const response = await apiRequest(`/documents${queryString(params)}`);
  return response?.data ?? [];
}

export async function uploadDocument(values) {
  const response = await apiRequest('/documents', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function deleteDocument(id) {
  const response = await apiRequest(`/documents/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

const inventoryApiService = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listBuildings,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  createFloor,
  deleteFloor,
  generateUnits,
  listUnits,
  getUnit,
  createUnit,
  updateUnit,
  updateUnitStatus,
  getUnitHistory,
  deleteUnit,
  listDocuments,
  uploadDocument,
  deleteDocument,
};

export default inventoryApiService;
