import { isTheoryAnswer } from '../../core/answers.ts';
import type { AnswerMode } from '../../core/earSession.ts';
import type { Rng } from '../../core/random.ts';
import { getTheoryLevel, theoryLevelItems, type TheoryLevelId } from '../../core/theoryItems.ts';
import {
  advanceTheory,
  chooseTheoryName,
  endTheorySession,
  markTheoryPainted,
  pressTheoryKey,
  releaseTheoryKey,
  rightKeys,
  setTheoryHint,
  startTheorySession,
  summarizeTheory,
  theoryStats,
  type TheorySessionState,
} from '../../core/theorySession.ts';
import { keyAnswered } from '../../core/instrument.ts';
import { readInstrumentKeys } from '../instrument.ts';
import type { PracticeStore } from '../practice/store.ts';
import { ADVANCE_DELAY_MS } from './controller.ts';

export interface TheoryConfig {
  level: TheoryLevelId;
  /** How chords are answered; intervals are named and key signatures played whatever it says. */
  by: AnswerMode;
  length: number;
  hint: boolean;
  /** Some of the level's items to draw from, in place of them all ("Practise these"). */
  items?: readonly string[];
}

export interface TheoryControllerOptions {
  practice: PracticeStore;
  /** Epoch ms, for stored timestamps. */
  now?: () => number;
  rng?: Rng;
  newId?: () => string;
  setTimer?: (run: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export interface TheoryController {
  /** null while no session was started (the setup screen). */
  getState: () => TheorySessionState | null;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  start: (config: TheoryConfig) => void;
  painted: (cardIndex: number, time: number) => void;
  /** A note-on with its `performance.now()` timestamp. */
  press: (midi: number, time: number) => void;
  /** A note-off with its timestamp. */
  release: (midi: number, time: number) => void;
  /** A name chosen by button or key, with the event's timestamp. */
  choose: (name: string, time: number) => void;
  setHint: (hint: boolean) => void;
  /** Ends the running session early; the answered cards are kept. */
  stop: () => void;
  /** Leaves the summary for the setup screen. */
  close: () => void;
  /** Cancels timers and stops a running session. The controller stays usable. */
  dispose: () => void;
}

/**
 * Drives one session of theory cards on top of the pure `core/theorySession.ts` functions, as
 * the Read controller does for notes: records every scored answer and the finished session in
 * the practice store, and moves on 400 ms after a right answer. Framework-free, so it is testable.
 */
export function createTheoryController({
  practice,
  now = Date.now,
  rng = Math.random,
  newId = () => crypto.randomUUID(),
  setTimer = (run, ms) => window.setTimeout(run, ms),
  clearTimer = (id) => window.clearTimeout(id),
}: TheoryControllerOptions): TheoryController {
  let state: TheorySessionState | null = null;
  /** A key held that stands for a written key the keyboard lacks (the same note, another octave). */
  const standsFor = new Map<number, number>();
  let timer: number | null = null;
  const listeners = new Set<() => void>();

  function cancelTimer() {
    if (timer === null) return;
    clearTimer(timer);
    timer = null;
  }

  const stats = () => theoryStats(practice.getSnapshot().answers.filter(isTheoryAnswer));

  function update(next: TheorySessionState | null) {
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
          practice.recordSession({ kind: 'theory', ...summarizeTheory(next) });
        }
      } else if (next.card.status === 'correct' && prev.card.status !== 'correct') {
        timer = setTimer(onAdvance, ADVANCE_DELAY_MS);
      }
    }
    for (const listener of [...listeners]) listener();
  }

  function onAdvance() {
    timer = null;
    if (state) update(advanceTheory(state, { at: now(), stats: stats(), rng }));
  }

  function stop() {
    if (state) update(endTheorySession(state, now()));
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
      const level = getTheoryLevel(config.level);
      update(
        startTheorySession({
          id: newId(),
          level,
          by: config.by,
          length: config.length,
          hint: config.hint,
          at: now(),
          stats: stats(),
          rng,
          items: config.items ?? theoryLevelItems(level),
        }),
      );
    },
    painted(cardIndex, time) {
      if (state) update(markTheoryPainted(state, cardIndex, time));
    },
    press(midi, time) {
      if (!state) return;
      // A written key the keyboard lacks is answered by the same note in another octave: the
      // key played stands for it until it is let go.
      const key = keyAnswered(midi, rightKeys(state.card.prompt), readInstrumentKeys());
      if (key === midi) standsFor.delete(midi);
      else standsFor.set(midi, key);
      update(pressTheoryKey(state, key, time, now(), newId));
    },
    release(midi, time) {
      const key = standsFor.get(midi) ?? midi;
      standsFor.delete(midi);
      if (state) update(releaseTheoryKey(state, key, time));
    },
    choose(name, time) {
      if (state) update(chooseTheoryName(state, name, time, now(), newId));
    },
    setHint(hint) {
      if (state) update(setTheoryHint(state, hint));
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
