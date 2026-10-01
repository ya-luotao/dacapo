// The checklist of an assignment (docs/ASSIGNMENTS.md, "The checklist"): how far each task is,
// worked out from the records of whoever practises, between the assignment's start and its due
// date. Pure: the same records give the same checklist on every device, and the report is made of
// the same figures. Loaded only when an assignment is looked at (the mastery rules of every
// practice come with it), never at a plain start.

import {
  isChordSymbolAnswer,
  isEarAnswer,
  isRhythmAnswer,
  isRhythmEarAnswer,
  isTheoryAnswer,
  type Answer,
} from './answers.ts';
import type {
  Assignment,
  LevelFamily,
  LevelTask,
  MasteryFigures,
  MinutesTask,
  PieceRunFigures,
  PieceTask,
  Report,
  ScaleRunFigures,
  ScaleTask,
  SessionFigures,
  Task,
  TaskProgress,
} from './assignmentRecords.ts';
import { HARMONY_FAMILIES, HARMONY_LEVEL_IDS, type HarmonyLevelId } from './chordSymbols.ts';
import { EAR_FAMILIES, levelsOf, type EarFamily, type EarLevelId } from './earItems.ts';
import { earLevelProgress } from './earSession.ts';
import { runFigures } from './evenness.ts';
import { HARMONY_MASTERY_WINDOW, harmonyLevelProgress } from './harmonySession.ts';
import { LEVEL_IDS, type LevelId } from './levels.ts';
import type { PieceSessionRecord, SessionRecord } from './log.ts';
import { levelProgress, MASTERY_WINDOW } from './mastery.ts';
import type { PieceStep } from './pieceRecords.ts';
import { playOrder, type RepeatMode } from './repeats.ts';
import { RHYTHM_LEVEL_IDS, type RhythmLevelId } from './rhythmCells.ts';
import {
  RHYTHM_EAR_FAMILY,
  RHYTHM_EAR_LEVEL_IDS,
  rhythmEarLevelProgress,
  type RhythmEarLevelId,
} from './rhythmEar.ts';
import { RHYTHM_MASTERY_WINDOW, rhythmLevelProgress } from './rhythmRead.ts';
import { IN_TIME_MS } from './rhythmRun.ts';
import { buildSteps, type HandSelection, type Score } from './score.ts';
import type { Attempt } from './session.ts';
import { SIGHT_LEVEL_IDS, type SightLevelId } from './sightLevels.ts';
import { firstTimeRun, SIGHT_MASTERY_FRAGMENTS, sightLevelProgress } from './sightRead.ts';
import { addDays, dailyTotals, dayKey, type DayKey } from './streak.ts';
import {
  THEORY_FAMILIES,
  theoryLevelsOf,
  type TheoryFamily,
  type TheoryLevelId,
} from './theoryItems.ts';
import { THEORY_MASTERY_WINDOW, theoryLevelProgress } from './theorySession.ts';
import { waitRange, type BarLoop } from './wait.ts';

// --- What a task can name ------------------------------------------------------------------------

/** Every family with levels, in the order the pages list them: Read's, Ear's, Harmony's. */
export const LEVEL_FAMILIES: readonly LevelFamily[] = [
  'notes',
  ...THEORY_FAMILIES,
  'rhythm',
  'sight',
  ...EAR_FAMILIES,
  RHYTHM_EAR_FAMILY,
  ...HARMONY_FAMILIES,
];

export const isLevelFamily = (v: unknown): v is LevelFamily =>
  (LEVEL_FAMILIES as readonly unknown[]).includes(v);

const isTheoryFamily = (family: LevelFamily): family is TheoryFamily =>
  (THEORY_FAMILIES as readonly string[]).includes(family);
const isEarFamily = (family: LevelFamily): family is EarFamily =>
  (EAR_FAMILIES as readonly string[]).includes(family);

/** The page a family is practised on. */
export type LevelPage = 'read' | 'ear' | 'harmony';

export function pageOfFamily(family: LevelFamily): LevelPage {
  if (family === 'chordSymbol') return 'harmony';
  return isEarFamily(family) || family === RHYTHM_EAR_FAMILY ? 'ear' : 'read';
}

/** A family's levels, in order. */
export function levelsOfFamily(family: LevelFamily): readonly string[] {
  switch (family) {
    case 'notes':
      return LEVEL_IDS;
    case 'rhythm':
      return RHYTHM_LEVEL_IDS;
    case 'sight':
      return SIGHT_LEVEL_IDS;
    case 'rhythmEar':
      return RHYTHM_EAR_LEVEL_IDS;
    case 'chordSymbol':
      return HARMONY_LEVEL_IDS;
    default:
      return (isTheoryFamily(family) ? theoryLevelsOf(family) : levelsOf(family)).map((l) => l.id);
  }
}

/** The tempos a piece task can ask for: percent of the score's, as the piece page offers them. */
export const TASK_TEMPO_MIN = 40;
export const TASK_TEMPO_MAX = 200;
export const TASK_TEMPO_STEP = 10;

export const isTaskTempo = (v: unknown): v is number =>
  Number.isInteger(v) &&
  (v as number) >= TASK_TEMPO_MIN &&
  (v as number) <= TASK_TEMPO_MAX &&
  (v as number) % TASK_TEMPO_STEP === 0;

/**
 * The steps one pass through `bars` (the whole piece when null) takes with `hands`, the repeats
 * played and skipped: what a piece task keeps as `pass`. 0 where the bars are never played that
 * way (a first ending while the repeats are skipped).
 */
export function passSteps(
  score: Score,
  hands: HandSelection,
  bars: BarLoop | null,
): Record<RepeatMode, number> {
  const count = (repeats: RepeatMode) => {
    const order = playOrder(score.measures, repeats);
    const range = waitRange(buildSteps(score, hands, order), order, bars, bars?.from ?? 0);
    return range ? range.last - range.first + 1 : 0;
  };
  return { play: count('play'), skip: count('skip') };
}

// --- The window ----------------------------------------------------------------------------------

/** The days that count: from `start` to `due`, both included, on the local calendar. */
export interface DayWindow {
  start: DayKey;
  due: DayKey;
}

const DAY_MS = 86_400_000;
/** No time zone is further from UTC than this (UTC−12 to UTC+14, with room to spare). */
const ZONE_MS = 15 * 3_600_000;

const utcOf = (day: DayKey): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d);
};

/**
 * Whether an instant falls on a day from `start` to `due`. The calendar is asked only near the
 * edges: an instant well inside or well outside is told by its epoch alone.
 */
function inWindow(window: DayWindow, timeZone: string | undefined): (epochMs: number) => boolean {
  const from = utcOf(window.start);
  const to = utcOf(window.due) + DAY_MS;
  return (at) => {
    if (at < from - ZONE_MS || at >= to + ZONE_MS) return false;
    if (at >= from + ZONE_MS && at < to - ZONE_MS) return true;
    const day = dayKey(at, timeZone);
    return day >= window.start && day <= window.due;
  };
}

/** Whether an instant is on the due day or before it. */
export function untilDue(due: DayKey, timeZone: string | undefined): (epochMs: number) => boolean {
  const end = utcOf(due) + DAY_MS;
  return (at) => {
    if (at < end - ZONE_MS) return true;
    if (at >= end + ZONE_MS) return false;
    return dayKey(at, timeZone) <= due;
  };
}

// --- Progress ------------------------------------------------------------------------------------

/** A piece on the device: built-in or imported, with the checksum of its notes when it is known. */
export interface KnownPiece {
  id: string;
  checksum: string | null;
}

/** The records a checklist is worked out from: those of whoever practises. */
export interface ProgressInput {
  sessions: readonly SessionRecord[];
  /** In the order they happened. */
  attempts: readonly Attempt[];
  /** In the order they happened. */
  answers: readonly Answer[];
  /**
   * Step records by piece id, for the pieces whose records are loaded. A piece task counts its
   * runs from them; without them it counts the sessions that were played to their end.
   */
  steps?: ReadonlyMap<string, readonly PieceStep[]>;
  /** The pieces on this device. */
  pieces: readonly KnownPiece[];
  /** The lessons ticked on this device (their slugs). */
  lessonsDone: ReadonlySet<string>;
  /** An IANA name; the system zone when omitted. */
  timeZone?: string;
}

/**
 * The ids a piece task's runs are found under: the piece's own, and every piece here with the
 * same notes (an imported piece has another id on each device it was imported on).
 */
export function taskPieceIds(task: PieceTask, pieces: readonly KnownPiece[]): string[] {
  const same = pieces.filter((p) => p.checksum === task.piece.checksum).map((p) => p.id);
  return [...new Set([task.piece.id, ...same])];
}

/**
 * The piece to open for a task: the one with its id when its notes are the task's (or are not
 * known yet), else one with the same notes, else the one with its id. Null when it is not here.
 */
export function taskPiece(task: PieceTask, pieces: readonly KnownPiece[]): KnownPiece | null {
  const own = pieces.find((p) => p.id === task.piece.id);
  if (own && (own.checksum === null || own.checksum === task.piece.checksum)) return own;
  return pieces.find((p) => p.checksum === task.piece.checksum) ?? own ?? null;
}

/** Four decimals: more than a percent shows, and a figure stays a few characters in a report. */
const rounded = (share: number): number => Math.round(share * 10_000) / 10_000;
const ratio = (n: number, of: number): number | null => (of > 0 ? rounded(n / of) : null);

/** The figures of one pass through the bars, from its step records. */
function passFigures(session: PieceSessionRecord, steps: readonly PieceStep[]): PieceRunFigures {
  const at = steps.at(-1)?.at ?? session.endedAt;
  if (session.mode === 'rhythm') {
    const notes = steps.flatMap((s) => s.notes ?? []);
    const hits = notes.filter((n) => n.deviation !== null);
    const inTime = hits.filter((n) => Math.abs(n.deviation!) <= IN_TIME_MS);
    return {
      at,
      tempo: session.tempo,
      right: ratio(hits.length, notes.length),
      inTime: ratio(inTime.length, notes.length),
    };
  }
  const wrong = steps.reduce((sum, s) => sum + s.wrong, 0);
  return {
    at,
    tempo: session.tempo,
    right: steps.length > 0 ? rounded(Math.max(0, 1 - wrong / steps.length)) : null,
    inTime: null,
  };
}

/** The figures of a whole session, when its step records are not here. */
function sessionFigures(session: PieceSessionRecord): PieceRunFigures {
  const rhythm = session.mode === 'rhythm' ? session.rhythm : undefined;
  return {
    at: session.endedAt,
    tempo: session.tempo,
    right: rhythm
      ? ratio(rhythm.hits, rhythm.notes)
      : session.steps > 0
        ? rounded(Math.max(0, 1 - session.wrong / session.steps))
        : null,
    inTime: rhythm ? ratio(rhythm.inTime, rhythm.notes) : null,
  };
}

/** Whether a run's bars take in the task's: the whole piece, or a loop over at least its bars. */
function covers(session: PieceSessionRecord, task: PieceTask): boolean {
  if (task.bars === null || session.loop === null) return session.loop === null;
  return session.loop.from <= task.bars.from && session.loop.to >= task.bars.to;
}

/**
 * The runs of a piece task: every pass through its bars with its hands and mode, at or above its
 * tempo, in the written key, in sessions begun in the window, oldest first. With a session's step
 * records (made on the same notes), the steps in the task's bars are divided by the steps one
 * pass takes, so three times round a loop are three runs and a loop stopped halfway is none;
 * without them, a session played to its end is one run, with the session's figures.
 *
 * A run with a left hand made from the chord symbols (a lead sheet's, H3) was played on other
 * notes than the task's, a different left hand for each pattern: its right hand is still the
 * melody as written, so a task for the right hand counts its passes; with the left hand or both,
 * the steps a pass takes depend on the pattern, and it counts as a session played to its end.
 */
export function pieceRuns(
  task: PieceTask,
  sessions: readonly SessionRecord[],
  input: Pick<ProgressInput, 'steps' | 'pieces'>,
): PieceRunFigures[] {
  const ids = new Set(taskPieceIds(task, input.pieces));
  // The pieces here whose notes, as written, are the task's.
  const written = new Set(
    input.pieces.filter((p) => p.checksum === task.piece.checksum).map((p) => p.id),
  );
  const bySession = new Map<string, PieceStep[]>();
  for (const id of ids) {
    for (const step of input.steps?.get(id) ?? []) {
      const list = bySession.get(step.sessionId);
      if (list) list.push(step);
      else bySession.set(step.sessionId, [step]);
    }
  }
  const runs: PieceRunFigures[] = [];
  for (const session of sessions) {
    if (session.kind !== 'piece' || !ids.has(session.pieceId)) continue;
    if (session.hands !== task.hands || (session.mode ?? 'wait') !== task.mode) continue;
    if (session.tempo < task.tempo || !covers(session, task)) continue;
    // A run in another key (H4) is practice at transposing, not a run of what was set.
    if (session.transpose !== undefined) continue;
    const own = bySession.get(session.id) ?? [];
    const perPass = task.pass[session.repeats];
    const sameNotes =
      own.length > 0 &&
      (session.leftHand === undefined
        ? own.every((s) => s.checksum === task.piece.checksum)
        : task.hands === 'right' && written.has(session.pieceId));
    if (sameNotes && perPass > 0) {
      const { bars } = task;
      const inBars = [...own]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .filter((s) => !bars || (s.measure >= bars.from && s.measure <= bars.to));
      for (let first = 0; first + perPass <= inBars.length; first += perPass) {
        runs.push(passFigures(session, inBars.slice(first, first + perPass)));
      }
    } else if (session.completed) {
      runs.push(sessionFigures(session));
    }
  }
  return runs.sort((a, b) => a.at - b.at);
}

/** The value a piece run is judged by: the goal's measure, or the notes right without one. */
const measured = (run: PieceRunFigures, task: PieceTask): number | null =>
  task.goal?.measure === 'inTime' ? run.inTime : run.right;

/** The latest of the highest (`sign` 1) or lowest (−1) by `value`; null values come last. */
function bestBy<T>(items: readonly T[], value: (item: T) => number | null, sign: 1 | -1): T | null {
  let best: T | null = null;
  let bestValue: number | null = null;
  for (const item of items) {
    const v = value(item);
    const takes =
      v === null ? bestValue === null : bestValue === null || sign * (v - bestValue) >= 0;
    if (best === null || takes) {
      best = item;
      bestValue = v;
    }
  }
  return best;
}

function pieceProgress(task: PieceTask, context: Context): TaskProgress {
  const runs = pieceRuns(task, context.sessions, context.input);
  const { goal } = task;
  // A whole percent is what the goal says and what the checklist shows.
  const reached = goal
    ? runs.filter((run) => {
        const value = measured(run, task);
        return value !== null && Math.round(value * 100) >= goal.percent;
      })
    : runs;
  return {
    kind: 'piece',
    done: reached.length,
    target: task.runs,
    met: reached.length >= task.runs,
    played: runs.length,
    best: bestBy(runs, (run) => measured(run, task), 1),
    last: runs.at(-1) ?? null,
  };
}

function scaleProgress(task: ScaleTask, context: Context): TaskProgress {
  const { click } = task;
  const runs: ScaleRunFigures[] = [];
  for (const session of context.input.sessions) {
    if (session.kind !== 'scale') continue;
    for (const run of session.runs) {
      if (run.exercise !== task.exercise || run.headline.quality !== 'ok') continue;
      if (!context.inWindow(run.startedAt)) continue;
      // With the click: the same notes to the beat, at the tempo or faster.
      if (click && !(run.click?.perBeat === click.perBeat && run.click.bpm >= click.bpm)) continue;
      const spread = runFigures(run.headline)?.spread ?? null;
      runs.push({
        at: run.startedAt,
        // A tenth of a millisecond, as the Scales page shows it.
        spread: spread === null ? null : Math.round(spread * 10) / 10,
        bpm: run.click?.bpm ?? null,
      });
    }
  }
  runs.sort((a, b) => a.at - b.at);
  return {
    kind: 'scale',
    done: runs.length,
    target: task.runs,
    met: runs.length >= task.runs,
    best: bestBy(runs, (run) => run.spread, -1),
    last: runs.at(-1) ?? null,
  };
}

/**
 * A session of the task's family and level that was played to its end (every card, exercise or
 * fragment planned), with the share it got right; null for any other session.
 */
function levelSession(task: LevelTask, session: SessionRecord): SessionFigures | null {
  const { family, level } = task;
  const figures = (complete: boolean, accuracy: number | null): SessionFigures | null =>
    complete
      ? { at: session.startedAt, accuracy: accuracy === null ? null : rounded(accuracy) }
      : null;
  switch (session.kind) {
    case 'read':
      return family === 'notes' && session.level === level
        ? figures(session.cards >= session.length, session.accuracy)
        : null;
    case 'theory':
      return session.family === family && session.level === level
        ? figures(session.cards >= session.length, session.accuracy)
        : null;
    case 'rhythm':
      return family === 'rhythm' && session.level === level
        ? figures(session.exercises >= session.length, session.accuracy)
        : null;
    case 'sight': {
      if (family !== 'sight' || session.level !== level) return null;
      const firsts = session.fragments.flatMap((f) => firstTimeRun(f) ?? []);
      const notes = firsts.reduce((n, r) => n + r.notes, 0);
      const inTime = firsts.reduce((n, r) => n + r.inTime, 0);
      return figures(session.fragments.length >= session.length, ratio(inTime, notes));
    }
    case 'ear':
      if (session.family !== family || session.level !== level) return null;
      return session.family === RHYTHM_EAR_FAMILY
        ? figures(session.questions >= session.length, session.accuracy)
        : figures(session.items >= session.length, session.accuracy);
    case 'harmony':
      return session.family === family && session.level === level
        ? figures(session.cards >= session.length, session.accuracy)
        : null;
    default:
      return null;
  }
}

/** Where the task's level stands against its mastery, by the rules of its own page. */
function levelMastery(task: LevelTask, context: Context): MasteryFigures & { mastered: boolean } {
  const figures = masteryOf(task, context);
  return {
    ...figures,
    accuracy: figures.accuracy === null ? null : rounded(figures.accuracy),
  };
}

function masteryOf(
  task: Pick<LevelTask, 'family' | 'level'>,
  context: Context,
): MasteryFigures & { mastered: boolean } {
  const { family, level } = task;
  const answers = context.answersUntilDue();
  if (family === 'notes') {
    const p = levelProgress(context.attemptsUntilDue(), level as LevelId);
    return { counted: p.cards, window: MASTERY_WINDOW, accuracy: p.accuracy, mastered: p.mastered };
  }
  if (family === 'rhythm') {
    const p = rhythmLevelProgress(answers.filter(isRhythmAnswer), level as RhythmLevelId);
    return {
      counted: p.cells,
      window: RHYTHM_MASTERY_WINDOW,
      accuracy: p.accuracy,
      mastered: p.mastered,
    };
  }
  if (family === 'sight') {
    const sessions = context.input.sessions
      .filter((s) => s.kind === 'sight')
      .filter((s) => context.untilDue(s.startedAt));
    const p = sightLevelProgress(sessions, level as SightLevelId);
    const sum = p.window.reduce((total, share) => total + share, 0);
    return {
      counted: p.window.length,
      window: SIGHT_MASTERY_FRAGMENTS,
      accuracy: ratio(sum, p.window.length),
      mastered: p.mastered,
    };
  }
  if (family === RHYTHM_EAR_FAMILY) {
    const p = rhythmEarLevelProgress(answers.filter(isRhythmEarAnswer), level as RhythmEarLevelId);
    return { counted: p.answers, window: p.window, accuracy: p.accuracy, mastered: p.mastered };
  }
  if (family === 'chordSymbol') {
    const p = harmonyLevelProgress(answers.filter(isChordSymbolAnswer), level as HarmonyLevelId);
    return {
      counted: p.cards,
      window: HARMONY_MASTERY_WINDOW,
      accuracy: p.accuracy,
      mastered: p.mastered,
    };
  }
  if (isTheoryFamily(family)) {
    const p = theoryLevelProgress(answers.filter(isTheoryAnswer), level as TheoryLevelId);
    return {
      counted: p.cards,
      window: THEORY_MASTERY_WINDOW,
      accuracy: p.accuracy,
      mastered: p.mastered,
    };
  }
  const p = earLevelProgress(answers.filter(isEarAnswer), level as EarLevelId);
  return { counted: p.answers, window: p.window, accuracy: p.accuracy, mastered: p.mastered };
}

/**
 * Whether each of `levels` is mastered, by the rules of its own page, on everything answered up
 * to the end of `due`: what a level task with mastery for its goal asks, for many levels at once
 * (where every practice stands, core/today.ts).
 */
export function levelsMastered(
  levels: readonly Pick<LevelTask, 'family' | 'level'>[],
  due: DayKey,
  input: ProgressInput,
): boolean[] {
  const context = contextOf({ start: due, due }, input);
  return levels.map((level) => masteryOf(level, context).mastered);
}

function levelTaskProgress(task: LevelTask, context: Context): TaskProgress {
  const sessions = context.sessions
    .flatMap((session) => levelSession(task, session) ?? [])
    .sort((a, b) => a.at - b.at);
  const best = bestBy(sessions, (s) => s.accuracy, 1);
  const last = sessions.at(-1) ?? null;
  if (task.goal === 'mastery') {
    const { mastered, ...mastery } = levelMastery(task, context);
    return { kind: 'level', done: mastered ? 1 : 0, target: 1, met: mastered, best, last, mastery };
  }
  return {
    kind: 'level',
    done: sessions.length,
    target: task.goal,
    met: sessions.length >= task.goal,
    best,
    last,
    mastery: null,
  };
}

function minutesProgress(task: MinutesTask, context: Context): TaskProgress {
  const days = context.minutes().filter((d) => d.minutes >= task.minutes).length;
  return { kind: 'minutes', done: days, target: task.days, met: days >= task.days };
}

/**
 * Whole minutes practised on each day of the window that had any, in order: every kind of
 * session, by the day it began, as the practice log counts them.
 */
export function minutesPerDay(
  sessions: readonly SessionRecord[],
  window: DayWindow,
  timeZone?: string,
): { day: DayKey; minutes: number }[] {
  const from = utcOf(window.start) - ZONE_MS;
  const to = utcOf(window.due) + DAY_MS + ZONE_MS;
  const near = sessions.filter((s) => s.startedAt >= from && s.startedAt < to);
  return [...dailyTotals(near, timeZone)]
    .filter(([day]) => day >= window.start && day <= window.due)
    .map(([day, ms]) => ({ day, minutes: Math.floor(ms / 60_000) }))
    .filter((d) => d.minutes > 0)
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

/** What every task of one assignment shares: the window's records, each read once. */
interface Context {
  input: ProgressInput;
  window: DayWindow;
  inWindow: (epochMs: number) => boolean;
  untilDue: (epochMs: number) => boolean;
  /** The sessions begun in the window. */
  sessions: readonly SessionRecord[];
  attemptsUntilDue: () => readonly Attempt[];
  answersUntilDue: () => readonly Answer[];
  minutes: () => readonly { day: DayKey; minutes: number }[];
}

function once<T>(compute: () => T): () => T {
  let value: { is: T } | null = null;
  return () => (value ??= { is: compute() }).is;
}

function contextOf(window: DayWindow, input: ProgressInput): Context {
  const within = inWindow(window, input.timeZone);
  const before = untilDue(window.due, input.timeZone);
  return {
    input,
    window,
    inWindow: within,
    untilDue: before,
    sessions: input.sessions.filter((s) => within(s.startedAt)),
    // Mastery is a state: it is judged on everything answered up to the due day, the answers
    // from before the start among them.
    attemptsUntilDue: once(() => input.attempts.filter((a) => before(a.at))),
    answersUntilDue: once(() => input.answers.filter((a) => before(a.at))),
    minutes: once(() => minutesPerDay(input.sessions, window, input.timeZone)),
  };
}

const NOT_KNOWN: TaskProgress = { kind: 'unknown', done: 0, target: 0, met: false };

function progressOf(task: Task, context: Context): TaskProgress {
  switch (task.kind) {
    case 'piece':
      return pieceProgress(task, context);
    case 'scale':
      return scaleProgress(task, context);
    case 'level':
      return levelTaskProgress(task, context);
    case 'lesson': {
      const done = context.input.lessonsDone.has(task.slug);
      return { kind: 'lesson', done: done ? 1 : 0, target: 1, met: done };
    }
    case 'minutes':
      return minutesProgress(task, context);
    default:
      return NOT_KNOWN;
  }
}

/** How far one task is, from the records between `window.start` and `window.due`. */
export function taskProgress(task: Task, window: DayWindow, input: ProgressInput): TaskProgress {
  return progressOf(task, contextOf(window, input));
}

/** The checklist: every task's progress, in the assignment's order. */
export function assignmentProgress(
  assignment: Pick<Assignment, 'start' | 'due' | 'tasks'>,
  input: ProgressInput,
): TaskProgress[] {
  const context = contextOf(assignment, input);
  return assignment.tasks.map((task) => progressOf(task, context));
}

/**
 * The tasks still to do, each with how far it is: those this version knows that are not met. The
 * home page shows them, and while there are any, today's plan gives way to them (docs/TODAY.md).
 */
export function openTasks(
  tasks: readonly Task[],
  progress: readonly TaskProgress[],
): { task: Task; done: TaskProgress }[] {
  return tasks.flatMap((task, i) => {
    const done = progress[i];
    return task.kind === 'unknown' || !done || done.met ? [] : [{ task, done }];
  });
}

/** How many of the tasks this version knows are met. */
export function tasksMet(progress: readonly TaskProgress[]): { met: number; of: number } {
  const known = progress.filter((p) => p.kind !== 'unknown');
  return { met: known.filter((p) => p.met).length, of: known.length };
}

/** The days of a window, at most `limit`, in order. */
export function windowDays(window: DayWindow, limit = 400): DayKey[] {
  const days: DayKey[] = [];
  for (let day = window.start; day <= window.due && days.length < limit; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

// --- The report ----------------------------------------------------------------------------------

/**
 * Whole minutes practised on each day from the window's start on, as far as `today` (the due day
 * at most): what a report carries. Empty before the start day.
 */
export function reportDays(
  sessions: readonly SessionRecord[],
  window: DayWindow,
  today: DayKey,
  timeZone?: string,
): number[] {
  const last = today < window.due ? today : window.due;
  const practised = new Map(
    minutesPerDay(sessions, window, timeZone).map((d) => [d.day, d.minutes] as const),
  );
  // A day has 1,440 minutes; sessions that began on it may still add up to more.
  return windowDays({ start: window.start, due: last }).map((day) =>
    Math.min(1440, practised.get(day) ?? 0),
  );
}

/** A report's days with their dates: the first is the start day. */
export function reportDayList(
  report: Pick<Report, 'start' | 'days'>,
): { day: DayKey; minutes: number }[] {
  return report.days.map((minutes, i) => ({ day: addDays(report.start, i), minutes }));
}

/**
 * The report on an assignment (docs/ASSIGNMENTS.md, "The report"): its checklist as it stands,
 * task by task (the task, so the report reads on its own, and its figures), the minutes of each
 * day so far, and what the student typed. Figures only: no record, and nothing from outside the
 * assignment's tasks and days.
 */
export function buildReport(
  assignment: Assignment,
  progress: readonly TaskProgress[],
  details: {
    id: string;
    from: string;
    note: string;
    /** Epoch ms: when it is made. */
    now: number;
    sessions: readonly SessionRecord[];
    timeZone?: string;
  },
): Report {
  return {
    id: details.id,
    assignmentId: assignment.id,
    assignmentVersion: assignment.updatedAt,
    title: assignment.title,
    start: assignment.start,
    due: assignment.due,
    from: details.from,
    note: details.note,
    createdAt: details.now,
    tasks: assignment.tasks.map((task, i) => ({
      task,
      progress: progress[i] ?? NOT_KNOWN,
    })),
    days: reportDays(
      details.sessions,
      assignment,
      dayKey(details.now, details.timeZone),
      details.timeZone,
    ),
  };
}
