export const mainNavigation = [
  { label: 'Home', to: '/' },
  { label: 'Properties', to: '/properties' },
  { label: 'About', to: '/about' },
  { label: 'Services', to: '/services' },
  { label: 'Contact', to: '/contact' },
];

export const footerNavigation = [
  {
    title: 'Explore',
    links: [
      { label: 'Home', to: '/' },
      { label: 'All properties', to: '/properties' },
      { label: 'About EstateVista', to: '/about' },
      { label: 'Our services', to: '/services' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    title: 'Property types',
    links: [
      { label: 'Apartments', to: '/properties?type=apartment' },
      { label: 'Independent houses', to: '/properties?type=house' },
      { label: 'Villas', to: '/properties?type=villa' },
      { label: 'Residential plots', to: '/properties?type=plot' },
      { label: 'Commercial spaces', to: '/properties?type=commercial' },
    ],
  },
  {
    title: 'Browse by purpose',
    links: [
      { label: 'Properties for sale', to: '/properties?purpose=sale' },
      { label: 'Properties for rent', to: '/properties?purpose=rent' },
      { label: 'Featured residences', to: '/properties?featured=true' },
      { label: 'Property studio', to: '/admin/properties' },
    ],
  },
];
