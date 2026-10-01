// Assignments (docs/ASSIGNMENTS.md): what a teacher sets and a student ticks off, and the report
// that goes back. This file is the records themselves, plain data, with the few helpers the app
// needs at startup; how a task's progress is worked out is in assignments.ts, and how an
// assignment travels (the link, the file, reading either back) in assignmentShare.ts. Neither of
// those is loaded until an assignment is looked at.

import type { EarFamily } from './earItems.ts';
import type { HarmonyFamily } from './chordSymbols.ts';
import type { LoopRange, PracticeMode } from './pieceRecords.ts';
import type { RepeatMode } from './repeats.ts';
import type { RhythmEarFamily } from './rhythmEar.ts';
import type { ClickSettings } from './scaleClick.ts';
import type { HandSelection } from './score.ts';
import type { StoredPiece } from './storedPiece.ts';
import type { DayKey } from './streak.ts';
import type { TheoryFamily } from './theoryItems.ts';

// --- Limits --------------------------------------------------------------------------------------
// An assignment comes from a link or a file someone else made, and is synced as one record: every
// size is bounded, here and again wherever one is read.

export const MAX_TASKS = 100;
export const MAX_TITLE = 120;
export const MAX_NOTE = 2000;
export const MAX_NAME = 80;
/** A piece's title and composer, as the Pieces page allows them. */
export const MAX_PIECE_TEXT = 200;
/** A window is at most a year (and a day): start and due inclusive. */
export const MAX_WINDOW_DAYS = 366;
export const MAX_RUNS = 99;
export const MAX_MINUTES = 600;
/**
 * An assignment, serialized with its keys in order, is at most this many bytes; a report at most
 * `MAX_REPORT_BYTES`. A report carries every task of its assignment with its figures and the
 * minutes of every day, so the first limit is what keeps any assignment's report under the
 * second (assignmentShare.test.ts holds it), and the second is under the 64 KB a synced record may
 * have (docs/SYNC.md): what is stored can always be sent.
 */
export const MAX_ASSIGNMENT_BYTES = 24_000;
export const MAX_REPORT_BYTES = 60_000;
/** A task this version does not know is kept as it came, up to this many bytes serialized. */
export const MAX_UNKNOWN_TASK_BYTES = 2_000;

// --- Tasks ---------------------------------------------------------------------------------------

/** What a piece run is measured by: notes right, or (rhythm mode) notes in time. */
export type PieceMeasure = 'right' | 'inTime';

export interface PieceGoal {
  measure: PieceMeasure;
  /** At least this many of a hundred notes: 50–100. */
  percent: number;
}

/** Runs of a piece: its bars, hands, mode and tempo, and how many (and how well). */
export interface PieceTask {
  kind: 'piece';
  id: string;
  piece: {
    /** A built-in piece's id, or the id the piece has on the device that set the task. */
    id: string;
    /** As the teacher saw them: an imported piece has no other name on the student's device. */
    title: string;
    composer: string;
    /** `pieceChecksum` of its notes when the task was made: finds the same piece on any device. */
    checksum: string;
  };
  /** Written bars, with their printed numbers; null: the whole piece. */
  bars: LoopRange | null;
  hands: HandSelection;
  mode: PracticeMode;
  /** Percent of the score's tempo, at least: 40–200 in tens. */
  tempo: number;
  runs: number;
  /** Absent: any run through the bars counts. */
  goal?: PieceGoal;
  /**
   * The steps one pass through the bars takes with these hands, the repeats played or skipped
   * (0: the bars are never played that way). A session's step records are divided by it, so three
   * times round a loop are three runs.
   */
  pass: Readonly<Record<RepeatMode, number>>;
}

/** Runs of a scale or a technique exercise: free, or with the click at a tempo. */
export interface ScaleTask {
  kind: 'scale';
  id: string;
  /** `exerciseKey`, e.g. `major:D:2:both`. */
  exercise: string;
  /** With the click: at least this tempo, with these notes to the beat. Null: at any tempo. */
  click: ClickSettings | null;
  runs: number;
}

/** What has levels: Read's cards, rhythm and sight-reading, Ear's families, Harmony's symbols. */
export type LevelFamily =
  'notes' | TheoryFamily | 'rhythm' | 'sight' | EarFamily | RhythmEarFamily | HarmonyFamily;

/** Sessions of a level, or its mastery. */
export interface LevelTask {
  kind: 'level';
  id: string;
  family: LevelFamily;
  /** The level's id in its family: `L3`, `RI2`, `R4`, `F1`, `I5`, `H2`. */
  level: string;
  /** A number of sessions played to their end, or the level mastered. */
  goal: number | 'mastery';
}

/** A lesson of Learn, read to its last exercise. */
export interface LessonTask {
  kind: 'lesson';
  id: string;
  slug: string;
}

/** Practice of any kind: at least `minutes` on at least `days` days. */
export interface MinutesTask {
  kind: 'minutes';
  id: string;
  minutes: number;
  days: number;
}

/**
 * A task this version cannot read (a kind added later, or a known kind naming something this
 * version does not have): kept as it came, shown as such, never met. A version that knows it reads
 * `raw` again.
 */
export interface UnknownTask {
  kind: 'unknown';
  id: string;
  raw: Readonly<Record<string, unknown>>;
}

export type KnownTask = PieceTask | ScaleTask | LevelTask | LessonTask | MinutesTask;
export type Task = KnownTask | UnknownTask;
export type TaskKind = KnownTask['kind'];
export const TASK_KINDS: readonly TaskKind[] = ['piece', 'scale', 'level', 'lesson', 'minutes'];

// --- The assignment ------------------------------------------------------------------------------

/** What is shared: a week's practice, as its maker wrote it. */
export interface Assignment {
  id: string;
  title: string;
  note: string;
  /** Whoever set it, as they typed it; never an account. May be empty. */
  teacher: string;
  /** The first and the last day that count, on the calendar of whoever practises. */
  start: DayKey;
  due: DayKey;
  tasks: Task[];
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms of the last change: of two copies of an assignment the later one is the newer. */
  updatedAt: number;
}

// --- Progress and the report ---------------------------------------------------------------------

/** A run of a piece (one pass through the task's bars), as the checklist and a report show it. */
export interface PieceRunFigures {
  /** Epoch ms of its last note. */
  at: number;
  /** Percent of the score's tempo it was played at. */
  tempo: number;
  /** The share of its notes right, 0–1; null when it had none. */
  right: number | null;
  /** Rhythm mode: the share of its notes in time, 0–1; null in the other modes. */
  inTime: number | null;
}

export interface ScaleRunFigures {
  /** Epoch ms of its first key. */
  at: number;
  /** How uneven its notes were in time, ms (the weaker hand's); null when not measured. */
  spread: number | null;
  /** With the click: its tempo. */
  bpm: number | null;
}

export interface SessionFigures {
  /** Epoch ms of its start. */
  at: number;
  /** The share of its answers right, 0–1; null when it has none. */
  accuracy: number | null;
}

/** Where a level stands against its mastery. */
export interface MasteryFigures {
  /** Answers counted of the `window` mastery is judged on. */
  counted: number;
  window: number;
  accuracy: number | null;
}

/**
 * How far a task is: `done` of `target` (runs, sessions or days; 1 for a lesson or for mastery),
 * and the figures behind it. The checklist and the report are both made of these.
 */
export type TaskProgress =
  | {
      kind: 'piece';
      done: number;
      target: number;
      met: boolean;
      /** Runs through the bars, whether or not they reached the goal. */
      played: number;
      /** The run nearest the goal, and the latest one. */
      best: PieceRunFigures | null;
      last: PieceRunFigures | null;
    }
  | {
      kind: 'scale';
      done: number;
      target: number;
      met: boolean;
      /** The most even run, and the latest one. */
      best: ScaleRunFigures | null;
      last: ScaleRunFigures | null;
    }
  | {
      kind: 'level';
      done: number;
      target: number;
      met: boolean;
      /** The session with most right, and the latest one. */
      best: SessionFigures | null;
      last: SessionFigures | null;
      /** When the goal is mastery. */
      mastery: MasteryFigures | null;
    }
  | { kind: 'lesson'; done: number; target: number; met: boolean }
  | { kind: 'minutes'; done: number; target: number; met: boolean }
  | { kind: 'unknown'; done: number; target: number; met: boolean };

/** A task as a report carries it: the task itself (its goal) and how far it got. */
export interface TaskReport {
  task: Task;
  progress: TaskProgress;
}

/** What goes back to the teacher: figures only, per task, and the minutes of each day. */
export interface Report {
  id: string;
  /** The assignment it answers, and that assignment's `updatedAt` when the report was made. */
  assignmentId: string;
  assignmentVersion: number;
  /** The assignment's title and window, so the report reads on its own too. */
  title: string;
  start: DayKey;
  due: DayKey;
  /** Whoever practised, as they typed it. May be empty. */
  from: string;
  note: string;
  /** Epoch ms. */
  createdAt: number;
  /** One per task of the assignment, in its order. */
  tasks: TaskReport[];
  /**
   * Whole minutes practised on each day from `start` on (the first is the start day's), as far
   * as the day the report was made, the due day at most; 0 for a day without practice.
   */
  days: number[];
}

// --- As stored -----------------------------------------------------------------------------------
// One store, `assignments`, and one sync collection hold assignments and kept reports, each under
// its own id. The later copy wins by `updatedAt`; deleting leaves the record in place with
// `deleted`, so the deletion syncs like any other change and the same link can be added again.

export interface StoredAssignment {
  /** The assignment's id. */
  id: string;
  type: 'assignment';
  assignment: Assignment;
  /** Made here: listed under "Set by me", and it can be edited. */
  made: boolean;
  /** Listed under "For me": its checklist is worked out from the records on this account. */
  following: boolean;
  /** Epoch ms: when it was made or added here. */
  addedAt: number;
  /** Epoch ms of the last change of this record (docs/SYNC.md): the later copy wins. */
  updatedAt: number;
}

/** A report a teacher kept, listed under the assignment it answers. */
export interface StoredReport {
  /** The report's id. */
  id: string;
  type: 'report';
  report: Report;
  addedAt: number;
  updatedAt: number;
}

/** An assignment or a report that was deleted: what is left of it. */
export interface DeletedAssignmentRecord {
  id: string;
  type: 'assignment' | 'report';
  deleted: true;
  updatedAt: number;
}

export type LiveAssignmentRecord = StoredAssignment | StoredReport;
/** A record as it is handed to the store, which gives it its `updatedAt`. */
export type AssignmentRecordDraft =
  Omit<StoredAssignment, 'updatedAt'> | Omit<StoredReport, 'updatedAt'>;
export type AssignmentRecord = LiveAssignmentRecord | DeletedAssignmentRecord;

export const isDeletedRecord = (record: AssignmentRecord): record is DeletedAssignmentRecord =>
  'deleted' in record;

/** The assignments stored and not deleted. */
export function storedAssignments(records: readonly AssignmentRecord[]): StoredAssignment[] {
  return records.filter((r): r is StoredAssignment => r.type === 'assignment' && !('deleted' in r));
}

/** The kept reports, the latest first. */
export function storedReports(records: readonly AssignmentRecord[]): StoredReport[] {
  return records
    .filter((r): r is StoredReport => r.type === 'report' && !('deleted' in r))
    .sort((a, b) => b.report.createdAt - a.report.createdAt || (a.id < b.id ? -1 : 1));
}

/**
 * The version for a change made now: later than the stored copy's (a deleted one's too), even on
 * a device whose clock is behind the one that made the last change.
 */
export const nextRecordVersion = (stored: AssignmentRecord | undefined, now: number): number =>
  stored ? Math.max(now, stored.updatedAt + 1) : now;

/** By id, the order every list of records is kept in. */
export function byRecordId(a: AssignmentRecord, b: AssignmentRecord): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Soonest due first, then the one set first. */
export function byDue(a: StoredAssignment, b: StoredAssignment): number {
  return (
    (a.assignment.due < b.assignment.due ? -1 : a.assignment.due > b.assignment.due ? 1 : 0) ||
    a.assignment.createdAt - b.assignment.createdAt ||
    (a.id < b.id ? -1 : 1)
  );
}

/**
 * The assignments "for me" that today falls in (from their start to their due date), soonest due
 * first: the first is the current one, whose open tasks the home page shows.
 */
export function currentAssignments(
  records: readonly AssignmentRecord[],
  today: DayKey,
): StoredAssignment[] {
  return storedAssignments(records)
    .filter((r) => r.following && r.assignment.start <= today && today <= r.assignment.due)
    .sort(byDue);
}

/** An imported piece as an assignment file carries it: what importing it kept, and its MusicXML. */
export type SharedPiece = Pick<
  StoredPiece,
  'id' | 'title' | 'composer' | 'fileName' | 'xml' | 'hands' | 'warnings'
>;
