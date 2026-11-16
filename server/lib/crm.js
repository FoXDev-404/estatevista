export const LEAD_STATUSES = [
  'new',
  'contacted',
  'qualified',
  'visit_scheduled',
  'negotiation',
  'won',
  'lost',
];
export const LEAD_OPEN_STATUSES = LEAD_STATUSES.filter(
  (status) => status !== 'won' && status !== 'lost',
);
export const CUSTOMER_TYPES = ['individual', 'company'];
export const FOLLOWUP_TYPES = ['call', 'meeting', 'note', 'email', 'whatsapp', 'site_visit'];
export const VISIT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];

// A visit can be closed from scheduled, and any closed visit can be reopened.
// Closing a finished visit directly is rejected so outcomes stay explicit.
export const VISIT_STATUS_TRANSITIONS = {
  scheduled: ['completed', 'cancelled', 'no_show'],
  completed: ['scheduled'],
  cancelled: ['scheduled'],
  no_show: ['scheduled'],
};

export const DEFAULT_LEAD_SOURCES = [
  'Website',
  'Walk-in',
  'Referral',
  'Facebook',
  'Phone call',
  'Agent',
];

export function canTransitionVisit(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  return (VISIT_STATUS_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

export function visitTransitionMessage(status) {
  if (status === 'cancelled') return 'Reopen the visit before cancelling it.';
  if (status === 'no_show') return 'Reopen the visit before marking it as a no-show.';
  return 'Reopen the visit before completing it.';
}
