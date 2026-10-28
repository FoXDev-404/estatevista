import seedProperties from '../data/properties';
import {
  normalizeProperty,
  validatePropertyCollection,
  validatePropertyRecord,
} from './validation';
import { isSupabaseConfigured, requireSupabase } from './supabaseClient';

export const PROPERTY_STORAGE_KEY = 'estatevista.properties.v1';

export class PropertyValidationError extends Error {
  constructor(errors, message = 'The property could not be saved because it contains invalid fields.') {
    super(message);
    this.name = 'PropertyValidationError';
    this.errors = errors;
  }
}

export class PropertyNotFoundError extends Error {
  constructor(id) {
    super(`No property was found with the ID "${id}".`);
    this.name = 'PropertyNotFoundError';
    this.id = id;
  }
}

export class PropertyStorageError extends Error {
  constructor(message = 'Property data could not be saved in this browser.') {
    super(message);
    this.name = 'PropertyStorageError';
  }
}

let memoryStore = null;
let storageFallbackActive = false;

const clone = (value) => JSON.parse(JSON.stringify(value));
const getToday = () => new Date().toISOString().slice(0, 10);

const getStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
};

const readRaw = () => {
  const storage = getStorage();
  if (!storage) return memoryStore;
  try {
    const stored = storage.getItem(PROPERTY_STORAGE_KEY);
    if (storageFallbackActive && stored === null) return memoryStore;
    storageFallbackActive = false;
    if (stored !== null) memoryStore = stored;
    return stored;
  } catch {
    storageFallbackActive = true;
    return memoryStore;
  }
};

const writeRaw = (value) => {
  const storage = getStorage();
  if (!storage) {
    memoryStore = value;
    storageFallbackActive = true;
    return;
  }
  try {
    storage.setItem(PROPERTY_STORAGE_KEY, value);
    memoryStore = value;
    storageFallbackActive = false;
  } catch {
    storageFallbackActive = true;
    throw new PropertyStorageError(
      'Property data could not be saved. Browser storage may be full or unavailable.',
    );
  }
};

const writeCollection = (properties) => {
  writeRaw(JSON.stringify(properties));
};

const initializeSeeds = () => {
  const seeds = clone(seedProperties);
  try {
    writeCollection(seeds);
  } catch {
    memoryStore = JSON.stringify(seeds);
  }
  return seeds;
};

export const getAll = () => {
  const raw = readRaw();

  if (raw === null) return initializeSeeds();

  try {
    const parsed = JSON.parse(raw);
    const validation = validatePropertyCollection(parsed);
    if (!validation.isValid) return initializeSeeds();
    return parsed;
  } catch {
    // Malformed or incompatible data is replaced with the known-good seed
    // collection. Valid saved properties are never overwritten.
    return initializeSeeds();
  }
};

export const getById = (id) => {
  if (!id) return null;
  const normalizedId = String(id).trim().toUpperCase();
  return getAll().find((property) => property.id === normalizedId) || null;
};

export const getBySlug = (slug) => {
  if (!slug) return null;
  const normalizedSlug = String(slug).trim().toLowerCase();
  return getAll().find((property) => property.slug === normalizedSlug) || null;
};

export const generatePropertyId = (properties = []) => {
  const highest = properties.reduce((max, property) => {
    const match = /^PROP-(\d+)$/.exec(property.id || '');
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `PROP-${String(highest + 1).padStart(3, '0')}`;
};

export const create = (input) => {
  const all = getAll();
  const now = getToday();
  const property = normalizeProperty({
    ...input,
    id: input?.id || generatePropertyId(all),
    createdAt: input?.createdAt || now,
    currency: input?.currency || 'INR',
    status: input?.status || 'available',
  });

  const validation = validatePropertyRecord(property, { properties: all });
  if (!validation.isValid) {
    throw new PropertyValidationError(validation.errors);
  }

  const next = [...all, property];
  writeCollection(next);
  return clone(property);
};

export const update = (id, updates) => {
  const all = getAll();
  const normalizedId = String(id).trim().toUpperCase();
  const index = all.findIndex((property) => property.id === normalizedId);
  if (index === -1) throw new PropertyNotFoundError(normalizedId);

  const existing = all[index];
  const candidate = normalizeProperty({
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    currency: existing.currency || 'INR',
  });

  const validation = validatePropertyRecord(candidate, {
    properties: all,
    ignoreId: existing.id,
  });
  if (!validation.isValid) {
    throw new PropertyValidationError(validation.errors);
  }

  const next = all.map((property, propertyIndex) =>
    propertyIndex === index ? candidate : property,
  );
  writeCollection(next);
  return clone(candidate);
};

export const remove = (id) => {
  const all = getAll();
  const normalizedId = String(id).trim().toUpperCase();
  const existing = all.find((property) => property.id === normalizedId);
  if (!existing) throw new PropertyNotFoundError(normalizedId);

  const next = all.filter((property) => property.id !== normalizedId);
  writeCollection(next);
  return clone(existing);
};

export const reset = () => {
  const seeds = clone(seedProperties);
  writeCollection(seeds);
  return seeds;
};

export const getSeedProperties = () => clone(seedProperties);

const toDatabaseProperty = (property) => ({
  id: property.id,
  slug: property.slug,
  title: property.title,
  type: property.type,
  purpose: property.purpose,
  price: property.price,
  currency: property.currency,
  location: property.location,
  specifications: property.specifications,
  images: property.images,
  description: property.description,
  amenities: property.amenities,
  facilities: property.facilities,
  status: property.status,
  featured: property.featured,
  trending: property.trending,
  created_at: property.createdAt,
});

const fromDatabaseProperty = (record) =>
  normalizeProperty({
    id: record.id,
    slug: record.slug,
    title: record.title,
    type: record.type,
    purpose: record.purpose,
    price: Number(record.price),
    currency: record.currency,
    location: record.location,
    specifications: record.specifications,
    images: record.images || [],
    description: record.description,
    amenities: record.amenities || [],
    facilities: record.facilities || [],
    status: record.status,
    featured: record.featured,
    trending: record.trending,
    createdAt: record.created_at,
  });

const throwDatabaseError = (error, fallback) => {
  if (!error) return;
  const message = error.code === '42501'
    ? 'You are not authorized to change property data.'
    : error.message || fallback;
  throw new PropertyStorageError(message);
};

const getRemoteProperties = async ({ admin = false } = {}) => {
  const client = requireSupabase();
  let query = client.from('properties').select('*').order('created_at', { ascending: false });
  if (!admin) query = query.eq('status', 'available');
  const { data, error } = await query;
  throwDatabaseError(error, 'Property data could not be loaded from Supabase.');
  return (data || []).map(fromDatabaseProperty);
};

export const getAllAsync = async ({ admin = false } = {}) => {
  if (!isSupabaseConfigured) return getAll();
  return getRemoteProperties({ admin });
};

export const getByIdAsync = async (id, options) => {
  const properties = await getAllAsync(options);
  const normalizedId = String(id || '').trim().toUpperCase();
  return properties.find((property) => property.id === normalizedId) || null;
};

export const getBySlugAsync = async (slug, options) => {
  const properties = await getAllAsync(options);
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  return properties.find((property) => property.slug === normalizedSlug) || null;
};

export const createAsync = async (input) => {
  if (!isSupabaseConfigured) return create(input);
  const existing = await getRemoteProperties({ admin: true });
  const property = normalizeProperty({
    ...input,
    id: input?.id || generatePropertyId(existing),
    createdAt: input?.createdAt || getToday(),
    currency: input?.currency || 'INR',
    status: input?.status || 'available',
  });
  const validation = validatePropertyRecord(property, { properties: existing });
  if (!validation.isValid) throw new PropertyValidationError(validation.errors);
  const client = requireSupabase();
  const { data, error } = await client
    .from('properties')
    .insert(toDatabaseProperty(property))
    .select()
    .single();
  throwDatabaseError(error, 'The property could not be created.');
  return fromDatabaseProperty(data);
};

export const updateAsync = async (id, updates) => {
  if (!isSupabaseConfigured) return update(id, updates);
  const existing = await getByIdAsync(id, { admin: true });
  if (!existing) throw new PropertyNotFoundError(id);
  const all = await getRemoteProperties({ admin: true });
  const candidate = normalizeProperty({
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    currency: existing.currency || 'INR',
  });
  const validation = validatePropertyRecord(candidate, {
    properties: all,
    ignoreId: existing.id,
  });
  if (!validation.isValid) throw new PropertyValidationError(validation.errors);
  const client = requireSupabase();
  const { data, error } = await client
    .from('properties')
    .update(toDatabaseProperty(candidate))
    .eq('id', existing.id)
    .select()
    .single();
  throwDatabaseError(error, 'The property could not be updated.');
  return fromDatabaseProperty(data);
};

export const removeAsync = async (id) => {
  if (!isSupabaseConfigured) return remove(id);
  const existing = await getByIdAsync(id, { admin: true });
  if (!existing) throw new PropertyNotFoundError(id);
  const client = requireSupabase();
  const { error } = await client.from('properties').delete().eq('id', existing.id);
  throwDatabaseError(error, 'The property could not be deleted.');
  return existing;
};

export const resetAsync = async () => {
  if (!isSupabaseConfigured) return reset();
  const client = requireSupabase();
  const { data, error } = await client.rpc('reset_properties_to_seed', {
    seed_records: seedProperties.map(toDatabaseProperty),
  });
  throwDatabaseError(error, 'The shared property collection could not be reset.');
  return (data || []).map(fromDatabaseProperty);
};

export const exportLocalProperties = () => {
  const properties = getAll();
  return JSON.stringify({ exportedAt: new Date().toISOString(), properties }, null, 2);
};

export const importPropertiesAsync = async (records, { conflict = 'skip' } = {}) => {
  const validation = validatePropertyCollection(records);
  if (!validation.isValid) throw new PropertyValidationError(validation.errors);
  const current = isSupabaseConfigured ? await getRemoteProperties({ admin: true }) : getAll();
  const existingIds = new Set(current.map((property) => property.id));
  const existingSlugs = new Set(current.map((property) => property.slug));
  const candidates = records.filter((property) => {
    const duplicate = existingIds.has(property.id) || existingSlugs.has(property.slug);
    return !duplicate || conflict === 'overwrite';
  });
  if (!isSupabaseConfigured) {
    const next = conflict === 'overwrite'
      ? records
      : [...current, ...candidates.filter((property) => !existingIds.has(property.id))];
    writeCollection(next);
    return { inserted: candidates.length, skipped: records.length - candidates.length, failed: 0 };
  }
  const client = requireSupabase();
  const { error } = await client
    .from('properties')
    .upsert(candidates.map(toDatabaseProperty), { onConflict: 'id' });
  throwDatabaseError(error, 'Imported property records could not be saved.');
  return { inserted: candidates.length, skipped: records.length - candidates.length, failed: 0 };
};

const propertyRepository = {
  storageKey: PROPERTY_STORAGE_KEY,
  getAll,
  readAll: getAll,
  getById,
  getBySlug,
  create,
  update,
  remove,
  delete: remove,
  reset,
  generatePropertyId,
  getSeedProperties,
  getAllAsync,
  getByIdAsync,
  getBySlugAsync,
  createAsync,
  updateAsync,
  removeAsync,
  resetAsync,
  exportLocalProperties,
  importPropertiesAsync,
};

export default propertyRepository;
