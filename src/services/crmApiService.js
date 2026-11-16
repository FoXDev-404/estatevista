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

export async function listLeads(params) {
  const response = await apiRequest(`/leads${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getLead(id) {
  const response = await apiRequest(`/leads/${id}`);
  return response?.data ?? null;
}

export async function createLead(values) {
  const response = await apiRequest('/leads', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateLead(id, values) {
  const response = await apiRequest(`/leads/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function updateLeadStatus(id, values) {
  const response = await apiRequest(`/leads/${id}/status`, { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function deleteLead(id) {
  const response = await apiRequest(`/leads/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

export async function addFollowup(leadId, values) {
  const response = await apiRequest(`/leads/${leadId}/followups`, {
    method: 'POST',
    body: values,
  });
  return response?.data ?? null;
}

export async function updateFollowup(leadId, followupId, values) {
  const response = await apiRequest(`/leads/${leadId}/followups/${followupId}`, {
    method: 'PATCH',
    body: values,
  });
  return response?.data ?? null;
}

export async function convertLead(id) {
  const response = await apiRequest(`/leads/${id}/convert`, { method: 'POST', body: {} });
  return response?.data ?? null;
}

export async function listCustomers(params) {
  const response = await apiRequest(`/customers${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getCustomer(id) {
  const response = await apiRequest(`/customers/${id}`);
  return response?.data ?? null;
}

export async function createCustomer(values) {
  const response = await apiRequest('/customers', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateCustomer(id, values) {
  const response = await apiRequest(`/customers/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function deleteCustomer(id) {
  const response = await apiRequest(`/customers/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

export async function listVisits(params) {
  const response = await apiRequest(`/visits${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getVisit(id) {
  const response = await apiRequest(`/visits/${id}`);
  return response?.data ?? null;
}

export async function createVisit(values) {
  const response = await apiRequest('/visits', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateVisit(id, values) {
  const response = await apiRequest(`/visits/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function deleteVisit(id) {
  const response = await apiRequest(`/visits/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

const crmApiService = {
  listLeads,
  getLead,
  createLead,
  updateLead,
  updateLeadStatus,
  deleteLead,
  addFollowup,
  updateFollowup,
  convertLead,
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listVisits,
  getVisit,
  createVisit,
  updateVisit,
  deleteVisit,
};

export default crmApiService;
