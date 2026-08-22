import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import * as store from '../services/documentStore';
import type { CustomerDocState } from '../services/documentStore';
import { generateDocument, getDocument, uploadPanPhoto } from '../services/documentsApi';
import { ApiError } from '../services/authApi';
import { blobToDataUrl, openDataUrl } from '../services/applicationPdf';
import { townshipPricing } from '../data/townshipPricing';
import { TileShell, UploadDocumentTile } from './DocumentTile';
import { AadhaarVerifyTile } from './AadhaarVerifyTile';
import { CardIcon, FileIcon } from './DashboardIcons';

export function CustomerDocuments() {
  const navigate = useNavigate();
  const { session, logout, openModal } = useAuth();
  const email = session?.email ?? 'anonymous';

  const [docs, setDocs] = useState<CustomerDocState>(() => store.loadCustomerDocs(email));
  const [verifyingPan, setVerifyingPan] = useState(false);
  const [uploadingPan, setUploadingPan] = useState(false);

  const persist = (next: CustomerDocState) => {
    setDocs(next);
    store.saveCustomerDocs(email, next);
  };

  const handlePanUpload = async (file: File) => {
    if (!session) return;
    setUploadingPan(true);
    let dataUrl: string | null = null;
    try {
      dataUrl = await blobToDataUrl(file);
    } catch {
      dataUrl = null;
    }
    persist({
      ...docs,
      pan: { ...docs.pan, fileName: file.name, fileSize: file.size, dataUrl, documentId: null, error: null },
    });
    uploadPanPhoto(session.token, file)
      .then((doc) => {
        setDocs((prev) => {
          const next: CustomerDocState = {
            ...prev,
            pan: {
              ...prev.pan,
              fileName: file.name,
              fileSize: file.size,
              uploadedAt: new Date().toISOString(),
              dataUrl,
              documentId: doc.id,
              signedUrl: doc.signed_url,
              signedUrlExpiresAt: Date.now() + doc.signed_url_expires_in * 1000,
              error: null,
            },
          };
          store.saveCustomerDocs(email, next);
          return next;
        });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          openModal('signin', 'customer');
        }
        const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        setDocs((prev) => {
          const next: CustomerDocState = { ...prev, pan: { ...prev.pan, error: message } };
          store.saveCustomerDocs(email, next);
          return next;
        });
      })
      .finally(() => setUploadingPan(false));
  };

  const handlePanVerify = () => {
    setVerifyingPan(true);
    window.setTimeout(() => {
      setDocs((prev) => {
        const next = { ...prev, pan: { ...prev.pan, verified: true, verifiedAt: new Date().toISOString() } };
        store.saveCustomerDocs(email, next);
        return next;
      });
      setVerifyingPan(false);
    }, 1100);
  };

  const handleSignatureUpload = async (kind: 'applicant' | 'coApplicant', file: File) => {
    const key = kind === 'applicant' ? 'applicantSignature' : 'coApplicantSignature';
    try {
      const dataUrl = await blobToDataUrl(file);
      persist({
        ...docs,
        [key]: {
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl,
          error: null,
        },
      });
    } catch (err) {
      persist({
        ...docs,
        [key]: {
          ...docs[key],
          error: err instanceof Error ? err.message : 'Could not read signature image.',
        },
      });
    }
  };

  // "Generate documents" tile — its own small applicant-details form.
  const [formOpen, setFormOpen] = useState(false);
  const [applicantName, setApplicantName] = useState(session ? getDisplayName(session) : '');
  const [phone, setPhone] = useState('');
  const [townshipId, setTownshipId] = useState(townshipPricing[0].id);
  const township = townshipPricing.find((t) => t.id === townshipId) ?? townshipPricing[0];
  const [plotSize, setPlotSize] = useState(township.minSqYd);
  const [verifyingSignature, setVerifyingSignature] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [opening, setOpening] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // The generated PDF embeds these three photos, so the backend refuses to generate
  // until all three are actually uploaded to storage - mirror that gate here so the
  // button reflects it up front instead of only failing after a click.
  const missingDocs: string[] = [];
  if (!docs.aadharFront.documentId) missingDocs.push('Aadhaar front photo');
  if (!docs.aadharBack.documentId) missingDocs.push('Aadhaar back photo');
  if (!docs.pan.documentId) missingDocs.push('PAN card photo');
  const documentsReady = missingDocs.length === 0;

  const handleAuthError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        logout();
        openModal('signin', 'customer');
      }
      setGenError(err.message);
    } else {
      setGenError('Something went wrong. Please try again.');
    }
  };

  const handleGenerate = async () => {
    if (!session) return;
    const name = applicantName.trim() || 'Applicant';
    setGenerating(true);
    setGenError(null);
    try {
      const doc = await generateDocument(session.token, {
        document_type: 'booking_application',
        form_data: {
          full_name: name,
          phone: phone || '—',
          township: township.label,
          plot_size_sq_yd: plotSize,
          rate_per_sq_yd: township.ratePerSqYd,
          indicative_total: plotSize * township.ratePerSqYd,
          aadhar_status: docs.aadhar.verified ? 'Verified' : 'Pending',
          pan_status: docs.pan.verified ? 'Verified' : 'Pending',
        },
      });
      persist({
        ...docs,
        generatedDoc: {
          generated: true,
          generatedAt: new Date().toISOString(),
          applicantName: name,
          signatureVerified: false,
          documentId: doc.id,
          signedUrl: doc.signed_url,
          signedUrlExpiresAt: Date.now() + doc.signed_url_expires_in * 1000,
        },
      });
      setFormOpen(false);
      window.open(doc.signed_url, '_blank', 'noopener');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenDocument = async () => {
    if (!session || !docs.generatedDoc.documentId) return;
    const stillValid = docs.generatedDoc.signedUrl && docs.generatedDoc.signedUrlExpiresAt && Date.now() < docs.generatedDoc.signedUrlExpiresAt;
    if (stillValid) {
      window.open(docs.generatedDoc.signedUrl as string, '_blank', 'noopener');
      return;
    }
    setOpening(true);
    setGenError(null);
    try {
      const doc = await getDocument(session.token, docs.generatedDoc.documentId);
      persist({
        ...docs,
        generatedDoc: { ...docs.generatedDoc, signedUrl: doc.signed_url, signedUrlExpiresAt: Date.now() + doc.signed_url_expires_in * 1000 },
      });
      window.open(doc.signed_url, '_blank', 'noopener');
    } catch (err) {
      handleAuthError(err);
    } finally {
      setOpening(false);
    }
  };

  const handleVerifySignature = () => {
    setVerifyingSignature(true);
    window.setTimeout(() => {
      setDocs((prev) => {
        const next = { ...prev, generatedDoc: { ...prev.generatedDoc, signatureVerified: true } };
        store.saveCustomerDocs(email, next);
        return next;
      });
      setVerifyingSignature(false);
    }, 1100);
  };

  const genStatusLabel = docs.generatedDoc.signatureVerified
    ? 'Signature verified'
    : docs.generatedDoc.generated
      ? 'Generated — signature pending'
      : 'Not generated';
  const genStatusTone = docs.generatedDoc.signatureVerified ? 'done' : docs.generatedDoc.generated ? 'pending' : 'neutral';

  return (
    <section className="mt-14">
      <p className="eyebrow-label text-terracotta">Document upload</p>
      <h2 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">Aadhar, PAN &amp; document generation</h2>
      <p className="mt-2 max-w-[64ch] text-sm leading-[1.6] text-ink-muted">
        Aadhaar verification, Aadhaar photo upload, PAN upload, document generation, and signature checks can be completed later if verification is pending.
      </p>

      <div className="mt-6 grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <AadhaarVerifyTile
          token={session?.token ?? ''}
          status={docs.aadhar}
          onStatusChange={(next) => persist({ ...docs, aadhar: next })}
          frontStatus={docs.aadharFront}
          onFrontChange={(next) => persist({ ...docs, aadharFront: next })}
          backStatus={docs.aadharBack}
          onBackChange={(next) => persist({ ...docs, aadharBack: next })}
          onSessionExpired={() => {
            logout();
            openModal('signin', 'customer');
          }}
        />

        <UploadDocumentTile
          icon={<CardIcon />}
          accent="terracotta"
          title="PAN card & signatures"
          description="Upload a clear PAN card photo plus first applicant and co-applicant signatures for the booking application."
          status={docs.pan}
          onUpload={handlePanUpload}
          onVerify={handlePanVerify}
          verifying={verifyingPan}
          uploading={uploadingPan}
          accept="image/jpeg,image/png"
          extra={
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-ink">First applicant signature</p>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleSignatureUpload('applicant', file);
                  event.target.value = '';
                }}
                className="text-xs text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-green file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              {docs.applicantSignature.fileName && (
                <span className="text-[11px] font-semibold text-green">Uploaded - {docs.applicantSignature.fileName}</span>
              )}
              {docs.applicantSignature.error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {docs.applicantSignature.error}
                </p>
              )}
              <p className="mt-2 text-xs font-semibold text-ink">Co-applicant signature</p>
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleSignatureUpload('coApplicant', file);
                  event.target.value = '';
                }}
                className="text-xs text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-green file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              {docs.coApplicantSignature.fileName && (
                <span className="text-[11px] font-semibold text-green">Uploaded - {docs.coApplicantSignature.fileName}</span>
              )}
              {docs.coApplicantSignature.error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {docs.coApplicantSignature.error}
                </p>
              )}
            </div>
          }
        />

        <TileShell
          icon={<FileIcon />}
          accent="green"
          title="Document generation"
          description="Fill the project-specific booking application form, then generate the signed PDF packet."
          statusLabel={genStatusLabel}
          statusTone={genStatusTone}
        >
          {!documentsReady && (
            <p className="mb-3 rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink-muted">
              Upload {missingDocs.join(', ')} above before generating — the PDF includes these photos.
            </p>
          )}
          {!formOpen ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate('/customer/application')}
                className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft"
              >
                Fill application
              </button>
              {docs.bookingApplication.pdfDataUrl && (
                <button
                  type="button"
                  onClick={() => openDataUrl(docs.bookingApplication.pdfDataUrl as string)}
                  className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green"
                >
                  Open application PDF
                </button>
              )}
              {docs.generatedDoc.generated && (
                <button
                  type="button"
                  onClick={handleOpenDocument}
                  disabled={opening}
                  className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {opening ? 'Opening…' : 'Open PDF'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                disabled={!documentsReady}
                className="hidden rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
              >
                {docs.generatedDoc.generated ? 'Generate again' : 'Fill applicant details'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <input
                value={applicantName}
                onChange={(event) => setApplicantName(event.target.value)}
                placeholder="Full name"
                className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
              />
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone"
                className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
              />
              <select
                value={townshipId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setTownshipId(nextId);
                  const next = townshipPricing.find((t) => t.id === nextId);
                  if (next) setPlotSize(next.minSqYd);
                }}
                className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
              >
                {townshipPricing.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={township.minSqYd}
                max={township.maxSqYd}
                value={plotSize}
                onChange={(event) => setPlotSize(Number(event.target.value))}
                className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? 'Generating…' : 'Generate PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {genError && (
            <p role="alert" className="mt-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {genError}
            </p>
          )}

          {docs.generatedDoc.generated && !docs.generatedDoc.signatureVerified && (
            <button
              type="button"
              onClick={handleVerifySignature}
              disabled={verifyingSignature}
              className="mt-2.5 rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifyingSignature ? 'Verifying…' : 'Verify signatures'}
            </button>
          )}
        </TileShell>

      </div>
    </section>
  );
}
