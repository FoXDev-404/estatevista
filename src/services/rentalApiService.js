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

// --- Tenants ------------------------------------------------------------

export async function listTenants(params) {
  const response = await apiRequest(`/tenants${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getTenant(id) {
  const response = await apiRequest(`/tenants/${id}`);
  return response?.data ?? null;
}

export async function createTenant(values) {
  const response = await apiRequest('/tenants', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateTenant(id, values) {
  const response = await apiRequest(`/tenants/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function deleteTenant(id) {
  const response = await apiRequest(`/tenants/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

// --- Leases -------------------------------------------------------------

export async function listLeases(params) {
  const response = await apiRequest(`/leases${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getLease(id) {
  const response = await apiRequest(`/leases/${id}`);
  return response?.data ?? null;
}

export async function createLease(values) {
  const response = await apiRequest('/leases', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateLease(id, values) {
  const response = await apiRequest(`/leases/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function activateLease(id) {
  const response = await apiRequest(`/leases/${id}/activate`, { method: 'POST', body: {} });
  return response?.data ?? null;
}

export async function renewLease(id, values) {
  const response = await apiRequest(`/leases/${id}/renew`, { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function reviseLeaseRent(id, values) {
  const response = await apiRequest(`/leases/${id}/revise-rent`, {
    method: 'POST',
    body: values,
  });
  return response?.data ?? null;
}

export async function terminateLease(id, values) {
  const response = await apiRequest(`/leases/${id}/terminate`, { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function adjustRentSchedule(leaseId, scheduleId, values) {
  const response = await apiRequest(`/leases/${leaseId}/schedule/${scheduleId}/adjustments`, {
    method: 'POST',
    body: values,
  });
  return response?.data ?? null;
}

// --- Rent roll and collections -----------------------------------------

export async function listRentRoll(params) {
  const response = await apiRequest(`/rent-roll${queryString(params)}`);
  return {
    data: response?.data ?? [],
    meta: response?.meta ?? null,
    summary: response?.summary ?? null,
  };
}

export async function listRentCollections(params) {
  const response = await apiRequest(`/rent-collections${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getRentCollection(id) {
  const response = await apiRequest(`/rent-collections/${id}`);
  return response?.data ?? null;
}

export async function createRentCollection(values) {
  const response = await apiRequest('/rent-collections', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function voidRentCollection(id, values) {
  const response = await apiRequest(`/rent-collections/${id}/void`, {
    method: 'POST',
    body: values,
  });
  return response?.data ?? null;
}

// --- Security deposits --------------------------------------------------

export async function listDeposits(params) {
  const response = await apiRequest(`/deposits${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getDeposit(id) {
  const response = await apiRequest(`/deposits/${id}`);
  return response?.data ?? null;
}

export async function receiveDeposit(id, values) {
  const response = await apiRequest(`/deposits/${id}/receipt`, { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function deductDeposit(id, values) {
  const response = await apiRequest(`/deposits/${id}/deduction`, { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function refundDeposit(id, values) {
  const response = await apiRequest(`/deposits/${id}/refund`, { method: 'POST', body: values });
  return response?.data ?? null;
}

export default {
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  deleteTenant,
  listLeases,
  getLease,
  createLease,
  updateLease,
  activateLease,
  renewLease,
  reviseLeaseRent,
  terminateLease,
  adjustRentSchedule,
  listRentRoll,
  listRentCollections,
  getRentCollection,
  createRentCollection,
  voidRentCollection,
  listDeposits,
  getDeposit,
  receiveDeposit,
  deductDeposit,
  refundDeposit,
};
