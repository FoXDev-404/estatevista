import { describe, expect, it } from 'vitest';
import {
  allocationTotal,
  autoAllocate,
  canReschedule,
  canWaive,
  formNetTotal,
  installmentTone,
  openInstallments,
  quotationTone,
  saleTone,
} from '../services/salesSelectors';

const installments = [
  {
    id: 'c',
    due_date: '2027-03-01',
    amount: 30000,
    balance: 30000,
    status: 'upcoming',
  },
  {
    id: 'a',
    due_date: '2027-01-01',
    amount: 30000,
    balance: 12000,
    status: 'partly_paid',
    paid_amount: 18000,
  },
  {
    id: 'b',
    due_date: '2027-02-01',
    amount: 30000,
    balance: 30000,
    status: 'upcoming',
  },
  {
    id: 'd',
    due_date: '2027-04-01',
    amount: 30000,
    balance: 0,
    status: 'waived',
  },
];

describe('sales selectors', () => {
  it('calculates the net amount from price, discount and tax', () => {
    expect(formNetTotal({ price: 250000, discount: 5000, tax: 12500 })).toBe(257500);
    expect(formNetTotal({ price: 100000, discount: 0, tax: 0 })).toBe(100000);
  });

  it('lists only open installments in due-date order', () => {
    expect(openInstallments(installments).map((row) => row.id)).toEqual(['a', 'b', 'c']);
  });

  it('auto-allocates oldest balances first and reports the leftover', () => {
    const { rows, remaining } = autoAllocate(installments, 50000);
    expect(rows.map((row) => [row.installment.id, row.amount])).toEqual([
      ['a', 12000],
      ['b', 30000],
      ['c', 8000],
    ]);
    expect(remaining).toBe(0);

    const tooMuch = autoAllocate(installments, 80000);
    expect(tooMuch.remaining).toBe(8000);
  });

  it('sums manual allocations with two-decimal precision', () => {
    expect(allocationTotal([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3);
  });

  it('reports which installment actions are available', () => {
    expect(canReschedule({ status: 'partly_paid', paid_amount: 100 })).toBe(true);
    expect(canReschedule({ status: 'paid', paid_amount: 30000 })).toBe(false);
    expect(canWaive({ status: 'upcoming', paid_amount: 0 })).toBe(true);
    expect(canWaive({ status: 'partly_paid', paid_amount: 100 })).toBe(false);
  });

  it('maps statuses to badge tones', () => {
    expect(quotationTone('accepted')).toBe('success');
    expect(quotationTone('rejected')).toBe('danger');
    expect(saleTone('fully_paid')).toBe('success');
    expect(saleTone('cancelled')).toBe('danger');
    expect(installmentTone('overdue')).toBe('danger');
    expect(installmentTone('partly_paid')).toBe('gold');
  });
});
