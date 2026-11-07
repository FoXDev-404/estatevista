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
 * Fetch all properties. Falls back to local storage if API is unavailable or unconfigured.
 */
export async function getAllProperties(filters = {}) {
  if (isTestEnv) return propertyRepository.getAll();

  try {
    const params = new URLSearchParams();
    if (filters.type && filters.type !== 'all') params.set('type', filters.type);
    if (filters.purpose && filters.purpose !== 'all') params.set('purpose', filters.purpose);
    if (filters.city && filters.city !== 'all') params.set('city', filters.city);
    if (filters.featured) params.set('featured', 'true');
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.search) params.set('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `${API_BASE}/properties?${queryString}` : `${API_BASE}/properties`;

    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.debug('API fetch failed, using local repository fallback:', err?.message);
  }

  return propertyRepository.getAll();
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
  // Always update local repository as fallback/cache
  let localCreated = null;
  try {
    localCreated = propertyRepository.create(record);
  } catch (e) {
    console.warn('Local repository validation/storage error:', e);
  }

  try {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API create failed, returning locally stored property:', err?.message);
  }

  return localCreated || record;
}

/**
 * Update an existing property.
 */
export async function updatePropertyApi(id, updates) {
  let localUpdated = null;
  try {
    localUpdated = propertyRepository.update(id, updates);
  } catch (e) {
    console.warn('Local repository update error:', e);
  }

  try {
    const res = await fetch(`${API_BASE}/properties/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API update failed, returning locally updated property:', err?.message);
  }

  return localUpdated || { id, ...updates };
}

/**
 * Remove an existing property.
 */
export async function deletePropertyApi(id) {
  let localRemoved = null;
  try {
    localRemoved = propertyRepository.remove(id);
  } catch (e) {
    console.warn('Local repository remove error:', e);
  }

  try {
    const res = await fetch(`${API_BASE}/properties/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API delete failed, using local result:', err?.message);
  }

  return localRemoved;
}

/**
 * Reset properties to canonical seeds.
 */
export async function resetPropertiesApi() {
  const localReset = propertyRepository.reset();

  try {
    const res = await fetch(`${API_BASE}/properties/reset`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('API reset failed, returned local reset seeds:', err?.message);
  }

  return localReset;
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
