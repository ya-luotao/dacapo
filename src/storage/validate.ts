import {
  answerNameOf,
  answerNames,
  EAR_FAMILIES,
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
import type { AssignmentRecord, SharedPiece } from '../core/assignmentRecords.ts';
import { isShareId, parseAssignment, parseReport } from '../core/assignmentShare.ts';
import {
  getHarmonyLevel,
  harmonyItemInLevel,
  isHarmonyFamily,
  isHarmonyLevelId,
  itemSymbol,
  judgeSymbolKeys,
  parseSymbolItem,
} from '../core/chordSymbols.ts';
import { isMelodyKeyOf, judgeEchoAnswer, type MelodyKey } from '../core/earMelody.ts';
import { cadenceKeyOf } from '../core/cadences.ts';
import { tuneFits, tuneSemitones } from '../core/tunes.ts';
import {
  masteryWindow,
  type EarAnswer,
  type EarSessionSummary,
  type MissedItem,
} from '../core/earSession.ts';
import { MAJOR_TONICS } from '../core/keys.ts';
import type { PlayedNote, RunHeadline } from '../core/evenness.ts';
import type { OpenFreePlay } from '../core/freePlay.ts';
import type { ChordSymbolAnswer, HarmonyMissed } from '../core/harmonySession.ts';
import { isStaffHands } from '../core/hands.ts';
import { BACKINGS, isBackingId, isFeel, isImprovTempo } from '../core/improv.ts';
import type { ImprovFigures } from '../core/improvFigures.ts';
import { isLevelId, parseNoteKey } from '../core/levels.ts';
import type {
  EarSessionRecord,
  FreePlaySessionRecord,
  HarmonySessionRecord,
  ImprovSessionRecord,
  PieceSessionRecord,
  ReadSessionRecord,
  RhythmSessionRecord,
  ScaleSessionRecord,
  SessionRecord,
  SightSessionRecord,
  TheorySessionRecord,
} from '../core/log.ts';
import { isSightLevelId, isSightSeed } from '../core/sightLevels.ts';
import {
  isSightBpm,
  READ_AHEADS,
  type SightFragmentRecord,
  type SightRunFigures,
} from '../core/sightRead.ts';
import { isMidiNote, type Clef } from '../core/note.ts';
import type { SpelledPitch } from '../core/score.ts';
import { isMemoryStage } from '../core/memory.ts';
import { isPatternId } from '../core/progressions.ts';
import { isTransposition } from '../core/transpose.ts';
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
  type MemoryCounts,
  type PieceFacts,
  type PieceRunHeader,
  type PieceStep,
  type RhythmCounts,
} from '../core/pieceRecords.ts';
import { MAX_WINDOW_MS, type NoteTiming } from '../core/rhythm.ts';
import {
  cellBeats,
  cellOnsets,
  isCellKey,
  getRhythmLevel,
  isRhythmBpm,
  isRhythmLevelId,
  parseRhythmItem,
  rhythmItemInLevel,
  type RhythmLevelId,
} from '../core/rhythmCells.ts';
import { isRhythmFamily, judgeCell, type RhythmAnswer } from '../core/rhythmRead.ts';
import {
  barSound,
  differingCell,
  isBarOf,
  isRhythmEarFamily,
  isRhythmEarItemOf,
  isRhythmEarLevelId,
  parseRhythmEarItem,
  sameSound,
  type RhythmEarAnswer,
  type RhythmEarChoiceAnswer,
  type RhythmEarSessionSummary,
  type RhythmEarTapAnswer,
} from '../core/rhythmEar.ts';
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

const isMode = (v: unknown) => v === undefined || v === 'rhythm' || v === 'memory';
/** A transposition is never written as 0: the written key is its absence. */
const isTranspose = (v: unknown) => v === undefined || isTransposition(v);
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
  leftHand: (v) => v === undefined || isPatternId(v),
  transpose: isTranspose,
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
    ...((h.mode === 'rhythm' || h.mode === 'memory') && { mode: h.mode }),
    ...(h.leftHand !== undefined && { leftHand: h.leftHand }),
    ...(h.transpose !== undefined && { transpose: h.transpose }),
  };
}

function isMemoryCounts(v: unknown): v is MemoryCounts {
  return isObject(v) && isMemoryStage(v.stage) && isCount(v.prompts);
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
    // Counted in rhythm mode only, and the prompts in memory mode only.
    rhythm: (v) => (value.mode === 'rhythm' ? isRhythmCounts(v) : v === undefined),
    memory: (v) => (value.mode === 'memory' ? isMemoryCounts(v) : v === undefined),
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
      ...(s.memory && { memory: { stage: s.memory.stage, prompts: s.memory.prompts } }),
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

const isFamily = (v: unknown) => (EAR_FAMILIES as readonly unknown[]).includes(v);
const isAnswerMode = (v: unknown) => v === 'play' || v === 'name';
const isItemKey = (v: unknown): v is string => typeof v === 'string' && parseItem(v) !== null;
/** A prompt or a played answer: a few keys (an interval's two, a chord's up to four). */
const isKeys = (v: unknown, max: number): v is number[] =>
  Array.isArray(v) && v.length > 0 && v.length <= max && v.every(isMidi);
const familyOfItem = (itemKey: unknown) =>
  typeof itemKey === 'string' ? parseItem(itemKey)?.family : undefined;
/** More keys than any tune has (Oh! Susanna, the longest, has 110). */
const MAX_TUNE_KEYS = 400;
/**
 * The most keys of an item's prompt: a cadence's four chords of four, a whole tune's, a melody's
 * eight otherwise. Each item's own count is `promptMatches`' (a tune's `tuneFits`').
 */
function maxPromptKeys(itemKey: unknown): number {
  const family = familyOfItem(itemKey);
  return family === 'cadence' ? 16 : family === 'tune' ? MAX_TUNE_KEYS : 8;
}

/** The key a tune is played in: one of the twelve major keys. */
const isTuneKey = (v: unknown): v is MelodyKey =>
  isObject(v) &&
  Object.keys(v).length === 2 &&
  v.scale === 'major' &&
  (MAJOR_TONICS as readonly unknown[]).includes(v.tonic);

/**
 * A melody's key, which every Echo answer and miss keeps (one of its level's), or a cadence's (one
 * of the twelve majors or minors; `promptMatches` checks it against the level), or the key a
 * tune's `prompt` is in; none otherwise.
 */
function isKeyOfItem(itemKey: unknown, key: unknown, prompt: unknown): boolean {
  const item = typeof itemKey === 'string' ? parseItem(itemKey) : null;
  if (item?.family === 'cadence') return cadenceKeyOf('CA4', key) !== null;
  if (item?.family === 'tune') {
    return isKeys(prompt, MAX_TUNE_KEYS) && tuneFits(itemKey as string, prompt, key);
  }
  if (item?.family !== 'echo') return key === undefined;
  return isMelodyKeyOf(item.level, key);
}
/** Keys played, or a name chosen: a tune's answer may be as long as the tune. */
const isAnswerValue = (v: unknown, itemKey?: unknown) =>
  isKeys(v, familyOfItem(itemKey) === 'tune' ? MAX_TUNE_KEYS : 88) ||
  (typeof v === 'string' && v.length <= 20);

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
  // A melody or a tune is played back, key by key, up to and including the first wrong key.
  if (item.family === 'echo' || item.family === 'tune') {
    return by === 'play' && typeof answer !== 'string' ? judgeEchoAnswer(prompt, answer) : null;
  }
  // A cadence is only ever named.
  if (item.family === 'cadence' && by !== 'name') return null;
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
  if (isRhythmEarFamily(value.family)) return validateRhythmEarAnswer(value);
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
    prompt: (v) => isKeys(v, maxPromptKeys(value.item)),
    answer: (v) => isAnswerValue(v, value.item),
    correct: isBool,
    ms: isTime,
    replays: isCount,
    at: isTime,
    // A tune's key is held to its keys below, once they are known to be the tune's.
    key: (v) =>
      familyOfItem(value.item) === 'tune' ? isTuneKey(v) : isKeyOfItem(value.item, v, value.prompt),
  });
  if (field) return fail(field);
  const a = value as unknown as EarAnswer;
  const item = parseItem(a.item)!;
  const level = getEarLevel(a.level);
  if (level.family !== a.family) return fail('level');
  if (!itemInLevel(item, level)) return fail('item');
  // A tune's keys are its melody's (tuneData.ts), moved by up to six semitones into the key the
  // answer names; the others are judged by the rules they were drawn with.
  if (item.family === 'tune') {
    if (tuneSemitones(a.item, a.prompt) === null) return fail('prompt');
    if (!tuneFits(a.item, a.prompt, a.key)) return fail('key');
  } else if (!promptMatches(item, a.prompt, a.key, a.level)) return fail('prompt');
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
        isAnswerValue(m.answer, m.item) &&
        isKeys(m.prompt, maxPromptKeys(m.item)) &&
        isKeyOfItem(m.item, m.key, m.prompt),
    )
  );
}

function validateEarSession(value: Fields): Validation<EarSessionRecord> {
  if (isRhythmEarFamily(value.family)) return validateRhythmEarSession(value);
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
  const s = value as unknown as EarSessionSummary;
  if (getEarLevel(s.level).family !== s.family) return fail('level');
  if (s.endedAt < s.startedAt) return fail('endedAt');
  if (s.correct > s.items) return fail('correct');
  if ((s.accuracy === null) !== (s.items === 0)) return fail('accuracy');
  // A tune's session is played back, in one key, and misses nothing of another tune or key.
  const tune = s.family === 'tune';
  if (tune ? !isTuneKey(s.key) : s.key !== undefined) return fail('key');
  if (tune) {
    if (s.by !== 'play') return fail('by');
    if (s.length !== masteryWindow(s.level) || s.items > s.length) return fail('length');
    const { tonic } = s.key!;
    const ofSession = (m: MissedItem) => {
      const item = parseItem(m.item);
      return item?.family === 'tune' && item.tune === s.level && m.key?.tonic === tonic;
    };
    if (!s.missed.every(ofSession)) return fail('missed');
  }
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
      ...(s.key && { key: { tonic: s.key.tonic, scale: s.key.scale } }),
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
  if (value.kind === 'sight') return validateSightSession(value);
  if (value.kind === 'improv') return validateImprovSession(value);
  return fail('kind');
}

// --- Sight-reading on Read -------------------------------------------------------------------

/** Keys a fragment asks for: eight bars of chords in both hands stay far below this. */
const MAX_SIGHT_NOTES = 1000;
/** Fragments a session may plan. */
const MAX_SIGHT_FRAGMENTS = 100;
/** Runs of one fragment ("Again" plays it again). */
const MAX_SIGHT_RUNS = 100;
/** A generator version: this build may not know it (a newer build's record), but it is one. */
const isVersion = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 10_000;
const isKeyCount = (v: unknown): v is number => isCount(v) && v <= MAX_SIGHT_NOTES;
/** Note-ons that matched nothing: a hand mashing the keys for eight bars. */
const isExtraCount = (v: unknown): v is number => isCount(v) && v <= 10_000;

function cleanSightRun(v: unknown): SightRunFigures | null {
  if (!isObject(v)) return null;
  const times = isTime(v.startedAt) && isTime(v.endedAt) && v.endedAt >= v.startedAt;
  if (!times) return null;
  if (v.mode === 'wait') {
    if (!isKeyCount(v.notes) || !isExtraCount(v.wrong)) return null;
    return {
      mode: 'wait',
      startedAt: v.startedAt as number,
      endedAt: v.endedAt as number,
      notes: v.notes,
      wrong: v.wrong,
    };
  }
  if (v.mode !== 'time') return null;
  const field = firstInvalid(v, {
    bpm: isSightBpm,
    readAhead: (x) => (READ_AHEADS as readonly unknown[]).includes(x),
    notes: isKeyCount,
    inTime: isKeyCount,
    early: isKeyCount,
    late: isKeyCount,
    wrong: isKeyCount,
    missed: isKeyCount,
    extras: isExtraCount,
    medianDeviation: (x) => x === null || (isTime(x) && x <= MAX_WINDOW_MS),
    tendency: (x) => x === null || (isFiniteNumber(x) && Math.abs(x) <= MAX_WINDOW_MS),
  });
  if (field) return null;
  const r = v as unknown as Extract<SightRunFigures, { mode: 'time' }>;
  const played = r.inTime + r.early + r.late;
  // Every key asked is in time, early, late, wrong or missed; the figures are of the keys played.
  if (played + r.wrong + r.missed !== r.notes) return null;
  if ((played === 0) !== (r.medianDeviation === null)) return null;
  if ((played === 0) !== (r.tendency === null)) return null;
  return {
    mode: 'time',
    bpm: r.bpm,
    readAhead: r.readAhead,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    notes: r.notes,
    inTime: r.inTime,
    early: r.early,
    late: r.late,
    wrong: r.wrong,
    missed: r.missed,
    extras: r.extras,
    medianDeviation: r.medianDeviation,
    tendency: r.tendency,
  };
}

function cleanSightFragment(v: unknown): SightFragmentRecord | null {
  if (!isObject(v) || !isSightSeed(v.seed) || !isVersion(v.version)) return null;
  if (!Array.isArray(v.runs) || v.runs.length === 0 || v.runs.length > MAX_SIGHT_RUNS) return null;
  const runs = v.runs.map(cleanSightRun);
  if (runs.some((r) => r === null)) return null;
  return { seed: v.seed, version: v.version, runs: runs as SightRunFigures[] };
}

function validateSightSession(value: Fields): Validation<SightSessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    level: isSightLevelId,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    // Any length, so a later build may offer others: fragments planned, 4 or 8 here.
    length: (v) => isCount(v) && v > 0 && v <= MAX_SIGHT_FRAGMENTS,
    fragments: (v) => Array.isArray(v) && v.length >= 1,
  });
  if (field) return fail(field);
  const s = value as unknown as SightSessionRecord;
  if (s.fragments.length > s.length) return fail('fragments');
  const fragments = s.fragments.map(cleanSightFragment);
  if (fragments.some((f) => f === null)) return fail('fragments');
  const runs = (fragments as SightFragmentRecord[]).flatMap((f) => f.runs);
  // Stored again after every run: it ends with its last one, and every run is within it.
  if (s.endedAt !== Math.max(...runs.map((r) => r.endedAt))) return fail('endedAt');
  if (runs.some((r) => r.startedAt < s.startedAt)) return fail('startedAt');
  if (s.activeMs > s.endedAt - s.startedAt) return fail('activeMs');
  return {
    ok: true,
    value: {
      kind: 'sight',
      id: s.id,
      level: s.level,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      length: s.length,
      fragments: fragments as SightFragmentRecord[],
    },
  };
}

// --- Improvise on Harmony --------------------------------------------------------------------

/** Whole ms of a loop: at most a day. */
const isLoopMs = (v: unknown): v is number => isCount(v) && v <= 86_400_000;

function cleanImprovFigures(v: unknown, s: ImprovSessionRecord): ImprovFigures | null {
  if (!isObject(v)) return null;
  const counts = [
    'notes',
    'chord',
    'scale',
    'outside',
    'strong',
    'strongChord',
    'melody',
    'repeated',
    'calls',
    'answered',
  ] as const;
  if (counts.some((k) => !isCount(v[k]))) return null;
  if (!isLoopMs(v.ms) || !isLoopMs(v.playerMs) || !isLoopMs(v.soundMs)) return null;
  const f = v as unknown as ImprovFigures;
  if (f.chord + f.scale + f.outside !== f.notes) return null;
  if (f.strongChord > f.strong || f.strong > f.notes) return null;
  if (f.melody > f.notes || f.repeated > f.melody) return null;
  if (f.answered > f.calls || (!s.call && f.calls > 0)) return null;
  if (f.playerMs > f.ms || f.soundMs > f.playerMs) return null;
  if (f.notes === 0 ? f.low !== null || f.high !== null : !isMidi(f.low) || !isMidi(f.high))
    return null;
  if (f.low !== null && f.high !== null && f.low > f.high) return null;
  const bars = BACKINGS[s.backing].bars.length;
  if (
    !Array.isArray(f.byBar) ||
    f.byBar.length !== bars ||
    !f.byBar.every(
      (cell) =>
        Array.isArray(cell) &&
        cell.length === 2 &&
        isCount(cell[0]) &&
        isCount(cell[1]) &&
        cell[0] <= cell[1],
    )
  )
    return null;
  if (f.byBar.reduce((sum, [, n]) => sum + n, 0) !== f.notes) return null;
  if (f.byBar.reduce((sum, [c]) => sum + c, 0) !== f.chord) return null;
  return {
    ms: f.ms,
    notes: f.notes,
    chord: f.chord,
    scale: f.scale,
    outside: f.outside,
    strong: f.strong,
    strongChord: f.strongChord,
    low: f.low,
    high: f.high,
    playerMs: f.playerMs,
    soundMs: f.soundMs,
    melody: f.melody,
    repeated: f.repeated,
    calls: f.calls,
    answered: f.answered,
    byBar: f.byBar.map(([c, n]) => [c, n]),
  };
}

function validateImprovSession(value: Fields): Validation<ImprovSessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    backing: isBackingId,
    key: (v) => isBackingId(value.backing) && BACKINGS[value.backing].keys.includes(v as string),
    scale: (v) => isBackingId(value.backing) && BACKINGS[value.backing].scales.includes(v as never),
    pattern: (v) =>
      isBackingId(value.backing) && BACKINGS[value.backing].patterns.includes(v as never),
    feel: isFeel,
    bpm: isImprovTempo,
    click: isBool,
    call: isBool,
    seed: (v) => isCount(v) && v <= 0xffffffff,
    figures: isObject,
  });
  if (field) return fail(field);
  const s = value as unknown as ImprovSessionRecord;
  if (s.endedAt < s.startedAt) return fail('endedAt');
  if (s.activeMs > s.endedAt - s.startedAt) return fail('activeMs');
  const figures = cleanImprovFigures(s.figures, s);
  if (!figures) return fail('figures');
  return {
    ok: true,
    value: {
      kind: 'improv',
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      backing: s.backing,
      key: s.key,
      scale: s.scale,
      pattern: s.pattern,
      feel: s.feel,
      bpm: s.bpm,
      click: s.click,
      call: s.call,
      seed: s.seed,
      figures,
    },
  };
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
    // Rhythm mode's timings, memory mode's prompts and stage, and nothing in wait mode.
    notes: (v) => (value.mode === 'rhythm' ? isNoteTimings(v) : v === undefined),
    prompts: (v) => (value.mode === 'memory' ? isCount(v) : v === undefined),
    stage: (v) => (value.mode === 'memory' ? isMemoryStage(v) : v === undefined),
    transpose: isTranspose,
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
      ...(r.mode === 'memory' && { mode: r.mode, prompts: r.prompts!, stage: r.stage! }),
      ...(r.transpose !== undefined && { transpose: r.transpose }),
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
    transpose: isTranspose,
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
      ...((r.mode === 'rhythm' || r.mode === 'memory') && { mode: r.mode }),
      ...(r.latency !== undefined && { latency: r.latency }),
      ...(r.transpose !== undefined && { transpose: r.transpose }),
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
    isIndex(v.bars.both) &&
    (v.notes === undefined || (isObject(v.notes) && isIndex(v.notes.play) && isIndex(v.notes.skip)))
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
    review: (v) => v === undefined || v === false,
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
      ...(p.review === false && { review: false }),
      ...(p.facts && {
        facts: {
          checksum: p.facts.checksum,
          bars: { right: p.facts.bars.right, left: p.facts.bars.left, both: p.facts.bars.both },
          ...(p.facts.notes && {
            notes: { play: p.facts.notes.play, skip: p.facts.notes.skip },
          }),
        },
      }),
    },
  };
}

// --- Assignments (docs/ASSIGNMENTS.md) ---------------------------------------------------------

/**
 * An assignment or a kept report as stored (or the record a deleted one leaves): the record's own
 * fields here, what it holds by the rules a link or a file is read with (`assignmentShare.ts`).
 */
export function validateAssignmentRecord(value: unknown): Validation<AssignmentRecord> {
  if (!isObject(value)) return fail('record');
  const { id, type, updatedAt, addedAt } = value;
  if (!isShareId(id)) return fail('id');
  if (type !== 'assignment' && type !== 'report') return fail('type');
  if (!isTime(updatedAt)) return fail('updatedAt');
  if (value.deleted !== undefined) {
    return value.deleted === true
      ? { ok: true, value: { id, type, deleted: true, updatedAt } }
      : fail('deleted');
  }
  if (!isTime(addedAt)) return fail('addedAt');
  if (type === 'report') {
    const report = parseReport(value.report);
    if (!report || report.id !== id) return fail('report');
    return { ok: true, value: { id, type, report, addedAt, updatedAt } };
  }
  const assignment = parseAssignment(value.assignment);
  if (!assignment || assignment.id !== id) return fail('assignment');
  const { made, following } = value;
  if (!isBool(made)) return fail('made');
  if (!isBool(following)) return fail('following');
  return { ok: true, value: { id, type, assignment, made, following, addedAt, updatedAt } };
}

/**
 * A piece as an assignment's file carries it: checked like an imported piece's record, and only
 * what the file is meant to carry is kept. Null when it is not one.
 */
export function validateSharedPiece(value: unknown): SharedPiece | null {
  if (!isObject(value)) return null;
  const checked = validatePiece({ ...value, importedAt: 0, updatedAt: undefined });
  if (!checked.ok) return null;
  const { id, title, composer, fileName, xml, hands, warnings } = checked.value;
  return { id, title, composer, fileName, xml, hands, warnings };
}

// --- Rhythm dictation on Ear -----------------------------------------------------------------

/** A bar as cells: a few of one line's cell keys. */
const isCells = (v: unknown): v is string[] => isList(v, isCellKey, 1) && v.length <= 16;

function validateRhythmEarAnswer(value: Fields): Validation<RhythmEarAnswer> {
  const field = firstInvalid(value, {
    id: isId,
    sessionId: isId,
    family: isRhythmEarFamily,
    level: isRhythmEarLevelId,
    item: (v) => parseRhythmEarItem(v) !== null,
    by: isAnswerMode,
    bpm: isRhythmBpm,
    question: isIndex,
    replays: isCount,
    correct: isBool,
    at: isTime,
  });
  if (field) return fail(field);
  const a = value as unknown as RhythmEarAnswer;
  if (!isRhythmEarItemOf(a.level, a.item)) return fail('item');
  const { cell, meter } = parseRhythmEarItem(a.item)!;
  const base = {
    id: a.id,
    sessionId: a.sessionId,
    family: a.family,
    level: a.level,
    item: a.item,
    bpm: a.bpm,
    question: a.question,
    replays: a.replays,
    at: a.at,
  };

  if (a.by === 'play') {
    const tap = value as unknown as RhythmEarTapAnswer;
    // The prompt is the cell's onsets, exactly as a session writes them.
    const onsets = cellOnsets(cell, meter)[0]!;
    if (
      !Array.isArray(tap.prompt) ||
      tap.prompt.length !== onsets.length ||
      onsets.some((b, i) => tap.prompt[i] !== b)
    )
      return fail('prompt');
    // Taps too many lie in the cell's span, the first cell's from a window before it.
    const spanMs = (cellBeats(cell) * 60_000) / tap.bpm;
    const isExtra = (v: unknown) =>
      Number.isInteger(v) && (v as number) >= -MAX_WINDOW_MS && (v as number) <= spanMs;
    const answer: unknown = tap.answer;
    if (
      !isObject(answer) ||
      !isList(answer.deviations, isCellDeviation) ||
      answer.deviations.length !== onsets.length ||
      !isList(answer.extras, isExtra) ||
      answer.extras.length > 100
    )
      return fail('answer');
    const deviations = answer.deviations as (number | null)[];
    const extras = answer.extras as number[];
    if (judgeCell([deviations], extras.length) !== tap.correct) return fail('correct');
    return {
      ok: true,
      value: {
        ...base,
        by: 'play',
        prompt: [...onsets],
        answer: { deviations: [...deviations], extras: [...extras] },
        correct: tap.correct,
      },
    };
  }

  const chosen = value as unknown as RhythmEarChoiceAnswer;
  if (!isTime(chosen.ms)) return fail('ms');
  const level = getRhythmLevel(a.level);
  // The bar played has the cell asked about in it; the bar chosen is it, or one the session
  // could offer beside it: one cell changed, not sounding alike.
  if (
    !isCells(chosen.prompt) ||
    !isBarOf(level, meter, chosen.prompt) ||
    !chosen.prompt.includes(cell)
  )
    return fail('prompt');
  if (!isCells(chosen.answer) || !isBarOf(level, meter, chosen.answer)) return fail('answer');
  const same =
    chosen.answer.length === chosen.prompt.length &&
    chosen.answer.every((c, i) => c === chosen.prompt[i]);
  if (!same) {
    const at = differingCell(chosen.prompt, chosen.answer);
    if (
      at === null ||
      cellBeats(chosen.answer[at]!) !== cellBeats(chosen.prompt[at]!) ||
      sameSound(barSound(chosen.answer, meter), barSound(chosen.prompt, meter))
    )
      return fail('answer');
  }
  if (same !== chosen.correct) return fail('correct');
  return {
    ok: true,
    value: {
      ...base,
      by: 'name',
      prompt: [...chosen.prompt],
      answer: [...chosen.answer],
      correct: chosen.correct,
      ms: chosen.ms,
    },
  };
}

function validateRhythmEarSession(value: Fields): Validation<EarSessionRecord> {
  const field = firstInvalid(value, {
    id: isId,
    family: isRhythmEarFamily,
    level: isRhythmEarLevelId,
    by: isAnswerMode,
    bpm: isRhythmBpm,
    startedAt: isTime,
    endedAt: isTime,
    activeMs: isTime,
    length: (v) => isCount(v) && v > 0,
    questions: isCount,
    questionsRight: isCount,
    items: isCount,
    correct: isCount,
    accuracy: isRatio,
    medianMs: isTimeOrNull,
    medianDeviation: (v) => v === null || (isTime(v) && v <= MAX_WINDOW_MS),
    replays: isCount,
    missed: (v) =>
      isList(
        v,
        (m) => isObject(m) && typeof m.item === 'string' && (m.as === null || isCellKey(m.as)),
      ) && v.length <= 10_000,
  });
  if (field) return fail(field);
  const s = value as unknown as RhythmEarSessionSummary;
  if (s.endedAt < s.startedAt) return fail('endedAt');
  if (s.questionsRight > s.questions) return fail('questionsRight');
  if (s.questions > s.items) return fail('questions');
  if (s.correct > s.items) return fail('correct');
  if ((s.accuracy === null) !== (s.items === 0)) return fail('accuracy');
  if (s.missed.some((m) => !isRhythmEarItemOf(s.level, m.item))) return fail('missed');
  return {
    ok: true,
    value: {
      kind: 'ear',
      id: s.id,
      family: 'rhythmEar',
      level: s.level,
      by: s.by,
      bpm: s.bpm,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      activeMs: s.activeMs,
      length: s.length,
      questions: s.questions,
      questionsRight: s.questionsRight,
      items: s.items,
      correct: s.correct,
      accuracy: s.accuracy,
      medianMs: s.medianMs,
      medianDeviation: s.medianDeviation,
      replays: s.replays,
      missed: s.missed.map(({ item, as }) => ({ item, as })),
    },
  };
}
