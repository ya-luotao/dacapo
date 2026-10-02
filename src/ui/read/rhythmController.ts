import { isRhythmAnswer } from '../../core/answers.ts';
import type { Rng } from '../../core/random.ts';
import { getRhythmLevel, type RhythmLevelId } from '../../core/rhythmCells.ts';
import {
  endRhythmSession,
  nextExercise,
  nextRhythmExercise,
  recordRhythmRun,
  startRhythmSession,
  summarizeRhythmSession,
  type RhythmRun,
  type RhythmSessionState,
} from '../../core/rhythmRead.ts';
import type { PracticeStore } from '../practice/store.ts';

export interface RhythmConfig {
  level: RhythmLevelId;
  /** Beats a minute. */
  bpm: number;
  /** Exercises. */
  length: number;
  /** Items to work on (`rhythm:<cell>:<meter>`): their cells come first ("Practise these"). */
  focus?: readonly string[];
}

export interface RhythmControllerOptions {
  practice: PracticeStore;
  /** Epoch ms, for stored timestamps. */
  now?: () => number;
  rng?: Rng;
  newId?: () => string;
}

export interface RhythmController {
  /** null while no session was started (the setup screen). */
  getState: () => RhythmSessionState | null;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  start: (config: RhythmConfig) => void;
  /** A run played to its end; `zeroAt`: the epoch ms of its first downbeat. */
  recordRun: (run: RhythmRun, zeroAt: number) => void;
  /** The next exercise, or the summary after the last. */
  next: () => void;
  /** Ends the running session early; the runs played are kept. */
  stop: () => void;
  /** Leaves the summary for the setup screen. */
  close: () => void;
  /** Stops a running session. The controller stays usable. */
  dispose: () => void;
}

/**
 * Drives one session of rhythm lines on top of `core/rhythmRead.ts`, as the theory controller
 * does for cards: draws each exercise from the player's answers, records every cell of every run
 * played to its end and the session when it ends. The run itself (the click, the taps) is the
 * page's. Framework-free, so it is testable.
 */
export function createRhythmController({
  practice,
  now = Date.now,
  rng = Math.random,
  newId = () => crypto.randomUUID(),
}: RhythmControllerOptions): RhythmController {
  let state: RhythmSessionState | null = null;
  const listeners = new Set<() => void>();

  const answers = () => practice.getSnapshot().answers.filter(isRhythmAnswer);

  function update(next: RhythmSessionState | null) {
    const prev = state;
    if (next === prev) return;
    state = next;
    if (prev && next && prev.id === next.id) {
      for (const answer of next.answers.slice(prev.answers.length)) practice.recordAnswer(answer);
      if (prev.phase === 'running' && next.phase === 'done' && next.answers.length > 0)
        practice.recordSession({ kind: 'rhythm', ...summarizeRhythmSession(next) });
    }
    for (const listener of [...listeners]) listener();
  }

  function stop() {
    if (state) update(endRhythmSession(state, now()));
  }

  return {
    getState: () => state,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    start(config) {
      stop();
      const level = getRhythmLevel(config.level);
      update(
        startRhythmSession({
          id: newId(),
          level: config.level,
          bpm: config.bpm,
          length: config.length,
          at: now(),
          exercise: nextExercise(level, answers(), rng, config.focus),
          focus: config.focus,
        }),
      );
    },
    recordRun(run, zeroAt) {
      if (state) update(recordRhythmRun(state, run, zeroAt, newId));
    },
    next() {
      if (!state || state.phase !== 'running') return;
      const level = getRhythmLevel(state.level);
      update(nextRhythmExercise(state, nextExercise(level, answers(), rng, state.focus), now()));
    },
    stop,
    close() {
      stop();
      update(null);
    },
    dispose: stop,
  };
}
