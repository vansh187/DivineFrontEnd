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
      src: '/site-progress/divine-greens/divine-greens-entrance-signage.jpg',
      alt: 'OPS Divine Greens entrance signage in front of the township sales office',
      label: 'Township entrance',
      title: 'OPS Divine Greens, named at the gate',
      note: 'The township sign and sales office standing on site, photographed from above — not a render.',
    },
    {
      src: '/site-progress/divine-greens/divine-greens-entrance-fountain.jpg',
      alt: 'Aerial view of the circular entrance plaza and fountain at OPS Divine Greens',
      label: 'Township entrance',
      title: 'A grand arrival, already built',
      note: 'The circular entrance plaza and fountain, with the main boulevard running straight into the plotted layout beyond.',
    },
    {
      src: '/site-progress/divine-greens/divine-greens-boulevard.jpg',
      alt: 'Aerial view of the main boulevard at OPS Divine Greens with plotted sectors on both sides',
      label: 'Plotted layout',
      title: 'The main boulevard, laid and lit',
      note: 'A finished central boulevard with street lighting and a landscaped median, flanked by demarcated plots on both sides.',
    },
    {
      src: '/site-progress/divine-greens/divine-greens-structure-grid.jpg',
      alt: 'Column footings under construction beside the plotted road grid at OPS Divine Greens',
      label: 'Structure stage',
      title: 'Foundations going in',
      note: 'Column footings and reinforcement visible beside the finished road grid — the build advancing plot by plot.',
    },
    {
      src: '/site-progress/divine-greens/divine-greens-community-park.jpg',
      alt: 'Aerial view of a landscaped park and pool feature between plotted sectors at OPS Divine Greens',
      label: 'Community spaces',
      title: 'A park at the heart of the layout',
      note: 'A landscaped park and reflecting pool set between plotted sectors, with palm-lined walkways already in place.',
    },
    {
      src: '/site-progress/divine-greens/divine-greens-active-build-1.jpg',
      alt: 'Excavator and tractor-trolley working on the internal road at OPS Divine Greens',
      label: 'Active build',
      title: 'Visible work on ground',
      note: 'An excavator and tractor-trolley at work on the internal road, with the finished boulevard and entrance visible beyond.',
    },
    {
      src: '/site-progress/divine-greens/divine-greens-active-build-2.jpg',
      alt: 'Multiple construction vehicles and crew working on plots at OPS Divine Greens',
      label: 'Active build',
      title: 'Crew and machinery on site',
      note: 'Excavator, tractor-trolley and crew working plot-side — ongoing development alongside the completed sections.',
    },
  ],
};

export function siteProgressGalleryFor(townshipId: string | undefined): SiteProgressPhoto[] {
  return (townshipId && siteProgressGalleryByTownship[townshipId]) || [];
}
