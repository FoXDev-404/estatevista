const STORAGE_BASE = 'https://qhwcvwbgkvjwbryelexf.supabase.co/storage/v1/object/public/property-images';

export const locations = [
  {
    city: 'Mumbai',
    note: 'Sea-facing living, old-world pockets and a restless cultural pulse.',
    image: `${STORAGE_BASE}/property-1.jpg`,
  },
  {
    city: 'Delhi',
    note: 'Leafy avenues, storied addresses and a quieter kind of capital life.',
    image: `${STORAGE_BASE}/property-10.jpg`,
  },
  {
    city: 'Bengaluru',
    note: 'Garden neighbourhoods, modern architecture and an easy creative energy.',
    image: `${STORAGE_BASE}/property-7.jpg`,
  },
  {
    city: 'Goa',
    note: 'Coastal villas, courtyard homes and a gentler measure of time.',
    image: `${STORAGE_BASE}/property-4.jpg`,
  },
  {
    city: 'Jaipur',
    note: 'Haveli proportions, warm stone and the poetry of a pink city.',
    image: `${STORAGE_BASE}/property-16.jpg`,
  },
  {
    city: 'Pune',
    note: 'Culture, green hills and a considered pace just beyond the city.',
    image: `${STORAGE_BASE}/property-19.jpg`,
  },
];

export default locations;
