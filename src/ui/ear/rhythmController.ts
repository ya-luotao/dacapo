import { isRhythmEarAnswer } from '../../core/answers.ts';
import { PROMPT_VELOCITY } from '../../core/earItems.ts';
import type { Rng } from '../../core/random.ts';
import type { PlayResult, StepTiming } from '../../core/rhythm.ts';
import {
  advanceRhythmEar,
  chooseBar,
  dictationRun,
  endRhythmEarSession,
  isDictationExtra,
  judgeTaps,
  makeQuestion,
  promptScheduled,
  PROMPT_KEY,
  questionItem,
  recordTaps,
  startRhythmEarSession,
  summarizeRhythmEar,
  type DictationRun,
  type RhythmEarLevelId,
  type RhythmEarMode,
  type RhythmEarSessionState,
} from '../../core/rhythmEar.ts';
import { createTapFilter } from '../../core/rhythmRead.ts';
import type { RhythmEnd } from '../../output/rhythm.ts';
import type { LastNote } from '../pieces/rhythm.ts';
import type { RhythmStart } from '../pieces/useRhythmPlayer.ts';
import type { PracticeStore } from '../practice/store.ts';

/** How long a right answer stays on screen (the bar drawn, or the choice) before the next. */
export const RIGHT_DELAY_MS = 1200;
/** After a wrong answer, a breath before the bar is played again. */
export const CORRECTION_LEAD_MS = 500;
/** From one bar to the next one's count-in. */
export const NEXT_LEAD_MS = 300;

/** The part of rhythm mode's player the dictation drives: its click, the prompt, the taps. */
export interface DictationPlayer {
  /** Starts a run (a previous one stops first); returns its origin, the prompt's downbeat. */
  start: (options: RhythmStart) => number;
  press: (midi: number, time: number) => PlayResult;
  stop: () => void;
}

export interface RhythmEarConfig {
  level: RhythmEarLevelId;
  by: RhythmEarMode;
  /** Beats a minute. */
  bpm: number;
  /** Bars. */
  length: number;
}

/** What is sounding: a question's run, and what it is for. */
export interface DictationSound {
  /** `tap`: the prompt and the bar to tap back; `prompt`: the prompt alone; `correction`: again. */
  kind: 'tap' | 'prompt' | 'correction';
  /** performance.now() of the prompt's downbeat. */
  origin: number;
  run: DictationRun;
}

export interface RhythmEarView {
  session: RhythmEarSessionState;
  sound: DictationSound | null;
  /** Tapping back: how the last tap was timed, for the quiet mark. */
  last: LastNote | null;
  /** The bar to tap was stopped before its end: nothing was kept. */
  stopped: boolean;
}

export interface RhythmEarControllerOptions {
  practice: PracticeStore;
  player: DictationPlayer;
  /** The calibrated latency, ms (0 without one). */
  latency: () => number;
  /** The click's volume, 0–100. */
  clickVolume: () => number;
  /** performance.now(), the clock of key events and of the run. */
  clock?: () => number;
  /** Epoch ms, for stored timestamps. */
  now?: () => number;
  rng?: Rng;
  newId?: () => string;
  setTimer?: (run: () => void, ms: number) => number;
  clearTimer?: (id: number) => void;
}

export interface RhythmEarController {
  /** null while no session was started (the setup screen). */
  getState: () => RhythmEarView | null;
  subscribe: (onChange: () => void) => () => void;
  /** Call from a user gesture: the first bar's click may create the AudioContext. */
  start: (config: RhythmEarConfig) => void;
  /** Plays the bar again (Space); before the answer it counts, and a bar to tap starts over. */
  hearAgain: () => void;
  /** A note-on (any key) while tapping back, with its performance.now() timestamp. */
  tap: (time: number) => void;
  /** A bar chosen (an index into the choices), with the event's timestamp. */
  choose: (index: number, time: number) => void;
  /** After an answer: on to the next bar. */
  next: () => void;
  /** The sound was cut from outside (the page was hidden): nothing goes on by itself. */
  interrupted: () => void;
  /** Ends the running session early; the bars answered are kept. */
  stop: () => void;
  /** Leaves the summary for the setup screen. */
  close: () => void;
  /** Cancels timers, silences and stops a running session. The controller stays usable. */
  dispose: () => void;
}

interface Current {
  sound: DictationSound;
  timings: StepTiming[];
  extras: number[];
  latency: number;
  counts: (line: number, time: number) => boolean;
}

/**
 * Drives a session of rhythm dictation on top of `core/rhythmEar.ts`: each bar through rhythm
 * mode's player (the count-in and the click on the AudioContext, the bar on the output's
 * scheduler), the taps against its plan, the choices against the prompt's last note-on; records
 * every answer and the session when it ends. Framework-free, so it is testable.
 */
export function createRhythmEarController({
  practice,
  player,
  latency,
  clickVolume,
  clock = () => performance.now(),
  now = Date.now,
  rng = Math.random,
  newId = () => crypto.randomUUID(),
  setTimer = (run, ms) => window.setTimeout(run, ms),
  clearTimer = (id) => window.clearTimeout(id),
}: RhythmEarControllerOptions): RhythmEarController {
  let view: RhythmEarView | null = null;
  let current: Current | null = null;
  let timer: number | null = null;
  const listeners = new Set<() => void>();

  const answers = () => practice.getSnapshot().answers.filter(isRhythmEarAnswer);

  function notify() {
    for (const listener of [...listeners]) listener();
  }

  function cancelTimer() {
    if (timer !== null) clearTimer(timer);
    timer = null;
  }

  function later(run: () => void, ms: number) {
    cancelTimer();
    timer = setTimer(() => {
      timer = null;
      run();
    }, ms);
  }

  /** A new view: records what the session gained, and reacts to an answer given. */
  function update(next: RhythmEarView) {
    const prev = view;
    view = next;
    if (prev && prev.session.id === next.session.id) {
      const before = prev.session;
      const after = next.session;
      for (const answer of after.answers.slice(before.answers.length))
        practice.recordAnswer(answer);
      if (before.phase === 'running' && after.phase === 'done') {
        cancelTimer();
        silence();
        if (after.answers.length > 0)
          practice.recordSession({ kind: 'ear', ...summarizeRhythmEar(after) });
      } else if (before.question.status === 'waiting' && after.question.status === 'correct') {
        later(advance, RIGHT_DELAY_MS);
      } else if (before.question.status === 'waiting' && after.question.status === 'wrong') {
        // The bar, played once more while it is read.
        later(() => play('correction'), CORRECTION_LEAD_MS);
      }
    }
    notify();
  }

  function silence() {
    current = null;
    player.stop();
    if (view?.sound) view = { ...view, sound: null };
  }

  /** Plays the question's bar: to tap back, or alone. A replay before the answer counts. */
  function play(kind: DictationSound['kind'], replay = false) {
    if (!view || view.session.phase !== 'running') return;
    const { session } = view;
    const { question } = session;
    const run = dictationRun(question.bar, question.meter, session.bpm, kind === 'tap');
    const offset = kind === 'tap' ? latency() : 0;
    const next: Current = {
      sound: { kind, origin: 0, run },
      timings: [],
      extras: [],
      latency: offset,
      counts: createTapFilter(),
    };
    current = next;
    const origin = player.start({
      plan: run.plan,
      backing: run.backing,
      velocity: PROMPT_VELOCITY,
      clickMode: 'on',
      volume: clickVolume(),
      latency: offset,
      onSettled: (timings) => next.timings.push(...timings),
      onEnd: (reason) => ended(next, reason),
    });
    next.sound = { ...next.sound, origin };
    update({
      ...view,
      sound: next.sound,
      last: null,
      stopped: false,
      session: promptScheduled(session, question.index, origin + run.lastOn, replay),
    });
  }

  function ended(run: Current, reason: RhythmEnd) {
    if (current !== run || !view) return;
    current = null;
    const base = { ...view, sound: null };
    const { session } = view;
    if (run.sound.kind !== 'tap' || session.question.status !== 'waiting') {
      update(base);
      return;
    }
    if (reason !== 'done') {
      update({ ...base, stopped: true });
      return;
    }
    const { question } = session;
    const tapped = judgeTaps(question.bar, question.meter, session.bpm, run.timings, run.extras);
    const answerStart = run.sound.origin + run.sound.run.answer!.start;
    // The epoch of the tapped bar's downbeat, for the answers' timestamps.
    const zeroAt = Math.round(now() - clock() + answerStart);
    update({ ...base, session: recordTaps(session, tapped, zeroAt, newId) });
  }

  function advance() {
    if (!view) return;
    cancelTimer();
    silence();
    const { session } = view;
    const next = advanceRhythmEar(
      session,
      () =>
        makeQuestion(session.question.index + 1, {
          level: session.level,
          by: session.by,
          answers: answers(),
          previous: questionItem(session.question),
          rng,
        }),
      now(),
    );
    update({ ...view, session: next, last: null, stopped: false });
    if (next.phase === 'running')
      later(() => play(next.by === 'play' ? 'tap' : 'prompt'), NEXT_LEAD_MS);
  }

  function stop() {
    if (!view) return;
    cancelTimer();
    silence();
    update({ ...view, session: endRhythmEarSession(view.session, now()) });
  }

  return {
    getState: () => view,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    start(config) {
      stop();
      const question = makeQuestion(0, {
        level: config.level,
        by: config.by,
        answers: answers(),
        previous: null,
        rng,
      });
      view = {
        session: startRhythmEarSession({
          id: newId(),
          level: config.level,
          by: config.by,
          bpm: config.bpm,
          length: config.length,
          at: now(),
          question,
        }),
        sound: null,
        last: null,
        stopped: false,
      };
      notify();
      play(config.by === 'play' ? 'tap' : 'prompt');
    },
    hearAgain() {
      if (!view || view.session.phase !== 'running') return;
      const { question } = view.session;
      if (question.status === 'correct') return;
      cancelTimer();
      if (question.status === 'waiting') play(view.session.by === 'play' ? 'tap' : 'prompt', true);
      else play('correction');
    },
    tap(time) {
      const run = current;
      if (!run || run.sound.kind !== 'tap' || !view) return;
      // A chord is one tap.
      if (!run.counts(0, time)) return;
      const result = player.press(PROMPT_KEY, time);
      const at = time - run.sound.origin - run.latency;
      if (isDictationExtra(run.sound.run, at, result.kind === 'hit')) {
        run.extras.push(at - run.sound.run.answer!.start);
        update({ ...view, last: { kind: 'extra' } });
      } else if (result.kind === 'hit') {
        update({ ...view, last: { kind: 'hit', deviation: result.deviation } });
      }
    },
    choose(index, time) {
      if (!view) return;
      const next = chooseBar(view.session, index, time, now(), newId);
      if (next !== view.session) update({ ...view, session: next });
    },
    next() {
      if (!view || view.session.question.status === 'waiting') return;
      advance();
    },
    interrupted() {
      // The run itself ends as interrupted (rhythm mode's player listens for it).
      cancelTimer();
    },
    stop,
    close() {
      stop();
      view = null;
      notify();
    },
    dispose() {
      cancelTimer();
      stop();
      player.stop();
    },
  };
}
