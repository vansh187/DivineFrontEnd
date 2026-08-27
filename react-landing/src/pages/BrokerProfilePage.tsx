import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout } from '../components/DashboardLayout';
import { CalendarIcon, IconBadge } from '../components/DashboardIcons';
import { blobToDataUrl } from '../services/applicationPdf';
import { loadBrokerDocs, saveBrokerDocs } from '../services/documentStore';
import { getLatestDocumentByType, uploadApplicantPhoto } from '../services/documentsApi';
import { listVisitHistory, listVisits, type VisitRecord } from '../services/visitsApi';
import { ApiError } from '../services/authApi';

type VisitGroup = 'Upcoming' | 'Due now' | 'Visited';

interface ProfileVisit {
  id: string;
  customerName: string;
  customerContact: string;
  date: string;
  time: string;
  notes: string;
  status: string;
  createdAt: string;
  group: VisitGroup;
}

function visitFromApi(visit: VisitRecord, group: VisitGroup): ProfileVisit {
  return {
    id: visit.id,
    customerName: visit.customer_name,
    customerContact: visit.customer_contact ?? '',
    date: visit.date,
    time: visit.time,
    notes: visit.notes ?? '',
    status: visit.status,
    createdAt: visit.created_date,
    group,
  };
}

function visitStart(visit: Pick<ProfileVisit, 'date' | 'time'>) {
  return new Date(`${visit.date}T${visit.time}`);
}

function isHappeningNow(visit: Pick<ProfileVisit, 'date' | 'time'>) {
  const start = visitStart(visit).getTime();
  const end = start + 2 * 60 * 60 * 1000;
  const now = Date.now();
  return start <= now && now <= end;
}

function formatVisitDate(visit: Pick<ProfileVisit, 'date' | 'time'>) {
  return visitStart(visit).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function freshSignedUrl(url: string | null, expiresAt: number | null): string | null {
  if (!url) return null;
  if (expiresAt && expiresAt <= Date.now() + 60_000) return null;
  return url;
}

function cacheBrokerProfilePhoto(email: string, doc: Awaited<ReturnType<typeof getLatestDocumentByType>>) {
  const docs = loadBrokerDocs(email);
  saveBrokerDocs(email, {
    ...docs,
    profilePhoto: {
      ...docs.profilePhoto,
      dataUrl: docs.profilePhoto.documentId === doc.id ? docs.profilePhoto.dataUrl : null,
      uploadedAt: doc.created_date,
      documentId: doc.id,
      signedUrl: doc.signed_url,
      signedUrlExpiresAt: Date.now() + doc.signed_url_expires_in * 1000,
      error: null,
    },
  });
}

export function BrokerProfilePage() {
  const { session, logout, openModal } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [photoVersion, setPhotoVersion] = useState(0);
  const [futureVisits, setFutureVisits] = useState<ProfileVisit[]>([]);
  const [currentVisits, setCurrentVisits] = useState<ProfileVisit[]>([]);
  const [pastVisits, setPastVisits] = useState<ProfileVisit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState('');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getLatestDocumentByType(session.token, 'applicant_photo')
      .then((doc) => {
        if (cancelled) return;
        cacheBrokerProfilePhoto(session.email, doc);
        window.dispatchEvent(new Event('dvi-profile-photo-changed'));
        setPhotoVersion((version) => version + 1);
      })
      .catch(() => {
        /* No uploaded broker photo yet, or storage temporarily unavailable. */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setVisitsLoading(true);
    setVisitsError('');

    Promise.all([listVisits(session.token), listVisitHistory(session.token)])
      .then(([active, history]) => {
        if (cancelled) return;
        const now = Date.now();
        const activeFuture = active
          .filter((visit) => visit.status === 'scheduled' && visitStart(visit).getTime() > now && !isHappeningNow(visit))
          .map((visit) => visitFromApi(visit, 'Upcoming'))
          .sort((a, b) => visitStart(a).getTime() - visitStart(b).getTime());
        const activeCurrent = active
          .filter((visit) => visit.status === 'scheduled' && isHappeningNow(visit))
          .map((visit) => visitFromApi(visit, 'Due now'))
          .sort((a, b) => visitStart(a).getTime() - visitStart(b).getTime());
        const activeIds = new Set([...activeFuture, ...activeCurrent].map((visit) => visit.id));
        const closed = history
          .filter((visit) => !activeIds.has(visit.id))
          .map((visit) => visitFromApi(visit, 'Visited'))
          .sort((a, b) => visitStart(b).getTime() - visitStart(a).getTime());

        setFutureVisits(activeFuture);
        setCurrentVisits(activeCurrent);
        setPastVisits(closed);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 401) {
            logout();
            openModal('signin', 'broker');
          }
          setVisitsError(err.message);
        } else {
          setVisitsError('Could not load site visits right now.');
        }
      })
      .finally(() => {
        if (!cancelled) setVisitsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session, logout, openModal]);

  const profile = useMemo(() => {
    if (!session) return null;
    const docs = loadBrokerDocs(session.email);
    const photo = docs.profilePhoto.dataUrl || freshSignedUrl(docs.profilePhoto.signedUrl, docs.profilePhoto.signedUrlExpiresAt);
    return {
      name: getDisplayName(session),
      email: session.email,
      brokerId: session.userId || '-',
      photo,
      aadhaarStatus: docs.aadhar.verified ? 'Verified' : 'Pending',
    };
  }, [session, photoVersion]);

  if (!session || !profile) return null;

  const initial = profile.name.charAt(0).toUpperCase();
  const allVisits = [...futureVisits, ...currentVisits, ...pastVisits];

  const handlePhotoUpload = async (file: File | null) => {
    if (!session || !file) return;
    setPhotoError('');
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('Please upload a JPG or PNG photo.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError('Please upload a photo under 8 MB.');
      return;
    }

    setPhotoUploading(true);
    try {
      const dataUrl = await blobToDataUrl(file);
      const docs = loadBrokerDocs(session.email);
      saveBrokerDocs(session.email, {
        ...docs,
        profilePhoto: {
          ...docs.profilePhoto,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl,
          documentId: null,
          signedUrl: null,
          signedUrlExpiresAt: null,
          error: null,
        },
      });
      window.dispatchEvent(new Event('dvi-profile-photo-changed'));
      setPhotoVersion((version) => version + 1);

      try {
        const uploaded = await uploadApplicantPhoto(session.token, file);
        const fresh = loadBrokerDocs(session.email);
        saveBrokerDocs(session.email, {
          ...fresh,
          profilePhoto: {
            ...fresh.profilePhoto,
            fileName: file.name,
            fileSize: file.size,
            uploadedAt: uploaded.created_date,
            dataUrl,
            documentId: uploaded.id,
            signedUrl: uploaded.signed_url,
            signedUrlExpiresAt: Date.now() + uploaded.signed_url_expires_in * 1000,
            error: null,
          },
        });
        window.dispatchEvent(new Event('dvi-profile-photo-changed'));
        setPhotoVersion((version) => version + 1);
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Photo saved locally, but upload failed. Please try again.';
        const fresh = loadBrokerDocs(session.email);
        saveBrokerDocs(session.email, {
          ...fresh,
          profilePhoto: { ...fresh.profilePhoto, error: message },
        });
        setPhotoError(message);
        if (err instanceof ApiError && err.status === 401) {
          logout();
          openModal('signin', 'broker');
        }
      }
    } catch {
      setPhotoError('Could not read that photo. Please choose another file.');
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const details: Array<[string, string]> = [
    ['Name', profile.name],
    ['Email', profile.email],
    ['Broker ID', profile.brokerId],
    ['Role', 'Broker'],
    ['Aadhaar', profile.aadhaarStatus],
    ['Upcoming', String(futureVisits.length)],
    ['Due now', String(currentVisits.length)],
    ['Visited', String(pastVisits.length)],
  ];

  return (
    <DashboardLayout
      eyebrow="Broker workspace"
      heading={<>My profile</>}
      subheading="Your broker details and site visit timeline."
      contentLayout="full"
    >
      <section className="rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] sm:p-8">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <div className="flex shrink-0 flex-col items-center gap-2">
            {profile.photo ? (
              <img src={profile.photo} alt={profile.name} className="h-24 w-24 rounded-full border border-hairline object-cover" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-chrome font-display text-3xl font-bold text-white">
                {initial}
              </span>
            )}
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => void handlePhotoUpload(event.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="rounded-full border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
            >
              {photoUploading ? 'Uploading...' : profile.photo ? 'Change photo' : 'Upload photo'}
            </button>
            {photoError && <p role="alert" className="max-w-40 text-center text-xs text-red-700">{photoError}</p>}
          </div>

          <div className="min-w-0 text-center sm:text-left">
            <p className="font-display text-2xl font-bold text-ink">{profile.name}</p>
            <p className="eyebrow-label mt-1 text-terracotta">broker</p>
            <p className="mt-1 text-sm text-ink-muted">{profile.email}</p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="flex gap-4 border-b border-hairline py-3.5">
              <dt className="w-28 shrink-0 text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</dt>
              <dd className="min-w-0 break-words text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow-label text-terracotta">Site visits</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-ink-muted">
            <span className="rounded-full border border-hairline bg-surface px-3 py-1.5">{futureVisits.length} upcoming</span>
            <span className="rounded-full border border-hairline bg-surface px-3 py-1.5">{currentVisits.length} due now</span>
            <span className="rounded-full border border-hairline bg-surface px-3 py-1.5">{pastVisits.length} visited</span>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto pb-3">
          <div className="flex min-w-full gap-4">
            {visitsLoading ? (
              <div className="min-w-[280px] rounded-2xl border border-dashed border-hairline bg-surface px-5 py-8 text-sm text-ink-muted">
                Loading site visits...
              </div>
            ) : allVisits.length > 0 ? (
              allVisits.map((visit) => <VisitCard key={`${visit.group}-${visit.id}`} visit={visit} />)
            ) : (
              <div className="min-w-[280px] rounded-2xl border border-dashed border-hairline bg-surface px-5 py-8 text-sm text-ink-muted">
                No site visits are on record yet.
              </div>
            )}
          </div>
        </div>

        {visitsError && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {visitsError}
          </p>
        )}
      </section>
    </DashboardLayout>
  );
}

function VisitCard({ visit }: { visit: ProfileVisit }) {
  const statusLabel =
    visit.status === 'cancelled'
      ? 'Cancelled'
      : visit.group === 'Visited'
        ? 'Visited'
        : visit.group;
  const tone =
    statusLabel === 'Upcoming'
      ? 'border-green/25 bg-green/5 text-green'
      : statusLabel === 'Due now'
        ? 'border-terracotta/25 bg-terracotta/5 text-terracotta'
        : statusLabel === 'Cancelled'
          ? 'border-terracotta/20 bg-terracotta/5 text-terracotta'
          : 'border-hairline bg-bg text-ink-muted';
  const accent = statusLabel === 'Upcoming' ? 'green' : statusLabel === 'Due now' || statusLabel === 'Cancelled' ? 'terracotta' : 'chrome';
  return (
    <article className="min-w-[280px] max-w-[320px] rounded-2xl border border-hairline bg-surface p-5 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)]">
      <div className="flex items-start justify-between gap-3">
        <IconBadge icon={<CalendarIcon />} accent={accent} />
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{statusLabel}</span>
      </div>
      <h3 className="mt-4 truncate font-display text-lg font-bold text-ink">{visit.customerName || 'Customer'}</h3>
      <p className="mt-1 text-sm font-semibold text-ink">{formatVisitDate(visit)}</p>
      <p className="mt-1 truncate text-xs text-ink-muted">{visit.customerContact || 'No contact provided'}</p>
      {visit.notes && <p className="mt-3 line-clamp-3 text-xs leading-[1.55] text-ink-muted">{visit.notes}</p>}
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {statusLabel}
      </p>
    </article>
  );
}
