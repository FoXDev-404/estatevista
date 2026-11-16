import { formatDate } from './formatters';

export function inventoryRows(inventory) {
  return Array.isArray(inventory?.by_status) ? inventory.by_status : [];
}

export function pipelineBarPercent(row, rows) {
  const counts = (rows || []).map((item) => Number(item?.count) || 0);
  const max = counts.length ? Math.max(...counts) : 0;
  if (!max) return 0;
  return Math.round(((Number(row?.count) || 0) / max) * 100);
}

export function projectPercent(project) {
  if (!project) return 0;
  const stored = Number(project.percent);
  const units = Number(project.units_count) || 0;
  const computed =
    units > 0
      ? Math.round(((Number(project.sold_units) || 0) + (Number(project.rented_units) || 0)) / units * 100)
      : 0;
  const value = Number.isFinite(stored) ? stored : computed;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function agingLabel(days) {
  if (days === null || days === undefined || days === '') return '';
  const value = Number(days);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value === 0) return 'Due today';
  return `${value} day${value === 1 ? '' : 's'} overdue`;
}

export function notificationRelativeTime(value, now = Date.now()) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';

  const seconds = Math.max(0, Math.floor((Number(now) - timestamp) / 1000));
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
}

export function unreadBadge(count) {
  const value = Number(count) || 0;
  if (value <= 0) return '';
  return value > 99 ? '99+' : String(value);
}
