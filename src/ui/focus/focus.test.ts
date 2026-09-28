import { describe, expect, it } from 'vitest';
import { parseZoom, stepZoom, ZOOMS } from './focus.ts';

describe('parseZoom', () => {
  it('takes the closest size offered, and 1 for anything unreadable', () => {
    expect(parseZoom('1.3')).toBe(1.3);
    expect(parseZoom('1.32')).toBe(1.3);
    expect(parseZoom('9')).toBe(2);
    expect(parseZoom('0.1')).toBe(0.85);
    expect(parseZoom(null)).toBe(1);
    expect(parseZoom('large')).toBe(1);
  });
});

describe('stepZoom', () => {
  it('steps through the sizes and stops at either end', () => {
    expect(stepZoom(1, 1)).toBe(1.15);
    expect(stepZoom(1, -1)).toBe(0.85);
    expect(stepZoom(ZOOMS[0], -1)).toBeNull();
    expect(stepZoom(ZOOMS.at(-1)!, 1)).toBeNull();
  });
});
