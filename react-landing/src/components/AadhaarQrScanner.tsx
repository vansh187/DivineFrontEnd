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
        // Ask for the highest resolution the device offers, in its natural
        // aspect ratio — a forced square crop here previously made most
        // cameras negotiate a lower fallback mode. More native pixels on
        // the QR patch is what actually fixes qr_not_found, not the guide
        // box or pinch-zoom (which just upscales/blurs existing pixels).
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
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

      // Best-effort: keep autofocus continuously locking on, since a
      // close-up document scan easily drifts out of a fixed focal plane.
      // Non-standard constraint — browsers that don't support it just
      // ignore it rather than throwing.
      const [videoTrack] = stream.getVideoTracks();
      videoTrack?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet] }).catch(() => {});

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
          <div className="relative flex h-[62vh] max-h-[460px] min-h-[280px] w-full items-center justify-center overflow-hidden bg-black">
            {/* object-contain (not cover) so the guide box below matches exactly
                what's actually captured — no hidden crop the user can't see. */}
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="h-full w-full object-contain" muted playsInline autoPlay />
            <canvas ref={canvasRef} className="hidden" />
            {/* Fixed small size, not a percentage of the frame — this is roughly
                how large an Aadhaar QR patch actually looks at a comfortable,
                in-focus distance. Pinch-zooming to fill a bigger box just
                upscales and blurs; moving physically closer (within focus
                range) is what raises real resolution. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={`h-36 w-36 rounded-xl border-[3px] transition-colors sm:h-44 sm:w-44 ${found ? 'border-green' : 'border-white/70'}`} />
            </div>
            <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-semibold text-white drop-shadow">
              {found ? 'QR found — verifying…' : "Fit the QR code inside the box. Move closer if it's small — don't pinch-zoom, it blurs the image."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
