// How an assignment or a report travels without a server (docs/ASSIGNMENTS.md, "Sharing"): in the
// fragment of a link, deflated, or as a file that also carries the imported pieces it names. And
// how either is read back: whatever comes out of a link or a file was written by someone else, so
// nothing in it is trusted. Sizes, counts and string lengths are bounded, every known field is
// checked, only known fields are kept; a task this version cannot read is kept as it came (and
// shown as such) instead of refusing the rest.

import { deflateSync, inflateSync } from 'fflate';
import { lessonBySlug } from '../learn/lessons.ts';
import { canonical, canonicalText } from '../lib/canonical.ts';
import {
  MAX_MINUTES,
  MAX_NAME,
  MAX_NOTE,
  MAX_ASSIGNMENT_BYTES,
  MAX_PIECE_TEXT,
  MAX_REPORT_BYTES,
  MAX_RUNS,
  MAX_TASKS,
  MAX_TITLE,
  MAX_UNKNOWN_TASK_BYTES,
  MAX_WINDOW_DAYS,
  type Assignment,
  type KnownTask,
  type MasteryFigures,
  type PieceRunFigures,
  type PieceTask,
  type Report,
  type ScaleRunFigures,
  type SessionFigures,
  type SharedPiece,
  type Task,
  type TaskProgress,
  type TaskReport,
} from './assignmentRecords.ts';
import { isLevelFamily, isTaskTempo, levelsOfFamily } from './assignments.ts';
import { isHandSelection } from './pieceRecords.ts';
import { daysBetween } from './review.ts';
import { isClickTempo, isGridPerBeat } from './scaleClick.ts';
import { parseExerciseKey } from './scales.ts';
import type { StoredPiece } from './storedPiece.ts';
import type { DayKey } from './streak.ts';

// --- Reading what someone else wrote -------------------------------------------------------------

type Fields = Record<string, unknown>;

const isObject = (v: unknown): v is Fields =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
/** Epoch ms: a whole number of them, within what a `Date` can hold. */
const isTime = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isCount = (v: unknown, min: number, max: number): v is number =>
  Number.isInteger(v) && (v as number) >= min && (v as number) <= max;
const isRatioOrNull = (v: unknown): v is number | null =>
  v === null || (typeof v === 'number' && v >= 0 && v <= 1);

/** An assignment's or a report's id: what `crypto.randomUUID` gives, or the like. */
export const isShareId = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v);
const isTaskId = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(v);

/** `YYYY-MM-DD`, and a day the calendar has. */
export function isDay(v: unknown): v is DayKey {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d));
  return y! >= 1970 && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
}

const byteLength = (text: string) => new TextEncoder().encode(text).byteLength;

/**
 * A copy of plain JSON data with its keys in order, or null when it is anything else, nested
 * deeper than a task could be, or larger than `maxBytes` serialized.
 */
function boundedJson(value: unknown, maxBytes: number): unknown {
  let budget = maxBytes;
  const copy = (v: unknown, depth: number): unknown => {
    if (depth > 8) throw new RangeError('too deep');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new RangeError('not JSON');
      budget -= 8;
      return v;
    }
    if (typeof v === 'string') {
      budget -= v.length + 2;
      if (budget < 0) throw new RangeError('too large');
      return v;
    }
    if (Array.isArray(v)) {
      budget -= v.length + 2;
      if (budget < 0) throw new RangeError('too large');
      return v.map((item) => copy(item, depth + 1));
    }
    if (typeof v !== 'object') throw new RangeError('not JSON');
    // A field without a value is no field, as in JSON.
    const keys = Object.keys(v)
      .filter((key) => (v as Fields)[key] !== undefined)
      .sort();
    budget -= keys.reduce((sum, key) => sum + key.length + 4, 2);
    if (budget < 0) throw new RangeError('too large');
    return Object.fromEntries(keys.map((key) => [key, copy((v as Fields)[key], depth + 1)]));
  };
  try {
    const out = copy(value, 0);
    return byteLength(JSON.stringify(out)) <= maxBytes ? out : null;
  } catch {
    return null;
  }
}

function knownTask(v: Fields): KnownTask | null {
  if (!isTaskId(v.id)) return null;
  const id = v.id;
  switch (v.kind) {
    case 'piece': {
      const { piece, bars, goal, pass } = v;
      if (!isObject(piece) || !isObject(pass)) return null;
      if (typeof piece.id !== 'string' || piece.id.length === 0 || piece.id.length > 200) {
        return null;
      }
      if (!isText(piece.title, MAX_PIECE_TEXT) || !isText(piece.composer, MAX_PIECE_TEXT)) {
        return null;
      }
      if (typeof piece.checksum !== 'string' || !/^[0-9a-f]{8}$/.test(piece.checksum)) return null;
      if (bars !== null) {
        if (
          !isObject(bars) ||
          !isCount(bars.from, 0, 99_999) ||
          !isCount(bars.to, bars.from, 99_999)
        )
          return null;
        if (!isText(bars.fromLabel, 20) || !isText(bars.toLabel, 20)) return null;
      }
      if (!isHandSelection(v.hands)) return null;
      if (v.mode !== 'wait' && v.mode !== 'rhythm' && v.mode !== 'memory') return null;
      if (!isTaskTempo(v.tempo) || !isCount(v.runs, 1, MAX_RUNS)) return null;
      if (goal !== undefined) {
        if (!isObject(goal) || !isCount(goal.percent, 50, 100)) return null;
        // Notes are in time only where they are timed.
        if (goal.measure !== 'right' && !(goal.measure === 'inTime' && v.mode === 'rhythm'))
          return null;
      }
      if (!isCount(pass.play, 0, 99_999) || !isCount(pass.skip, 0, 99_999)) return null;
      const task: PieceTask = {
        kind: 'piece',
        id,
        piece: {
          id: piece.id,
          title: piece.title,
          composer: piece.composer,
          checksum: piece.checksum,
        },
        bars: isObject(bars)
          ? {
              from: bars.from as number,
              to: bars.to as number,
              fromLabel: bars.fromLabel as string,
              toLabel: bars.toLabel as string,
            }
          : null,
        hands: v.hands,
        mode: v.mode,
        tempo: v.tempo,
        runs: v.runs,
        ...(isObject(goal) && {
          goal: { measure: goal.measure as 'right' | 'inTime', percent: goal.percent as number },
        }),
        pass: { play: pass.play, skip: pass.skip },
      };
      return task;
    }
    case 'scale': {
      const { click } = v;
      if (typeof v.exercise !== 'string' || parseExerciseKey(v.exercise) === null) return null;
      if (click !== null) {
        if (!isObject(click) || !isClickTempo(click.bpm) || !isGridPerBeat(click.perBeat))
          return null;
      }
      if (!isCount(v.runs, 1, MAX_RUNS)) return null;
      return {
        kind: 'scale',
        id,
        exercise: v.exercise,
        click: isObject(click)
          ? { bpm: click.bpm as number, perBeat: click.perBeat as 1 | 2 | 3 | 4 | 8 }
          : null,
        runs: v.runs,
      };
    }
    case 'level': {
      if (!isLevelFamily(v.family) || typeof v.level !== 'string') return null;
      if (!levelsOfFamily(v.family).includes(v.level)) return null;
      if (v.goal !== 'mastery' && !isCount(v.goal, 1, MAX_RUNS)) return null;
      return { kind: 'level', id, family: v.family, level: v.level, goal: v.goal };
    }
    case 'lesson':
      if (typeof v.slug !== 'string' || !lessonBySlug(v.slug)?.ready) return null;
      return { kind: 'lesson', id, slug: v.slug };
    case 'minutes':
      if (!isCount(v.minutes, 1, MAX_MINUTES) || !isCount(v.days, 1, MAX_WINDOW_DAYS)) return null;
      return { kind: 'minutes', id, minutes: v.minutes, days: v.days };
    default:
      return null;
  }
}

/**
 * A task: one this version knows, checked field by field, or else the task as it came, kept for
 * a version that does (at most `MAX_UNKNOWN_TASK_BYTES`). Null when it is no task at all.
 * `position` names a task that came without a usable id.
 */
export function parseTask(value: unknown, position: number): Task | null {
  if (!isObject(value)) return null;
  // A task an earlier version kept unread: this one may know it by now.
  const raw = value.kind === 'unknown' && isObject(value.raw) ? value.raw : value;
  const known = knownTask(raw);
  if (known) return known;
  const kept = boundedJson(raw, MAX_UNKNOWN_TASK_BYTES);
  if (!isObject(kept)) return null;
  const id = isTaskId(raw.id) ? raw.id : isTaskId(value.id) ? value.id : `task-${position + 1}`;
  return { kind: 'unknown', id, raw: kept };
}

function parseTasks(value: unknown): Task[] | null {
  if (!Array.isArray(value) || value.length > MAX_TASKS) return null;
  const tasks: Task[] = [];
  const ids = new Set<string>();
  for (const [i, item] of value.entries()) {
    const task = parseTask(item, i);
    if (!task || ids.has(task.id)) return null;
    ids.add(task.id);
    tasks.push(task);
  }
  return tasks;
}

/** The first and last day of a window, at most `MAX_WINDOW_DAYS` long. */
function isWindow(start: unknown, due: unknown): boolean {
  return isDay(start) && isDay(due) && start <= due && daysBetween(start, due) < MAX_WINDOW_DAYS;
}

/** Within `max` bytes, serialized as the sync service compares it. */
const fits = (value: unknown, max: number) => byteLength(canonicalText(value)) <= max;

/**
 * An assignment as its maker wrote it, with only the fields this version knows; null when it is
 * not one (a field missing, of another type or out of bounds).
 */
export function parseAssignment(value: unknown): Assignment | null {
  if (!isObject(value) || !isShareId(value.id)) return null;
  if (!isText(value.title, MAX_TITLE) || value.title.trim() === '') return null;
  if (!isText(value.note, MAX_NOTE) || !isText(value.teacher, MAX_NAME)) return null;
  if (!isWindow(value.start, value.due)) return null;
  if (!isTime(value.createdAt) || !isTime(value.updatedAt) || value.updatedAt < value.createdAt)
    return null;
  const tasks = parseTasks(value.tasks);
  if (!tasks) return null;
  const assignment: Assignment = {
    id: value.id,
    title: value.title,
    note: value.note,
    teacher: value.teacher,
    start: value.start as DayKey,
    due: value.due as DayKey,
    tasks,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  return fits(assignment, MAX_ASSIGNMENT_BYTES) ? assignment : null;
}

function pieceRun(v: unknown): PieceRunFigures | null | undefined {
  if (v === null) return null;
  if (!isObject(v) || !isTime(v.at) || !isTaskTempo(v.tempo)) return undefined;
  if (!isRatioOrNull(v.right) || !isRatioOrNull(v.inTime)) return undefined;
  return { at: v.at, tempo: v.tempo, right: v.right, inTime: v.inTime };
}

function scaleRun(v: unknown): ScaleRunFigures | null | undefined {
  if (v === null) return null;
  if (!isObject(v) || !isTime(v.at)) return undefined;
  const spread = v.spread;
  if (spread !== null && !(typeof spread === 'number' && spread >= 0 && spread <= 60_000))
    return undefined;
  if (v.bpm !== null && !isClickTempo(v.bpm)) return undefined;
  return { at: v.at, spread, bpm: v.bpm };
}

function sessionFigures(v: unknown): SessionFigures | null | undefined {
  if (v === null) return null;
  if (!isObject(v) || !isTime(v.at) || !isRatioOrNull(v.accuracy)) return undefined;
  return { at: v.at, accuracy: v.accuracy };
}

function mastery(v: unknown): MasteryFigures | null | undefined {
  if (v === null) return null;
  if (!isObject(v) || !isCount(v.window, 1, 1000) || !isCount(v.counted, 0, v.window)) {
    return undefined;
  }
  if (!isRatioOrNull(v.accuracy)) return undefined;
  return { counted: v.counted, window: v.window, accuracy: v.accuracy };
}

/** A task's progress as a report carries it; null when it does not belong to that task. */
function parseProgress(value: unknown, task: Task): TaskProgress | null {
  if (!isObject(value)) return null;
  const { done, target, met } = value;
  if (!isCount(done, 0, 100_000) || !isCount(target, 0, 100_000) || typeof met !== 'boolean') {
    return null;
  }
  // What a later version reported of a task this one does not know: how far, nothing more.
  if (task.kind === 'unknown') return { kind: 'unknown', done, target, met };
  if (value.kind !== task.kind) return null;
  switch (task.kind) {
    case 'piece': {
      const best = pieceRun(value.best);
      const last = pieceRun(value.last);
      if (best === undefined || last === undefined || !isCount(value.played, done, 100_000))
        return null;
      return { kind: 'piece', done, target, met, played: value.played, best, last };
    }
    case 'scale': {
      const best = scaleRun(value.best);
      const last = scaleRun(value.last);
      if (best === undefined || last === undefined) return null;
      return { kind: 'scale', done, target, met, best, last };
    }
    case 'level': {
      const best = sessionFigures(value.best);
      const last = sessionFigures(value.last);
      const figures = mastery(value.mastery);
      if (best === undefined || last === undefined || figures === undefined) return null;
      return { kind: 'level', done, target, met, best, last, mastery: figures };
    }
    default:
      return { kind: task.kind, done, target, met };
  }
}

/** A report with only the fields this version knows; null when it is not one. */
export function parseReport(value: unknown): Report | null {
  if (!isObject(value) || !isShareId(value.id) || !isShareId(value.assignmentId)) return null;
  if (!isTime(value.assignmentVersion) || !isTime(value.createdAt)) return null;
  if (!isText(value.title, MAX_TITLE) || value.title.trim() === '') return null;
  if (!isText(value.from, MAX_NAME) || !isText(value.note, MAX_NOTE)) return null;
  if (!isWindow(value.start, value.due)) return null;
  const { start, due } = value as { start: DayKey; due: DayKey };
  if (!Array.isArray(value.tasks) || value.tasks.length > MAX_TASKS) return null;
  const tasks: TaskReport[] = [];
  const ids = new Set<string>();
  for (const [i, item] of value.tasks.entries()) {
    if (!isObject(item)) return null;
    const task = parseTask(item.task, i);
    const progress = task && parseProgress(item.progress, task);
    if (!task || !progress || ids.has(task.id)) return null;
    ids.add(task.id);
    tasks.push({ task, progress });
  }
  // A number for each day from the start on, never more days than the window has.
  const { days } = value;
  if (!Array.isArray(days) || days.length > daysBetween(start, due) + 1) return null;
  if (!days.every((minutes): minutes is number => isCount(minutes, 0, 1440))) return null;
  const report: Report = {
    id: value.id,
    assignmentId: value.assignmentId,
    assignmentVersion: value.assignmentVersion,
    title: value.title,
    start,
    due,
    from: value.from,
    note: value.note,
    createdAt: value.createdAt,
    tasks,
    days: [...days],
  };
  return fits(report, MAX_REPORT_BYTES) ? report : null;
}

// --- What is shared ------------------------------------------------------------------------------

/** What a link or a file holds: an assignment (a file: with the pieces it names) or a report. */
export type Shared =
  | { kind: 'assignment'; assignment: Assignment; pieces: SharedPiece[] }
  | { kind: 'report'; report: Report };

/**
 * Why a link or a file could not be read: not one of ours or damaged (`malformed`), larger than
 * one may be (`too-large`), written by a later version of the format (`newer`), or well-formed
 * but not a valid assignment or report (`invalid`).
 */
export type ShareError = 'malformed' | 'too-large' | 'newer' | 'invalid';
export type ShareResult = { ok: true; value: Shared } | { ok: false; error: ShareError };

const failed = (error: ShareError): ShareResult => ({ ok: false, error });

function parseShared(json: unknown): ShareResult {
  if (!isObject(json)) return failed('malformed');
  if ('assignment' in json) {
    const assignment = parseAssignment(json.assignment);
    return assignment
      ? { ok: true, value: { kind: 'assignment', assignment, pieces: [] } }
      : failed('invalid');
  }
  if ('report' in json) {
    const report = parseReport(json.report);
    return report ? { ok: true, value: { kind: 'report', report } } : failed('invalid');
  }
  return failed('malformed');
}

// --- The link ------------------------------------------------------------------------------------
// `#/assignments/open/<data>`: one byte for the version of this format, then the JSON
// (`{"assignment": …}` or `{"report": …}`, its keys in order) deflated, all in base64url. The
// fragment of a link is never sent to a server.

export const LINK_VERSION = 1;
/** The highest version byte a later format may use: above it, the data is not a link's. */
export const MAX_LINK_VERSION = 15;
/** A link's data is at most this many bytes (about 11,000 characters): hundreds of tasks. */
export const MAX_LINK_BYTES = 8192;
export const MAX_LINK_CHARS = Math.ceil((MAX_LINK_BYTES * 4) / 3);
/** What a link inflates to is at most this many bytes: more is refused, never read. */
export const MAX_INFLATED_BYTES = 64 * 1024;
/** The route that opens a link: its data follows. */
export const OPEN_ROUTE = '/assignments/open/';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const payloadOf = (shared: Shared) =>
  shared.kind === 'assignment' ? { assignment: shared.assignment } : { report: shared.report };

/**
 * The data of a link to an assignment or a report; null when it is too large for a link (it goes
 * as a file then). A link never carries a piece's MusicXML.
 */
export function encodeShare(shared: Shared): string | null {
  const json = new TextEncoder().encode(canonicalText(payloadOf(shared)));
  if (json.byteLength > MAX_INFLATED_BYTES) return null;
  const packed = deflateSync(json, { level: 9 });
  if (packed.byteLength + 1 > MAX_LINK_BYTES) return null;
  const bytes = new Uint8Array(packed.byteLength + 1);
  bytes[0] = LINK_VERSION;
  bytes.set(packed, 1);
  return toBase64Url(bytes);
}

/** Reads the data of a link. Never throws, whatever the data is. */
export function decodeShare(data: string): ShareResult {
  if (data.length > MAX_LINK_CHARS) return failed('too-large');
  const bytes = fromBase64Url(data);
  if (!bytes || bytes.byteLength < 2) return failed('malformed');
  // Versions are counted from 1: a first byte far from that is no link of ours at all.
  if (bytes[0]! > LINK_VERSION && bytes[0]! <= MAX_LINK_VERSION) return failed('newer');
  if (bytes[0] !== LINK_VERSION) return failed('malformed');
  let inflated: Uint8Array;
  try {
    // One byte more than the limit: inflating stops there, and filling it means it was larger.
    inflated = inflateSync(bytes.subarray(1), { out: new Uint8Array(MAX_INFLATED_BYTES + 1) });
  } catch {
    return failed('malformed');
  }
  if (inflated.byteLength > MAX_INFLATED_BYTES) return failed('too-large');
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inflated));
  } catch {
    return failed('malformed');
  }
  return parseShared(json);
}

/** The link that opens `data` in the app at `base` (its address up to the `#`). */
export const shareLink = (base: string, data: string): string => `${base}#${OPEN_ROUTE}${data}`;

/**
 * The data in a link someone pasted (or the data alone); null when the text holds neither. What
 * follows the route up to the first character a link's data cannot have is the data.
 */
export function linkData(text: string): string | null {
  const trimmed = text.trim();
  const at = trimmed.lastIndexOf(OPEN_ROUTE);
  const data = at < 0 ? trimmed : trimmed.slice(at + OPEN_ROUTE.length);
  const match = /^[A-Za-z0-9_-]+/.exec(data);
  if (!match || (at < 0 && match[0].length !== data.length)) return null;
  return match[0];
}

// --- The file ------------------------------------------------------------------------------------
// `<title>.dacapo-assignment.json`: the same assignment, and the imported pieces its tasks name,
// each with its MusicXML. A report's file is `<title>.dacapo-report.json`.

export const ASSIGNMENT_FILE_FORMAT = 'dacapo-assignment';
export const REPORT_FILE_FORMAT = 'dacapo-report';
export const SHARE_FILE_VERSION = 1;
export const ASSIGNMENT_FILE_SUFFIX = '.dacapo-assignment.json';
export const REPORT_FILE_SUFFIX = '.dacapo-report.json';
/** A file names at most this many imported pieces. */
export const MAX_FILE_PIECES = 20;
/** A file's text is at most this long: a few scores' worth. */
export const MAX_FILE_CHARS = 50_000_000;

/** A piece task whose piece is not one of the built-in ones: its MusicXML has to travel with it. */
export function importedPieceTasks(
  assignment: Pick<Assignment, 'tasks'>,
  isBuiltIn: (id: string) => boolean,
): PieceTask[] {
  return assignment.tasks.filter(
    (task): task is PieceTask => task.kind === 'piece' && !isBuiltIn(task.piece.id),
  );
}

/**
 * The imported pieces an assignment's file carries: for each piece task that needs one, the piece
 * stored here under its id (or with its notes), once each; and the tasks whose piece is not here
 * any more.
 */
export function piecesToShare(
  assignment: Pick<Assignment, 'tasks'>,
  stored: readonly StoredPiece[],
  isBuiltIn: (id: string) => boolean,
): { pieces: SharedPiece[]; missing: PieceTask[] } {
  const pieces = new Map<string, SharedPiece>();
  const missing: PieceTask[] = [];
  for (const task of importedPieceTasks(assignment, isBuiltIn)) {
    const piece =
      stored.find((p) => p.id === task.piece.id) ??
      stored.find((p) => p.facts?.checksum === task.piece.checksum);
    if (!piece) {
      missing.push(task);
      continue;
    }
    // Under the id the task names, whatever id the piece has here.
    pieces.set(task.piece.id, {
      id: task.piece.id,
      title: piece.title,
      composer: piece.composer,
      fileName: piece.fileName,
      xml: piece.xml,
      hands: piece.hands,
      warnings: piece.warnings,
    });
  }
  return { pieces: [...pieces.values()], missing };
}

/** The file's text. */
export function shareFileText(shared: Shared): string {
  const file =
    shared.kind === 'assignment'
      ? {
          format: ASSIGNMENT_FILE_FORMAT,
          version: SHARE_FILE_VERSION,
          assignment: canonical(shared.assignment),
          pieces: shared.pieces,
        }
      : {
          format: REPORT_FILE_FORMAT,
          version: SHARE_FILE_VERSION,
          report: canonical(shared.report),
        };
  return `${JSON.stringify(file, null, 2)}\n`;
}

/** `week-12.dacapo-assignment.json`: the title, as far as a file name can say it. */
export function shareFileName(shared: Shared): string {
  const title = shared.kind === 'assignment' ? shared.assignment.title : shared.report.title;
  const name = title
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase();
  const suffix = shared.kind === 'assignment' ? ASSIGNMENT_FILE_SUFFIX : REPORT_FILE_SUFFIX;
  return `${name || shared.kind}${suffix}`;
}

/**
 * Reads a file. `piece` checks one of its pieces (the same rules as an imported piece's record)
 * and returns it, or null when it is not one. Pieces no task names are left out. Never throws.
 */
export function parseShareFile(
  text: string,
  piece: (value: unknown) => SharedPiece | null,
): ShareResult {
  if (text.length > MAX_FILE_CHARS) return failed('too-large');
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return failed('malformed');
  }
  if (!isObject(json)) return failed('malformed');
  const { format, version } = json;
  if (format !== ASSIGNMENT_FILE_FORMAT && format !== REPORT_FILE_FORMAT) {
    return failed('malformed');
  }
  if (!isCount(version, 1, Number.MAX_SAFE_INTEGER)) return failed('malformed');
  if (version > SHARE_FILE_VERSION) return failed('newer');
  if (format === REPORT_FILE_FORMAT) return parseShared({ report: json.report });
  const result = parseShared({ assignment: json.assignment });
  if (!result.ok || result.value.kind !== 'assignment') return result;
  if (!Array.isArray(json.pieces) || json.pieces.length > MAX_FILE_PIECES) {
    return failed('invalid');
  }
  const named = new Set(
    result.value.assignment.tasks.flatMap((task) => (task.kind === 'piece' ? [task.piece.id] : [])),
  );
  const pieces = new Map<string, SharedPiece>();
  for (const item of json.pieces) {
    const checked = piece(item);
    if (!checked) return failed('invalid');
    if (named.has(checked.id)) pieces.set(checked.id, checked);
  }
  return { ok: true, value: { ...result.value, pieces: [...pieces.values()] } };
}
