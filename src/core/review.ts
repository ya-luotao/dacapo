// The review schedule of a piece (docs/PIECES.md, "Review schedule"): once played to the end, a
// piece comes back for review after an interval that grows while its runs go well. Computed from
// the sessions and step records alone, so it follows them through sync and import; only "taken out
// of review" is stored, with the piece.

import { IDLE_MS } from './activity.ts';
import type { PieceSessionRecord } from './log.ts';
import { isPassed, type PieceFacts, type PieceStep } from './pieceRecords.ts';
import { barStats, bySlowest, type BarStat } from './pieceRun.ts';
import type { HandSelection } from './score.ts';
import { median } from './session.ts';
import { addDays, dayKey, type DayKey } from './streak.ts';

/** The intervals between reviews, in days: one step up after a good run. */
export const REVIEW_INTERVALS = [1, 2, 4, 7, 14, 30, 60] as const;
/** A good run: at most one wrong or missed note per this many notes… */
export const CLEAN_NOTES = 50;
/** …in rhythm mode with at least this share of its notes in time… */
export const IN_TIME_SHARE = 0.8;
/** …and in wait mode no bar slower (per step) than this many times the run's median step. */
export const SLOW_BAR = 2;
/** A poor run: more than one wrong or missed note in this many. */
export const POOR_NOTES = 10;

/** How a run to the end moves the interval: up a step, kept, or down a step (halved). */
export type ReviewGrade = 'better' | 'same' | 'worse';

/** A run of the whole piece, played to the end. */
export interface ReviewRun {
  sessionId: string;
  /** Epoch ms of its end, and its local calendar day. */
  endedAt: number;
  day: DayKey;
  grade: ReviewGrade;
  /** It moved the schedule: the first run, or the first one on or after the date then due. */
  counted: boolean;
}

export interface ReviewSchedule {
  /** Every run to the end, oldest first; the ones before a date count only for the figures. */
  runs: ReviewRun[];
  /** Index into `REVIEW_INTERVALS`, and the interval in days. */
  stage: number;
  interval: number;
  /** The run that set the date. */
  last: ReviewRun;
  /** The next review: the day the piece is due. */
  due: DayKey;
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: DayKey, b: DayKey): number {
  const utc = (day: DayKey) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d);
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** The hands of a run that plays the whole piece: both, or the only hand that has notes. */
export function playsEveryNote(hands: HandSelection, facts: Pick<PieceFacts, 'bars'>): boolean {
  if (hands === 'both') return true;
  return facts.bars[hands === 'right' ? 'left' : 'right'] === 0;
}

/**
 * A run through everything its hands play: completed, without a loop, in the written key, and
 * (when its step records are here) through every bar those hands play. A run in another key is
 * practice at transposing, not a run of the piece as written.
 */
export function isWholeRun(
  session: Pick<PieceSessionRecord, 'completed' | 'loop' | 'transpose' | 'hands'>,
  steps: readonly Pick<PieceStep, 'measure'>[] | undefined,
  facts: Pick<PieceFacts, 'bars'>,
): boolean {
  if (!session.completed || session.loop !== null || session.transpose !== undefined) return false;
  if (!steps || steps.length === 0) return true;
  return new Set(steps.map((s) => s.measure)).size >= facts.bars[session.hands];
}

/** A run to the end: a whole run (`isWholeRun`) with hands that play every note of the piece. */
export function isRunToTheEnd(
  session: PieceSessionRecord,
  steps: readonly PieceStep[] | undefined,
  facts: Pick<PieceFacts, 'bars'>,
): boolean {
  return playsEveryNote(session.hands, facts) && isWholeRun(session, steps, facts);
}

/**
 * The bars that held a run up: those whose mean time per step is over `SLOW_BAR` times the run's
 * median step (each capped), the slowest first.
 */
export function slowBars(steps: readonly Pick<PieceStep, 'measure' | 'ms' | 'wrong'>[]): BarStat[] {
  const middle = median(steps.map((s) => Math.min(s.ms, IDLE_MS)));
  if (middle === null) return [];
  return barStats(steps)
    .filter((bar) => bar.meanMs > SLOW_BAR * middle)
    .sort(bySlowest);
}

/** No bar's mean time per step over `SLOW_BAR` times the run's median step (each capped). */
export function evenBars(steps: readonly Pick<PieceStep, 'measure' | 'ms' | 'wrong'>[]): boolean {
  return steps.length > 0 && slowBars(steps).length === 0;
}

/**
 * The grade of a run from its figures: its wrong and missed notes against the notes it is counted
 * against, and whether it was steady (in time in rhythm mode, no slow bar in wait mode).
 */
export function gradeFigures(errors: number, notes: number, steady: boolean): ReviewGrade {
  if (notes <= 0) return 'same';
  if (errors * POOR_NOTES > notes) return 'worse';
  return errors * CLEAN_NOTES <= notes && steady ? 'better' : 'same';
}

/**
 * How a run to the end went. Wrong and missed notes are counted against the notes it played: in
 * rhythm mode those due; in wait mode the piece's keys for its repeats (its step count when the
 * piece's facts do not have them yet, and for a run with a left hand made from the chord symbols,
 * whose keys the piece's facts do not count). A run whose step records are not here can keep the
 * interval, but not move it up.
 *
 * A run on a keyboard with fewer keys is graded on the notes the player had (docs/PERSONAL.md,
 * "The instrument's keys"): the notes played for them (`given`) come off the piece's keys, and
 * the steps passed, which took no time, are no part of the run's median step or of a bar's.
 */
export function gradeRun(
  session: PieceSessionRecord,
  steps: readonly PieceStep[] | undefined,
  facts: Pick<PieceFacts, 'notes'>,
): ReviewGrade {
  const rhythm = session.mode === 'rhythm' ? session.rhythm : undefined;
  const notes = rhythm ? rhythm.notes : runNotes(session, facts);
  const errors = session.wrong + (rhythm ? rhythm.notes - rhythm.hits : 0);
  const steady = rhythm
    ? rhythm.inTime >= IN_TIME_SHARE * rhythm.notes
    : Boolean(steps && evenBars(playedSteps(steps)));
  return gradeFigures(errors, notes, steady);
}

/** The steps of a run the player had a key of: those passed (`isPassed`) left out. */
export function playedSteps<T extends Pick<PieceStep, 'notes'>>(steps: readonly T[]): T[] {
  return steps.some(isPassed) ? steps.filter((s) => !isPassed(s)) : [...steps];
}

/**
 * The notes a run in wait or memory mode is counted against: the piece's keys for its repeats
 * without those played for the player, or its own steps when the piece's keys are not known (and
 * for a left hand made from the chord symbols).
 */
export function runNotes(
  session: Pick<PieceSessionRecord, 'leftHand' | 'repeats' | 'steps' | 'given'>,
  facts: Pick<PieceFacts, 'notes'>,
): number {
  const written = session.leftHand === undefined ? facts.notes?.[session.repeats] : undefined;
  return written === undefined ? session.steps : Math.max(0, written - (session.given ?? 0));
}

/**
 * The schedule of a piece from its sessions and step records (any order; other pieces' are left
 * out): null until it has been played to the end once. The first run to the end puts it in
 * review, due a day later; from then on the first run to the end on or after the date due moves
 * the interval (up a step, kept, or down a step) and sets the next date from its own day.
 */
export function reviewSchedule(
  pieceId: string,
  sessions: readonly PieceSessionRecord[],
  steps: readonly PieceStep[] | null,
  facts: Pick<PieceFacts, 'bars' | 'notes'>,
  timeZone?: string,
): ReviewSchedule | null {
  const bySession = new Map<string, PieceStep[]>();
  for (const s of steps ?? []) {
    if (s.pieceId !== pieceId) continue;
    const list = bySession.get(s.sessionId);
    if (list) list.push(s);
    else bySession.set(s.sessionId, [s]);
  }
  const ended = sessions
    .filter((s) => s.kind === 'piece' && s.pieceId === pieceId)
    .filter((s) => isRunToTheEnd(s, bySession.get(s.id), facts))
    .sort((a, b) => a.endedAt - b.endedAt || (a.id < b.id ? -1 : 1));
  if (ended.length === 0) return null;

  const runs: ReviewRun[] = [];
  let stage = 0;
  let due: DayKey | null = null;
  let last: ReviewRun | null = null;
  for (const session of ended) {
    const day = dayKey(session.endedAt, timeZone);
    const counted = due === null || day >= due;
    const grade = gradeRun(session, bySession.get(session.id), facts);
    const run: ReviewRun = { sessionId: session.id, endedAt: session.endedAt, day, grade, counted };
    runs.push(run);
    if (!counted) continue;
    if (due !== null) {
      if (grade === 'better') stage = Math.min(stage + 1, REVIEW_INTERVALS.length - 1);
      else if (grade === 'worse') stage = Math.max(stage - 1, 0);
    }
    due = addDays(day, REVIEW_INTERVALS[stage]!);
    last = run;
  }
  return { runs, stage, interval: REVIEW_INTERVALS[stage]!, last: last!, due: due! };
}

/** Where a piece stands today: due (and for how long), or not yet. */
export interface ReviewStatus {
  isDue: boolean;
  /** Days since its last review (the run that set the date). */
  since: number;
  /** Days past the date (0 on the day), or until it (negative). */
  overdue: number;
}

export function reviewStatus(schedule: ReviewSchedule, today: DayKey): ReviewStatus {
  const overdue = daysBetween(schedule.due, today);
  return { isDue: overdue >= 0, since: daysBetween(schedule.last.day, today), overdue };
}

/** Due pieces first, the longest overdue at the top; then by the next date. */
export function byReview(a: ReviewStatus, b: ReviewStatus): number {
  return Number(b.isDue) - Number(a.isDue) || b.overdue - a.overdue;
}
