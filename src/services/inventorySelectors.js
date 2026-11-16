export const projectTypeOptions = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'mixed_use', label: 'Mixed use' },
  { value: 'land', label: 'Land' },
  { value: 'other', label: 'Other' },
];

export const projectStatusOptions = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export const unitStatusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' },
  { value: 'rented', label: 'Rented' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'under_maintenance', label: 'Under maintenance' },
];

export const landAreaUnitOptions = [
  { value: 'katha', label: 'Katha' },
  { value: 'decimal', label: 'Decimal' },
  { value: 'bigha', label: 'Bigha' },
  { value: 'acre', label: 'Acre' },
  { value: 'sqft', label: 'Square feet' },
  { value: 'sqm', label: 'Square metre' },
];

export const unitAreaUnitOptions = [
  { value: 'sqft', label: 'Square feet' },
  { value: 'sqm', label: 'Square metre' },
  { value: 'katha', label: 'Katha' },
  { value: 'acre', label: 'Acre' },
];

const STATUS_TONES = {
  active: 'success',
  available: 'success',
  completed: 'active',
  sold: 'active',
  rented: 'active',
  reserved: 'gold',
  on_hold: 'gold',
  under_maintenance: 'gold',
  blocked: 'danger',
  planning: 'muted',
  draft: 'muted',
  archived: 'muted',
};

export function statusTone(status) {
  return STATUS_TONES[status] || 'muted';
}

const UNIT_STATUS_TRANSITIONS = {
  draft: ['available', 'blocked', 'under_maintenance'],
  available: ['reserved', 'sold', 'rented', 'blocked', 'under_maintenance'],
  reserved: ['available', 'sold', 'rented', 'blocked'],
  sold: ['available'],
  rented: ['available'],
  blocked: ['available', 'under_maintenance', 'draft'],
  under_maintenance: ['available', 'blocked'],
};

export function nextUnitStatuses(status) {
  return UNIT_STATUS_TRANSITIONS[status] || [];
}

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || value || '';
}

export function validateUnitNumberPattern(pattern) {
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

/**
 * Mirrors the server numbering rule so the generation modal can show the
 * first units before they are written. The server remains authoritative.
 */
export function buildUnitNumberPreview({
  floorFrom,
  floorTo,
  unitsPerFloor,
  pattern,
  padding = 2,
  limit = 12,
}) {
  if (validateUnitNumberPattern(pattern)) return [];

  const from = Number(floorFrom);
  const to = Number(floorTo);
  const perFloor = Number(unitsPerFloor);
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(perFloor)) return [];
  if (to < from || perFloor < 1) return [];

  const numbers = [];
  for (let floor = from; floor <= to; floor += 1) {
    for (let index = 1; index <= perFloor; index += 1) {
      numbers.push(
        String(pattern)
          .replaceAll('{floor}', String(floor))
          .replaceAll('{number}', String(index).padStart(Number(padding) || 1, '0')),
      );
      if (numbers.length >= limit) return numbers;
    }
  }
  return numbers;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.readAsDataURL(file);
  });
}
