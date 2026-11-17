import { notFound } from './errors.js';

export function assertSameCompany(row, companyId) {
  if (!row || row.company_id !== companyId) {
    throw notFound();
  }
  return row;
}

export function companyFilter(query, companyId) {
  return query.eq('company_id', companyId);
}

export function clientIp(req) {
  // Express resolves req.ip according to the configured `trust proxy` setting.
  // Never read X-Forwarded-For directly here: without a trusted edge that
  // header is client-controlled and would let callers spoof audit IPs and
  // bypass IP-keyed throttles.
  const ip = req.ip || req.socket?.remoteAddress || null;
  return ip ? String(ip).replace(/^::ffff:/, '') : null;
}
