export interface ConnectivityItem {
  label: string;
  value: string;
  /**
   * Optional photo of the actual landmark, shown in a hover / tap card so a
   * buyer can eyeball the real school, hospital or station rather than trust a
   * name and a drive time. `src` points at a file under `public/landmarks/`;
   * a missing file just means no card is shown for that row.
   */
  photo?: {
    src: string;
    alt: string;
    blurb?: string;
    /** Shown small under the photo — required when the image is CC BY-SA etc. */
    credit?: string;
  };
}

export interface TownshipLocation {
  id: 'ops-divine-greens' | 'suraksha-enclave';
  label: string;
  subtitle: string;
  mapQuery: string;
  connectivity: ConnectivityItem[];
}

/**
 * Drive times are estimates pulled from public listings for each project
 * (99acres for OPS Divine Greens, the developer's own site for Suraksha
 * Enclave) — verify with the sales desk before treating them as exact.
 */
export const townshipLocations: TownshipLocation[] = [
  {
    id: 'ops-divine-greens',
    label: 'OPS Divine Greens',
    subtitle: 'Sector 16, Karnal · Bang on NH-1',
    mapQuery:
      'OPS Divine Greens, Village Gangar and Shamgarh, Tehsil Nilokheri, Sec-16, Taraori, Karnal, Haryana 132116',
    connectivity: [
      {
        label: 'NH-1 highway',
        value: 'Bang on',
        photo: {
          src: '/landmarks/nh1.jpg',
          alt: 'OPS Divine Greens hoarding on NH-1 near Karnal',
          blurb: 'The township fronts the Delhi–Chandigarh highway directly.',
        },
      },
      {
        label: 'Karnal Haveli',
        value: '~4 min',
        photo: {
          src: '/landmarks/karnal-haveli.jpg',
          alt: 'Karnal Haveli banquet and hotel venue on NH-44',
          blurb: 'Heritage-style banquet and hotel venue right on the highway.',
        },
      },
      {
        label: 'Park Hospital',
        value: '~12 min',
        photo: {
          src: '/landmarks/park-hospital-karnal.jpg',
          alt: 'Park Hospital, Karnal',
          blurb: 'Multi-specialty hospital with 24x7 emergency, ICU and trauma care.',
        },
      },
      {
        label: 'DPS Karnal',
        value: '~13 min',
        photo: {
          src: '/landmarks/dps-karnal.jpg',
          alt: 'Delhi Public School, Karnal campus',
          blurb: 'Delhi Public School — CBSE, pre-primary through class XII.',
        },
      },
      {
        label: 'Karnal railway station',
        value: '~17 min',
        photo: {
          src: '/landmarks/karnal-railway-station.jpg',
          alt: 'Karnal railway station building',
          blurb: 'On the Delhi–Ambala line; Shatabdi and Vande Bharat trains halt here.',
          credit: 'Photo: Keshavv1234, CC BY-SA 4.0 (cropped)',
        },
      },
    ],
  },
  {
    id: 'suraksha-enclave',
    label: 'Suraksha Enclave',
    subtitle: 'Sector 15, Ganaur · Sonipat',
    mapQuery: 'Suraksha Enclave, Village Garhi Kesri and Brahi, Sector 15, Ganaur, Sonipat, Haryana',
    connectivity: [
      { label: 'NH-1 highway', value: '~5 min' },
      { label: 'Delhi border', value: '~25 min' },
      {
        label: 'Ganaur railway station',
        value: 'Nearby',
        photo: {
          src: '/landmarks/ganaur-railway-station.jpg',
          alt: 'Ganaur railway station platform',
          blurb: 'On the Delhi–Panipat suburban line for a quick city commute.',
        },
      },
      { label: 'Hospitals nearby', value: '3' },
      { label: 'Schools nearby', value: '5' },
    ],
  },
];
