export const leaseFrequencyOptions = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-yearly' },
  { value: 'yearly', label: 'Yearly' },
];

export const leaseStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'renewed', label: 'Renewed' },
];

export const rentStatusOptions = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'due', label: 'Due' },
  { value: 'partly_paid', label: 'Partly paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waived', label: 'Waived' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const depositStatusOptions = [
  { value: 'to_collect', label: 'To collect' },
  { value: 'held', label: 'Held' },
  { value: 'awaiting_settlement', label: 'Awaiting settlement' },
  { value: 'settled', label: 'Settled' },
];

export const tenantTypeOptions = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
];

export const tenantOccupancyOptions = [
  { value: 'current', label: 'Current tenants' },
  { value: 'without', label: 'Without a lease' },
];

export const utilityOptions = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'water', label: 'Water' },
  { value: 'gas', label: 'Gas' },
  { value: 'internet', label: 'Internet' },
  { value: 'service_charge', label: 'Service charge' },
  { value: 'parking', label: 'Parking' },
];

export const adjustmentTypeOptions = [
  { value: 'extra_charge', label: 'Extra charge' },
  { value: 'discount', label: 'Discount' },
  { value: 'waiver', label: 'Waive balance' },
];

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || value || '—';
}

export function labelList(options, values = []) {
  if (!values?.length) return '—';
  return values.map((value) => labelFor(options, value)).join(', ');
}

export function leaseTone(status) {
  if (status === 'active') return 'success';
  if (status === 'draft') return 'gold';
  if (status === 'terminated') return 'danger';
  if (status === 'renewed' || status === 'expired') return 'muted';
  return 'active';
}

export function rentTone(status) {
  if (status === 'paid') return 'success';
  if (status === 'overdue' || status === 'cancelled') return 'danger';
  if (status === 'partly_paid' || status === 'due') return 'gold';
  if (status === 'waived') return 'muted';
  return 'active';
}

export function depositTone(status) {
  if (status === 'held') return 'success';
  if (status === 'to_collect' || status === 'awaiting_settlement') return 'gold';
  if (status === 'settled') return 'muted';
  return 'active';
}

function moneyRound(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function openRentSchedules(schedules = []) {
  return schedules
    .filter((row) => !['paid', 'waived', 'cancelled'].includes(row.status))
    .filter((row) => Number(row.balance || 0) > 0.005)
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
}

/**
 * Spreads a rent receipt across open periods, oldest due date first. Returns
 * one row per period and the amount left over when the receipt is larger than
 * the outstanding rent.
 */
export function autoAllocateRent(schedules, amount) {
  let remaining = moneyRound(amount);
  const rows = [];
  for (const schedule of openRentSchedules(schedules)) {
    if (remaining <= 0) break;
    const balance = Number(schedule.balance || 0);
    const allocated = moneyRound(Math.min(balance, remaining));
    rows.push({ schedule, amount: allocated });
    remaining = moneyRound(remaining - allocated);
  }
  return { rows, remaining };
}

export function allocationTotal(allocations = []) {
  return moneyRound(
    allocations.reduce((sum, row) => sum + Number(row.amount || 0), 0),
  );
}

export function scheduleBalance(schedule = {}) {
  const total =
    Number(schedule.rent_amount || 0) +
    Number(schedule.adjustments || 0) +
    Number(schedule.late_fee || 0);
  return moneyRound(Math.max(0, total - Number(schedule.paid_amount || 0)));
}

export function canActivateLease(lease) {
  return lease?.status === 'draft';
}

export function canRenewLease(lease) {
  return lease?.status === 'active';
}

export function canTerminateLease(lease) {
  return lease?.status === 'active' || lease?.status === 'draft';
}

export function canAdjustRentSchedule(schedule) {
  return (
    !['paid', 'waived', 'cancelled'].includes(schedule?.status) &&
    Number(schedule?.balance || 0) > 0.005
  );
}

export function depositHeldAmount(deposit = {}) {
  if (deposit.held_amount !== undefined && deposit.held_amount !== null) {
    return moneyRound(deposit.held_amount);
  }
  return moneyRound(
    Math.max(
      0,
      Number(deposit.received_amount || 0) -
        Number(deposit.deducted_amount || 0) -
        Number(deposit.refunded_amount || 0),
    ),
  );
}

export function todayInput() {
  const now = new Date();
  const pad = (part) => String(part).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
