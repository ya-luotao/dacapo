// Today's plan (docs/TODAY.md) as plain data: its lengths, its parts and its steps, as they are
// kept in the browser for the day. This file is what the app needs of the plan at startup (the
// home page lays out the plan's space before its rules are in); how a plan is made and ticked is
// in today.ts, which is loaded apart from the start.

import type { LessonTask, LevelTask, ScaleTask } from './assignmentRecords.ts';
import type { DayKey } from './streak.ts';

/** The lengths a plan can have, in minutes: those of lesson 14's figure of a session. */
export const PLAN_MINUTES = [10, 20, 30, 45] as const;
export type PlanMinutes = (typeof PLAN_MINUTES)[number];
/**
 * On the first this many days of a week the home page has a line about the week that ended
 * (docs/PERSONAL.md, "Your week"). Here with the plan's data: the start keeps the line's room.
 */
export const WEEK_LINE_DAYS = 2;

export const DEFAULT_PLAN_MINUTES: PlanMinutes = 20;

export const isPlanMinutes = (v: unknown): v is PlanMinutes =>
  (PLAN_MINUTES as readonly unknown[]).includes(v);

/**
 * How many steps each part has at each length. Work is always one piece; the lesson is counted
 * apart from the levels. Steps have no minutes of their own.
 */
export const PLAN_COUNTS: Readonly<
  Record<PlanMinutes, { warmup: number; levels: number; play: number }>
> = {
  10: { warmup: 1, levels: 1, play: 1 },
  20: { warmup: 1, levels: 1, play: 2 },
  30: { warmup: 1, levels: 2, play: 2 },
  45: { warmup: 2, levels: 3, play: 3 },
};

/**
 * The most steps a plan of this length has: its warm-ups, the piece, the lesson beside the
 * levels (in its place in the 10-minute plan) and the pieces to play through.
 */
export function planRows(minutes: PlanMinutes): number {
  const { warmup, levels, play } = PLAN_COUNTS[minutes];
  return warmup + 1 + levels + (minutes === 10 ? 0 : 1) + play;
}

/** The parts of a session, in its order: lesson 14's. */
export const PLAN_PARTS = ['warmup', 'work', 'new', 'play'] as const;
export type PlanPart = (typeof PLAN_PARTS)[number];

/** Why a step is in the plan, with the figures its rule used: the one line under its name. */
export type PlanWhy =
  /** The least even of the scales played lately. */
  | { kind: 'weakest' }
  /** The next rung of the ladder. */
  | { kind: 'nextScale' }
  /** The piece in hand: days since it was last practised. */
  | { kind: 'inHand'; days: number }
  | { kind: 'newPiece' }
  /** A level: days since its family was last practised; null when it never was. */
  | { kind: 'level'; days: number | null }
  /** The lesson: its number among them all. */
  | { kind: 'lesson'; n: number; of: number }
  /** A piece due for review: days past its date. */
  | { kind: 'due'; days: number };

export type PlanTask = ScaleTask | LevelTask | LessonTask;

/**
 * A step of the plan. A scale, a level and the lesson are an assignment's tasks, ticked and
 * started as those are; a piece is a step of its own (a piece task wants bars, hands, a tempo and
 * the steps of a pass): the piece is opened as it was left, and `goal` says what ticks it, a run
 * to its end or five minutes on it (`work`), or a run to its end alone (`through`).
 */
export type PlanStep =
  | { kind: 'task'; id: string; part: PlanPart; why: PlanWhy; task: PlanTask }
  | {
      kind: 'piece';
      id: string;
      part: PlanPart;
      why: PlanWhy;
      piece: string;
      goal: 'work' | 'through';
    };

/** The plan of a day, as it is kept in the browser for the rest of that day. */
export interface TodayPlan {
  day: DayKey;
  minutes: PlanMinutes;
  steps: PlanStep[];
  /** The lessons ticked when it was made (their slugs, sorted): a tick has no time of its own. */
  lessonsDone: string[];
}
