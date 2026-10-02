// Your week (docs/PERSONAL.md, "Your week"): what a week of the owner's calendar came to. Facts,
// not trends (trends.ts has those): the days practised and the time, each against the week
// before, then what happened, the most telling first. Worked out from the records by their
// times, as the state at the week's end against the state at its start, the way today's plan is
// made from the records before today (today.ts). Pure, and nothing is stored. Loaded with
// Progress and with the home page's plan, never with the start: it takes every practice's
// mastery rule.

import type { LevelFamily } from './assignmentRecords.ts';
import {
  LEVEL_FAMILIES,
  levelsMastered,
  levelsOfFamily,
  untilDue,
  type ProgressInput,
} from './assignments.ts';
import {
  CURRICULUM_LESSONS,
  isOpen,
  practised,
  sessionPractice,
  type Practice,
} from './curriculum.ts';
import type { PieceSessionRecord, SessionRecord } from './log.ts';
import { reviewSchedule } from './review.ts';
import { exerciseKeyParts, SCALE_TYPES } from './scaleTypes.ts';
import type { HandSelection } from './score.ts';
import type { StartingPoint } from './startingPoint.ts';
import { addDays, dailyTotals, dayOfWeek, weekStart, type DayKey } from './streak.ts';
import { tempoLadder } from './tempoLadder.ts';
import { recordsBefore, type TodayRecords } from './today.ts';

// --- The week ------------------------------------------------------------------------------------

/** The days of a week that are counted: all seven, or those so far of the week under way. */
export interface WeekSpan {
  /** Its first day, and the last one counted. */
  start: DayKey;
  end: DayKey;
  /** How many days that is: 7 for a week that ended. */
  days: number;
}

/** The week that ended before the one `today` is in: the owner's week, as the year grid has it. */
export function lastWeek(today: DayKey, firstDay: number): WeekSpan {
  const start = addDays(weekStart(today, firstDay), -7);
  return { start, end: addDays(start, 6), days: 7 };
}

/** The week under way, as far as it has got: from its first day to `today`. */
export function weekSoFar(today: DayKey, firstDay: number): WeekSpan {
  return { start: weekStart(today, firstDay), end: today, days: dayOfWeek(today, firstDay) + 1 };
}

// --- What happened -------------------------------------------------------------------------------

/** A lesson ticked, and when (epoch ms); 0 when the time is not known (a tick from before times were kept). */
export interface LessonTick {
  slug: string;
  doneAt: number;
}

/** What time can go to: every practice that can be proposed, and the two that never are. */
export type RecapPractice = Practice | 'free' | 'improv';

/** In the order of the contents: the families as their pages list them, then playing. */
const PRACTICES: readonly Practice[] = [...LEVEL_FAMILIES, 'scales', 'pieces'];
const RECAP_PRACTICES: readonly RecapPractice[] = [...PRACTICES, 'free', 'improv'];

/**
 * One line of a week, by what happened. The kinds are in a fixed order, the most telling first
 * (`RECAP_KINDS`): what was finished or mastered, then what the pieces and scales came to, then
 * where the time went.
 */
export type RecapLine =
  /** Lessons finished in the week, in the lessons' order. */
  | { kind: 'lessons'; lessons: string[] }
  /** Levels mastered at the week's end that were not at its start, in the pages' order. */
  | { kind: 'levels'; levels: { family: LevelFamily; level: string }[] }
  /** Tunes learnt, likewise: a tune is the level of its family, said as the app says it. */
  | { kind: 'tunes'; tunes: string[] }
  /** Pieces that came into review: played to their end for the first time. */
  | { kind: 'reviewIn'; pieces: string[] }
  /** Pieces whose interval between reviews grew or shrank, with the interval now, in days. */
  | { kind: 'reviewUp' | 'reviewBack'; pieces: { id: string; interval: number }[] }
  /** Pieces brought to a higher tempo: clean and in time at it, for those hands (tempoLadder.ts). */
  | { kind: 'tempo'; pieces: { id: string; hands: HandSelection; tempo: number }[] }
  /** Scales and arpeggios with their first run ever, in the order first played. */
  | { kind: 'scales'; exercises: string[] }
  /** The practice that had most of the week's time. */
  | { kind: 'most'; practice: RecapPractice; ms: number }
  /** A practice that is open and had none of it. */
  | { kind: 'none'; practice: Practice };

export type RecapKind = RecapLine['kind'];

/** The fixed order of the lines: the most telling first. */
export const RECAP_KINDS: readonly RecapKind[] = [
  'lessons',
  'levels',
  'tunes',
  'reviewIn',
  'reviewUp',
  'reviewBack',
  'tempo',
  'scales',
  'most',
  'none',
];
/** A week has at most this many lines: the first of them in the order above. */
export const RECAP_LINES = 6;

export interface WeekFigures {
  /** Days with any practice, and the active time of the sessions begun on them. */
  practised: number;
  ms: number;
}

export interface WeekRecap extends WeekSpan, WeekFigures {
  /**
   * The same figures of the week before, to set these against. Null when nothing was practised
   * before the week began (a first week), and for the week under way, whose week before is the
   * whole week beside it.
   */
  before: WeekFigures | null;
  lines: RecapLine[];
}

export interface RecapOptions {
  today: DayKey;
  /** The first day of the owner's week (1 Monday … 7 Sunday). */
  firstDay: number;
  /** Every lesson ticked, with its time. */
  lessons: readonly LessonTick[];
  /** An IANA name; the system zone when omitted. */
  timeZone?: string;
  /** What the visitor said of themselves on the start page (docs/START.md); none when omitted. */
  start?: StartingPoint | null;
}

// --- The state at a moment -----------------------------------------------------------------------

const LEVELS: readonly { family: LevelFamily; level: string }[] = LEVEL_FAMILIES.flatMap((family) =>
  levelsOfFamily(family).map((level) => ({ family, level })),
);

const HANDS: readonly HandSelection[] = ['both', 'right', 'left'];

/** Where things stood when a day began: the records from before it, and what they came to. */
interface Moment {
  records: TodayRecords;
  /** The lessons ticked by then; a tick without a time is from before anything else. */
  lessonsDone: ReadonlySet<string>;
  /** Anything practised by then: a session, an answer. */
  begun: boolean;
  /** Whether each of `LEVELS` was mastered, by the rule of its own page. */
  mastered: () => readonly boolean[];
  byPiece: () => ReadonlyMap<string, PieceSessionRecord[]>;
}

function once<T>(compute: () => T): () => T {
  let value: { is: T } | null = null;
  return () => (value ??= { is: compute() }).is;
}

function sessionsByPiece(sessions: readonly SessionRecord[]): Map<string, PieceSessionRecord[]> {
  const byPiece = new Map<string, PieceSessionRecord[]>();
  for (const session of sessions) {
    if (session.kind !== 'piece') continue;
    const list = byPiece.get(session.pieceId);
    if (list) list.push(session);
    else byPiece.set(session.pieceId, [session]);
  }
  return byPiece;
}

/** The state when `day` began, from the records before it: a session goes by the day it began. */
function momentAt(records: TodayRecords, day: DayKey, options: RecapOptions): Moment {
  const { timeZone } = options;
  const before = recordsBefore(records, day, timeZone);
  const until = untilDue(addDays(day, -1), timeZone);
  const lessonsDone = new Set(options.lessons.filter((l) => until(l.doneAt)).map((l) => l.slug));
  const { sessions, attempts, answers } = before;
  const input: ProgressInput = { sessions, attempts, answers, pieces: [], lessonsDone, timeZone };
  return {
    records: before,
    lessonsDone,
    begun: sessions.length > 0 || attempts.length > 0 || answers.length > 0,
    mastered: once(() => levelsMastered(LEVELS, day, input)),
    byPiece: once(() => sessionsByPiece(sessions)),
  };
}

// --- A week --------------------------------------------------------------------------------------

/** The practice a session's time goes to: the one it belongs to, or free play, or Improvise. */
function practiceOf(session: SessionRecord): RecapPractice | null {
  if (session.kind === 'free') return 'free';
  if (session.kind === 'improv') return 'improv';
  return sessionPractice(session);
}

function figures(
  totals: ReadonlyMap<DayKey, number>,
  { start, days }: Pick<WeekSpan, 'start' | 'days'>,
): WeekFigures {
  let practised = 0;
  let ms = 0;
  for (let i = 0; i < days; i++) {
    const day = totals.get(addDays(start, i)) ?? 0;
    if (day > 0) practised++;
    ms += day;
  }
  return { practised, ms };
}

/**
 * What a week came to: `from` is the state when its first day began, `to` the state when the day
 * after its last began. `whole` is a week that ended: only such a week is set against the week
 * before, and says which open practice had no time (the week under way is not over).
 */
function recapOf(
  records: TodayRecords,
  span: WeekSpan,
  from: Moment,
  to: Moment,
  whole: boolean,
  options: RecapOptions,
): WeekRecap {
  const { timeZone, start = null } = options;
  const beforeStart = untilDue(addDays(span.start, -1), timeZone);
  const untilEnd = untilDue(span.end, timeZone);
  const inWeek = (at: number) => !beforeStart(at) && untilEnd(at);
  const totals = dailyTotals(records.sessions, timeZone);
  const week = figures(totals, span);
  const lines: RecapLine[] = [];

  // Lessons finished: a tick whose time is in the week. One without a time never counts.
  const lessons = CURRICULUM_LESSONS.filter((slug) =>
    options.lessons.some((l) => l.slug === slug && l.doneAt > 0 && inWeek(l.doneAt)),
  );
  if (lessons.length > 0) lines.push({ kind: 'lessons', lessons });

  // Levels mastered, and tunes learnt: mastered at the week's end and not at its start.
  const [was, is] = [from.mastered(), to.mastered()];
  const gained = LEVELS.filter((_, i) => is[i] && !was[i]);
  const levels = gained.filter((l) => l.family !== 'tune');
  const tunes = gained.filter((l) => l.family === 'tune').map((l) => l.level);
  if (levels.length > 0) lines.push({ kind: 'levels', levels });
  if (tunes.length > 0) lines.push({ kind: 'tunes', tunes });

  // The pieces practised in the week: what their runs did to the review, and to the tempo.
  const reviewIn: string[] = [];
  const reviewUp: { id: string; interval: number }[] = [];
  const reviewBack: { id: string; interval: number }[] = [];
  const tempo: { id: string; hands: HandSelection; tempo: number }[] = [];
  for (const piece of records.pieces) {
    const before = from.byPiece().get(piece.id) ?? [];
    const after = to.byPiece().get(piece.id) ?? [];
    // An imported piece whose facts are not kept yet waits, as on the Pieces page.
    const { facts } = piece;
    if (after.length === before.length || !facts) continue;
    const stepsBefore = from.records.steps?.get(piece.id) ?? null;
    const stepsAfter = to.records.steps?.get(piece.id) ?? null;
    if (!piece.out) {
      const a = reviewSchedule(piece.id, before, stepsBefore, facts, timeZone);
      const b = reviewSchedule(piece.id, after, stepsAfter, facts, timeZone);
      if (b && !a) reviewIn.push(piece.id);
      else if (a && b && b.stage > a.stage) reviewUp.push({ id: piece.id, interval: b.interval });
      else if (a && b && b.stage < a.stage) reviewBack.push({ id: piece.id, interval: b.interval });
    }
    // The ladder of each hands a rhythm run of the week was played with. A piece is named once:
    // with both hands when their ladder went up, else with the hand that got further.
    const old = new Set(before.map((s) => s.id));
    const played = new Set(
      after.filter((s) => s.mode === 'rhythm' && !old.has(s.id)).map((s) => s.hands),
    );
    const reached = HANDS.filter((hands) => played.has(hands)).flatMap((hands) => {
      const then = tempoLadder(piece.id, hands, before, stepsBefore, facts).reached;
      const now = tempoLadder(piece.id, hands, after, stepsAfter, facts).reached;
      return now !== null && now > (then ?? 0) ? [{ id: piece.id, hands, tempo: now }] : [];
    });
    const best =
      reached.find((r) => r.hands === 'both') ??
      reached.reduce<(typeof reached)[number] | null>(
        (a, b) => (a === null || b.tempo > a.tempo ? b : a),
        null,
      );
    if (best) tempo.push(best);
  }
  if (reviewIn.length > 0) lines.push({ kind: 'reviewIn', pieces: reviewIn });
  if (reviewUp.length > 0) lines.push({ kind: 'reviewUp', pieces: reviewUp });
  if (reviewBack.length > 0) lines.push({ kind: 'reviewBack', pieces: reviewBack });
  if (tempo.length > 0) lines.push({ kind: 'tempo', pieces: tempo });

  // Scales and arpeggios played for the first time: a run in the week, and none before it.
  // Technique is left out, as the scales' trend leaves it out (docs/PROGRESS.md).
  const known = new Set<string>();
  for (const session of from.records.sessions) {
    if (session.kind === 'scale') for (const run of session.runs) known.add(run.exercise);
  }
  const first = new Map<string, number>();
  for (const session of to.records.sessions) {
    if (session.kind !== 'scale') continue;
    for (const run of session.runs) {
      if (known.has(run.exercise)) continue;
      const type = exerciseKeyParts(run.exercise)?.type;
      if (!(SCALE_TYPES as readonly (string | undefined)[]).includes(type)) continue;
      first.set(run.exercise, Math.min(first.get(run.exercise) ?? Infinity, run.startedAt));
    }
  }
  const exercises = [...first]
    .sort(([a, at], [b, bt]) => at - bt || (a < b ? -1 : 1))
    .map(([exercise]) => exercise);
  if (exercises.length > 0) lines.push({ kind: 'scales', exercises });

  // Where the time went: a session's time goes to the day it began, as the practice log has it.
  const time = new Map<RecapPractice, number>();
  for (const session of records.sessions) {
    const practice = practiceOf(session);
    if (practice === null || session.activeMs <= 0 || !inWeek(session.startedAt)) continue;
    time.set(practice, (time.get(practice) ?? 0) + session.activeMs);
  }
  // With one practice only, "most of the time" would say the week's time again.
  if (time.size > 1) {
    const most = RECAP_PRACTICES.filter((p) => time.has(p)).reduce((a, b) =>
      time.get(b)! > time.get(a)! ? b : a,
    );
    lines.push({ kind: 'most', practice: most, ms: time.get(most)! });
  }

  // The open practice that had none: the one left alone longest, one never practised before all
  // others, equals in the order of the contents (the turn a family takes in today's plan). A
  // family mastered throughout has nothing left to propose and is passed over.
  if (whole && week.ms > 0) {
    const { sessions, attempts, answers } = to.records;
    const had = practised({
      sessions,
      attempts,
      answers,
      imported: records.pieces.some((piece) => piece.grade === null),
    });
    const lastAt = new Map<Practice, number>();
    for (const session of sessions) {
      const practice = sessionPractice(session);
      if (practice === null) continue;
      lastAt.set(practice, Math.max(lastAt.get(practice) ?? -Infinity, session.startedAt));
    }
    const left = LEVELS.reduce(
      (set, l, i) => (is[i] ? set : set.add(l.family)),
      new Set<Practice>(['scales', 'pieces']),
    );
    const none = PRACTICES.filter(
      (p) => left.has(p) && !time.has(p) && isOpen(p, to.lessonsDone, had, start),
    ).sort((a, b) => (lastAt.get(a) ?? -Infinity) - (lastAt.get(b) ?? -Infinity))[0];
    if (none !== undefined) lines.push({ kind: 'none', practice: none });
  }

  return {
    ...span,
    ...week,
    before:
      whole && from.begun ? figures(totals, { start: addDays(span.start, -7), days: 7 }) : null,
    lines: lines.slice(0, RECAP_LINES),
  };
}

/**
 * The week that ended, from the state the week under way began in (`began`). Null when nothing
 * was practised and no lesson finished before then: there is no last week to speak of yet.
 */
function endedRecap(records: TodayRecords, options: RecapOptions, began: Moment): WeekRecap | null {
  const ended = lastWeek(options.today, options.firstDay);
  const untilEnd = untilDue(ended.end, options.timeZone);
  const finished = options.lessons.some((l) => l.doneAt > 0 && untilEnd(l.doneAt));
  if (!began.begun && !finished) return null;
  return recapOf(records, ended, momentAt(records, ended.start, options), began, true, options);
}

/** The week that ended, alone: what the home page's line says of it. */
export function lastWeekRecap(records: TodayRecords, options: RecapOptions): WeekRecap | null {
  const began = momentAt(records, weekStart(options.today, options.firstDay), options);
  return endedRecap(records, options, began);
}

/**
 * The week that ended and the week under way so far, side by side on Progress. The first runs
 * from one moment to the next, the second from there to now.
 */
export function weekRecaps(
  records: TodayRecords,
  options: RecapOptions,
): { last: WeekRecap | null; current: WeekRecap } {
  const underWay = weekSoFar(options.today, options.firstDay);
  const began = momentAt(records, underWay.start, options);
  const now = momentAt(records, addDays(options.today, 1), options);
  return {
    last: endedRecap(records, options, began),
    current: recapOf(records, underWay, began, now, false, options),
  };
}
