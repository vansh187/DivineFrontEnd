export interface TownshipPricing {
  id: string;
  label: string;
  /** ₹ per sq yd — illustrative; confirm actual rates with sales before publishing. */
  ratePerSqYd: number;
  minSqYd: number;
  maxSqYd: number;
}

export const townshipPricing: TownshipPricing[] = [
  { id: 'ops-divine-greens', label: 'OPS Divine Greens · Karnal', ratePerSqYd: 34000, minSqYd: 125, maxSqYd: 180 },
  { id: 'suraksha-enclave', label: 'Suraksha Enclave · Ganaur', ratePerSqYd: 28000, minSqYd: 120, maxSqYd: 180 },
];
