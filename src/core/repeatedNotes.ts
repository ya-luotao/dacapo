// Repeated notes as a run measures them: the time between the repeats of one key, and how long the
// key was up before it was struck again (from its release to the next onset). A key is always up
// before its repeat: the input hub passes on a key's onset only once it was released (a MIDI
// keyboard sends the release where the key resets, which on one that repeats from half-way is
// before it is fully up), so a short time up is what shows a key barely let rise. Computed from a
// hand's figures (evenness.ts) and the keys as played. See docs/SCALES.md, "Technique" and
// "Clarifications (decided during S7)".

import type { HandAnalysis, PlayedNote } from './evenness.ts';
import { quantile } from './robust.ts';

/** The figures need at least this many repeats measured. */
export const MIN_REPEATS = 6;

export interface RepeatFigures {
  /** Repeats measured: a note and the next of the same key, both played right. */
  repeats: number;
  /** The median time between the repeats of one key, ms. */
  interval: number | null;
  /** The median time the key was up before its repeat, ms; null with too few. */
  up: number | null;
  /** The shortest such time and the expected index of the repeat after it; null with too few. */
  shortest: { index: number; ms: number } | null;
}

/**
 * The repeat figures of one hand: every pair of neighbouring notes of the run on the same key,
 * both played right with nothing between (`extra`), the time up is the repeat's onset − the key
 * before's release.
 */
export function repeatFigures(
  hand: Pick<HandAnalysis, 'notes'>,
  played: readonly PlayedNote[],
  extra: readonly number[],
): RepeatFigures {
  const intervals: number[] = [];
  const ups: { index: number; ms: number }[] = [];
  hand.notes.forEach((n, j) => {
    const before = hand.notes[j - 1];
    if (!before || before.midi !== n.midi) return;
    if (before.outcome !== 'played' || n.outcome !== 'played') return;
    const a = before.played!;
    const b = n.played!;
    if (extra.some((x) => x > a && x < b)) return;
    intervals.push(played[b]!.on - played[a]!.on);
    // Never unreleased through the hub; a recording without the release gives no time up.
    const off = played[a]!.off;
    if (off !== null && off <= played[b]!.on) ups.push({ index: j, ms: played[b]!.on - off });
  });
  const enough = intervals.length >= MIN_REPEATS;
  let shortest: RepeatFigures['shortest'] = null;
  if (enough) for (const u of ups) if (!shortest || u.ms < shortest.ms) shortest = u;
  return {
    repeats: intervals.length,
    interval: enough ? quantile(intervals, 0.5) : null,
    up:
      enough && ups.length > 0
        ? quantile(
            ups.map((u) => u.ms),
            0.5,
          )
        : null,
    shortest,
  };
}
