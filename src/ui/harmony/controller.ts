import { isChordSymbolAnswer } from '../../core/answers.ts';
import {
  getHarmonyLevel,
  harmonyLevelItems,
  type HarmonyLevelId,
} from '../../core/chordSymbols.ts';
import {
  advanceHarmony,
  endHarmonySession,
  harmonyStats,
  markHarmonyPainted,
  pressHarmonyKey,
  releaseHarmonyKey,
  setHarmonyHint,
  startHarmonySession,
  summarizeHarmony,
  type HarmonySessionState,
} from '../../core/harmonySession.ts';
import type { Rng } from '../../core/random.ts';
import type { PracticeStore } from '../practice/store.ts';
import { ADVANCE_DELAY_MS } from '../read/controller.ts';

export interface HarmonyConfig {
  level: HarmonyLevelId;
  length: number;
  hint: boolean;
  /** Some of the level's items to draw from, in place of them all ("Practise these"). */
  items?: readonly string[];
}

export interface HarmonyControllerOptions {
  practice: PracticeStore;
  /** Epoch ms, for stored timestamps. */
  now?: () => number;
  rng?: Rng;
  newId?: () => string;
  setTimer?: (run: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export interface HarmonyController {
  /** null while no session was started (the setup screen). */
  getState: () => HarmonySessionState | null;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  start: (config: HarmonyConfig) => void;
  painted: (cardIndex: number, time: number) => void;
  /** A note-on with its `performance.now()` timestamp. */
  press: (midi: number, time: number) => void;
  /** A note-off with its timestamp. */
  release: (midi: number, time: number) => void;
  setHint: (hint: boolean) => void;
  /** Ends the running session early; the answered cards are kept. */
  stop: () => void;
  /** Leaves the summary for the setup screen. */
  close: () => void;
  /** Cancels timers and stops a running session. The controller stays usable. */
  dispose: () => void;
}

/**
 * Drives one session of chord symbols on top of the pure `core/harmonySession.ts` functions, as
 * Read's controllers do: records every scored answer and the finished session (kind `harmony`) in
 * the practice store, and moves on 400 ms after a right answer. Framework-free, so it is testable.
 */
export function createHarmonyController({
  practice,
  now = Date.now,
  rng = Math.random,
  newId = () => crypto.randomUUID(),
  setTimer = (run, ms) => window.setTimeout(run, ms),
  clearTimer = (id) => window.clearTimeout(id),
}: HarmonyControllerOptions): HarmonyController {
  let state: HarmonySessionState | null = null;
  let timer: number | null = null;
  const listeners = new Set<() => void>();

  function cancelTimer() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  const stats = () => harmonyStats(practice.getSnapshot().answers.filter(isChordSymbolAnswer));

  function update(next: HarmonySessionState | null) {
    const prev = state;
    if (next === prev) return;
    state = next;
    if (prev && next && prev.id === next.id) {
      if (next.answers.length > prev.answers.length) {
        practice.recordAnswer(next.answers.at(-1)!);
      }
      if (prev.phase === 'running' && next.phase === 'done') {
        cancelTimer();
        if (next.answers.length > 0) {
          practice.recordSession({ kind: 'harmony', ...summarizeHarmony(next) });
        }
      } else if (next.card.status === 'correct' && prev.card.status !== 'correct') {
        timer = setTimer(onAdvance, ADVANCE_DELAY_MS);
      }
    }
    for (const listener of [...listeners]) listener();
  }

  function onAdvance() {
    timer = null;
    if (state) update(advanceHarmony(state, { at: now(), stats: stats(), rng }));
  }

  function stop() {
    if (state) update(endHarmonySession(state, now()));
  }

  return {
    getState: () => state,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    start(config) {
      cancelTimer();
      stop();
      const level = getHarmonyLevel(config.level);
      update(
        startHarmonySession({
          id: newId(),
          level,
          length: config.length,
          hint: config.hint,
          at: now(),
          stats: stats(),
          rng,
          items: config.items ?? harmonyLevelItems(level),
        }),
      );
    },
    painted(cardIndex, time) {
      if (state) update(markHarmonyPainted(state, cardIndex, time));
    },
    press(midi, time) {
      if (state) update(pressHarmonyKey(state, midi, time, now(), newId));
    },
    release(midi, time) {
      if (state) update(releaseHarmonyKey(state, midi, time));
    },
    setHint(hint) {
      if (state) update(setHarmonyHint(state, hint));
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
