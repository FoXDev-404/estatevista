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

// --- Quotations ---------------------------------------------------------

export async function listQuotations(params) {
  const response = await apiRequest(`/quotations${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getQuotation(id) {
  const response = await apiRequest(`/quotations/${id}`);
  return response?.data ?? null;
}

export async function createQuotation(values) {
  const response = await apiRequest('/quotations', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateQuotation(id, values) {
  const response = await apiRequest(`/quotations/${id}`, { method: 'PATCH', body: values });
  return response?.data ?? null;
}

export async function setQuotationStatus(id, status) {
  const response = await apiRequest(`/quotations/${id}/status`, {
    method: 'POST',
    body: { status },
  });
  return response?.data ?? null;
}

export async function deleteQuotation(id) {
  const response = await apiRequest(`/quotations/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

// --- Reservations -------------------------------------------------------

export async function listReservations(params) {
  const response = await apiRequest(`/reservations${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getReservation(id) {
  const response = await apiRequest(`/reservations/${id}`);
  return response?.data ?? null;
}

export async function createReservation(values) {
  const response = await apiRequest('/reservations', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function cancelReservation(id, reason = '') {
  const response = await apiRequest(`/reservations/${id}/cancel`, {
    method: 'POST',
    body: { reason },
  });
  return response?.data ?? null;
}

// --- Sales --------------------------------------------------------------

export async function listSales(params) {
  const response = await apiRequest(`/sales${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getSale(id) {
  const response = await apiRequest(`/sales/${id}`);
  return response?.data ?? null;
}

export async function createSale(values) {
  const response = await apiRequest('/sales', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function rescheduleInstallment(saleId, installmentId, dueDate) {
  const response = await apiRequest(`/sales/${saleId}/installments/${installmentId}`, {
    method: 'PATCH',
    body: { action: 'reschedule', due_date: dueDate },
  });
  return response?.data ?? null;
}

export async function waiveInstallment(saleId, installmentId, reason = '') {
  const response = await apiRequest(`/sales/${saleId}/installments/${installmentId}`, {
    method: 'PATCH',
    body: { action: 'waive', reason },
  });
  return response?.data ?? null;
}

export async function handoverSale(id, values) {
  const response = await apiRequest(`/sales/${id}/handover`, {
    method: 'POST',
    body: values,
  });
  return response?.data ?? null;
}

export async function cancelSale(id, reason = '') {
  const response = await apiRequest(`/sales/${id}/cancel`, {
    method: 'POST',
    body: { reason },
  });
  return response?.data ?? null;
}

// --- Installments -------------------------------------------------------

export async function listInstallments(params) {
  const response = await apiRequest(`/installments${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

// --- Collections --------------------------------------------------------

export async function listCollections(params) {
  const response = await apiRequest(`/collections${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function getCollection(id) {
  const response = await apiRequest(`/collections/${id}`);
  return response?.data ?? null;
}

export async function createCollection(values) {
  const response = await apiRequest('/collections', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function voidCollection(id, reason) {
  const response = await apiRequest(`/collections/${id}/void`, {
    method: 'POST',
    body: { reason },
  });
  return response?.data ?? null;
}

// --- Commissions --------------------------------------------------------

export async function listCommissionRules() {
  const response = await apiRequest('/commissions/rules');
  return response?.data ?? [];
}

export async function createCommissionRule(values) {
  const response = await apiRequest('/commissions/rules', { method: 'POST', body: values });
  return response?.data ?? null;
}

export async function updateCommissionRule(id, values) {
  const response = await apiRequest(`/commissions/rules/${id}`, {
    method: 'PATCH',
    body: values,
  });
  return response?.data ?? null;
}

export async function deleteCommissionRule(id) {
  const response = await apiRequest(`/commissions/rules/${id}`, { method: 'DELETE' });
  return response?.data ?? null;
}

export async function listCommissions(params) {
  const response = await apiRequest(`/commissions${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

export async function updateCommission(id, status) {
  const response = await apiRequest(`/commissions/${id}`, {
    method: 'PATCH',
    body: { status },
  });
  return response?.data ?? null;
}

const salesApiService = {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  setQuotationStatus,
  deleteQuotation,
  listReservations,
  getReservation,
  createReservation,
  cancelReservation,
  listSales,
  getSale,
  createSale,
  rescheduleInstallment,
  waiveInstallment,
  handoverSale,
  cancelSale,
  listInstallments,
  listCollections,
  getCollection,
  createCollection,
  voidCollection,
  listCommissionRules,
  createCommissionRule,
  updateCommissionRule,
  deleteCommissionRule,
  listCommissions,
  updateCommission,
};

export default salesApiService;
