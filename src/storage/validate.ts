import {
  answerNameOf,
  answerNames,
  getEarLevel,
  isEarLevelId,
  itemInLevel,
  judgeChordKeys,
  judgeIntervalKey,
  parseItem,
  promptMatches,
  type EarLevelId,
} from '../core/earItems.ts';
import type { Answer } from '../core/answers.ts';
import {
  getHarmonyLevel,
  harmonyItemInLevel,
  isHarmonyFamily,
  isHarmonyLevelId,
  itemSymbol,
  judgeSymbolKeys,
  parseSymbolItem,
} from '../core/chordSymbols.ts';
import { isMelodyKeyOf, judgeEchoAnswer } from '../core/earMelody.ts';
import type { EarAnswer, MissedItem } from '../core/earSession.ts';
import type { PlayedNote, RunHeadline } from '../core/evenness.ts';
import type { OpenFreePlay } from '../core/freePlay.ts';
import type { ChordSymbolAnswer, HarmonyMissed } from '../core/harmonySession.ts';
import { isStaffHands } from '../core/hands.ts';
import { isLevelId, parseNoteKey } from '../core/levels.ts';
import type {
  EarSessionRecord,
  FreePlaySessionRecord,
  HarmonySessionRecord,
  PieceSessionRecord,
  ReadSessionRecord,
  RhythmSessionRecord,
  ScaleSessionRecord,
  SessionRecord,
  TheorySessionRecord,
} from '../core/log.ts';
import { isMidiNote, type Clef } from '../core/note.ts';
import type { SpelledPitch } from '../core/score.ts';
import {
  getTheoryLevel,
  isChordAnswer,
  isIntervalAnswer,
  isTheoryFamily,
  isTheoryLevelId,
  isTonicKey,
  judgeWrittenChord,
  parseSignature,
  parseSpelled,
  parseTheoryItem,
  promptFits,
  rootOf,
  chordAnswerName,
  intervalAnswerName,
  theoryItemInLevel,
  type TheoryLevelId,
} from '../core/theoryItems.ts';
import type { TheoryAnswer, TheoryMissed } from '../core/theorySession.ts';
import {
  isHandSelection,
  type LoopRange,
  type PieceFacts,
  type PieceRunHeader,
  type PieceStep,
  type RhythmCounts,
} from '../core/pieceRecords.ts';
import { MAX_WINDOW_MS, type NoteTiming } from '../core/rhythm.ts';
import {
  cellOnsets,
  getRhythmLevel,
  isRhythmBpm,
  isRhythmLevelId,
  parseRhythmItem,
  rhythmItemInLevel,
  type RhythmLevelId,
} from '../core/rhythmCells.ts';
import { isRhythmFamily, judgeCell, type RhythmAnswer } from '../core/rhythmRead.ts';
import {
  isClickTempo,
  isGridPerBeat,
  type GridPerBeat,
  type ScaleClick,
} from '../core/scaleClick.ts';
import type { PedalChange, ScaleRunSummary, StoredScaleRun } from '../core/scaleRecords.ts';
import { parseExerciseKey } from '../core/scales.ts';
import type { Attempt } from '../core/session.ts';
import { isScoreWarning, type StoredPiece } from '../core/storedPiece.ts';
import { isTakeEvent, TAKE_CHUNK_EVENTS, takeChunkId, type TakeChunk } from '../core/takes.ts';

// Hand-written validators for records read from outside the app (an import file, or storage
// written by another version). They return a clean copy with only the known fields, or the name
// of the first field that is missing or wrong.

export type Validation<T> = { ok: true; value: T } | { ok: false; field: string };

type Fields = Record<string, unknown>;

const isObject = (v: unknown): v is Fields =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
/** Epoch ms or a duration: finite and not negative. */
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isMidi = (v: unknown): v is number => typeof v === 'number' && isMidiNote(v);
const isNoteKey = (v: unknown): v is string => typeof v === 'string' && parseNoteKey(v) !== null;
const isRatio = (v: unknown): v is number | null =>
  v === null || (typeof v === 'number' && v >= 0 && v <= 1);
const isTimeOrNull = (v: unknown): v is number | null => v === null || isTime(v);
const isText = (max: number) => (v: unknown) => typeof v === 'string' && v.length <= max;

function firstInvalid(record: Fields, checks: Record<string, (v: unknown) => boolean>) {
  for (const [field, check] of Object.entries(checks)) if (!check(record[field])) return field;
  return null;
}

const fail = (field: string) => ({ ok: false, field }) as const;

export function validateAttempt(value: unknown): Validation<Attempt> {
  if (!isObject(value)) return fail('record');
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    level: isLevelId,
    note: isNoteKey,
    target: isMidi,
    played: isMidi,
    correct: isBool,
    ms: isTime,
    hinted: isBool,
    timedOut: isBool,
    at: isTime,
  });
  if (field) return fail(field);
  const a = value as unknown as Attempt;
  if (parseNoteKey(a.note)!.midi !== a.target) return fail('target');
  if (a.correct !== (a.played === a.target)) return fail('correct');
  return {
    ok: true,
    value: {
      id: a.id,
      sessionId: a.sessionId,
      level: a.level,
      note: a.note,
      target: a.target,
      played: a.played,
      correct: a.correct,
      ms: a.ms,
      hinted: a.hinted,
      timedOut: a.timedOut,
      at: a.at,
    },
  };
}

function isSlowest(v: unknown): boolean {
  return (
    Array.isArray(v) && v.every((item) => isObject(item) && isNoteKey(item.note) && isTime(item.ms))
  );
}

const isNoteKeys = (v: unknown) => Array.isArray(v) && v.every(isNoteKey);

function validateReadSession(value: Fields): Validation<ReadSessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    level: isLevelId,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    length: (v) => isCount(v) && v > 0,
    cards: isCount,
    correct: isCount,
    accuracy: isRatio,
    medianMs: isTimeOrNull,
    slowest: isSlowest,
    missed: isNoteKeys,
  });
  if (field) return fail(field);
  const s = value as unknown as ReadSessionRecord;
  if (s.endedAt < s.startedAt) return fail('endedAt');
  if (s.correct > s.cards) return fail('correct');
  if ((s.accuracy === null) !== (s.cards === 0)) return fail('accuracy');
  return {
    ok: true,
    value: {
      kind: 'read',
      id: s.id,
      level: s.level,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      length: s.length,
      cards: s.cards,
      correct: s.correct,
      accuracy: s.accuracy,
      medianMs: s.medianMs,
      slowest: s.slowest.map(({ note, ms }) => ({ note, ms })),
      missed: [...s.missed],
    },
  };
}

function validateFreeSession(value: Fields): Validation<FreePlaySessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    notes: isCount,
  });
  if (field) return fail(field);
  const s = value as unknown as FreePlaySessionRecord;
  if (s.endedAt < s.startedAt) return fail('endedAt');
  return {
    ok: true,
    value: {
      kind: 'free',
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      notes: s.notes,
    },
  };
}

const isLabel = (v: unknown) => typeof v === 'string' && v.length <= 20;
const isIndex = (v: unknown): v is number => isCount(v) && v < 100_000;

function isLoopRange(v: unknown): v is LoopRange | null {
  if (v === null) return true;
  if (!isObject(v)) return false;
  return (
    isIndex(v.from) && isIndex(v.to) && v.from <= v.to && isLabel(v.fromLabel) && isLabel(v.toLabel)
  );
}

const isMode = (v: unknown) => v === undefined || v === 'rhythm';
/** A deviation is inside its window, which is never wider than this. */
const isDeviation = (v: unknown) =>
  v === null || (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1000);

function isNoteTimings(v: unknown): v is NoteTiming[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.length <= 88 &&
    v.every((n) => isObject(n) && isMidi(n.midi) && isDeviation(n.deviation))
  );
}

function isRhythmCounts(v: unknown): v is RhythmCounts {
  return (
    isObject(v) &&
    isCount(v.notes) &&
    isCount(v.hits) &&
    isCount(v.inTime) &&
    v.hits <= v.notes &&
    v.inTime <= v.hits
  );
}

const HEADER_CHECKS: Record<string, (v: unknown) => boolean> = {
  id: isId,
  pieceId: isId,
  title: isText(500),
  hands: isHandSelection,
  loop: isLoopRange,
  repeats: (v) => v === 'play' || v === 'skip',
  tempo: (v) => isCount(v) && v > 0 && v <= 1000,
  startedAt: isTime,
  mode: isMode,
};

function cleanHeader(h: PieceRunHeader): PieceRunHeader {
  const { loop } = h;
  return {
    id: h.id,
    pieceId: h.pieceId,
    title: h.title,
    hands: h.hands,
    loop: loop
      ? { from: loop.from, to: loop.to, fromLabel: loop.fromLabel, toLabel: loop.toLabel }
      : null,
    repeats: h.repeats,
    tempo: h.tempo,
    startedAt: h.startedAt,
    ...(h.mode === 'rhythm' && { mode: h.mode }),
  };
}

/** The header of a run still in progress, as saved with its first step. */
export function validatePieceRunHeader(value: unknown): Validation<PieceRunHeader> {
  if (!isObject(value)) return fail('record');
  const field = firstInvalid(value, HEADER_CHECKS);
  if (field) return fail(field);
  return { ok: true, value: cleanHeader(value as unknown as PieceRunHeader) };
}

function validatePieceSession(value: Fields): Validation<PieceSessionRecord> {
  const field = firstInvalid(value, {
    ...HEADER_CHECKS,
    endedAt: isTime,
    activeMs: isTime,
    steps: isCount,
    wrong: isCount,
    completed: isBool,
    // Counted in rhythm mode only.
    rhythm: (v) => (value.mode === 'rhythm' ? isRhythmCounts(v) : v === undefined),
  });
  if (field) return fail(field);
  const s = value as unknown as PieceSessionRecord;
  if (s.endedAt < s.startedAt) return fail('endedAt');
  return {
    ok: true,
    value: {
      kind: 'piece',
      ...cleanHeader(s),
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      steps: s.steps,
      wrong: s.wrong,
      completed: s.completed,
      ...(s.rhythm && {
        rhythm: { notes: s.rhythm.notes, hits: s.rhythm.hits, inTime: s.rhythm.inTime },
      }),
    },
  };
}

const isExerciseKey = (v: unknown): v is string =>
  typeof v === 'string' && parseExerciseKey(v) !== null;
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isFiniteOrNull = (v: unknown): v is number | null => v === null || isFiniteNumber(v);
/** Far above any real run (four octaves hands together are about 120 keys) or session. */
const MAX_RUN_EVENTS = 10_000;
const isList = (v: unknown, check: (item: unknown) => boolean, min = 0): v is unknown[] =>
  Array.isArray(v) && v.length >= min && v.length <= MAX_RUN_EVENTS && v.every(check);

type HandHeadline = RunHeadline['hands'][number];

function isHandHeadline(v: unknown): v is HandHeadline {
  return (
    isObject(v) &&
    firstInvalid(v, {
      hand: (h) => h === 'right' || h === 'left',
      spread: isFiniteOrNull,
      spreadShare: isFiniteOrNull,
      rough: isBool,
      hesitations: isCount,
      medianInterval: isFiniteOrNull,
    }) === null
  );
}

/** A run's headline figures as a session keeps them (evenness.ts); recomputed when outdated. */
function isRunHeadline(v: unknown): v is RunHeadline {
  if (!isObject(v)) return false;
  const { counts } = v;
  return (
    Number.isInteger(v.version) &&
    (v.version as number) > 0 &&
    (v.quality === 'ok' || v.quality === 'not-a-scale-run') &&
    isObject(counts) &&
    ['expected', 'matched', 'wrong', 'missed', 'extra'].every((n) => isCount(counts[n])) &&
    isBool(v.velocityMeasured) &&
    Array.isArray(v.hands) &&
    v.hands.length <= 2 &&
    v.hands.every(isHandHeadline)
  );
}

/** A clicked run's tempo and notes per beat (S4); absent at free tempo. */
const isClickSettings = (v: unknown): v is { bpm: number; perBeat: GridPerBeat } =>
  isObject(v) && isClickTempo(v.bpm) && isGridPerBeat(v.perBeat);

/** Latencies beyond this are no latency (rhythmPrefs.ts refuses them too). */
const MAX_LATENCY_MS = 500;

/** A clicked run's grid, on the run's clock (scaleClick.ts). */
const isScaleClick = (v: unknown): v is ScaleClick =>
  isClickSettings(v) &&
  isFiniteNumber((v as Fields).latency) &&
  Math.abs((v as Fields).latency as number) <= MAX_LATENCY_MS &&
  isFiniteNumber((v as Fields).zero) &&
  isFiniteOrNull((v as Fields).stoppedAt);

function isRunSummary(v: unknown): v is ScaleRunSummary {
  return (
    isObject(v) &&
    firstInvalid(v, {
      id: isId,
      exercise: isExerciseKey,
      startedAt: isTime,
      endedAt: isTime,
      headline: isRunHeadline,
      click: (c) => c === undefined || isClickSettings(c),
    }) === null &&
    (v.endedAt as number) >= (v.startedAt as number)
  );
}

function cleanHeadline(h: RunHeadline): RunHeadline {
  const { counts } = h;
  return {
    version: h.version,
    quality: h.quality,
    counts: {
      expected: counts.expected,
      matched: counts.matched,
      wrong: counts.wrong,
      missed: counts.missed,
      extra: counts.extra,
    },
    velocityMeasured: h.velocityMeasured,
    hands: h.hands.map((hand) => ({
      hand: hand.hand,
      spread: hand.spread,
      spreadShare: hand.spreadShare,
      rough: hand.rough,
      hesitations: hand.hesitations,
      medianInterval: hand.medianInterval,
    })),
  };
}

function validateScaleSession(value: Fields): Validation<ScaleSessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    // A session has at least one run.
    runs: (v) => isList(v, isRunSummary, 1),
  });
  if (field) return fail(field);
  const s = value as unknown as ScaleSessionRecord;
  if (s.endedAt < s.startedAt) return fail('endedAt');
  return {
    ok: true,
    value: {
      kind: 'scale',
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      runs: s.runs.map((r) => ({
        id: r.id,
        exercise: r.exercise,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        headline: cleanHeadline(r.headline),
        ...(r.click && { click: { bpm: r.click.bpm, perBeat: r.click.perBeat } }),
      })),
    },
  };
}

// --- Ear training ----------------------------------------------------------------------------

const isFamily = (v: unknown) => v === 'interval' || v === 'chord' || v === 'echo';
const isAnswerMode = (v: unknown) => v === 'play' || v === 'name';
const isItemKey = (v: unknown): v is string => typeof v === 'string' && parseItem(v) !== null;
/** A prompt or a played answer: a few keys (an interval's two, a chord's up to four). */
const isKeys = (v: unknown, max: number): v is number[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max && v.every(isMidi);
/** The most keys of a prompt: a melody's eight. Each item's own count is `promptMatches`'. */
const MAX_PROMPT_KEYS = 8;

/** A melody's key, which every Echo answer and miss keeps (one of its level's); none otherwise. */
function isKeyOfItem(itemKey: unknown, key: unknown): boolean {
  const item = typeof itemKey === 'string' ? parseItem(itemKey) : null;
  if (item?.family !== 'echo') return key === undefined;
  return isMelodyKeyOf(item.level, key);
}
const isAnswerValue = (v: unknown) => isKeys(v, 88) || (typeof v === 'string' && v.length <= 20);

/**
 * Whether a played or named `answer` to `prompt` of `item` at `level` is judged `correct`, by the
 * rules the session judged it with; null when it is not an answer the session could record.
 */
function judgedAnswer(
  level: EarLevelId,
  itemKey: string,
  by: 'play' | 'name',
  prompt: readonly number[],
  answer: number[] | string,
): boolean | null {
  const item = parseItem(itemKey)!;
  const earLevel = getEarLevel(level);
  // A melody is played back, key by key, up to and including the first wrong key.
  if (item.family === 'echo') {
    return by === 'play' && typeof answer !== 'string' ? judgeEchoAnswer(prompt, answer) : null;
  }
  if (by === 'name') {
    if (typeof answer !== 'string' || !answerNames(earLevel).includes(answer)) return null;
    return answer === answerNameOf(item);
  }
  if (typeof answer === 'string') return null;
  const card = { item: itemKey, notes: prompt };
  if (item.family === 'interval') {
    if (answer.length !== 1) return null;
    const result = judgeIntervalKey(card, answer[0]!);
    return result === 'ignored' ? null : result === 'right';
  }
  // Held keys, low to high, each once.
  if (answer.some((midi, i) => i > 0 && midi <= answer[i - 1]!)) return null;
  const bassMatters = earLevel.family === 'chord' && earLevel.bassMatters;
  const result = judgeChordKeys(card, answer, bassMatters);
  return result === 'pending' ? null : result === 'right';
}

/** An ear-training, a theory, a rhythm or a chord-symbol answer, told apart by its family. */
export function validateAnswer(value: unknown): Validation<Answer> {
  if (!isObject(value)) return fail('record');
  if (isRhythmFamily(value.family)) return validateRhythmAnswer(value);
  if (isTheoryFamily(value.family)) return validateTheoryAnswer(value);
  if (isHarmonyFamily(value.family)) return validateChordSymbolAnswer(value);
  return validateEarAnswer(value);
}

function validateEarAnswer(value: Fields): Validation<EarAnswer> {
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    family: isFamily,
    level: isEarLevelId,
    item: isItemKey,
    by: isAnswerMode,
    prompt: (v) => isKeys(v, MAX_PROMPT_KEYS),
    answer: isAnswerValue,
    correct: isBool,
    ms: isTime,
    replays: isCount,
    at: isTime,
    key: (v) => isKeyOfItem(value.item, v),
  });
  if (field) return fail(field);
  const a = value as unknown as EarAnswer;
  const item = parseItem(a.item)!;
  const level = getEarLevel(a.level);
  if (level.family !== a.family) return fail('level');
  if (!itemInLevel(item, level)) return fail('item');
  if (!promptMatches(item, a.prompt)) return fail('prompt');
  const judged = judgedAnswer(a.level, a.item, a.by, a.prompt, a.answer);
  if (judged === null) return fail('answer');
  if (judged !== a.correct) return fail('correct');
  return {
    ok: true,
    value: {
      id: a.id,
      sessionId: a.sessionId,
      family: a.family,
      level: a.level,
      item: a.item,
      by: a.by,
      prompt: [...a.prompt],
      answer: Array.isArray(a.answer) ? [...a.answer] : a.answer,
      correct: a.correct,
      ms: a.ms,
      replays: a.replays,
      at: a.at,
      ...(a.key && { key: { tonic: a.key.tonic, scale: a.key.scale } }),
    },
  };
}

function isMissed(v: unknown): v is MissedItem[] {
  return (
    Array.isArray(v) &&
    v.length <= 10_000 &&
    v.every(
      (m) =>
        isObject(m) &&
        isItemKey(m.item) &&
        isAnswerValue(m.answer) &&
        isKeys(m.prompt, MAX_PROMPT_KEYS) &&
        isKeyOfItem(m.item, m.key),
    )
  );
}

function validateEarSession(value: Fields): Validation<EarSessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    family: isFamily,
    level: isEarLevelId,
    by: isAnswerMode,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    length: (v) => isCount(v) && v > 0,
    items: isCount,
    correct: isCount,
    accuracy: isRatio,
    medianMs: isTimeOrNull,
    replays: isCount,
    missed: isMissed,
  });
  if (field) return fail(field);
  const s = value as unknown as EarSessionRecord;
  if (getEarLevel(s.level).family !== s.family) return fail('level');
  if (s.endedAt < s.startedAt) return fail('endedAt');
  if (s.correct > s.items) return fail('correct');
  if ((s.accuracy === null) !== (s.items === 0)) return fail('accuracy');
  return {
    ok: true,
    value: {
      kind: 'ear',
      id: s.id,
      family: s.family,
      level: s.level,
      by: s.by,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      length: s.length,
      items: s.items,
      correct: s.correct,
      accuracy: s.accuracy,
      medianMs: s.medianMs,
      replays: s.replays,
      missed: s.missed.map((m) => ({
        item: m.item,
        answer: Array.isArray(m.answer) ? [...m.answer] : m.answer,
        prompt: [...m.prompt],
        ...(m.key && { key: { tonic: m.key.tonic, scale: m.key.scale } }),
      })),
    },
  };
}

// --- Theory cards on Read --------------------------------------------------------------------

const isClef = (v: unknown): v is Clef => v === 'treble' || v === 'bass';
const isTheoryItemKey = (v: unknown): v is string => parseTheoryItem(v) !== null;

/** Written notes as stored (`C4`, `D#4`, `Ebb5`): two to four of them; null otherwise. */
function writtenNotes(v: unknown): SpelledPitch[] | null {
  if (!Array.isArray(v) || v.length < 2 || v.length > 4) return null;
  const notes = v.map(parseSpelled);
  return notes.every((n) => n !== null) ? notes : null;
}

/** A theory card's prompt: its written notes, or a key signature (`3f`). */
const isTheoryPrompt = (v: unknown) =>
  typeof v === 'string' ? parseSignature(v) !== null : writtenNotes(v) !== null;

/** An interval or a chord is written on a staff; a key signature on the grand staff. */
const isClefOfFamily = (family: unknown, v: unknown) =>
  family === 'keySignature' ? v === undefined : isClef(v);

/** Whether a stored prompt is a card of `item` at `level`, by the rules cards are drawn by. */
function theoryPromptFits(
  level: TheoryLevelId,
  item: string,
  prompt: string[] | string,
  clef: Clef | undefined,
): boolean {
  const parsed = parseTheoryItem(item);
  if (parsed?.family === 'keySignature') return parseSignature(prompt) === parsed.fifths;
  const notes = writtenNotes(prompt);
  return (
    notes !== null && clef !== undefined && promptFits(getTheoryLevel(level), item, notes, clef)
  );
}

/**
 * Whether a theory answer is judged `correct`, by the rules the session judged it with; null when
 * it is not an answer the session could record. The prompt must fit the item already.
 */
function judgedTheoryAnswer(a: TheoryAnswer): boolean | null {
  const level = getTheoryLevel(a.level);
  const item = parseTheoryItem(a.item)!;
  const { answer } = a;
  if (item.family === 'readInterval' && level.family === 'readInterval') {
    if (a.by !== 'name' || !isIntervalAnswer(level, answer)) return null;
    return answer === intervalAnswerName(level, a.item);
  }
  if (item.family === 'keySignature') {
    if (a.by !== 'play' || !Array.isArray(answer) || answer.length !== 1) return null;
    return isTonicKey(item.fifths, item.mode, answer[0]!);
  }
  if (item.family === 'readChord' && level.family === 'readChord') {
    const notes = writtenNotes(a.prompt)!;
    if (a.by === 'name') {
      if (!isChordAnswer(level, answer)) return null;
      return answer === chordAnswerName(rootOf(a.item, notes)!, item.quality, item.inversion);
    }
    // Held keys, low to high, each once: exactly the written ones, or one of them wrong.
    if (typeof answer === 'string') return null;
    if (answer.some((midi, i) => i > 0 && midi <= answer[i - 1]!)) return null;
    const result = judgeWrittenChord(notes, answer);
    return result === 'pending' ? null : result === 'right';
  }
  return null;
}

function validateTheoryAnswer(value: Fields): Validation<TheoryAnswer> {
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    family: isTheoryFamily,
    level: isTheoryLevelId,
    item: isTheoryItemKey,
    by: isAnswerMode,
    prompt: isTheoryPrompt,
    clef: (v) => isClefOfFamily(value.family, v),
    answer: isAnswerValue,
    correct: isBool,
    ms: isTime,
    hinted: isBool,
    at: isTime,
  });
  if (field) return fail(field);
  const a = value as unknown as TheoryAnswer;
  const level = getTheoryLevel(a.level);
  if (level.family !== a.family) return fail('level');
  if (!theoryItemInLevel(a.item, level)) return fail('item');
  if (!theoryPromptFits(a.level, a.item, a.prompt, a.clef)) return fail('prompt');
  const judged = judgedTheoryAnswer(a);
  if (judged === null) return fail('answer');
  if (judged !== a.correct) return fail('correct');
  return {
    ok: true,
    value: {
      id: a.id,
      sessionId: a.sessionId,
      family: a.family,
      level: a.level,
      item: a.item,
      by: a.by,
      prompt: Array.isArray(a.prompt) ? [...a.prompt] : a.prompt,
      ...(a.clef && { clef: a.clef }),
      answer: Array.isArray(a.answer) ? [...a.answer] : a.answer,
      correct: a.correct,
      ms: a.ms,
      hinted: a.hinted,
      at: a.at,
    },
  };
}

function isTheoryMissed(v: unknown): v is TheoryMissed[] {
  return (
    Array.isArray(v) &&
    v.length <= 10_000 &&
    v.every((m) => {
      if (!isObject(m) || !isTheoryItemKey(m.item)) return false;
      const family = parseTheoryItem(m.item)!.family;
      return (
        isTheoryPrompt(m.prompt) &&
        (typeof m.prompt === 'string') === (family === 'keySignature') &&
        isClefOfFamily(family, m.clef) &&
        isAnswerValue(m.answer)
      );
    })
  );
}

const isSlowItems = (v: unknown) =>
  Array.isArray(v) && v.every((s) => isObject(s) && isTheoryItemKey(s.item) && isTime(s.ms));

function validateTheorySession(value: Fields): Validation<TheorySessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    family: isTheoryFamily,
    level: isTheoryLevelId,
    by: isAnswerMode,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    length: (v) => isCount(v) && v > 0,
    cards: isCount,
    correct: isCount,
    accuracy: isRatio,
    medianMs: isTimeOrNull,
    slowest: isSlowItems,
    missed: isTheoryMissed,
  });
  if (field) return fail(field);
  const s = value as unknown as TheorySessionRecord;
  if (getTheoryLevel(s.level).family !== s.family) return fail('level');
  if (s.endedAt < s.startedAt) return fail('endedAt');
  if (s.correct > s.cards) return fail('correct');
  if ((s.accuracy === null) !== (s.cards === 0)) return fail('accuracy');
  return {
    ok: true,
    value: {
      kind: 'theory',
      id: s.id,
      family: s.family,
      level: s.level,
      by: s.by,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      length: s.length,
      cards: s.cards,
      correct: s.correct,
      accuracy: s.accuracy,
      medianMs: s.medianMs,
      slowest: s.slowest.map(({ item, ms }) => ({ item, ms })),
      missed: s.missed.map((m) => ({
        item: m.item,
        prompt: Array.isArray(m.prompt) ? [...m.prompt] : m.prompt,
        ...(m.clef && { clef: m.clef }),
        answer: Array.isArray(m.answer) ? [...m.answer] : m.answer,
      })),
    },
  };
}

// --- Chord symbols on Harmony ----------------------------------------------------------------

const isSymbolItem = (v: unknown): v is string => parseSymbolItem(v) !== null;
/** Keys held, low to high, each once. */
const isHeldKeys = (v: unknown): v is number[] =>
  isKeys(v, 88) && v.every((midi, i) => i === 0 || midi > v[i - 1]!);

function validateChordSymbolAnswer(value: Fields): Validation<ChordSymbolAnswer> {
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    family: isHarmonyFamily,
    level: isHarmonyLevelId,
    item: isSymbolItem,
    by: (v) => v === 'play',
    prompt: (v) => typeof v === 'string' && v === itemSymbol(String(value.item)),
    answer: isHeldKeys,
    correct: isBool,
    ms: isTime,
    hinted: isBool,
    at: isTime,
  });
  if (field) return fail(field);
  const a = value as unknown as ChordSymbolAnswer;
  if (!harmonyItemInLevel(a.item, getHarmonyLevel(a.level))) return fail('item');
  // Judged again as the session judged it: an answer is recorded once it is right or wrong.
  const judged = judgeSymbolKeys(parseSymbolItem(a.item)!, a.answer);
  if (judged === 'pending') return fail('answer');
  if ((judged === 'right') !== a.correct) return fail('correct');
  return {
    ok: true,
    value: {
      id: a.id,
      sessionId: a.sessionId,
      family: a.family,
      level: a.level,
      item: a.item,
      by: a.by,
      prompt: a.prompt,
      answer: [...a.answer],
      correct: a.correct,
      ms: a.ms,
      hinted: a.hinted,
      at: a.at,
    },
  };
}

function isHarmonyMissed(v: unknown): v is HarmonyMissed[] {
  return (
    Array.isArray(v) &&
    v.length <= 10_000 &&
    v.every((m) => isObject(m) && isSymbolItem(m.item) && isHeldKeys(m.answer))
  );
}

const isHarmonySlowItems = (v: unknown) =>
  Array.isArray(v) && v.every((s) => isObject(s) && isSymbolItem(s.item) && isTime(s.ms));

function validateHarmonySession(value: Fields): Validation<HarmonySessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    family: isHarmonyFamily,
    level: isHarmonyLevelId,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    length: (v) => isCount(v) && v > 0,
    cards: isCount,
    correct: isCount,
    accuracy: isRatio,
    medianMs: isTimeOrNull,
    slowest: isHarmonySlowItems,
    missed: isHarmonyMissed,
  });
  if (field) return fail(field);
  const s = value as unknown as HarmonySessionRecord;
  if (s.endedAt < s.startedAt) return fail('endedAt');
  if (s.correct > s.cards) return fail('correct');
  if ((s.accuracy === null) !== (s.cards === 0)) return fail('accuracy');
  return {
    ok: true,
    value: {
      kind: 'harmony',
      id: s.id,
      family: s.family,
      level: s.level,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      length: s.length,
      cards: s.cards,
      correct: s.correct,
      accuracy: s.accuracy,
      medianMs: s.medianMs,
      slowest: s.slowest.map(({ item, ms }) => ({ item, ms })),
      missed: s.missed.map((m) => ({ item: m.item, answer: [...m.answer] })),
    },
  };
}

export function validateSession(value: unknown): Validation<SessionRecord> {
  if (!isObject(value)) return fail('record');
  if (value.kind === 'read') return validateReadSession(value);
  if (value.kind === 'free') return validateFreeSession(value);
  if (value.kind === 'piece') return validatePieceSession(value);
  if (value.kind === 'scale') return validateScaleSession(value);
  if (value.kind === 'ear') return validateEarSession(value);
  if (value.kind === 'theory') return validateTheorySession(value);
  if (value.kind === 'rhythm') return validateRhythmSession(value);
  if (value.kind === 'harmony') return validateHarmonySession(value);
  return fail('kind');
}

// --- Rhythm on Read --------------------------------------------------------------------------

/** Onsets in beats per line, as a cell's prompt: one or two lines of at most 16. */
const isOnsetLines = (v: unknown): v is number[][] =>
  Array.isArray(v) &&
  v.length >= 1 &&
  v.length <= 2 &&
  v.every((line) => isList(line, (b) => isFiniteNumber(b) && b >= 0 && b < 4) && line.length <= 16);

/** Whole ms, early or late, within the widest window; null for a note missed. */
const isCellDeviation = (v: unknown) =>
  v === null || (Number.isInteger(v) && Math.abs(v as number) <= MAX_WINDOW_MS);

function isRhythmAnswerValue(v: unknown): v is RhythmAnswer['answer'] {
  if (!isObject(v) || !isCount(v.extras) || v.extras > 1000) return false;
  const { deviations } = v;
  return (
    Array.isArray(deviations) &&
    deviations.length <= 2 &&
    deviations.every((line) => isList(line, isCellDeviation) && line.length <= 16)
  );
}

/** Whether an item is a cell of `level`'s, in one of its meters. */
function isItemOfLevel(level: RhythmLevelId, item: string): boolean {
  const parsed = parseRhythmItem(item);
  return parsed !== null && rhythmItemInLevel(getRhythmLevel(level), parsed.cell, parsed.meter);
}

const sameShape = (a: readonly (readonly unknown[])[], b: readonly (readonly unknown[])[]) =>
  a.length === b.length && a.every((line, i) => line.length === b[i]!.length);

function validateRhythmAnswer(value: Fields): Validation<RhythmAnswer> {
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    family: isRhythmFamily,
    level: isRhythmLevelId,
    item: (v) => parseRhythmItem(v) !== null,
    prompt: isOnsetLines,
    answer: isRhythmAnswerValue,
    correct: isBool,
    bpm: isRhythmBpm,
    exercise: isIndex,
    run: isIndex,
    at: isTime,
  });
  if (field) return fail(field);
  const a = value as unknown as RhythmAnswer;
  if (!isItemOfLevel(a.level, a.item)) return fail('item');
  const { cell, meter } = parseRhythmItem(a.item)!;
  // The prompt is the cell's onsets, exactly as a session writes them.
  const onsets = cellOnsets(cell, meter);
  if (
    !sameShape(onsets, a.prompt) ||
    onsets.some((line, i) => line.some((b, k) => a.prompt[i]![k] !== b))
  )
    return fail('prompt');
  if (!sameShape(onsets, a.answer.deviations)) return fail('answer');
  if (judgeCell(a.answer.deviations, a.answer.extras) !== a.correct) return fail('correct');
  return {
    ok: true,
    value: {
      id: a.id,
      sessionId: a.sessionId,
      family: 'rhythm',
      level: a.level,
      item: a.item,
      prompt: a.prompt.map((line) => [...line]),
      answer: {
        deviations: a.answer.deviations.map((line) => [...line]),
        extras: a.answer.extras,
      },
      correct: a.correct,
      bpm: a.bpm,
      exercise: a.exercise,
      run: a.run,
      at: a.at,
    },
  };
}

function validateRhythmSession(value: Fields): Validation<RhythmSessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    level: isRhythmLevelId,
    bpm: isRhythmBpm,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    length: (v) => isCount(v) && v > 0,
    exercises: isCount,
    runs: isCount,
    cells: isCount,
    correct: isCount,
    accuracy: isRatio,
    medianDeviation: (v) => v === null || (isTime(v) && v <= MAX_WINDOW_MS),
    tendency: (v) => v === null || (isFiniteNumber(v) && Math.abs(v) <= MAX_WINDOW_MS),
    missed: (v) =>
      isList(
        v,
        (m) => isObject(m) && typeof m.item === 'string' && isCount(m.count) && m.count > 0,
      ) && v.length <= 10_000,
  });
  if (field) return fail(field);
  const s = value as unknown as RhythmSessionRecord;
  if (s.endedAt < s.startedAt) return fail('endedAt');
  if (s.exercises > s.runs) return fail('exercises');
  if (s.correct > s.cells) return fail('correct');
  if ((s.accuracy === null) !== (s.cells === 0)) return fail('accuracy');
  if (s.missed.some((m) => !isItemOfLevel(s.level, m.item))) return fail('missed');
  return {
    ok: true,
    value: {
      kind: 'rhythm',
      id: s.id,
      level: s.level,
      bpm: s.bpm,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      length: s.length,
      exercises: s.exercises,
      runs: s.runs,
      cells: s.cells,
      correct: s.correct,
      accuracy: s.accuracy,
      medianDeviation: s.medianDeviation,
      tendency: s.tendency,
      missed: s.missed.map(({ item, count }) => ({ item, count })),
    },
  };
}

function isPlayedNote(v: unknown): v is PlayedNote {
  return (
    isObject(v) &&
    isMidi(v.midi) &&
    isTime(v.on) &&
    (v.off === null || (isFiniteNumber(v.off) && v.off >= v.on)) &&
    isFiniteNumber(v.velocity) &&
    v.velocity >= 0 &&
    v.velocity <= 127
  );
}

// On the run's clock: an event stamped just before the first key would be slightly negative.
const isPedalChange = (v: unknown): v is PedalChange =>
  isObject(v) && isBool(v.down) && isFiniteNumber(v.time);

const isInputs = (v: unknown) => Array.isArray(v) && v.length <= 50 && v.every(isText(200));

/** A scale run as played, with where it belongs. */
export function validateScaleRun(value: unknown): Validation<StoredScaleRun> {
  if (!isObject(value)) return fail('record');
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    exercise: isExerciseKey,
    startedAt: isTime,
    end: (v) => v === 'finished' || v === 'idle' || v === 'stopped',
    // A run starts at its first key.
    keys: (v) => isList(v, isPlayedNote, 1),
    pedal: (v) => isList(v, isPedalChange),
    pedalAtStart: isBool,
    velocityMeasured: isBool,
    inputs: isInputs,
    click: (c) => c === undefined || isScaleClick(c),
  });
  if (field) return fail(field);
  const r = value as unknown as StoredScaleRun;
  const { click } = r;
  return {
    ok: true,
    value: {
      id: r.id,
      sessionId: r.sessionId,
      exercise: r.exercise,
      startedAt: r.startedAt,
      end: r.end,
      keys: r.keys.map((k) => ({ midi: k.midi, on: k.on, off: k.off, velocity: k.velocity })),
      pedal: r.pedal.map((p) => ({ down: p.down, time: p.time })),
      pedalAtStart: r.pedalAtStart,
      velocityMeasured: r.velocityMeasured,
      inputs: [...r.inputs],
      ...(click && {
        click: {
          bpm: click.bpm,
          perBeat: click.perBeat,
          latency: click.latency,
          zero: click.zero,
          stoppedAt: click.stoppedAt,
        },
      }),
    },
  };
}

const isChecksum = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}$/.test(v);

export function validatePieceStep(value: unknown): Validation<PieceStep> {
  if (!isObject(value)) return fail('record');
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    pieceId: isId,
    checksum: isChecksum,
    hands: isHandSelection,
    measure: isIndex,
    pass: (v) => isCount(v) && v >= 1 && v <= 100,
    ms: isTime,
    wrong: isCount,
    at: isTime,
    mode: isMode,
    // Rhythm mode's timings, and nothing in wait mode.
    notes: (v) => (value.mode === 'rhythm' ? isNoteTimings(v) : v === undefined),
  });
  if (field) return fail(field);
  const r = value as unknown as PieceStep;
  return {
    ok: true,
    value: {
      id: r.id,
      sessionId: r.sessionId,
      pieceId: r.pieceId,
      checksum: r.checksum,
      hands: r.hands,
      measure: r.measure,
      pass: r.pass,
      ms: r.ms,
      wrong: r.wrong,
      at: r.at,
      ...(r.mode === 'rhythm' && {
        mode: r.mode,
        notes: r.notes!.map((n) => ({ midi: n.midi, deviation: n.deviation })),
      }),
    },
  };
}

/** A chunk of a take (docs/EXPRESSION.md, "Takes"): 1 to `TAKE_CHUNK_EVENTS` well-formed events. */
export function validateTake(value: unknown): Validation<TakeChunk> {
  if (!isObject(value)) return fail('record');
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    pieceId: isId,
    checksum: isChecksum,
    hands: isHandSelection,
    repeats: HEADER_CHECKS.repeats!,
    tempo: HEADER_CHECKS.tempo!,
    mode: isMode,
    latency: (v) => v === undefined || (Number.isInteger(v) && Math.abs(v as number) <= 10_000),
    startedAt: isTime,
    chunk: (v) => isCount(v) && v < 10_000,
    events: (v) =>
      Array.isArray(v) && v.length > 0 && v.length <= TAKE_CHUNK_EVENTS && v.every(isTakeEvent),
  });
  if (field) return fail(field);
  const r = value as unknown as TakeChunk;
  if (r.id !== takeChunkId(r.sessionId, r.chunk)) return fail('id');
  return {
    ok: true,
    value: {
      id: r.id,
      sessionId: r.sessionId,
      pieceId: r.pieceId,
      checksum: r.checksum,
      hands: r.hands,
      repeats: r.repeats,
      tempo: r.tempo,
      ...(r.mode === 'rhythm' && { mode: r.mode }),
      ...(r.latency !== undefined && { latency: r.latency }),
      startedAt: r.startedAt,
      chunk: r.chunk,
      events: r.events.map((e) => [...e]),
    },
  };
}

function isFacts(v: unknown): v is PieceFacts {
  return (
    isObject(v) &&
    isChecksum(v.checksum) &&
    isObject(v.bars) &&
    isIndex(v.bars.right) &&
    isIndex(v.bars.left) &&
    isIndex(v.bars.both)
  );
}

export function isOpenFreePlay(value: unknown): value is OpenFreePlay {
  return (
    isObject(value) &&
    firstInvalid(value, {
      id: isId,
      startedAt: isTime,
      lastActivityAt: isTime,
      notes: isCount,
    }) === null
  );
}

/** Longest MusicXML text accepted from a file: far above any real piano score. */
export const MAX_PIECE_XML = 20_000_000;

export function validatePiece(value: unknown): Validation<StoredPiece> {
  if (!isObject(value)) return fail('record');
  const field = firstInvalid(value, {
    id: isId,
    title: isText(500),
    composer: isText(500),
    fileName: isText(500),
    xml: (v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_PIECE_XML,
    importedAt: isTime,
    updatedAt: (v) => v === undefined || isTime(v),
    hands: (v) => v === null || isStaffHands(v),
    warnings: (v) => Array.isArray(v) && v.every(isScoreWarning),
    facts: (v) => v === undefined || isFacts(v),
  });
  if (field) return fail(field);
  const p = value as unknown as StoredPiece;
  return {
    ok: true,
    value: {
      id: p.id,
      title: p.title,
      composer: p.composer,
      fileName: p.fileName,
      xml: p.xml,
      importedAt: p.importedAt,
      ...(p.updatedAt !== undefined && { updatedAt: p.updatedAt }),
      hands: p.hands === null ? null : { ...p.hands },
      warnings: [...new Set(p.warnings)],
      ...(p.facts && {
        facts: {
          checksum: p.facts.checksum,
          bars: { right: p.facts.bars.right, left: p.facts.bars.left, both: p.facts.bars.both },
        },
      }),
    },
  };
}
