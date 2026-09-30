import { activeTime } from './activity.ts';
import {
  answerNameOf,
  getEarLevel,
  judgeChordKeys,
  judgeIntervalKey,
  levelsOf,
  makePrompt,
  parseItem,
  type Direction,
  type EarFamily,
  type EarLevel,
  type EarLevelId,
  type Prompt,
} from './earItems.ts';
import { judgeEchoKey, type MelodyKey } from './earMelody.ts';
import type { Rng } from './random.ts';
import { median, TIMEOUT_MS } from './session.ts';
import { pickItem, statsFromAttempts, type NoteStats, type StatsByKey } from './weakness.ts';

// An ear-training session (docs/EAR.md): one item at a time, answered on the keyboard or by name.
// Like `session.ts`, two clocks never mixed: `time` values are on the performance.now() timeline
// (event timestamps, the scheduled prompt) and only subtracted from each other; `at` values are
// epoch ms and are what gets stored.

export type AnswerMode = 'play' | 'name';
export const ANSWER_MODES: readonly AnswerMode[] = ['play', 'name'];

/** The weakness model's speed target for ear items: hearing takes longer than reading a note. */
export const EAR_TARGET_MS = 2000;

/** The scored first answer to one item. Plain data, so it can be stored and synced as is. */
export interface EarAnswer {
  /** Stable and unique, so imports and sync can merge by id. */
  id: string;
  sessionId: string;
  family: EarFamily;
  level: EarLevelId;
  /** `int:M3:up`, `chord:min:1st`, `echo:EC3`. */
  item: string;
  /** Always `play` for a melody. */
  by: AnswerMode;
  /** The prompt's keys, in the order played (a chord's from low to high). */
  prompt: number[];
  /**
   * Played: the keys (for an interval the one key, for a chord the keys held, low to high, for a
   * melody the keys in order up to and including the first wrong one).
   * Named: the name chosen (`P5`, `maj:1st`).
   */
  answer: number[] | string;
  correct: boolean;
  /** From the prompt's last note-on (as last played) to the answer, or a melody's last key. */
  ms: number;
  /** "Hear again" before the answer. */
  replays: number;
  /** Epoch ms of the answer. */
  at: number;
  /** A melody's key, so its notes are spelled as the session wrote them; only for Echo. */
  key?: MelodyKey;
}

export interface EarCard {
  /** 0-based position in the session. */
  index: number;
  prompt: Prompt;
  /**
   * performance.now() of the last note-on of the prompt as last played (or of the correction
   * after a wrong answer); keys and names before it do not count. Null until it is scheduled.
   */
  opensAt: number | null;
  replays: number;
  /** `waiting` until the first answer, then `correct` or `wrong`. */
  status: 'waiting' | 'correct' | 'wrong';
  /** Keys pressed since the answer window opened and still held (a chord being played). */
  held: readonly number[];
  /** A melody being played back: its keys played right so far. They stand through a replay. */
  played: readonly number[];
  /** The scored answer, once given. */
  answer: number[] | string | null;
}

export interface EarSessionState {
  id: string;
  family: EarFamily;
  level: EarLevelId;
  by: AnswerMode;
  /** The directions intervals are played in; empty for chords and melodies. */
  directions: readonly Direction[];
  /** Items to answer; normally one of `SESSION_LENGTHS`. */
  length: number;
  /** The items drawn from. */
  items: readonly string[];
  startedAt: number;
  endedAt: number | null;
  phase: 'running' | 'done';
  card: EarCard;
  answers: readonly EarAnswer[];
}

export interface EarStartOptions {
  id: string;
  level: EarLevel;
  by: AnswerMode;
  directions: readonly Direction[];
  items: readonly string[];
  length: number;
  at: number;
  stats: StatsByKey;
  rng: Rng;
}

function newCard(
  index: number,
  items: readonly string[],
  stats: StatsByKey,
  previous: string | null,
  rng: Rng,
): EarCard {
  // An Echo level is one item, a new melody every time.
  const item =
    items.length === 1 ? items[0]! : pickItem(items, stats, previous, rng, EAR_TARGET_MS);
  return {
    index,
    prompt: makePrompt(item, rng),
    opensAt: null,
    replays: 0,
    status: 'waiting',
    held: [],
    played: [],
    answer: null,
  };
}

export function startEarSession(options: EarStartOptions): EarSessionState {
  const { level, items, stats, rng } = options;
  return {
    id: options.id,
    family: level.family,
    level: level.id,
    // A melody can only be played back.
    by: level.family === 'echo' ? 'play' : options.by,
    directions: level.family === 'interval' ? options.directions : [],
    length: options.length,
    items,
    startedAt: options.at,
    endedAt: null,
    phase: 'running',
    card: newCard(0, items, stats, null, rng),
    answers: [],
  };
}

/**
 * The prompt of card `index` (or the correction after a wrong answer) was scheduled; its last
 * note-on is at `opensAt`. Keys held until then do not count until pressed again. With `replay`
 * ("Hear again") before the answer, the replay is counted; one after the answer is not. The keys
 * of a melody played back so far stand: the answer goes on where it was.
 */
export function promptScheduled(
  state: EarSessionState,
  index: number,
  opensAt: number,
  replay: boolean,
): EarSessionState {
  const { card } = state;
  if (state.phase !== 'running' || card.index !== index) return state;
  const counted = replay && card.status === 'waiting';
  return {
    ...state,
    card: { ...card, opensAt, held: [], replays: card.replays + (counted ? 1 : 0) },
  };
}

/** Whether an answer at `time` counts: the card waits for one and its window is open. */
function open(state: EarSessionState, time: number): boolean {
  const { card } = state;
  return (
    state.phase === 'running' &&
    card.status === 'waiting' &&
    card.opensAt !== null &&
    time >= card.opensAt
  );
}

function scored(
  state: EarSessionState,
  answer: number[] | string,
  correct: boolean,
  time: number,
  at: number,
  newId: () => string,
): EarSessionState {
  const { card } = state;
  const record: EarAnswer = {
    id: newId(),
    sessionId: state.id,
    family: state.family,
    level: state.level,
    item: card.prompt.item,
    by: state.by,
    prompt: [...card.prompt.notes],
    answer,
    correct,
    ms: time - card.opensAt!,
    replays: card.replays,
    at,
    ...(card.prompt.melody && {
      key: { tonic: card.prompt.melody.tonic, scale: card.prompt.melody.scale },
    }),
  };
  return {
    ...state,
    answers: [...state.answers, record],
    card: { ...card, status: correct ? 'correct' : 'wrong', answer, held: [] },
  };
}

/**
 * A note-on while answering by playing. An interval is judged by the first key other than the
 * shown one; a chord by the keys held since the window opened (`judgeChordKeys`); a melody key
 * by key, in order, the first wrong one ending it (`judgeEchoKey`). Keys before the window
 * opens, and every key once the item is answered, change nothing here.
 * `newId` is only called for the scored answer.
 */
export function pressKey(
  state: EarSessionState,
  midi: number,
  time: number,
  at: number,
  newId: () => string,
): EarSessionState {
  if (state.by !== 'play' || !open(state, time)) return state;
  const { card } = state;
  if (state.family === 'echo') {
    const result = judgeEchoKey(card.prompt.notes, card.played, midi);
    const played = [...card.played, midi];
    if (result === 'next') return { ...state, card: { ...card, played } };
    return scored(state, played, result === 'right', time, at, newId);
  }
  if (state.family === 'interval') {
    const result = judgeIntervalKey(card.prompt, midi);
    if (result === 'ignored') return state;
    return scored(state, [midi], result === 'right', time, at, newId);
  }
  const held = [...new Set([...card.held, midi])].sort((a, b) => a - b);
  const level = getEarLevel(state.level);
  const bassMatters = level.family === 'chord' && level.bassMatters;
  const result = judgeChordKeys(card.prompt, held, bassMatters);
  if (result === 'pending') return { ...state, card: { ...card, held } };
  return scored(state, held, result === 'right', time, at, newId);
}

/** A note-off: the key no longer counts towards the chord being played. */
export function releaseKey(state: EarSessionState, midi: number): EarSessionState {
  const { card } = state;
  if (!card.held.includes(midi)) return state;
  return { ...state, card: { ...card, held: card.held.filter((m) => m !== midi) } };
}

/** A name chosen while answering by name (`P5`, `min:1st`). */
export function chooseName(
  state: EarSessionState,
  name: string,
  time: number,
  at: number,
  newId: () => string,
): EarSessionState {
  if (state.by !== 'name' || !open(state, time)) return state;
  const item = parseItem(state.card.prompt.item)!;
  return scored(state, name, name === answerNameOf(item), time, at, newId);
}

export interface EarAdvanceOptions {
  at: number;
  stats: StatsByKey;
  rng: Rng;
}

/** After an answer: the next item, or the end of the session. Otherwise nothing changes. */
export function advanceEar(
  state: EarSessionState,
  { at, stats, rng }: EarAdvanceOptions,
): EarSessionState {
  if (state.phase !== 'running' || state.card.status === 'waiting') return state;
  if (state.answers.length >= state.length) return endEarSession(state, at);
  return {
    ...state,
    card: newCard(state.card.index + 1, state.items, stats, state.card.prompt.item, rng),
  };
}

/** Ends the session now, e.g. when the user stops early. */
export function endEarSession(state: EarSessionState, at: number): EarSessionState {
  if (state.phase === 'done') return state;
  return { ...state, phase: 'done', endedAt: at };
}

// --- Figures ---------------------------------------------------------------------------------

/** Answers whose time says something about hearing: right, without a replay, not timed out. */
export function isTimedAnswer(answer: EarAnswer): boolean {
  return answer.correct && answer.replays === 0 && answer.ms <= TIMEOUT_MS;
}

/** An item answered wrong, and what was answered. */
export interface MissedItem {
  item: string;
  answer: number[] | string;
  /**
   * The prompt's keys: an interval played is told by the key against the given one, a melody by
   * the interval into the wrong note.
   */
  prompt: number[];
  /** A melody's key (`EarAnswer.key`), to spell its notes. */
  key?: MelodyKey;
}

/** What a finished (or stopped) ear session amounts to. Plain data, so it can be stored as is. */
export interface EarSessionSummary {
  id: string;
  family: EarFamily;
  level: EarLevelId;
  by: AnswerMode;
  startedAt: number;
  endedAt: number;
  /** Time spent on the items; pauses longer than `IDLE_MS` count as `IDLE_MS`. */
  activeMs: number;
  /** Items planned. */
  length: number;
  /** Items answered. */
  items: number;
  correct: number;
  /** null when no item was answered. */
  accuracy: number | null;
  /** Over timed answers only (`isTimedAnswer`); null when there are none. */
  medianMs: number | null;
  /** "Hear again" over the answered items. */
  replays: number;
  /** Every wrong answer, in order. */
  missed: MissedItem[];
}

export type EarSummaryInput = Pick<
  EarSessionState,
  'id' | 'family' | 'level' | 'by' | 'length' | 'startedAt' | 'endedAt' | 'answers'
>;

export function summarizeEar(state: EarSummaryInput): EarSessionSummary {
  const { answers } = state;
  const endedAt = state.endedAt ?? answers.at(-1)?.at ?? state.startedAt;
  const correct = answers.filter((a) => a.correct).length;
  return {
    id: state.id,
    family: state.family,
    level: state.level,
    by: state.by,
    startedAt: state.startedAt,
    endedAt,
    activeMs: activeTime([state.startedAt, ...answers.map((a) => a.at), endedAt]),
    length: state.length,
    items: answers.length,
    correct,
    accuracy: answers.length > 0 ? correct / answers.length : null,
    medianMs: median(answers.filter(isTimedAnswer).map((a) => a.ms)),
    replays: answers.reduce((sum, a) => sum + a.replays, 0),
    missed: answers
      .filter((a) => !a.correct)
      .map((a) => ({
        item: a.item,
        answer: Array.isArray(a.answer) ? [...a.answer] : a.answer,
        prompt: [...a.prompt],
        ...(a.key && { key: { ...a.key } }),
      })),
  };
}

/**
 * The summary of a session whose answers were stored but whose end was not (the tab was closed
 * mid-session). `answers` must belong to one session, in the order they happened.
 */
export function recoverEarSummary(answers: readonly EarAnswer[]): EarSessionSummary | null {
  const first = answers[0];
  const last = answers.at(-1);
  if (!first || !last) return null;
  return summarizeEar({
    id: first.sessionId,
    family: first.family,
    level: first.level,
    by: first.by,
    length: answers.length,
    startedAt: Math.round(first.at - first.ms),
    endedAt: last.at,
    answers,
  });
}

export function byAnswerTime(a: Pick<EarAnswer, 'at' | 'id'>, b: Pick<EarAnswer, 'at' | 'id'>) {
  return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Per-item stats, recomputed from the answers (no stored stats): the note model's, with a
 * replayed answer counted like a hinted one, for accuracy but not for time.
 */
export function earStats(answers: readonly EarAnswer[]): Record<string, NoteStats> {
  return statsFromAttempts(
    answers.map((a) => ({
      note: a.item,
      correct: a.correct,
      ms: a.ms,
      hinted: a.replays > 0,
      timedOut: a.ms > TIMEOUT_MS,
      at: a.at,
    })),
  );
}

/** Melodies per Echo session: fewer than questions, since a melody takes longer. */
export const ECHO_SESSION_LENGTHS = [5, 10, 20] as const;
export type EchoSessionLength = (typeof ECHO_SESSION_LENGTHS)[number];
export const DEFAULT_ECHO_SESSION_LENGTH: EchoSessionLength = 10;

// --- Mastery ---------------------------------------------------------------------------------

export const EAR_MASTERY_WINDOW = 40;
/** An Echo level is mastered over fewer answers: each is a whole melody. */
export const ECHO_MASTERY_WINDOW = 20;
export const EAR_MASTERY_ACCURACY = 0.9;

/** The answers a level's mastery is over: 20 melodies for Echo, 40 answers otherwise. */
export function masteryWindow(level: EarLevelId): number {
  return getEarLevel(level).family === 'echo' ? ECHO_MASTERY_WINDOW : EAR_MASTERY_WINDOW;
}

export interface EarLevelProgress {
  level: EarLevelId;
  /** Every answer ever given at this level, replayed or not. */
  total: number;
  /** Answers without a replay in the window (at most `masteryWindow(level)`). */
  answers: number;
  /** The window: 40 answers, or 20 melodies. */
  window: number;
  accuracy: number | null;
  /** Shown, not part of mastery: over the timed answers of the window. */
  medianMs: number | null;
  mastered: boolean;
}

/**
 * Mastery over the level's last `masteryWindow(level)` answers given without a replay, in any
 * direction: a full window at ≥ 90 % right. `answers` must be in the order they happened.
 */
export function earLevelProgress(
  answers: readonly EarAnswer[],
  level: EarLevelId,
): EarLevelProgress {
  const size = masteryWindow(level);
  const ofLevel = answers.filter((a) => a.level === level);
  const window = ofLevel.filter((a) => a.replays === 0).slice(-size);
  const correct = window.filter((a) => a.correct).length;
  const accuracy = window.length > 0 ? correct / window.length : null;
  return {
    level,
    total: ofLevel.length,
    answers: window.length,
    window: size,
    accuracy,
    medianMs: median(window.filter(isTimedAnswer).map((a) => a.ms)),
    mastered: window.length >= size && accuracy !== null && accuracy >= EAR_MASTERY_ACCURACY,
  };
}

/** The family's first level not mastered yet, or its last once all are. */
export function suggestedEarLevel(
  family: EarFamily,
  progress: ReadonlyMap<EarLevelId, EarLevelProgress>,
): EarLevelId {
  const levels = levelsOf(family);
  return levels.find((level) => !progress.get(level.id)?.mastered)?.id ?? levels.at(-1)!.id;
}
