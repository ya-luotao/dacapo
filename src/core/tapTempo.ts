// Tap tempo: the tempo of the last few taps, by the median interval, so one stray tap (or one
// missed) does not throw it. A pause starts a new count.

import { clampBpm, MIN_BPM } from './pulse.ts';
import { median } from './session.ts';

/** Intervals remembered. */
export const TAP_WINDOW = 6;
/** Taps closer than this are one tap that bounced. */
export const TAP_BOUNCE_MS = 120;
/** A gap longer than the slowest tempo's beat (with room to spare) starts over. */
export const TAP_RESET_MS = Math.round((60_000 / MIN_BPM) * 1.2);
/** Or one this many times the current interval: the player has stopped and started again. */
const RESET_FACTOR = 2.5;

export interface TapTempo {
  /** A tap at `time` (ms); the tempo so far, or null after the first tap of a count. */
  tap: (time: number) => number | null;
  reset: () => void;
  /** Taps in the current count. */
  count: () => number;
}

export function createTapTempo(): TapTempo {
  let last: number | null = null;
  let taps = 0;
  const intervals: number[] = [];

  return {
    tap(time) {
      if (last !== null) {
        const gap = time - last;
        if (gap < TAP_BOUNCE_MS && gap >= 0) return intervals.length ? bpm() : null;
        const current = median(intervals);
        if (gap < 0 || gap > TAP_RESET_MS || (current !== null && gap > current * RESET_FACTOR)) {
          intervals.length = 0;
          taps = 0;
        } else {
          intervals.push(gap);
          if (intervals.length > TAP_WINDOW) intervals.shift();
        }
      }
      last = time;
      taps++;
      return intervals.length ? bpm() : null;
    },
    reset() {
      last = null;
      taps = 0;
      intervals.length = 0;
    },
    count: () => taps,
  };

  function bpm(): number {
    return clampBpm(60_000 / median(intervals)!);
  }
}
