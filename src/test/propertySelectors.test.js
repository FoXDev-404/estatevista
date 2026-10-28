import { describe, expect, it } from 'vitest';
import {
  filterProperties,
  getApartments,
  getAvailableProperties,
  getCommercialProperties,
  getFeaturedProperties,
  getHouses,
  getLatestProperties,
  getPlots,
  getPropertyStats,
  getRelatedProperties,
  getRentalProperties,
  getSaleProperties,
  getTrendingProperties,
  getVillas,
  paginateProperties,
  searchProperties,
  sortProperties,
} from '../services/propertySelectors';
import { makeProperties } from './fixtures';

const properties = makeProperties();

describe('propertySelectors', () => {
  it('returns only available properties for public collections', () => {
    expect(getAvailableProperties(properties).map((property) => property.id)).toEqual([
      'PROP-101',
      'PROP-102',
      'PROP-103',
      'PROP-105',
    ]);

    expect(getFeaturedProperties(properties).map((property) => property.id)).toEqual([
      'PROP-101',
      'PROP-102',
    ]);
    expect(getTrendingProperties(properties).map((property) => property.id)).toEqual([
      'PROP-101',
      'PROP-103',
    ]);
  });

  it('limits featured and latest collections when asked', () => {
    expect(getFeaturedProperties(properties, 1)).toHaveLength(1);
    expect(getLatestProperties(properties, 2).map((property) => property.id)).toEqual([
      'PROP-102',
      'PROP-103',
    ]);
  });

  it('sorts by price and recency without mutating the input', () => {
    const originalOrder = properties.map((property) => property.id);

    expect(sortProperties(properties, 'price-asc').map((property) => property.id)).toEqual([
      'PROP-103',
      'PROP-105',
      'PROP-101',
      'PROP-104',
      'PROP-102',
    ]);
    expect(sortProperties(properties, 'price-desc').map((property) => property.id)).toEqual([
      'PROP-102',
      'PROP-104',
      'PROP-101',
      'PROP-105',
      'PROP-103',
    ]);
    expect(sortProperties(properties, 'newest').map((property) => property.id)).toEqual([
      'PROP-102',
      'PROP-103',
      'PROP-101',
      'PROP-104',
      'PROP-105',
    ]);
    expect(properties.map((property) => property.id)).toEqual(originalOrder);
  });

  it('searches titles, locations, descriptions, types and amenities', () => {
    expect(searchProperties(properties, 'sea view').map((property) => property.id)).toEqual([
      'PROP-101',
    ]);
    expect(searchProperties(properties, 'goa').map((property) => property.id)).toEqual([
      'PROP-103',
    ]);
    expect(searchProperties(properties, 'villa').map((property) => property.id)).toEqual([
      'PROP-102',
    ]);
    expect(searchProperties(properties, '   ')).toHaveLength(5);
  });

  it('filters by type, purpose, featured flag and price range', () => {
    expect(filterProperties(properties, { type: 'villa' })).toHaveLength(1);
    expect(filterProperties(properties, { purpose: 'rent' })).toHaveLength(1);
    expect(filterProperties(properties, { featured: true })).toHaveLength(2);
    expect(
      filterProperties(properties, { minPrice: 4000000, maxPrice: 20000000 }).map(
        (property) => property.id,
      ),
    ).toEqual(['PROP-101']);
    expect(filterProperties(properties, { maxPrice: 0 })).toHaveLength(0);
  });

  it('rejects an inverted price range and can include unavailable records', () => {
    expect(filterProperties(properties, { minPrice: 100, maxPrice: 50 })).toEqual([]);
    expect(filterProperties(properties, {}, { includeUnavailable: true })).toHaveLength(5);
  });

  it('filters locations across city, area and address', () => {
    expect(filterProperties(properties, { location: 'bandra' }).map((property) => property.id)).toEqual([
      'PROP-102',
    ]);
    expect(filterProperties(properties, { location: '400018' }).map((property) => property.id)).toEqual([
      'PROP-101',
    ]);
  });

  it('provides type-specific available collections', () => {
    expect(getApartments(properties).map((property) => property.id)).toEqual(['PROP-101']);
    expect(getVillas(properties).map((property) => property.id)).toEqual(['PROP-102']);
    expect(getHouses(properties).map((property) => property.id)).toEqual(['PROP-103']);
    expect(getPlots(properties).map((property) => property.id)).toEqual(['PROP-105']);
    expect(getCommercialProperties(properties)).toEqual([]);
    expect(getSaleProperties(properties)).toHaveLength(3);
    expect(getRentalProperties(properties).map((property) => property.id)).toEqual(['PROP-103']);
  });

  it('paginates with clamping, ranges and navigation flags', () => {
    const pageTwo = paginateProperties(properties, 2, 2);

    expect(pageTwo.items.map((property) => property.id)).toEqual(['PROP-103', 'PROP-104']);
    expect(pageTwo).toMatchObject({
      page: 2,
      totalPages: 3,
      totalItems: 5,
      pageSize: 2,
      rangeStart: 3,
      rangeEnd: 4,
      hasPrevious: true,
      hasNext: true,
    });

    expect(paginateProperties(properties, 99, 2)).toMatchObject({
      page: 3,
      rangeStart: 5,
      rangeEnd: 5,
      hasNext: false,
    });
    expect(paginateProperties(properties, 0, 2).page).toBe(1);
    expect(paginateProperties([], 4, 6)).toMatchObject({
      items: [],
      page: 1,
      totalPages: 1,
      rangeStart: 0,
      rangeEnd: 0,
      hasPrevious: false,
      hasNext: false,
    });
    expect(paginateProperties(properties, 1, 0).pageSize).toBe(6);
  });

  it('suggests available related properties without the current record', () => {
    const related = getRelatedProperties(properties, properties[0], 2);

    expect(related).toHaveLength(2);
    expect(related[0].id).toBe('PROP-102');
    expect(related.map((property) => property.id)).not.toContain('PROP-101');
    expect(related.map((property) => property.id)).not.toContain('PROP-104');
    expect(getRelatedProperties(properties, null)).toEqual([]);
  });

  it('summarises collection statistics', () => {
    expect(getPropertyStats(properties)).toEqual({
      total: 5,
      available: 4,
      sold: 1,
      rented: 0,
      unavailable: 0,
      featured: 3,
      trending: 2,
    });
  });

  it('is defensive about missing collections', () => {
    expect(getAvailableProperties(undefined)).toEqual([]);
    expect(searchProperties(null, 'goa')).toEqual([]);
    expect(paginateProperties(undefined).totalItems).toBe(0);
    expect(getPropertyStats(null).total).toBe(0);
  });
});
