import { getLevel, type LevelId } from '../../core/levels.ts';
import type { Rng } from '../../core/random.ts';
import {
  advance,
  endSession,
  markPainted,
  pressKey,
  setHint,
  startSession,
  summarize,
  type SessionState,
} from '../../core/session.ts';
import type { PracticeStore } from '../practice/store.ts';

/** How long a correct answer stays on screen before the next card. */
export const ADVANCE_DELAY_MS = 400;

export interface ReadControllerOptions {
  practice: PracticeStore;
  /** Epoch ms, for stored timestamps. */
  now?: () => number;
  rng?: Rng;
  newId?: () => string;
  setTimer?: (run: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export interface ReadController {
  /** null while no session was started (the setup screen). */
  getState: () => SessionState | null;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  start: (level: LevelId, length: number, hint: boolean) => void;
  painted: (cardIndex: number, time: number) => void;
  /** A note-on with its `performance.now()` timestamp. */
  press: (midi: number, time: number) => void;
  setHint: (hint: boolean) => void;
  /** Ends the running session early; the answered cards are kept. */
  stop: () => void;
  /** Leaves the summary for the setup screen. */
  close: () => void;
  /** Cancels timers and stops a running session. The controller stays usable. */
  dispose: () => void;
}

/**
 * Drives one flashcard session on top of the pure `core/session.ts` functions and records every
 * scored attempt and finished session in the practice store. Framework-free, so it is testable.
 */
export function createReadController({
  practice,
  now = Date.now,
  rng = Math.random,
  newId = () => crypto.randomUUID(),
  setTimer = (run, ms) => window.setTimeout(run, ms),
  clearTimer = (id) => window.clearTimeout(id),
}: ReadControllerOptions): ReadController {
  let state: SessionState | null = null;
  let timer: number | null = null;
  const listeners = new Set<() => void>();

  function cancelTimer() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  function update(next: SessionState | null) {
    const prev = state;
    if (next === prev) return;
    state = next;
    if (prev && next && prev.id === next.id) {
      if (next.attempts.length > prev.attempts.length) {
        practice.recordAttempt(next.attempts.at(-1)!);
      }
      if (prev.phase === 'running' && next.phase === 'done') {
        cancelTimer();
        if (next.attempts.length > 0) practice.recordSession({ kind: 'read', ...summarize(next) });
      } else if (next.card.status === 'correct' && prev.card.status !== 'correct') {
        timer = setTimer(onAdvance, ADVANCE_DELAY_MS);
      }
    }
    for (const listener of [...listeners]) listener();
  }

  function onAdvance() {
    timer = null;
    if (!state) return;
    const { stats } = practice.getSnapshot();
    update(advance(state, { level: getLevel(state.level), at: now(), stats, rng }));
  }

  function stop() {
    if (state) update(endSession(state, now()));
  }

  return {
    getState: () => state,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    start(level, length, hint) {
      cancelTimer();
      stop();
      const { stats } = practice.getSnapshot();
      update(
        startSession({ id: newId(), level: getLevel(level), length, hint, at: now(), stats, rng }),
      );
    },
    painted(cardIndex, time) {
      if (state) update(markPainted(state, cardIndex, time));
    },
    press(midi, time) {
      if (state) update(pressKey(state, midi, time, now(), newId));
    },
    setHint(hint) {
      if (state) update(setHint(state, hint));
    },
    stop,
    close() {
      cancelTimer();
      stop();
      update(null);
    },
    dispose() {
      cancelTimer();
      stop();
    },
  };
}
