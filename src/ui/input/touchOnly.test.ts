import { describe, expect, it } from 'vitest';
import { isTouchOnly } from './touchOnly.ts';

describe('a device played by touch alone', () => {
  it('is one where nothing hovers and the pointer is coarse', () => {
    // A phone, or a tablet in a browser.
    expect(isTouchOnly(false, true)).toBe(true);
  });

  it('is not a computer, with or without a touch screen', () => {
    // A mouse or a trackpad hovers, with a fine pointer; a laptop with a touch screen answers
    // for its main pointer, which is still the trackpad.
    expect(isTouchOnly(true, false)).toBe(false);
    // A coarse pointer that hovers (a games console, a television's remote): keys may be there.
    expect(isTouchOnly(true, true)).toBe(false);
    // Nothing hovers but the pointer is fine (a stylus): not touch alone.
    expect(isTouchOnly(false, false)).toBe(false);
  });
});
