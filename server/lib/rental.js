export const LEASE_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly'];
export const LEASE_STATUSES = ['draft', 'active', 'expired', 'terminated', 'renewed'];
export const RENT_STATUSES = [
  'upcoming',
  'due',
  'partly_paid',
  'paid',
  'overdue',
  'waived',
  'cancelled',
];
export const LATE_FEE_TYPES = ['none', 'fixed', 'percentage'];
export const DEPOSIT_STATUSES = ['awaiting_settlement', 'to_collect', 'held', 'settled'];
export const UTILITY_OPTIONS = [
  'electricity',
  'water',
  'gas',
  'internet',
  'service_charge',
  'parking',
];

const RENT_FREQUENCY_MONTHS = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) throw new Error(`Invalid date: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function isoDate(year, month, day) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonthsAnchored(start, months, anchorDay) {
  const absolute = start.year * 12 + start.month + months;
  const year = Math.floor(absolute / 12);
  const month = absolute % 12;
  const day = Math.min(Math.max(Number(anchorDay) || 1, 1), daysInMonth(year, month));
  return isoDate(year, month, day);
}

function dueDateFor(periodStart, dueDay) {
  const start = parseIsoDate(periodStart);
  const day = Math.min(Math.max(Number(dueDay) || 1, 1), daysInMonth(start.year, start.month));
  let candidate = isoDate(start.year, start.month, day);
  if (candidate < periodStart) {
    const next = addMonthsAnchored(start, 1, day);
    const nextParts = parseIsoDate(next);
    candidate = isoDate(nextParts.year, nextParts.month, day);
  }
  return candidate;
}

function periodLabel(periodStart, frequency) {
  const { year, month } = parseIsoDate(periodStart);
  if (frequency === 'yearly') return String(year);
  if (frequency === 'half_yearly') return `H${month < 6 ? 1 : 2} ${year}`;
  if (frequency === 'quarterly') return `Q${Math.floor(month / 3) + 1} ${year}`;
  if (frequency === 'weekly') {
    return `Week of ${parseIsoDate(periodStart).day} ${MONTH_LABELS[month]} ${year}`;
  }
  return `${MONTH_LABELS[month]} ${year}`;
}

/**
 * Builds the rent schedule for a lease between its start and end dates. Periods
 * are anchored to the lease start day; weekly periods are seven days and the
 * final period is always clamped to the lease end date.
 */
export function buildRentSchedule({
  start_date,
  end_date,
  frequency,
  rent_amount,
  due_day = 1,
}) {
  if (String(end_date) < String(start_date)) {
    throw new Error('The lease end date must be on or after the start date.');
  }

  const rows = [];
  const amount = roundMoney(rent_amount);
  const start = parseIsoDate(start_date);
  const anchorDay = start.day;
  const stepMonths = RENT_FREQUENCY_MONTHS[frequency] || 1;
  let current = start_date;
  let step = 0;
  let guard = 0;

  while (current <= end_date && guard < 1000) {
    // A lease that ends on a period boundary is fully covered by the previous
    // period; starting another one would bill a full period for a single day.
    if (rows.length > 0 && current === end_date) break;
    guard += 1;
    let periodEnd;
    let dueDate;
    if (frequency === 'weekly') {
      periodEnd = addDays(current, 6);
      dueDate = current;
    } else {
      const nextStart = addMonthsAnchored(start, stepMonths * (step + 1), anchorDay);
      periodEnd = addDays(nextStart, -1);
      dueDate = dueDateFor(current, due_day);
    }
    if (periodEnd > end_date) periodEnd = end_date;

    rows.push({
      period_label: periodLabel(current, frequency),
      period_start: current,
      period_end: periodEnd,
      due_date: dueDate,
      rent_amount: amount,
    });

    current = frequency === 'weekly' ? addDays(current, 7) : addMonthsAnchored(
      start,
      stepMonths * (step + 1),
      anchorDay,
    );
    step += 1;
  }

  return rows;
}

function scheduleTotal(schedule) {
  return roundMoney(
    Number(schedule.rent_amount || 0) +
      Number(schedule.adjustments || 0) +
      Number(schedule.late_fee || 0),
  );
}

export function rentScheduleStatus(schedule, { today, graceDays = 0 } = {}) {
  const stored = schedule.status;
  if (stored === 'waived' || stored === 'cancelled') return stored;

  const total = scheduleTotal(schedule);
  const paid = Number(schedule.paid_amount || 0);
  if (total <= 0.005) return 'paid';
  if (paid + 0.005 >= total) return 'paid';
  if (paid > 0.005) return 'partly_paid';

  const dueDate = String(schedule.due_date || '').slice(0, 10);
  const comparison = String(today || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (dueDate && comparison > addDays(dueDate, Math.max(0, Number(graceDays) || 0))) {
    return 'overdue';
  }
  if (dueDate && comparison >= dueDate) return 'due';
  return 'upcoming';
}

export function rentScheduleView(schedule, { today, graceDays = 0 } = {}) {
  const status = rentScheduleStatus(schedule, { today, graceDays });
  const total = scheduleTotal(schedule);
  const balance =
    status === 'waived' || status === 'cancelled'
      ? 0
      : roundMoney(Math.max(0, total - Number(schedule.paid_amount || 0)));
  return { ...schedule, status, balance, grace_days: Number(graceDays) || 0 };
}

export function rentSummary(schedules = [], { today } = {}) {
  const todayIso = String(today || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const open = schedules.filter(
    (row) => !['paid', 'waived', 'cancelled'].includes(row.status),
  );
  const collected = roundMoney(
    schedules.reduce((sum, row) => sum + Number(row.paid_amount || 0), 0),
  );
  const balanceDue = roundMoney(
    schedules
      .filter((row) => !['waived', 'cancelled'].includes(row.status))
      .reduce((sum, row) => sum + Number(row.balance || 0), 0),
  );
  const overdueAmount = roundMoney(
    schedules
      .filter((row) => row.status === 'overdue')
      .reduce((sum, row) => sum + Number(row.balance || 0), 0),
  );
  const nextDue =
    [...open].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0] || null;
  const paidInAdvance = roundMoney(
    schedules
      .filter(
        (row) =>
          String(row.period_start || row.due_date || '').slice(0, 10) > todayIso &&
          !['waived', 'cancelled'].includes(row.status),
      )
      .reduce((sum, row) => sum + Number(row.paid_amount || 0), 0),
  );

  return {
    collected,
    balance_due: balanceDue,
    overdue_amount: overdueAmount,
    paid_in_advance: paidInAdvance,
    next_due: nextDue,
  };
}

export function depositHeld(deposit = {}) {
  return roundMoney(
    Math.max(
      0,
      Number(deposit.received_amount || 0) -
        Number(deposit.deducted_amount || 0) -
        Number(deposit.refunded_amount || 0),
    ),
  );
}

/**
 * Derives the deposit status after a receipt, deduction or refund. While the
 * lease runs a deposit is held once fully collected; after the lease ends any
 * remaining money awaits settlement and a zero held balance settles.
 */
export function depositStatusAfter({ deposit, leaseStatus }) {
  const terminal = ['terminated', 'renewed', 'expired'].includes(leaseStatus);
  const required = Number(deposit.required_amount || 0);
  const held = depositHeld(deposit);

  if (required <= 0.005) return terminal ? 'settled' : 'held';
  if (terminal) return held > 0.005 ? 'awaiting_settlement' : 'settled';
  const received = Number(deposit.received_amount || 0);
  if (received + 0.005 >= required && held > 0.005) return 'held';
  return 'to_collect';
}
