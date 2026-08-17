export type MapLocation = {
  label: string;
  query: string;
};

export const siteMapLocations: MapLocation[] = [
  {
    label: 'Karnal',
    query:
      'OPS Divine Greens, Village Gangar and Shamgarh, Tehsil Nilokheri, Sec-16, Taraori, Karnal, Haryana 132116',
  },
  {
    label: 'Ganaur',
    query: 'Suraksha Enclave, Village Garhi Kesri and Brahi, Sector 15, Ganaur, Sonipat, Haryana',
  },
  {
    label: 'Kurukshetra',
    query: 'Divine City Centre, Opposite New Bus Stand, Pipli Road, Kurukshetra, Haryana 136118',
  },
];

export const corporateOfficeLocation: MapLocation = {
  label: 'Corporate office',
  query: 'Divine Vision Infratech Pvt Ltd, Universal Trade Tower, Sector 49, Gurugram, Haryana 122018',
};

export function getGoogleMapsSearchHref(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
