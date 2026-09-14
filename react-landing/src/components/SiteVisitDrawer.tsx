import { useEffect, useMemo, useState } from 'react';
import { contact } from '../data/contact';
import { company } from '../data/company';
import { corporateOfficeLocation, getGoogleMapsSearchHref, siteMapLocations } from '../data/mapLocations';
import { applicationProjects } from '../data/applicationProjects';
import type { ApplicationProjectId } from '../data/applicationProjects';
import { requestSiteVisit } from '../services/visitsApi';
import type { PreferredVisitWindow } from '../services/visitsApi';
import { ApiError } from '../services/authApi';

type SiteVisitDrawerProps = {
  open: boolean;
  onClose: () => void;
};

const visitWindows: { label: string; value: PreferredVisitWindow }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Tomorrow', value: 'tomorrow' },
  { label: 'This weekend', value: 'weekend' },
];
const directionLocations = [...siteMapLocations, corporateOfficeLocation];

function getWhatsAppHref(windowLabel: string) {
  const phoneNumber = contact.phoneHref.replace('tel:', '').replace(/\D/g, '');
  const message = [
    'Hi Divine Vision, I would like to book a site visit.',
    `Preferred visit window: ${windowLabel}.`,
    'Please share the available time slots.',
  ].join(' ');

  return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
}

export function SiteVisitDrawer({ open, onClose }: SiteVisitDrawerProps) {
  const [selectedWindow, setSelectedWindow] = useState(visitWindows[0]);
  const [directionsOpen, setDirectionsOpen] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [project, setProject] = useState<ApplicationProjectId>(applicationProjects[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);

  const whatsappHref = useMemo(() => getWhatsAppHref(selectedWindow.label), [selectedWindow]);

  const canSubmit = Boolean(name.trim() && phone.trim() && !submitting);

  const handleRequestCallback = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await requestSiteVisit({
        customer_name: name.trim(),
        customer_contact: phone.trim(),
        customer_email: email.trim() || undefined,
        project,
        preferred_window: selectedWindow.value,
      });
      setRequested(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setDirectionsOpen(false);
      setRequested(false);
      setError('');
    }
  }, [open]);

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-[120] transition ${
        open ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <button
        type="button"
        aria-label="Close site visit panel"
        onClick={onClose}
        className={`absolute inset-0 bg-ink/45 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-visit-title"
        data-lenis-prevent
        className={`absolute right-0 top-0 flex h-full w-full max-w-[430px] flex-col bg-bg shadow-[0_24px_70px_rgba(0,0,0,0.32)] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <div>
            <p className="eyebrow-label text-[11px] text-terracotta">Site visit concierge</p>
            <h2 id="site-visit-title" className="font-display text-xl font-bold text-ink">
              Plan your visit
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-2xl leading-none text-ink transition-colors hover:border-chrome hover:text-chrome"
          >
            &times;
          </button>
        </div>

        <div
          data-lenis-prevent
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
          className="flex-1 overscroll-contain overflow-y-auto px-5 py-6"
        >
          <div className="rounded-lg border border-hairline bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-ink">NH-1 Delhi-Chandigarh corridor</p>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Visit active townships around {company.locations.join(', ')} with the sales team.
              Request a callback below, or confirm instantly by call or WhatsApp.
            </p>
          </div>

          <div className="mt-6">
            <p className="eyebrow-label text-[11px] text-ink-muted">Which project?</p>
            <select
              value={project}
              onChange={(event) => setProject(event.target.value as ApplicationProjectId)}
              disabled={submitting || requested}
              aria-label="Project to visit"
              className="mt-3 w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm font-semibold text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applicationProjects.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} - {option.location}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6">
            <p className="eyebrow-label text-[11px] text-ink-muted">Preferred window</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {visitWindows.map((windowOption) => {
                const selected = selectedWindow.value === windowOption.value;

                return (
                  <button
                    key={windowOption.value}
                    type="button"
                    onClick={() => setSelectedWindow(windowOption)}
                    disabled={submitting || requested}
                    className={`min-h-12 rounded-lg border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? 'border-chrome bg-chrome text-white'
                        : 'border-hairline bg-white text-ink hover:border-green hover:text-green'
                    }`}
                  >
                    {windowOption.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <p className="eyebrow-label text-[11px] text-ink-muted">Your details</p>
            <div className="mt-3 flex flex-col gap-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                aria-label="Your name"
                disabled={submitting || requested}
                className="rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
              />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
                aria-label="Phone number"
                disabled={submitting || requested}
                className="rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email (optional)"
                aria-label="Email"
                disabled={submitting || requested}
                className="rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-green disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {error && (
              <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            {requested ? (
              <p role="status" className="mt-3 rounded-lg border border-green/35 bg-green/5 px-3 py-2.5 text-sm font-semibold text-chrome">
                Request received - our sales team will call you shortly to confirm a time.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleRequestCallback}
                disabled={!canSubmit}
                className="mt-3 w-full rounded-full bg-green px-4 py-3 text-sm font-bold text-white shadow-[0_18px_36px_-20px_rgba(6,31,45,0.62)] transition-all hover:-translate-y-0.5 hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Sending request...' : 'Request a callback'}
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-3">
            <a
              href={contact.phoneHref}
              className="flex items-center justify-between rounded-lg bg-green px-4 py-4 text-sm font-bold text-white shadow-[0_18px_36px_-20px_rgba(6,31,45,0.62)] transition-all hover:-translate-y-0.5 hover:bg-green-soft"
            >
              <span>Call sales now</span>
              <span aria-hidden="true" className="text-lg">
                &#8594;
              </span>
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-lg border border-green/35 bg-white px-4 py-4 text-sm font-bold text-chrome transition-all hover:-translate-y-0.5 hover:border-green hover:bg-green/5"
            >
              <span>Continue on WhatsApp</span>
              <span aria-hidden="true" className="text-lg">
                &#8594;
              </span>
            </a>
            <div className="overflow-hidden rounded-lg border border-hairline bg-white">
              <button
                type="button"
                onClick={() => setDirectionsOpen((value) => !value)}
                aria-expanded={directionsOpen}
                className="flex w-full items-center justify-between px-4 py-4 text-left text-sm font-bold text-ink transition-colors hover:text-chrome"
              >
                <span>Get directions</span>
                <span
                  aria-hidden="true"
                  className={`text-lg transition-transform ${directionsOpen ? 'rotate-90' : ''}`}
                >
                  &#8594;
                </span>
              </button>

              {directionsOpen ? (
                <div className="grid border-t border-hairline">
                  {directionLocations.map((location) => {
                    const href = getGoogleMapsSearchHref(location.query);

                    return (
                      <a
                        key={location.label}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between border-b border-hairline px-4 py-3 text-sm font-semibold text-ink-muted transition-colors last:border-b-0 hover:bg-green/5 hover:text-chrome"
                      >
                        <span>{location.label}</span>
                        <span aria-hidden="true">&#8599;</span>
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-hairline bg-white p-4">
            <p className="text-sm font-semibold text-ink">Direct contact</p>
            <p className="mt-2 text-sm text-ink-muted">{contact.phone}</p>
            <a
              href={contact.emailHref}
              className="mt-1 inline-flex text-sm font-semibold text-green transition-colors hover:text-chrome"
            >
              {contact.email}
            </a>
          </div>
        </div>
      </aside>
    </div>
  );
}
