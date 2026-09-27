import type { PlayedNote, RunHeadline } from '../core/evenness.ts';
import type { OpenFreePlay } from '../core/freePlay.ts';
import { isStaffHands } from '../core/hands.ts';
import { isLevelId, parseNoteKey } from '../core/levels.ts';
import type {
  FreePlaySessionRecord,
  PieceSessionRecord,
  ReadSessionRecord,
  ScaleSessionRecord,
  SessionRecord,
} from '../core/log.ts';
import { isMidiNote } from '../core/note.ts';
import {
  isHandSelection,
  type LoopRange,
  type PieceFacts,
  type PieceRunHeader,
  type PieceStep,
  type RhythmCounts,
} from '../core/pieceRecords.ts';
import type { NoteTiming } from '../core/rhythm.ts';
import type { PedalChange, ScaleRunSummary, StoredScaleRun } from '../core/scaleRecords.ts';
import { parseExerciseKey } from '../core/scales.ts';
import type { Attempt } from '../core/session.ts';
import { isScoreWarning, type StoredPiece } from '../core/storedPiece.ts';

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

function isRunSummary(v: unknown): v is ScaleRunSummary {
  return (
    isObject(v) &&
    firstInvalid(v, {
      id: isId,
      exercise: isExerciseKey,
      startedAt: isTime,
      endedAt: isTime,
      headline: isRunHeadline,
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
      })),
    },
  };
}

export function validateSession(value: unknown): Validation<SessionRecord> {
  if (!isObject(value)) return fail('record');
  if (value.kind === 'read') return validateReadSession(value);
  if (value.kind === 'free') return validateFreeSession(value);
  if (value.kind === 'piece') return validatePieceSession(value);
  if (value.kind === 'scale') return validateScaleSession(value);
  return fail('kind');
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
  });
  if (field) return fail(field);
  const r = value as unknown as StoredScaleRun;
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
