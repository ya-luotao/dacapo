import {
  getEarLevel,
  levelItems,
  promptPlan,
  type ChordStyle,
  type Direction,
  type EarLevelId,
  type PlannedNote,
} from '../../core/earItems.ts';
import {
  advanceEar,
  chooseName,
  earStats,
  endEarSession,
  pressKey,
  promptScheduled,
  releaseKey,
  startEarSession,
  summarizeEar,
  type AnswerMode,
  type EarSessionState,
  type PromptDraw,
} from '../../core/earSession.ts';
import { isEarAnswer } from '../../core/answers.ts';
import type { Rng } from '../../core/random.ts';
import { drawTransposition, getTune, tuneKey, tunePrompt } from '../../core/tunes.ts';
import type { PracticeStore } from '../practice/store.ts';

/** How long a right answer stays on screen before the next item. */
export const ADVANCE_DELAY_MS = 400;
/** From Start to the first prompt: the session is on screen before it sounds. */
export const FIRST_LEAD_MS = 500;
/** From a new item, "Hear again" or a wrong answer to its first note. */
export const PROMPT_LEAD_MS = 150;
/** After a wrong answer, a breath before the right answer is played. */
export const CORRECTION_LEAD_MS = 500;

/** Where the prompts sound: the instrument or the built-in piano, through the scheduler. */
export interface EarSound {
  /** Queues `notes` from `start` (performance.now()), ending the previous prompt's notes. */
  play: (notes: readonly PlannedNote[], start: number) => void;
  silence: () => void;
}

export interface EarConfig {
  level: EarLevelId;
  /** Ignored for Echo: a melody is always played back. */
  by: AnswerMode;
  /** Intervals: the directions to play them in. */
  directions: readonly Direction[];
  /** Chords: broken, then block, or block only. */
  chordStyle: ChordStyle;
  /** Ignored for a tune: its phrases, then the whole of it. */
  length: number;
  /** A tune: in the key of its lead sheet (the default), or in another drawn here. */
  tuneKey?: 'own' | 'other';
}

export interface EarView {
  session: EarSessionState;
  chordStyle: ChordStyle;
  /** The prompt (or the correction) is playing and its answer window is not open yet. */
  listening: boolean;
}

export interface EarControllerOptions {
  practice: PracticeStore;
  sound: EarSound;
  /** performance.now(), the clock of key events and of the scheduler. */
  clock?: () => number;
  /** Epoch ms, for stored timestamps. */
  now?: () => number;
  rng?: Rng;
  newId?: () => string;
  setTimer?: (run: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export interface EarController {
  /** null while no session was started (the setup screen). */
  getState: () => EarView | null;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  start: (config: EarConfig) => void;
  /** Plays the prompt again ("Hear again"). */
  hearAgain: () => void;
  /** A note-on with its `performance.now()` timestamp. */
  press: (midi: number, time: number) => void;
  release: (midi: number) => void;
  /** A name chosen by button or number key, with the event's timestamp. */
  choose: (name: string, time: number) => void;
  /** After a wrong answer: on to the next item. */
  next: () => void;
  /** The sound was cut from outside (the page was hidden): nothing is playing any more. */
  interrupted: () => void;
  /** Ends the running session early; the answered items are kept. */
  stop: () => void;
  /** Leaves the summary for the setup screen. */
  close: () => void;
  /** Cancels timers, silences and stops a running session. The controller stays usable. */
  dispose: () => void;
}

/**
 * Drives one ear-training session on top of the pure `core/earSession.ts` functions: plays each
 * prompt through the scheduler (never into the input), opens the answer window at the prompt's
 * last note-on, and records every scored answer and the finished session in the practice store.
 * Framework-free, so it is testable.
 */
export function createEarController({
  practice,
  sound,
  clock = () => performance.now(),
  now = Date.now,
  rng = Math.random,
  newId = () => crypto.randomUUID(),
  setTimer = (run, ms) => window.setTimeout(run, ms),
  clearTimer = (id) => window.clearTimeout(id),
}: EarControllerOptions): EarController {
  let view: EarView | null = null;
  let advanceTimer: number | null = null;
  let listenTimer: number | null = null;
  /** How the session's prompts are drawn: a tune's in the session's key (`tunes.ts`). */
  let draw: PromptDraw | undefined;
  const listeners = new Set<() => void>();

  function cancel(timer: number | null) {
    if (timer !== null) clearTimer(timer);
  }

  function cancelTimers() {
    cancel(advanceTimer);
    cancel(listenTimer);
    advanceTimer = listenTimer = null;
  }

  function notify() {
    for (const listener of [...listeners]) listener();
  }

  function setListening(listening: boolean) {
    if (!view || view.listening === listening) return;
    view = { ...view, listening };
    notify();
  }

  /**
   * Plays the current card's prompt from `lead` ms on; with `replay`, as "Hear again"; as the
   * `correction` after a wrong answer, a melody without its tonic chord (of a whole tune, the
   * phrase it went wrong in).
   */
  function playPrompt(lead: number, replay: boolean, correction = false) {
    if (!view || view.session.phase !== 'running') return;
    const { card } = view.session;
    const wrongAt = Array.isArray(card.answer) ? card.answer.length - 1 : 0;
    const plan = promptPlan(card.prompt, view.chordStyle, correction, wrongAt);
    const start = clock() + lead;
    sound.play(plan.notes, start);
    const opensAt = start + plan.lastOn;
    cancel(listenTimer);
    listenTimer = setTimer(
      () => {
        listenTimer = null;
        setListening(false);
      },
      Math.max(0, opensAt - clock()),
    );
    update(
      { ...view, listening: true },
      promptScheduled(view.session, card.index, opensAt, replay),
    );
  }

  function update(base: EarView, next: EarSessionState) {
    // An event that changed nothing (a key while listening, a note-off) re-renders nothing.
    if (next === base.session && base === view) return;
    const prev = base.session;
    view = { ...base, session: next };
    if (prev.id === next.id) {
      if (next.answers.length > prev.answers.length) {
        practice.recordAnswer(next.answers.at(-1)!);
      }
      if (prev.phase === 'running' && next.phase === 'done') {
        cancelTimers();
        sound.silence();
        view = { ...view, listening: false };
        if (next.answers.length > 0) practice.recordSession({ kind: 'ear', ...summarizeEar(next) });
      } else if (prev.card.index !== next.card.index) {
        // A new item: its prompt.
        notify();
        playPrompt(PROMPT_LEAD_MS, false);
        return;
      } else if (next.card.status === 'correct' && prev.card.status !== 'correct') {
        cancel(advanceTimer);
        advanceTimer = setTimer(onAdvance, ADVANCE_DELAY_MS);
      } else if (next.card.status === 'wrong' && prev.card.status !== 'wrong') {
        // The right answer, played once; keys move on only once it has sounded.
        notify();
        playPrompt(CORRECTION_LEAD_MS, false, true);
        return;
      }
    }
    notify();
  }

  function advance() {
    if (!view) return;
    cancelTimers();
    const stats = earStats(practice.getSnapshot().answers.filter(isEarAnswer));
    update(view, advanceEar(view.session, { at: now(), stats, rng, prompt: draw }));
  }

  function onAdvance() {
    advanceTimer = null;
    advance();
  }

  function stop() {
    if (view) update(view, endEarSession(view.session, now()));
  }

  return {
    getState: () => view,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    start(config) {
      cancelTimers();
      stop();
      const level = getEarLevel(config.level);
      const stats = earStats(practice.getSnapshot().answers.filter(isEarAnswer));
      // A tune is in one key from its first phrase to the whole of it.
      const semitones =
        level.family === 'tune' && config.tuneKey === 'other' ? drawTransposition(rng) : 0;
      draw = level.family === 'tune' ? (item) => tunePrompt(item, semitones) : undefined;
      const session = startEarSession({
        id: newId(),
        level,
        by: config.by,
        directions: config.directions,
        items: levelItems(level, config.directions),
        length: config.length,
        at: now(),
        stats,
        rng,
        prompt: draw,
        ...(level.family === 'tune' && { key: tuneKey(getTune(level.id), semitones) }),
      });
      view = { session, chordStyle: config.chordStyle, listening: false };
      notify();
      playPrompt(FIRST_LEAD_MS, false);
    },
    hearAgain() {
      if (!view || view.session.phase !== 'running') return;
      const { card } = view.session;
      // Nothing waits for the right answer to be read: a replay is its own listening.
      if (card.status === 'correct') return;
      // A tune gone wrong is heard again as it was corrected: the phrase, without the chord.
      playPrompt(PROMPT_LEAD_MS, true, card.status === 'wrong' && card.prompt.tune !== undefined);
    },
    press(midi, time) {
      if (!view) return;
      const { card } = view.session;
      if (card.status === 'wrong') {
        if (card.opensAt !== null && time >= card.opensAt) advance();
        return;
      }
      update(view, pressKey(view.session, midi, time, now(), newId));
    },
    release(midi) {
      if (view) update(view, releaseKey(view.session, midi));
    },
    choose(name, time) {
      if (view) update(view, chooseName(view.session, name, time, now(), newId));
    },
    next() {
      if (view?.session.card.status !== 'wrong') return;
      sound.silence();
      advance();
    },
    interrupted() {
      cancel(listenTimer);
      listenTimer = null;
      setListening(false);
    },
    stop,
    close() {
      cancelTimers();
      stop();
      view = null;
      notify();
    },
    dispose() {
      cancelTimers();
      stop();
      sound.silence();
    },
  };
}
