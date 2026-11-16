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
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || null;
}
