export interface Brochure {
  id: string;
  label: string;
  meta: string;
  href: string;
  fileName: string;
}

export const brochures = {
  surakshaEnclave: {
    id: 'suraksha-enclave',
    label: 'Suraksha Enclave',
    meta: 'Sector 15, Ganaur — plotted township brochure',
    href: '/brochures/suraksha-enclave-brochure.pdf',
    fileName: 'Suraksha-Enclave-Brochure.pdf',
  },
  divineVision: {
    id: 'divine-vision',
    label: 'Divine Vision Portfolio',
    meta: 'The complete group brochure — every township',
    href: '/brochures/divine-vision-portfolio.pdf',
    fileName: 'Divine-Vision-Group-Portfolio.pdf',
  },
  opsDivineGreens: {
    id: 'ops-divine-greens',
    label: 'OPS Divine Greens',
    meta: 'Karnal — plotted township brochure',
    href: '/brochures/ops-divine-greens-brochure.pdf',
    fileName: 'OPS-Divine-Greens-Brochure.pdf',
  },
} as const satisfies Record<string, Brochure>;

export const brochureList: Brochure[] = Object.values(brochures);

export const brochureByTownshipId: Record<string, Brochure> = {
  'suraksha-enclave': brochures.surakshaEnclave,
  'ops-divine-greens': brochures.opsDivineGreens,
};
