import { describe, expect, it } from 'vitest';
import { closeVoicings, leadVoices, motion, parallels } from './voiceLeading.ts';

const C = [0, 4, 7];
const F = [5, 9, 0];
const G = [7, 11, 2];

describe('closeVoicings', () => {
  it('lists every inversion in every octave within the range, lowest first', () => {
    expect(closeVoicings(C, 60, 72)).toEqual([
      [60, 64, 67],
      [64, 67, 72],
    ]);
    expect(closeVoicings(C, 60, 79)).toEqual([
      [60, 64, 67],
      [64, 67, 72],
      [67, 72, 76],
      [72, 76, 79],
    ]);
  });

  it('stacks a seventh chord within the octave', () => {
    for (const v of closeVoicings([2, 5, 9, 0], 60, 84)) {
      expect(v.at(-1)! - v[0]!).toBeLessThan(12);
      expect(new Set(v.map((m) => m % 12))).toEqual(new Set([2, 5, 9, 0]));
    }
  });
});

describe('motion and parallels', () => {
  it('counts each voice’s semitones, voices paired low to high', () => {
    expect(motion([64, 67, 72], [65, 69, 72])).toBe(3);
    expect(motion([62, 65, 67, 71], [60, 64, 67, 71])).toBe(3);
  });

  it('finds parallel fifths and octaves, the bass and the top apart', () => {
    // F A C over F to G B D over G: every voice up a step.
    expect(parallels({ bass: 41, upper: [65, 69, 72] }, { bass: 43, upper: [67, 71, 74] })).toEqual(
      { outer: 1, inner: 2 },
    );
    // Contrary motion: none.
    expect(parallels({ bass: 41, upper: [65, 69, 72] }, { bass: 43, upper: [62, 67, 71] })).toEqual(
      { outer: 0, inner: 0 },
    );
    // A common tone held is no parallel.
    expect(parallels({ bass: 48, upper: [64, 67, 72] }, { bass: 48, upper: [64, 67, 72] })).toEqual(
      { outer: 0, inner: 0 },
    );
  });
});

describe('leadVoices', () => {
  const chord = (pcs: number[], bass: number) => ({ pcs, bass, floor: 60 });
  const options = { low: 60, high: 84, center: 67, cyclic: false };

  it('voices I–IV–V–I as keyboard harmony does: common tones held, IV to V against the bass', () => {
    expect(leadVoices([chord(C, 48), chord(F, 41), chord(G, 43), chord(C, 48)], options)).toEqual([
      [64, 67, 72],
      [65, 69, 72],
      [62, 67, 71],
      [64, 67, 72],
    ]);
  });

  it('keeps above the floor', () => {
    const [v] = leadVoices([{ pcs: C, bass: 48, floor: 65 }], options);
    expect(v![0]).toBeGreaterThanOrEqual(65);
  });

  it('starts from a given voicing', () => {
    const [first, second] = leadVoices([chord(C, 48), chord(G, 43)], {
      ...options,
      first: [67, 72, 76],
    });
    expect(first).toEqual([67, 72, 76]);
    expect(second).toEqual([67, 71, 74]);
  });

  it('is the same every time', () => {
    const chords = [chord(C, 48), chord(F, 41), chord(G, 43)];
    expect(leadVoices(chords, { ...options, cyclic: true })).toEqual(
      leadVoices(chords, { ...options, cyclic: true }),
    );
  });
});
