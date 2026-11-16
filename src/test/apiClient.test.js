import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from '../services/apiClient';

function mockResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  };
}

function clearCsrfCookie() {
  document.cookie = 'ev_csrf=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearCsrfCookie();
  });

  it('sends the CSRF cookie on state-changing requests', async () => {
    document.cookie = 'ev_csrf=token-123; path=/';
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/auth/logout', { method: 'POST' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('same-origin');
    expect(options.headers['X-CSRF-Token']).toBe('token-123');
  });

  it('does not send a CSRF header on reads', async () => {
    document.cookie = 'ev_csrf=token-123; path=/';
    const fetchMock = vi.fn().mockResolvedValue(mockResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/properties');

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['X-CSRF-Token']).toBeUndefined();
  });

  it('turns a request timeout into a friendly ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('signal timed out', 'TimeoutError')),
    );

    const error = await apiRequest('/public/inquiries', {
      method: 'POST',
      body: {},
      timeout: 10,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toBe('The request took too long. Please try again.');
  });

  it('turns a field error response into an ApiError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ error: 'Please correct the highlighted fields.', fields: { email: 'Required.' } }, 422),
      );
    vi.stubGlobal('fetch', fetchMock);

    const error = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: '' },
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.fields).toEqual({ email: 'Required.' });
  });
});
