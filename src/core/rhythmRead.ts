// Rhythm on Read (docs/READING.md, "Rhythm (R1)"): a run of an exercise judged cell by cell, the
// answers it leaves (one per cell), a session of exercises, its summary and each level's mastery.
// The taps are timed by rhythm mode's plan and matcher (core/rhythm.ts) with the calibrated
// latency taken off; what comes out of the matcher is judged here. As in `session.ts`, `time`
// values are milliseconds on a run's clock and `at` values epoch ms, which is what gets stored.

import { activeTime } from './activity.ts';
import type { PlayResult, RhythmPlan, StepTiming } from './rhythm.ts';
import { cellOnsets, RHYTHM_LEVELS, type RhythmLevel, type RhythmLevelId } from './rhythmCells.ts';
import {
  drawExercise,
  EXERCISE_BARS,
  exerciseOnsets,
  exerciseSteps,
  HANDS_FIRST_BARS,
  HANDS_WARMUP_CELLS,
  LINE_KEYS,
  msPerTick,
  type Onset,
  type RhythmExercise,
} from './rhythmExercise.ts';
import { IN_TIME_MS, TENDENCY_TRIM } from './rhythmRun.ts';
import type { Rng } from './random.ts';
import { trimmedMean } from './robust.ts';
import { median } from './session.ts';
import { statsFromAttempts, type NoteStats } from './weakness.ts';

/** One cell as played: an answer in the `answers` store. Plain data, stored and synced as is. */
export interface RhythmAnswer {
  /** Stable and unique, so imports and sync can merge by id. */
  id: string;
  sessionId: string;
  family: 'rhythm';
  level: RhythmLevelId;
  /** `rhythm:<cell>:<meter>`: `rhythm:ed-s:4/4`, `rhythm:c:qe:6/8`, `rhythm:ee|q:4/4`. */
  item: string;
  /** The cell's onsets in beats from its start, one list per line (the right hand's first). */
  prompt: number[][];
  answer: {
    /** Per onset of `prompt`: whole ms early (−) or late (+), the latency taken off; null: missed. */
    deviations: (number | null)[][];
    /** Taps that matched no onset and fell in the cell's span. */
    extras: number;
  };
  /** Every onset in time (within `IN_TIME_MS`) and nothing extra. */
  correct: boolean;
  /** Beats a minute (dotted quarters in 6/8). */
  bpm: number;
  /** The exercise of the session (0-based) and the run of the session ("Again" runs it again). */
  exercise: number;
  run: number;
  /** Epoch ms: when the cell's span ended in the run. */
  at: number;
}

export const isRhythmFamily = (v: unknown): v is 'rhythm' => v === 'rhythm';

// --- A run -----------------------------------------------------------------------------------

/** Whole milliseconds, never −0. */
export const wholeMs = (ms: number): number => Math.round(ms) || 0;

/** Whether a deviation is in time. Judged on whole ms, as stored. */
export const inTime = (deviation: number | null): deviation is number =>
  deviation !== null && Math.abs(deviation) <= IN_TIME_MS;

export interface OnsetTiming extends Onset {
  /** Whole ms early (−) or late (+); null when missed. */
  deviation: number | null;
}

/** A tap on a line, in ms on the run's clock (from the first downbeat), the latency taken off. */
export interface Tap {
  line: number;
  time: number;
}

export interface ExtraTap extends Tap {
  /** Where it fell, in ticks from the start (not a whole number). */
  tick: number;
  /** The cell whose span it fell in; -1 after the last cell (the final note's bar). */
  cell: number;
}

export interface CellTiming {
  cell: number;
  key: string;
  item: string;
  prompt: number[][];
  deviations: (number | null)[][];
  extras: number;
  correct: boolean;
}

/** A run of an exercise, judged. */
export interface RhythmRun {
  /** Every onset, the final note's too, in time order. */
  onsets: OnsetTiming[];
  extras: ExtraTap[];
  cells: CellTiming[];
  /** Cells right. */
  right: number;
  /** Median |deviation| over the cells' onsets played; null with none. */
  medianDeviation: number | null;
  /** Rhythm mode's tendency (trimmed mean, early −, late +) over the same; null with none. */
  tendency: number | null;
}

/**
 * Whether a tap the matcher did not take for an onset is an extra one: from the first onset's
 * window to the last one's. The matcher only sees the onsets near a tap, so a tap in a rest is
 * extra here though it found nothing to give it to; taps along with the count-in are not.
 */
export function isExtraTap(plan: RhythmPlan, time: number, result: PlayResult): boolean {
  if (result.kind === 'hit') return false;
  const first = plan.steps[0];
  const last = plan.steps.at(-1);
  if (!first || !last) return false;
  return time >= first.at - first.window && time <= last.at + last.window;
}

/** The cell a moment of the run falls in: 0 before the first, -1 after the last. */
function cellAt(exercise: RhythmExercise, tick: number): number {
  if (tick < 0) return 0;
  return exercise.cells.findIndex((c) => tick >= c.start && tick < c.start + c.ticks);
}

/**
 * Judges a run from what rhythm mode's matcher settled (`timings`, the steps of `exerciseSteps`)
 * and the taps it found no onset for (`extraTaps`, see `isExtraTap`). A cell is right when every
 * onset in it is in time and no extra tap fell in its span.
 */
export function judgeRhythmRun(
  exercise: RhythmExercise,
  bpm: number,
  timings: readonly StepTiming[],
  extraTaps: readonly Tap[],
): RhythmRun {
  const steps = exerciseSteps(exercise);
  const byTick = new Map<number, StepTiming>();
  for (const t of timings) {
    const step = steps[t.step];
    if (step) byTick.set(step.tick, t);
  }
  const onsets = exerciseOnsets(exercise).map((o): OnsetTiming => {
    const raw = byTick.get(o.tick)?.notes.find((n) => n.midi === LINE_KEYS[o.line])?.deviation;
    return { ...o, deviation: raw === undefined || raw === null ? null : wholeMs(raw) };
  });
  const perTick = msPerTick(exercise.meter, bpm);
  const extras = extraTaps.map(({ line, time }): ExtraTap => {
    const tick = time / perTick;
    return { line, time, tick, cell: cellAt(exercise, tick) };
  });
  const cells = exercise.cells.map((c, index): CellTiming => {
    const prompt = cellOnsets(c.key, exercise.meter);
    const deviations = prompt.map((_, line) =>
      onsets.filter((o) => o.cell === index && o.line === line).map((o) => o.deviation),
    );
    const extra = extras.filter((e) => e.cell === index).length;
    return {
      cell: index,
      key: c.key,
      item: c.item,
      prompt,
      deviations,
      extras: extra,
      correct: judgeCell(deviations, extra),
    };
  });
  const played = cells.flatMap((c) => c.deviations.flat()).filter((d) => d !== null);
  return {
    onsets,
    extras,
    cells,
    right: cells.filter((c) => c.correct).length,
    medianDeviation: median(played.map(Math.abs)),
    tendency: trimmedMean(played, TENDENCY_TRIM),
  };
}

/** A cell is right when every onset is in time and nothing extra fell in it. */
export function judgeCell(deviations: readonly (readonly (number | null)[])[], extras: number) {
  return extras === 0 && deviations.every((line) => line.every(inTime));
}

export interface RunContext {
  sessionId: string;
  level: RhythmLevelId;
  bpm: number;
  exercise: number;
  run: number;
  /** Epoch ms of the run's clock's zero: the exercise's first downbeat. */
  zeroAt: number;
  newId: () => string;
}

/** The answers a run leaves: one per cell, stamped when the cell's span ended. */
export function runAnswers(run: RhythmRun, exercise: RhythmExercise, ctx: RunContext) {
  const perTick = msPerTick(exercise.meter, ctx.bpm);
  return run.cells.map((c): RhythmAnswer => ({
    id: ctx.newId(),
    sessionId: ctx.sessionId,
    family: 'rhythm',
    level: ctx.level,
    item: c.item,
    prompt: c.prompt.map((line) => [...line]),
    answer: { deviations: c.deviations.map((line) => [...line]), extras: c.extras },
    correct: c.correct,
    bpm: ctx.bpm,
    exercise: ctx.exercise,
    run: ctx.run,
    at: Math.round(
      ctx.zeroAt + (exercise.cells[c.cell]!.start + exercise.cells[c.cell]!.ticks) * perTick,
    ),
  }));
}

// --- Chords --------------------------------------------------------------------------------

/**
 * Note-ons of one line closer together than this are one tap: a chord struck, or a finger
 * catching two keys. Far below the shortest gap between onsets (a sixteenth at 160 is 94 ms).
 */
export const CHORD_MS = 30;

/** Whether each note-on counts as a tap: the first of a chord does, the rest do not. */
export function createTapFilter(): (line: number, time: number) => boolean {
  const last = new Map<number, number>();
  return (line, time) => {
    const previous = last.get(line);
    if (previous !== undefined && time - previous < CHORD_MS && time >= previous) return false;
    last.set(line, time);
    return true;
  };
}

// --- The item model --------------------------------------------------------------------------

/** How far a cell's onsets were from the beat on average: its unevenness; 0 with none played. */
export function unevenness(answer: Pick<RhythmAnswer, 'answer'>): number {
  const played = answer.answer.deviations.flat().filter((d) => d !== null);
  return played.length === 0 ? 0 : played.reduce((s, d) => s + Math.abs(d), 0) / played.length;
}

/**
 * Per-item stats for the item model, recomputed from the answers: a cell missed counts as an
 * error, a cell right is weighted by its unevenness (the weakness model's "time").
 */
export function rhythmStats(answers: readonly RhythmAnswer[]): Record<string, NoteStats> {
  return statsFromAttempts(
    answers.map((a) => ({
      note: a.item,
      correct: a.correct,
      ms: unevenness(a),
      hinted: false,
      timedOut: false,
      at: a.at,
    })),
  );
}

/**
 * The next exercise of a level: a meter of it at random, cells by the item model. R9–R10 play two
 * bars, and R10 no two against three, until the level's first `HANDS_WARMUP_CELLS` cells.
 */
export function nextExercise(
  level: RhythmLevel,
  answers: readonly RhythmAnswer[],
  rng: Rng,
): RhythmExercise {
  const warm = answers.filter((a) => a.level === level.id).length >= HANDS_WARMUP_CELLS;
  const meter = level.meters[Math.floor(rng() * level.meters.length)] ?? level.meters[0]!;
  return drawExercise({
    level,
    meter,
    bars: level.hands && !warm ? HANDS_FIRST_BARS : EXERCISE_BARS,
    stats: rhythmStats(answers),
    rng,
    cross: !level.hands || warm,
  });
}

// --- A session -------------------------------------------------------------------------------

/** Exercises a session can have. */
export const RHYTHM_SESSION_LENGTHS = [4, 8, 16] as const;
export type RhythmSessionLength = (typeof RHYTHM_SESSION_LENGTHS)[number];
export const DEFAULT_RHYTHM_SESSION_LENGTH: RhythmSessionLength = 8;

export interface RhythmSessionState {
  id: string;
  level: RhythmLevelId;
  bpm: number;
  /** Exercises planned. */
  length: number;
  startedAt: number;
  endedAt: number | null;
  phase: 'running' | 'done';
  /** The exercise on the stand, and its index (0-based). */
  exercise: RhythmExercise;
  index: number;
  /** Runs recorded so far. */
  runs: number;
  /** The last run of the exercise on the stand, once it has been played. */
  last: RhythmRun | null;
  answers: readonly RhythmAnswer[];
}

export function startRhythmSession(options: {
  id: string;
  level: RhythmLevelId;
  bpm: number;
  length: number;
  at: number;
  exercise: RhythmExercise;
}): RhythmSessionState {
  return {
    id: options.id,
    level: options.level,
    bpm: options.bpm,
    length: options.length,
    startedAt: options.at,
    endedAt: null,
    phase: 'running',
    exercise: options.exercise,
    index: 0,
    runs: 0,
    last: null,
    answers: [],
  };
}

/** A run played to its end: its answers are kept and it is the exercise's result. */
export function recordRhythmRun(
  state: RhythmSessionState,
  run: RhythmRun,
  zeroAt: number,
  newId: () => string,
): RhythmSessionState {
  if (state.phase !== 'running') return state;
  const answers = runAnswers(run, state.exercise, {
    sessionId: state.id,
    level: state.level,
    bpm: state.bpm,
    exercise: state.index,
    run: state.runs,
    zeroAt,
    newId,
  });
  return { ...state, runs: state.runs + 1, last: run, answers: [...state.answers, ...answers] };
}

/** "Next": the next exercise, or the end of the session after the last one. */
export function nextRhythmExercise(
  state: RhythmSessionState,
  exercise: RhythmExercise,
  at: number,
): RhythmSessionState {
  if (state.phase !== 'running') return state;
  if (state.index + 1 >= state.length) return endRhythmSession(state, at);
  return { ...state, exercise, index: state.index + 1, last: null };
}

/** Ends the session now, e.g. when the player stops early. */
export function endRhythmSession(state: RhythmSessionState, at: number): RhythmSessionState {
  if (state.phase === 'done') return state;
  return { ...state, phase: 'done', endedAt: at };
}

// --- Figures ---------------------------------------------------------------------------------

/** What a finished (or stopped) rhythm session amounts to. Plain data, so it can be stored. */
export interface RhythmSessionSummary {
  id: string;
  level: RhythmLevelId;
  /** Beats a minute. */
  bpm: number;
  startedAt: number;
  endedAt: number;
  /** Time spent; pauses longer than `IDLE_MS` count as `IDLE_MS`. */
  activeMs: number;
  /** Exercises planned, and those played (at least once). */
  length: number;
  exercises: number;
  /** Runs played to their end ("Again" plays one more). */
  runs: number;
  cells: number;
  /** Cells right. */
  correct: number;
  /** null when no cell was played. */
  accuracy: number | null;
  /** Median |deviation| of the onsets played; null with none. */
  medianDeviation: number | null;
  /** The tendency over them (early −, late +); null with none. */
  tendency: number | null;
  /** Items played wrong, how often, most first (then by item). */
  missed: { item: string; count: number }[];
}

export type RhythmSummaryInput = Pick<
  RhythmSessionState,
  'id' | 'level' | 'bpm' | 'length' | 'startedAt' | 'endedAt' | 'answers'
>;

export function summarizeRhythmSession(state: RhythmSummaryInput): RhythmSessionSummary {
  const { answers } = state;
  const endedAt = state.endedAt ?? answers.at(-1)?.at ?? state.startedAt;
  const correct = answers.filter((a) => a.correct).length;
  const played = answers.flatMap((a) => a.answer.deviations.flat()).filter((d) => d !== null);
  const missed = new Map<string, number>();
  for (const a of answers) if (!a.correct) missed.set(a.item, (missed.get(a.item) ?? 0) + 1);
  return {
    id: state.id,
    level: state.level,
    bpm: state.bpm,
    startedAt: state.startedAt,
    endedAt,
    activeMs: activeTime([state.startedAt, ...answers.map((a) => a.at), endedAt]),
    length: state.length,
    exercises: new Set(answers.map((a) => a.exercise)).size,
    runs: new Set(answers.map((a) => a.run)).size,
    cells: answers.length,
    correct,
    accuracy: answers.length > 0 ? correct / answers.length : null,
    medianDeviation: median(played.map(Math.abs)),
    tendency: trimmedMean(played, TENDENCY_TRIM),
    missed: [...missed]
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count || (a.item < b.item ? -1 : a.item > b.item ? 1 : 0)),
  };
}

/**
 * The summary of a session whose answers were stored but whose end was not (the tab was closed
 * mid-session). `answers` must belong to one session, in the order they happened.
 */
export function recoverRhythmSummary(
  answers: readonly RhythmAnswer[],
): RhythmSessionSummary | null {
  const first = answers[0];
  const last = answers.at(-1);
  if (!first || !last) return null;
  const exercises = new Set(answers.map((a) => a.exercise)).size;
  return summarizeRhythmSession({
    id: first.sessionId,
    level: first.level,
    bpm: first.bpm,
    length: exercises,
    startedAt: first.at,
    endedAt: last.at,
    answers,
  });
}

// --- Mastery ---------------------------------------------------------------------------------

export const RHYTHM_MASTERY_WINDOW = 40;
export const RHYTHM_MASTERY_ACCURACY = 0.9;

export interface RhythmLevelProgress {
  level: RhythmLevelId;
  /** Every cell ever played at this level. */
  total: number;
  /** Cells in the window (at most `RHYTHM_MASTERY_WINDOW`). */
  cells: number;
  accuracy: number | null;
  /** Median |deviation| of the window's onsets played. */
  medianDeviation: number | null;
  mastered: boolean;
}

/** Mastery: ≥ 90 % of the level's last 40 cells right. `answers` in the order they happened. */
export function rhythmLevelProgress(
  answers: readonly RhythmAnswer[],
  level: RhythmLevelId,
): RhythmLevelProgress {
  const ofLevel = answers.filter((a) => a.level === level);
  const window = ofLevel.slice(-RHYTHM_MASTERY_WINDOW);
  const correct = window.filter((a) => a.correct).length;
  const accuracy = window.length > 0 ? correct / window.length : null;
  const played = window.flatMap((a) => a.answer.deviations.flat()).filter((d) => d !== null);
  return {
    level,
    total: ofLevel.length,
    cells: window.length,
    accuracy,
    medianDeviation: median(played.map(Math.abs)),
    mastered:
      window.length >= RHYTHM_MASTERY_WINDOW &&
      accuracy !== null &&
      accuracy >= RHYTHM_MASTERY_ACCURACY,
  };
}

/** The first level not mastered yet, or the last once all are. */
export function suggestedRhythmLevel(
  progress: ReadonlyMap<RhythmLevelId, RhythmLevelProgress>,
): RhythmLevelId {
  return RHYTHM_LEVELS.find((l) => !progress.get(l.id)?.mastered)?.id ?? RHYTHM_LEVELS.at(-1)!.id;
}
