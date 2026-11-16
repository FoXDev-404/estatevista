const API_BASE = '/api';

export class ApiError extends Error {
  constructor(message, { status = 0, fields = null, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}

function readCookie(name) {
  if (typeof document === 'undefined' || !document.cookie) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Fetch wrapper for the EstateVista API. Sends the readable CSRF cookie on
 * state-changing requests and turns `{ error, fields }` responses into an
 * ApiError so forms can show field-level feedback.
 */
export async function apiRequest(
  path,
  { method = 'GET', body, headers = {}, signal, timeout } = {},
) {
  const verb = method.toUpperCase();
  const requestHeaders = { Accept: 'application/json', ...headers };

  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';

  if (!['GET', 'HEAD', 'OPTIONS'].includes(verb)) {
    const csrfToken = readCookie('ev_csrf');
    if (csrfToken) requestHeaders['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: verb,
    credentials: 'same-origin',
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: signal || (timeout ? AbortSignal.timeout(timeout) : undefined),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    throw new ApiError(payload?.error || payload?.message || `Request failed (${response.status}).`, {
      status: response.status,
      fields: payload?.fields || null,
      data: payload,
    });
  }

  return payload;
}

export default apiRequest;
