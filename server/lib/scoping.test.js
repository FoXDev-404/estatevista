import { describe, expect, it } from 'vitest';
import { assertSameCompany, clientIp } from '../lib/scoping.js';

describe('client IP', () => {
  it('uses the Express-resolved address rather than a client-supplied header', () => {
    expect(
      clientIp({
        headers: { 'x-forwarded-for': '203.0.113.9' },
        ip: '10.0.0.5',
        socket: { remoteAddress: '10.0.0.5' },
      }),
    ).toBe('10.0.0.5');
  });

  it('falls back to the peer address when Express has not resolved one', () => {
    expect(clientIp({ headers: {}, socket: { remoteAddress: '10.0.0.6' } })).toBe('10.0.0.6');
  });
});

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
