export const WEBSITE_INQUIRY_TYPES = ['general', 'project', 'property', 'visit'];
export const WEBSITE_INQUIRY_STATUSES = ['new', 'converted', 'closed'];

/**
 * Shapes a website inquiry for the authenticated inbox. Company, duplicate-key
 * and visit-link columns stay server-side.
 */
export function websiteInquiryView(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    source_page: row.source_page,
    locale: row.locale,
    status: row.status,
    project: row.project ? { id: row.project.id, name: row.project.name } : null,
    unit: row.unit ? { id: row.unit.id, unit_number: row.unit.unit_number } : null,
    property: row.property ? { id: row.property.id, title: row.property.title } : null,
    lead: row.lead ? { id: row.lead.id, name: row.lead.name, status: row.lead.status } : null,
    created_at: row.created_at,
  };
}
