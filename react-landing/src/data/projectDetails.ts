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
      { label: 'Plot sizes', value: '125–180 sq yd' },
      { label: 'Total plots', value: '368' },
      { label: 'Launched', value: 'March 2023' },
      { label: 'Main road', value: '24 metres' },
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
      { label: 'Plot sizes', value: '120–180 sq yd' },
      { label: 'Approval', value: 'DDJAY' },
      { label: 'From NH-1', value: '250 metres' },
    ],
  },
];

export function getProjectDetail(id: string): ProjectDetail | undefined {
  return projectDetails.find((project) => project.id === id);
}
