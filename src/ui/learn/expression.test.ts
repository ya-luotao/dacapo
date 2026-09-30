import { describe, expect, it } from 'vitest';
import {
  CRESCENDO_RISE,
  heldShare,
  isCrescendo,
  joinOf,
  judgeCrescendo,
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
