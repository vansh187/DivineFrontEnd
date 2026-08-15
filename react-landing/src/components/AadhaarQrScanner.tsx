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

interface QrCorners {
  topLeftCorner: { x: number; y: number };
  topRightCorner: { x: number; y: number };
  bottomLeftCorner: { x: number; y: number };
  bottomRightCorner: { x: number; y: number };
}

/** Crop tightly to the QR's own bounding box (+25% padding) so the image we
 * upload has far more effective pixel density on the QR patch than a full
 * card photo would — this is what actually fixes qr_not_found on genuine
 * cards, not just a nicer UI. */
function cropToQr(source: HTMLCanvasElement, location: QrCorners): HTMLCanvasElement {
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

function scalePoint(p: { x: number; y: number }, scaleX: number, scaleY: number) {
  return { x: p.x * scaleX, y: p.y * scaleY };
}

/** jsQR runs on a small downscaled frame every tick — cheap enough not to
 * freeze the page. Its coordinates need scaling back up to the native video
 * resolution before we crop, so the uploaded image still has full quality. */
function scaleLocation(location: QRCode['location'], scaleX: number, scaleY: number): QrCorners {
  return {
    topLeftCorner: scalePoint(location.topLeftCorner, scaleX, scaleY),
    topRightCorner: scalePoint(location.topRightCorner, scaleX, scaleY),
    bottomLeftCorner: scalePoint(location.bottomLeftCorner, scaleX, scaleY),
    bottomRightCorner: scalePoint(location.bottomRightCorner, scaleX, scaleY),
  };
}

/** jsQR only needs enough pixels to locate + read module boundaries, not the
 * full native frame — analyzing a multi-megapixel buffer 8x/second is what
 * was freezing the page on phones with high-res rear cameras. 960 gives a
 * genuinely small/dense QR more to work with than 640 did, while still
 * being far cheaper than the native frame. */
const DETECTION_MAX_DIM = 960;

const CloseIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
    <path d="M5 5l10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const TorchIcon = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 2.5h6l-1 5h2l-6.5 9 1.5-6.5H6.5L7 2.5Z" />
  </svg>
);

interface AadhaarQrScannerProps {
  onCapture: (file: File) => void;
  onCancel: () => void;
}

const HINT_STAGES = [
  "Fit the QR code inside the box.",
  "Fit the QR code inside the box. Hold the phone steady and let it focus.",
  "Still looking — move a little closer or further until the pattern looks sharp, not blurry. Low light? Try the torch.",
] as const;

export function AadhaarQrScanner({ onCapture, onCancel }: AadhaarQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const rafRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const lastScanRef = useRef(0);
  const scanStartRef = useRef(0);
  const hintTimerRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hintStage, setHintStage] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  /** Auto-detect requires jsQR to actually lock onto the QR first — if the
   * live feed never gets sharp enough for that (common on some phones at
   * close range), there was previously no way to submit anything at all.
   * This lets the user force a capture of whatever's in the guide box right
   * now, so they're not stuck waiting on a detector that may never fire. */
  const captureNow = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight || stoppedRef.current || !cameraReady) return;
    stoppedRef.current = true;
    setFound(true);
    if (hintTimerRef.current) window.clearInterval(hintTimerRef.current);

    const fullFrame = document.createElement('canvas');
    fullFrame.width = v.videoWidth;
    fullFrame.height = v.videoHeight;
    fullFrame.getContext('2d')?.drawImage(v, 0, 0, v.videoWidth, v.videoHeight);

    // We don't know exactly where the QR is without jsQR, so approximate
    // with a generous center crop — roughly matching the on-screen guide
    // box, which is always centered.
    const shortSide = Math.min(v.videoWidth, v.videoHeight);
    const cropSize = shortSide * 0.55;
    const cropX = (v.videoWidth - cropSize) / 2;
    const cropY = (v.videoHeight - cropSize) / 2;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropSize;
    cropCanvas.height = cropSize;
    cropCanvas.getContext('2d')?.drawImage(fullFrame, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

    stopStream();
    cropCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], 'aadhaar-qr-manual.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.95,
    );
  };

  useEffect(() => {
    stoppedRef.current = false;
    let cancelled = false;

    const handleDetected = (detectionWidth: number, detectionHeight: number, location: QRCode['location']) => {
      const v = videoRef.current;
      if (!v || !v.videoWidth || !v.videoHeight) return;
      stoppedRef.current = true;
      setFound(true);
      if (hintTimerRef.current) window.clearInterval(hintTimerRef.current);

      // One-time full-resolution grab, only now that we know where to crop —
      // this is the only place a full-size frame gets touched.
      const fullFrame = document.createElement('canvas');
      fullFrame.width = v.videoWidth;
      fullFrame.height = v.videoHeight;
      fullFrame.getContext('2d')?.drawImage(v, 0, 0, v.videoWidth, v.videoHeight);

      const scaled = scaleLocation(location, v.videoWidth / detectionWidth, v.videoHeight / detectionHeight);
      const cropped = cropToQr(fullFrame, scaled);
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
        // 1080p in the camera's natural aspect ratio — a forced square
        // request here previously made most cameras negotiate a worse
        // fallback mode. Going higher than this (e.g. 4K) buys little on
        // the final crop but costs real decode/processing overhead on
        // mid-range phones, which was freezing the page.
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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

      // Best-effort: keep focus, exposure, and white balance continuously
      // adjusting rather than locked to whatever the camera opened with —
      // a dim/soft opening frame (common on close-up document scans) can
      // otherwise persist for the whole session. Non-standard constraints;
      // browsers that don't support them just ignore them.
      const [videoTrack] = stream.getVideoTracks();
      videoTrackRef.current = videoTrack ?? null;
      videoTrack
        ?.applyConstraints({
          advanced: [{ focusMode: 'continuous', exposureMode: 'continuous', whiteBalanceMode: 'continuous' } as unknown as MediaTrackConstraintSet],
        })
        .catch(() => {});

      // Best-effort: some phones expose a torch (flashlight) control on the
      // rear camera track. Low light forces a slower shutter, which is a
      // common cause of the motion-blur users hit when scanning up close.
      const caps = videoTrack?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      if (!cancelled && caps?.torch) setTorchSupported(true);

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});
      if (!cancelled && video.videoWidth && video.videoHeight) setCameraReady(true);

      const { default: jsQR } = await import('jsqr');
      if (cancelled) return;

      scanStartRef.current = performance.now();
      hintTimerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - scanStartRef.current;
        setHintStage(elapsed > 9000 ? 2 : elapsed > 4000 ? 1 : 0);
      }, 1000);

      const scanLoop = (timestamp: number) => {
        if (stoppedRef.current || cancelled) return;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (v && canvas && v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth && v.videoHeight && timestamp - lastScanRef.current > 100) {
          lastScanRef.current = timestamp;
          const scale = Math.min(1, DETECTION_MAX_DIM / Math.max(v.videoWidth, v.videoHeight));
          const dw = Math.max(1, Math.round(v.videoWidth * scale));
          const dh = Math.max(1, Math.round(v.videoHeight * scale));
          if (canvas.width !== dw) canvas.width = dw;
          if (canvas.height !== dh) canvas.height = dh;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(v, 0, 0, dw, dh);
            const imageData = ctx.getImageData(0, 0, dw, dh);
            const code = jsQR(imageData.data, dw, dh);
            if (code) {
              handleDetected(dw, dh, code.location);
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
      if (hintTimerRef.current) window.clearInterval(hintTimerRef.current);
      stopStream();
    };
  }, [onCapture]);

  const toggleTorch = async () => {
    const track = videoTrackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet] });
      setTorchOn((v) => !v);
    } catch {
      // Some devices report the capability but reject the constraint — no
      // harm done, the toggle just stays off.
    }
  };

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
            {torchSupported && !found && (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                aria-label={torchOn ? 'Turn off torch' : 'Turn on torch'}
                aria-pressed={torchOn}
                className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  torchOn ? 'border-white bg-white text-ink' : 'border-white/40 bg-black/40 text-white hover:bg-black/60'
                }`}
              >
                <TorchIcon on={torchOn} />
              </button>
            )}
            {!found && cameraReady && (
              <button
                type="button"
                onClick={captureNow}
                className="absolute bottom-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/50 bg-black/50 px-3.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-black/70"
              >
                Not locking on? Capture anyway
              </button>
            )}
            <p className="pointer-events-none absolute inset-x-0 bottom-4 px-4 text-center text-xs font-semibold text-white drop-shadow">
              {found ? 'Captured — verifying…' : HINT_STAGES[hintStage]}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
