// Rushing and dragging: whether the player drifts ahead of the click or behind it over a stretch
// of bars. Deviations (early −, late +) that fall over time mean the notes come earlier and
// earlier: the player speeds up. Rising deviations mean slowing down.

import { quantile, theilSen } from './robust.ts';

/** One played note: when it was due (ms on the run's clock) and how far off it was. */
export interface TimedHit {
  /** Position of its bar in the run (0 = the first bar played, counting every time round). */
  bar: number;
  time: number;
  deviation: number;
}

export type DriftDirection = 'faster' | 'slower';

export interface Drift {
  direction: DriftDirection;
  /** Bar positions in the run, inclusive. */
  from: number;
  to: number;
  /** How far the fitted line moves over the stretch, in ms (negative: faster). */
  change: number;
}

export interface DriftResult {
  /** Up to two stretches, strongest first; empty when the tempo held. */
  stretches: Drift[];
  /** The whole run drifts steadily (then `stretches` holds that one stretch). */
  wholeRun: boolean;
}

/** A drift smaller than this is not worth mentioning, however clear. */
export const MIN_DRIFT_MS = 30;
/**
 * How many standard errors the drift must be clear of noise. Many overlapping stretches are
 * looked at, so a lower bar finds "drift" in steady playing: at 4, one run in ten of a loose but
 * steady player (σ = 20 ms, sixteen bars) was reported; at 5, one in sixty.
 */
export const MIN_Z = 5;
/** Stretches of 2 to 8 bars; fewer than 6 notes say nothing about a trend. */
export const MIN_BARS = 2;
export const MAX_BARS = 8;
export const MIN_NOTES = 6;
/** Timing is never exact to better than this (input resolution, jitter). */
const NOISE_FLOOR_MS = 1;
/** The whole-run fit looks at most this many notes, evenly spread (the fit is quadratic). */
const MAX_WHOLE_NOTES = 400;
/** A stretch inside the clearest one that is at least this clear is preferred if steeper. */
const NEARLY = 0.8;

interface Fit {
  change: number;
  z: number;
  slope: number;
  /** Median deviation of the last bar minus that of the first. */
  observed: number;
}

/**
 * Theil–Sen line through the stretch, and how clear its change is: the fitted change over the
 * stretch divided by its standard error, σ·√12/√n for points spread evenly over the stretch. σ is
 * the root mean square of the residuals, so notes that do not follow the line (a flat bar next to
 * a ramp, a wild note) make the stretch less convincing rather than being ignored.
 */
function fit(hits: readonly TimedHit[]): Fit | null {
  if (hits.length < MIN_NOTES) return null;
  const firstBar = hits[0]!.bar;
  const lastBar = hits.at(-1)!.bar;
  const barMedian = (bar: number) =>
    quantile(
      hits.filter((h) => h.bar === bar).map((h) => h.deviation),
      0.5,
    )!;
  const observed = barMedian(lastBar) - barMedian(firstBar);
  const xs = hits.map((h) => h.time);
  const ys = hits.map((h) => h.deviation);
  const line = theilSen(xs, ys);
  if (!line) return null;
  const span = xs.at(-1)! - xs[0]!;
  const change = line.slope * span;
  const squares = hits.reduce(
    (sum, h) => sum + (h.deviation - (line.intercept + line.slope * h.time)) ** 2,
    0,
  );
  const sigma = Math.max(NOISE_FLOOR_MS, Math.sqrt(squares / hits.length));
  const z = Math.abs(change) / ((sigma * Math.sqrt(12)) / Math.sqrt(hits.length));
  return { change, z, slope: line.slope, observed };
}

/**
 * Clear, and big enough: the line moves at least `MIN_DRIFT_MS`, and so do the notes themselves
 * from the first bar to the last (a line through a steady bar and a short ramp can overstate it).
 */
const passes = (f: Fit | null): f is Fit =>
  f !== null &&
  Math.abs(f.change) >= MIN_DRIFT_MS &&
  f.z >= MIN_Z &&
  Math.sign(f.observed) === Math.sign(f.change) &&
  Math.abs(f.observed) >= MIN_DRIFT_MS;

/**
 * Finds where the player sped up or slowed down. Every stretch of `MIN_BARS`–`MAX_BARS`
 * consecutive bars is fitted; of those that drift clearly (at least `MIN_DRIFT_MS` and `MIN_Z`
 * standard errors), the clearest wins, then the clearest one not overlapping it. Within each, a
 * shorter stretch nearly as clear (`NEARLY`) but steeper is preferred: that is the ramp without the
 * steady bars around it. A drift over the whole run is reported as such when it is clearer than
 * every stretch and none goes the other way.
 */
export function findDrift(hits: readonly TimedHit[]): DriftResult {
  const sorted = [...hits].sort((a, b) => a.time - b.time);
  if (sorted.length === 0) return { stretches: [], wholeRun: false };
  const byBar = new Map<number, TimedHit[]>();
  for (const hit of sorted) {
    const list = byBar.get(hit.bar) ?? [];
    list.push(hit);
    byBar.set(hit.bar, list);
  }
  const bars = [...byBar.keys()].sort((a, b) => a - b);
  const firstBar = bars[0]!;
  const lastBar = bars.at(-1)!;

  const candidates: (Drift & { z: number; slope: number })[] = [];
  for (let from = firstBar; from <= lastBar; from++) {
    const within: TimedHit[] = [];
    for (let to = from; to <= lastBar && to - from < MAX_BARS; to++) {
      within.push(...(byBar.get(to) ?? []));
      if (to - from + 1 < MIN_BARS) continue;
      const f = fit(within);
      if (!passes(f)) continue;
      candidates.push({
        direction: f.change < 0 ? 'faster' : 'slower',
        from,
        to,
        change: f.change,
        z: f.z,
        slope: f.slope,
      });
    }
  }
  candidates.sort((a, b) => b.z - a.z || a.to - a.from - (b.to - b.from) || a.from - b.from);

  const whole = lastBar - firstBar + 1 > MIN_BARS ? fit(thin(sorted, MAX_WHOLE_NOTES)) : null;
  if (passes(whole)) {
    const steeper = candidates.some(
      (c) => c.direction !== (whole.change < 0 ? 'faster' : 'slower') || c.z > whole.z,
    );
    if (!steeper) {
      return {
        stretches: [
          {
            direction: whole.change < 0 ? 'faster' : 'slower',
            from: firstBar,
            to: lastBar,
            change: whole.change,
          },
        ],
        wholeRun: true,
      };
    }
  }

  const stretches: Drift[] = [];
  for (const c of candidates) {
    if (stretches.length === 2) break;
    if (stretches.some((s) => c.from <= s.to && c.to >= s.from)) continue;
    // Nearly as clear and steeper: the ramp itself, without the steady bars around it.
    const best = candidates
      .filter(
        (d) =>
          d.from >= c.from &&
          d.to <= c.to &&
          d.direction === c.direction &&
          d.z >= NEARLY * c.z &&
          !stretches.some((s) => d.from <= s.to && d.to >= s.from),
      )
      .sort((a, b) => Math.abs(b.slope) - Math.abs(a.slope))[0]!;
    stretches.push({
      direction: best.direction,
      from: best.from,
      to: best.to,
      change: best.change,
    });
  }
  return { stretches, wholeRun: false };
}

/** At most `max` items, evenly spread, the first and last included. */
function thin<T>(items: readonly T[], max: number): readonly T[] {
  if (items.length <= max) return items;
  return Array.from(
    { length: max },
    (_, i) => items[Math.round((i * (items.length - 1)) / (max - 1))]!,
  );
}
