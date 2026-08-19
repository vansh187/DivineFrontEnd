export type ApplicationProjectId = 'ops-divine-greens' | 'suraksha-enclave';

export interface ApplicationProject {
  id: ApplicationProjectId;
  label: string;
  location: string;
  company: string;
  templateUrl: string;
}

export const applicationProjects: ApplicationProject[] = [
  {
    id: 'ops-divine-greens',
    label: 'OPS Divine Greens',
    location: 'Sec-16 Taraori, Karnal, Haryana',
    company: 'KCG Resorts Pvt. Ltd.',
    templateUrl: '/application-forms/ops-divine-greens-booking-form.pdf',
  },
  {
    id: 'suraksha-enclave',
    label: 'Suraksha Enclave',
    location: 'Ganaur, Sonipat, Haryana',
    company: 'Divine Vision Infratech Pvt. Ltd.',
    templateUrl: '/application-forms/suraksha-enclave-booking-form.pdf',
  },
];

export function getApplicationProject(id: ApplicationProjectId): ApplicationProject {
  return applicationProjects.find((project) => project.id === id) ?? applicationProjects[0];
}
