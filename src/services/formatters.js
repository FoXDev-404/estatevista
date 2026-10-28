export const formatPrice = (value, currency = 'INR') => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 'Price on request';

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(numericValue);
  } catch {
    return `₹${new Intl.NumberFormat('en-IN').format(numericValue)}`;
  }
};

export const formatCompactIndianValue = (value, currency = 'INR') => {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });

  if (value >= 10000000) return `${formatter.format(value / 10000000)} Cr`;
  if (value >= 100000) return `${formatter.format(value / 100000)} L`;
  return formatPrice(value, currency);
};

export const formatPropertyPrice = (property) => {
  if (!property) return 'Price on request';
  const formatted = formatPrice(property.price, property.currency || 'INR');
  return property.purpose === 'rent' ? `${formatted} / month` : formatted;
};

export const formatPropertyPriceCompact = (property) => {
  if (!property) return 'Price on request';
  const formatted = formatCompactIndianValue(property.price, property.currency || 'INR');
  return property.purpose === 'rent' ? `${formatted} / mo` : formatted;
};

export const formatNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '—';
  return new Intl.NumberFormat('en-IN').format(numericValue);
};

export const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not available';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatArea = (area, unit = 'sqft') => {
  const unitLabels = {
    sqft: 'sq ft',
    sqm: 'sq m',
    sqyd: 'sq yd',
    acres: 'acres',
  };
  return `${formatNumber(area)} ${unitLabels[unit] || unit}`;
};

export const titleCase = (value = '') =>
  String(value)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const formatBedroomLabel = (count) => {
  if (!Number.isFinite(Number(count)) || Number(count) <= 0) return null;
  return `${count} ${Number(count) === 1 ? 'bedroom' : 'bedrooms'}`;
};

export const formatBathroomLabel = (count) => {
  if (!Number.isFinite(Number(count)) || Number(count) <= 0) return null;
  return `${count} ${Number(count) === 1 ? 'bathroom' : 'bathrooms'}`;
};
