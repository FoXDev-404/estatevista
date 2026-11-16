import { LEAD_STATUS_LABELS } from './crm.js';

function recipientFor(actorId, userId) {
  if (!userId) return null;
  if (userId === actorId) return null;
  return userId;
}

export async function notifyUser(
  repository,
  { companyId, userId, actorId, eventKey, title, body = null, url = null },
) {
  const recipient = recipientFor(actorId, userId);
  if (!recipient) return null;
  return repository.createNotification(companyId, {
    user_id: recipient,
    event_key: eventKey,
    title,
    body,
    url,
  });
}

export function notifyLeadAssigned(repository, { companyId, actorId, actorName, lead }) {
  return notifyUser(repository, {
    companyId,
    userId: lead.assigned_to,
    actorId,
    eventKey: 'lead.assigned',
    title: `New lead assigned: ${lead.name}`,
    body: `${actorName} assigned this lead to you.`,
    url: `/admin/leads/${lead.id}`,
  });
}

export function notifyLeadStageChanged(repository, { companyId, actorId, actorName, lead }) {
  if (!lead.assigned_to) return null;
  const label = LEAD_STATUS_LABELS[lead.status] || lead.status;
  return notifyUser(repository, {
    companyId,
    userId: lead.assigned_to,
    actorId,
    eventKey: 'lead.stage_changed',
    title: `Lead moved to ${label}`,
    body: `${actorName} moved ${lead.name} to ${label}.`,
    url: `/admin/leads/${lead.id}`,
  });
}

export function notifySaleCreated(repository, { companyId, actorId, actorName, sale }) {
  if (!sale.salesperson_id) return null;
  const customer = sale.customer?.name ? ` for ${sale.customer.name}` : '';
  return notifyUser(repository, {
    companyId,
    userId: sale.salesperson_id,
    actorId,
    eventKey: 'sale.created',
    title: `New sale: ${sale.number}`,
    body: `${actorName} recorded a sale${customer}.`,
    url: `/admin/sales/${sale.id}`,
  });
}

export function notifyCollectionReceived(repository, { companyId, actorId, actorName, sale }) {
  if (!sale?.salesperson_id) return null;
  return notifyUser(repository, {
    companyId,
    userId: sale.salesperson_id,
    actorId,
    eventKey: 'collection.received',
    title: `Payment received: ${sale.number}`,
    body: `${actorName} recorded a payment for ${sale.number}.`,
    url: `/admin/sales/${sale.id}`,
  });
}
