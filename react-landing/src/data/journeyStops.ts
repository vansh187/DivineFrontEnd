import type { JourneyStop } from './types';

export const journeyStops: JourneyStop[] = [
  {
    id: 'delhi-border',
    eyebrow: 'KM 0 — Delhi border',
    heading: 'The drive',
    headingEmphasis: 'starts here.',
    description:
      "Every township we've built since 2005 sits on this one corridor. No speculative land two districts from an announced expressway — plots you can drive to today.",
    bigNumber: { value: '25', unit: 'MIN' },
    image: {
      src: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
      alt: 'Delhi Border Highway Road',
      tag: 'Corridor',
    },
  },
  {
    id: 'suraksha-enclave',
    eyebrow: 'Suraksha Enclave — Sector 15, Ganaur · Sonipat',
    heading: 'Suraksha',
    headingEmphasis: 'Enclave',
    description:
      'DDJAY-approved, 250 metres off the highway. Phase 1 is already occupied — largely by paramilitary families — so the neighbourhood exists before you book.',
    reraId: 'RERA-PKL-890-2020',
    heroSrc: '/townships/suraksha-hero.jpg',
    chips: ['120–180 sq yd', 'DDJAY', '24-hr security', 'Yoga podium', 'Community centre'],
    image: {
      src: '/townships/suraksha-entrance.jpg',
      alt: 'Suraksha Enclave entrance gate',
      tag: 'Site render',
    },
  },
  {
    id: 'ops-divine-greens',
    eyebrow: 'OPS Divine Greens — Karnal · Bang on NH-1',
    heading: 'OPS Divine',
    headingEmphasis: 'Greens',
    description:
      "368 plots around a 24-metre spine road, with the Florence Club, cricket pitch, tennis court, amphitheatre and two children's parks inside the gate. Launched March 2023.",
    reraId: 'HRERA-PKL-KRL-621-2024',
    heroSrc: '/townships/ops-hero.jpg',
    chips: ['125–180 sq yd', '368 plots', 'Florence Club', 'Karnal Haveli 4 min', 'Station 17 min'],
    image: {
      src: '/townships/ops-entrance.jpg',
      alt: 'OPS Divine Greens entrance with fountain plaza',
      tag: 'Site render',
    },
  },
  {
    id: 'kurukshetra',
    eyebrow: 'END OF THE ROAD — Kurukshetra',
    heading: 'Delivered,',
    headingEmphasis: 'every time.',
    description:
      'Divine City Center, The Destination, Presidia Heights, Presidia Royal, the Integrated Township — five handovers between 2007 and 2017, and two townships selling now.',
    bigNumber: { value: '20', unit: 'YRS' },
    chips: ['RERA approved', 'Registry ready', 'Est. 2005'],
    image: {
      src: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
      alt: 'Delivered Township Community View',
      tag: 'Delivered township',
    },
  },
];
