import { formatPrice } from './formatters';

export const leadStageOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'visit_scheduled', label: 'Visit scheduled' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export const openLeadStatuses = leadStageOptions
  .filter((option) => !['won', 'lost'].includes(option.value))
  .map((option) => option.value);

export const leadStageFlow = leadStageOptions.filter(
  (option) => option.value !== 'lost',
);

export const customerTypeOptions = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
];

export const visitStatusOptions = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No-show' },
];

export const followupTypeOptions = [
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'site_visit', label: 'Site visit' },
];

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label || value || '—';
}

export function leadStageTone(status) {
  if (status === 'won') return 'success';
  if (status === 'lost') return 'danger';
  if (status === 'negotiation' || status === 'qualified') return 'gold';
  if (status === 'new') return 'muted';
  return 'active';
}

export function customerTypeTone(type) {
  return type === 'company' ? 'gold' : 'muted';
}

export function visitStatusTone(status) {
  if (status === 'completed') return 'success';
  if (status === 'cancelled' || status === 'no_show') return 'danger';
  return 'active';
}

export function budgetLabel(lead, currency = 'USD') {
  const min = Number(lead.budget_min);
  const max = Number(lead.budget_max);
  const hasMin = Number.isFinite(min) && min > 0;
  const hasMax = Number.isFinite(max) && max > 0;
  if (hasMin && hasMax) {
    return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
  }
  if (hasMin) return `From ${formatPrice(min, currency)}`;
  if (hasMax) return `Up to ${formatPrice(max, currency)}`;
  return '—';
}

export function leadInterestLabel(lead) {
  if (lead.unit?.unit_number && lead.project?.name) {
    return `${lead.project.name} · ${lead.unit.unit_number}`;
  }
  return lead.project?.name || lead.unit?.unit_number || '—';
}

export function leadStageIndex(status) {
  const index = leadStageFlow.findIndex((option) => option.value === status);
  return index === -1 ? 0 : index;
}

export function visitActions(status) {
  if (status === 'scheduled') {
    return [
      { status: 'completed', label: 'Complete' },
      { status: 'cancelled', label: 'Cancel' },
      { status: 'no_show', label: 'No-show' },
    ];
  }
  return [{ status: 'scheduled', label: 'Reopen' }];
}

export function toDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
