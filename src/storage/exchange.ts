import { byAnswerTime, type Answer } from '../core/answers.ts';
import {
  byRecordId,
  type AssignmentRecord,
  type LiveAssignmentRecord,
} from '../core/assignmentRecords.ts';
import { parseGoalHistory, type GoalHistory } from '../core/goal.ts';
import { byLessonSlug, replacesLesson, type LessonDone } from '../core/lessonRecords.ts';
import { byStartDescending, byTime, type SessionRecord } from '../core/log.ts';
import { isNoteNaming, type NoteNaming } from '../core/noteNames.ts';
import { byStepTime, type PieceStep } from '../core/pieceRecords.ts';
import { byRunTime, type StoredScaleRun } from '../core/scaleRecords.ts';
import type { Attempt } from '../core/session.ts';
import { byImportedDescending, type StoredPiece } from '../core/storedPiece.ts';
import { byTakeChunk, type TakeChunk } from '../core/takes.ts';
import { dayKey } from '../core/streak.ts';
import type { NoteStats } from '../core/weakness.ts';
import { isLocale, type Locale } from '../i18n/locale.ts';
import { isThemePreference, type ThemePreference } from '../lib/themePreference.ts';
import {
  validateAnswer,
  validateAssignmentRecord,
  validateAttempt,
  validateLesson,
  validatePiece,
  validatePieceStep,
  validateScaleRun,
  validateSession,
  validateTake,
} from './validate.ts';

// The export file: everything the user owns, as one versioned JSON document. Importing merges by
// id and never trusts the file's note stats; they are rebuilt from the attempts. Piece figures are
// never stored at all: they are recomputed from the step records, and scale figures from the runs.

export const EXPORT_FORMAT = 'dacapo';
/**
 * Bump when the file shape changes; older files must keep importing. Version 2 adds pieces,
 * version 3 piece sessions and step records, version 4 rhythm-mode steps and sessions (a `mode`
 * and their timings; records without a mode are wait mode's, as in version 3), version 5 scale
 * sessions and scale runs, version 6 ear-training answers and sessions, version 7 scale runs played
 * with the click (their grid, and the tempo on their session's summary), version 8 the takes of
 * piece runs, version 9 assignments and kept reports, version 10 the lessons finished. New kinds of
 * record in a list the file has (Echo answers, the theory cards' answers
 * and `theory` sessions, Read's rhythm answers and `rhythm` sessions, the chord symbols' answers
 * and `harmony` sessions, rhythm dictation's answers and its `ear` sessions, memory mode's steps,
 * sessions and takes) need no new version:
 * an older build lists them among the records it could not read, and imports the rest.
 */
export const EXPORT_VERSION = 10;

export interface Preferences {
  /** null follows the browser language. */
  locale: Locale | null;
  theme: ThemePreference;
  /**
   * The daily goal as its changes, each with its day (core/goal.ts). A file from before the goal
   * could be chosen has none: it says nothing of the goal, and importing it changes none. No new
   * file version for it: an older build reads the language and the theme and leaves the rest.
   */
  goal?: GoalHistory;
  /**
   * How notes are named. A file from before the setting has none, and means letters; a build
   * from before it reads the language and the theme and leaves this, so no new version.
   */
  noteNames?: NoteNaming;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  /** ISO 8601. */
  exportedAt: string;
  app: { version: string };
  preferences: Preferences;
  /** Oldest first. */
  sessions: SessionRecord[];
  /** Oldest first. */
  attempts: Attempt[];
  /** Derived from `attempts`; included for reading, ignored on import. */
  noteStats: NoteStats[];
  /** Imported pieces, oldest first, with their MusicXML. */
  pieces: StoredPiece[];
  /** Step records of wait and rhythm mode, oldest first. */
  pieceSteps: PieceStep[];
  /** Scale runs as played, oldest first. */
  scaleRuns: StoredScaleRun[];
  /** Ear-training, theory and chord-symbol answers, oldest first. */
  answers: Answer[];
  /** Takes of piece runs, in chunks, oldest first. */
  takes: TakeChunk[];
  /** Assignments and kept reports, by id; deleted ones are left out. */
  assignments: LiveAssignmentRecord[];
  /** The lessons finished, by slug, each with when (0: before ticks had a time). */
  lessons: LessonDone[];
}

export interface ExportInput {
  sessions: readonly SessionRecord[];
  attempts: readonly Attempt[];
  stats: Readonly<Record<string, NoteStats>>;
  pieces: readonly StoredPiece[];
  pieceSteps: readonly PieceStep[];
  scaleRuns: readonly StoredScaleRun[];
  answers: readonly Answer[];
  takes: readonly TakeChunk[];
  /** As stored: the records of deleted ones are left out of the file. */
  assignments: readonly AssignmentRecord[];
  lessons: readonly LessonDone[];
}

export function buildExport(
  data: ExportInput,
  preferences: Preferences,
  { now, appVersion }: { now: number; appVersion: string },
): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    app: { version: appVersion },
    preferences: {
      locale: preferences.locale,
      theme: preferences.theme,
      ...(preferences.goal && { goal: preferences.goal }),
      ...(preferences.noteNames && { noteNames: preferences.noteNames }),
    },
    sessions: [...data.sessions].sort((a, b) => byStartDescending(b, a)),
    attempts: [...data.attempts].sort(byTime),
    noteStats: Object.values(data.stats).sort((a, b) => (a.key < b.key ? -1 : 1)),
    pieces: [...data.pieces].sort((a, b) => byImportedDescending(b, a)),
    pieceSteps: [...data.pieceSteps].sort(byStepTime),
    scaleRuns: [...data.scaleRuns].sort(byRunTime),
    answers: [...data.answers].sort(byAnswerTime),
    takes: [...data.takes].sort(byTakeChunk),
    assignments: data.assignments
      .filter((r): r is LiveAssignmentRecord => !('deleted' in r))
      .sort(byRecordId),
    lessons: [...data.lessons].sort(byLessonSlug),
  };
}

/**
 * The file's text: indented for reading, except arrays of numbers, which stay on one line (a
 * take's events, above all, would otherwise take a line per number).
 */
export function exportText(file: ExportFile): string {
  // Only structural line breaks are matched: inside a string a line break is written as \n.
  const text = JSON.stringify(file, null, 2).replace(
    /\[\n\s*(-?[\d.e+-]+(?:,\n\s*-?[\d.e+-]+)*)\n\s*\]/g,
    (_, numbers: string) => `[${numbers.replace(/\s+/g, '')}]`,
  );
  return `${text}\n`;
}

/** `dacapo-YYYY-MM-DD.json`, with the local date. */
export function exportFileName(now: number, timeZone?: string): string {
  return `dacapo-${dayKey(now, timeZone)}.json`;
}

export type ImportError =
  | { kind: 'malformed' }
  | { kind: 'wrong-format' }
  | { kind: 'future-version'; version: number }
  /** More lessons finished than any export holds: the file is refused whole. */
  | { kind: 'too-many-lessons'; limit: number };

/**
 * The most lessons finished a file may list. An export holds one per lesson ever ticked, a few
 * dozen; a hand-made file past this is refused rather than written to every device.
 */
export const MAX_IMPORT_LESSONS = 1000;

export type Collection =
  | 'sessions'
  | 'attempts'
  | 'pieces'
  | 'pieceSteps'
  | 'scaleRuns'
  | 'answers'
  | 'takes'
  | 'assignments'
  | 'lessons';

export interface InvalidRecord {
  collection: Collection | 'preferences';
  /** Position in the file's array; 0 for preferences. */
  index: number;
  /** The first field that is missing or wrong, or `record` when it is not an object at all. */
  field: string;
  problem: 'invalid' | 'duplicate';
}

export interface ParsedImport {
  version: number;
  exportedAt: string | null;
  appVersion: string | null;
  sessions: SessionRecord[];
  attempts: Attempt[];
  /** Empty for a version 1 file. */
  pieces: StoredPiece[];
  /** Empty before version 3. */
  pieceSteps: PieceStep[];
  /** Empty before version 5. */
  scaleRuns: StoredScaleRun[];
  /** Empty before version 6. */
  answers: Answer[];
  /** Empty before version 8. */
  takes: TakeChunk[];
  /** Empty before version 9. */
  assignments: LiveAssignmentRecord[];
  /** Empty before version 10. */
  lessons: LessonDone[];
  /** null when the file has none or they are invalid (then listed in `invalid`). */
  preferences: Preferences | null;
  invalid: InvalidRecord[];
}

export type ParseResult = { ok: true; value: ParsedImport } | { ok: false; error: ImportError };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function validatePreferences(value: unknown): Preferences | string {
  if (!isObject(value)) return 'record';
  if (value.locale !== null && !isLocale(value.locale)) return 'locale';
  if (!isThemePreference(value.theme)) return 'theme';
  const preferences: Preferences = { locale: value.locale, theme: value.theme };
  if (value.goal !== undefined) {
    const goal = parseGoalHistory(value.goal);
    if (goal === null) return 'goal';
    preferences.goal = goal;
  }
  if (value.noteNames !== undefined) {
    if (!isNoteNaming(value.noteNames)) return 'noteNames';
    preferences.noteNames = value.noteNames;
  }
  return preferences;
}

function validateAll<T extends { id: string }>(
  collection: Collection,
  records: readonly unknown[],
  validate: (value: unknown) => { ok: true; value: T } | { ok: false; field: string },
  invalid: InvalidRecord[],
): T[] {
  const valid: T[] = [];
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const result = validate(record);
    if (!result.ok) {
      invalid.push({ collection, index, field: result.field, problem: 'invalid' });
    } else if (seen.has(result.value.id)) {
      invalid.push({ collection, index, field: 'id', problem: 'duplicate' });
    } else {
      seen.add(result.value.id);
      valid.push(result.value);
    }
  });
  return valid;
}

/**
 * The valid lessons finished of a file, each slug once. Of several copies of a slug the one kept
 * is the one every merge keeps (`replacesLesson`: the earliest; of equal times the first), and
 * the others are listed as duplicates, wherever in the file they stand.
 */
function validateLessons(records: readonly unknown[], invalid: InvalidRecord[]): LessonDone[] {
  const checked = records.map(validateLesson);
  /** By slug, the position of the copy kept. */
  const kept = new Map<string, number>();
  checked.forEach((result, index) => {
    if (!result.ok) return;
    const at = kept.get(result.value.slug);
    const standing = at === undefined ? undefined : checked[at];
    if (!standing?.ok || replacesLesson(result.value, standing.value)) {
      kept.set(result.value.slug, index);
    }
  });
  const valid: LessonDone[] = [];
  checked.forEach((result, index) => {
    if (!result.ok) {
      invalid.push({ collection: 'lessons', index, field: result.field, problem: 'invalid' });
    } else if (kept.get(result.value.slug) !== index) {
      invalid.push({ collection: 'lessons', index, field: 'slug', problem: 'duplicate' });
    } else {
      valid.push(result.value);
    }
  });
  return valid;
}

/** The file holds what is there, never what was deleted: such a record is listed as invalid. */
function validateLiveAssignment(
  value: unknown,
): { ok: true; value: LiveAssignmentRecord } | { ok: false; field: string } {
  const checked = validateAssignmentRecord(value);
  if (!checked.ok) return checked;
  return 'deleted' in checked.value
    ? { ok: false, field: 'deleted' }
    : { ok: true, value: checked.value };
}

/** Parses and validates an export file. Invalid records are listed, never dropped silently. */
export function parseImport(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: { kind: 'malformed' } };
  }
  if (!isObject(json) || json.format !== EXPORT_FORMAT) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  const { version } = json;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  if (version > EXPORT_VERSION) return { ok: false, error: { kind: 'future-version', version } };
  if (!Array.isArray(json.sessions) || !Array.isArray(json.attempts)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  // Version 1 files have no pieces; from version 2 on the list is required.
  if (version >= 2 && !Array.isArray(json.pieces)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  // Step records come with version 3.
  if (version >= 3 && !Array.isArray(json.pieceSteps)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  // Scale runs with version 5.
  if (version >= 5 && !Array.isArray(json.scaleRuns)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  // Ear-training answers with version 6.
  if (version >= 6 && !Array.isArray(json.answers)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  // Takes with version 8.
  if (version >= 8 && !Array.isArray(json.takes)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  // Assignments and kept reports with version 9.
  if (version >= 9 && !Array.isArray(json.assignments)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  // The lessons finished with version 10, and from no file before it: an older build wrote none,
  // so a `lessons` list in such a file is not that build's, and is left alone like any other
  // field it does not know.
  const listed = version >= 10 ? json.lessons : [];
  if (!Array.isArray(listed)) {
    return { ok: false, error: { kind: 'wrong-format' } };
  }
  if (listed.length > MAX_IMPORT_LESSONS) {
    return { ok: false, error: { kind: 'too-many-lessons', limit: MAX_IMPORT_LESSONS } };
  }

  const invalid: InvalidRecord[] = [];
  const sessions = validateAll('sessions', json.sessions, validateSession, invalid);
  const attempts = validateAll('attempts', json.attempts, validateAttempt, invalid);
  const pieces = Array.isArray(json.pieces)
    ? validateAll('pieces', json.pieces, validatePiece, invalid)
    : [];
  const pieceSteps = Array.isArray(json.pieceSteps)
    ? validateAll('pieceSteps', json.pieceSteps, validatePieceStep, invalid)
    : [];
  const scaleRuns = Array.isArray(json.scaleRuns)
    ? validateAll('scaleRuns', json.scaleRuns, validateScaleRun, invalid)
    : [];
  const answers = Array.isArray(json.answers)
    ? validateAll('answers', json.answers, validateAnswer, invalid)
    : [];
  const takes = Array.isArray(json.takes)
    ? validateAll('takes', json.takes, validateTake, invalid)
    : [];
  const assignments = Array.isArray(json.assignments)
    ? validateAll('assignments', json.assignments, validateLiveAssignment, invalid)
    : [];
  const lessons = validateLessons(listed, invalid);
  let preferences: Preferences | null = null;
  if (json.preferences !== undefined) {
    const result = validatePreferences(json.preferences);
    if (typeof result === 'string') {
      invalid.push({ collection: 'preferences', index: 0, field: result, problem: 'invalid' });
    } else {
      preferences = result;
    }
  }
  return {
    ok: true,
    value: {
      version,
      exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : null,
      appVersion:
        isObject(json.app) && typeof json.app.version === 'string' ? json.app.version : null,
      sessions,
      attempts,
      pieces,
      pieceSteps,
      scaleRuns,
      answers,
      takes,
      assignments,
      lessons,
      preferences,
      invalid,
    },
  };
}

export interface ImportCounts {
  /** Not stored yet; will be added. (A lesson stored with a later time counts: it takes the file's.) */
  new: number;
  /** Stored already (same id); kept as stored. */
  present: number;
  invalid: number;
}

export type ImportPlan = Record<Collection, ImportCounts>;

export function planImport(
  parsed: ParsedImport,
  existing: {
    sessionIds: ReadonlySet<string>;
    attemptIds: ReadonlySet<string>;
    pieceIds: ReadonlySet<string>;
    pieceStepIds: ReadonlySet<string>;
    scaleRunIds: ReadonlySet<string>;
    answerIds: ReadonlySet<string>;
    takeIds: ReadonlySet<string>;
    /** Of every stored record, the deleted ones' too: those are not added again. */
    assignmentIds: ReadonlySet<string>;
    /** The lessons finished here: one of the file counts as new when it would change them. */
    lessons: readonly LessonDone[];
  },
): ImportPlan {
  const count = (
    records: readonly { id: string }[],
    ids: ReadonlySet<string>,
    collection: Collection,
  ): ImportCounts => {
    const present = records.filter((r) => ids.has(r.id)).length;
    return {
      new: records.length - present,
      present,
      invalid: parsed.invalid.filter((i) => i.collection === collection).length,
    };
  };
  // A tick is added when it is not stored, and an earlier time replaces a later one.
  const storedLessons = new Map(existing.lessons.map((record) => [record.slug, record]));
  const newLessons = parsed.lessons.filter((record) =>
    replacesLesson(record, storedLessons.get(record.slug)),
  ).length;
  return {
    sessions: count(parsed.sessions, existing.sessionIds, 'sessions'),
    attempts: count(parsed.attempts, existing.attemptIds, 'attempts'),
    pieces: count(parsed.pieces, existing.pieceIds, 'pieces'),
    pieceSteps: count(parsed.pieceSteps, existing.pieceStepIds, 'pieceSteps'),
    scaleRuns: count(parsed.scaleRuns, existing.scaleRunIds, 'scaleRuns'),
    answers: count(parsed.answers, existing.answerIds, 'answers'),
    takes: count(parsed.takes, existing.takeIds, 'takes'),
    assignments: count(parsed.assignments, existing.assignmentIds, 'assignments'),
    lessons: {
      new: newLessons,
      present: parsed.lessons.length - newLessons,
      invalid: parsed.invalid.filter((i) => i.collection === 'lessons').length,
    },
  };
}
