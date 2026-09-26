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
      src: '/site-progress/suraksha/suraksha-enclave-gate.jpg',
      alt: 'Suraksha Enclave entrance gate, Sector 15, Ganaur',
      label: 'Township entrance',
      title: 'Suraksha Enclave, named at the gate',
      note: 'The entrance gate of Suraksha Enclave itself, on Sector 15 in Ganaur — not a render, the actual street frontage.',
    },
    {
      src: '/site-progress/suraksha/suraksha-gate-arch.jpg',
      alt: 'Welcome arch at the entrance to Divine City, where Suraksha Enclave is built',
      label: 'Township entrance',
      title: 'The gateway to the community',
      note: 'The arrival arch marking the entrance to Divine City, the larger township Suraksha Enclave is part of.',
    },
    {
      src: '/site-progress/suraksha/suraksha-divine-city-entrance.jpg',
      alt: 'Wide view of the Divine City entrance canopy with landscaped roads on both sides',
      label: 'Township entrance',
      title: 'A landmark arrival into Divine City',
      note: 'The broad entrance canopy and landscaped approach roads that welcome residents and visitors into the township.',
    },
    {
      src: '/site-progress/suraksha/suraksha-internal-road-block-b.jpg',
      alt: 'Internal plotted road with Block-B signage inside the township',
      label: 'Plotted layout',
      title: 'Blocks, roads and plots — laid out',
      note: 'Internal roads and block signage inside the township, the plotted layout Suraksha Enclave shares.',
    },
    {
      src: '/site-progress/suraksha/suraksha-plotted-road.jpg',
      alt: 'Tree-lined internal road with streetlights and hedges inside Suraksha Enclave',
      label: 'Plotted layout',
      title: 'Wide roads, already lit and landscaped',
      note: 'A finished internal road with streetlights, kerbing and hedge planting — infrastructure in place, not on paper.',
    },
    {
      src: '/site-progress/suraksha/suraksha-aerial-layout.jpg',
      alt: 'Elevated view over the plotted road network and demarcated plots at Suraksha Enclave',
      label: 'Plotted layout',
      title: 'The layout, seen from above',
      note: 'An elevated view over the finished road grid and demarcated plots — the scale of what is already on ground.',
    },
    {
      src: '/site-progress/suraksha/suraksha-sales-office.jpg',
      alt: 'Suraksha Enclave sales office building with ground-floor retail',
      label: 'Commercial plaza',
      title: 'A sales office you can walk into',
      note: "Suraksha Enclave's own sales office and ground-floor retail, standing on site rather than a rendered lobby.",
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
    {
      src: '/site-progress/suraksha/suraksha-park-pathway.jpg',
      alt: 'Checkerboard-tiled pathway through manicured hedges leading into a landscaped lawn',
      label: 'Community spaces',
      title: 'A park, not a promise',
      note: 'A finished walkway through manicured hedges into the community lawn — landscaping that already exists on site.',
    },
    {
      src: '/site-progress/suraksha/suraksha-park-plaza.jpg',
      alt: 'Elevated paved plaza overlooking a landscaped lawn with garden benches',
      label: 'Community spaces',
      title: 'A green space built for evenings out',
      note: 'A tiered plaza opening onto the community lawn, with garden benches and mature tree cover already in place.',
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
