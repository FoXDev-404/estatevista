export const PROJECT_TYPES = ['residential', 'commercial', 'mixed_use', 'land', 'other'];
export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived'];
export const UNIT_STATUSES = [
  'draft',
  'available',
  'reserved',
  'sold',
  'rented',
  'blocked',
  'under_maintenance',
];
export const LAND_AREA_UNITS = ['katha', 'decimal', 'bigha', 'acre', 'sqft', 'sqm'];
export const UNIT_AREA_UNITS = ['sqft', 'sqm', 'katha', 'acre'];

// Default catalogue seeded for every new company. Projects reference these by
// id, so the labels stay stable until an administrator edits them.
export const DEFAULT_UNIT_TYPES = [
  'Flat',
  'Plot',
  'Apartment',
  'Office',
  'Shop',
  'Parking',
  'Storage',
];

// Statuses a unit may move to directly. Selling, renting and reserving also
// check for an active contract before the change is accepted.
export const UNIT_STATUS_TRANSITIONS = {
  draft: ['available', 'blocked', 'under_maintenance'],
  available: ['reserved', 'sold', 'rented', 'blocked', 'under_maintenance'],
  reserved: ['available', 'sold', 'rented', 'blocked'],
  sold: ['available'],
  rented: ['available'],
  blocked: ['available', 'under_maintenance', 'draft'],
  under_maintenance: ['available', 'blocked'],
};

export function canTransitionUnit(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  return (UNIT_STATUS_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

export function validateNumberPattern(pattern) {
  const value = String(pattern || '').trim();
  if (!value) return 'Enter a unit numbering pattern.';
  if (value.length > 60) return 'Use 60 characters or fewer.';
  if (!value.includes('{number}')) return 'Include {number} in the pattern.';

  const remainder = value.replaceAll('{floor}', '').replaceAll('{number}', '');
  if (remainder.includes('{') || remainder.includes('}')) {
    return 'Only {floor} and {number} placeholders are supported.';
  }
  if (!/^[A-Za-z0-9 _\-/.#]*$/.test(remainder)) {
    return 'Use letters, numbers, spaces, hyphens, slashes, dots or hashes.';
  }
  return null;
}

export function generateUnitNumbers({ floors, unitsPerFloor, numberPattern, numberPadding }) {
  const numbers = [];
  for (const floor of floors) {
    for (let index = 1; index <= unitsPerFloor; index += 1) {
      numbers.push(
        String(numberPattern)
          .replaceAll('{floor}', String(floor.number))
          .replaceAll('{number}', String(index).padStart(numberPadding, '0')),
      );
    }
  }
  return numbers;
}

export function activeContractLabel(contracts = {}) {
  const labels = [];
  if (contracts.reservations) labels.push('reservation');
  if (contracts.sales) labels.push('sale');
  if (contracts.leases) labels.push('lease');
  return labels.join(', ');
}
