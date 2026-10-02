import { Link } from 'react-router-dom';
import { LegalPageLayout } from '../components/LegalPageLayout';
import type { LegalSection } from '../components/LegalPageLayout';
import { company } from '../data/company';
import { contact } from '../data/contact';
import { corporateOfficeLocation } from '../data/mapLocations';
import { journeyStops } from '../data/journeyStops';

const LAST_UPDATED = '2 October 2026';

const registeredProjects = journeyStops.filter((stop) => stop.reraId);

const sections: LegalSection[] = [
  {
    id: 'acceptance',
    heading: 'Acceptance of these terms',
    body: (
      <p>
        These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of this website, the Divine Assist chatbot,
        and the customer and channel-partner dashboards operated by {company.legalName} (&ldquo;Divine Vision&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;). By browsing the Platform, creating an account, starting a booking, or
        chatting with Divine Assist, you agree to be bound by these Terms and by our{' '}
        <Link to="/privacy-policy">Privacy Policy</Link>. If you do not agree, please do not use the Platform.
      </p>
    ),
  },
  {
    id: 'not-the-agreement',
    heading: 'This website is not the Agreement for Sale',
    body: (
      <p>
        Everything on this Platform — descriptions, photographs, floor areas, amenities, pricing discussed with our
        sales team, and anything Divine Assist tells you — is provided for general information only and does not
        constitute an offer that is binding on its own. A plot is sold only on the terms of the formal,
        RERA-compliant <strong>Agreement for Sale</strong> and allotment letter signed between you and the project
        promoter, which is the sole legally binding document for that transaction. Where anything on the Platform
        conflicts with the signed Agreement for Sale, the Agreement for Sale prevails.
      </p>
    ),
  },
  {
    id: 'eligibility',
    heading: 'Eligibility',
    body: (
      <p>
        You must be at least 18 years old and competent to contract under the Indian Contract Act, 1872 to create an
        account, book a plot, or register as a channel partner. By using the Platform you confirm that you meet this
        requirement and that the information you provide is accurate and belongs to you.
      </p>
    ),
  },
  {
    id: 'accounts',
    heading: 'Accounts and KYC',
    body: (
      <>
        <p>
          You are responsible for keeping your account credentials confidential and for all activity under your
          account. Tell us immediately if you suspect unauthorised access.
        </p>
        <p>
          Submitting KYC documents (Aadhaar, PAN, photographs, signature, cancelled cheque) that are forged, altered
          or belong to someone else is a serious offence under the Information Technology Act, 2000 and the Bharatiya
          Nyaya Sanhita, 2023, in addition to being grounds for us to reject your booking and report the matter where
          required by law.
        </p>
      </>
    ),
  },
  {
    id: 'bookings-payments',
    heading: 'Bookings and payments',
    body: (
      <>
        <p>
          Starting a booking and paying the booking amount shown on the Platform reserves your interest in a specific
          unit while we review your KYC documents — it does not, by itself, transfer any right, title or interest in
          the plot to you. A unit is locked to you only once KYC review is complete; until then it may still show as
          available to other prospective buyers, and in the rare case where another buyer completes a verified
          booking first, your payment is safe and will be refunded or adjusted, and our team will contact you.
        </p>
        <p>
          Online payments are processed through <strong>Zoho Payments</strong>; we also accept cash and bank
          transfer (NEFT/RTGS) collected and recorded by our team or your channel partner. A payment is treated as
          received only once our backend receives confirmation from the payment gateway or, for cash/bank transfer, once
          it is recorded against your account. The full payment plan, due dates and consequences of a missed
          instalment are set out in your Agreement for Sale, not on this Platform.
        </p>
      </>
    ),
  },
  {
    id: 'cancellation-refund',
    heading: 'Cancellation and refunds',
    body: (
      <p>
        Cancellation, forfeiture and refund terms — including any amount Divine Vision is entitled to deduct on
        cancellation — are governed by your signed Agreement for Sale and by the Haryana Real Estate Regulatory
        Authority&rsquo;s rules in force at the time, not by this Platform. If you wish to cancel a booking, contact
        our sales team using the details under <a href="#contact">&ldquo;Contact us&rdquo;</a>; we will explain the
        specific terms that apply to your booking and the expected refund timeline.
      </p>
    ),
  },
  {
    id: 'rera',
    heading: 'RERA registration and disclosures',
    body: (
      <>
        <p>
          Our current projects are registered with the Haryana Real Estate Regulatory Authority (HRERA) under the
          registration numbers below. We encourage every prospective buyer to independently verify a project&rsquo;s
          registration, sanctioned layout plan and promoter details at{' '}
          <a href="https://haryanarera.gov.in" target="_blank" rel="noreferrer">
            haryanarera.gov.in
          </a>{' '}
          before booking.
        </p>
        <ul>
          {registeredProjects.map((project) => (
            <li key={project.id}>
              <strong>
                {project.heading} {project.headingEmphasis}
              </strong>{' '}
              — RERA registration no. {project.reraId}
            </li>
          ))}
        </ul>
        <p>
          All photographs, drone footage, 3D renders and layout visuals on the Platform are illustrative and intended
          to convey a general sense of the township — actual specifications, elevations, landscaping and finishes are
          as per the sanctioned plan and your Agreement for Sale, and may vary.
        </p>
      </>
    ),
  },
  {
    id: 'pricing',
    heading: 'Pricing',
    body: (
      <p>
        We do not publish plot prices on the public Platform; pricing is shared by our sales team on enquiry and is
        subject to change without notice until it is fixed in writing in your allotment letter or Agreement for Sale.
        Any indicative figure quoted by Divine Assist or our sales team before that point is non-binding.
      </p>
    ),
  },
  {
    id: 'chatbot',
    heading: 'Divine Assist (chatbot) disclaimer',
    body: (
      <p>
        Divine Assist is an automated assistant that can make mistakes, including about pricing, availability, or
        project specifications. Its responses are for general guidance only and are not a substitute for written
        confirmation from our sales team or the terms of your Agreement for Sale. Please verify anything
        transaction-critical with a human member of our team before relying on it.
      </p>
    ),
  },
  {
    id: 'ip',
    heading: 'Intellectual property',
    body: (
      <p>
        All text, images, video, logos, layouts and other content on the Platform are owned by or licensed to Divine
        Vision and are protected under the Copyright Act, 1957 and the Trade Marks Act, 1999. You may view and share
        Platform content for your own personal, non-commercial use; you may not reproduce, modify, redistribute or
        use it commercially without our prior written consent.
      </p>
    ),
  },
  {
    id: 'third-party',
    heading: 'Third-party services and links',
    body: (
      <p>
        The Platform uses or links to third-party services — including Zoho Payments, Google Maps, and WhatsApp —
        each governed by that provider&rsquo;s own terms and privacy policy. We are not responsible for the content,
        accuracy or practices of third-party services, and including a link does not mean we endorse it.
      </p>
    ),
  },
  {
    id: 'prohibited-conduct',
    heading: 'Prohibited conduct',
    body: (
      <ul>
        <li>Submitting false, forged or someone else&rsquo;s identity documents.</li>
        <li>Attempting to book the same unit through multiple accounts to circumvent availability.</li>
        <li>Scraping, reverse-engineering, or attempting to access non-public parts of the Platform without authorisation.</li>
        <li>Using the chatbot or contact channels to send unlawful, abusive, or fraudulent messages.</li>
        <li>Interfering with the security or normal operation of the Platform.</li>
      </ul>
    ),
  },
  {
    id: 'liability',
    heading: 'Disclaimer of warranties and limitation of liability',
    body: (
      <p>
        The Platform is provided &ldquo;as is&rdquo;. We do not guarantee that it will be uninterrupted, error-free,
        or free of inaccuracies, and we are not liable for indirect, incidental or consequential loss arising from
        your use of it. Nothing in these Terms limits any right or remedy available to you under RERA, the Consumer
        Protection Act, 2019, or any other law that cannot lawfully be excluded or limited.
      </p>
    ),
  },
  {
    id: 'indemnity',
    heading: 'Indemnity',
    body: (
      <p>
        You agree to indemnify and hold Divine Vision harmless against any claim, loss or liability arising from your
        breach of these Terms, your misuse of the Platform, or any inaccurate or fraudulent information you provide.
      </p>
    ),
  },
  {
    id: 'force-majeure',
    heading: 'Force majeure',
    body: (
      <p>
        We are not liable for any delay or failure to perform caused by events beyond our reasonable control,
        including natural disasters, government action, strikes, internet or power outages, or failures of
        third-party services we rely on (including our payment gateway).
      </p>
    ),
  },
  {
    id: 'dispute-resolution',
    heading: 'Dispute resolution and jurisdiction',
    body: (
      <p>
        These Terms are governed by the laws of India. Disputes that fall within the jurisdiction of the Real Estate
        Regulatory Authority or the Real Estate Appellate Tribunal under Sections 71, 79 and related provisions of
        RERA shall be resolved there. For all other disputes, the courts at Karnal, Haryana shall have exclusive
        jurisdiction.
      </p>
    ),
  },
  {
    id: 'changes-terms',
    heading: 'Changes to these Terms',
    body: (
      <p>
        We may update these Terms from time to time; the &ldquo;Last updated&rdquo; date above always reflects the
        current version. Continuing to use the Platform after an update constitutes acceptance of the revised Terms.
      </p>
    ),
  },
  {
    id: 'contact',
    heading: 'Contact us',
    body: (
      <ul>
        <li>
          <strong>{company.legalName}</strong>
        </li>
        <li>{corporateOfficeLocation.query}</li>
        <li>
          Email: <a href={contact.emailHref}>{contact.email}</a>
        </li>
        <li>
          Phone: <a href={contact.phoneHref}>{contact.phone}</a>
        </li>
      </ul>
    ),
  },
];

export function TermsPage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Terms & Conditions"
      intro="The terms that apply when you browse this website, book a plot, chat with Divine Assist, or register as a channel partner. These govern use of the Platform only — your plot purchase itself is governed by your signed Agreement for Sale."
      lastUpdated={LAST_UPDATED}
      sections={sections}
    />
  );
}
