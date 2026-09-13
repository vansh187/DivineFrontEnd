export type SiteProgressPhoto = {
  src: string;
  alt: string;
  label: string;
  title: string;
  note: string;
};

/**
 * "Our Work" gallery on each project's detail page — real, on-ground photos,
 * kept strictly per-township. These used to be a single shared array
 * (accidentally showing OPS Divine Greens photos on the Suraksha Enclave
 * page); each township now gets its own dedicated set so that never
 * happens again. Suraksha Enclave (inside Divine City) is listed first —
 * it's also where the gallery's featured photo is pulled from.
 */
export const siteProgressGalleryByTownship: Record<string, SiteProgressPhoto[]> = {
  'suraksha-enclave': [
    {
      src: '/site-progress/suraksha/suraksha-gate-arch.jpg',
      alt: 'Welcome arch at the entrance to Divine City, where Suraksha Enclave is built',
      label: 'Township entrance',
      title: 'The gateway to the community',
      note: 'The arrival arch marking the entrance to Divine City, the larger township Suraksha Enclave is part of.',
    },
    {
      src: '/site-progress/suraksha/suraksha-internal-road-block-b.jpg',
      alt: 'Internal plotted road with Block-B signage inside the township',
      label: 'Plotted layout',
      title: 'Blocks, roads and plots — laid out',
      note: 'Internal roads and block signage inside the township, the plotted layout Suraksha Enclave shares.',
    },
    {
      src: '/site-progress/suraksha/suraksha-commercial-plaza.jpg',
      alt: 'Commercial plaza with real estate offices and retail units near Suraksha Enclave',
      label: 'Commercial plaza',
      title: 'Everyday convenience, close by',
      note: 'A finished commercial block with retail and consultancy offices, part of the surrounding infrastructure.',
    },
    {
      src: '/site-progress/suraksha/suraksha-destination-mall-gate.jpg',
      alt: 'Entrance gate to The Destination Mall near Suraksha Enclave',
      label: 'Retail & leisure',
      title: 'The Destination, minutes away',
      note: 'The Destination Mall entrance — retail, dining and leisure within easy reach of the township.',
    },
    {
      src: '/site-progress/suraksha/suraksha-destination-building.jpg',
      alt: 'The Destination commercial building with retail signage',
      label: 'Retail & leisure',
      title: 'A landmark already built',
      note: 'The Destination itself — multi-brand retail and offices standing a short drive from the township.',
    },
    {
      src: '/site-progress/suraksha/suraksha-presidia-heights-wide.jpg',
      alt: 'Presidia Heights residential towers within the township',
      label: 'Delivered residences',
      title: 'Homes already lived in',
      note: 'Presidia Heights — occupied residential towers standing inside the same township as Suraksha Enclave.',
    },
    {
      src: '/site-progress/suraksha/suraksha-residential-courtyard.jpg',
      alt: 'Landscaped residential courtyard with play area between apartment towers',
      label: 'Community spaces',
      title: 'Landscaped courtyards in daily use',
      note: 'A shared courtyard and play area between residential blocks, framed by mature landscaping.',
    },
  ],
  'ops-divine-greens': [
    {
      src: '/site-progress/construction-6.jpeg',
      alt: 'Large brickwork stage residence under construction along internal township road',
      label: 'Brickwork stage',
      title: 'Crafted elevation in progress',
      note: 'Brickwork, elevation openings and on-site detailing show the build advancing with visible momentum.',
    },
    {
      src: '/site-progress/construction-2.jpeg',
      alt: 'Modern residence facade with finishing work in progress',
      label: 'Facade work',
      title: 'Premium elevation taking shape',
      note: 'Facade cladding, balcony detail and exterior finishing visible on site.',
    },
    {
      src: '/site-progress/construction-1.jpeg',
      alt: 'Ready residence with landscaped frontage inside the township',
      label: 'Ready home',
      title: 'Finished residence frontage',
      note: 'A completed home framed by internal landscaping and plotted-street access.',
    },
    {
      src: '/site-progress/construction-4.jpeg',
      alt: 'Residence structure in grey plaster stage photographed through greenery',
      label: 'Structure stage',
      title: 'Core structure completed',
      note: 'Built form and plot frontage visible before final facade and landscape work.',
    },
    {
      src: '/site-progress/construction-3.jpeg',
      alt: 'Residence structure in grey plaster stage inside the township',
      label: 'Structure stage',
      title: 'Core structure completed',
      note: 'Built form and plot frontage visible before final facade and landscape work.',
    },
    {
      src: '/site-progress/construction-5.jpeg',
      alt: 'Brickwork stage residence construction photographed from the township road',
      label: 'Active build',
      title: 'Visible work on ground',
      note: 'On-site construction progress captured from the internal road frontage.',
    },
    {
      src: '/site-progress/construction-7.jpeg',
      alt: 'Residence structure stage on an internal township road',
      label: 'Active structure',
      title: 'Internal road frontage',
      note: 'A visible structure-stage home set along the township road network.',
    },
  ],
};

export function siteProgressGalleryFor(townshipId: string | undefined): SiteProgressPhoto[] {
  return (townshipId && siteProgressGalleryByTownship[townshipId]) || [];
}
