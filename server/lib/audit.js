import { ApiError } from './errors.js';

export async function writeAudit({
  supabase,
  companyId,
  userId,
  module,
  recordId,
  event,
  before = null,
  after = null,
  ip = null,
}) {
  const { error } = await supabase.from('audit_logs').insert({
    company_id: companyId,
    user_id: userId || null,
    module,
    record_id: recordId ? String(recordId) : null,
    event,
    before_data: before,
    after_data: after,
    ip_address: ip,
  });

  if (error) {
    console.error('Could not write audit log:', error.message);
    throw new ApiError(500, 'The change could not be recorded in the audit log.');
  }
}
