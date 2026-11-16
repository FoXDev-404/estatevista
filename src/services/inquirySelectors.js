export const inquiryTypeOptions = [
  { value: '', label: 'All types' },
  { value: 'general', label: 'General inquiry' },
  { value: 'project', label: 'Project inquiry' },
  { value: 'property', label: 'Property inquiry' },
  { value: 'visit', label: 'Site visit request' },
];

export const inquiryStatusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

export function inquiryTypeLabel(value) {
  return inquiryTypeOptions.find((option) => option.value === value)?.label || value || '—';
}

export function inquiryInterestLabel(inquiry) {
  if (inquiry.project?.name && inquiry.unit?.unit_number) {
    return `${inquiry.project.name} · ${inquiry.unit.unit_number}`;
  }
  if (inquiry.project?.name) return inquiry.project.name;
  if (inquiry.property?.title) return inquiry.property.title;
  if (inquiry.unit?.unit_number) return `Unit ${inquiry.unit.unit_number}`;
  return 'General inquiry';
}

export function inquiryStatusTone(status) {
  if (status === 'converted') return 'success';
  if (status === 'closed') return 'muted';
  return 'active';
}
