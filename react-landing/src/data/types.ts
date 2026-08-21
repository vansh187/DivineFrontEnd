export interface NavLink {
  label: string;
  href: string;
}

export interface JourneyStop {
  id: string;
  eyebrow: string;
  heading: string;
  headingEmphasis: string;
  description: string;
  reraId?: string;
  /** Optional larger image for the project detail page hero; falls back to image.src. */
  heroSrc?: string;
  bigNumber?: {
    value: string;
    unit: string;
  };
  chips?: string[];
  image: {
    src: string;
    alt: string;
    tag: string;
  };
}

export interface DeliveredRecord {
  year: string;
  name: string;
  location: string;
}
