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
    { label: 'Instagram', icon: 'Camera', url: '' },
    { label: 'LinkedIn', icon: 'BriefcaseBusiness', url: '' },
    { label: 'Pinterest', icon: 'Pin', url: '' },
  ],
  map: {
    embedUrl: '',
    title: 'EstateVista demonstration office location',
    note: 'A map will appear here once a verified office location and embed URL are configured.',
  },
};

export default contactDetails;
