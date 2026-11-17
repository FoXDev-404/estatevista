import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from './rateLimit.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('createRateLimiter', () => {
  it('blocks requests over the limit until the window resets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T00:00:00.000Z'));
    const limit = createRateLimiter({ windowMs: 1000, max: 2, key: () => 'ip-1' });

    expect(limit({})).toBe(true);
    expect(limit({})).toBe(true);
    expect(limit({})).toBe(false);

    vi.advanceTimersByTime(1001);
    expect(limit({})).toBe(true);
  });

  it('keeps the bucket map bounded under many keys', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T00:00:00.000Z'));
    const limit = createRateLimiter({
      windowMs: 60_000,
      max: 10,
      maxKeys: 3,
      key: (request) => request.key,
    });

    for (const key of ['a', 'b', 'c', 'd', 'e']) {
      expect(limit({ key })).toBe(true);
    }

    expect(limit.bucketCount()).toBe(3);
  });

  it('sweeps expired buckets before evicting live ones', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T00:00:00.000Z'));
    const limit = createRateLimiter({
      windowMs: 1000,
      max: 10,
      maxKeys: 2,
      key: (request) => request.key,
    });

    limit({ key: 'old-a' });
    limit({ key: 'old-b' });
    vi.advanceTimersByTime(1001);
    limit({ key: 'new-a' });

    expect(limit.bucketCount()).toBe(1);
  });
});
