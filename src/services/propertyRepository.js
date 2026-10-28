import seedProperties from '../data/properties';
import {
  normalizeProperty,
  validatePropertyCollection,
  validatePropertyRecord,
} from './validation';

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
};

export default propertyRepository;
