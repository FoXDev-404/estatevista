export const QUOTATION_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];
export const RESERVATION_STATUSES = ['active', 'converted', 'cancelled', 'expired'];
export const SALE_STATUSES = ['pending_approval', 'active', 'fully_paid', 'cancelled'];
export const INSTALLMENT_STATUSES = [
  'upcoming',
  'due',
  'partly_paid',
  'paid',
  'overdue',
  'waived',
  'cancelled',
];
export const FREQUENCIES = ['monthly', 'quarterly', 'half_yearly', 'yearly'];
export const LATE_FEE_TYPES = ['none', 'fixed', 'percentage'];
export const COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'cancelled'];
export const COMMISSION_APPLICABILITIES = ['all', 'project', 'unit_type'];
export const COMMISSION_TRIGGERS = ['reservation', 'sale', 'collection'];

export const FREQUENCY_MONTHS = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function quotationTotals({ unit_price = 0, discount_amount = 0, tax_amount = 0 }) {
  return {
    unit_price: roundMoney(unit_price),
    discount_amount: roundMoney(discount_amount),
    tax_amount: roundMoney(tax_amount),
    net_amount: roundMoney(Number(unit_price) - Number(discount_amount) + Number(tax_amount)),
  };
}

export function saleTotals({ sale_price = 0, discount_amount = 0, tax_amount = 0 }) {
  return {
    sale_price: roundMoney(sale_price),
    discount_amount: roundMoney(discount_amount),
    tax_amount: roundMoney(tax_amount),
    net_price: roundMoney(Number(sale_price) - Number(discount_amount) + Number(tax_amount)),
  };
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
  const date = new Date(Date.UTC(year, month, day));
  return date.toISOString().slice(0, 10);
}

function shiftMonths(start, months, dueDay) {
  const absolute = start.year * 12 + start.month + months;
  const year = Math.floor(absolute / 12);
  const month = absolute % 12;
  const day = Math.min(Math.max(Number(dueDay) || 1, 1), daysInMonth(year, month));
  return isoDate(year, month, day);
}

/**
 * Builds the payment schedule for a sale. The first due date is the first
 * configured due day on or after the plan start date; later rows advance by the
 * frequency. The rounding difference is carried on the final installment so the
 * schedule always sums exactly to net price minus down payment.
 */
export function buildInstallmentSchedule({
  netPrice,
  downPayment = 0,
  count,
  frequency,
  startDate,
  dueDay,
}) {
  const total = roundMoney(Number(netPrice) - Number(downPayment));
  const rows = Math.max(1, Number(count) || 1);
  const step = FREQUENCY_MONTHS[frequency] || 1;
  const start = parseIsoDate(startDate);
  const amounts = [];
  const base = Math.floor((total * 100) / rows) / 100;
  for (let index = 0; index < rows; index += 1) {
    amounts.push(base);
  }
  amounts[rows - 1] = roundMoney(total - base * (rows - 1));

  const firstStep = shiftMonths(start, 0, dueDay) < startDate ? step : 0;

  return amounts.map((amount, index) => ({
    sequence: index + 1,
    due_date: shiftMonths(start, firstStep + index * step, dueDay),
    amount,
  }));
}

/**
 * Derives the readable installment status from its stored state, paid amount and
 * due date. Waived and cancelled rows stay closed; otherwise a row becomes due
 * on its due date and overdue after the grace period.
 */
export function installmentStatus(installment, { today, graceDays = 0 } = {}) {
  const stored = installment.status;
  if (stored === 'waived' || stored === 'cancelled') return stored;
  const amount = Number(installment.amount || 0) + Number(installment.late_fee || 0);
  const paid = Number(installment.paid_amount || 0);
  if (paid >= amount && amount > 0) return 'paid';
  if (paid > 0) return 'partly_paid';

  const dueDate = String(installment.due_date || '').slice(0, 10);
  const comparison = String(today || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (dueDate && comparison > addDays(dueDate, Math.max(0, Number(graceDays) || 0))) {
    return 'overdue';
  }
  if (dueDate && comparison >= dueDate) return 'due';
  return 'upcoming';
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function nextDueInstallment(installments = []) {
  return (
    [...installments]
      .filter((row) => !['paid', 'waived', 'cancelled'].includes(row.status))
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0] || null
  );
}

export function commissionFor(rule, baseAmount) {
  if (!rule) return 0;
  if (rule.rate_type === 'fixed') return roundMoney(rule.rate_value);
  return roundMoney((Number(baseAmount) * Number(rule.rate_value || 0)) / 100);
}
