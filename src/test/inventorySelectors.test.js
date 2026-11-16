import { describe, expect, it } from 'vitest';
import {
  buildUnitNumberPreview,
  nextUnitStatuses,
  projectStatusOptions,
  projectTypeOptions,
  statusTone,
  unitStatusOptions,
  validateUnitNumberPattern,
} from '../services/inventorySelectors';

describe('inventory selectors', () => {
  it('exposes the project type and status catalogues in demo order', () => {
    expect(projectTypeOptions.map((option) => option.value)).toEqual([
      'residential',
      'commercial',
      'mixed_use',
      'land',
      'other',
    ]);
    expect(projectStatusOptions.map((option) => option.value)).toEqual([
      'planning',
      'active',
      'on_hold',
      'completed',
      'archived',
    ]);
    expect(unitStatusOptions.map((option) => option.value)).toEqual([
      'draft',
      'available',
      'reserved',
      'sold',
      'rented',
      'blocked',
      'under_maintenance',
    ]);
    expect(unitStatusOptions[6].label).toBe('Under maintenance');
  });

  it('maps each inventory status to an admin badge tone', () => {
    expect(statusTone('active')).toBe('success');
    expect(statusTone('available')).toBe('success');
    expect(statusTone('sold')).toBe('active');
    expect(statusTone('reserved')).toBe('gold');
    expect(statusTone('on_hold')).toBe('gold');
    expect(statusTone('blocked')).toBe('danger');
    expect(statusTone('archived')).toBe('muted');
    expect(statusTone('draft')).toBe('muted');
    expect(statusTone('unknown-status')).toBe('muted');
  });

  it('validates unit number patterns against the server rules', () => {
    expect(validateUnitNumberPattern('A-{floor}{number}')).toBeNull();
    expect(validateUnitNumberPattern('')).toMatch(/pattern/i);
    expect(validateUnitNumberPattern('A-{floor}')).toMatch(/\{number\}/);
    expect(validateUnitNumberPattern('A-{block}{number}')).toMatch(/only/i);
    expect(validateUnitNumberPattern('A {number} #')).toBeNull();
  });

  it('builds a capped preview of generated unit numbers', () => {
    expect(
      buildUnitNumberPreview({
        floorFrom: 1,
        floorTo: 2,
        unitsPerFloor: 2,
        pattern: 'B-{floor}{number}',
        padding: 2,
      }),
    ).toEqual(['B-101', 'B-102', 'B-201', 'B-202']);

    const capped = buildUnitNumberPreview({
      floorFrom: 1,
      floorTo: 4,
      unitsPerFloor: 10,
      pattern: '{floor}{number}',
      padding: 3,
      limit: 5,
    });
    expect(capped).toEqual(['1001', '1002', '1003', '1004', '1005']);
  });

  it('lists the statuses a unit can move to from its current status', () => {
    expect(nextUnitStatuses('draft')).toEqual(['available', 'blocked', 'under_maintenance']);
    expect(nextUnitStatuses('available')).toEqual([
      'reserved',
      'sold',
      'rented',
      'blocked',
      'under_maintenance',
    ]);
    expect(nextUnitStatuses('sold')).toEqual(['available']);
    expect(nextUnitStatuses('unknown')).toEqual([]);
  });
});
