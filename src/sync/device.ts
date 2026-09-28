import type { Shell } from '../lib/shell.ts';

/**
 * A name for this device, stored with its sign-in so the account can tell its devices apart
 * ("Chrome on Mac", "dacapo on iPad"). Only the kind of device and browser: nothing identifying.
 */
export function deviceName(
  userAgent: string,
  shell: Shell,
  /** `navigator.maxTouchPoints`: an iPad asks for the desktop site and says Macintosh. */
  touchPoints = 0,
): string {
  const system = /iPad/.test(userAgent)
    ? 'iPad'
    : /iPhone/.test(userAgent)
      ? 'iPhone'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(userAgent)
          ? touchPoints > 1
            ? 'iPad'
            : 'Mac'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /CrOS/.test(userAgent)
              ? 'ChromeOS'
              : /Linux/.test(userAgent)
                ? 'Linux'
                : null;
  if (shell === 'apple') return `dacapo on ${system ?? 'Apple device'}`;
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Browser';
  return system ? `${browser} on ${system}` : browser;
}
