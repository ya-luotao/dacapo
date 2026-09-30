import { describe, expect, it } from 'vitest';
import type { SpelledPitch } from '../../core/score.ts';
import { grandClefOf, melodySystem, noteReach, positionOn, staffReach } from './melodyLayout.ts';

const p = (text: string): SpelledPitch => {
  const [, step, sign, octave] = /^([A-G])([#b]?)(\d)$/.exec(text)!;
  return {
    step: step as SpelledPitch['step'],
    alter: sign === '#' ? 1 : sign === 'b' ? -1 : 0,
    octave: Number(octave),
  };
};
const line = (text: string) => text.split(' ').map(p);

describe('the staff of a melody', () => {
  it('counts staff positions from the bottom line', () => {
    expect(positionOn(p('E4'), 'treble')).toBe(0);
    expect(positionOn(p('F5'), 'treble')).toBe(8);
    expect(positionOn(p('G2'), 'bass')).toBe(0);
    expect(positionOn(p('C#4'), 'treble')).toBe(-2);
    expect(grandClefOf(p('C4'))).toBe('treble');
    expect(grandClefOf(p('B3'))).toBe('bass');
  });

  it('writes a melody on the one staff that needs the fewest ledger lines', () => {
    expect(melodySystem(line('E4 D4 C4 G4'))).toBe('treble');
    expect(melodySystem(line('G3 A3 B3 C4 D4'))).toBe('bass');
    // Down to G3 in the treble with two ledger lines, up to E5.
    expect(melodySystem(line('G3 C4 E5'))).toBe('treble');
  });

  it('takes the grand staff for a wrong key the other staff would hold', () => {
    expect(melodySystem(line('E4 D4 C4'), p('C2'))).toBe('grand');
    expect(melodySystem(line('E4 D4 C4'), p('A3'))).toBe('treble');
    expect(melodySystem(line('G3 A3 B3'), p('C6'))).toBe('grand');
    // Far above the treble staff the grand staff would not help.
    expect(melodySystem(line('A4 B4 C#5'), p('C8'))).toBe('treble');
  });

  it('makes room for stems, heads and signs past the staff', () => {
    // A5, stem down: the head only.
    expect(noteReach([10], false)).toEqual({ top: 11, bottom: 3 });
    // D4, stem up, with a sharp.
    expect(noteReach([-1], true)).toEqual({ top: 6, bottom: -2 });
    expect(
      staffReach([
        { positions: [-4], accidental: false },
        { positions: [], accidental: false },
      ]),
    ).toEqual({
      above: 0,
      below: 5,
    });
  });
});
