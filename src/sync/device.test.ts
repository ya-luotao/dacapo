import { describe, expect, it } from 'vitest';
import { deviceName } from './device.ts';

const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const WIN_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';
const IPAD_APP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const IPHONE_APP =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

describe('deviceName', () => {
  it('names the browser and the system', () => {
    expect(deviceName(MAC_CHROME, 'web')).toBe('Chrome on Mac');
    expect(deviceName(WIN_EDGE, 'web')).toBe('Edge on Windows');
  });

  it('names the app and the device, telling an iPad from a Mac by its touch points', () => {
    expect(deviceName(IPAD_APP, 'apple', 5)).toBe('dacapo on iPad');
    expect(deviceName(IPAD_APP, 'apple', 0)).toBe('dacapo on Mac');
    expect(deviceName(IPHONE_APP, 'apple', 5)).toBe('dacapo on iPhone');
  });

  it('falls back to what it can tell', () => {
    expect(deviceName('curl/8', 'web')).toBe('Browser');
    expect(deviceName('curl/8', 'apple')).toBe('dacapo on Apple device');
  });
});
