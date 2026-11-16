import propertyRepository from './propertyRepository';
import { apiRequest } from './apiClient';

const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/**
 * Check if the backend API server is online and reachable.
 */
export async function checkApiHealth() {
  if (isTestEnv) return { isAvailable: false, supabaseConfigured: false };
  try {
    const data = await apiRequest('/health', { timeout: 2000 });
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
 * Fetch all properties from the API.
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
  const path = queryString ? `/properties?${queryString}` : '/properties';
  return apiRequest(path, { timeout: 8000 });
}

/**
 * Fetch single property by ID or slug.
 */
export async function getPropertyByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null;
  try {
    return await apiRequest(`/properties/${encodeURIComponent(idOrSlug)}`, { timeout: 3000 });
  } catch {
    // Fall back to the local repository when the API is unavailable.
  }

  const isId = /^PROP-\d+$/i.test(String(idOrSlug).trim());
  return isId ? propertyRepository.getById(idOrSlug) : propertyRepository.getBySlug(idOrSlug);
}

/**
 * Create a new property.
 */
export async function createPropertyApi(record) {
  if (isTestEnv) return propertyRepository.create(record);
  return apiRequest('/properties', { method: 'POST', body: record });
}

/**
 * Update an existing property.
 */
export async function updatePropertyApi(id, updates) {
  if (isTestEnv) return propertyRepository.update(id, updates);
  return apiRequest(`/properties/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: updates,
  });
}

/**
 * Remove an existing property.
 */
export async function deletePropertyApi(id) {
  if (isTestEnv) return propertyRepository.remove(id);
  return apiRequest(`/properties/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * Reset properties to canonical seeds.
 */
export async function resetPropertiesApi() {
  if (isTestEnv) return propertyRepository.reset();
  return apiRequest('/properties/reset', { method: 'POST' });
}

/**
 * Upload an image file to storage via the API.
 */
export async function uploadImageApi(file) {
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return apiRequest('/upload', {
    method: 'POST',
    body: {
      filename: file.name,
      data: base64Data,
    },
  });
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
  uploadImage: uploadImageApi,
};

export default propertyApiService;
