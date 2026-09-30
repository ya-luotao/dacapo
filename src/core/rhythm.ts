// Rhythm mode: the cursor moves in time and every key the score asks for is due at a moment.
// Each note-on played is matched to a due note of the same key within a window around it; what is
// left over is a missed note, and a note-on that matches nothing is an extra (wrong) one, unless
// it is a key of an ornament or grace note within its span (docs/EXPRESSION.md, "Playing them").

import { clicks, countIn, type Click } from './metronome.ts';
import { DEFAULT_REALISE, type TrillStart } from './ornaments.ts';
import { playSpan, realiseAt, timeline } from './playback.ts';
import type { PlayedMeasure } from './repeats.ts';
import type { Score, ScoreNote, Step } from './score.ts';
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
  /** Its notes with grace notes or an ornament, timed; absent when none. */
  ornaments?: TimedOrnament[];
}

/**
 * An ornamented note of a step, as the demo plays it at the run's tempo: its principal is due
 * `offset` ms after the step (an appoggiatura's delayed onset, a turn's or an upper-note trill's
 * second note), and its keys are neither right nor wrong from `from` to `to` ms after the step
 * (the figure's first onset to its last), give or take the step's window.
 */
export interface TimedOrnament {
  midi: number;
  offset: number;
  /** The other keys; the principal struck again is accepted too. */
  keys: readonly number[];
  from: number;
  to: number;
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
  score: Pick<Score, 'measures' | 'tempos'> & Partial<Pick<Score, 'notes'>>;
  order: readonly PlayedMeasure[];
  steps: readonly Step[];
  loop: BarLoop | null;
  startBar: number;
  /** Tempo as a fraction of the score's. */
  scale: number;
  /** Where trills start (the piece's setting): on their note by default. */
  trillStart?: TrillStart;
}): RhythmPlan | null {
  const { score, order, steps, loop, startBar, scale } = options;
  const notes = score.notes ?? [];
  const byId = new Map(notes.map((n) => [n.id, n]));
  // A note's written length with the notes tied to it: a trill goes on over the tie.
  const tied = new Map(
    notes.filter((n) => n.tieStop).map((n) => [`${n.part}:${n.staff}:${n.midi}:${n.onset}`, n]),
  );
  const lengthOf = (note: ScoreNote) => {
    let length = note.duration;
    for (let cur = note, k = 0; cur.tieStart && k < 64; k++) {
      const next = tied.get(`${cur.part}:${cur.staff}:${cur.midi}:${cur.onset + cur.duration}`);
      if (!next) break;
      length += next.duration;
      cur = next;
    }
    return length;
  };
  const realising = { trillStart: options.trillStart ?? DEFAULT_REALISE.trillStart };
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
      ...ornamentsOf(s, byId, lengthOf, exact, realising),
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

/** A step's ornamented notes, realised at the tempo played (`realiseAt`, as the demo plays them). */
function ornamentsOf(
  step: Step,
  byId: ReadonlyMap<string, ScoreNote>,
  lengthOf: (note: ScoreNote) => number,
  exact: (tick: number) => number,
  options: { trillStart: TrillStart },
): { ornaments?: TimedOrnament[] } {
  const out: TimedOrnament[] = [];
  for (const o of step.ornaments ?? []) {
    const note = byId.get(o.noteId);
    if (!note) continue;
    const at = exact(step.tick);
    const sounded = realiseAt(
      note,
      step.tick,
      step.tick + lengthOf(note),
      exact,
      -Infinity,
      Infinity,
      options,
    );
    const principal = sounded.find((x) => x.midi === note.midi);
    // To the microsecond, as the steps' times.
    const ons = sounded.map((x) => Math.round((x.on - at) * 1000) / 1000);
    out.push({
      midi: note.midi,
      offset: principal ? Math.round((principal.on - at) * 1000) / 1000 : 0,
      keys: o.keys,
      from: Math.min(0, ...ons),
      to: Math.max(0, ...ons),
    });
  }
  return out.length > 0 ? { ornaments: out } : {};
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
  /**
   * A key of an ornament within its span, neither right nor wrong: `step` is the ornamented step,
   * `principal` whether the key is its principal struck again.
   */
  | { kind: 'ornament'; step: number; round: number; midi: number; principal: boolean }
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

/** When a key of a step is due: its principal later when its ornament starts on another key. */
const keyDue = (o: Open, midi: number) =>
  o.due + (o.spec.ornaments?.find((x) => x.midi === midi)?.offset ?? 0);

/** An ornament's keys, neither right nor wrong from `from` to `to` (ms on the run's clock). */
interface Span {
  step: number;
  round: number;
  from: number;
  to: number;
  keys: readonly number[];
  principal: number;
}

/**
 * Matches played notes to the plan, round after round when it loops. A note-on goes to the due
 * key nearest in time among those of the same key whose window holds it, first come first
 * served; each key of a chord is matched on its own. A step settles once its window has closed
 * and the moment halfway to the next step has passed, so an extra note always goes to the step it
 * is closer to. A principal with an ornament is due where the ornament strikes it; the
 * ornament's keys (and the principal struck again) within its span are no extra notes.
 */
export function createMatcher(plan: RhythmPlan): Matcher {
  const open: Open[] = [];
  const spans: Span[] = [];
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
      for (const o of next.spec.ornaments ?? [])
        spans.push({
          step: next.spec.step,
          round,
          from: next.due + o.from - next.spec.window,
          to: next.due + o.to + next.spec.window,
          keys: o.keys,
          principal: o.midi,
        });
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
    if (!first || time < first.due - first.window) return { kind: 'ignored' };
    let best: Open | null = null;
    for (const o of open) {
      if (!o.spec.midis.includes(midi) || o.deviations.has(midi)) continue;
      const off = Math.abs(time - keyDue(o, midi));
      if (off > o.spec.window) continue;
      if (!best || off < Math.abs(time - keyDue(best, midi))) best = o;
    }
    if (best) {
      const deviation = time - keyDue(best, midi);
      best.deviations.set(midi, deviation);
      return { kind: 'hit', step: best.spec.step, round: best.round, midi, deviation };
    }
    const span = spans.find(
      (x) => time >= x.from && time <= x.to && (x.keys.includes(midi) || x.principal === midi),
    );
    if (span)
      return {
        kind: 'ornament',
        step: span.step,
        round: span.round,
        midi,
        principal: !span.keys.includes(midi),
      };
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
    // Spans over: gone.
    for (let k = spans.length - 1; k >= 0; k--) if (spans[k]!.to < time) spans.splice(k, 1);
    const out: StepTiming[] = [];
    while (open.length > 0) {
      const o = open[0]!;
      const next = open[1]?.due ?? peek()?.due ?? null;
      // A principal due later (after an appoggiatura) keeps its step open until its window closes.
      const lastDue = Math.max(0, ...(o.spec.ornaments ?? []).map((x) => x.offset)) + o.due;
      const closed =
        time > lastDue + o.spec.window && (next === null || time >= (o.due + next) / 2);
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
      spans.length = 0;
      exhausted = true;
      return out;
    },
    done: () => exhausted && open.length === 0,
  };
}
