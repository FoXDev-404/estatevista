export const quotationStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'converted', label: 'Converted' },
];

export const reservationStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'converted', label: 'Converted' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'expired', label: 'Expired' },
];

export const saleStatusOptions = [
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'active', label: 'Active' },
  { value: 'fully_paid', label: 'Fully paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const installmentStatusOptions = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'due', label: 'Due' },
  { value: 'partly_paid', label: 'Partly paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waived', label: 'Waived' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const frequencyOptions = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Yearly' },
];

export const lateFeeOptions = [
  { value: 'none', label: 'No late fee' },
  { value: 'fixed', label: 'Fixed amount' },
  { value: 'percentage', label: 'Percentage' },
];

export const commissionStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const commissionApplicabilityOptions = [
  { value: 'all', label: 'All sales' },
  { value: 'project', label: 'A project' },
  { value: 'unit_type', label: 'A unit type' },
];

export const commissionTriggerOptions = [
  { value: 'reservation', label: 'On reservation' },
  { value: 'sale', label: 'On sale' },
  { value: 'collection', label: 'On collection' },
];

export const commissionRateTypeOptions = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'fixed', label: 'Fixed amount' },
];

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || value || '—';
}

export function quotationTone(status) {
  if (status === 'accepted' || status === 'converted') return 'success';
  if (status === 'rejected' || status === 'expired') return 'danger';
  if (status === 'sent') return 'gold';
  return 'muted';
}

export function reservationTone(status) {
  if (status === 'active') return 'gold';
  if (status === 'converted') return 'success';
  if (status === 'cancelled' || status === 'expired') return 'danger';
  return 'muted';
}

export function saleTone(status) {
  if (status === 'fully_paid') return 'success';
  if (status === 'cancelled') return 'danger';
  if (status === 'pending_approval') return 'gold';
  return 'active';
}

export function installmentTone(status) {
  if (status === 'paid') return 'success';
  if (status === 'overdue' || status === 'cancelled') return 'danger';
  if (status === 'partly_paid' || status === 'due') return 'gold';
  if (status === 'waived') return 'muted';
  return 'active';
}

export function commissionTone(status) {
  if (status === 'paid') return 'success';
  if (status === 'cancelled') return 'danger';
  if (status === 'approved') return 'gold';
  return 'muted';
}

export function receiptTone(status) {
  if (status === 'completed') return 'success';
  if (status === 'voided') return 'danger';
  return 'gold';
}

/** Rounds to two decimals the same way the server does. */
export function moneyRound(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/** Net amount = price − discount + tax, kept in sync with the server. */
export function formNetTotal({ price = 0, discount = 0, tax = 0 }) {
  return moneyRound(Number(price || 0) - Number(discount || 0) + Number(tax || 0));
}

/** Installments that can still receive a payment. */
export function openInstallments(installments = []) {
  return installments
    .filter((row) => !['paid', 'waived', 'cancelled'].includes(row.status))
    .filter((row) => Number(row.balance || 0) > 0)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
}

/**
 * Spreads an amount across open installments, oldest due date first. Returns
 * one row per installment and the amount left over when the receipt is larger
 * than the outstanding balance.
 */
export function autoAllocate(installments, amount) {
  let remaining = moneyRound(amount);
  const rows = [];
  for (const installment of openInstallments(installments)) {
    if (remaining <= 0) break;
    const balance = Number(installment.balance || 0);
    const allocated = moneyRound(Math.min(balance, remaining));
    rows.push({ installment, amount: allocated });
    remaining = moneyRound(remaining - allocated);
  }
  return { rows, remaining };
}

export function allocationTotal(allocations = []) {
  return moneyRound(
    allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0),
  );
}

export function openBalance(sale) {
  return moneyRound(Number(sale?.balance_due || 0));
}

export function canReschedule(installment) {
  return !['paid', 'waived', 'cancelled'].includes(installment?.status);
}

export function canWaive(installment) {
  return (
    !['paid', 'waived', 'cancelled'].includes(installment?.status) &&
    Number(installment?.paid_amount || 0) === 0
  );
}

export function todayInput() {
  const now = new Date();
  const pad = (part) => String(part).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function projectNameFor(unit) {
  return unit?.project?.name || unit?.project_name || '—';
}
