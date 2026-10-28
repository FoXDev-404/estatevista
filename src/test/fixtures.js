const baseProperty = {
  id: 'PROP-101',
  slug: 'test-property-101',
  title: 'Test Property',
  type: 'apartment',
  purpose: 'sale',
  price: 10000000,
  currency: 'INR',
  location: {
    city: 'Mumbai',
    area: 'Worli',
    address: '1 Test Lane, Worli, Mumbai 400018',
  },
  specifications: {
    bedrooms: 2,
    bathrooms: 2,
    area: 1200,
    areaUnit: 'sqft',
  },
  images: ['/images/property-1.jpg'],
  description:
    'A considered test property with generous light, a calm plan and a private outlook.',
  amenities: ['Concierge'],
  facilities: ['Covered parking'],
  status: 'available',
  featured: false,
  trending: false,
  createdAt: '2026-01-01',
};

/**
 * Build a complete canonical property record while allowing nested overrides.
 * Passing `undefined` for a key leaves the base value intact.
 */
export const makeProperty = (overrides = {}) => {
  const { location, specifications, ...rest } = overrides;
  const clean = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );

  return {
    ...baseProperty,
    ...clean,
    location: { ...baseProperty.location, ...(location || {}) },
    specifications: { ...baseProperty.specifications, ...(specifications || {}) },
  };
};

export const makeProperties = () => [
  makeProperty({
    id: 'PROP-101',
    slug: 'test-apartment-worli',
    title: 'Sea View Apartment',
    price: 10000000,
    featured: true,
    trending: true,
    createdAt: '2026-01-01',
    amenities: ['Sea view', 'Concierge'],
  }),
  makeProperty({
    id: 'PROP-102',
    slug: 'test-villa-bandra',
    title: 'Bandra Courtyard Villa',
    type: 'villa',
    price: 50000000,
    location: { city: 'Mumbai', area: 'Bandra', address: '2 Palm Road, Bandra' },
    featured: true,
    createdAt: '2026-03-01',
  }),
  makeProperty({
    id: 'PROP-103',
    slug: 'test-house-goa',
    title: 'Goa Garden House',
    type: 'house',
    purpose: 'rent',
    price: 500000,
    location: { city: 'Goa', area: 'Assagao', address: '3 Almond Lane, Assagao' },
    trending: true,
    createdAt: '2026-02-01',
  }),
  makeProperty({
    id: 'PROP-104',
    slug: 'test-sold-apartment',
    title: 'Sold City Apartment',
    price: 20000000,
    featured: true,
    status: 'sold',
    createdAt: '2025-01-01',
  }),
  makeProperty({
    id: 'PROP-105',
    slug: 'test-plot-mumbai',
    title: 'Mumbai Residential Plot',
    type: 'plot',
    price: 3000000,
    location: { city: 'Mumbai', area: 'Powai', address: '5 Lake Road, Powai, Mumbai 400076' },
    specifications: { bedrooms: 0, bathrooms: 0, area: 2400, areaUnit: 'sqft' },
    createdAt: '2024-01-01',
  }),
];
