import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { AadhaarPhotoStatus, DocStatus } from '../services/documentStore';
import { CheckIcon, FileIcon, IconBadge } from './DashboardIcons';
import type { IconAccent } from './DashboardIcons';

export type StatusTone = 'done' | 'pending' | 'neutral' | 'failed';
export type { IconAccent };

interface TileShellProps {
  icon: ReactNode;
  title: string;
  description: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  accent?: IconAccent;
  children: ReactNode;
}

const toneClass: Record<StatusTone, string> = {
  done: 'text-green',
  pending: 'text-terracotta',
  neutral: 'text-ink-muted',
  failed: 'text-red-600',
};

export function TileShell({ icon, title, description, statusLabel, statusTone = 'neutral', accent = 'green', children }: TileShellProps) {
  return (
    <div className="group relative flex h-full flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(6,31,45,0.24)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_-24px_rgba(6,31,45,0.28)]">
      {statusTone === 'done' && (
        <span className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-green text-white shadow-[0_4px_14px_-2px_rgba(6,31,45,0.56)] ring-2 ring-surface">
          <CheckIcon />
        </span>
      )}
      <IconBadge icon={icon} accent={accent} interactive />
      <h3 className="mt-4 font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-[1.6] text-ink-muted">{description}</p>
      {statusLabel && <p className={`eyebrow-label mt-3 ${toneClass[statusTone]}`}>{statusLabel}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

interface UploadDocumentTileProps {
  icon: ReactNode;
  title: string;
  description: string;
  status: DocStatus;
  onUpload: (file: File) => void;
  onVerify: () => void;
  verifying: boolean;
  uploading?: boolean;
  accept?: string;
  accent?: IconAccent;
  extra?: ReactNode;
}

export function UploadDocumentTile({
  icon,
  title,
  description,
  status,
  onUpload,
  onVerify,
  verifying,
  uploading = false,
  accept = 'image/*,application/pdf',
  accent,
  extra,
}: UploadDocumentTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const statusLabel = status.verified
    ? 'Verified'
    : status.documentId
      ? 'Uploaded — pending verification'
      : status.error
        ? 'Upload failed'
        : 'Not uploaded';
  const statusTone: StatusTone = status.verified ? 'done' : status.documentId ? 'pending' : status.error ? 'failed' : 'neutral';

  return (
    <TileShell icon={icon} title={title} description={description} statusLabel={statusLabel} statusTone={statusTone} accent={accent}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = '';
        }}
      />

      {status.fileName && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-xs text-ink-muted">
          <span className="shrink-0">
            <FileIcon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{status.fileName}</span>
        </div>
      )}

      {status.error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {status.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : status.fileName ? 'Replace file' : 'Upload file'}
        </button>

        {status.documentId && !status.verified && (
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying}
            className="rounded-full bg-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
        )}
      </div>
      {extra ? <div className="mt-4 border-t border-hairline pt-4">{extra}</div> : null}
    </TileShell>
  );
}

interface PhotoUploadTileProps {
  icon: ReactNode;
  title: string;
  description: string;
  status: AadhaarPhotoStatus;
  onUpload: (file: File) => void;
  uploading?: boolean;
  accent?: IconAccent;
  extra?: ReactNode;
}

/** Plain "upload a photo" tile - no verify step, unlike UploadDocumentTile (used for
 * PAN, which does have one). Used for the mandatory applicant/co-applicant photos on
 * the booking application PDF. */
export function PhotoUploadTile({ icon, title, description, status, onUpload, uploading = false, accent, extra }: PhotoUploadTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const statusLabel = status.documentId ? 'Uploaded' : status.error ? 'Upload failed' : 'Not uploaded';
  const statusTone: StatusTone = status.documentId ? 'done' : status.error ? 'failed' : 'neutral';

  return (
    <TileShell icon={icon} title={title} description={description} statusLabel={statusLabel} statusTone={statusTone} accent={accent}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = '';
        }}
      />

      {status.fileName && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-xs text-ink-muted">
          <span className="shrink-0">
            <FileIcon className="h-3.5 w-3.5" />
          </span>
          <span className="truncate">{status.fileName}</span>
        </div>
      )}

      {status.error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {status.error}
        </p>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? 'Uploading…' : status.fileName ? 'Replace photo' : 'Upload photo'}
      </button>
      {extra ? <div className="mt-4 border-t border-hairline pt-4">{extra}</div> : null}
    </TileShell>
  );
}
