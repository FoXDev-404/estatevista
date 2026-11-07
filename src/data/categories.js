const STORAGE_BASE = 'https://qhwcvwbgkvjwbryelexf.supabase.co/storage/v1/object/public/property-images';

export const propertyCategories = [
  {
    id: 'apartment',
    title: 'Apartments',
    description: 'City residences with light, aspect and considered detail.',
    image: `${STORAGE_BASE}/property-1.jpg`,
    icon: 'Building2',
    href: '/properties?type=apartment',
  },
  {
    id: 'house',
    title: 'Independent houses',
    description: 'Private homes with gardens, courtyards and room to grow.',
    image: `${STORAGE_BASE}/property-9.jpg`,
    icon: 'House',
    href: '/properties?type=house',
  },
  {
    id: 'villa',
    title: 'Villas',
    description: 'Architectural retreats for slower, more generous living.',
    image: `${STORAGE_BASE}/property-4.jpg`,
    icon: 'Trees',
    href: '/properties?type=villa',
  },
  {
    id: 'plot',
    title: 'Residential plots',
    description: 'A blank canvas in established and emerging neighbourhoods.',
    image: `${STORAGE_BASE}/plot-1.jpg`,
    icon: 'LandPlot',
    href: '/properties?type=plot',
  },
  {
    id: 'commercial',
    title: 'Commercial spaces',
    description: 'Distinctive addresses for ambitious businesses.',
    image: `${STORAGE_BASE}/office-1.jpg`,
    icon: 'BriefcaseBusiness',
    href: '/properties?type=commercial',
  },
  {
    id: 'rental',
    title: 'Rentals',
    description: 'Turnkey homes for considered short- and long-term living.',
    image: `${STORAGE_BASE}/property-13.jpg`,
    icon: 'KeyRound',
    href: '/properties?purpose=rent',
  },
];

export default propertyCategories;
