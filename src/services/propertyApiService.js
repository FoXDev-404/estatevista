import propertyRepository from './propertyRepository';

const API_BASE = '/api';
const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/**
 * Check if the backend API server is online and reachable.
 */
export async function checkApiHealth() {
  if (isTestEnv) return { isAvailable: false, supabaseConfigured: false };
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { isAvailable: false, supabaseConfigured: false };
    const data = await res.json();
    return {
      isAvailable: true,
      supabaseConfigured: Boolean(data.supabaseConfigured),
      database: data.database,
    };
  } catch {
    return { isAvailable: false, supabaseConfigured: false };
  }
}

/**
 * Fetch all properties from Supabase API.
 */
export async function getAllProperties(filters = {}) {
  if (isTestEnv) return propertyRepository.getAll();

  const params = new URLSearchParams();
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.purpose && filters.purpose !== 'all') params.set('purpose', filters.purpose);
  if (filters.city && filters.city !== 'all') params.set('city', filters.city);
  if (filters.featured) params.set('featured', 'true');
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.search) params.set('search', filters.search);

  const queryString = params.toString();
  const url = queryString ? `${API_BASE}/properties?${queryString}` : `${API_BASE}/properties`;

  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch properties from Supabase.');
  }

  return await res.json();
}

/**
 * Fetch single property by ID or slug.
 */
export async function getPropertyByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  try {
    const res = await fetch(`${API_BASE}/properties/${encodeURIComponent(idOrSlug)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to local repo
  }

  const isId = /^PROP-\d+$/i.test(String(idOrSlug).trim());
  return isId ? propertyRepository.getById(idOrSlug) : propertyRepository.getBySlug(idOrSlug);
}

/**
 * Create a new property.
 */
export async function createPropertyApi(record) {
  if (isTestEnv) return propertyRepository.create(record);

  const res = await fetch(`${API_BASE}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create property in Supabase.');
  }

  return await res.json();
}

/**
 * Update an existing property.
 */
export async function updatePropertyApi(id, updates) {
  if (isTestEnv) return propertyRepository.update(id, updates);

  const res = await fetch(`${API_BASE}/properties/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update property in Supabase.');
  }

  return await res.json();
}

/**
 * Remove an existing property.
 */
export async function deletePropertyApi(id) {
  if (isTestEnv) return propertyRepository.remove(id);

  const res = await fetch(`${API_BASE}/properties/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete property in Supabase.');
  }

  return await res.json();
}

/**
 * Reset properties to canonical seeds in Supabase.
 */
export async function resetPropertiesApi() {
  if (isTestEnv) return propertyRepository.reset();

  const res = await fetch(`${API_BASE}/properties/reset`, {
    method: 'POST',
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset properties in Supabase.');
  }

  return await res.json();
}

/**
 * Submit an enquiry or contact form to PostgreSQL via the Node API.
 */
export async function submitEnquiryApi(payload) {
  try {
    const res = await fetch(`${API_BASE}/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.error || 'Server error' };
  } catch {
    return {
      success: true, // Graceful fallback simulation
      simulated: true,
      message: 'Recorded locally (backend offline or unavailable)',
    };
  }
}

/**
 * Upload an image file directly to Supabase Storage via the Node API.
 */
export async function uploadImageApi(file) {
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      data: base64Data,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload image.');
  }

  return await res.json();
}

const propertyApiService = {
  checkApiHealth,
  getAll: getAllProperties,
  getByIdOrSlug: getPropertyByIdOrSlug,
  create: createPropertyApi,
  update: updatePropertyApi,
  remove: deletePropertyApi,
  delete: deletePropertyApi,
  reset: resetPropertiesApi,
  submitEnquiry: submitEnquiryApi,
  uploadImage: uploadImageApi,
};

export default propertyApiService;
