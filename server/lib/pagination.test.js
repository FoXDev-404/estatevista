import { describe, expect, it } from 'vitest';
import { paginated, parsePagination } from '../lib/pagination.js';

describe('pagination helpers', () => {
  it('defaults to page 1 and 20 rows', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, from: 0, to: 19 });
  });

  it('clamps the limit and never allows a page below 1', () => {
    expect(parsePagination({ page: '0', limit: '500' })).toEqual({
      page: 1,
      limit: 100,
      from: 0,
      to: 99,
    });
  });

  it('builds pagination metadata', () => {
    expect(paginated([1, 2], 42, 2, 20)).toEqual({
      data: [1, 2],
      meta: { page: 2, limit: 20, total: 42, pages: 3 },
    });
  });
});
