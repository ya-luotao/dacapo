// Today (docs/TODAY.md): a short plan for the day made from the player's own records, and where
// every practice stands. Each practice already says what comes next on its own page (a level
// marked Suggested, the scale to play next, the pieces due for review); this puts them together.
// Pure: the same records give the same plan on every device, and nothing new is stored for it.
// Loaded apart from the start (it takes every practice's mastery rule), and without the
// exercises' rules (core/scales.ts): a scale is an exercise key here, nothing more.

import type { Answer } from './answers.ts';
import type { LevelFamily, Task, TaskProgress } from './assignmentRecords.ts';
import {
  assignmentProgress,
  isLevelFamily,
  LEVEL_FAMILIES,
  levelsMastered,
  levelsOfFamily,
  openTasks,
  untilDue,
  type ProgressInput,
} from './assignments.ts';
import {
  CURRICULUM_LESSONS,
  isOpen,
  lessonNumber,
  nextLesson,
  nextPiece,
  nextRung,
  OPENS_WITH,
  practised,
  sessionPractice,
  type CurriculumPiece,
  type Practice,
} from './curriculum.ts';
import type { PieceSessionRecord, SessionRecord } from './log.ts';
import { firstNotMastered } from './mastery.ts';
import type { PieceFacts, PieceStep } from './pieceRecords.ts';
import { byReview, daysBetween, isRunToTheEnd, reviewSchedule, reviewStatus } from './review.ts';
import {
  playedLately,
  RECENT_RUNS,
  scaleProgress,
  SUGGEST_DAYS,
  weakestLately,
} from './scaleRanking.ts';
import { exerciseKeyParts } from './scaleTypes.ts';
import type { Attempt } from './session.ts';
import { opensEverything, readingFloor, type StartingPoint } from './startingPoint.ts';
import { addDays, dayKey, type DayKey } from './streak.ts';
import {
  DEFAULT_PLAN_MINUTES,
  isPlanMinutes,
  PLAN_COUNTS,
  PLAN_MINUTES,
  PLAN_PARTS,
  planRows,
  type PlanMinutes,
  type PlanPart,
  type PlanStep,
  type PlanTask,
  type PlanWhy,
  type TodayPlan,
} from './todayRecords.ts';

// --- The records ---------------------------------------------------------------------------------

/** A piece on this device, with what the plan needs of it. */
export interface TodayPiece extends CurriculumPiece {
  /**
   * Its bar and note counts: a run to the end and the review schedule are told by them. Null for
   * an imported piece whose facts are not kept yet (they are when it is next listed).
   */
  facts: Pick<PieceFacts, 'bars' | 'notes'> | null;
  /** Taken out of review. */
  out: boolean;
}

/** The records the plan is made from and ticked by: those of whoever practises. */
export interface TodayRecords {
  sessions: readonly SessionRecord[];
  /** In the order they happened. */
  attempts: readonly Attempt[];
  /** In the order they happened. */
  answers: readonly Answer[];
  /**
   * Step records by piece id, for the pieces whose records are loaded: a run to the end is told
   * by them (every bar played); without them, by its session alone.
   */
  steps?: ReadonlyMap<string, readonly PieceStep[]>;
  /** Every piece here: the built-in ones in the library's order, then the imported ones. */
  pieces: readonly TodayPiece[];
}

// --- Where every practice stands -----------------------------------------------------------------

/** The piece in hand is looked for among those practised in the last this many calendar days. */
export const IN_HAND_DAYS = SUGGEST_DAYS;
/** A piece step is done with this much time on the piece today, or a run to its end. */
export const WORK_MS = 5 * 60_000;

export interface FamilyState {
  family: LevelFamily;
  open: boolean;
  /** The lesson that opens it (its slug); null for the one open from the start. */
  lesson: string | null;
  /** Its levels, and how many of them are mastered (a tune learnt counts as a level). */
  levels: number;
  mastered: number;
  /**
   * The family's own suggestion, its first level not mastered; null once all are. Read's notes
   * begin at the floor of a player's starting point, as on its page; once every level from the
   * floor on is mastered, the levels below it are what is left.
   */
  suggested: string | null;
  /** Epoch ms of the start of its latest session; null when it was never practised. */
  lastAt: number | null;
}

export interface ScalesState {
  open: boolean;
  /** Exercises with a recorded run. */
  played: number;
  /** The Scales page's own suggestion: the least even of those played lately; null without one. */
  weakest: string | null;
  /**
   * Every exercise played lately has the runs its figure is taken over (`RECENT_RUNS`): the
   * scales in hand have had their work, and a new one joins.
   */
  settled: boolean;
  /** The next rung of the ladder; null once every rung was played. */
  next: string | null;
}

export interface PiecesState {
  open: boolean;
  /** Pieces in review (those taken out are not), and the ones due, the longest overdue first. */
  inReview: number;
  due: { id: string; overdue: number }[];
  /** Per grade, the built-in pieces played to their end of those the grade has. */
  grades: { grade: number; played: number; of: number }[];
  /**
   * The piece in hand: the one practised most recently in the last `IN_HAND_DAYS` days that was
   * never played to its end, with the day it was last practised.
   */
  inHand: { id: string; day: DayKey } | null;
  /** The piece to begin when none is in hand; null when there is none to propose. */
  next: string | null;
}

/** How far each practice has got, and its next step: what Today is made from. */
export interface CurriculumState {
  /** Lessons ticked of the fifteen, and the first not ticked. */
  lessons: { done: number; of: number; next: string | null };
  /** Every family, in the order the pages list them (`LEVEL_FAMILIES`). */
  families: FamilyState[];
  scales: ScalesState;
  pieces: PiecesState;
}

export interface StateOptions {
  today: DayKey;
  /** The lessons ticked on this device (their slugs). */
  lessonsDone: ReadonlySet<string>;
  /** An IANA name; the system zone when omitted. */
  timeZone?: string;
  /**
   * What the visitor said of themselves on the start page (docs/START.md); none when omitted.
   * Someone who plays already has every practice open, no lesson in the plan, and Read's notes
   * suggested from where their reading begins.
   */
  start?: StartingPoint | null;
}

const utcNoon = (day: DayKey): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d, 12);
};

/** A whole run when the piece's facts are not here to tell: completed, no loop, as written. */
const wholeRun = (s: PieceSessionRecord): boolean =>
  s.completed && s.loop === null && s.transpose === undefined && s.hands === 'both';

/** The runs to the end among `sessions` of one piece, told by its facts and step records. */
function runsToTheEnd(
  piece: TodayPiece,
  sessions: readonly PieceSessionRecord[],
  steps: readonly PieceStep[] | undefined,
): PieceSessionRecord[] {
  const { facts } = piece;
  if (!facts) return sessions.filter(wholeRun);
  const bySession = new Map<string, PieceStep[]>();
  for (const step of steps ?? []) {
    const list = bySession.get(step.sessionId);
    if (list) list.push(step);
    else bySession.set(step.sessionId, [step]);
  }
  return sessions.filter((s) => isRunToTheEnd(s, bySession.get(s.id), facts));
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

function piecesState(
  records: TodayRecords,
  { today, lessonsDone, timeZone, start }: StateOptions,
  had: ReadonlySet<Practice>,
): PiecesState {
  const byPiece = sessionsByPiece(records.sessions);
  const finished = new Set<string>();
  const reviews: { id: string; isDue: boolean; since: number; overdue: number }[] = [];
  const grades = new Map<number, { grade: number; played: number; of: number }>();
  const lately = addDays(today, -(IN_HAND_DAYS - 1));
  let inHand: { id: string; at: number; day: DayKey } | null = null;

  for (const piece of records.pieces) {
    const sessions = byPiece.get(piece.id) ?? [];
    const steps = records.steps?.get(piece.id);
    if (runsToTheEnd(piece, sessions, steps).length > 0) finished.add(piece.id);
    if (piece.grade !== null) {
      let entry = grades.get(piece.grade);
      if (!entry) grades.set(piece.grade, (entry = { grade: piece.grade, played: 0, of: 0 }));
      entry.of++;
      if (finished.has(piece.id)) entry.played++;
    }
    if (piece.facts && !piece.out) {
      const schedule = reviewSchedule(piece.id, sessions, steps ?? null, piece.facts, timeZone);
      if (schedule) reviews.push({ id: piece.id, ...reviewStatus(schedule, today) });
    }
    if (finished.has(piece.id) || sessions.length === 0) continue;
    // Practised lately and never played to its end: the latest such piece is the one in hand.
    const at = Math.max(...sessions.map((s) => s.startedAt));
    const day = dayKey(at, timeZone);
    if (day >= lately && (inHand === null || at > inHand.at)) inHand = { id: piece.id, at, day };
  }

  const open = isOpen('pieces', lessonsDone, had, start);
  return {
    open,
    inReview: reviews.length,
    due: reviews
      .filter((r) => r.isDue)
      .sort(byReview)
      .map(({ id, overdue }) => ({ id, overdue })),
    grades: [...grades.values()].sort((a, b) => a.grade - b.grade),
    inHand: inHand && { id: inHand.id, day: inHand.day },
    next:
      inHand === null && open ? nextPiece(records.pieces, new Set(byPiece.keys()), finished) : null,
  };
}

/**
 * Where every practice stands on `today`, from the records given: lessons ticked, each family's
 * levels mastered and its suggestion, the scales played with the weakest lately and the next
 * rung, the pieces in review and due, and the piece in hand or the next one.
 */
export function curriculumState(records: TodayRecords, options: StateOptions): CurriculumState {
  const { today, lessonsDone, timeZone, start = null } = options;
  const { sessions, attempts, answers } = records;
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

  const input: ProgressInput = { sessions, attempts, answers, pieces: [], lessonsDone, timeZone };
  const levels = LEVEL_FAMILIES.flatMap((family) =>
    levelsOfFamily(family).map((level) => ({ family, level })),
  );
  const mastered = levelsMastered(levels, today, input);
  const families = LEVEL_FAMILIES.map((family): FamilyState => {
    const own = levels.flatMap((l, i) =>
      l.family === family ? [{ level: l.level, mastered: mastered[i]! }] : [],
    );
    return {
      family,
      open: isOpen(family, lessonsDone, had, start),
      lesson: OPENS_WITH[family],
      levels: own.length,
      mastered: own.filter((l) => l.mastered).length,
      // The levels below a player's floor are not counted as mastered: only passed over.
      suggested: firstNotMastered(own, family === 'notes' ? readingFloor(start) : null),
      lastAt: lastAt.get(family) ?? null,
    };
  });

  // The trend's days are not read here, so any hour of the day will do for the ranking's clock.
  const progress = scaleProgress(sessions, utcNoon(today), timeZone);
  const lately = playedLately(progress, today, timeZone);

  return {
    lessons: {
      done: CURRICULUM_LESSONS.filter((slug) => lessonsDone.has(slug)).length,
      of: CURRICULUM_LESSONS.length,
      next: nextLesson(lessonsDone),
    },
    families,
    scales: {
      open: isOpen('scales', lessonsDone, had, start),
      played: progress.length,
      weakest: weakestLately(progress, today, timeZone),
      settled: lately.every((p) => p.runs >= RECENT_RUNS),
      next: nextRung(new Set(progress.map((p) => p.exercise)), lessonsDone),
    },
    pieces: piecesState(records, options, had),
  };
}

// --- The plan ------------------------------------------------------------------------------------

/**
 * In the 10-minute plan, which has one new thing, the lesson takes the level's place while fewer
 * than this many lessons are ticked (the first weeks belong to the lessons) and is left out after.
 */
export const LESSON_FIRST = 7;

// The plan as plain data is in todayRecords.ts, with what the home page needs of it at startup.
export {
  DEFAULT_PLAN_MINUTES,
  isPlanMinutes,
  PLAN_COUNTS,
  PLAN_MINUTES,
  PLAN_PARTS,
  planRows,
  type PlanMinutes,
  type PlanPart,
  type PlanStep,
  type PlanTask,
  type PlanWhy,
  type TodayPlan,
};

export interface PlanOptions extends StateOptions {
  minutes: PlanMinutes;
}

/** The records from before `today` began, on the player's calendar. */
function recordsBefore(records: TodayRecords, today: DayKey, timeZone?: string): TodayRecords {
  const before = untilDue(addDays(today, -1), timeZone);
  const sessions = records.sessions.flatMap((session): SessionRecord[] => {
    if (!before(session.startedAt)) return [];
    if (session.kind !== 'scale') return [session];
    // A scale session grows run by run: one begun before midnight keeps its runs from before.
    const runs = session.runs.filter((run) => before(run.startedAt));
    return runs.length === session.runs.length ? [session] : [{ ...session, runs }];
  });
  // A run's step records go with its session, whole.
  const kept = new Set(sessions.map((s) => s.id));
  const steps = new Map<string, readonly PieceStep[]>();
  for (const [piece, list] of records.steps ?? []) {
    steps.set(
      piece,
      list.filter((step) => kept.has(step.sessionId)),
    );
  }
  return {
    sessions,
    attempts: records.attempts.filter((a) => before(a.at)),
    answers: records.answers.filter((a) => before(a.at)),
    ...(records.steps && { steps }),
    pieces: records.pieces,
  };
}

/**
 * The plan for `today`: a warm-up, the piece in hand, something new and pieces to play through,
 * in the order of a session. It is made from the records before today began, so it does not
 * change as it is played: a level mastered at ten is still the step it was at nine
 * (`planProgress` ticks it). A part with nothing to propose is left out; the plan may be empty.
 */
export function todayPlan(records: TodayRecords, options: PlanOptions): TodayPlan {
  const before = recordsBefore(records, options.today, options.timeZone);
  return planOf(curriculumState(before, options), options);
}

/** The plan from where every practice stood when the day began: each part by its own rule. */
export function planOf(state: CurriculumState, options: PlanOptions): TodayPlan {
  const { today, minutes, lessonsDone, timeZone } = options;
  const counts = PLAN_COUNTS[minutes];
  const steps: PlanStep[] = [];
  const daysSince = (at: number) => daysBetween(dayKey(at, timeZone), today);

  // Warm-up: the scale to play next by the Scales page's own rule, or the next rung of the ladder
  // when there is no such scale or the scales in hand have had their work.
  const { weakest, next, settled } = state.scales;
  if (state.scales.open) {
    const scales = [weakest, next].flatMap((exercise) => exercise ?? []);
    if ((weakest === null || settled) && next !== null) scales.reverse();
    scales.slice(0, counts.warmup).forEach((exercise, i) => {
      steps.push({
        kind: 'task',
        id: `warmup-${i + 1}`,
        part: 'warmup',
        why: { kind: exercise === next ? 'nextScale' : 'weakest' },
        task: { kind: 'scale', id: `warmup-${i + 1}`, exercise, click: null, runs: 1 },
      });
    });
  }

  // Work: the piece in hand, or the next piece to begin.
  const { inHand } = state.pieces;
  if (inHand) {
    steps.push({
      kind: 'piece',
      id: 'work',
      part: 'work',
      why: { kind: 'inHand', days: daysBetween(inHand.day, today) },
      piece: inHand.id,
      goal: 'work',
    });
  } else if (state.pieces.next !== null) {
    steps.push({
      kind: 'piece',
      id: 'work',
      part: 'work',
      why: { kind: 'newPiece' },
      piece: state.pieces.next,
      goal: 'work',
    });
  }

  // New: the lesson, then the suggested levels of the families longest left alone. A stable sort
  // keeps equals in the order the pages list them. Someone who plays already is not proposed the
  // lessons (docs/START.md): Learn stays where it is.
  const lesson = opensEverything(options.start ?? null) ? null : state.lessons.next;
  const levels = state.families
    .filter((f) => f.open && f.suggested !== null)
    .sort((a, b) => (a.lastAt ?? -Infinity) - (b.lastAt ?? -Infinity));
  // The 10-minute plan has one new thing: the lesson in the first weeks, a level after.
  const short = minutes === 10;
  const lessonOnly = short && lesson !== null && state.lessons.done < LESSON_FIRST;
  if (lesson !== null && (!short || lessonOnly)) {
    steps.push({
      kind: 'task',
      id: 'new-lesson',
      part: 'new',
      why: { kind: 'lesson', n: lessonNumber(lesson), of: state.lessons.of },
      task: { kind: 'lesson', id: 'new-lesson', slug: lesson },
    });
  }
  levels.slice(0, lessonOnly ? 0 : counts.levels).forEach((f, i) => {
    steps.push({
      kind: 'task',
      id: `new-${i + 1}`,
      part: 'new',
      why: { kind: 'level', days: f.lastAt === null ? null : daysSince(f.lastAt) },
      task: { kind: 'level', id: `new-${i + 1}`, family: f.family, level: f.suggested!, goal: 1 },
    });
  });

  // Play through: the pieces due for review, the longest overdue first.
  state.pieces.due.slice(0, counts.play).forEach((due, i) => {
    steps.push({
      kind: 'piece',
      id: `play-${i + 1}`,
      part: 'play',
      why: { kind: 'due', days: due.overdue },
      piece: due.id,
      goal: 'through',
    });
  });

  return { day: today, minutes, steps, lessonsDone: [...lessonsDone].sort() };
}

/**
 * Which steps of the plan are done, in its order, from the records of its day: a scale by a run
 * of the exercise, a level by a session played to its end, the lesson by its tick (a task's own
 * rules, with the day as their window), a piece by a run to its end, the piece in hand also by
 * `WORK_MS` on it.
 */
export function planProgress(
  plan: TodayPlan,
  records: TodayRecords,
  { lessonsDone, timeZone }: Omit<StateOptions, 'today'>,
): boolean[] {
  const window = { start: plan.day, due: plan.day };
  const tasks = plan.steps.flatMap((step) => (step.kind === 'task' ? [step.task] : []));
  const { sessions, attempts, answers } = records;
  const input: ProgressInput = { sessions, attempts, answers, pieces: [], lessonsDone, timeZone };
  const met = new Map(
    assignmentProgress({ ...window, tasks }, input).map((p, i) => [tasks[i]!.id, p.met] as const),
  );

  const before = untilDue(addDays(plan.day, -1), timeZone);
  const until = untilDue(plan.day, timeZone);
  const today = sessionsByPiece(sessions.filter((s) => !before(s.startedAt) && until(s.startedAt)));
  return plan.steps.map((step) => {
    if (step.kind === 'task') return met.get(step.task.id) ?? false;
    const piece = records.pieces.find((p) => p.id === step.piece);
    const sessions = today.get(step.piece) ?? [];
    if (!piece || sessions.length === 0) return false;
    if (runsToTheEnd(piece, sessions, records.steps?.get(piece.id)).length > 0) return true;
    return step.goal === 'work' && sessions.reduce((ms, s) => ms + s.activeMs, 0) >= WORK_MS;
  });
}

/**
 * The plan to show: made once a day and kept. The plan kept for today at this length is the
 * plan; another length makes it again from the records before today and the lessons kept with it
 * (a lesson ticked today stays the step it was); another day, or nothing kept, makes it from the
 * lessons ticked now. The same object comes back when the kept plan stands.
 */
export function planFor(
  kept: TodayPlan | null,
  records: TodayRecords,
  options: PlanOptions,
): TodayPlan {
  if (kept?.day !== options.today) return todayPlan(records, options);
  if (kept.minutes === options.minutes) return kept;
  return todayPlan(records, { ...options, lessonsDone: new Set(kept.lessonsDone) });
}

/**
 * An assignment comes first: while the current one has open tasks, the home page shows it as
 * today and the plan's steps are not shown (a teacher's plan is not set beside one made up here).
 */
export function assignmentComesFirst(
  tasks: readonly Task[],
  progress: readonly TaskProgress[],
): boolean {
  return openTasks(tasks, progress).length > 0;
}

// --- The kept plan, read back --------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isDay = (v: unknown): v is DayKey => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
/** More steps than any plan has. */
const MAX_STEPS = 12;

function readWhy(v: unknown): PlanWhy | null {
  if (!isRecord(v)) return null;
  switch (v.kind) {
    case 'weakest':
    case 'nextScale':
    case 'newPiece':
      return { kind: v.kind };
    case 'inHand':
    case 'due':
      return isCount(v.days) ? { kind: v.kind, days: v.days } : null;
    case 'level':
      return v.days === null || isCount(v.days) ? { kind: 'level', days: v.days } : null;
    case 'lesson':
      return isCount(v.n) && isCount(v.of) ? { kind: 'lesson', n: v.n, of: v.of } : null;
    default:
      return null;
  }
}

function readTask(v: unknown, id: string): PlanTask | null {
  if (!isRecord(v)) return null;
  if (v.kind === 'scale') {
    return typeof v.exercise === 'string' && exerciseKeyParts(v.exercise) !== null
      ? { kind: 'scale', id, exercise: v.exercise, click: null, runs: 1 }
      : null;
  }
  if (v.kind === 'level') {
    return isLevelFamily(v.family) &&
      typeof v.level === 'string' &&
      levelsOfFamily(v.family).includes(v.level)
      ? { kind: 'level', id, family: v.family, level: v.level, goal: 1 }
      : null;
  }
  if (v.kind === 'lesson') {
    return typeof v.slug === 'string' && CURRICULUM_LESSONS.includes(v.slug)
      ? { kind: 'lesson', id, slug: v.slug }
      : null;
  }
  return null;
}

function readStep(v: unknown): PlanStep | null {
  if (!isRecord(v) || typeof v.id !== 'string' || v.id.length > 40) return null;
  const part = PLAN_PARTS.find((p) => p === v.part);
  const why = readWhy(v.why);
  if (!part || !why) return null;
  if (v.kind === 'task') {
    const task = readTask(v.task, v.id);
    return task && { kind: 'task', id: v.id, part, why, task };
  }
  if (v.kind === 'piece' && typeof v.piece === 'string' && v.piece.length <= 200) {
    if (v.goal !== 'work' && v.goal !== 'through') return null;
    return { kind: 'piece', id: v.id, part, why, piece: v.piece, goal: v.goal };
  }
  return null;
}

/**
 * The kept plan read back from the browser's preferences: only what a plan can hold is kept, and
 * anything else (another version's, a damaged entry) is no plan, so it is made again.
 */
export function readPlan(value: unknown): TodayPlan | null {
  if (!isRecord(value) || !isDay(value.day) || !isPlanMinutes(value.minutes)) return null;
  if (!Array.isArray(value.steps) || value.steps.length > MAX_STEPS) return null;
  if (!Array.isArray(value.lessonsDone) || value.lessonsDone.length > 100) return null;
  const steps = value.steps.map(readStep);
  const lessonsDone = value.lessonsDone.filter((slug): slug is string => typeof slug === 'string');
  if (steps.some((step) => step === null) || lessonsDone.length < value.lessonsDone.length)
    return null;
  if (new Set(steps.map((step) => step!.id)).size < steps.length) return null;
  return {
    day: value.day,
    minutes: value.minutes,
    steps: steps as PlanStep[],
    lessonsDone: [...lessonsDone].sort(),
  };
}
