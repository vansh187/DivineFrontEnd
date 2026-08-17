import { useState } from 'react';

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

/** Device type doesn't change mid-session, so this is computed once (lazy
 * initializer) rather than tracked with a resize listener. UA wins for
 * phone-in-desktop-mode edge cases; width breaks the tablet/desktop tie. */
function computeDeviceClass(): DeviceClass {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'desktop';
  if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) return 'mobile';
  if (window.innerWidth < 768) return 'mobile';
  if (window.innerWidth < 1024) return 'tablet';
  return 'desktop';
}

export function useIsMobile(): { isMobile: boolean; deviceClass: DeviceClass } {
  const [deviceClass] = useState<DeviceClass>(computeDeviceClass);
  return { isMobile: deviceClass === 'mobile', deviceClass };
}
