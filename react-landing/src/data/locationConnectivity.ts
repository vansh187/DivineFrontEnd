export interface ConnectivityItem {
  label: string;
  value: string;
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
      { label: 'NH-1 highway', value: 'Bang on' },
      { label: 'Karnal Haveli', value: '~4 min' },
      { label: 'Park Hospital', value: '~12 min' },
      { label: 'DPS Karnal', value: '~13 min' },
      { label: 'Karnal railway station', value: '~17 min' },
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
      { label: 'Ganaur railway station', value: 'Nearby' },
      { label: 'Hospitals nearby', value: '3' },
      { label: 'Schools nearby', value: '5' },
    ],
  },
];
