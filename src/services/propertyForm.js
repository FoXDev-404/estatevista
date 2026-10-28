import { normalizeProperty, slugify, validatePropertyRecord } from './validation';

const today = () => new Date().toISOString().slice(0, 10);

export const emptyPropertyFormValues = {
  title: '',
  slug: '',
  type: 'apartment',
  purpose: 'sale',
  price: '',
  city: '',
  area: '',
  address: '',
  bedrooms: '0',
  bathrooms: '0',
  areaSize: '',
  areaUnit: 'sqft',
  description: '',
  images: '',
  amenities: '',
  facilities: '',
  status: 'available',
  featured: false,
  trending: false,
};

export const propertyToFormValues = (property) => {
  if (!property) return { ...emptyPropertyFormValues };

  return {
    title: property.title || '',
    slug: property.slug || '',
    type: property.type || 'apartment',
    purpose: property.purpose || 'sale',
    price: property.price !== undefined && property.price !== null ? String(property.price) : '',
    city: property.location?.city || '',
    area: property.location?.area || '',
    address: property.location?.address || '',
    bedrooms: String(property.specifications?.bedrooms ?? 0),
    bathrooms: String(property.specifications?.bathrooms ?? 0),
    areaSize: String(property.specifications?.area ?? ''),
    areaUnit: property.specifications?.areaUnit || 'sqft',
    description: property.description || '',
    images: (property.images || []).join('\n'),
    amenities: (property.amenities || []).join('\n'),
    facilities: (property.facilities || []).join('\n'),
    status: property.status || 'available',
    featured: Boolean(property.featured),
    trending: Boolean(property.trending),
  };
};

const toLines = (value) =>
  String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const formValuesToProperty = (values, base = {}) =>
  normalizeProperty({
    ...base,
    title: values.title,
    slug: values.slug?.trim() ? values.slug : slugify(values.title),
    type: values.type,
    purpose: values.purpose,
    price: values.price === '' ? Number.NaN : Number(values.price),
    currency: base.currency || 'INR',
    location: {
      city: values.city,
      area: values.area,
      address: values.address,
    },
    specifications: {
      bedrooms: values.bedrooms === '' ? 0 : Number(values.bedrooms),
      bathrooms: values.bathrooms === '' ? 0 : Number(values.bathrooms),
      area: values.areaSize === '' ? Number.NaN : Number(values.areaSize),
      areaUnit: values.areaUnit,
    },
    images: toLines(values.images),
    description: values.description,
    amenities: toLines(values.amenities),
    facilities: toLines(values.facilities),
    status: values.status,
    featured: values.featured === true,
    trending: values.trending === true,
    id: base.id || 'PROP-NEW',
    createdAt: base.createdAt || today(),
  });

/**
 * Validate admin form values and return both flattened errors and the
 * normalized property ready for the repository.
 */
export function validatePropertyForm(values, { properties = [], originalProperty = null } = {}) {
  const property = formValuesToProperty(values, {
    id: originalProperty?.id,
    createdAt: originalProperty?.createdAt,
    currency: originalProperty?.currency || 'INR',
  });

  const result = validatePropertyRecord(property, {
    properties,
    ignoreId: property.id,
  });

  const errors = { ...result.errors };

  if (!String(values.price).trim()) {
    errors.price = 'Enter a price.';
  } else if (Number(values.price) <= 0) {
    errors.price = 'Price must be greater than zero.';
  }

  if (!String(values.slug || '').trim() && !String(values.title || '').trim()) {
    errors.slug = 'A slug is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    property,
  };
}

export const isPropertyFormDirty = (values, initialValues) =>
  JSON.stringify(values) !== JSON.stringify(initialValues);

export const hasUnsavedPropertyChanges = (values, initialValues) =>
  isPropertyFormDirty(values, initialValues);
