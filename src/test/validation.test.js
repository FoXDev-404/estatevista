import { describe, expect, it } from 'vitest';
import {
  normalizeProperty,
  slugify,
  validatePropertyCollection,
  validatePropertyRecord,
} from '../services/validation';
import {
  emptyPropertyFormValues,
  formValuesToProperty,
  isPropertyFormDirty,
  propertyToFormValues,
  validatePropertyForm,
} from '../services/propertyForm';
import { makeProperties, makeProperty } from './fixtures';

describe('validation', () => {
  it('slugifies accents, ampersands and punctuation', () => {
    expect(slugify('Café & Résidence — Mumbai')).toBe('cafe-and-residence-mumbai');
    expect(slugify('  A  double   spaced  title  ')).toBe('a-double-spaced-title');
    expect(slugify('!!!')).toBe('');
    expect(slugify('a'.repeat(120))).toHaveLength(90);
  });

  it('normalizes a record into the canonical shape', () => {
    const normalized = normalizeProperty({
      id: ' prop-77 ',
      slug: ' THE-SLUG ',
      title: '  A Title  ',
      type: ' VILLA ',
      purpose: ' SALE ',
      price: '5000000',
      location: { city: ' Mumbai ', area: ' Worli ', address: ' 1 Lane ' },
      specifications: { bedrooms: '4', bathrooms: 3, area: '2200', areaUnit: 'SQFT' },
      images: [' /images/a.jpg ', ''],
      amenities: [' Pool ', ''],
      facilities: undefined,
      status: ' AVAILABLE ',
      featured: true,
      trending: false,
      createdAt: '2026-01-02',
    });

    expect(normalized).toMatchObject({
      id: 'PROP-77',
      slug: 'the-slug',
      title: 'A Title',
      type: 'villa',
      purpose: 'sale',
      price: 5000000,
      currency: 'INR',
      location: { city: 'Mumbai', area: 'Worli', address: '1 Lane' },
      specifications: { bedrooms: 4, bathrooms: 3, area: 2200, areaUnit: 'sqft' },
      images: ['/images/a.jpg'],
      amenities: ['Pool'],
      facilities: [],
      status: 'available',
      featured: true,
      trending: false,
    });
  });

  it('accepts a complete canonical record', () => {
    expect(validatePropertyRecord(makeProperty())).toEqual({ isValid: true, errors: {} });
  });

  it('reports field-level problems', () => {
    const result = validatePropertyRecord(
      makeProperty({
        id: 'lower case',
        slug: 'Not A Slug',
        title: 'A',
        type: 'castle',
        purpose: 'lease',
        price: -5,
        location: { city: '', area: '', address: '' },
        specifications: { bedrooms: 1.5, bathrooms: -1, area: 0, areaUnit: 'hectares' },
        images: ['not-a-path'],
        description: 'Too short',
        status: 'pending',
        featured: 'yes',
        trending: 'no',
        createdAt: 'not-a-date',
      }),
    );

    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors)).toEqual(
      expect.arrayContaining([
        'id',
        'slug',
        'title',
        'type',
        'purpose',
        'price',
        'city',
        'area',
        'address',
        'bedrooms',
        'bathrooms',
        'areaSize',
        'areaUnit',
        'images',
        'description',
        'status',
        'featured',
        'trending',
        'createdAt',
      ]),
    );
  });

  it('rejects duplicate IDs and slugs unless the same record is ignored', () => {
    const properties = makeProperties();
    const candidate = makeProperty({ id: 'PROP-101', slug: 'test-apartment-worli' });

    const duplicate = validatePropertyRecord(candidate, { properties });
    expect(duplicate.errors.id).toMatch(/already in use/i);
    expect(duplicate.errors.slug).toMatch(/already in use/i);

    const editing = validatePropertyRecord(candidate, {
      properties,
      ignoreId: 'PROP-101',
    });
    expect(editing.isValid).toBe(true);
  });

  it('validates whole collections, including duplicate detection', () => {
    expect(validatePropertyCollection(makeProperties()).isValid).toBe(true);
    expect(validatePropertyCollection('nope').isValid).toBe(false);
    expect(validatePropertyCollection([{ id: 'nope' }]).isValid).toBe(false);

    const duplicate = [makeProperty(), makeProperty()];
    const result = validatePropertyCollection(duplicate);

    expect(result.isValid).toBe(false);
    expect(Object.values(result.errors)[0]).toMatch(/Duplicate property ID/);
  });

  it('converts between records and admin form values', () => {
    const property = makeProperty();
    const values = propertyToFormValues(property);

    expect(values).toMatchObject({
      title: property.title,
      slug: property.slug,
      price: '10000000',
      city: 'Mumbai',
      bedrooms: '2',
      areaSize: '1200',
      images: '/images/property-1.jpg',
      amenities: 'Concierge',
      facilities: 'Covered parking',
    });
    expect(propertyToFormValues(null)).toEqual(emptyPropertyFormValues);
  });

  it('builds a normalized property from form values', () => {
    const property = formValuesToProperty(
      {
        ...emptyPropertyFormValues,
        title: 'The New Courtyard House',
        price: '5000000',
        city: 'Pune',
        area: 'Koregaon Park',
        address: '8 Lane Seven, Pune 411001',
        bedrooms: '3',
        bathrooms: '3',
        areaSize: '1800',
        description:
          'A calm new courtyard house with a deep verandah, filtered light and a private garden.',
        images: '/images/property-1.jpg\n\n  /images/property-2.jpg  ',
        amenities: 'Pool\nGym',
        facilities: 'Power backup',
      },
      { id: 'PROP-050', createdAt: '2026-02-01' },
    );

    expect(property).toMatchObject({
      id: 'PROP-050',
      slug: 'the-new-courtyard-house',
      price: 5000000,
      images: ['/images/property-1.jpg', '/images/property-2.jpg'],
      amenities: ['Pool', 'Gym'],
      facilities: ['Power backup'],
      createdAt: '2026-02-01',
    });
  });

  it('validates admin form values with price-specific rules', () => {
    const validValues = {
      ...emptyPropertyFormValues,
      title: 'The New Courtyard House',
      price: '5000000',
      city: 'Pune',
      area: 'Koregaon Park',
      address: '8 Lane Seven, Pune 411001',
      areaSize: '1800',
      description:
        'A calm new courtyard house with a deep verandah, filtered light and a private garden.',
    };

    expect(validatePropertyForm(validValues, { properties: makeProperties() }).isValid).toBe(true);

    const zeroPrice = validatePropertyForm(
      { ...validValues, price: '0' },
      { properties: makeProperties() },
    );
    expect(zeroPrice.isValid).toBe(false);
    expect(zeroPrice.errors.price).toMatch(/greater than zero/i);

    const emptyPrice = validatePropertyForm(
      { ...validValues, price: '' },
      { properties: makeProperties() },
    );
    expect(emptyPrice.errors.price).toBe('Enter a price.');

    const duplicate = validatePropertyForm(
      { ...validValues, slug: 'test-apartment-worli' },
      { properties: makeProperties() },
    );
    expect(duplicate.errors.slug).toMatch(/already in use/i);
  });

  it('detects dirty form values', () => {
    const initial = { ...emptyPropertyFormValues };
    expect(isPropertyFormDirty(initial, initial)).toBe(false);
    expect(isPropertyFormDirty({ ...initial, title: 'Changed' }, initial)).toBe(true);
  });
});
