import { ApiError, notFound } from '../lib/errors.js';
import { depositHeld, depositStatusAfter } from '../lib/rental.js';

export { matchesSearch, todayIso } from './salesSupport.js';

export async function requireTenant(repository, companyId, tenantId) {
  const tenant = await repository.getTenant(companyId, tenantId);
  if (!tenant) throw new ApiError(404, 'Tenant not found.');
  return tenant;
}

export async function requireLease(repository, companyId, leaseId) {
  const lease = await repository.getLease(companyId, leaseId);
  if (!lease) throw new ApiError(404, 'Lease not found.');
  return lease;
}

export async function requireDeposit(repository, companyId, depositId) {
  const deposit = await repository.getDeposit(companyId, depositId);
  if (!deposit) throw new ApiError(404, 'Security deposit not found.');
  return deposit;
}

export function scheduleBalance(schedule) {
  const total =
    Number(schedule.rent_amount || 0) +
    Number(schedule.adjustments || 0) +
    Number(schedule.late_fee || 0);
  return Math.round(Math.max(0, total - Number(schedule.paid_amount || 0)) * 100) / 100;
}

export async function applyDepositStatus(repository, companyId, deposit, leaseStatus) {
  const status = depositStatusAfter({ deposit, leaseStatus });
  return repository.updateDeposit(companyId, deposit.id, {
    status,
    held_amount: depositHeld(deposit),
  });
}

export async function markUnitRented(repository, companyId, unitId, leaseNumber, userId) {
  const unit = await repository.getUnit(companyId, unitId);
  if (!unit) throw notFound('Unit not found.');
  await repository.updateUnitStatus(companyId, unitId, {
    status: 'rented',
    reason: `Lease ${leaseNumber} activated`,
    changedBy: userId || null,
  });
}

export async function releaseUnitIfFree(repository, companyId, unitId, reason, userId) {
  const [sale, reservation, lease] = await Promise.all([
    repository.findActiveSaleForUnit(companyId, unitId),
    repository.findActiveReservationForUnit(companyId, unitId),
    repository.findActiveLeaseForUnit(companyId, unitId),
  ]);
  if (sale || reservation || lease) return;
  await repository.updateUnitStatus(companyId, unitId, {
    status: 'available',
    reason,
    changedBy: userId || null,
  });
}
