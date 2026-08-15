import { useRef } from 'react';
import type { ReactNode } from 'react';
import type { DocStatus } from '../services/documentStore';
import { CheckIcon, FileIcon } from './DashboardIcons';

type StatusTone = 'done' | 'pending' | 'neutral' | 'failed';

interface TileShellProps {
  icon: ReactNode;
  title: string;
  description: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  children: ReactNode;
}

const toneClass: Record<StatusTone, string> = {
  done: 'text-green',
  pending: 'text-terracotta',
  neutral: 'text-ink-muted',
  failed: 'text-red-600',
};

export function TileShell({ icon, title, description, statusLabel, statusTone = 'neutral', children }: TileShellProps) {
  return (
    <div className="relative rounded-2xl border border-hairline bg-surface p-6 shadow-[0_16px_40px_-26px_rgba(30,77,59,0.3)]">
      {statusTone === 'done' && (
        <span className="absolute right-5 top-5 flex h-7 w-7 items-center justify-center rounded-full bg-green text-white">
          <CheckIcon />
        </span>
      )}
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg text-chrome">{icon}</span>
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
  accept?: string;
}

export function UploadDocumentTile({ icon, title, description, status, onUpload, onVerify, verifying, accept = 'image/*,application/pdf' }: UploadDocumentTileProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const statusLabel = status.verified ? 'Verified' : status.fileName ? 'Uploaded — pending verification' : 'Not uploaded';
  const statusTone: StatusTone = status.verified ? 'done' : status.fileName ? 'pending' : 'neutral';

  return (
    <TileShell icon={icon} title={title} description={description} statusLabel={statusLabel} statusTone={statusTone}>
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
          <span className="h-3.5 w-3.5 shrink-0">
            <FileIcon />
          </span>
          <span className="truncate">{status.fileName}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green"
        >
          {status.fileName ? 'Replace file' : 'Upload file'}
        </button>

        {status.fileName && !status.verified && (
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
    </TileShell>
  );
}
