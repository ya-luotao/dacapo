import type { OpenFreePlay } from '../core/freePlay.ts';
import { isStaffHands } from '../core/hands.ts';
import { isLevelId, parseNoteKey } from '../core/levels.ts';
import type { FreePlaySessionRecord, ReadSessionRecord, SessionRecord } from '../core/log.ts';
import { isMidiNote } from '../core/note.ts';
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

export function validateSession(value: unknown): Validation<SessionRecord> {
  if (!isObject(value)) return fail('record');
  if (value.kind === 'read') return validateReadSession(value);
  if (value.kind === 'free') return validateFreeSession(value);
  return fail('kind');
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

const isText = (max: number) => (v: unknown) => typeof v === 'string' && v.length <= max;

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
    },
  };
}
