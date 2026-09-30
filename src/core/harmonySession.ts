import { activeTime } from './activity.ts';
import {
  itemSymbol,
  judgeSymbolKeys,
  parseSymbolItem,
  type ChordSymbol,
  type HarmonyFamily,
  type HarmonyLevel,
  type HarmonyLevelId,
} from './chordSymbols.ts';
import type { Rng } from './random.ts';
import { median, TIMEOUT_MS } from './session.ts';
import { pickItem, statsFromAttempts, type NoteStats, type StatsByKey } from './weakness.ts';

// A session of chord symbols on the Harmony page (docs/HARMONY.md, "Chords (H1)"): Read's rules
// for a symbol to play. One card at a time; the clock starts when it is painted; the first answer
// is scored and the card stays until it is played right. As in `session.ts`, `time` values are on
// the performance.now() timeline and only ever subtracted from each other; `at` values are epoch
// ms and are what gets stored.

/** The scored first answer to one symbol. Plain data, so it can be stored and synced as is. */
export interface ChordSymbolAnswer {
  /** Stable and unique, so imports and sync can merge by id. */
  id: string;
  sessionId: string;
  family: HarmonyFamily;
  level: HarmonyLevelId;
  /** `sym:Dm7`. */
  item: string;
  /** Always played: the field every answer of the store has. */
  by: 'play';
  /** The symbol as written on the card (`Dm7`, `C/E`). */
  prompt: string;
  /** The keys held when it was judged, low to high. */
  answer: number[];
  correct: boolean;
  /** From the card's paint to the answer. */
  ms: number;
  /** The chord's notes were shown before the answer: counted for accuracy, not for time. */
  hinted: boolean;
  /** Epoch ms of the answer. */
  at: number;
}

/** The weakness model's speed target for a symbol: between a note (1.5 s) and a written chord. */
export const HARMONY_TARGET_MS = 2500;
/** Mastery also needs the median answer under this. */
export const HARMONY_MASTERY_MEDIAN_MS = 3000;
export const HARMONY_MASTERY_WINDOW = 40;
export const HARMONY_MASTERY_ACCURACY = 0.9;

export interface HarmonyCard {
  /** 0-based position in the session; tells a stale paint stamp from the current card. */
  index: number;
  item: string;
  symbol: ChordSymbol;
  /** When the card was painted, or null while it is not on screen yet. */
  shownAt: number | null;
  hinted: boolean;
  /** `waiting` until the first answer, `wrong` until the right one, then `correct`. */
  status: 'waiting' | 'wrong' | 'correct';
  /** The keys pressed since the card was painted and still held, low to high. */
  held: readonly number[];
  /** The keys of the latest wrong answer, for feedback. */
  wrong: readonly number[] | null;
}

export interface HarmonySessionState {
  id: string;
  family: HarmonyFamily;
  level: HarmonyLevelId;
  /** Cards to answer; normally one of `SESSION_LENGTHS`. */
  length: number;
  hint: boolean;
  /** The items drawn from. */
  items: readonly string[];
  startedAt: number;
  endedAt: number | null;
  phase: 'running' | 'done';
  card: HarmonyCard;
  answers: readonly ChordSymbolAnswer[];
}

export interface HarmonyStartOptions {
  id: string;
  level: HarmonyLevel;
  length: number;
  hint: boolean;
  at: number;
  stats: StatsByKey;
  rng: Rng;
  /** The level's items; `harmonyLevelItems(level)`. */
  items: readonly string[];
}

/** A card for `item`; throws for anything that is not a symbol's item. */
function newCard(
  index: number,
  items: readonly string[],
  stats: StatsByKey,
  previous: string | null,
  hint: boolean,
  rng: Rng,
): HarmonyCard {
  const item = pickItem(items, stats, previous, rng, HARMONY_TARGET_MS);
  const symbol = parseSymbolItem(item);
  if (!symbol) throw new RangeError(`Not a chord symbol: ${item}`);
  return {
    index,
    item,
    symbol,
    shownAt: null,
    hinted: hint,
    status: 'waiting',
    held: [],
    wrong: null,
  };
}

export function startHarmonySession(options: HarmonyStartOptions): HarmonySessionState {
  const { level, items, stats, hint, rng } = options;
  return {
    id: options.id,
    family: level.family,
    level: level.id,
    length: options.length,
    hint,
    items,
    startedAt: options.at,
    endedAt: null,
    phase: 'running',
    card: newCard(0, items, stats, null, hint, rng),
    answers: [],
  };
}

/** The card with `index` is on screen as of `time`. Only the first stamp counts. */
export function markHarmonyPainted(
  state: HarmonySessionState,
  index: number,
  time: number,
): HarmonySessionState {
  const { card } = state;
  if (state.phase !== 'running' || card.index !== index || card.shownAt !== null) return state;
  return { ...state, card: { ...card, shownAt: time } };
}

/** The hint toggled: a card still waiting for its answer counts as hinted once it was shown. */
export function setHarmonyHint(state: HarmonySessionState, hint: boolean): HarmonySessionState {
  const { card } = state;
  const hinted = card.hinted || (hint && card.status === 'waiting');
  return { ...state, hint, card: { ...card, hinted } };
}

/** Whether a key at `time` can count: the card is on screen and not answered right yet. */
function live(state: HarmonySessionState, time: number): boolean {
  const { card } = state;
  return (
    state.phase === 'running' &&
    card.status !== 'correct' &&
    card.shownAt !== null &&
    time >= card.shownAt
  );
}

/**
 * A note-on. The keys held since the card was painted are judged: wrong at the first one outside
 * the symbol's pitch classes, right once they are exactly its pitch classes (a slash chord's bass
 * lowest). While the card waits, that answer is scored (`newId` is only called then); after a
 * wrong one, a right answer ends the card and another wrong one is only shown. A key pressed
 * before the paint (or still held from the last card) does not count until pressed again.
 */
export function pressHarmonyKey(
  state: HarmonySessionState,
  midi: number,
  time: number,
  at: number,
  newId: () => string,
): HarmonySessionState {
  if (!live(state, time)) return state;
  const { card } = state;
  const held = [...new Set([...card.held, midi])].sort((a, b) => a - b);
  const result = judgeSymbolKeys(card.symbol, held);
  if (result === 'pending') return { ...state, card: { ...card, held } };
  const correct = result === 'right';
  const status = correct ? 'correct' : 'wrong';
  const wrong = correct ? card.wrong : held;
  if (card.status !== 'waiting') return { ...state, card: { ...card, status, held, wrong } };
  const record: ChordSymbolAnswer = {
    id: newId(),
    sessionId: state.id,
    family: state.family,
    level: state.level,
    item: card.item,
    by: 'play',
    prompt: itemSymbol(card.item),
    answer: held,
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
 * A note-off: the key no longer counts towards the chord. After a wrong answer, letting go of the
 * wrong keys while the right ones are held is the right answer.
 */
export function releaseHarmonyKey(
  state: HarmonySessionState,
  midi: number,
  time: number,
): HarmonySessionState {
  const { card } = state;
  if (!card.held.includes(midi)) return state;
  const held = card.held.filter((m) => m !== midi);
  if (
    card.status === 'wrong' &&
    live(state, time) &&
    judgeSymbolKeys(card.symbol, held) === 'right'
  ) {
    return { ...state, card: { ...card, held, status: 'correct' } };
  }
  return { ...state, card: { ...card, held } };
}

export interface HarmonyAdvanceOptions {
  at: number;
  stats: StatsByKey;
  rng: Rng;
}

/** After a right answer: the next card, or the end of the session. Otherwise nothing changes. */
export function advanceHarmony(
  state: HarmonySessionState,
  { at, stats, rng }: HarmonyAdvanceOptions,
): HarmonySessionState {
  if (state.phase !== 'running' || state.card.status !== 'correct') return state;
  if (state.answers.length >= state.length) return endHarmonySession(state, at);
  const card = newCard(state.card.index + 1, state.items, stats, state.card.item, state.hint, rng);
  return { ...state, card };
}

/** Ends the session now, e.g. when the user stops early. */
export function endHarmonySession(state: HarmonySessionState, at: number): HarmonySessionState {
  if (state.phase === 'done') return state;
  return { ...state, phase: 'done', endedAt: at };
}

// --- Figures ---------------------------------------------------------------------------------

/** Answers whose time says something about reading a symbol: right, without the hint, in time. */
export function isTimedHarmony(answer: ChordSymbolAnswer): boolean {
  return answer.correct && !answer.hinted && answer.ms <= TIMEOUT_MS;
}

/** A card played wrong first: its item and the keys held. */
export interface HarmonyMissed {
  item: string;
  answer: number[];
}

export interface HarmonySlowItem {
  item: string;
  ms: number;
}

/** What a finished (or stopped) session amounts to. Plain data, so it can be stored. */
export interface HarmonySessionSummary {
  id: string;
  family: HarmonyFamily;
  level: HarmonyLevelId;
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
  /** Over timed answers only (`isTimedHarmony`); null when there are none. */
  medianMs: number | null;
  /** Up to three items, slowest first, by their slowest timed answer. */
  slowest: HarmonySlowItem[];
  /** Every card answered wrong first, in order. */
  missed: HarmonyMissed[];
}

export const HARMONY_SLOWEST_COUNT = 3;

export type HarmonySummaryInput = Pick<
  HarmonySessionState,
  'id' | 'family' | 'level' | 'length' | 'startedAt' | 'endedAt' | 'answers'
>;

export function summarizeHarmony(state: HarmonySummaryInput): HarmonySessionSummary {
  const { answers } = state;
  const endedAt = state.endedAt ?? answers.at(-1)?.at ?? state.startedAt;
  const correct = answers.filter((a) => a.correct).length;
  const timed = answers.filter(isTimedHarmony);
  const slowestByItem = new Map<string, number>();
  for (const { item, ms } of timed) {
    slowestByItem.set(item, Math.max(ms, slowestByItem.get(item) ?? 0));
  }
  return {
    id: state.id,
    family: state.family,
    level: state.level,
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
      .slice(0, HARMONY_SLOWEST_COUNT),
    missed: answers.filter((a) => !a.correct).map((a) => ({ item: a.item, answer: [...a.answer] })),
  };
}

/**
 * The summary of a session whose answers were stored but whose end was not (the tab was closed
 * mid-session). `answers` must belong to one session, in the order they happened.
 */
export function recoverHarmonySummary(
  answers: readonly ChordSymbolAnswer[],
): HarmonySessionSummary | null {
  const first = answers[0];
  const last = answers.at(-1);
  if (!first || !last) return null;
  return summarizeHarmony({
    id: first.sessionId,
    family: first.family,
    level: first.level,
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
export function harmonyStats(answers: readonly ChordSymbolAnswer[]): Record<string, NoteStats> {
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

export interface HarmonyLevelProgress {
  level: HarmonyLevelId;
  /** Every card ever answered at this level, hinted or not. */
  total: number;
  /** Un-hinted cards in the window (at most `HARMONY_MASTERY_WINDOW`). */
  cards: number;
  accuracy: number | null;
  /** Over the timed answers of the window. */
  medianMs: number | null;
  mastered: boolean;
}

/**
 * Mastery as Read's: over the level's last 40 un-hinted cards, ≥ 90 % right with the median of
 * the timely right answers under 3 s. `answers` must be in the order they happened.
 */
export function harmonyLevelProgress(
  answers: readonly ChordSymbolAnswer[],
  level: HarmonyLevelId,
): HarmonyLevelProgress {
  const ofLevel = answers.filter((a) => a.level === level);
  const window = ofLevel.filter((a) => !a.hinted).slice(-HARMONY_MASTERY_WINDOW);
  const correct = window.filter((a) => a.correct).length;
  const accuracy = window.length > 0 ? correct / window.length : null;
  const medianMs = median(window.filter(isTimedHarmony).map((a) => a.ms));
  return {
    level,
    total: ofLevel.length,
    cards: window.length,
    accuracy,
    medianMs,
    mastered:
      window.length >= HARMONY_MASTERY_WINDOW &&
      accuracy !== null &&
      accuracy >= HARMONY_MASTERY_ACCURACY &&
      medianMs !== null &&
      medianMs < HARMONY_MASTERY_MEDIAN_MS,
  };
}

/** The first level not mastered yet, or the last once all are. */
export function suggestedHarmonyLevel(
  progress: ReadonlyMap<HarmonyLevelId, HarmonyLevelProgress>,
  levels: readonly HarmonyLevelId[],
): HarmonyLevelId {
  return levels.find((id) => !progress.get(id)?.mastered) ?? levels.at(-1)!;
}
