import { describe, expect, it } from 'vitest';
import {
  agingLabel,
  inventoryRows,
  notificationRelativeTime,
  pipelineBarPercent,
  projectPercent,
  unreadBadge,
} from '../services/dashboardSelectors';

describe('dashboard inventory rows', () => {
  it('returns the status breakdown and tolerates a missing section', () => {
    const rows = [{ status: 'available', count: 2 }];
    expect(inventoryRows({ by_status: rows })).toBe(rows);
    expect(inventoryRows(null)).toEqual([]);
  });
});

describe('pipeline bar scale', () => {
  it('scales each stage against the largest stage', () => {
    const rows = [{ count: 4 }, { count: 2 }, { count: 0 }];
    expect(pipelineBarPercent(rows[0], rows)).toBe(100);
    expect(pipelineBarPercent(rows[1], rows)).toBe(50);
    expect(pipelineBarPercent(rows[2], rows)).toBe(0);
    expect(pipelineBarPercent({ count: 0 }, [])).toBe(0);
  });
});

describe('projectPercent', () => {
  it('clamps the stored percentage and recalculates a missing one', () => {
    expect(projectPercent({ percent: 33 })).toBe(33);
    expect(projectPercent({ percent: 140 })).toBe(100);
    expect(projectPercent({ percent: -4 })).toBe(0);
    expect(
      projectPercent({ units_count: 4, sold_units: 1, rented_units: 1 }),
    ).toBe(50);
    expect(projectPercent({ units_count: 0 })).toBe(0);
  });
});

describe('agingLabel', () => {
  it('describes how overdue an installment is', () => {
    expect(agingLabel(0)).toBe('Due today');
    expect(agingLabel(1)).toBe('1 day overdue');
    expect(agingLabel(12)).toBe('12 days overdue');
    expect(agingLabel(-3)).toBe('');
    expect(agingLabel(null)).toBe('');
  });
});

describe('notificationRelativeTime', () => {
  const now = Date.parse('2026-11-17T12:00:00.000Z');

  it('formats recent notifications compactly', () => {
    expect(notificationRelativeTime(null, now)).toBe('');
    expect(notificationRelativeTime('2026-11-17T11:59:40.000Z', now)).toBe('Just now');
    expect(notificationRelativeTime('2026-11-17T11:55:00.000Z', now)).toBe('5m ago');
    expect(notificationRelativeTime('2026-11-17T09:00:00.000Z', now)).toBe('3h ago');
    expect(notificationRelativeTime('2026-11-14T12:00:00.000Z', now)).toBe('3d ago');
  });

  it('falls back to a date for older notifications', () => {
    expect(notificationRelativeTime('2026-10-17T12:00:00.000Z', now)).toMatch(/2026/);
  });
});

describe('unreadBadge', () => {
  it('hides zero and caps large counts', () => {
    expect(unreadBadge(0)).toBe('');
    expect(unreadBadge(5)).toBe('5');
    expect(unreadBadge(120)).toBe('99+');
  });
});
