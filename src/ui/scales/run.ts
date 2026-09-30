// One scale run as it is played: waiting for the scale's first key, then every key collected
// until the last note, a pause or Stop. The cursor on the score follows the steps as they come — a
// step is the notes due together, one with one hand, a pair hands together — forgiving a few
// skipped ones; what counts afterwards is the alignment of evenness.ts over all the keys kept here.
// Framework-free, so it is testable.

import type { PlayedNote, RunInput } from '../../core/evenness.ts';
import type { ClickSettings, ScaleClick } from '../../core/scaleClick.ts';
import type { PedalChange, RunEnd } from '../../core/scaleRecords.ts';
import type { ScaleNote } from '../../core/scaleTypes.ts';

export type { PedalChange, RunEnd } from '../../core/scaleRecords.ts';

/** A run ends after this long without a key. */
export const IDLE_END_MS = 3000;
/**
 * The cursor looks this many steps ahead for the key played: the next step or up to three after
 * it, the nearest first, so it keeps up with a player who skipped a few notes and the run still
 * ends at its last note. The figures come from the alignment either way.
 */
export const LOOKAHEAD = 4;

/** The notes due together, as indexes into `expected`: one hand's note, or both hands' pair. */
export interface RunStep {
  notes: readonly number[];
}

/** The steps of a run: the notes of the same place in each hand's run go together. */
export function runSteps(expected: readonly ScaleNote[]): RunStep[] {
  const steps: number[][] = [];
  expected.forEach((note, i) => (steps[note.index] ??= []).push(i));
  return steps.map((notes) => ({ notes }));
}

/** A key as played, on the run's clock (ms from its first key); `off` null while it is down. */
export type RunKey = PlayedNote;

/** A run with the click: its grid, fixed when Start is pressed. */
export interface RunGrid extends ClickSettings {
  /** `performance.now()` of the moment the first note is due. */
  origin: number;
  /** The calibrated latency taken off every key, ms. */
  latency: number;
}

export interface ScaleRunState {
  phase: 'waiting' | 'playing' | 'done';
  /** The notes of the run: one hand's, or the right hand's then the left's. */
  expected: readonly ScaleNote[];
  steps: readonly RunStep[];
  /** The step the cursor points at; `steps.length` once the last one is played. */
  next: number;
  /** Indexes into `expected` of the notes played, as the cursor saw them. */
  played: readonly number[];
  /** The last key that was no note of the next steps, until the next right one; for a flash. */
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
  /** With the click: the grid of this run (the next run needs Start again); null at free tempo. */
  grid: RunGrid | null;
  /** When Stop ended it, on the run's clock. */
  stoppedAt: number | null;
}

export type RunEvent =
  | { type: 'on'; midi: number; velocity: number; time: number; at: number }
  | { type: 'off'; midi: number; time: number }
  | { type: 'pedal'; down: boolean; time: number }
  /** Time passes; ends the run once it has been idle for `IDLE_END_MS` (at free tempo only). */
  | { type: 'tick'; time: number }
  | { type: 'stop'; time: number }
  /** With the click: its last beat has gone by. */
  | { type: 'over' }
  /** With the click: Start, a new run on this grid. */
  | { type: 'arm'; grid: RunGrid };

export function waitingRun(
  expected: readonly ScaleNote[],
  pedalDown = false,
  grid: RunGrid | null = null,
): ScaleRunState {
  return {
    phase: 'waiting',
    expected,
    steps: runSteps(expected),
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
    grid,
    stoppedAt: null,
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

/** The cursor past the steps whose notes are all played. */
function advance(state: ScaleRunState): ScaleRunState {
  let next = state.next;
  while (
    next < state.steps.length &&
    state.steps[next]!.notes.every((n) => state.played.includes(n))
  )
    next++;
  return next === state.next ? state : { ...state, next };
}

/** Every key of the run has been let go (or the run has none). */
export function allReleased(state: Pick<ScaleRunState, 'keys'>): boolean {
  return state.keys.every((key) => key.off !== null);
}

export function runStep(state: ScaleRunState, event: RunEvent): ScaleRunState {
  if (event.type === 'arm') return waitingRun(state.expected, state.pedalDown, event.grid);
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
    // Only the scale's first key (of either hand) starts it: whatever is played before is not the run.
    const first = state.steps[0]?.notes.find((n) => state.expected[n]!.midi === event.midi);
    if (first === undefined) return { ...state, wrongKey: event.midi };
    const started = advance({
      ...state,
      phase: 'playing',
      origin: event.time,
      startedAt: event.at,
      wrongKey: null,
      played: [first],
      keys: [{ midi: event.midi, velocity: event.velocity, on: 0, off: null }],
      lastKeyAt: 0,
    });
    return started.next >= started.steps.length ? finish(started, 'finished') : started;
  }

  switch (event.type) {
    case 'on': {
      const on = clock(state, event.time);
      const keys = [...state.keys, { midi: event.midi, velocity: event.velocity, on, off: null }];
      // The key's note in the nearest step: the next one, a step behind it that one hand has
      // played and the other has not yet (a hand trailing), or one of the few after it when notes
      // were skipped; behind before ahead at the same distance. The cursor moves on to a step
      // ahead; a step behind is only filled in.
      const { expected, steps, next, played } = state;
      const noteIn = (at: number) =>
        steps[at]!.notes.find((n) => expected[n]!.midi === event.midi && !played.includes(n));
      const started = (at: number) => steps[at]!.notes.some((n) => played.includes(n));
      let hit: number | null = null;
      let at = next;
      for (let d = 0; d < LOOKAHEAD && hit === null; d++) {
        const behind = next - d;
        if (d > 0 && behind >= 0 && started(behind)) {
          const note = noteIn(behind);
          if (note !== undefined) {
            hit = note;
            at = next;
            break;
          }
        }
        const ahead = next + d;
        if (ahead < steps.length) {
          const note = noteIn(ahead);
          if (note !== undefined) {
            hit = note;
            at = ahead;
          }
        }
      }
      const moved: ScaleRunState =
        hit === null
          ? { ...state, keys, lastKeyAt: on, wrongKey: event.midi }
          : advance({
              ...state,
              keys,
              lastKeyAt: on,
              wrongKey: null,
              next: at,
              played: [...played, hit],
            });
      return moved.next >= steps.length ? finish(moved, 'finished') : moved;
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
      // With the click the run lasts as long as its grid.
      return state.grid === null &&
        state.lastKeyAt !== null &&
        clock(state, event.time) - state.lastKeyAt >= IDLE_END_MS
        ? finish(state, 'idle')
        : state;
    case 'stop':
      return { ...finish(state, 'stopped'), stoppedAt: clock(state, event.time) };
    case 'over':
      // The click has played the whole scale: whatever was not played is missed.
      return finish(state, 'finished');
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
 * player plays again without a button. Everything else after the end is ignored. With the click a
 * run needs Start (and its count-in), so a done run waits for that instead.
 */
export function sessionStep(state: ScaleRunState, event: RunEvent): ScaleRunState {
  if (
    state.phase === 'done' &&
    state.grid === null &&
    event.type === 'on' &&
    state.steps[0]?.notes.some((n) => state.expected[n]!.midi === event.midi)
  )
    return runStep(waitingRun(state.expected, state.pedalDown), event);
  return runStep(state, event);
}

/** A clicked run's grid as its record keeps it, on the run's clock; null at free tempo. */
export function runClick(state: ScaleRunState): ScaleClick | null {
  const { grid } = state;
  if (grid === null || state.origin === null) return null;
  return {
    bpm: grid.bpm,
    perBeat: grid.perBeat,
    latency: grid.latency,
    zero: Math.round((grid.origin - state.origin) * 10) / 10,
    stoppedAt: state.stoppedAt,
  };
}

/** What the analysis takes of a run: its notes, its keys, the pedal, whether loudness counts. */
export function runInput(state: ScaleRunState): RunInput {
  return {
    expected: state.expected,
    played: state.keys,
    velocityMeasured: velocityMeasured(state.keys),
    pedal: { atStart: state.pedalAtStart, changes: state.pedal },
  };
}
