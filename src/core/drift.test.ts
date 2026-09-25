import { describe, expect, it } from 'vitest';
import { findDrift, MIN_DRIFT_MS, type TimedHit } from './drift.ts';
import { quantile, theilSen, trimmedMean } from './robust.ts';

/** Four notes a bar, 667 ms apart (♩ = 90), `bars` bars; deviation from `dev(bar, beat, n)`. */
function run(dev: (bar: number, beat: number, n: number) => number, count = 16): TimedHit[] {
  const out: TimedHit[] = [];
  for (let bar = 0; bar < count; bar++)
    for (let beat = 0; beat < 4; beat++) {
      const n = bar * 4 + beat;
      out.push({ bar, time: n * 667, deviation: dev(bar, beat, n) });
    }
  return out;
}

/** Deterministic noise, roughly normal, standard deviation `sigma`. */
function noise(sigma: number, seed: number): () => number {
  let s = seed;
  const next = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  return () => sigma * Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
}

/** Bars 9–12 (indices 8–11): 0 → −60 ms, then back in time. */
const rushIn9to12 = (bar: number, beat: number) =>
  bar >= 8 && bar <= 11 ? (-60 * ((bar - 8) * 4 + beat)) / 15 : 0;

describe('robust statistics', () => {
  it('quantiles, trimmed mean and Theil–Sen resist a few wild values', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([], 0.5)).toBeNull();
    expect(trimmedMean([40, 40, 40, 39, 41, 400, -300], 0.2)).toBe(40);
    const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ys = xs.map((x) => 2 * x + 1);
    ys[3] = 500;
    ys[7] = -500;
    expect(theilSen(xs, ys)).toEqual({ slope: 2, intercept: 1 });
    expect(theilSen([1, 1], [0, 5])).toBeNull();
  });
});

describe('findDrift', () => {
  it('finds a rush in bars 9–12 exactly', () => {
    expect(findDrift(run(rushIn9to12))).toEqual({
      stretches: [{ direction: 'faster', from: 8, to: 11, change: -60 }],
      wholeRun: false,
    });
  });

  it('finds a slowing down, and a stretch that stays behind afterwards', () => {
    const drag = findDrift(
      run((bar, beat) => (bar < 3 ? 0 : bar <= 5 ? 5 * ((bar - 3) * 4 + beat) : 55)),
    );
    expect(drag.stretches).toEqual([{ direction: 'slower', from: 3, to: 5, change: 55 }]);
  });

  it('a steady drift through the run is reported as the whole run', () => {
    expect(findDrift(run((_bar, _beat, n) => -2 * n))).toEqual({
      stretches: [{ direction: 'faster', from: 0, to: 15, change: -126 }],
      wholeRun: true,
    });
  });

  it('stays quiet on steady playing, early or late, with noise and outliers', () => {
    expect(findDrift(run(() => 40)).stretches).toEqual([]);
    // A loose player (σ = 20 ms) over sixteen bars, ten times.
    for (let seed = 1; seed <= 10; seed++) {
      const r = noise(20, seed);
      expect(findDrift(run(() => r())).stretches).toEqual([]);
    }
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = noise(15, seed);
      const hits = run(() => r());
      hits[20]!.deviation = 140;
      hits[41]!.deviation = -140;
      hits[42]!.deviation = -130;
      expect(findDrift(hits).stretches).toEqual([]);
    }
  });

  it('still finds the rush through noise, within a bar of where it is', () => {
    for (const seed of [1, 2, 3]) {
      const r = noise(10, seed);
      const [found] = findDrift(run((bar, beat) => rushIn9to12(bar, beat) + r())).stretches;
      expect(found?.direction).toBe('faster');
      expect(found!.from).toBeGreaterThanOrEqual(7);
      expect(found!.from).toBeLessThanOrEqual(9);
      expect(found!.to).toBeGreaterThanOrEqual(10);
      expect(found!.to).toBeLessThanOrEqual(12);
    }
  });

  it('finds a clear rush through σ = 15 ms of noise', () => {
    for (const seed of [1, 5, 6]) {
      const r = noise(15, seed);
      const [found] = findDrift(run((bar, beat) => rushIn9to12(bar, beat) + r())).stretches;
      expect(found?.direction).toBe('faster');
      expect(found!.from).toBeLessThanOrEqual(8);
      expect(found!.to).toBe(11);
    }
  });

  it('a drift under the smallest worth mentioning is not reported', () => {
    const scaled = (ms: number) => run((bar, beat) => (rushIn9to12(bar, beat) * ms) / 60);
    expect(MIN_DRIFT_MS).toBe(30);
    // 25 ms is not worth a word; 40 ms is (the notes of its last bar are 32 ms ahead of its first).
    expect(findDrift(scaled(25)).stretches).toEqual([]);
    expect(findDrift(scaled(40)).stretches).toMatchObject([
      { direction: 'faster', from: 8, to: 11 },
    ]);
  });

  it('nothing to say about a handful of notes', () => {
    expect(findDrift([])).toEqual({ stretches: [], wholeRun: false });
    expect(findDrift(run((_b, _k, n) => -20 * n, 1)).stretches).toEqual([]);
  });
});
