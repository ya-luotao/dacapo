import { describe, expect, it } from 'vitest';
import {
  CRESCENDO_RISE,
  heldShare,
  isCrescendo,
  joinOf,
  judgeCrescendo,
  judgePedalChanges,
  pedalDownAt,
  type PedalEvent,
  type Stroke,
} from './expression.ts';

const stroke = (on: number, off: number | null): Stroke => ({ midi: 60, on, off, velocity: 64 });

describe('a crescendo', () => {
  it('is every note louder than the one before, by any amount', () => {
    expect(judgeCrescendo([40, 41, 45, 60, 61])).toBe('rising');
    expect(isCrescendo('rising')).toBe(true);
  });

  it('may dip on the way, if the last note is the loudest and well above the first', () => {
    expect(CRESCENDO_RISE).toBe(19);
    expect(judgeCrescendo([40, 52, 50, 58, 70])).toBe('overall');
    expect(judgeCrescendo([40, 52, 50, 56, 58])).toBe('not');
    // Well above the first, but not the loudest.
    expect(judgeCrescendo([40, 80, 60, 62, 70])).toBe('not');
  });

  it('is not five notes at one loudness, as the computer keys play them', () => {
    expect(judgeCrescendo([96, 96, 96, 96, 96])).toBe('even');
    expect(isCrescendo('even')).toBe(false);
  });

  it('is not getting softer', () => {
    expect(judgeCrescendo([90, 80, 70, 60, 50])).toBe('not');
    expect(judgeCrescendo([60])).toBe('not');
  });
});

describe('how a note joins the next', () => {
  it('is joined when let go as the next begins, give or take a little', () => {
    expect(joinOf(stroke(0, 500), stroke(505, 900), 1000)).toEqual({ kind: 'joined', ms: 5 });
    expect(joinOf(stroke(0, 540), stroke(500, 900), 1000)).toEqual({ kind: 'joined', ms: 40 });
  });

  it('leaves a gap when let go early, and overlaps when held on', () => {
    expect(joinOf(stroke(0, 200), stroke(500, 900), 1000)).toEqual({ kind: 'gap', ms: 300 });
    expect(joinOf(stroke(0, 700), stroke(500, 900), 1000)).toEqual({ kind: 'overlap', ms: 200 });
  });

  it('counts a note still held as overlapping until now', () => {
    expect(joinOf(stroke(0, null), stroke(500, null), 800)).toEqual({ kind: 'overlap', ms: 300 });
  });

  it('says how much of its length a note was held', () => {
    expect(heldShare(stroke(0, 250), stroke(500, 900), 1000)).toBe(0.5);
    expect(heldShare(stroke(0, null), stroke(500, 900), 400)).toBeCloseTo(0.8);
  });
});

const down = (time: number): PedalEvent => ({ down: true, time });
const up = (time: number): PedalEvent => ({ down: false, time });

describe('a pedal change', () => {
  const chords = [0, 1000, 2000, 3000];

  it('is clean when the pedal comes up just after each chord and goes straight down', () => {
    const pedal = [down(200), up(1100), down(1250), up(2150), down(2300), up(3200), down(3400)];
    expect(judgePedalChanges(chords, pedal, 5000)).toEqual([
      { kind: 'clean', up: 100, down: 150 },
      { kind: 'clean', up: 150, down: 150 },
      { kind: 'clean', up: 200, down: 200 },
    ]);
  });

  it('leaves a gap when lifted before the chord, even if pressed again before it', () => {
    const pedal = [down(200), up(900), down(1150), up(1900), down(1950)];
    expect(judgePedalChanges(chords.slice(0, 3), pedal, 5000)).toEqual([
      { kind: 'early', ms: 100 },
      { kind: 'early', ms: 100 },
    ]);
    expect(pedalDownAt(pedal, 1000)).toBe(false);
    expect(pedalDownAt(pedal, 2000)).toBe(true);
  });

  it('blurs when lifted too late, or not before the next chord', () => {
    expect(judgePedalChanges([0, 1000], [down(100), up(1400), down(1500)], 5000)).toEqual([
      { kind: 'late', ms: 400 },
    ]);
    expect(judgePedalChanges([0, 1000, 2000], [down(100), up(2100), down(2200)], 5000)).toEqual([
      { kind: 'held' },
      { kind: 'clean', up: 100, down: 100 },
    ]);
  });

  it('is slow when the pedal stays up too long after the change', () => {
    expect(judgePedalChanges([0, 1000], [down(100), up(1100), down(1700)], 5000)).toEqual([
      { kind: 'slow', ms: 600 },
    ]);
  });

  it('waits while the change may still come', () => {
    expect(judgePedalChanges([0, 1000], [down(100)], 1200)).toEqual([{ kind: 'pending' }]);
    expect(judgePedalChanges([0, 1000], [down(100)], 1300)).toEqual([{ kind: 'late', ms: 300 }]);
    expect(judgePedalChanges([0, 1000], [down(100), up(1100)], 1300)).toEqual([
      { kind: 'pending' },
    ]);
  });

  it('has nothing to change when the pedal was never down', () => {
    expect(judgePedalChanges([0, 1000], [], 5000)).toEqual([{ kind: 'none' }]);
  });
});
