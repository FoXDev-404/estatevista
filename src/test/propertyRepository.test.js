import { beforeEach, describe, expect, it, vi } from 'vitest';
import propertyRepository, {
  PROPERTY_STORAGE_KEY,
  PropertyNotFoundError,
  PropertyStorageError,
  PropertyValidationError,
  create,
  generatePropertyId,
  getAll,
  getById,
  getBySlug,
  remove,
  reset,
  update,
} from '../services/propertyRepository';
import { makeProperty } from './fixtures';

const storedCollection = () => JSON.parse(localStorage.getItem(PROPERTY_STORAGE_KEY));

describe('propertyRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('seeds a complete collection into localStorage on first read', () => {
    expect(localStorage.getItem(PROPERTY_STORAGE_KEY)).toBeNull();

    const properties = getAll();

    expect(properties).toHaveLength(16);
    expect(storedCollection()).toHaveLength(16);
    expect(properties[0]).toMatchObject({
      id: 'PROP-001',
      slug: 'the-arbour-residence-worli',
    });
  });

  it('preserves a valid saved collection instead of reseeding it', () => {
    const saved = [makeProperty({ id: 'PROP-001', slug: 'saved-record' })];
    localStorage.setItem(PROPERTY_STORAGE_KEY, JSON.stringify(saved));

    expect(getAll()).toEqual(saved);
    expect(storedCollection()).toEqual(saved);
  });

  it('preserves a valid empty collection', () => {
    localStorage.setItem(PROPERTY_STORAGE_KEY, '[]');

    expect(getAll()).toEqual([]);
  });

  it('recovers from malformed JSON by reseeding known-good data', () => {
    localStorage.setItem(PROPERTY_STORAGE_KEY, '{"not": "an array"');

    const properties = getAll();

    expect(properties).toHaveLength(16);
    expect(storedCollection()).toHaveLength(16);
  });

  it('recovers when a saved collection contains invalid records', () => {
    localStorage.setItem(
      PROPERTY_STORAGE_KEY,
      JSON.stringify([{ id: 'PROP-001', title: 'Incomplete record' }]),
    );

    expect(getAll()).toHaveLength(16);
  });

  it('finds records by ID and slug without case sensitivity', () => {
    getAll();

    expect(getById('prop-001')?.title).toBe('The Arbour Residence');
    expect(getById('missing')).toBeNull();
    expect(getBySlug('VILLA-AURELIA-ASSAGAO')?.id).toBe('PROP-002');
    expect(getBySlug('missing')).toBeNull();
  });

  it('generates the next stable property reference', () => {
    expect(generatePropertyId([{ id: 'PROP-009' }, { id: 'PROP-012' }, { id: 'OTHER' }])).toBe(
      'PROP-013',
    );
    expect(generatePropertyId([])).toBe('PROP-001');
  });

  it('creates a normalized record and persists it', () => {
    getAll();
    const created = create(
      makeProperty({
        id: null,
        slug: 'harbour-lights-apartment',
        title: '  Harbour Lights Apartment  ',
        price: '12500000',
        createdAt: null,
      }),
    );

    expect(created.id).toBe('PROP-017');
    expect(created.title).toBe('Harbour Lights Apartment');
    expect(created.price).toBe(12500000);
    expect(created.status).toBe('available');
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getById('PROP-017')).toEqual(created);
    expect(storedCollection()).toHaveLength(17);
  });

  it('rejects duplicate IDs', () => {
    getAll();

    expect(() =>
      create(makeProperty({ id: 'PROP-001', slug: 'a-brand-new-slug' })),
    ).toThrow(PropertyValidationError);

    try {
      create(makeProperty({ id: 'PROP-001', slug: 'another-new-slug' }));
    } catch (error) {
      expect(error.errors.id).toMatch(/already in use/i);
    }
  });

  it('rejects duplicate slugs', () => {
    getAll();

    try {
      create(makeProperty({ id: 'PROP-099', slug: 'the-arbour-residence-worli' }));
      throw new Error('Expected create to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PropertyValidationError);
      expect(error.errors.slug).toMatch(/already in use/i);
    }
  });

  it('updates a record while preserving its identity and creation date', () => {
    getAll();
    const before = getById('PROP-001');

    const updated = update('prop-001', {
      title: 'The Arbour Residence, Reimagined',
      price: 70000000,
    });

    expect(updated.id).toBe('PROP-001');
    expect(updated.createdAt).toBe(before.createdAt);
    expect(updated.title).toBe('The Arbour Residence, Reimagined');
    expect(updated.price).toBe(70000000);
    expect(getById('PROP-001')).toEqual(updated);
  });

  it('rejects an update that would duplicate another slug', () => {
    getAll();

    expect(() =>
      update('PROP-001', { slug: 'villa-aurelia-assagao' }),
    ).toThrow(PropertyValidationError);
  });

  it('throws when updating or removing an unknown record', () => {
    getAll();

    expect(() => update('PROP-999', { title: 'Nope' })).toThrow(PropertyNotFoundError);
    expect(() => remove('PROP-999')).toThrow(PropertyNotFoundError);
  });

  it('removes a record from storage', () => {
    getAll();
    const removed = remove('PROP-001');

    expect(removed.id).toBe('PROP-001');
    expect(getById('PROP-001')).toBeNull();
    expect(getAll()).toHaveLength(15);
    expect(storedCollection()).toHaveLength(15);
  });

  it('resets the collection to the original seeds', () => {
    getAll();
    remove('PROP-001');
    expect(getAll()).toHaveLength(15);

    const seeded = reset();

    expect(seeded).toHaveLength(16);
    expect(getAll()).toHaveLength(16);
    expect(storedCollection()).toHaveLength(16);
  });

  it('reports a storage failure instead of silently dropping a write', () => {
    getAll();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() =>
      create(makeProperty({ id: 'PROP-090', slug: 'storage-failure-home' })),
    ).toThrow(PropertyStorageError);

    setItem.mockRestore();
  });

  it('continues reading the last valid collection after storage becomes unavailable', () => {
    const initial = getAll();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() =>
      create(makeProperty({ id: 'PROP-090', slug: 'storage-failure-home' })),
    ).toThrow(PropertyStorageError);
    expect(getAll()).toEqual(initial);

    setItem.mockRestore();
  });

  it('exposes a stable storage key and aliases', () => {
    expect(propertyRepository.storageKey).toBe(PROPERTY_STORAGE_KEY);
    expect(propertyRepository.storageKey).toBe('estatevista.properties.v1');
    expect(propertyRepository.readAll).toBe(getAll);
    expect(propertyRepository.delete).toBe(remove);
  });
});
