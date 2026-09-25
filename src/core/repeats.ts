// The order in which written measures are played: repeats and voltas unrolled ("play"), or every
// written bar once ("skip"). Loop ranges and "start from bar" are chosen in written bars and
// resolved here to positions in that order.

import type { Measure } from './score.ts';

export type RepeatMode = 'play' | 'skip';

/** A measure as it is played. */
export interface PlayedMeasure {
  /** Written measure index. */
  measure: number;
  /** 1 on the first time through a repeated section, 2 on the repeat, … */
  pass: number;
  /** Start in performance ticks. */
  start: number;
}

type Bars = readonly Pick<Measure, 'duration' | 'repeat'>[];

/**
 * Unrolls `|: :|` repeats (with `times`) and numbered voltas into performance order. A section
 * starts at the beginning, at a `|:`, or right after a finished repeat or volta group. D.C./D.S.
 * are not followed (see `Measure.jumps`).
 */
export function performanceOrder(measures: Bars): PlayedMeasure[] {
  const out: PlayedMeasure[] = [];
  let sectionStart = 0;
  let pass = 1;
  let jumped = false;
  let tick = 0;
  // Malformed repeat structures must not loop forever.
  const limit = measures.length * 16;
  for (let i = 0; i < measures.length && out.length < limit;) {
    const m = measures[i]!;
    if (m.repeat.forward && !jumped) {
      sectionStart = i;
      pass = 1;
    }
    jumped = false;
    if (m.repeat.ending.length > 0 && !m.repeat.ending.includes(pass)) {
      i++;
      continue;
    }
    out.push({ measure: i, pass, start: tick });
    tick += m.duration;
    const next = measures[i + 1];
    // A volta followed by another volta goes back even without a `:|` (some exporters put the
    // repeat sign only on the last ending); Verovio's expansion reads it the same way.
    const nextEnding = next?.repeat.ending ?? [];
    const impliedRepeat =
      m.repeat.backwardTimes === null &&
      m.repeat.ending.length > 0 &&
      nextEnding.length > 0 &&
      nextEnding.join() !== m.repeat.ending.join() &&
      pass < Math.max(...voltaGroup(measures, i));
    if ((m.repeat.backwardTimes !== null && pass < m.repeat.backwardTimes) || impliedRepeat) {
      pass++;
      i = sectionStart;
      jumped = true;
      continue;
    }
    const leavesVoltas = m.repeat.ending.length > 0 && (next?.repeat.ending.length ?? 0) === 0;
    if (m.repeat.backwardTimes !== null || leavesVoltas) {
      sectionStart = i + 1;
      pass = 1;
    }
    i++;
  }
  return out;
}

/** Every written bar once; of each run of voltas only the last ending is played. */
export function writtenOrder(measures: Bars): PlayedMeasure[] {
  const out: PlayedMeasure[] = [];
  let tick = 0;
  measures.forEach((m, i) => {
    if (m.repeat.ending.length > 0) {
      const last = Math.max(...voltaGroup(measures, i));
      if (!m.repeat.ending.includes(last)) return;
    }
    out.push({ measure: i, pass: 1, start: tick });
    tick += m.duration;
  });
  return out;
}

export function playOrder(measures: Bars, mode: RepeatMode): PlayedMeasure[] {
  return mode === 'play' ? performanceOrder(measures) : writtenOrder(measures);
}

/** Every volta number in the run of volta measures around measure `i`. */
function voltaGroup(measures: Bars, i: number): number[] {
  let first = i;
  while (first > 0 && measures[first - 1]!.repeat.ending.length > 0) first--;
  const numbers: number[] = [];
  for (let k = first; k < measures.length && measures[k]!.repeat.ending.length > 0; k++)
    numbers.push(...measures[k]!.repeat.ending);
  return numbers;
}

/** Position of the first time written measure `measure` is played, or -1 if it never is. */
export function firstOccurrence(order: readonly PlayedMeasure[], measure: number): number {
  return order.findIndex((p) => p.measure === measure);
}

/** Positions in the play order, inclusive. */
export interface PlayedRange {
  first: number;
  last: number;
}

/**
 * Resolves a loop over written bars `from`–`to` (indices, `from` ≤ `to`) to a run of the play
 * order: from an occurrence of `from` to the next occurrence of `to`. The first run that stays
 * within the written bars `from`–`to` wins, so "bars 7–8b" loops the second pass instead of
 * going back to the start of the repeat; if every run leaves the range, the first run is used.
 * Null when either bar is never played (a first ending while repeats are skipped).
 */
export function resolveLoop(
  order: readonly PlayedMeasure[],
  from: number,
  to: number,
): PlayedRange | null {
  let fallback: PlayedRange | null = null;
  for (let first = 0; first < order.length; first++) {
    if (order[first]!.measure !== from) continue;
    let last = first;
    while (last < order.length && order[last]!.measure !== to) last++;
    if (last === order.length) break;
    fallback ??= { first, last };
    let inside = true;
    for (let k = first; k <= last && inside; k++) {
      const measure = order[k]!.measure;
      inside = measure >= from && measure <= to;
    }
    if (inside) return { first, last };
  }
  return fallback;
}
