// A trill as a run measures it: how fast it went and how that changed, how steady it was, and
// whether its two fingers were even — the time after each of the two keys against the other's.
// Computed from a hand's figures (evenness.ts), so a trill is aligned, timed and checked as any
// run is. See docs/SCALES.md, "Technique" and "Clarifications (decided during S7)".

import type { HandAnalysis, PlayedNote } from './evenness.ts';
import { quantile, theilSen } from './robust.ts';

/** The rate over time is the median of this many intervals in a row (a beat of sixteenths × 2). */
export const RATE_WINDOW = 8;
/**
 * A trill slows (or hurries) when its fitted rate at the end is this share below (above) its rate
 * at the start: the scales' 10 % for a tempo that moved (ScaleSummary's `DRIFT_SHARE`).
 */
export const TRILL_DRIFT = 0.1;
/**
 * The two fingers are uneven when the median time after one key is longer than after the other by
 * at least this long and this share of the median interval (provisional, as S1's thresholds).
 */
export const FINGER_MS = 10;
export const FINGER_SHARE = 0.1;
/** The figures need at least this many intervals after each key. */
const MIN_EACH = 6;

export interface TrillFigures {
  /** Notes a second over the whole trill (from the median interval); null with too few. */
  rate: number | null;
  /** The rate over time: per window of `RATE_WINDOW` intervals, its middle (s from the start). */
  rates: { at: number; rate: number }[];
  /** The fitted rate at the start and at the end (Theil–Sen over the intervals), notes a second. */
  startRate: number | null;
  endRate: number | null;
  /** The end against the start: `'slows'`, `'hurries'`, or null when within `TRILL_DRIFT`. */
  drift: 'slows' | 'hurries' | null;
  /** The median interval after the lower key and after the upper one, ms. */
  afterLower: number | null;
  afterUpper: number | null;
  /** Which key the time lingers after (the finger on it is slow to hand over), or null: even. */
  lingers: 'lower' | 'upper' | null;
}

/**
 * The trill figures of one hand. A note's degree is its key's place in the trill (0 the lower, 1
 * the upper, as `technique.ts` sets it); only intervals between two notes played right with
 * nothing between count (`NoteFigures.interval`), hesitations left out.
 */
export function trillFigures(
  hand: Pick<HandAnalysis, 'notes'>,
  played: readonly PlayedNote[],
): TrillFigures {
  const intervals: { at: number; ms: number; after: 0 | 1 }[] = [];
  const first = hand.notes.find((n) => n.outcome === 'played' && n.played !== null);
  const zero = first ? played[first.played!]!.on : 0;
  hand.notes.forEach((n, j) => {
    if (j === 0 || n.interval === null || n.hesitation !== null || n.played === null) return;
    const before = hand.notes[j - 1]!;
    intervals.push({
      at: played[n.played]!.on - zero,
      ms: n.interval,
      after: before.degree === 0 ? 0 : 1,
    });
  });
  const median = quantile(
    intervals.map((i) => i.ms),
    0.5,
  );
  const rates: TrillFigures['rates'] = [];
  for (let k = 0; k + RATE_WINDOW <= intervals.length; k += RATE_WINDOW) {
    const window = intervals.slice(k, k + RATE_WINDOW);
    const ms = quantile(
      window.map((i) => i.ms),
      0.5,
    )!;
    rates.push({ at: window[Math.floor(RATE_WINDOW / 2)]!.at / 1000, rate: 1000 / ms });
  }
  // The interval's line over time: the rate at the first and the last interval.
  const line =
    intervals.length >= 2 * RATE_WINDOW
      ? theilSen(
          intervals.map((i) => i.at),
          intervals.map((i) => i.ms),
        )
      : null;
  const fitted = (at: number) => (line ? line.intercept + line.slope * at : null);
  const startMs = intervals.length > 0 ? fitted(intervals[0]!.at) : null;
  const endMs = intervals.length > 0 ? fitted(intervals.at(-1)!.at) : null;
  const startRate = startMs !== null && startMs > 0 ? 1000 / startMs : null;
  const endRate = endMs !== null && endMs > 0 ? 1000 / endMs : null;
  const moved = startRate !== null && endRate !== null ? endRate / startRate - 1 : 0;

  const each = (after: 0 | 1) => intervals.filter((i) => i.after === after).map((i) => i.ms);
  const lower = each(0);
  const upper = each(1);
  const afterLower = lower.length >= MIN_EACH ? quantile(lower, 0.5) : null;
  const afterUpper = upper.length >= MIN_EACH ? quantile(upper, 0.5) : null;
  let lingers: TrillFigures['lingers'] = null;
  if (afterLower !== null && afterUpper !== null && median !== null) {
    const difference = afterUpper - afterLower;
    if (Math.abs(difference) >= Math.max(FINGER_MS, FINGER_SHARE * median))
      lingers = difference > 0 ? 'upper' : 'lower';
  }
  return {
    rate: median !== null && median > 0 ? 1000 / median : null,
    rates,
    startRate,
    endRate,
    drift: moved <= -TRILL_DRIFT ? 'slows' : moved >= TRILL_DRIFT ? 'hurries' : null,
    afterLower,
    afterUpper,
    lingers,
  };
}
