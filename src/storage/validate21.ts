// For tests: a piece run's step and session as the build before SYNC_SCHEMA 22 validated them
// (src/storage/validate.ts at 23d0558, the commit G6c was built on), rule for rule. A build of
// that time refuses a step with `notes: []` (a step passed, docs/PERSONAL.md, "The instrument's
// keys") and keeps a session without its `given`: what docs/SYNC.md's "A build that learns a
// collection pulls everything again" is there for. Nothing of the app imports this.

import type { PieceSessionRecord } from '../core/log.ts';
import { isMemoryStage } from '../core/memory.ts';
import { isMidiNote } from '../core/note.ts';
import {
  isHandSelection,
  type LoopRange,
  type MemoryCounts,
  type PieceRunHeader,
  type PieceStep,
  type RhythmCounts,
} from '../core/pieceRecords.ts';
import { isPatternId } from '../core/progressions.ts';
import type { NoteTiming } from '../core/rhythm.ts';
import { isTransposition } from '../core/transpose.ts';
import type { Validation } from './validate.ts';

type Fields = Record<string, unknown>;

const isObject = (v: unknown): v is Fields =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200;
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isMidi = (v: unknown): v is number => typeof v === 'number' && isMidiNote(v);
const isText = (max: number) => (v: unknown) => typeof v === 'string' && v.length <= max;

function firstInvalid(record: Fields, checks: Record<string, (v: unknown) => boolean>) {
  for (const [field, check] of Object.entries(checks)) if (!check(record[field])) return field;
  return null;
}

const fail = (field: string) => ({ ok: false, field }) as const;

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

/** A piece session, as `validateSession` took one. */
export function validatePieceSession21(value: unknown): Validation<PieceSessionRecord> {
  if (!isObject(value)) return fail('record');
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

const isChecksum = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}$/.test(v);

export function validatePieceStep21(value: unknown): Validation<PieceStep> {
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
