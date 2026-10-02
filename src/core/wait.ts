// Wait mode: the cursor waits on a step until every key of it has been pressed, in any order.
// Only key-downs count, so a key still held from an earlier step never completes a new one; the
// score has to ask for it again and it has to be pressed again. Wrong keys are counted, never
// blocking. A step with grace notes or an ornament waits for its principal: the ornament's other
// keys, in any order, count as neither right nor wrong, on the step and after it until a key of
// the steps that follow is played (docs/EXPRESSION.md, "Playing them").
//
// On a keyboard with fewer keys (docs/PERSONAL.md, "The instrument's keys") a step waits for the
// keys the player has; the others (`Step.given`) are the app's, and count as neither right nor
// wrong when the player strikes one. A step with none of the player's keys is passed: the run
// never waits on it, and it is recorded as it is gone by, without time or wrong notes.

import { firstOccurrence, resolveLoop, type PlayedMeasure } from './repeats.ts';
import type { Step } from './score.ts';

export interface WaitRange {
  /** Step indices, inclusive. */
  first: number;
  last: number;
  /** Where to begin; clamped into the range. */
  start?: number;
  /** After the last step go back to the first, instead of finishing. */
  loop: boolean;
}

export interface WaitState {
  /** Index into the step list. */
  current: number;
  /** Keys of the current step pressed since it appeared. */
  pressed: readonly number[];
  /** Wrong presses on the current step. */
  wrong: number;
  /**
   * When the current step appeared (performance.now() clock); null until the first key of the
   * run, so the time spent getting ready does not count as hesitation.
   */
  since: number | null;
  first: number;
  last: number;
  loop: boolean;
  /** Completed laps of the loop. */
  laps: number;
  finished: boolean;
  /**
   * The last ornamented step completed: its ornaments' keys (principals too) stay neither right
   * nor wrong until a key of a later step that is none of them is played. Null when none.
   */
  carry?: Carry | null;
  /**
   * Steps passed before the current one and not recorded yet (the run begins after them): they
   * go into the records with the first step completed. Absent when none.
   */
  lead?: readonly number[];
  /**
   * The keys the app plays around the current step, neither right nor wrong when the player
   * strikes one: those of the step completed last, of the steps passed since and of the current
   * step. Absent when none.
   */
  given?: readonly number[];
}

/** An ornament going on after its step was completed. */
export interface Carry {
  step: number;
  /** Its grace notes' and ornaments' other keys. */
  keys: readonly number[];
  /** Its principals: struck again within the ornament. */
  principals: readonly number[];
}

/** One completed step: what the measure heatmap aggregates (P3). */
export interface StepRecord {
  step: number;
  /** Written measure index and pass. */
  measure: number;
  pass: number;
  /** From the step appearing to its last required key. */
  ms: number;
  wrong: number;
  /** When it was completed (performance.now() clock). */
  at: number;
  /** The step had none of the player's keys: it was passed, at the moment the run went by it. */
  passed?: true;
  /** Its keys the app played for the player; absent when none. */
  given?: number;
}

/** A step completed, with the steps passed on the way to it and from it to the next. */
interface Completed {
  record: StepRecord;
  /** Absent when no step was passed. */
  passed?: { before: StepRecord[]; after: StepRecord[] };
}

export type PressResult =
  | { kind: 'progress' | 'wrong' | 'ignored'; state: WaitState }
  /** A key the app plays for the player (beyond their keyboard), struck all the same. */
  | { kind: 'given'; state: WaitState }
  /**
   * A key of an ornament (or grace note), neither right nor wrong: `step` is the ornamented step,
   * `principal` whether the key is its principal struck again after the step was completed.
   */
  | { kind: 'ornament'; state: WaitState; step: number; principal: boolean }
  | ({ kind: 'complete' | 'finished'; state: WaitState } & Completed);

/** A step the player has a key of: the run waits on it. */
const waited = (step: Step | undefined): step is Step =>
  step !== undefined && step.midis.length > 0;

/** The record of a step passed at `time`. */
function passedRecord(steps: readonly Step[], index: number, time: number): StepRecord {
  const step = steps[index]!;
  return {
    step: index,
    measure: step.measure,
    pass: step.pass,
    ms: 0,
    wrong: 0,
    at: time,
    passed: true,
    ...(step.given && { given: step.given.length }),
  };
}

/** The keys the app plays for the steps `indices`, without duplicates; undefined when none. */
function givenIn(steps: readonly Step[], indices: readonly number[]): number[] | undefined {
  const keys = [...new Set(indices.flatMap((i) => steps[i]?.given ?? []))];
  return keys.length > 0 ? keys : undefined;
}

/**
 * Where a run over `range` begins: the step it starts from, and the first step from there that
 * has a key of the player's. With none from the start to the end of the range, a loop goes
 * round and begins at its first such step; without a loop there is nothing of the player's to
 * play from there, and the answer is null.
 */
export function firstWaited(
  steps: readonly Step[],
  range: Partial<WaitRange> | undefined,
): { from: number; current: number } | null {
  if (steps.length === 0) return null;
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n, hi));
  const first = clamp(range?.first ?? 0, 0, steps.length - 1);
  const last = clamp(range?.last ?? steps.length - 1, first, steps.length - 1);
  const next = (begin: number) => {
    for (let i = begin; i <= last; i++) if (waited(steps[i])) return i;
    return -1;
  };
  const start = clamp(range?.start ?? first, first, last);
  const current = next(start);
  if (current >= 0) return { from: start, current };
  if (!range?.loop) return null;
  const round = next(first);
  return round < 0 ? null : { from: first, current: round };
}

/**
 * A run over `steps`; null when there is nothing to play. It begins on the first step at or
 * after `start` that has a key of the player's (`firstWaited`).
 */
export function startWait(steps: readonly Step[], range?: Partial<WaitRange>): WaitState | null {
  const begin = firstWaited(steps, range);
  if (!begin) return null;
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n, hi));
  const first = clamp(range?.first ?? 0, 0, steps.length - 1);
  const last = clamp(range?.last ?? steps.length - 1, first, steps.length - 1);
  const { from, current } = begin;
  const lead = Array.from({ length: current - from }, (_, k) => from + k);
  const given = givenIn(steps, [...lead, current]);
  return {
    current,
    pressed: [],
    wrong: 0,
    since: null,
    first,
    last,
    loop: range?.loop ?? false,
    laps: 0,
    finished: false,
    ...(lead.length > 0 && { lead }),
    ...(given && { given }),
  };
}

export function press(
  steps: readonly Step[],
  state: WaitState,
  midi: number,
  time: number,
): PressResult {
  const step = steps[state.current];
  if (state.finished || !step) return { kind: 'ignored', state };
  const since = state.since ?? time;
  const carry = state.carry ?? null;
  const inCarry = carry !== null && (carry.keys.includes(midi) || carry.principals.includes(midi));
  if (!step.midis.includes(midi)) {
    const own = step.ornaments?.some((o) => o.keys.includes(midi));
    if (own)
      return {
        kind: 'ornament',
        step: state.current,
        principal: false,
        state: { ...state, since },
      };
    if (carry && inCarry)
      return {
        kind: 'ornament',
        step: carry.step,
        principal: !carry.keys.includes(midi),
        state: { ...state, since },
      };
    if (state.given?.includes(midi)) return { kind: 'given', state: { ...state, since } };
    return { kind: 'wrong', state: { ...state, since, wrong: state.wrong + 1 } };
  }
  // A key of the step ends an ornament still going on, unless it is one of its keys.
  const kept = inCarry ? carry : null;
  const pressed = state.pressed.includes(midi) ? state.pressed : [...state.pressed, midi];
  if (pressed.length < step.midis.length) {
    return { kind: 'progress', state: { ...state, since, pressed, carry: kept } };
  }
  const record: StepRecord = {
    step: state.current,
    measure: step.measure,
    pass: step.pass,
    ms: Math.max(0, time - since),
    wrong: state.wrong,
    at: time,
    ...(step.given && { given: step.given.length }),
  };
  const next = step.ornaments
    ? {
        step: state.current,
        keys: [...new Set(step.ornaments.flatMap((o) => o.keys))],
        principals: step.ornaments.map((o) => o.midi),
      }
    : kept;
  // On to the next step the player has a key of: the steps before it are passed as it is reached,
  // round the loop too.
  const after: number[] = [];
  let following = state.current + 1;
  while (following <= state.last && !waited(steps[following])) after.push(following++);
  const atEnd = following > state.last;
  if (atEnd && state.loop) {
    following = state.first;
    while (following < state.current && !waited(steps[following])) after.push(following++);
  }
  const before = state.lead ?? [];
  const passed =
    before.length + after.length > 0
      ? {
          passed: {
            before: before.map((i) => passedRecord(steps, i, time)),
            after: after.map((i) => passedRecord(steps, i, time)),
          },
        }
      : {};
  // The state without what the step completed has settled: its lead is recorded with it.
  const rest: WaitState = { ...state };
  delete rest.lead;
  delete rest.given;
  if (atEnd && !state.loop) {
    const given = givenIn(steps, [state.current, ...after]);
    return {
      kind: 'finished',
      record,
      ...passed,
      state: { ...rest, pressed, since, finished: true, carry: next, ...(given && { given }) },
    };
  }
  const given = givenIn(steps, [state.current, ...after, following]);
  return {
    kind: 'complete',
    record,
    ...passed,
    state: {
      ...rest,
      current: following,
      pressed: [],
      wrong: 0,
      since: time,
      laps: atEnd ? state.laps + 1 : state.laps,
      carry: next,
      ...(given && { given }),
    },
  };
}

/**
 * Stops the current step's clock (while the demo plays): it starts again at the next key, so the
 * time spent listening is not hesitation.
 */
export function pauseClock(state: WaitState): WaitState {
  return state.since === null ? state : { ...state, since: null };
}

/** A loop over written bars, `from` ≤ `to`. */
export interface BarLoop {
  from: number;
  to: number;
}

/**
 * The steps to practise: all of them, or those of the loop's bars (see `resolveLoop`), starting
 * at the first step of written bar `startBar` (its first time in the range, else the range's
 * start). Null when the range has nothing for the selected hands to play.
 */
export function waitRange(
  steps: readonly Step[],
  order: readonly PlayedMeasure[],
  loop: BarLoop | null,
  startBar: number,
): WaitRange | null {
  let firstPlayed = 0;
  let lastPlayed = order.length - 1;
  if (loop) {
    const resolved = resolveLoop(order, loop.from, loop.to);
    if (!resolved) return null;
    firstPlayed = resolved.first;
    lastPlayed = resolved.last;
  }
  const first = steps.findIndex((s) => s.played >= firstPlayed);
  const last = steps.findLastIndex((s) => s.played <= lastPlayed);
  if (first < 0 || last < first) return null;
  let position = -1;
  if (loop) {
    for (let i = firstPlayed; i <= lastPlayed && position < 0; i++)
      if (order[i]!.measure === startBar) position = i;
  } else {
    position = firstOccurrence(order, startBar);
  }
  const start = position < 0 ? first : steps.findIndex((s) => s.played >= position);
  return { first, last, start: start < 0 || start > last ? first : start, loop: loop !== null };
}
