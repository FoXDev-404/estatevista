import { propertyTypeLabels, purposeLabels } from '../data/propertyOptions';

const asArray = (properties) => (Array.isArray(properties) ? properties : []);

const dateValue = (value) => {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const numeric = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const includesText = (value, query) =>
  String(value || '')
    .toLowerCase()
    .includes(query);

export const getAvailableProperties = (properties) =>
  asArray(properties).filter((property) => property.status === 'available');

export const getFeaturedProperties = (properties, limit) => {
  const result = getAvailableProperties(properties).filter(
    (property) => property.featured === true,
  );
  return Number.isInteger(limit) ? result.slice(0, limit) : result;
};

export const getTrendingProperties = (properties, limit) => {
  const result = getAvailableProperties(properties).filter(
    (property) => property.trending === true,
  );
  return Number.isInteger(limit) ? result.slice(0, limit) : result;
};

export const sortProperties = (properties, sortBy = 'newest') => {
  const list = [...asArray(properties)];

  switch (sortBy) {
    case 'price-asc':
      return list.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
    case 'price-desc':
      return list.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
    case 'newest':
    default:
      return list.sort(
        (a, b) => dateValue(b.createdAt) - dateValue(a.createdAt) || b.id.localeCompare(a.id),
      );
  }
};

export const getLatestProperties = (properties, limit) => {
  const result = sortProperties(getAvailableProperties(properties), 'newest');
  return Number.isInteger(limit) ? result.slice(0, limit) : result;
};

export const getSaleProperties = (properties) =>
  getAvailableProperties(properties).filter((property) => property.purpose === 'sale');

export const getRentalProperties = (properties) =>
  getAvailableProperties(properties).filter((property) => property.purpose === 'rent');

export const getPropertiesByType = (properties, type) =>
  getAvailableProperties(properties).filter((property) => property.type === type);

export const getApartments = (properties) => getPropertiesByType(properties, 'apartment');
export const getHouses = (properties) => getPropertiesByType(properties, 'house');
export const getVillas = (properties) => getPropertiesByType(properties, 'villa');
export const getPlots = (properties) => getPropertiesByType(properties, 'plot');
export const getCommercialProperties = (properties) =>
  getPropertiesByType(properties, 'commercial');

export const searchProperties = (properties, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return asArray(properties);

  return asArray(properties).filter((property) => {
    const fields = [
      property.title,
      property.description,
      property.location?.city,
      property.location?.area,
      property.location?.address,
      property.type,
      propertyTypeLabels[property.type],
      property.purpose,
      purposeLabels[property.purpose],
      ...(property.amenities || []),
      ...(property.facilities || []),
    ];
    return fields.some((field) => includesText(field, normalizedQuery));
  });
};

export const filterProperties = (
  properties,
  filters = {},
  { includeUnavailable = false } = {},
) => {
  let result = asArray(properties);

  if (!includeUnavailable) {
    result = result.filter((property) => property.status === 'available');
  }

  if (filters.q) {
    result = searchProperties(result, filters.q);
  }

  if (filters.location) {
    const locationQuery = String(filters.location).trim().toLowerCase();
    result = result.filter((property) =>
      [property.location?.city, property.location?.area, property.location?.address].some(
        (field) => includesText(field, locationQuery),
      ),
    );
  }

  if (filters.type) {
    result = result.filter((property) => property.type === filters.type);
  }

  if (filters.purpose) {
    result = result.filter((property) => property.purpose === filters.purpose);
  }

  if (filters.featured === true) {
    result = result.filter((property) => property.featured === true);
  }

  const minPrice = numeric(filters.minPrice);
  const maxPrice = numeric(filters.maxPrice);

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    return [];
  }

  if (minPrice !== null) {
    result = result.filter((property) => property.price >= minPrice);
  }

  if (maxPrice !== null) {
    result = result.filter((property) => property.price <= maxPrice);
  }

  return result;
};

export const paginateProperties = (properties, page = 1, pageSize = 6) => {
  const list = asArray(properties);
  const safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 6;
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const requestedPage = Number.isFinite(Number(page)) ? Math.floor(Number(page)) : 1;
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  const items = list.slice(startIndex, startIndex + safePageSize);

  return {
    items,
    page: currentPage,
    totalPages,
    totalItems,
    pageSize: safePageSize,
    rangeStart: totalItems === 0 ? 0 : startIndex + 1,
    rangeEnd: Math.min(startIndex + safePageSize, totalItems),
    hasPrevious: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
};

export const getRelatedProperties = (properties, currentProperty, limit = 3) => {
  if (!currentProperty) return [];

  const currentPrice = Number(currentProperty.price) || 0;
  const candidates = getAvailableProperties(properties).filter(
    (property) => property.id !== currentProperty.id && property.slug !== currentProperty.slug,
  );

  const scored = candidates.map((property) => {
    let score = 0;
    if (property.type === currentProperty.type) score += 4;
    if (property.location?.city === currentProperty.location?.city) score += 4;
    if (property.location?.area === currentProperty.location?.area) score += 3;
    if (property.purpose === currentProperty.purpose) score += 2;

    const priceDifference = Math.abs(property.price - currentPrice);
    if (currentPrice > 0) {
      if (priceDifference <= currentPrice * 0.25) score += 2;
      else if (priceDifference <= currentPrice * 0.6) score += 1;
    }

    return { property, score };
  });

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        dateValue(b.property.createdAt) - dateValue(a.property.createdAt) ||
        a.property.id.localeCompare(b.property.id),
    )
    .slice(0, Number.isInteger(limit) && limit >= 0 ? limit : 3)
    .map((item) => item.property);
};

export const getPropertyStats = (properties) => {
  const list = asArray(properties);
  const byStatus = { available: 0, sold: 0, rented: 0, unavailable: 0 };
  list.forEach((property) => {
    if (Object.hasOwn(byStatus, property.status)) byStatus[property.status] += 1;
  });

  return {
    total: list.length,
    available: byStatus.available,
    sold: byStatus.sold,
    rented: byStatus.rented,
    unavailable: byStatus.unavailable,
    featured: list.filter((property) => property.featured).length,
    trending: list.filter((property) => property.trending).length,
  };
};

const propertySelectors = {
  getAvailableProperties,
  getFeaturedProperties,
  getTrendingProperties,
  getLatestProperties,
  getSaleProperties,
  getRentalProperties,
  getPropertiesByType,
  getApartments,
  getHouses,
  getVillas,
  getPlots,
  getCommercialProperties,
  searchProperties,
  filterProperties,
  sortProperties,
  paginateProperties,
  getRelatedProperties,
  getPropertyStats,
};

export default propertySelectors;
