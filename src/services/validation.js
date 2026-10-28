import {
  areaUnitValues,
  propertyTypeValues,
  purposeValues,
  statusValues,
} from '../data/propertyOptions';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID_PATTERN = /^[A-Z0-9-]+$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

const isNonNegativeNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isPositiveNumber = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isImagePath = (value) =>
  typeof value === 'string' &&
  (value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:image/'));

export const slugify = (value = '') =>
  String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

/**
 * Trim and coerce a property record into the canonical shape.
 * This does not validate the record; call validatePropertyRecord afterwards.
 */
export function normalizeProperty(record = {}) {
  const specifications = isPlainObject(record.specifications) ? record.specifications : {};
  const location = isPlainObject(record.location) ? record.location : {};
  const normalizeList = (value) =>
    Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];

  return {
    ...record,
    id: String(record.id ?? '').trim().toUpperCase(),
    slug: String(record.slug ?? '').trim().toLowerCase(),
    title: String(record.title ?? '').trim(),
    type: String(record.type ?? '').trim().toLowerCase(),
    purpose: String(record.purpose ?? '').trim().toLowerCase(),
    price: typeof record.price === 'number' ? record.price : Number(record.price),
    currency: String(record.currency ?? 'INR').trim().toUpperCase(),
    location: {
      city: String(location.city ?? '').trim(),
      area: String(location.area ?? '').trim(),
      address: String(location.address ?? '').trim(),
    },
    specifications: {
      bedrooms:
        typeof specifications.bedrooms === 'number'
          ? specifications.bedrooms
          : Number(specifications.bedrooms),
      bathrooms:
        typeof specifications.bathrooms === 'number'
          ? specifications.bathrooms
          : Number(specifications.bathrooms),
      area:
        typeof specifications.area === 'number'
          ? specifications.area
          : Number(specifications.area),
      areaUnit: String(specifications.areaUnit ?? '').trim().toLowerCase(),
    },
    images: normalizeList(record.images),
    description: String(record.description ?? '').trim(),
    amenities: normalizeList(record.amenities),
    facilities: normalizeList(record.facilities),
    status: String(record.status ?? 'available').trim().toLowerCase(),
    featured: record.featured === true,
    trending: record.trending === true,
    createdAt: String(record.createdAt ?? '').trim(),
  };
}

/**
 * Validate one canonical property record.
 *
 * @param {object} property
 * @param {{ properties?: object[], ignoreId?: string }} options
 * @returns {{ isValid: boolean, errors: Record<string, string> }}
 */
export function validatePropertyRecord(property, { properties = [], ignoreId = null } = {}) {
  const errors = {};

  if (!isPlainObject(property)) {
    return { isValid: false, errors: { property: 'A property record must be an object.' } };
  }

  if (!hasText(property.id)) {
    errors.id = 'A property ID is required.';
  } else if (!ID_PATTERN.test(property.id)) {
    errors.id = 'Use uppercase letters, numbers and hyphens only for the property ID.';
  }

  if (!hasText(property.slug)) {
    errors.slug = 'A slug is required.';
  } else if (!SLUG_PATTERN.test(property.slug)) {
    errors.slug = 'Use lowercase letters, numbers and single hyphens for the slug.';
  } else if (property.slug.length > 100) {
    errors.slug = 'The slug must be 100 characters or fewer.';
  }

  if (!hasText(property.title)) {
    errors.title = 'A property title is required.';
  } else if (property.title.length < 3) {
    errors.title = 'The title must be at least 3 characters.';
  } else if (property.title.length > 120) {
    errors.title = 'The title must be 120 characters or fewer.';
  }

  if (!propertyTypeValues.includes(property.type)) {
    errors.type = 'Choose a supported property type.';
  }

  if (!purposeValues.includes(property.purpose)) {
    errors.purpose = 'Choose sale or rent.';
  }

  if (!isNonNegativeNumber(property.price)) {
    errors.price = 'Enter a valid, non-negative price.';
  }

  if (!/^[A-Z]{3}$/.test(property.currency ?? '')) {
    errors.currency = 'Use a three-letter currency code, such as INR.';
  }

  if (!isPlainObject(property.location)) {
    errors.location = 'A location object is required.';
  } else {
    if (!hasText(property.location.city)) errors.city = 'A city is required.';
    if (!hasText(property.location.area)) errors.area = 'A locality or area is required.';
    if (!hasText(property.location.address)) errors.address = 'An address is required.';
  }

  if (!isPlainObject(property.specifications)) {
    errors.specifications = 'Property specifications are required.';
  } else {
    const { bedrooms, bathrooms, area, areaUnit } = property.specifications;
    if (!Number.isInteger(bedrooms) || bedrooms < 0) {
      errors.bedrooms = 'Bedrooms must be a whole number of 0 or more.';
    }
    if (!Number.isInteger(bathrooms) || bathrooms < 0) {
      errors.bathrooms = 'Bathrooms must be a whole number of 0 or more.';
    }
    if (!isPositiveNumber(area)) {
      errors.areaSize = 'Area must be greater than 0.';
    }
    if (!areaUnitValues.includes(areaUnit)) {
      errors.areaUnit = 'Choose a supported area unit.';
    }
  }

  if (!Array.isArray(property.images)) {
    errors.images = 'Images must be a list of image paths or URLs.';
  } else if (!property.images.every(isImagePath)) {
    errors.images = 'Each image must be a local path or an http(s) URL.';
  }

  if (!hasText(property.description)) {
    errors.description = 'A description is required.';
  } else if (property.description.length < 20) {
    errors.description = 'Write at least 20 characters of description.';
  } else if (property.description.length > 2500) {
    errors.description = 'The description must be 2,500 characters or fewer.';
  }

  if (!Array.isArray(property.amenities) || !property.amenities.every(hasText)) {
    errors.amenities = 'Amenities must be a list of short labels.';
  }

  if (!Array.isArray(property.facilities) || !property.facilities.every(hasText)) {
    errors.facilities = 'Facilities must be a list of short labels.';
  }

  if (!statusValues.includes(property.status)) {
    errors.status = 'Choose a supported status.';
  }

  if (typeof property.featured !== 'boolean') {
    errors.featured = 'The featured flag must be true or false.';
  }

  if (typeof property.trending !== 'boolean') {
    errors.trending = 'The trending flag must be true or false.';
  }

  if (!hasText(property.createdAt) || Number.isNaN(new Date(property.createdAt).getTime())) {
    errors.createdAt = 'A valid creation date is required.';
  }

  const comparableProperties = properties.filter((item) => item.id !== ignoreId);
  if (comparableProperties.some((item) => item.id === property.id)) {
    errors.id = 'That property ID is already in use.';
  }
  if (comparableProperties.some((item) => item.slug === property.slug)) {
    errors.slug = 'That slug is already in use.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a complete collection, including ID and slug uniqueness.
 * Saved collections that fail this check are replaced with safe seed data.
 */
export function validatePropertyCollection(properties) {
  if (!Array.isArray(properties)) {
    return { isValid: false, errors: { collection: 'Saved data must be an array.' } };
  }

  const seenIds = new Set();
  const seenSlugs = new Set();
  const errors = {};

  properties.forEach((property, index) => {
    const result = validatePropertyRecord(property, { properties: [] });
    if (!result.isValid) {
      errors[`record-${index}`] = result.errors;
      return;
    }
    if (seenIds.has(property.id)) {
      errors[`record-${index}-id`] = `Duplicate property ID: ${property.id}`;
    }
    if (seenSlugs.has(property.slug)) {
      errors[`record-${index}-slug`] = `Duplicate property slug: ${property.slug}`;
    }
    seenIds.add(property.id);
    seenSlugs.add(property.slug);
  });

  return { isValid: Object.keys(errors).length === 0, errors };
}

export { SLUG_PATTERN, ID_PATTERN };
