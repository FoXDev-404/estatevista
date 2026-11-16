import { describe, expect, it } from 'vitest';
import {
  buildInstallmentSchedule,
  commissionFor,
  installmentStatus,
  nextDueInstallment,
  quotationTotals,
  saleTotals,
} from './sales.js';

describe('sales helpers', () => {
  it('computes quotation and sale totals from price, discount and tax', () => {
    expect(quotationTotals({ unit_price: 250000, discount_amount: 5000, tax_amount: 12500 })).toEqual({
      unit_price: 250000,
      discount_amount: 5000,
      tax_amount: 12500,
      net_amount: 257500,
    });

    expect(saleTotals({ sale_price: 250000, discount_amount: 5000, tax_amount: 12500 })).toEqual({
      sale_price: 250000,
      discount_amount: 5000,
      tax_amount: 12500,
      net_price: 257500,
    });
  });

  it('generates a monthly schedule with the rounding difference on the last installment', () => {
    const schedule = buildInstallmentSchedule({
      netPrice: 100000,
      downPayment: 0,
      count: 3,
      frequency: 'monthly',
      startDate: '2026-01-15',
      dueDay: 10,
    });

    expect(schedule).toEqual([
      { sequence: 1, due_date: '2026-02-10', amount: 33333.33 },
      { sequence: 2, due_date: '2026-03-10', amount: 33333.33 },
      { sequence: 3, due_date: '2026-04-10', amount: 33333.34 },
    ]);
  });

  it('subtracts the down payment and advances quarterly, half-yearly and yearly', () => {
    const quarterly = buildInstallmentSchedule({
      netPrice: 100000,
      downPayment: 10000,
      count: 3,
      frequency: 'quarterly',
      startDate: '2026-01-05',
      dueDay: 5,
    });
    expect(quarterly.map((row) => row.due_date)).toEqual([
      '2026-01-05',
      '2026-04-05',
      '2026-07-05',
    ]);
    expect(quarterly.reduce((sum, row) => sum + row.amount, 0)).toBe(90000);

    const halfYearly = buildInstallmentSchedule({
      netPrice: 60000,
      downPayment: 0,
      count: 2,
      frequency: 'half_yearly',
      startDate: '2026-02-01',
      dueDay: 1,
    });
    expect(halfYearly.map((row) => row.due_date)).toEqual(['2026-02-01', '2026-08-01']);

    const yearly = buildInstallmentSchedule({
      netPrice: 60000,
      downPayment: 0,
      count: 2,
      frequency: 'yearly',
      startDate: '2026-02-01',
      dueDay: 1,
    });
    expect(yearly.map((row) => row.due_date)).toEqual(['2026-02-01', '2027-02-01']);
  });

  it('returns one installment for a full-payment sale', () => {
    const schedule = buildInstallmentSchedule({
      netPrice: 257500,
      downPayment: 0,
      count: 1,
      frequency: 'monthly',
      startDate: '2026-11-17',
      dueDay: 17,
    });
    expect(schedule).toEqual([{ sequence: 1, due_date: '2026-11-17', amount: 257500 }]);
  });

  it('derives installment aging from due date and grace', () => {
    const base = { amount: 1000, late_fee: 0, paid_amount: 0, status: 'upcoming' };
    const dueDate = '2026-11-10';
    expect(installmentStatus({ ...base, due_date: dueDate }, { today: '2026-11-01', graceDays: 5 })).toBe(
      'upcoming',
    );
    expect(installmentStatus({ ...base, due_date: dueDate }, { today: '2026-11-10', graceDays: 5 })).toBe(
      'due',
    );
    expect(installmentStatus({ ...base, due_date: dueDate }, { today: '2026-11-16', graceDays: 5 })).toBe(
      'overdue',
    );
    expect(
      installmentStatus({ ...base, due_date: dueDate, paid_amount: 400 }, { today: '2026-11-01', graceDays: 5 }),
    ).toBe('partly_paid');
    expect(
      installmentStatus({ ...base, due_date: dueDate, paid_amount: 1000 }, { today: '2026-11-16', graceDays: 5 }),
    ).toBe('paid');
    expect(
      installmentStatus({ ...base, due_date: dueDate, status: 'waived' }, { today: '2026-11-16', graceDays: 5 }),
    ).toBe('waived');
    expect(
      installmentStatus({ ...base, due_date: dueDate, status: 'cancelled' }, { today: '2026-11-16', graceDays: 5 }),
    ).toBe('cancelled');
  });

  it('finds the next open installment', () => {
    const installments = [
      { id: 'a', due_date: '2026-11-01', status: 'paid' },
      { id: 'b', due_date: '2026-12-01', status: 'upcoming' },
      { id: 'c', due_date: '2027-01-01', status: 'upcoming' },
    ];
    expect(nextDueInstallment(installments)?.id).toBe('b');
  });

  it('computes fixed and percentage commissions', () => {
    expect(commissionFor({ rate_type: 'percentage', rate_value: 2.5 }, 200000)).toBe(5000);
    expect(commissionFor({ rate_type: 'fixed', rate_value: 1500 }, 200000)).toBe(1500);
  });
});
