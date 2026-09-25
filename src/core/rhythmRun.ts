// The summary of one rhythm-mode run: how many notes came in time, the player's tendency (early
// or late) and where they sped up or slowed down.

import { findDrift, type DriftDirection, type TimedHit } from './drift.ts';
import type { StepTiming } from './rhythm.ts';
import { trimmedMean } from './robust.ts';

/** "In time": within this of the beat. Around the smallest asynchrony a listener notices. */
export const IN_TIME_MS = 50;
/** A tendency smaller than this is "on the beat". */
export const TENDENCY_MS = 10;
/** The tendency ignores this share of notes at each end, so a slip does not make it. */
export const TENDENCY_TRIM = 0.2;

/** One note of the run for the chart and its table, in the order due. */
export interface RunNote {
  /** Milliseconds from the first note due. */
  time: number;
  measure: number;
  pass: number;
  /** Which time round (0 = the first). */
  round: number;
  midi: number;
  deviation: number | null;
}

export interface RhythmStretch {
  direction: DriftDirection;
  /** Written measures where the stretch begins and ends, and the time rounds. */
  from: { measure: number; round: number };
  to: { measure: number; round: number };
  /** Milliseconds from the first note due: the first and last note of the stretch. */
  fromTime: number;
  toTime: number;
  change: number;
}

export interface RhythmSummary {
  /** Notes due, and of those: played in their window, within `IN_TIME_MS`, missed. */
  notes: number;
  hits: number;
  inTime: number;
  missed: number;
  extra: number;
  /** Trimmed mean deviation of the notes played (early −, late +); null without any. */
  tendency: number | null;
  drift: RhythmStretch[];
  wholeRun: boolean;
  /** Rounds played (a loop). */
  rounds: number;
  timeline: RunNote[];
}

export function summarizeRhythm(timings: readonly StepTiming[]): RhythmSummary {
  const ordered = [...timings].sort((a, b) => a.due - b.due);
  const origin = ordered[0]?.due ?? 0;
  const timeline: RunNote[] = [];
  const hits: TimedHit[] = [];
  // Bars in the order played, counting every round: the unit of "bars 9–12".
  const barKeys: string[] = [];
  const bars: { measure: number; round: number; first: number; last: number }[] = [];
  let extra = 0;
  for (const t of ordered) {
    const key = `${t.round}:${t.played}`;
    const time = t.due - origin;
    if (barKeys.at(-1) !== key) {
      barKeys.push(key);
      bars.push({ measure: t.measure, round: t.round, first: time, last: time });
    }
    bars.at(-1)!.last = time;
    extra += t.extra;
    for (const note of t.notes) {
      timeline.push({
        time: t.due - origin,
        measure: t.measure,
        pass: t.pass,
        round: t.round,
        midi: note.midi,
        deviation: note.deviation,
      });
      if (note.deviation !== null)
        hits.push({ bar: bars.length - 1, time: t.due - origin, deviation: note.deviation });
    }
  }
  const drift = findDrift(hits);
  return {
    notes: timeline.length,
    hits: hits.length,
    inTime: hits.filter((h) => Math.abs(h.deviation) <= IN_TIME_MS).length,
    missed: timeline.length - hits.length,
    extra,
    tendency: trimmedMean(
      hits.map((h) => h.deviation),
      TENDENCY_TRIM,
    ),
    drift: drift.stretches.map((s) => ({
      direction: s.direction,
      from: { measure: bars[s.from]!.measure, round: bars[s.from]!.round },
      to: { measure: bars[s.to]!.measure, round: bars[s.to]!.round },
      fromTime: bars[s.from]!.first,
      toTime: bars[s.to]!.last,
      change: s.change,
    })),
    wholeRun: drift.wholeRun,
    rounds: new Set(ordered.map((t) => t.round)).size,
    timeline,
  };
}
