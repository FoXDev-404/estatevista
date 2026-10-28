export const services = [
  {
    id: 'SERVICE-01',
    title: 'Property buying',
    shortDescription: 'A focused search, guided by what matters to you.',
    description:
      'From the first brief to the final handover, we help you evaluate neighbourhoods, compare properties and move forward with clarity. Our process is built around careful listening, honest advice and a shortlist worth your time.',
    image: '/images/service-1.jpg',
    icon: 'KeyRound',
    ctaLabel: 'Browse properties for sale',
    ctaTo: '/properties?purpose=sale',
  },
  {
    id: 'SERVICE-02',
    title: 'Property selling',
    shortDescription: 'Position your property with intelligence and restraint.',
    description:
      'We shape a considered story around your property, advise on presentation and introduce it to the right audience. The result is a sale process that protects your time, your privacy and the value of your asset.',
    image: '/images/service-2.jpg',
    icon: 'TrendingUp',
    ctaLabel: 'Discuss selling your property',
    ctaTo: '/contact?subject=Property%20selling%20consultation',
  },
  {
    id: 'SERVICE-03',
    title: 'Property rental',
    shortDescription: 'Homes and commercial spaces for a new chapter.',
    description:
      'Whether you are relocating, downsizing or expanding, we help match the right space to the life or business you are building. Shortlists are informed by location, lease terms, lifestyle needs and long-term fit.',
    image: '/images/service-3.jpg',
    icon: 'Key',
    ctaLabel: 'Explore rental properties',
    ctaTo: '/properties?purpose=rent',
  },
  {
    id: 'SERVICE-04',
    title: 'Property consultation',
    shortDescription: 'Independent perspective before a significant decision.',
    description:
      'A focused conversation for buyers, sellers and investors who want a second view. We bring structure to questions of value, timing, location and potential, without pressure or a predetermined outcome.',
    image: '/images/service-4.jpg',
    icon: 'MessagesSquare',
    ctaLabel: 'Book a consultation',
    ctaTo: '/contact?subject=Property%20consultation',
  },
  {
    id: 'SERVICE-05',
    title: 'Property management',
    shortDescription: 'Careful stewardship for the home you are not in.',
    description:
      'From tenant coordination to routine upkeep, property management is about consistent attention and clear communication. We help protect the condition and performance of your property over time.',
    image: '/images/service-5.jpg',
    icon: 'ClipboardCheck',
    ctaLabel: 'Enquire about management',
    ctaTo: '/contact?subject=Property%20management',
  },
];

export const serviceProcess = [
  {
    number: '01',
    title: 'Listen',
    description:
      'We begin with a conversation about place, purpose, budget and the life you want the property to support.',
  },
  {
    number: '02',
    title: 'Curate',
    description:
      'A focused shortlist is assembled from the available collection, with the context needed to compare well.',
  },
  {
    number: '03',
    title: 'Consider',
    description:
      'We help you look beyond the listing — at light, layout, location and long-term fit — without pressure.',
  },
  {
    number: '04',
    title: 'Move forward',
    description:
      'When you are ready, we help coordinate the next conversation with the right people and a clear brief.',
  },
];

export default services;
