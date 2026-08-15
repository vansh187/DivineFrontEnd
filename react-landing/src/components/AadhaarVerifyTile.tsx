import { useRef, useState } from 'react';
import { verifyAadhaarQr, verifyAadhaarXml } from '../services/kycApi';
import type { AadhaarVerifyResult } from '../services/kycApi';
import { ApiError } from '../services/authApi';
import type { AadhaarStatus } from '../services/documentStore';
import { TileShell } from './DocumentTile';
import { IdCardIcon } from './DashboardIcons';

type Method = 'qr' | 'xml';

function failureMessage(reason: string | null): string {
  if (!reason) return 'Verification failed. Please try again.';
  if (reason === 'signature_invalid') {
    return "This card's QR signature couldn't be verified. Try a different photo, or contact support if this is a genuine card.";
  }
  if (reason.startsWith('xml_signature_invalid')) {
    return "This document's UIDAI signature couldn't be verified. Contact support if you believe this is genuine.";
  }
  return 'Verification failed. Please try again.';
}

function FileField({ label, file, onChange, accept }: { label: string; file: File | null; onChange: (file: File | null) => void; accept: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-hairline bg-bg px-2.5 py-2 text-xs">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="shrink-0 rounded-full border border-hairline px-3 py-1 font-semibold text-ink transition-colors hover:border-green hover:text-green"
      >
        {label}
      </button>
      <span className="truncate text-ink-muted">{file ? file.name : 'No file chosen'}</span>
    </div>
  );
}

interface AadhaarVerifyTileProps {
  token: string;
  status: AadhaarStatus;
  onChange: (next: AadhaarStatus) => void;
  onSessionExpired: () => void;
}

export function AadhaarVerifyTile({ token, status, onChange, onSessionExpired }: AadhaarVerifyTileProps) {
  const [method, setMethod] = useState<Method>('qr');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [shareCode, setShareCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusLabel = status.verified ? 'Verified' : 'Not verified';
  const statusTone = status.verified ? 'done' : 'failed';

  const describeError = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 401) onSessionExpired();
      return err.message;
    }
    return 'Something went wrong. Please try again.';
  };

  const applyResult = (result: AadhaarVerifyResult) => {
    setError(null);
    onChange({
      verified: result.verified,
      verifiedAt: result.verified ? new Date().toISOString() : status.verifiedAt,
      method: result.method,
      maskedAadhaar: result.masked_aadhaar,
      name: result.extracted_data?.name ?? null,
      lastAttemptError: result.verified ? null : failureMessage(result.failure_reason),
    });
  };

  const handleVerifyQr = async () => {
    const files = [backFile, frontFile].filter((f): f is File => !!f);
    if (files.length === 0) {
      setError('Upload at least one side of your Aadhaar card.');
      return;
    }
    setVerifying(true);
    setError(null);
    setNotice(null);
    try {
      for (let i = 0; i < files.length; i++) {
        const isLast = i === files.length - 1;
        try {
          const result = await verifyAadhaarQr(token, files[i]);
          applyResult(result);
          return;
        } catch (err) {
          const qrNotFound = err instanceof ApiError && err.detail === 'qr_not_found';
          if (qrNotFound && !isLast) {
            setNotice("Couldn't find a QR code on that side — trying the other side…");
            continue;
          }
          setError(
            qrNotFound
              ? "We couldn't find a QR code on either photo. Try a clearer, well-lit photo with the card held flat."
              : describeError(err),
          );
          return;
        }
      }
    } finally {
      setVerifying(false);
      setNotice(null);
    }
  };

  const handleVerifyXml = async () => {
    if (!xmlFile) {
      setError('Upload the ZIP file from UIDAI.');
      return;
    }
    if (!shareCode.trim()) {
      setError('Enter your share code.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyAadhaarXml(token, xmlFile, shareCode.trim());
      applyResult(result);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <TileShell
      icon={<IdCardIcon />}
      title="Aadhaar card"
      description="Verify your identity with UIDAI — choose how you'd like to verify."
      statusLabel={statusLabel}
      statusTone={statusTone}
    >
      {status.verified ? (
        <div className="flex flex-col gap-1 text-xs text-ink-muted">
          <p>
            <span className="font-semibold text-ink">{status.name ?? 'Verified'}</span>
            {status.maskedAadhaar ? ` · ${status.maskedAadhaar}` : ''}
          </p>
          <p>
            Verified via {status.method === 'qr' ? 'QR code' : 'Offline e-KYC'}
            {status.verifiedAt ? ` on ${new Date(status.verifiedAt).toLocaleDateString('en-IN')}` : ''}.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-ink">
            Verification method
            <select
              value={method}
              onChange={(event) => {
                setMethod(event.target.value as Method);
                setError(null);
                setNotice(null);
              }}
              className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
            >
              <option value="qr">Aadhaar card photo (QR code)</option>
              <option value="xml">Offline e-KYC (UIDAI ZIP + share code)</option>
            </select>
          </label>

          {method === 'qr' ? (
            <div className="flex flex-col gap-2">
              <FileField label="Front side" file={frontFile} onChange={setFrontFile} accept="image/jpeg,image/png" />
              <FileField label="Back side" file={backFile} onChange={setBackFile} accept="image/jpeg,image/png" />
              <p className="text-[11px] leading-snug text-ink-muted">
                Upload at least one clear, well-lit side showing the QR code. JPG or PNG only.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <FileField label="UIDAI ZIP file" file={xmlFile} onChange={setXmlFile} accept=".zip,application/zip,application/x-zip-compressed" />
              <input
                value={shareCode}
                onChange={(event) => setShareCode(event.target.value)}
                placeholder="Share code"
                className="rounded-lg border border-hairline bg-bg px-3 py-2 text-xs text-ink outline-none focus:border-green"
              />
              <p className="text-[11px] leading-snug text-ink-muted">
                Get this ZIP from{' '}
                <a href="https://myaadhaar.uidai.gov.in" target="_blank" rel="noopener noreferrer" className="text-chrome hover:underline">
                  myaadhaar.uidai.gov.in
                </a>{' '}
                → Offline eKYC, using the share code you set there.
              </p>
            </div>
          )}

          {notice && <p className="text-xs font-medium text-terracotta">{notice}</p>}

          {(error || status.lastAttemptError) && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error ?? status.lastAttemptError}
            </p>
          )}

          <button
            type="button"
            onClick={method === 'qr' ? handleVerifyQr : handleVerifyXml}
            disabled={verifying}
            className="self-start rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify Aadhaar'}
          </button>
        </div>
      )}
    </TileShell>
  );
}
