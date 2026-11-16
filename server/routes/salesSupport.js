import { ApiError, validationError } from '../lib/errors.js';

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadCustomer(repository, companyId, customerId, field = 'customer_id') {
  if (!customerId) return null;
  const customer = await repository.getCustomer(companyId, customerId);
  if (!customer) {
    throw validationError({ [field]: 'Choose a customer from this company.' });
  }
  return customer;
}

export async function loadSalesperson(repository, companyId, userId, field = 'salesperson_id') {
  if (!userId) return null;
  const member = await repository.getTeamMember(companyId, userId);
  if (!member) {
    throw validationError({ [field]: 'Choose a team member from this company.' });
  }
  return member;
}

export async function requireSale(repository, companyId, saleId) {
  const sale = await repository.getSale(companyId, saleId);
  if (!sale) throw new ApiError(404, 'Sale not found.');
  return sale;
}

export function saleOpenBalance(sale) {
  return (sale.installments || [])
    .filter((row) => !['waived', 'cancelled'].includes(row.status))
    .reduce((sum, row) => sum + Number(row.balance || 0), 0);
}

export function matchesSearch(search, values) {
  const needle = String(search || '').trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => String(value || '').toLowerCase().includes(needle));
}
