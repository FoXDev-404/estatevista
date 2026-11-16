import { describe, expect, it } from 'vitest';
import { assertSameCompany } from '../lib/scoping.js';

describe('company scoping', () => {
  it('returns a row that belongs to the company', () => {
    const row = { id: 'a', company_id: 'company-1' };
    expect(assertSameCompany(row, 'company-1')).toBe(row);
  });

  it('hides rows from another company as not found', () => {
    expect(() => assertSameCompany({ id: 'a', company_id: 'company-2' }, 'company-1')).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('treats a missing row as not found', () => {
    expect(() => assertSameCompany(null, 'company-1')).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
  });
});
