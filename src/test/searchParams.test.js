import { describe, expect, it } from 'vitest';
import {
  buildListingSearchParams,
  getActiveFilterCount,
  hasActiveFilters,
  parseListingSearchParams,
} from '../services/searchParams';

describe('listing search params', () => {
  it('parses and normalizes valid parameters', () => {
    const params = new URLSearchParams(
      'q=%20sea%20view%20&location=%20Goa%20&type=villa&purpose=rent&minPrice=100&maxPrice=500&featured=true&sort=price-asc&page=2',
    );

    expect(parseListingSearchParams(params)).toEqual({
      q: 'sea view',
      location: 'Goa',
      type: 'villa',
      purpose: 'rent',
      minPrice: 100,
      maxPrice: 500,
      featured: true,
      sort: 'price-asc',
      page: 2,
    });
  });

  it('ignores unsupported values and supplies defaults', () => {
    const params = new URLSearchParams(
      'type=castle&purpose=lease&sort=cheapest&minPrice=-5&maxPrice=abc&page=0',
    );

    expect(parseListingSearchParams(params)).toEqual({
      q: '',
      location: '',
      type: '',
      purpose: '',
      minPrice: null,
      maxPrice: null,
      featured: false,
      sort: 'newest',
      page: 1,
    });
  });

  it('supports plain objects and missing params', () => {
    expect(parseListingSearchParams({ type: 'house', page: '3' })).toMatchObject({
      type: 'house',
      page: 3,
    });
    expect(parseListingSearchParams(null)).toMatchObject({
      q: '',
      sort: 'newest',
      page: 1,
    });
  });

  it('builds canonical URLs and omits defaults', () => {
    const params = buildListingSearchParams({
      q: '  sea view ',
      location: ' Goa ',
      type: 'villa',
      purpose: 'rent',
      minPrice: 0,
      maxPrice: null,
      featured: true,
      sort: 'price-asc',
      page: 2,
    });

    expect(params.toString()).toBe(
      'q=sea+view&location=Goa&type=villa&purpose=rent&minPrice=0&featured=true&sort=price-asc&page=2',
    );

    expect(buildListingSearchParams({ q: '', type: '', sort: 'newest', page: 1 }).toString()).toBe(
      '',
    );
  });

  it('can omit pagination for filter-only updates', () => {
    const params = buildListingSearchParams(
      { q: 'goa', page: 4 },
      { includePagination: false },
    );

    expect(params.get('q')).toBe('goa');
    expect(params.has('page')).toBe(false);
  });

  it('counts active filters and treats non-default sorting as active', () => {
    expect(getActiveFilterCount({})).toBe(0);
    expect(
      getActiveFilterCount({
        q: 'goa',
        location: '',
        type: 'villa',
        purpose: '',
        minPrice: 0,
        maxPrice: null,
        featured: true,
      }),
    ).toBe(4);

    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ sort: 'price-desc' })).toBe(true);
    expect(hasActiveFilters({ sort: 'newest' })).toBe(false);
  });
});
