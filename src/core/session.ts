import type { Level, LevelId, StaffNote } from './levels.ts';
import type { Rng } from './random.ts';
import { pickNext, type StatsByKey } from './weakness.ts';

// Two clocks, never mixed: `time` values are on the performance.now() timeline (event timeStamps,
// the paint stamp) and only ever subtracted from each other; `at` values are epoch ms (Date.now())
// and are what gets stored.

export const SESSION_LENGTHS = [10, 20, 50] as const;
export type SessionLength = (typeof SESSION_LENGTHS)[number];
export const DEFAULT_SESSION_LENGTH: SessionLength = 20;
/** Answers slower than this are kept but left out of every reaction-time figure. */
export const TIMEOUT_MS = 30_000;

/** The scored first answer to one card. Plain data, so it can be stored as is. */
export interface Attempt {
  sessionId: string;
  level: LevelId;
  /** `StaffNote.key` of the card, e.g. `C4@treble`. */
  note: string;
  /** MIDI number of the card. */
  target: number;
  /** MIDI number of the first key pressed after the card was painted. */
  played: number;
  correct: boolean;
  /** From paint to key press. */
  ms: number;
  /** The letter-name hint was visible before the answer. */
  hinted: boolean;
  /** `ms` is over `TIMEOUT_MS`. */
  timedOut: boolean;
  /** Epoch ms of the answer. */
  at: number;
}

export interface Card {
  /** 0-based position in the session; tells a stale paint stamp from the current card. */
  index: number;
  note: StaffNote;
  /** When the card was painted, or null while it is not on screen yet. */
  shownAt: number | null;
  hinted: boolean;
  /** `waiting` until the first press, `wrong` until the right key, then `correct`. */
  status: 'waiting' | 'wrong' | 'correct';
  /** The latest wrong key, for feedback. */
  wrongKey: number | null;
}

export interface SessionState {
  id: string;
  level: LevelId;
  /** Cards to answer; normally one of `SESSION_LENGTHS`. */
  length: number;
  hint: boolean;
  startedAt: number;
  endedAt: number | null;
  phase: 'running' | 'done';
  card: Card;
  attempts: readonly Attempt[];
}

export interface StartOptions {
  id: string;
  level: Level;
  length: number;
  hint: boolean;
  at: number;
  stats: StatsByKey;
  rng: Rng;
}

function newCard(index: number, note: StaffNote, hint: boolean): Card {
  return { index, note, shownAt: null, hinted: hint, status: 'waiting', wrongKey: null };
}

export function startSession({
  id,
  level,
  length,
  hint,
  at,
  stats,
  rng,
}: StartOptions): SessionState {
  return {
    id,
    level: level.id,
    length,
    hint,
    startedAt: at,
    endedAt: null,
    phase: 'running',
    card: newCard(0, pickNext(level.notes, stats, null, rng), hint),
    attempts: [],
  };
}

/** The card with `index` is on screen as of `time`. Only the first stamp counts. */
export function markPainted(state: SessionState, index: number, time: number): SessionState {
  const { card } = state;
  if (state.phase !== 'running' || card.index !== index || card.shownAt !== null) return state;
  return { ...state, card: { ...card, shownAt: time } };
}

export function setHint(state: SessionState, hint: boolean): SessionState {
  const { card } = state;
  const hinted = card.hinted || (hint && card.status === 'waiting');
  return { ...state, hint, card: { ...card, hinted } };
}

/**
 * A note-on. The first one after the card was painted is scored; a key pressed before that
 * (or still held from the previous card, which sends no new note-on) does not count.
 * After a wrong answer the card stays until the right key is pressed.
 */
export function pressKey(
  state: SessionState,
  midi: number,
  time: number,
  at: number,
): SessionState {
  const { card } = state;
  if (state.phase !== 'running' || card.shownAt === null || time < card.shownAt) return state;
  const correct = midi === card.note.midi;
  switch (card.status) {
    case 'correct':
      return state;
    case 'wrong':
      return {
        ...state,
        card: correct
          ? { ...card, status: 'correct' }
          : card.wrongKey === midi
            ? card
            : { ...card, wrongKey: midi },
      };
    case 'waiting': {
      const ms = time - card.shownAt;
      const attempt: Attempt = {
        sessionId: state.id,
        level: state.level,
        note: card.note.key,
        target: card.note.midi,
        played: midi,
        correct,
        ms,
        hinted: card.hinted,
        timedOut: ms > TIMEOUT_MS,
        at,
      };
      return {
        ...state,
        attempts: [...state.attempts, attempt],
        card: { ...card, status: correct ? 'correct' : 'wrong', wrongKey: correct ? null : midi },
      };
    }
  }
}

export interface AdvanceOptions {
  level: Level;
  at: number;
  stats: StatsByKey;
  rng: Rng;
}

/** After a correct answer: the next card, or the end of the session. Otherwise nothing changes. */
export function advance(
  state: SessionState,
  { level, at, stats, rng }: AdvanceOptions,
): SessionState {
  if (state.phase !== 'running' || state.card.status !== 'correct') return state;
  if (state.attempts.length >= state.length) return endSession(state, at);
  const note = pickNext(level.notes, stats, state.card.note, rng);
  return { ...state, card: newCard(state.card.index + 1, note, state.hint) };
}

/** Ends the session now, e.g. when the user stops early. */
export function endSession(state: SessionState, at: number): SessionState {
  if (state.phase === 'done') return state;
  return { ...state, phase: 'done', endedAt: at };
}

/** Attempts whose reaction time says something about reading speed. */
export function isTimed(attempt: Attempt): boolean {
  return attempt.correct && !attempt.hinted && !attempt.timedOut;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface SlowNote {
  note: string;
  ms: number;
}

/** What a finished (or stopped) session amounts to. Plain data, so it can be stored as is. */
export interface SessionSummary {
  id: string;
  level: LevelId;
  startedAt: number;
  endedAt: number;
  /** Cards planned. */
  length: number;
  /** Cards answered. */
  cards: number;
  correct: number;
  /** null when no card was answered. */
  accuracy: number | null;
  /** Over timed attempts only; null when there are none. */
  medianMs: number | null;
  /** Up to three notes, slowest first, by their slowest timed answer. */
  slowest: SlowNote[];
  /** Notes answered wrong, in order of first appearance. */
  missed: string[];
}

export const SLOWEST_COUNT = 3;

export function summarize(state: SessionState): SessionSummary {
  const { attempts } = state;
  const correct = attempts.filter((a) => a.correct).length;
  const timed = attempts.filter(isTimed);
  const slowestByNote = new Map<string, number>();
  for (const { note, ms } of timed)
    slowestByNote.set(note, Math.max(ms, slowestByNote.get(note) ?? 0));
  return {
    id: state.id,
    level: state.level,
    startedAt: state.startedAt,
    endedAt: state.endedAt ?? attempts.at(-1)?.at ?? state.startedAt,
    length: state.length,
    cards: attempts.length,
    correct,
    accuracy: attempts.length > 0 ? correct / attempts.length : null,
    medianMs: median(timed.map((a) => a.ms)),
    slowest: [...slowestByNote]
      .map(([note, ms]) => ({ note, ms }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, SLOWEST_COUNT),
    missed: [...new Set(attempts.filter((a) => !a.correct).map((a) => a.note))],
  };
}
