import { describe, expect, it } from 'vitest';
import {
  buildRentSchedule,
  depositHeld,
  depositStatusAfter,
  rentScheduleStatus,
  rentScheduleView,
  rentSummary,
} from './rental.js';

describe('buildRentSchedule', () => {
  it('builds calendar-month periods with due dates inside each period', () => {
    const rows = buildRentSchedule({
      start_date: '2026-12-01',
      end_date: '2027-02-28',
      frequency: 'monthly',
      rent_amount: 1200,
      due_day: 5,
    });

    expect(rows).toEqual([
      {
        period_label: 'Dec 2026',
        period_start: '2026-12-01',
        period_end: '2026-12-31',
        due_date: '2026-12-05',
        rent_amount: 1200,
      },
      {
        period_label: 'Jan 2027',
        period_start: '2027-01-01',
        period_end: '2027-01-31',
        due_date: '2027-01-05',
        rent_amount: 1200,
      },
      {
        period_label: 'Feb 2027',
        period_start: '2027-02-01',
        period_end: '2027-02-28',
        due_date: '2027-02-05',
        rent_amount: 1200,
      },
    ]);
  });

  it('anchors mid-month periods to the lease start day and uses the next due day', () => {
    const rows = buildRentSchedule({
      start_date: '2026-11-17',
      end_date: '2027-01-16',
      frequency: 'monthly',
      rent_amount: 900,
      due_day: 5,
    });

    expect(rows.map((row) => ({ start: row.period_start, end: row.period_end, due: row.due_date }))).toEqual([
      { start: '2026-11-17', end: '2026-12-16', due: '2026-12-05' },
      { start: '2026-12-17', end: '2027-01-16', due: '2027-01-05' },
    ]);
  });

  it('builds weekly periods and clamps the final period to the lease end', () => {
    const rows = buildRentSchedule({
      start_date: '2027-01-01',
      end_date: '2027-01-20',
      frequency: 'weekly',
      rent_amount: 300,
      due_day: 5,
    });

    expect(rows.map((row) => ({ start: row.period_start, end: row.period_end, due: row.due_date }))).toEqual([
      { start: '2027-01-01', end: '2027-01-07', due: '2027-01-01' },
      { start: '2027-01-08', end: '2027-01-14', due: '2027-01-08' },
      { start: '2027-01-15', end: '2027-01-20', due: '2027-01-15' },
    ]);
  });

  it('does not add an extra day period when the end date lands on a period boundary', () => {
    const rows = buildRentSchedule({
      start_date: '2026-11-17',
      end_date: '2027-11-17',
      frequency: 'monthly',
      rent_amount: 1800,
      due_day: 5,
    });

    expect(rows).toHaveLength(12);
    expect(rows[0].period_start).toBe('2026-11-17');
    expect(rows[11].period_start).toBe('2027-10-17');
    expect(rows[11].period_end).toBe('2027-11-16');
  });

  it('keeps the lease start day when clamping short months', () => {
    const rows = buildRentSchedule({
      start_date: '2027-01-31',
      end_date: '2027-03-30',
      frequency: 'monthly',
      rent_amount: 500,
      due_day: 1,
    });

    expect(rows.map((row) => [row.period_start, row.period_end])).toEqual([
      ['2027-01-31', '2027-02-27'],
      ['2027-02-28', '2027-03-30'],
    ]);
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      buildRentSchedule({
        start_date: '2027-02-01',
        end_date: '2027-01-01',
        frequency: 'monthly',
        rent_amount: 500,
        due_day: 1,
      }),
    ).toThrow(/end date/i);
  });
});

describe('rentScheduleStatus', () => {
  const base = { rent_amount: 1000, adjustments: 0, late_fee: 0, paid_amount: 0, status: 'upcoming' };

  it('moves from upcoming to due on the due date', () => {
    expect(rentScheduleStatus({ ...base, due_date: '2026-11-01' }, { today: '2026-10-31' })).toBe(
      'upcoming',
    );
    expect(rentScheduleStatus({ ...base, due_date: '2026-11-01' }, { today: '2026-11-01' })).toBe(
      'due',
    );
  });

  it('becomes overdue only after the grace period', () => {
    expect(
      rentScheduleStatus({ ...base, due_date: '2026-11-01' }, { today: '2026-11-06', graceDays: 5 }),
    ).toBe('due');
    expect(
      rentScheduleStatus({ ...base, due_date: '2026-11-01' }, { today: '2026-11-07', graceDays: 5 }),
    ).toBe('overdue');
  });

  it('reports partly paid and paid from the collected amount', () => {
    expect(
      rentScheduleStatus({ ...base, due_date: '2026-11-01', paid_amount: 400 }, { today: '2026-11-02' }),
    ).toBe('partly_paid');
    expect(
      rentScheduleStatus({ ...base, due_date: '2026-11-01', paid_amount: 1000 }, { today: '2026-11-02' }),
    ).toBe('paid');
  });

  it('keeps waived and cancelled rows closed', () => {
    expect(
      rentScheduleStatus({ ...base, due_date: '2026-11-01', status: 'waived' }, { today: '2027-01-01' }),
    ).toBe('waived');
    expect(
      rentScheduleStatus(
        { ...base, due_date: '2026-11-01', status: 'cancelled' },
        { today: '2027-01-01' },
      ),
    ).toBe('cancelled');
  });

  it('treats a fully discounted period as paid', () => {
    expect(
      rentScheduleStatus(
        { ...base, rent_amount: 1000, adjustments: -1000, due_date: '2026-11-01' },
        { today: '2026-11-02' },
      ),
    ).toBe('paid');
  });
});

describe('rentScheduleView', () => {
  it('combines rent, adjustments and payments into a balance', () => {
    const view = rentScheduleView(
      {
        rent_amount: 1000,
        adjustments: -150,
        late_fee: 25,
        paid_amount: 300,
        due_date: '2026-11-01',
        status: 'upcoming',
      },
      { today: '2026-11-02' },
    );

    expect(view.status).toBe('partly_paid');
    expect(view.balance).toBe(575);
  });

  it('reports zero balance for waived rows', () => {
    const view = rentScheduleView(
      {
        rent_amount: 1000,
        adjustments: 0,
        late_fee: 0,
        paid_amount: 300,
        due_date: '2026-11-01',
        status: 'waived',
      },
      { today: '2026-11-02' },
    );

    expect(view.balance).toBe(0);
  });
});

describe('rentSummary', () => {
  it('sums collected, open and overdue balances and finds the next open period', () => {
    const summary = rentSummary(
      [
        { status: 'paid', balance: 0, paid_amount: 1000, due_date: '2026-10-01', period_start: '2026-10-01' },
        { status: 'overdue', balance: 800, paid_amount: 0, due_date: '2026-11-01', period_start: '2026-11-01' },
        { status: 'upcoming', balance: 1200, paid_amount: 0, due_date: '2026-12-01', period_start: '2026-12-01' },
        { status: 'waived', balance: 0, paid_amount: 0, due_date: '2027-01-01', period_start: '2027-01-01' },
      ],
      { today: '2026-11-15' },
    );

    expect(summary).toMatchObject({
      collected: 1000,
      balance_due: 2000,
      overdue_amount: 800,
      next_due: { due_date: '2026-11-01', status: 'overdue' },
    });
  });

  it('counts payments for periods that have not started as paid in advance', () => {
    const summary = rentSummary(
      [
        { status: 'upcoming', balance: 700, paid_amount: 300, due_date: '2026-12-01', period_start: '2026-12-01' },
      ],
      { today: '2026-11-15' },
    );

    expect(summary.paid_in_advance).toBe(300);
  });
});

describe('depositStatusAfter', () => {
  const base = { required_amount: 1000, received_amount: 500, deducted_amount: 0, refunded_amount: 0 };

  it('stays to_collect until the required amount is received', () => {
    expect(depositStatusAfter({ deposit: base, leaseStatus: 'active' })).toBe('to_collect');
    expect(
      depositStatusAfter({
        deposit: { ...base, received_amount: 1000 },
        leaseStatus: 'active',
      }),
    ).toBe('held');
  });

  it('awaits settlement when a lease ends with money held', () => {
    expect(
      depositStatusAfter({
        deposit: { ...base, received_amount: 1000 },
        leaseStatus: 'terminated',
      }),
    ).toBe('awaiting_settlement');
  });

  it('settles when the held amount reaches zero after the lease ends', () => {
    expect(
      depositStatusAfter({
        deposit: { ...base, received_amount: 1000, refunded_amount: 600, deducted_amount: 400 },
        leaseStatus: 'terminated',
      }),
    ).toBe('settled');
  });

  it('treats a zero-required deposit as held while active and settled after the lease', () => {
    expect(
      depositStatusAfter({
        deposit: { required_amount: 0, received_amount: 0, deducted_amount: 0, refunded_amount: 0 },
        leaseStatus: 'active',
      }),
    ).toBe('held');
    expect(
      depositStatusAfter({
        deposit: { required_amount: 0, received_amount: 0, deducted_amount: 0, refunded_amount: 0 },
        leaseStatus: 'terminated',
      }),
    ).toBe('settled');
  });

  it('computes the held balance from receipts, deductions and refunds', () => {
    expect(
      depositHeld({ received_amount: 1500, deducted_amount: 200, refunded_amount: 300 }),
    ).toBe(1000);
  });
});
