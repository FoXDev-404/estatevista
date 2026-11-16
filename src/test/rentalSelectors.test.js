import { describe, expect, it } from 'vitest';
import {
  allocationTotal,
  autoAllocateRent,
  canActivateLease,
  canAdjustRentSchedule,
  canRenewLease,
  canTerminateLease,
  depositHeldAmount,
  depositStatusOptions,
  depositTone,
  leaseFrequencyOptions,
  leaseStatusOptions,
  leaseTone,
  openRentSchedules,
  rentStatusOptions,
  rentTone,
  scheduleBalance,
} from '../services/rentalSelectors';

describe('rental option lists', () => {
  it('offers every lease and rent status used by the API', () => {
    expect(leaseFrequencyOptions.map((option) => option.value)).toEqual([
      'weekly',
      'monthly',
      'quarterly',
      'half_yearly',
      'yearly',
    ]);
    expect(leaseStatusOptions.map((option) => option.value)).toEqual([
      'draft',
      'active',
      'expired',
      'terminated',
      'renewed',
    ]);
    expect(rentStatusOptions.map((option) => option.value)).toEqual([
      'upcoming',
      'due',
      'partly_paid',
      'paid',
      'overdue',
      'waived',
      'cancelled',
    ]);
    expect(depositStatusOptions.map((option) => option.value)).toEqual([
      'to_collect',
      'held',
      'awaiting_settlement',
      'settled',
    ]);
  });
});

describe('rental tones', () => {
  it('maps lease, rent and deposit statuses to badge tones', () => {
    expect(leaseTone('active')).toBe('success');
    expect(leaseTone('draft')).toBe('gold');
    expect(leaseTone('terminated')).toBe('danger');
    expect(leaseTone('renewed')).toBe('muted');

    expect(rentTone('paid')).toBe('success');
    expect(rentTone('overdue')).toBe('danger');
    expect(rentTone('partly_paid')).toBe('gold');
    expect(rentTone('waived')).toBe('muted');

    expect(depositTone('held')).toBe('success');
    expect(depositTone('to_collect')).toBe('gold');
    expect(depositTone('awaiting_settlement')).toBe('gold');
    expect(depositTone('settled')).toBe('muted');
  });
});

describe('openRentSchedules', () => {
  it('keeps unpaid periods sorted by due date', () => {
    const rows = openRentSchedules([
      { id: 'b', status: 'upcoming', balance: 1200, due_date: '2026-12-05' },
      { id: 'a', status: 'overdue', balance: 1200, due_date: '2026-11-05' },
      { id: 'c', status: 'paid', balance: 0, due_date: '2026-10-05' },
      { id: 'd', status: 'waived', balance: 0, due_date: '2026-09-05' },
      { id: 'e', status: 'cancelled', balance: 0, due_date: '2026-08-05' },
      { id: 'f', status: 'partly_paid', balance: 700, due_date: '2026-11-05' },
    ]);

    expect(rows.map((row) => row.id)).toEqual(['a', 'f', 'b']);
  });
});

describe('autoAllocateRent', () => {
  it('spreads a receipt across the oldest open periods', () => {
    const schedules = [
      { id: 'nov', status: 'overdue', balance: 1200, due_date: '2026-11-05' },
      { id: 'dec', status: 'upcoming', balance: 1200, due_date: '2026-12-05' },
      { id: 'jan', status: 'upcoming', balance: 1200, due_date: '2027-01-05' },
    ];

    const result = autoAllocateRent(schedules, 1500);
    expect(result.rows).toEqual([
      { schedule: schedules[0], amount: 1200 },
      { schedule: schedules[1], amount: 300 },
    ]);
    expect(result.remaining).toBe(0);
  });

  it('reports money left over when the receipt exceeds the open balance', () => {
    const result = autoAllocateRent(
      [{ id: 'nov', status: 'overdue', balance: 500, due_date: '2026-11-05' }],
      800,
    );
    expect(result.rows).toEqual([
      { schedule: expect.objectContaining({ id: 'nov' }), amount: 500 },
    ]);
    expect(result.remaining).toBe(300);
  });
});

describe('allocationTotal and scheduleBalance', () => {
  it('sums allocation rows to two decimals', () => {
    expect(
      allocationTotal([
        { amount: 100.1 },
        { amount: 200.239 },
      ]),
    ).toBe(300.34);
  });

  it('computes a rent balance from rent, adjustments and payments', () => {
    expect(
      scheduleBalance({
        rent_amount: 1200,
        adjustments: -100,
        late_fee: 25,
        paid_amount: 300,
      }),
    ).toBe(825);
  });
});

describe('lease actions', () => {
  it('only allows activation, renewal and termination on the right statuses', () => {
    expect(canActivateLease({ status: 'draft' })).toBe(true);
    expect(canActivateLease({ status: 'active' })).toBe(false);
    expect(canRenewLease({ status: 'active' })).toBe(true);
    expect(canRenewLease({ status: 'draft' })).toBe(false);
    expect(canTerminateLease({ status: 'active' })).toBe(true);
    expect(canTerminateLease({ status: 'draft' })).toBe(true);
    expect(canTerminateLease({ status: 'terminated' })).toBe(false);
  });

  it('only adjusts periods that still carry a balance', () => {
    expect(canAdjustRentSchedule({ status: 'overdue', balance: 500 })).toBe(true);
    expect(canAdjustRentSchedule({ status: 'partly_paid', balance: 0.5 })).toBe(true);
    expect(canAdjustRentSchedule({ status: 'paid', balance: 0 })).toBe(false);
    expect(canAdjustRentSchedule({ status: 'waived', balance: 0 })).toBe(false);
  });
});

describe('depositHeldAmount', () => {
  it('derives the held amount when the API omits it', () => {
    expect(
      depositHeldAmount({
        received_amount: 2400,
        deducted_amount: 400,
        refunded_amount: 200,
      }),
    ).toBe(1800);
    expect(depositHeldAmount({ held_amount: 900 })).toBe(900);
  });
});
