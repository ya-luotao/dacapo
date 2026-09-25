// Wait mode: the cursor waits on a step until every key of it has been pressed, in any order.
// Only key-downs count, so a key still held from an earlier step never completes a new one; the
// score has to ask for it again and it has to be pressed again. Wrong keys are counted, never
// blocking.

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
}

export type PressResult =
  | { kind: 'progress' | 'wrong' | 'ignored'; state: WaitState }
  | { kind: 'complete' | 'finished'; state: WaitState; record: StepRecord };

/** A run over `steps`; null when there is nothing to play. */
export function startWait(steps: readonly Step[], range?: Partial<WaitRange>): WaitState | null {
  if (steps.length === 0) return null;
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n, hi));
  const first = clamp(range?.first ?? 0, 0, steps.length - 1);
  const last = clamp(range?.last ?? steps.length - 1, first, steps.length - 1);
  return {
    current: clamp(range?.start ?? first, first, last),
    pressed: [],
    wrong: 0,
    since: null,
    first,
    last,
    loop: range?.loop ?? false,
    laps: 0,
    finished: false,
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
  if (!step.midis.includes(midi)) {
    return { kind: 'wrong', state: { ...state, since, wrong: state.wrong + 1 } };
  }
  const pressed = state.pressed.includes(midi) ? state.pressed : [...state.pressed, midi];
  if (pressed.length < step.midis.length) {
    return { kind: 'progress', state: { ...state, since, pressed } };
  }
  const record: StepRecord = {
    step: state.current,
    measure: step.measure,
    pass: step.pass,
    ms: Math.max(0, time - since),
    wrong: state.wrong,
    at: time,
  };
  const atEnd = state.current >= state.last;
  if (atEnd && !state.loop) {
    return {
      kind: 'finished',
      record,
      state: { ...state, pressed, since, finished: true },
    };
  }
  return {
    kind: 'complete',
    record,
    state: {
      ...state,
      current: atEnd ? state.first : state.current + 1,
      pressed: [],
      wrong: 0,
      since: time,
      laps: atEnd ? state.laps + 1 : state.laps,
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
