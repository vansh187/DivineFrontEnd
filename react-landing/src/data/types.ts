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
