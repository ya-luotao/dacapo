// Latency calibration: the player taps any key along with a click. Whatever lies between our
// clock and what the player hears and does (audio output, MIDI input, the habit of playing a hair
// early) shows up as a steady offset, which rhythm mode then takes off every note.

import { median } from './session.ts';
import { quantile } from './robust.ts';

export const CALIBRATION_CLICKS = 16;
export const CALIBRATION_BPM = 90;
export const CALIBRATION_INTERVAL_MS = 60_000 / CALIBRATION_BPM;
/** The first clicks are for finding the beat. */
export const CALIBRATION_DISCARD = 4;
/** Taps needed on the clicks that count (12 of them). */
export const CALIBRATION_MIN_TAPS = 8;
/**
 * Taps spread wider than this (interquartile range) are too uneven to trust: a steady tapper is
 * within about ±20 ms of their own median.
 */
export const CALIBRATION_MAX_SPREAD_MS = 60;

export type Calibration =
  | { ok: true; offset: number; spread: number; taps: number }
  | { ok: false; reason: 'few'; taps: number }
  | { ok: false; reason: 'uneven'; spread: number; taps: number };

/**
 * `clicks`: when each click was heard (ms, the same clock as the taps). Each tap goes to the click
 * nearest to it, within half an interval, the first tap per click only. The offset is the median
 * of tap − click over the clicks after the first `CALIBRATION_DISCARD`.
 */
export function calibrate(
  clicks: readonly number[],
  taps: readonly number[],
  interval = CALIBRATION_INTERVAL_MS,
): Calibration {
  const offsets = new Map<number, number>();
  for (const tap of [...taps].sort((a, b) => a - b)) {
    let nearest = -1;
    clicks.forEach((click, i) => {
      if (nearest < 0 || Math.abs(tap - click) < Math.abs(tap - clicks[nearest]!)) nearest = i;
    });
    if (nearest < 0 || Math.abs(tap - clicks[nearest]!) > interval / 2) continue;
    if (!offsets.has(nearest)) offsets.set(nearest, tap - clicks[nearest]!);
  }
  const counted = [...offsets].filter(([i]) => i >= CALIBRATION_DISCARD).map(([, off]) => off);
  if (counted.length < CALIBRATION_MIN_TAPS)
    return { ok: false, reason: 'few', taps: counted.length };
  const spread = quantile(counted, 0.75)! - quantile(counted, 0.25)!;
  if (spread > CALIBRATION_MAX_SPREAD_MS)
    return { ok: false, reason: 'uneven', spread, taps: counted.length };
  return { ok: true, offset: median(counted)!, spread, taps: counted.length };
}

/** The clicks of a calibration, starting at `start`. */
export function calibrationClicks(start: number): number[] {
  return Array.from({ length: CALIBRATION_CLICKS }, (_, i) => start + i * CALIBRATION_INTERVAL_MS);
}
