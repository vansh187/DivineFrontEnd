export interface ProjectSpec {
  label: string;
  value: string;
}

export interface ProjectDetail {
  id: 'ops-divine-greens' | 'suraksha-enclave';
  amenities: string[];
  specs: ProjectSpec[];
}

export const projectDetails: ProjectDetail[] = [
  {
    id: 'ops-divine-greens',
    amenities: [
      'Florence Club',
      'Tennis court',
      'Cricket pitch',
      'Amphitheatre',
      'Cycling track',
      "Two children's parks",
      'Temple',
      'Sewage treatment plant',
    ],
    specs: [
      { label: 'RERA no.', value: 'HRERA-PKL-KRL-621-2024' },
      { label: 'Total plots', value: '368 plots' },
      { label: 'Plot sizes', value: '125–180 sq yd' },
      { label: 'Total area', value: '22 acres' },
    ],
  },
  {
    id: 'suraksha-enclave',
    amenities: [
      '24-hour security',
      'Yoga podium',
      'Jogging track',
      'Community centre',
      'Rainwater harvesting',
      'Shopping arcade',
    ],
    specs: [
      { label: 'RERA no.', value: 'HRERA-PKL-SNP-972-2026' },
      { label: 'Total plots', value: '700 plots' },
      { label: 'Plot sizes', value: '120–180 sq yd' },
      { label: 'Total area', value: '29 acres' },
    ],
  },
];

export function getProjectDetail(id: string): ProjectDetail | undefined {
  return projectDetails.find((project) => project.id === id);
}
