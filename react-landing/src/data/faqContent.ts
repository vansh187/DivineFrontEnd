export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  id: string;
  label: string;
  items: FaqItem[];
}

/** Grouped Q&A for the public FAQ page — answers are kept accurate to how
 *  the actual booking/payment/KYC flow works, not generic real-estate
 *  boilerplate. */
export const faqCategories: FaqCategory[] = [
  {
    id: 'rera-legal',
    label: 'RERA & legal',
    items: [
      {
        q: 'Are Divine Vision’s townships RERA-registered?',
        a: 'Yes. Suraksha Enclave and OPS Divine Greens are both registered with the Haryana Real Estate Regulatory Authority (HRERA). Their registration numbers are listed in our Terms & Conditions, and you can independently verify them at haryanarera.gov.in before booking.',
      },
      {
        q: 'Is this website the same as my Agreement for Sale?',
        a: 'No. This website is informational. Your plot is sold only on the terms of the formal, RERA-compliant Agreement for Sale and allotment letter you sign with us — that document governs the transaction, not anything shown here.',
      },
      {
        q: 'Are the photos and videos on the site actual site photos?',
        a: 'Our "Our Work" gallery and township galleries are real, unedited on-ground and drone photography, clearly labelled by location. Some marketing visuals elsewhere (hero reels, lifestyle shots) are illustrative. Actual specifications and layout are as per the sanctioned plan.',
      },
    ],
  },
  {
    id: 'booking',
    label: 'Booking a plot',
    items: [
      {
        q: 'How does booking a plot work?',
        a: 'Pick a plot from Available Plots (or have a channel partner reserve one for you), then pay the booking amount — 10% of the agreed Total Plot Amount — either online, by cash, or by NEFT/RTGS. Once your KYC documents are verified, the unit is locked to you and your booking moves to "KYC under review" and then "booked".',
      },
      {
        q: 'What documents do I need?',
        a: 'Aadhaar (front and back, or Aadhaar QR/offline-XML verification), PAN card, your photograph, your signature, and a cancelled cheque. If you have a co-applicant, we need the same for them except the cancelled cheque.',
      },
      {
        q: 'Why do you need my Aadhaar and PAN?',
        a: 'Real-estate transactions require verified buyer identification under RERA and applicable know-your-customer norms. We only use the minimum data Aadhaar verification returns (your masked number, name and demographic details) to confirm your identity and pre-fill your application — see our Privacy Policy for details.',
      },
      {
        q: 'Can someone else book on my behalf?',
        a: 'A registered channel partner (broker) can reserve a unit and record your booking payment for you, but the KYC documents and final booking must be in the actual buyer’s name.',
      },
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    items: [
      {
        q: 'What payment methods are accepted?',
        a: 'Online payment through Zoho Payments (our RBI-regulated payment gateway), cash collected by our team or channel partner, or bank transfer via NEFT/RTGS with a UTR number for confirmation.',
      },
      {
        q: 'What happens after I pay online?',
        a: 'You’re taken to Zoho’s secure hosted checkout page to complete payment, then brought back to the site, where we confirm the payment with Zoho before marking it paid. We never see or store your card or bank details ourselves.',
      },
      {
        q: 'What if my payment doesn’t go through, or I was charged the wrong amount?',
        a: 'If a payment fails or doesn’t match what was due, it won’t be marked as a completed booking payment. Contact our sales team with your payment details and we’ll sort it out — if you were charged in error, nothing is finalised locally until it’s correctly verified.',
      },
      {
        q: 'Can I see my payment schedule and receipts?',
        a: 'Yes — once signed in, your customer dashboard shows your full instalment schedule, what’s paid, what’s due, and lets you download a receipt PDF for any confirmed payment.',
      },
    ],
  },
  {
    id: 'pricing',
    label: 'Pricing',
    items: [
      {
        q: 'Why don’t you show plot prices on the website?',
        a: 'We intentionally don’t publish prices publicly. Pricing is shared directly by our sales team — call, WhatsApp, or ask Divine Assist to connect you — and is only binding once it’s written into your allotment letter or Agreement for Sale.',
      },
      {
        q: 'Can the price change after I start a booking?',
        a: 'Any figure discussed before your allotment letter or Agreement for Sale is signed is indicative only. Once that document is signed, the agreed price is fixed per its terms.',
      },
    ],
  },
  {
    id: 'site-visits',
    label: 'Site visits',
    items: [
      {
        q: 'How do I book a site visit?',
        a: 'Use the "Book a site visit" button on any page — it’s available whether or not you’re signed in. Give us a preferred date and time and we’ll confirm it.',
      },
      {
        q: 'Is there a cost to visit a site?',
        a: 'No, site visits are free.',
      },
    ],
  },
  {
    id: 'channel-partners',
    label: 'Channel partners',
    items: [
      {
        q: 'How do I become a channel partner?',
        a: 'Sign up and choose "Channel Partner" as your role, selecting the township you want to represent. You’ll get your own dashboard to browse plots, manage leads, schedule visits, and record bookings and commission.',
      },
      {
        q: 'How is commission tracked?',
        a: 'Your broker dashboard shows commission tied to the bookings you bring in, visible to you only.',
      },
    ],
  },
  {
    id: 'account-privacy',
    label: 'Account & privacy',
    items: [
      {
        q: 'Is my data safe on this site?',
        a: 'We don’t use third-party advertising or tracking cookies. Your session and a few non-sensitive preferences are kept in your browser’s local storage and cleared when you sign out; documents you upload go directly to our secured backend. See our Privacy Policy for the full picture.',
      },
      {
        q: 'How do I correct or delete my data?',
        a: 'Email our Grievance Officer at the address in our Privacy Policy with your registered email — we’ll action correction or erasure requests in line with the Digital Personal Data Protection Act, 2023, subject to records we’re legally required to keep.',
      },
    ],
  },
];
