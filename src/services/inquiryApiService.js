import { apiRequest } from './apiClient';

function queryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

/**
 * Generates a per-submission key so a double click or retry cannot create a
 * second inquiry or lead.
 */
export function createSubmissionKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `submission-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function publicSourcePage() {
  if (typeof window === 'undefined') return null;
  return `${window.location.pathname}${window.location.search}`.slice(0, 500);
}

export async function submitPublicInquiry(values) {
  return apiRequest('/public/inquiries', {
    method: 'POST',
    body: values,
    timeout: 8000,
  });
}

export async function listWebsiteInquiries(params) {
  const response = await apiRequest(`/website-inquiries${queryString(params)}`);
  return { data: response?.data ?? [], meta: response?.meta ?? null };
}

const inquiryApiService = {
  createSubmissionKey,
  publicSourcePage,
  submitPublicInquiry,
  listWebsiteInquiries,
};

export default inquiryApiService;
