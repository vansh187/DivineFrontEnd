import { useRef, useState } from 'react';
import { verifyAadhaarQr } from '../services/kycApi';
import type { AadhaarVerifyResult } from '../services/kycApi';
import { uploadAadhaarPhoto } from '../services/documentsApi';
import type { AadhaarPhotoSide } from '../services/documentsApi';
import { ApiError } from '../services/authApi';
import type { AadhaarStatus, AadhaarPhotoStatus } from '../services/documentStore';
import { TileShell } from './DocumentTile';
import { IdCardIcon } from './DashboardIcons';

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

function FileField({
  label,
  file,
  onChange,
  accept,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  accept: string;
}) {
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

function PhotoUploadRow({
  label,
  status,
  file,
  onFileChange,
  onUpload,
  uploading,
}: {
  label: string;
  status: AadhaarPhotoStatus;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onUpload: () => void;
  uploading: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-hairline pt-3">
      <p className="text-xs font-semibold text-ink">{label}</p>
      <FileField label="Choose file" file={file} onChange={onFileChange} accept="image/jpeg,image/png" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUpload}
          disabled={uploading || !file}
          className="self-start rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {status.fileName && !status.error && (
          <span className="text-[11px] font-semibold text-green">Uploaded — {status.fileName}</span>
        )}
      </div>
      {status.error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {status.error}
        </p>
      )}
    </div>
  );
}

interface AadhaarVerifyTileProps {
  token: string;
  status: AadhaarStatus;
  onStatusChange: (next: AadhaarStatus) => void;
  frontStatus: AadhaarPhotoStatus;
  onFrontChange: (next: AadhaarPhotoStatus) => void;
  backStatus: AadhaarPhotoStatus;
  onBackChange: (next: AadhaarPhotoStatus) => void;
  onSessionExpired: () => void;
}

export function AadhaarVerifyTile({
  token,
  status,
  onStatusChange,
  frontStatus,
  onFrontChange,
  backStatus,
  onBackChange,
  onSessionExpired,
}: AadhaarVerifyTileProps) {
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [uploadingFront, setUploadingFront] = useState(false);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [uploadingBack, setUploadingBack] = useState(false);

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
    onStatusChange({
      verified: result.verified,
      verifiedAt: result.verified ? new Date().toISOString() : status.verifiedAt,
      method: result.method,
      maskedAadhaar: result.masked_aadhaar,
      name: result.extracted_data?.name ?? null,
      lastAttemptError: result.verified ? null : failureMessage(result.failure_reason),
    });
  };

  const handleVerifyQr = async () => {
    if (!qrFile) {
      setError('Choose a QR code image to verify.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyAadhaarQr(token, qrFile);
      applyResult(result);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setVerifying(false);
    }
  };

  const handleUploadPhoto = async (
    side: AadhaarPhotoSide,
    file: File | null,
    setUploading: (value: boolean) => void,
    onChange: (next: AadhaarPhotoStatus) => void,
  ) => {
    if (!file) return;
    setUploading(true);
    try {
      const doc = await uploadAadhaarPhoto(token, file, side);
      onChange({
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        documentId: doc.id,
        signedUrl: doc.signed_url,
        signedUrlExpiresAt: Date.now() + doc.signed_url_expires_in * 1000,
        error: null,
      });
    } catch (err) {
      onChange({
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: null,
        documentId: null,
        signedUrl: null,
        signedUrlExpiresAt: null,
        error: describeError(err),
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <TileShell
      icon={<IdCardIcon />}
      accent="chrome"
      title="Aadhaar card"
      description="Upload your Aadhaar QR code to verify with UIDAI, and front/back photos for your records."
      statusLabel={statusLabel}
      statusTone={statusTone}
    >
      <div className="flex flex-col gap-3">
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
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-ink">QR code (for KYC verification)</p>
            <FileField label="Choose QR image" file={qrFile} onChange={setQrFile} accept="image/jpeg,image/png" />
            <button
              type="button"
              onClick={handleVerifyQr}
              disabled={verifying}
              className="self-start rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {verifying ? 'Verifying…' : 'Verify QR'}
            </button>
            {(error || status.lastAttemptError) && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error ?? status.lastAttemptError}
              </p>
            )}
          </div>
        )}

        <PhotoUploadRow
          label="Aadhaar front photo"
          status={frontStatus}
          file={frontFile}
          onFileChange={setFrontFile}
          onUpload={() => handleUploadPhoto('front', frontFile, setUploadingFront, onFrontChange)}
          uploading={uploadingFront}
        />

        <PhotoUploadRow
          label="Aadhaar back photo"
          status={backStatus}
          file={backFile}
          onFileChange={setBackFile}
          onUpload={() => handleUploadPhoto('back', backFile, setUploadingBack, onBackChange)}
          uploading={uploadingBack}
        />
      </div>
    </TileShell>
  );
}
