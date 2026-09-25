// What the instrument plays: the demo of a selection and, in wait mode, the accompaniment of the
// hand not being practised. Everything here is in performance ticks (see `buildSteps`) or in
// milliseconds at a tempo; the MIDI side lives in `src/output/`.

import { firstOccurrence, resolveLoop, type PlayedMeasure } from './repeats.ts';
import {
  inHands,
  TICKS_PER_QUARTER,
  type Hand,
  type HandSelection,
  type Score,
  type ScoreNote,
  type Step,
} from './score.ts';
import type { BarLoop } from './wait.ts';

/** Quarter notes per minute when the score gives no tempo: moderate, easy to follow. */
export const DEFAULT_BPM = 90;
/** Repeated notes of one key are released this much (at most) before the key is struck again. */
export const RELEASE_GAP_MS = 30;
export const DEMO_VELOCITY = 72;

/** The score's tempo: its first tempo mark, else `DEFAULT_BPM`. */
export function baseTempo(score: Pick<Score, 'tempos'>): number {
  return score.tempos[0]?.bpm ?? DEFAULT_BPM;
}

/** Performance ticks to milliseconds from tick 0, following the tempo marks, `scale` × as fast. */
export type Timeline = (tick: number) => number;

export function timeline(
  score: Pick<Score, 'measures' | 'tempos'>,
  order: readonly PlayedMeasure[],
  scale = 1,
): Timeline {
  const fallback = score.tempos[0]?.bpm ?? DEFAULT_BPM;
  const segments: { tick: number; bpm: number; ms: number }[] = [];
  const push = (tick: number, bpm: number) => {
    const last = segments.at(-1);
    if (last && last.bpm === bpm) return;
    const ms = last ? last.ms + msPerTick(last.bpm, scale) * (tick - last.tick) : 0;
    if (last && last.tick === tick) segments.pop();
    segments.push({ tick, bpm, ms });
  };
  for (const played of order) {
    const measure = score.measures[played.measure]!;
    const end = measure.start + measure.duration;
    let bpm = fallback;
    for (const mark of score.tempos) if (mark.tick <= measure.start) bpm = mark.bpm;
    push(played.start, bpm);
    for (const mark of score.tempos) {
      if (mark.tick > measure.start && mark.tick < end)
        push(played.start + mark.tick - measure.start, mark.bpm);
    }
  }
  if (segments.length === 0) segments.push({ tick: 0, bpm: fallback, ms: 0 });
  return (tick) => {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid]!.tick <= tick) lo = mid;
      else hi = mid - 1;
    }
    const segment = segments[lo]!;
    return segment.ms + msPerTick(segment.bpm, scale) * (tick - segment.tick);
  };
}

function msPerTick(bpm: number, scale: number): number {
  return 60_000 / (bpm * scale * TICKS_PER_QUARTER);
}

/** The part of the play order a run covers, as positions in the order (inclusive). */
export interface PlaySpan {
  first: number;
  last: number;
  /** Where the first time round begins: the start bar, if it is in the span. */
  start: number;
  /** Performance ticks: the span is [from, to); the first time round begins at `startTick`. */
  from: number;
  to: number;
  startTick: number;
}

/** The same bars `waitRange` practises: the whole order or the resolved loop, and the start bar. */
export function playSpan(
  score: Pick<Score, 'measures'>,
  order: readonly PlayedMeasure[],
  loop: BarLoop | null,
  startBar: number,
): PlaySpan | null {
  if (order.length === 0) return null;
  let first = 0;
  let last = order.length - 1;
  let start = -1;
  if (loop) {
    const resolved = resolveLoop(order, loop.from, loop.to);
    if (!resolved) return null;
    ({ first, last } = resolved);
    for (let i = first; i <= last && start < 0; i++) if (order[i]!.measure === startBar) start = i;
  } else {
    start = firstOccurrence(order, startBar);
  }
  if (start < 0) start = first;
  const end = order[last]!;
  return {
    first,
    last,
    start,
    from: order[first]!.start,
    to: end.start + score.measures[end.measure]!.duration,
    startTick: order[start]!.start,
  };
}

/** A note as it sounds, in performance ticks: tied notes joined, unisons merged. */
export interface PerformedNote {
  midi: number;
  on: number;
  off: number;
}

/**
 * The notes `include` selects, as played over positions `first`–`last` of the order. A tie joins
 * its notes into one; a tied continuation whose start is not played (the loop begins inside the
 * tie) is not struck, as wait mode never asks for it. Sorted by onset, then key.
 */
export function performedNotes(
  score: Pick<Score, 'measures' | 'notes'>,
  order: readonly PlayedMeasure[],
  include: (note: ScoreNote) => boolean,
  first = 0,
  last = order.length - 1,
): PerformedNote[] {
  const byMeasure = new Map<number, ScoreNote[]>();
  for (const note of score.notes) {
    if (!include(note)) continue;
    const list = byMeasure.get(note.measure) ?? [];
    list.push(note);
    byMeasure.set(note.measure, list);
  }
  const out: PerformedNote[] = [];
  const ties = new Map<string, PerformedNote>();
  for (let p = first; p <= last; p++) {
    const played = order[p]!;
    const measure = score.measures[played.measure]!;
    for (const note of byMeasure.get(played.measure) ?? []) {
      const on = played.start + note.onset - measure.start;
      const off = on + note.duration;
      const key = `${note.part}:${note.midi}`;
      if (note.tieStop) {
        const open = ties.get(key);
        if (open && open.off === on) {
          open.off = off;
          if (!note.tieStart) ties.delete(key);
        } else {
          ties.delete(key);
        }
        continue;
      }
      const performed = { midi: note.midi, on, off };
      out.push(performed);
      if (note.tieStart) ties.set(key, performed);
      else ties.delete(key);
    }
  }
  out.sort((a, b) => a.on - b.on || a.midi - b.midi);
  const merged: PerformedNote[] = [];
  for (const note of out) {
    const previous = merged.at(-1);
    if (previous && previous.on === note.on && previous.midi === note.midi) {
      previous.off = Math.max(previous.off, note.off);
    } else {
      merged.push(note);
    }
  }
  return merged;
}

export interface DemoNote {
  midi: number;
  /** Milliseconds from the start of the span. */
  on: number;
  off: number;
}

export interface DemoPlan {
  /** One time round the span, sorted by onset. */
  notes: DemoNote[];
  /** The span's steps (indices into the step list) and when they sound. */
  steps: { step: number; at: number }[];
  /** Length of one time round. */
  length: number;
  /** Where the first time round begins (the start bar). */
  start: number;
  /** Go round until stopped. */
  loop: boolean;
}

/** Whose notes a demo plays: the selected hands; with both, the whole score. */
export function demoIncludes(hands: HandSelection): (note: ScoreNote) => boolean {
  return (note) => inHands(note.hand, hands) || (hands === 'both' && note.hand === null);
}

export function demoPlan(options: {
  score: Pick<Score, 'measures' | 'notes' | 'tempos'>;
  order: readonly PlayedMeasure[];
  steps: readonly Step[];
  hands: HandSelection;
  loop: BarLoop | null;
  startBar: number;
  /** Tempo as a fraction of the score's (1 = as written). */
  scale: number;
}): DemoPlan | null {
  const { score, order, steps, hands, loop, startBar, scale } = options;
  const span = playSpan(score, order, loop, startBar);
  if (!span) return null;
  const ms = timeline(score, order, scale);
  const zero = ms(span.from);
  const length = ms(span.to) - zero;
  const notes = performedNotes(score, order, demoIncludes(hands), span.first, span.last).map(
    (n) => ({ midi: n.midi, on: ms(n.on) - zero, off: Math.min(ms(n.off), ms(span.to)) - zero }),
  );
  separateRepeatedKeys(notes, loop ? length : null);
  const inSpan = steps.filter((s) => s.played >= span.first && s.played <= span.last);
  if (inSpan.length === 0) return null;
  return {
    notes,
    steps: inSpan.map((s) => ({ step: s.index, at: ms(s.tick) - zero })),
    length,
    start: ms(span.startTick) - zero,
    loop: loop !== null,
  };
}

/** Leaves a short gap before a key is struck again (also across the wrap of a loop `length` long). */
function separateRepeatedKeys(notes: DemoNote[], length: number | null) {
  const byKey = new Map<number, DemoNote[]>();
  for (const note of notes) {
    const list = byKey.get(note.midi) ?? [];
    list.push(note);
    byKey.set(note.midi, list);
  }
  for (const list of byKey.values()) {
    list.forEach((note, i) => {
      const next = list[i + 1]?.on ?? (length === null ? Infinity : list[0]!.on + length);
      const gap = Math.min(RELEASE_GAP_MS, (next - note.on) / 4);
      note.off = Math.max(note.on, Math.min(note.off, next - gap));
    });
  }
}

/** One accompaniment note, relative to the step it belongs to. */
export interface AccompanimentNote {
  midi: number;
  /** Milliseconds after the step is completed, and how long it sounds (at most). */
  at: number;
  length: number;
  /** Performance ticks after the step at which the written note ends: completing a step there cuts it. */
  until: number;
}

export interface AccompanimentPlan {
  /** Ticks in one time round of the span. */
  lapTicks: number;
  /** Per practised step: its position in the span (ticks from its start) and the notes it sets off. */
  steps: Map<number, { pos: number; notes: AccompanimentNote[] }>;
}

/**
 * In wait mode, the notes of the other hand (and of parts nobody practises) sound as the player
 * completes steps: the notes starting from a step's onset up to the next practised step belong
 * to that step. Notes before the first step of the span are played after its last step when the
 * span loops (as the lead-in to the next time round), and not at all otherwise.
 */
export function accompanimentPlan(options: {
  score: Pick<Score, 'measures' | 'notes' | 'tempos'>;
  order: readonly PlayedMeasure[];
  steps: readonly Step[];
  hand: Hand;
  loop: BarLoop | null;
  scale: number;
}): AccompanimentPlan | null {
  const { score, order, steps, hand, loop, scale } = options;
  const span = playSpan(score, order, loop, -1);
  if (!span) return null;
  const inSpan = steps.filter((s) => s.played >= span.first && s.played <= span.last);
  if (inSpan.length === 0) return null;
  const ms = timeline(score, order, scale);
  const lapTicks = span.to - span.from;
  const others = performedNotes(
    score,
    order,
    (note) => !inHands(note.hand, hand),
    span.first,
    span.last,
  ).map((n) => ({ ...n, off: Math.min(n.off, span.to) }));

  const plan: AccompanimentPlan = { lapTicks, steps: new Map() };
  let k = 0;
  // Before the first step: the lead-in of the next time round, if the span loops.
  const leadIn: PerformedNote[] = [];
  while (k < others.length && others[k]!.on < inSpan[0]!.tick) leadIn.push(others[k++]!);
  inSpan.forEach((step, i) => {
    const next = inSpan[i + 1]?.tick ?? span.to;
    const notes: AccompanimentNote[] = [];
    const origin = ms(step.tick);
    for (; k < others.length && others[k]!.on < next; k++) {
      const n = others[k]!;
      notes.push({
        midi: n.midi,
        at: ms(n.on) - origin,
        length: ms(n.off) - ms(n.on),
        until: n.off - step.tick,
      });
    }
    if (i === inSpan.length - 1 && loop) {
      const toEnd = ms(span.to) - origin;
      for (const n of leadIn) {
        notes.push({
          midi: n.midi,
          at: toEnd + ms(n.on) - ms(span.from),
          length: ms(n.off) - ms(n.on),
          until: span.to - step.tick + n.off - span.from,
        });
      }
    }
    plan.steps.set(step.index, { pos: step.tick - span.from, notes });
  });
  return plan;
}
