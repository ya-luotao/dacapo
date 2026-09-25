// Rhythm mode: the cursor moves in time and every key the score asks for is due at a moment.
// Each note-on played is matched to a due note of the same key within a window around it; what is
// left over is a missed note, and a note-on that matches nothing is an extra (wrong) one.

import { clicks, countIn, type Click } from './metronome.ts';
import { playSpan, timeline } from './playback.ts';
import type { PlayedMeasure } from './repeats.ts';
import type { Score, Step } from './score.ts';
import type { BarLoop } from './wait.ts';

/** However slow the music, a note more than this far off is not in time. */
export const MAX_WINDOW_MS = 150;
/** However fast, a note this close counts: timing is never finer than this for a player. */
export const MIN_WINDOW_MS = 40;

/**
 * The window around a step: half the gap to the nearer neighbouring step (so a note belongs to the
 * step it is closer to), at most `MAX_WINDOW_MS` and at least `MIN_WINDOW_MS`. Gaps are in ms at
 * the tempo played, so the window follows the tempo. The neighbours are the steps of the hands
 * practised, whatever their keys: a note played so late that it sits at the next step is not
 * "late", it is missed (and an extra).
 */
export function matchWindow(before: number, after: number): number {
  return Math.min(MAX_WINDOW_MS, Math.max(MIN_WINDOW_MS, Math.min(before, after) / 2));
}

/** A step as rhythm mode expects it, in one time round of the span. */
export interface TimedStep {
  /** Index into the step list. */
  step: number;
  /** Milliseconds from the start of the span. */
  at: number;
  midis: readonly number[];
  measure: number;
  pass: number;
  /** Position in the play order. */
  played: number;
  window: number;
  /** Time to the next step (or the end of the span): this step's share of the run. */
  slot: number;
}

export interface RhythmPlan {
  /** One time round, in order. */
  steps: TimedStep[];
  /** One time round's clicks. */
  clicks: Click[];
  /** Before the first round, ending where it starts. */
  countIn: Click[];
  length: number;
  /** Where the first round begins (the start bar). */
  start: number;
  loop: boolean;
}

export function rhythmPlan(options: {
  score: Pick<Score, 'measures' | 'tempos'>;
  order: readonly PlayedMeasure[];
  steps: readonly Step[];
  loop: BarLoop | null;
  startBar: number;
  /** Tempo as a fraction of the score's. */
  scale: number;
}): RhythmPlan | null {
  const { score, order, steps, loop, startBar, scale } = options;
  const span = playSpan(score, order, loop, startBar);
  if (!span) return null;
  const inSpan = steps.filter((s) => s.played >= span.first && s.played <= span.last);
  if (inSpan.length === 0) return null;
  // Times to the microsecond: tempo arithmetic leaves 124.99999… where 125 is meant.
  const exact = timeline(score, order, scale);
  const ms = (tick: number) => Math.round(exact(tick) * 1000) / 1000;
  const zero = ms(span.from);
  const length = ms(span.to) - zero;
  const times = inSpan.map((s) => ms(s.tick) - zero);
  const timed = inSpan.map((s, i): TimedStep => {
    const at = times[i]!;
    const nextAt = times[i + 1] ?? (loop ? times[0]! + length : null);
    const previousAt = times[i - 1] ?? (loop ? times.at(-1)! - length : null);
    return {
      step: s.index,
      at,
      midis: s.midis,
      measure: s.measure,
      pass: s.pass,
      played: s.played,
      window: matchWindow(
        previousAt === null ? Infinity : at - previousAt,
        nextAt === null ? Infinity : nextAt - at,
      ),
      slot: (nextAt ?? length) - at,
    };
  });
  return {
    steps: timed,
    clicks: clicks(score, order, span.first, span.last, ms, zero),
    countIn: countIn(score, order, span, ms, zero),
    length,
    start: ms(span.startTick) - zero,
    loop: loop !== null,
  };
}

/** How one key of a step was played: ms early (−) or late (+), or null when it was missed. */
export interface NoteTiming {
  midi: number;
  deviation: number | null;
}

/** A step once it is settled: every key played or its window closed. */
export interface StepTiming {
  step: number;
  round: number;
  measure: number;
  pass: number;
  played: number;
  /** When it was due, in ms on the run's clock (round × length + at). */
  due: number;
  slot: number;
  notes: NoteTiming[];
  /** Note-ons that matched nothing and were closest to this step. */
  extra: number;
}

export type PlayResult =
  | { kind: 'hit'; step: number; round: number; midi: number; deviation: number }
  | { kind: 'extra'; midi: number }
  /** Before the first step's window (the count-in) or after the run: not judged. */
  | { kind: 'ignored' };

export interface Matcher {
  /** A note-on at `time` (ms on the run's clock, latency already taken off). */
  play: (midi: number, time: number) => PlayResult;
  /** The steps settled by `time`, each once, in order. */
  advance: (time: number) => StepTiming[];
  /**
   * Stops at `time`: steps whose window has closed, or that were due and got a key, are settled
   * (keys not played are missed); steps still to come are dropped.
   */
  finish: (time: number) => StepTiming[];
  /** The run has no more steps (only without a loop). */
  done: () => boolean;
}

interface Open {
  spec: TimedStep;
  round: number;
  due: number;
  deviations: Map<number, number>;
  extra: number;
}

/**
 * Matches played notes to the plan, round after round when it loops. A note-on goes to the due
 * key nearest in time among those of the same key whose window holds it, first come first
 * served; each key of a chord is matched on its own. A step settles once its window has closed
 * and the moment halfway to the next step has passed, so an extra note always goes to the step it
 * is closer to.
 */
export function createMatcher(plan: RhythmPlan): Matcher {
  const open: Open[] = [];
  // The first round begins at the start bar; with nothing left there, a loop goes on to the next.
  let round = 0;
  let index = plan.steps.findIndex((s) => s.at >= plan.start);
  if (index < 0) {
    index = 0;
    round = 1;
  }
  let exhausted = !plan.loop && round > 0;
  /** The first step of the run, once opened: notes before its window are the count-in's. */
  let first: { due: number; window: number } | null = null;

  const dueOf = (spec: TimedStep, r: number) => r * plan.length + spec.at;

  function peek(): { spec: TimedStep; due: number } | null {
    if (exhausted) return null;
    const spec = plan.steps[index]!;
    return { spec, due: dueOf(spec, round) };
  }

  /** Opens every step due before `until`. */
  function extend(until: number) {
    for (let next = peek(); next && next.due <= until; next = peek()) {
      open.push({ spec: next.spec, round, due: next.due, deviations: new Map(), extra: 0 });
      first ??= { due: next.due, window: next.spec.window };
      index++;
      if (index >= plan.steps.length) {
        if (plan.loop) {
          index = 0;
          round++;
        } else {
          exhausted = true;
        }
      }
    }
  }

  /** Steps are opened a little ahead, so a note played early finds its step. */
  const reach = (time: number) => extend(time + 2 * MAX_WINDOW_MS);

  function settle(o: Open): StepTiming {
    return {
      step: o.spec.step,
      round: o.round,
      measure: o.spec.measure,
      pass: o.spec.pass,
      played: o.spec.played,
      due: o.due,
      slot: o.spec.slot,
      notes: o.spec.midis.map((midi) => ({ midi, deviation: o.deviations.get(midi) ?? null })),
      extra: o.extra,
    };
  }

  function play(midi: number, time: number): PlayResult {
    reach(time);
    if (!first || time < first.due - first.window || open.length === 0) return { kind: 'ignored' };
    let best: Open | null = null;
    for (const o of open) {
      if (!o.spec.midis.includes(midi) || o.deviations.has(midi)) continue;
      const off = Math.abs(time - o.due);
      if (off > o.spec.window) continue;
      if (!best || off < Math.abs(time - best.due)) best = o;
    }
    if (best) {
      const deviation = time - best.due;
      best.deviations.set(midi, deviation);
      return { kind: 'hit', step: best.spec.step, round: best.round, midi, deviation };
    }
    let nearest: Open | null = null;
    for (const o of open) {
      if (!nearest || Math.abs(time - o.due) < Math.abs(time - nearest.due)) nearest = o;
    }
    if (!nearest) return { kind: 'ignored' };
    nearest.extra++;
    return { kind: 'extra', midi };
  }

  function advance(time: number): StepTiming[] {
    reach(time);
    const out: StepTiming[] = [];
    while (open.length > 0) {
      const o = open[0]!;
      const next = open[1]?.due ?? peek()?.due ?? null;
      const closed = time > o.due + o.spec.window && (next === null || time >= (o.due + next) / 2);
      if (!closed) break;
      out.push(settle(open.shift()!));
    }
    return out;
  }

  return {
    play,
    advance,
    finish(time) {
      const out = advance(time);
      for (const o of open) {
        if (time >= o.due + o.spec.window || (time >= o.due && o.deviations.size > 0))
          out.push(settle(o));
      }
      open.length = 0;
      exhausted = true;
      return out;
    },
    done: () => exhausted && open.length === 0,
  };
}
