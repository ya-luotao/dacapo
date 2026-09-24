import { describe, expect, it } from 'vitest';
import { BLACK_OFFSETS, BLACK_WIDTH, pianoLayout, velocityOpacity } from './layout.ts';

const full = pianoLayout();
const byMidi = new Map(full.keys.map((k) => [k.midi, k]));
const key = (midi: number) => byMidi.get(midi)!;
const centre = (midi: number) => key(midi).left + key(midi).width / 2;

describe('pianoLayout', () => {
  it('lays out 88 keys, 52 white, from A0 at 0 to C8 at 51', () => {
    expect(full.keys).toHaveLength(88);
    expect(full.width).toBe(52);
    expect(full.keys.filter((k) => !k.black)).toHaveLength(52);
    expect(full.keys[0]).toEqual({ midi: 21, black: false, left: 0, width: 1 });
    expect(full.keys.at(-1)).toEqual({ midi: 108, black: false, left: 51, width: 1 });
    expect(key(60).left).toBe(23); // middle C is the 24th white key
  });

  it('uses the real black/white width ratio', () => {
    expect(BLACK_WIDTH).toBeCloseTo(13.7 / 23.5, 6);
    expect(key(61).width).toBe(BLACK_WIDTH);
  });

  it('places black keys off-centre like a real piano, not evenly', () => {
    // Gap between C and D is at 24 for octave 4, etc.
    expect(centre(61)).toBeLessThan(24); // C♯ leans left
    expect(centre(63)).toBeGreaterThan(25); // D♯ leans right
    expect(centre(66)).toBeLessThan(27); // F♯ leans left
    expect(centre(68)).toBeCloseTo(28, 9); // G♯ centred
    expect(centre(70)).toBeGreaterThan(29); // A♯ leans right
    expect(BLACK_OFFSETS[1]).toBeCloseTo(-BLACK_OFFSETS[3]!, 9);
    expect(BLACK_OFFSETS[6]).toBeCloseTo(-BLACK_OFFSETS[10]!, 9);
    expect(Math.abs(BLACK_OFFSETS[6]!)).toBeGreaterThan(Math.abs(BLACK_OFFSETS[1]!));
  });

  it('spaces the black keys evenly within each group', () => {
    const gaps = (midis: number[]) =>
      midis.slice(1).map((m, i) => key(m).left - (key(midis[i]!).left + key(midis[i]!).width));
    // Space from C's left edge to C♯ = C♯ to D♯ = D♯ to E's right edge.
    const [c1] = gaps([61, 63]);
    expect(key(61).left - key(60).left).toBeCloseTo(c1!, 9);
    expect(key(64).left + 1 - (key(63).left + key(63).width)).toBeCloseTo(c1!, 9);
    const [f1, f2] = gaps([66, 68, 70]);
    expect(f1).toBeCloseTo(f2!, 9);
    expect(key(66).left - key(65).left).toBeCloseTo(f1!, 9);
  });

  it('keeps every black key over its two white neighbours and apart from other blacks', () => {
    const blacks = full.keys.filter((k) => k.black);
    for (const b of blacks) {
      expect(b.left).toBeGreaterThan(key(b.midi - 1).left);
      expect(b.left + b.width).toBeLessThan(key(b.midi + 1).left + 1);
    }
    for (let i = 1; i < blacks.length; i++) {
      expect(blacks[i]!.left).toBeGreaterThan(blacks[i - 1]!.left + blacks[i - 1]!.width);
    }
    // A♯0 is the first black key and has the same shape as every other A♯.
    expect(centre(22) - 1).toBeCloseTo(centre(70) - 29, 9);
  });

  it('repeats identically every octave', () => {
    for (let midi = 24; midi + 12 <= 108; midi++) {
      expect(key(midi + 12).left - key(midi).left).toBeCloseTo(7, 9);
    }
  });

  it('supports a partial range and rejects black-key edges', () => {
    const octave = pianoLayout(60, 72);
    expect(octave.width).toBe(8);
    expect(octave.keys[0]?.left).toBe(0);
    expect(() => pianoLayout(61, 72)).toThrow(RangeError);
    expect(() => pianoLayout(60, 70)).toThrow(RangeError);
  });
});

describe('velocityOpacity', () => {
  it('rises with velocity and stays visible for the softest note', () => {
    expect(velocityOpacity(1)).toBeGreaterThan(0.35);
    expect(velocityOpacity(64)).toBeGreaterThan(velocityOpacity(32));
    expect(velocityOpacity(127)).toBe(1);
    expect(velocityOpacity(200)).toBe(1);
    expect(velocityOpacity(0)).toBe(0.35);
  });
});
