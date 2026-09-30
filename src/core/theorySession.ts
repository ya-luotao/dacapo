import { activeTime } from './activity.ts';
import type { AnswerMode } from './earSession.ts';
import type { Clef } from './note.ts';
import type { Rng } from './random.ts';
import { median, TIMEOUT_MS } from './session.ts';
import {
  chordAnswerName,
  getTheoryLevel,
  intervalAnswerName,
  isTonicKey,
  judgeWrittenChord,
  makeTheoryPrompt,
  parseTheoryItem,
  signatureId,
  spelledId,
  theoryLevelsOf,
  writtenKeys,
  type TheoryFamily,
  type TheoryLevel,
  type TheoryLevelId,
  type TheoryPrompt,
} from './theoryItems.ts';
import { pickItem, statsFromAttempts, type NoteStats, type StatsByKey } from './weakness.ts';

// A session of theory cards on Read (docs/EAR.md, "Clarifications (decided during E3)"): Read's
// rules for intervals, key signatures and chords written on the staff. One card at a time; the
// clock starts when it is painted; the first answer is scored and the card stays until the right
// one. As in `session.ts`, `time` values are on the performance.now() timeline and only ever
// subtracted from each other; `at` values are epoch ms and are what gets stored.

/** The scored first answer to one card. Plain data, so it can be stored and synced as is. */
export interface TheoryAnswer {
  /** Stable and unique, so imports and sync can merge by id. */
  id: string;
  sessionId: string;
  family: TheoryFamily;
  level: TheoryLevelId;
  /** `ri:A2:up`, `ks:3f:minor`, `rc:min:1st`. */
  item: string;
  /** Intervals are named, key signatures played, chords either. */
  by: AnswerMode;
  /**
   * The written notes as spelled pitches, left to right (`C4`, `D#4`, `Ebb5`; a chord low to
   * high), or the key signature (`3f`).
   */
  prompt: string[] | string;
  /** The staff an interval or a chord is written on; a key signature is on the grand staff. */
  clef?: Clef;
  /**
   * Named: the name chosen (`m3`, or `3` in RI1; a chord `F#:min:1st`). Played: the keys (a
   * key signature's one key; a chord's keys held, low to high).
   */
  answer: number[] | string;
  correct: boolean;
  /** From the card's paint to the answer. */
  ms: number;
  /** The letter names were shown before the answer: counted for accuracy, not for time. */
  hinted: boolean;
  /** Epoch ms of the answer. */
  at: number;
}

/** The weakness model's speed target: a card of two or three notes takes longer than one note. */
export function theoryTargetMs(family: TheoryFamily): number {
  return family === 'readChord' ? 3000 : 2000;
}

/** Mastery also needs the median answer under this. */
export function theoryMasteryMedianMs(family: TheoryFamily): number {
  return family === 'readChord' ? 4000 : 3000;
}

/** How each family is answered: intervals by name, key signatures on the keyboard. */
export function answerModeOf(family: TheoryFamily, chords: AnswerMode): AnswerMode {
  if (family === 'readInterval') return 'name';
  return family === 'keySignature' ? 'play' : chords;
}

export interface TheoryCard {
  /** 0-based position in the session; tells a stale paint stamp from the current card. */
  index: number;
  prompt: TheoryPrompt;
  /** When the card was painted, or null while it is not on screen yet. */
  shownAt: number | null;
  hinted: boolean;
  /** `waiting` until the first answer, `wrong` until the right one, then `correct`. */
  status: 'waiting' | 'wrong' | 'correct';
  /** A chord being played: the keys pressed since the card was painted and still held. */
  held: readonly number[];
  /** The latest wrong answer, for feedback: the keys, or the name. */
  wrong: number[] | string | null;
}

export interface TheorySessionState {
  id: string;
  family: TheoryFamily;
  level: TheoryLevelId;
  by: AnswerMode;
  /** Cards to answer; normally one of `SESSION_LENGTHS`. */
  length: number;
  hint: boolean;
  /** The items drawn from. */
  items: readonly string[];
  startedAt: number;
  endedAt: number | null;
  phase: 'running' | 'done';
  card: TheoryCard;
  answers: readonly TheoryAnswer[];
}

export interface TheoryStartOptions {
  id: string;
  level: TheoryLevel;
  /** How chords are answered; intervals are always named, key signatures always played. */
  by: AnswerMode;
  length: number;
  hint: boolean;
  at: number;
  stats: StatsByKey;
  rng: Rng;
  /** The level's items; `theoryLevelItems(level)`. */
  items: readonly string[];
}

function newCard(
  index: number,
  level: TheoryLevel,
  items: readonly string[],
  stats: StatsByKey,
  previous: string | null,
  hint: boolean,
  rng: Rng,
): TheoryCard {
  const item = pickItem(items, stats, previous, rng, theoryTargetMs(level.family));
  return {
    index,
    prompt: makeTheoryPrompt(level, item, rng),
    shownAt: null,
    hinted: hint,
    status: 'waiting',
    held: [],
    wrong: null,
  };
}

export function startTheorySession(options: TheoryStartOptions): TheorySessionState {
  const { level, items, stats, hint, rng } = options;
  return {
    id: options.id,
    family: level.family,
    level: level.id,
    by: answerModeOf(level.family, options.by),
    length: options.length,
    hint,
    items,
    startedAt: options.at,
    endedAt: null,
    phase: 'running',
    card: newCard(0, level, items, stats, null, hint, rng),
    answers: [],
  };
}

/** The card with `index` is on screen as of `time`. Only the first stamp counts. */
export function markTheoryPainted(
  state: TheorySessionState,
  index: number,
  time: number,
): TheorySessionState {
  const { card } = state;
  if (state.phase !== 'running' || card.index !== index || card.shownAt !== null) return state;
  return { ...state, card: { ...card, shownAt: time } };
}

/** The hint toggled: a card still waiting for its answer counts as hinted once it was shown. */
export function setTheoryHint(state: TheorySessionState, hint: boolean): TheorySessionState {
  const { card } = state;
  const hinted = card.hinted || (hint && card.status === 'waiting');
  return { ...state, hint, card: { ...card, hinted } };
}

/** Whether an answer at `time` can count: the card is on screen and not answered right yet. */
function live(state: TheorySessionState, time: number): boolean {
  const { card } = state;
  return (
    state.phase === 'running' &&
    card.status !== 'correct' &&
    card.shownAt !== null &&
    time >= card.shownAt
  );
}

/** Stored form of a card's prompt: its written notes, or its signature. */
export function storedPrompt(prompt: TheoryPrompt): string[] | string {
  return prompt.family === 'keySignature'
    ? signatureId(prompt.fifths)
    : prompt.notes.map(spelledId);
}

/**
 * An answer to the current card. While it waits, the answer is scored (`newId` is only called
 * then); after a wrong one, a right answer ends the card and another wrong one is only shown.
 */
function answered(
  state: TheorySessionState,
  answer: number[] | string,
  correct: boolean,
  time: number,
  at: number,
  newId: () => string,
  held: readonly number[],
): TheorySessionState {
  const { card } = state;
  const status = correct ? 'correct' : 'wrong';
  const wrong = correct ? card.wrong : answer;
  if (card.status !== 'waiting') return { ...state, card: { ...card, status, held, wrong } };
  const { prompt } = card;
  const record: TheoryAnswer = {
    id: newId(),
    sessionId: state.id,
    family: state.family,
    level: state.level,
    item: prompt.item,
    by: state.by,
    prompt: storedPrompt(prompt),
    ...(prompt.family !== 'keySignature' && { clef: prompt.clef }),
    answer,
    correct,
    ms: time - card.shownAt!,
    hinted: card.hinted,
    at,
  };
  return {
    ...state,
    answers: [...state.answers, record],
    card: { ...card, status, held, wrong },
  };
}

/**
 * A note-on while answering by playing. A key signature's tonic is right in any octave; a chord
 * is judged by the keys held since the card was painted: wrong at the first key it does not have,
 * right once exactly its written keys are held. A key pressed before the paint (or still held
 * from the last card) does not count until pressed again.
 */
export function pressTheoryKey(
  state: TheorySessionState,
  midi: number,
  time: number,
  at: number,
  newId: () => string,
): TheorySessionState {
  if (state.by !== 'play' || !live(state, time)) return state;
  const { card } = state;
  const { prompt } = card;
  if (prompt.family === 'keySignature') {
    const right = isTonicKey(prompt.fifths, prompt.mode, midi);
    return answered(state, [midi], right, time, at, newId, []);
  }
  if (prompt.family !== 'readChord') return state;
  const held = [...new Set([...card.held, midi])].sort((a, b) => a - b);
  const result = judgeWrittenChord(prompt.notes, held);
  if (result === 'pending') return { ...state, card: { ...card, held } };
  return answered(state, held, result === 'right', time, at, newId, held);
}

/**
 * A note-off: the key no longer counts towards the chord being played. After a wrong answer,
 * letting go of the wrong key while the written ones are held is the right answer.
 */
export function releaseTheoryKey(
  state: TheorySessionState,
  midi: number,
  time: number,
): TheorySessionState {
  const { card } = state;
  if (!card.held.includes(midi)) return state;
  const held = card.held.filter((m) => m !== midi);
  const { prompt } = card;
  if (
    card.status === 'wrong' &&
    prompt.family === 'readChord' &&
    live(state, time) &&
    judgeWrittenChord(prompt.notes, held) === 'right'
  ) {
    return { ...state, card: { ...card, held, status: 'correct' } };
  }
  return { ...state, card: { ...card, held } };
}

/** The name that answers the current card right (`m3`, `3`, `F#:min:1st`); null when played. */
export function rightName(state: Pick<TheorySessionState, 'level' | 'card'>): string | null {
  const level = getTheoryLevel(state.level);
  const { prompt } = state.card;
  if (prompt.family === 'readInterval' && level.family === 'readInterval') {
    return intervalAnswerName(level, prompt.item);
  }
  if (prompt.family === 'readChord') {
    const item = parseTheoryItem(prompt.item);
    if (item?.family !== 'readChord') return null;
    return chordAnswerName(prompt.root, item.quality, item.inversion);
  }
  return null;
}

/** The keys that answer the current card right when played: a chord's written keys. */
export function rightKeys(prompt: TheoryPrompt): number[] {
  return prompt.family === 'keySignature' ? [] : writtenKeys(prompt.notes);
}

/** A name chosen while answering by name: `m3` (`3` in RI1), `F#:min:1st`. */
export function chooseTheoryName(
  state: TheorySessionState,
  name: string,
  time: number,
  at: number,
  newId: () => string,
): TheorySessionState {
  if (state.by !== 'name' || !live(state, time)) return state;
  // A wrong name chosen again changes nothing.
  if (state.card.status === 'wrong' && state.card.wrong === name) return state;
  return answered(state, name, name === rightName(state), time, at, newId, []);
}

export interface TheoryAdvanceOptions {
  at: number;
  stats: StatsByKey;
  rng: Rng;
}

/** After a right answer: the next card, or the end of the session. Otherwise nothing changes. */
export function advanceTheory(
  state: TheorySessionState,
  { at, stats, rng }: TheoryAdvanceOptions,
): TheorySessionState {
  if (state.phase !== 'running' || state.card.status !== 'correct') return state;
  if (state.answers.length >= state.length) return endTheorySession(state, at);
  const level = getTheoryLevel(state.level);
  const card = newCard(
    state.card.index + 1,
    level,
    state.items,
    stats,
    state.card.prompt.item,
    state.hint,
    rng,
  );
  return { ...state, card };
}

/** Ends the session now, e.g. when the user stops early. */
export function endTheorySession(state: TheorySessionState, at: number): TheorySessionState {
  if (state.phase === 'done') return state;
  return { ...state, phase: 'done', endedAt: at };
}

// --- Figures ---------------------------------------------------------------------------------

/** Answers whose time says something about reading: right, without the hint, not timed out. */
export function isTimedTheory(answer: TheoryAnswer): boolean {
  return answer.correct && !answer.hinted && answer.ms <= TIMEOUT_MS;
}

/** A card answered wrong first: what was written and what was answered. */
export interface TheoryMissed {
  item: string;
  prompt: string[] | string;
  clef?: Clef;
  answer: number[] | string;
}

export interface SlowItem {
  item: string;
  ms: number;
}

/** What a finished (or stopped) theory session amounts to. Plain data, so it can be stored. */
export interface TheorySessionSummary {
  id: string;
  family: TheoryFamily;
  level: TheoryLevelId;
  by: AnswerMode;
  startedAt: number;
  endedAt: number;
  /** Time spent on the cards; pauses longer than `IDLE_MS` count as `IDLE_MS`. */
  activeMs: number;
  /** Cards planned. */
  length: number;
  /** Cards answered. */
  cards: number;
  correct: number;
  /** null when no card was answered. */
  accuracy: number | null;
  /** Over timed answers only (`isTimedTheory`); null when there are none. */
  medianMs: number | null;
  /** Up to three items, slowest first, by their slowest timed answer. */
  slowest: SlowItem[];
  /** Every card answered wrong first, in order. */
  missed: TheoryMissed[];
}

export const THEORY_SLOWEST_COUNT = 3;

export type TheorySummaryInput = Pick<
  TheorySessionState,
  'id' | 'family' | 'level' | 'by' | 'length' | 'startedAt' | 'endedAt' | 'answers'
>;

export function summarizeTheory(state: TheorySummaryInput): TheorySessionSummary {
  const { answers } = state;
  const endedAt = state.endedAt ?? answers.at(-1)?.at ?? state.startedAt;
  const correct = answers.filter((a) => a.correct).length;
  const timed = answers.filter(isTimedTheory);
  const slowestByItem = new Map<string, number>();
  for (const { item, ms } of timed)
    slowestByItem.set(item, Math.max(ms, slowestByItem.get(item) ?? 0));
  return {
    id: state.id,
    family: state.family,
    level: state.level,
    by: state.by,
    startedAt: state.startedAt,
    endedAt,
    activeMs: activeTime([state.startedAt, ...answers.map((a) => a.at), endedAt]),
    length: state.length,
    cards: answers.length,
    correct,
    accuracy: answers.length > 0 ? correct / answers.length : null,
    medianMs: median(timed.map((a) => a.ms)),
    slowest: [...slowestByItem]
      .map(([item, ms]) => ({ item, ms }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, THEORY_SLOWEST_COUNT),
    missed: answers
      .filter((a) => !a.correct)
      .map((a) => ({
        item: a.item,
        prompt: Array.isArray(a.prompt) ? [...a.prompt] : a.prompt,
        ...(a.clef && { clef: a.clef }),
        answer: Array.isArray(a.answer) ? [...a.answer] : a.answer,
      })),
  };
}

/**
 * The summary of a session whose answers were stored but whose end was not (the tab was closed
 * mid-session). `answers` must belong to one session, in the order they happened.
 */
export function recoverTheorySummary(
  answers: readonly TheoryAnswer[],
): TheorySessionSummary | null {
  const first = answers[0];
  const last = answers.at(-1);
  if (!first || !last) return null;
  return summarizeTheory({
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

/**
 * Per-item stats, recomputed from the answers (no stored stats): the note model's, a hinted
 * answer counted for accuracy but not for time.
 */
export function theoryStats(answers: readonly TheoryAnswer[]): Record<string, NoteStats> {
  return statsFromAttempts(
    answers.map((a) => ({
      note: a.item,
      correct: a.correct,
      ms: a.ms,
      hinted: a.hinted,
      timedOut: a.ms > TIMEOUT_MS,
      at: a.at,
    })),
  );
}

// --- Mastery ---------------------------------------------------------------------------------

export const THEORY_MASTERY_WINDOW = 40;
export const THEORY_MASTERY_ACCURACY = 0.9;

export interface TheoryLevelProgress {
  level: TheoryLevelId;
  /** Every card ever answered at this level, hinted or not. */
  total: number;
  /** Un-hinted cards in the window (at most `THEORY_MASTERY_WINDOW`). */
  cards: number;
  accuracy: number | null;
  /** Over the timed answers of the window. */
  medianMs: number | null;
  mastered: boolean;
}

/**
 * Mastery as Read's: over the level's last 40 un-hinted cards, ≥ 90 % right with the median of
 * the timely right answers under 3 s (intervals, key signatures) or 4 s (chords). `answers`
 * must be in the order they happened.
 */
export function theoryLevelProgress(
  answers: readonly TheoryAnswer[],
  level: TheoryLevelId,
): TheoryLevelProgress {
  const ofLevel = answers.filter((a) => a.level === level);
  const window = ofLevel.filter((a) => !a.hinted).slice(-THEORY_MASTERY_WINDOW);
  const correct = window.filter((a) => a.correct).length;
  const accuracy = window.length > 0 ? correct / window.length : null;
  const medianMs = median(window.filter(isTimedTheory).map((a) => a.ms));
  const limit = theoryMasteryMedianMs(getTheoryLevel(level).family);
  return {
    level,
    total: ofLevel.length,
    cards: window.length,
    accuracy,
    medianMs,
    mastered:
      window.length >= THEORY_MASTERY_WINDOW &&
      accuracy !== null &&
      accuracy >= THEORY_MASTERY_ACCURACY &&
      medianMs !== null &&
      medianMs < limit,
  };
}

/** The family's first level not mastered yet, or its last once all are. */
export function suggestedTheoryLevel(
  family: TheoryFamily,
  progress: ReadonlyMap<TheoryLevelId, TheoryLevelProgress>,
): TheoryLevelId {
  const levels = theoryLevelsOf(family);
  return levels.find((level) => !progress.get(level.id)?.mastered)?.id ?? levels.at(-1)!.id;
}
