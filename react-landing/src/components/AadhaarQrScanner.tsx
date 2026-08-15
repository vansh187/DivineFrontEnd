import { useEffect, useRef, useState } from 'react';
import type { QRCode } from 'jsqr';

type ScanErrorKind = 'denied' | 'not-found' | 'in-use' | 'unsupported' | 'unknown';

function messageForScanError(kind: ScanErrorKind): string {
  switch (kind) {
    case 'denied':
      return "Camera access was denied. Allow camera access in your browser's settings, or upload a photo instead.";
    case 'not-found':
      return 'No camera was found on this device. Please upload a photo instead.';
    case 'in-use':
      return 'Your camera is being used by another app. Close it and try again, or upload a photo instead.';
    case 'unsupported':
      return "Camera scanning isn't supported in this browser. Please upload a photo instead.";
    default:
      return "Couldn't start the camera. Please upload a photo instead.";
  }
}

function errorKindFor(err: unknown): ScanErrorKind {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found';
  if (name === 'NotReadableError') return 'in-use';
  return 'unknown';
}

/** No audio asset needed — a short sine-wave beep synthesized on the fly. */
function playBeep() {
  try {
    const AudioCtxCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;
    const ctx = new AudioCtxCtor();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
    oscillator.onended = () => {
      void ctx.close();
    };
  } catch {
    // Best effort — a missing beep shouldn't block verification.
  }
}

/** Crop tightly to the QR's own bounding box (+25% padding) so the image we
 * upload has far more effective pixel density on the QR patch than a full
 * card photo would — this is what actually fixes qr_not_found on genuine
 * cards, not just a nicer UI. */
function cropToQr(source: HTMLCanvasElement, location: QRCode['location']): HTMLCanvasElement {
  const xs = [location.topLeftCorner.x, location.topRightCorner.x, location.bottomLeftCorner.x, location.bottomRightCorner.x];
  const ys = [location.topLeftCorner.y, location.topRightCorner.y, location.bottomLeftCorner.y, location.bottomRightCorner.y];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = Math.max(maxX - minX, maxY - minY) * 0.25;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(source.width - cropX, maxX - minX + pad * 2);
  const cropH = Math.min(source.height - cropY, maxY - minY + pad * 2);

  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  cropCanvas.getContext('2d')?.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return cropCanvas;
}

const CloseIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
    <path d="M5 5l10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

interface AadhaarQrScannerProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

export function AadhaarQrScanner({ onCapture, onCancel }: AadhaarQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const lastScanRef = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState(false);

  useEffect(() => {
    stoppedRef.current = false;
    let cancelled = false;

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const handleDetected = (canvas: HTMLCanvasElement, location: QRCode['location']) => {
      stoppedRef.current = true;
      setFound(true);
      const cropped = cropToQr(canvas, location);
      playBeep();
      stopStream();
      cropped.toBlob(
        (blob) => {
          if (!blob) return;
          onCapture(new File([blob], 'aadhaar-qr.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.95,
      );
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(messageForScanError('unsupported'));
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
      } catch (err) {
        if (!cancelled) setError(messageForScanError(errorKindFor(err)));
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const { default: jsQR } = await import('jsqr');
      if (cancelled) return;

      const scanLoop = (timestamp: number) => {
        if (stoppedRef.current || cancelled) return;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (v && canvas && v.readyState >= v.HAVE_ENOUGH_DATA && timestamp - lastScanRef.current > 120) {
          lastScanRef.current = timestamp;
          if (v.videoWidth && canvas.width !== v.videoWidth) canvas.width = v.videoWidth;
          if (v.videoHeight && canvas.height !== v.videoHeight) canvas.height = v.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx && canvas.width && canvas.height) {
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
              handleDetected(canvas, code.location);
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(scanLoop);
      };

      rafRef.current = requestAnimationFrame(scanLoop);
    };

    void start();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopStream();
    };
  }, [onCapture]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-hairline bg-surface shadow-[0_50px_140px_-30px_rgba(10,14,10,0.6)]">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <p className="font-display text-base font-bold text-ink">Scan Aadhaar QR code</p>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        {error ? (
          <div className="flex flex-col gap-4 p-6">
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="self-start rounded-full border border-hairline px-4 py-2 text-xs font-semibold text-ink transition-colors hover:border-green hover:text-green"
            >
              Upload a photo instead
            </button>
          </div>
        ) : (
          <div className="relative aspect-square w-full overflow-hidden bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
              <div className={`h-full w-full rounded-2xl border-[3px] transition-colors ${found ? 'border-green' : 'border-white/70'}`} />
            </div>
            <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-semibold text-white drop-shadow">
              {found ? 'QR found — verifying…' : 'Point your camera at the QR code on your Aadhaar card'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
