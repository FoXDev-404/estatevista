const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const ranges = [
    { limit: 60, divisor: 1, unit: 'second' },
    { limit: 3600, divisor: 60, unit: 'minute' },
    { limit: 86400, divisor: 3600, unit: 'hour' },
    { limit: 86400 * 30, divisor: 86400, unit: 'day' },
    { limit: 86400 * 365, divisor: 86400 * 30, unit: 'month' },
    { limit: Number.POSITIVE_INFINITY, divisor: 86400 * 365, unit: 'year' },
  ];

  for (const range of ranges) {
    if (Math.abs(seconds) < range.limit) {
      return relative.format(Math.round(seconds / range.divisor), range.unit);
    }
  }
  return formatDateTime(value);
}

export function formatSequencePreview(sequence, now = new Date()) {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const next = String(sequence.next_value ?? 1).padStart(Number(sequence.padding) || 4, '0');
  if (sequence.reset_period === 'yearly') return `${sequence.prefix}${year}-${next}`;
  if (sequence.reset_period === 'monthly') return `${sequence.prefix}${year}${month}-${next}`;
  return `${sequence.prefix}${next}`;
}

export function initialsOf(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export const ACTION_LABELS = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  manage: 'Manage',
  cancel: 'Cancel',
  void: 'Void',
  terminate: 'Terminate',
  collect: 'Collect',
  export: 'Export',
};

export const MODULE_LABELS = {
  Company: 'Company settings',
  Branch: 'Branch',
  User: 'Team member',
  Role: 'Role & permissions',
  NumberSequence: 'Number sequence',
  auth: 'Authentication',
};

export function moduleLabel(value) {
  if (!value) return '—';
  if (MODULE_LABELS[value]) return MODULE_LABELS[value];
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
