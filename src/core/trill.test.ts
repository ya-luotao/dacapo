import { describe, expect, it } from 'vitest';
import { analyzeRun, type PlayedNote } from './evenness.ts';
import { seededRng } from './random.ts';
import { repeatFigures } from './repeatedNotes.ts';
import { parseExerciseKey, scaleNotes } from './scales.ts';
import type { ScaleExercise } from './scaleTypes.ts';
import { FINGER_MS, trillFigures, TRILL_DRIFT } from './trill.ts';

const TRILL: ScaleExercise = {
  type: 'trill',
  tonic: 'D',
  octaves: 1,
  hands: 'right',
  variant: '23-4',
};

/** A trill played: `interval(j)` ms before note j, ± jitter. */
function play(e: ScaleExercise, interval: (j: number) => number, jitter = 3, seed = 1) {
  const rng = seededRng(seed);
  const notes = scaleNotes(e).right;
  let t = 0;
  const played: PlayedNote[] = notes.map((n, j) => {
    if (j > 0) t += interval(j);
    const on = t + (rng() - 0.5) * 2 * jitter;
    return { midi: n.midi, on, off: on + 40, velocity: 64 };
  });
  return {
    notes,
    played,
    analysis: analyzeRun({ expected: notes, played, velocityMeasured: false }),
  };
}

describe('the trill on a pair of fingers', () => {
  it('alternates the tonic and its second, 16 a bar, and closes on the tonic', () => {
    const { right, left } = scaleNotes({ ...TRILL, hands: 'both' });
    expect(right).toHaveLength(65);
    expect(right.slice(0, 4).map((n) => n.midi)).toEqual([62, 64, 62, 64]);
    expect(right.at(-1)!.midi).toBe(62);
    expect(left.slice(0, 2).map((n) => n.midi)).toEqual([50, 52]);
    // The pair chosen; the left hand the mirror pair; written at the start of each bar.
    expect(right.slice(0, 2).map((n) => n.finger)).toEqual([2, 3]);
    expect(left.slice(0, 2).map((n) => n.finger)).toEqual([4, 3]);
    expect(right.filter((n) => !n.unmarked).map((n) => n.index)).toEqual([
      0, 1, 16, 17, 32, 33, 48, 49, 64,
    ]);
    expect(right.every((n) => n.pattern && n.direction === 'up' && !n.turn)).toBe(true);
    expect(parseExerciseKey('trill:D:1:right:23-4')).toEqual(TRILL);
    expect(parseExerciseKey('trill:D:1:right:46')).toBeNull(); // Hanon's trill is in C
  });

  it('reads a steady trill: its rate, no drift, even fingers', () => {
    const { analysis, played } = play(TRILL, () => 80);
    const figures = trillFigures(analysis.hands[0]!, played);
    expect(figures.rate).toBeCloseTo(12.5, 0);
    expect(figures.drift).toBeNull();
    expect(figures.lingers).toBeNull();
    expect(figures.rates.length).toBe(8);
  });

  it('finds a trill that slows, and a finger that hands over late', () => {
    const slowing = play(TRILL, (j) => 70 + j * 0.4);
    expect(trillFigures(slowing.analysis.hands[0]!, slowing.played).drift).toBe('slows');
    expect(TRILL_DRIFT).toBe(0.1);
    // The time after the upper key (note 1, 3, …) 16 ms longer.
    const limping = play(TRILL, (j) => (j % 2 === 0 ? 88 : 72));
    const figures = trillFigures(limping.analysis.hands[0]!, limping.played);
    expect(figures.lingers).toBe('upper');
    expect(figures.afterUpper! - figures.afterLower!).toBeGreaterThanOrEqual(FINGER_MS);
  });
});

describe('repeated notes', () => {
  it('measures the time each key was up before its repeat, and the repeats struck held', () => {
    const notes = scaleNotes({
      type: 'trill',
      tonic: 'C',
      octaves: 1,
      hands: 'right',
      variant: '12-4',
    }).right;
    // Every note the same key: a repeated note.
    const same = notes.map((n) => ({ ...n, midi: 60 }));
    const played: PlayedNote[] = same.map((_, j) => ({
      midi: 60,
      on: j * 100,
      off: j === 5 ? null : j * 100 + (j === 8 ? 90 : 70),
      velocity: 64,
    }));
    const analysis = analyzeRun({ expected: same, played, velocityMeasured: false });
    const figures = repeatFigures(analysis.hands[0]!, played, analysis.extra);
    expect(figures.repeats).toBe(same.length - 1);
    expect(figures.up).toBe(30);
    // The note after the one never released has no time up; the shortest is before note 9.
    expect(figures.shortest).toEqual({ index: 9, ms: 10 });
    expect(figures.interval).toBe(100);
  });
});
