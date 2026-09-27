// One scale run as it is played: waiting for the scale's first key, then every key collected
// until the last note, a pause or Stop. The cursor on the score follows the notes as they come
// (forgiving a few skipped notes); what counts afterwards is the alignment of evenness.ts over all
// the notes kept here. Framework-free, so it is testable.

import type { PlayedNote } from '../../core/evenness.ts';
import type { PedalChange, RunEnd } from '../../core/scaleRecords.ts';
import type { ScaleNote } from '../../core/scaleTypes.ts';

export type { PedalChange, RunEnd } from '../../core/scaleRecords.ts';

/** A run ends after this long without a key. */
export const IDLE_END_MS = 3000;
/**
 * The cursor looks this many notes ahead for the key played: the next note or up to three after
 * it, the nearest first, so it keeps up with a player who skipped a few notes and the run still
 * ends at its last note. The figures come from the alignment either way.
 */
export const LOOKAHEAD = 4;

/** A key as played, on the run's clock (ms from its first key); `off` null while it is down. */
export type RunKey = PlayedNote;

export interface ScaleRunState {
  phase: 'waiting' | 'playing' | 'done';
  /** The notes of the hand played, in order. */
  expected: readonly ScaleNote[];
  /** The next note the cursor points at; `expected.length` once the last one is played. */
  next: number;
  /** Expected indexes played, as the cursor saw them. */
  played: readonly number[];
  /** The last key that was not the next note, until the next right one; for a flash. */
  wrongKey: number | null;
  keys: readonly RunKey[];
  pedal: readonly PedalChange[];
  /** The pedal was down when the run began. */
  pedalAtStart: boolean;
  /** Whether it is down now, followed in every phase, so the next run knows how it starts. */
  pedalDown: boolean;
  /** `performance.now()` of the first key; null while waiting. */
  origin: number | null;
  /** Epoch ms of the first key. */
  startedAt: number | null;
  /** On the run's clock, for the idle end. */
  lastKeyAt: number | null;
  end: RunEnd | null;
}

export type RunEvent =
  | { type: 'on'; midi: number; velocity: number; time: number; at: number }
  | { type: 'off'; midi: number; time: number }
  | { type: 'pedal'; down: boolean; time: number }
  /** Time passes; ends the run once it has been idle for `IDLE_END_MS`. */
  | { type: 'tick'; time: number }
  | { type: 'stop'; time: number };

export function waitingRun(expected: readonly ScaleNote[], pedalDown = false): ScaleRunState {
  return {
    phase: 'waiting',
    expected,
    next: 0,
    played: [],
    wrongKey: null,
    keys: [],
    pedal: [],
    pedalAtStart: pedalDown,
    pedalDown,
    origin: null,
    startedAt: null,
    lastKeyAt: null,
    end: null,
  };
}

/** Rounded to 0.1 ms: event clocks are finer than anything a player does. */
const clock = (state: ScaleRunState, time: number) => Math.round((time - state.origin!) * 10) / 10;

function finish(state: ScaleRunState, end: RunEnd): ScaleRunState {
  return { ...state, phase: 'done', end, wrongKey: null };
}

/** The latest key of that pitch still down is let go; a key held from before the run has none. */
function release(state: ScaleRunState, event: { midi: number; time: number }): ScaleRunState {
  const time = clock(state, event.time);
  let index = -1;
  for (let i = state.keys.length - 1; i >= 0; i--) {
    const key = state.keys[i]!;
    if (key.midi === event.midi && key.off === null) {
      index = i;
      break;
    }
  }
  if (index < 0) return state;
  const keys = state.keys.map((key, i) => (i === index ? { ...key, off: time } : key));
  return { ...state, keys };
}

/** Every key of the run has been let go (or the run has none). */
export function allReleased(state: Pick<ScaleRunState, 'keys'>): boolean {
  return state.keys.every((key) => key.off !== null);
}

export function runStep(state: ScaleRunState, event: RunEvent): ScaleRunState {
  if (state.phase === 'done') {
    if (event.type === 'pedal') return { ...state, pedalDown: event.down };
    // The keys still down at the end are let go after it: their releases belong to the run.
    if (event.type === 'off' && state.origin !== null) return release(state, event);
    return state;
  }
  if (state.phase === 'waiting') {
    if (event.type === 'pedal')
      return { ...state, pedalAtStart: event.down, pedalDown: event.down };
    if (event.type !== 'on') return state;
    // Only the scale's first key starts it: whatever is played before is not the run.
    if (event.midi !== state.expected[0]?.midi) return { ...state, wrongKey: event.midi };
    const started: ScaleRunState = {
      ...state,
      phase: 'playing',
      origin: event.time,
      startedAt: event.at,
      wrongKey: null,
      next: 1,
      played: [0],
      keys: [{ midi: event.midi, velocity: event.velocity, on: 0, off: null }],
      lastKeyAt: 0,
    };
    return started.expected.length === 1 ? finish(started, 'finished') : started;
  }

  switch (event.type) {
    case 'on': {
      const on = clock(state, event.time);
      const keys = [...state.keys, { midi: event.midi, velocity: event.velocity, on, off: null }];
      const { expected, next } = state;
      // The next note, or the nearest of the few after it when notes were skipped.
      let hit: number | null = null;
      for (let i = next; i < Math.min(expected.length, next + LOOKAHEAD); i++) {
        if (expected[i]!.midi === event.midi) {
          hit = i;
          break;
        }
      }
      const moved: ScaleRunState =
        hit === null
          ? { ...state, keys, lastKeyAt: on, wrongKey: event.midi }
          : {
              ...state,
              keys,
              lastKeyAt: on,
              wrongKey: null,
              next: hit + 1,
              played: [...state.played, hit],
            };
      return moved.next >= expected.length ? finish(moved, 'finished') : moved;
    }
    case 'off':
      return release(state, event);
    case 'pedal':
      return {
        ...state,
        pedalDown: event.down,
        pedal: [...state.pedal, { down: event.down, time: clock(state, event.time) }],
      };
    case 'tick':
      return state.lastKeyAt !== null && clock(state, event.time) - state.lastKeyAt >= IDLE_END_MS
        ? finish(state, 'idle')
        : state;
    case 'stop':
      return finish(state, 'stopped');
  }
}

/** The pedal was down at some point of the run. */
export function usedPedal(state: Pick<ScaleRunState, 'pedal' | 'pedalAtStart'>): boolean {
  return state.pedalAtStart || state.pedal.some((change) => change.down);
}

/**
 * Whether the keys carry loudness: the computer keyboard and the on-screen piano send one fixed
 * velocity, and so does an instrument set to a fixed touch; either way there is nothing to measure.
 */
export function velocityMeasured(keys: readonly Pick<RunKey, 'velocity'>[]): boolean {
  return keys.some((key) => key.velocity !== keys[0]!.velocity);
}

/**
 * Runs one after another: once a run is done, the scale's first key starts the next, so the
 * player plays again without a button. Everything else after the end is ignored.
 */
export function sessionStep(state: ScaleRunState, event: RunEvent): ScaleRunState {
  if (state.phase === 'done' && event.type === 'on' && event.midi === state.expected[0]?.midi)
    return runStep(waitingRun(state.expected, state.pedalDown), event);
  return runStep(state, event);
}
