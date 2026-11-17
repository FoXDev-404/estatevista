import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

function splitOrigins(value) {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function trustProxySetting() {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw.trim() === '') {
    // Vercel overwrites X-Forwarded-For at its edge; trust exactly that hop.
    // Everywhere else, trust no proxy by default so a direct client cannot
    // spoof its address through the header.
    return process.env.VERCEL ? 1 : false;
  }

  const value = raw.trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 5000),
  appOrigins: splitOrigins(process.env.APP_ORIGIN),
  trustProxy: trustProxySetting(),
  sessionSecret:
    process.env.SESSION_SECRET ||
    (isProduction ? '' : 'estatevista-dev-session-secret-change-me'),
  publicCompanySlug:
    process.env.PUBLIC_COMPANY_SLUG || process.env.SEED_COMPANY_SLUG || 'harbour-homes',
  seed: {
    companyName: process.env.SEED_COMPANY_NAME || 'Harbour Homes',
    companySlug: process.env.SEED_COMPANY_SLUG || 'harbour-homes',
    companyEmail: process.env.SEED_COMPANY_EMAIL || 'hello@harbourhomes.test',
    adminName: process.env.SEED_ADMIN_NAME || 'Avery Stone',
    adminEmail: process.env.SEED_ADMIN_EMAIL || '',
    adminPassword: process.env.SEED_ADMIN_PASSWORD || '',
    currency: process.env.SEED_CURRENCY || 'USD',
    timezone: process.env.SEED_TIMEZONE || 'UTC',
    dateFormat: process.env.SEED_DATE_FORMAT || 'YYYY-MM-DD',
    numberDecimals: Number(process.env.SEED_NUMBER_DECIMALS || 2),
  },
};

export function assertProductionConfig() {
  if (!config.isProduction) return;
  if (!config.sessionSecret) {
    throw new Error('SESSION_SECRET must be set in production.');
  }
}
