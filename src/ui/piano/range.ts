import { isBlack, PIANO_HIGHEST, PIANO_LOWEST } from '../../core/note.ts';

/**
 * The keys to draw for music between `low` and `high`: two keys of room on each side, at least
 * two octaves, within the piano, ending on white keys.
 */
export function keyboardRange(low: number, high: number): [number, number] {
  let lo = low - 2;
  let hi = high + 2;
  while (hi - lo < 24) {
    lo--;
    hi++;
  }
  lo = Math.max(PIANO_LOWEST, lo);
  hi = Math.min(PIANO_HIGHEST, hi);
  while (isBlack(lo)) lo--;
  while (isBlack(hi)) hi++;
  return [lo, hi];
}

/**
 * The keys to draw for a keyboard from `low` to `high` (the player's own, docs/PERSONAL.md, "The
 * instrument's keys"): those keys, each end taken out to the next white key, within the piano.
 */
export function instrumentRange(low: number, high: number): [number, number] {
  let lo = Math.max(PIANO_LOWEST, low);
  let hi = Math.min(PIANO_HIGHEST, high);
  while (isBlack(lo)) lo--;
  while (isBlack(hi)) hi++;
  return [lo, hi];
}

/** How many white keys `range` has. */
export function whiteKeys([low, high]: readonly [number, number]): number {
  let n = 0;
  for (let m = low; m <= high; m++) if (!isBlack(m)) n++;
  return n;
}
