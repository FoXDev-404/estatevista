export const contactDetails = {
  isDemo: true,
  note: 'All contact details are demonstration placeholders. They do not belong to a real business and no message is sent from this website.',
  phone: {
    label: '+91 90000 00000',
    href: 'tel:+919000000000',
  },
  email: {
    label: 'hello@estatevista.example',
    href: 'mailto:hello@estatevista.example',
  },
  address: {
    label: 'Demonstration office',
    lines: ['Level 4, 12 Sample Avenue', 'Bandra West, Mumbai 400050', 'India'],
  },
  hours: [
    { label: 'Monday – Friday', value: '10:00 – 18:30 IST' },
    { label: 'Saturday', value: '10:00 – 14:00 IST' },
    { label: 'Sunday', value: 'By appointment' },
  ],
  socials: [
    { label: 'Instagram', icon: 'Camera', url: 'https://www.instagram.com/' },
    { label: 'LinkedIn', icon: 'BriefcaseBusiness', url: 'https://www.linkedin.com/' },
    { label: 'Pinterest', icon: 'Pin', url: 'https://www.pinterest.com/' },
  ],
  map: {
    embedUrl:
      'https://www.openstreetmap.org/export/embed.html?bbox=72.818%2C18.998%2C72.846%2C19.025&layer=mapnik&marker=19.014%2C72.832',
    title: 'EstateVista demonstration office location',
    note: 'Demonstration map centred on the sample Bandra West office location.',
  },
};

export default contactDetails;
