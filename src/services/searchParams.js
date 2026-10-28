import { purposeValues, propertyTypeValues, sortValues } from '../data/propertyOptions';

const optionalNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const positiveInteger = (value, fallback = 1) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function parseListingSearchParams(searchParams) {
  const get = (key) => {
    if (!searchParams) return '';
    if (typeof searchParams.get === 'function') return searchParams.get(key) || '';
    return searchParams[key] || '';
  };

  const type = get('type');
  const purpose = get('purpose');
  const sort = get('sort');

  return {
    q: get('q').trim(),
    location: get('location').trim(),
    type: propertyTypeValues.includes(type) ? type : '',
    purpose: purposeValues.includes(purpose) ? purpose : '',
    minPrice: optionalNumber(get('minPrice')),
    maxPrice: optionalNumber(get('maxPrice')),
    featured: get('featured') === 'true',
    sort: sortValues.includes(sort) ? sort : 'newest',
    page: positiveInteger(get('page')),
  };
}

export function buildListingSearchParams(filters = {}, { includePagination = true } = {}) {
  const params = new URLSearchParams();

  if (filters.q) params.set('q', String(filters.q).trim());
  if (filters.location) params.set('location', String(filters.location).trim());
  if (filters.type) params.set('type', filters.type);
  if (filters.purpose) params.set('purpose', filters.purpose);
  if (filters.minPrice !== null && filters.minPrice !== undefined && filters.minPrice !== '') {
    params.set('minPrice', String(filters.minPrice));
  }
  if (filters.maxPrice !== null && filters.maxPrice !== undefined && filters.maxPrice !== '') {
    params.set('maxPrice', String(filters.maxPrice));
  }
  if (filters.featured === true) params.set('featured', 'true');
  if (filters.sort && filters.sort !== 'newest') params.set('sort', filters.sort);
  if (includePagination && filters.page && Number(filters.page) > 1) {
    params.set('page', String(filters.page));
  }

  return params;
}

export function getActiveFilterCount(filters = {}) {
  return [
    Boolean(filters.q),
    Boolean(filters.location),
    Boolean(filters.type),
    Boolean(filters.purpose),
    filters.minPrice !== null && filters.minPrice !== undefined && filters.minPrice !== '',
    filters.maxPrice !== null && filters.maxPrice !== undefined && filters.maxPrice !== '',
    filters.featured === true,
  ].filter(Boolean).length;
}

export const hasActiveFilters = (filters = {}) =>
  getActiveFilterCount(filters) > 0 || Boolean(filters.sort && filters.sort !== 'newest');
