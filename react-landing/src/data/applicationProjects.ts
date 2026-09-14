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

/** Inventory units only carry a free-text project_name from the backend (e.g.
 *  "OPS Divine Greens"), not this canonical id - match it back so a reserved
 *  unit's visit record still carries the same id the customer-facing project
 *  dropdown sends. Falls back to the first project rather than null so a
 *  visit is never submitted without a project. */
export function matchApplicationProjectId(projectName: string | null | undefined): ApplicationProjectId {
  const needle = (projectName ?? '').trim().toLowerCase();
  const match = applicationProjects.find(
    (project) => needle.includes(project.label.toLowerCase()) || project.label.toLowerCase().includes(needle),
  );
  return match?.id ?? applicationProjects[0].id;
}
