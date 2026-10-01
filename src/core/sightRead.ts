// Sight-reading on Read (docs/READING.md, "Sight-reading (R3)"): a fragment played in time (rhythm
// mode's plan and matcher, nothing waits) or in wait mode, judged bar by bar; a session of 4 or 8
// fragments, stored as one record of kind `sight` with each fragment's level, seed and generator
// version and each run's figures (never the notes played); and each level's mastery. As in
// `rhythmRead.ts`, `time` values are milliseconds on a run's clock and `at` values epoch ms.

import { activeTime } from './activity.ts';
import { performanceOrder } from './repeats.ts';
import { rhythmPlan, type RhythmPlan, type StepTiming } from './rhythm.ts';
import { inTime, wholeMs } from './rhythmRead.ts';
import { TENDENCY_TRIM } from './rhythmRun.ts';
import { trimmedMean } from './robust.ts';
import { TICKS_PER_QUARTER, type Measure, type Score, type Step } from './score.ts';
import { median } from './session.ts';
import { SIGHT_LEVELS, getSightLevel, sightSixteenths, type SightLevelId } from './sightLevels.ts';
import type { StepRecord } from './wait.ts';

// --- Settings --------------------------------------------------------------------------------

/** In time (rhythm mode, the default) or in wait mode (for a first look). */
export type SightPlay = 'time' | 'wait';
export const SIGHT_PLAYS: readonly SightPlay[] = ['time', 'wait'];

/**
 * Read ahead (in time only): off; `on`, the bar being played covered as its first beat arrives;
 * `hard`, covered from the half bar before.
 */
export type ReadAhead = 'off' | 'on' | 'hard';
export const READ_AHEADS: readonly ReadAhead[] = ['off', 'on', 'hard'];

/** Fragments a session can have. */
export const SIGHT_SESSION_LENGTHS = [4, 8] as const;
export type SightSessionLength = (typeof SIGHT_SESSION_LENGTHS)[number];
export const DEFAULT_SIGHT_SESSION_LENGTH: SightSessionLength = 4;

/** Seconds to look at a fragment before its run, as in an exam; Start skips them. */
export const LOOK_SECONDS = [10, 15, 20, 25, 30] as const;
export type LookSeconds = (typeof LOOK_SECONDS)[number];
export const DEFAULT_LOOK_SECONDS: LookSeconds = 20;

export const SIGHT_MIN_BPM = 40;
export const SIGHT_MAX_BPM = 160;

/** Quarters a minute a level starts at: 72, or 60 where it draws sixteenths (F8). */
export function defaultSightBpm(level: SightLevelId): number {
  return sightSixteenths(getSightLevel(level)) ? 60 : 72;
}

export const isSightBpm = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= SIGHT_MIN_BPM && (v as number) <= SIGHT_MAX_BPM;

// --- The plan --------------------------------------------------------------------------------

/**
 * Rhythm mode's plan of a fragment at `bpm` quarters a minute: a bar of count-in, the clicks, each
 * step's window. The last bar is held from its downbeat by both hands (sightFragment.ts), so the
 * plan gives it one beat: the run ends a beat after the last notes are struck, as R1's do.
 */
export function sightPlan(
  score: Pick<Score, 'measures'>,
  steps: readonly Step[],
  bpm: number,
): RhythmPlan {
  const last = score.measures.length - 1;
  const measures: Measure[] = score.measures.map((m, i) =>
    i === last ? { ...m, duration: (4 * TICKS_PER_QUARTER) / m.beatType } : m,
  );
  const plan = rhythmPlan({
    score: { measures, tempos: [{ tick: 0, bpm }] },
    order: performanceOrder(measures),
    steps,
    loop: null,
    startBar: 0,
    scale: 1,
  });
  if (!plan) throw new Error('A fragment always has a plan');
  return plan;
}

// --- Judging a run in time -------------------------------------------------------------------

/** How a note of the fragment was played: in time, early, late (the right key), or missed. */
export type NoteInk = 'in' | 'early' | 'late' | 'missed';

/** A bar's figures. `wrong` notes are missed keys whose step got another key instead. */
export interface BarFigures {
  bar: number;
  /** Keys asked for. */
  notes: number;
  inTime: number;
  early: number;
  late: number;
  wrong: number;
  missed: number;
  extras: number;
}

/** What a run in time comes to: plain data, stored in the session record (without `bars`). */
export interface TimeRunFigures {
  mode: 'time';
  /** Quarters a minute. */
  bpm: number;
  readAhead: ReadAhead;
  /** Epoch ms: the first downbeat, and the end of the run. */
  startedAt: number;
  endedAt: number;
  notes: number;
  inTime: number;
  early: number;
  late: number;
  wrong: number;
  missed: number;
  extras: number;
  /** Median |deviation| of the keys played; null with none. */
  medianDeviation: number | null;
  /** Rhythm mode's tendency (trimmed mean, early −, late +); null with none. */
  tendency: number | null;
}

/** What a run in wait mode comes to: the keys asked and the wrong ones pressed. */
export interface WaitRunFigures {
  mode: 'wait';
  startedAt: number;
  endedAt: number;
  notes: number;
  wrong: number;
}

export type SightRunFigures = TimeRunFigures | WaitRunFigures;

/** A run judged: its figures, each bar's, and each note's ink (by the score's note id). */
export interface SightRun {
  figures: SightRunFigures;
  bars: BarFigures[];
  ink: Map<string, NoteInk>;
}

const emptyBar = (bar: number): BarFigures => ({
  bar,
  notes: 0,
  inTime: 0,
  early: 0,
  late: 0,
  wrong: 0,
  missed: 0,
  extras: 0,
});

/** The share of a run's keys played right and in time: what mastery counts. */
export function inTimeShare(f: Pick<TimeRunFigures, 'notes' | 'inTime'>): number {
  return f.notes === 0 ? 0 : f.inTime / f.notes;
}

/**
 * Judges a run in time from what rhythm mode's matcher settled (`timings`, the steps of `steps`,
 * built from `score`). Deviations are whole ms, in time within `IN_TIME_MS`; a missed key whose
 * step drew a note-on matching nothing is a wrong note, and the note-ons left over are extras.
 */
export function judgeTimeRun(
  score: Pick<Score, 'notes' | 'measures'>,
  steps: readonly Step[],
  timings: readonly StepTiming[],
  context: Pick<TimeRunFigures, 'bpm' | 'readAhead' | 'startedAt' | 'endedAt'>,
): SightRun {
  const perBar = score.measures.map((_, bar) => emptyBar(bar));
  const keyOf = new Map(score.notes.map((n) => [n.id, n.midi]));
  const ink = new Map<string, NoteInk>();
  const deviations: number[] = [];
  const settled = new Map(timings.map((t) => [t.step, t]));
  for (const step of steps) {
    const bar = perBar[step.measure]!;
    const timing = settled.get(step.index);
    const played = step.midis.map((midi) => {
      const raw = timing?.notes.find((n) => n.midi === midi)?.deviation;
      return { midi, deviation: raw === undefined || raw === null ? null : wholeMs(raw) };
    });
    const missed = played.filter((p) => p.deviation === null).length;
    const extra = timing?.extra ?? 0;
    const wrong = Math.min(missed, extra);
    bar.notes += played.length;
    bar.wrong += wrong;
    bar.missed += missed - wrong;
    bar.extras += extra - wrong;
    for (const p of played) {
      if (p.deviation === null) continue;
      deviations.push(p.deviation);
      if (inTime(p.deviation)) bar.inTime++;
      else if (p.deviation < 0) bar.early++;
      else bar.late++;
    }
    for (const id of step.noteIds) {
      const deviation = played.find((p) => p.midi === keyOf.get(id))?.deviation ?? null;
      ink.set(id, inkOf(deviation));
    }
  }
  inkTies(score, ink);
  const sum = (key: keyof Omit<BarFigures, 'bar'>) => perBar.reduce((s, b) => s + b[key], 0);
  return {
    figures: {
      mode: 'time',
      ...context,
      notes: sum('notes'),
      inTime: sum('inTime'),
      early: sum('early'),
      late: sum('late'),
      wrong: sum('wrong'),
      missed: sum('missed'),
      extras: sum('extras'),
      medianDeviation: median(deviations.map(Math.abs)),
      tendency: trimmedMean(deviations, TENDENCY_TRIM),
    },
    bars: perBar,
    ink,
  };
}

function inkOf(deviation: number | null): NoteInk {
  if (deviation === null) return 'missed';
  if (inTime(deviation)) return 'in';
  return deviation < 0 ? 'early' : 'late';
}

/** A tie's second note takes the ink of the note it continues. */
function inkTies(score: Pick<Score, 'notes'>, ink: Map<string, NoteInk>): void {
  for (const note of score.notes) {
    if (!note.tieStop) continue;
    const from = score.notes.findLast(
      (n) => n.onset < note.onset && n.midi === note.midi && n.hand === note.hand,
    );
    const value = from ? ink.get(from.id) : undefined;
    if (value) ink.set(note.id, value);
  }
}

// --- Judging a run in wait mode --------------------------------------------------------------

/** A run in wait mode, from the steps it completed (wait.ts): wrong keys per bar. */
export function judgeWaitRun(
  score: Pick<Score, 'notes' | 'measures'>,
  steps: readonly Step[],
  records: readonly StepRecord[],
  context: Pick<WaitRunFigures, 'startedAt' | 'endedAt'>,
): SightRun {
  const perBar = score.measures.map((_, bar) => emptyBar(bar));
  const ink = new Map<string, NoteInk>();
  const byStep = new Map(records.map((r) => [r.step, r]));
  for (const step of steps) {
    const bar = perBar[step.measure]!;
    bar.notes += step.midis.length;
    const record = byStep.get(step.index);
    bar.wrong += record?.wrong ?? 0;
    if (record) bar.inTime += step.midis.length;
    for (const id of step.noteIds) ink.set(id, record ? 'in' : 'missed');
  }
  inkTies(score, ink);
  return {
    figures: {
      mode: 'wait',
      ...context,
      notes: perBar.reduce((s, b) => s + b.notes, 0),
      wrong: perBar.reduce((s, b) => s + b.wrong, 0),
    },
    bars: perBar,
    ink,
  };
}

// --- A session -------------------------------------------------------------------------------

/** A fragment of a session as stored: what makes it again, and every run of it. */
export interface SightFragmentRecord {
  seed: number;
  version: number;
  runs: SightRunFigures[];
}

export interface SightSessionState {
  id: string;
  level: SightLevelId;
  /** Fragments planned. */
  length: number;
  startedAt: number;
  endedAt: number | null;
  phase: 'running' | 'done';
  /** The fragments so far, the one on the stand last (it may have no run yet). */
  fragments: readonly SightFragmentRecord[];
  /** The last run of the fragment on the stand, once played. */
  last: SightRun | null;
}

export function startSightSession(options: {
  id: string;
  level: SightLevelId;
  length: number;
  at: number;
  seed: number;
  version: number;
}): SightSessionState {
  return {
    id: options.id,
    level: options.level,
    length: options.length,
    startedAt: options.at,
    endedAt: null,
    phase: 'running',
    fragments: [{ seed: options.seed, version: options.version, runs: [] }],
    last: null,
  };
}

/** A run played to its end: its figures go with the fragment on the stand. */
export function recordSightRun(state: SightSessionState, run: SightRun): SightSessionState {
  if (state.phase !== 'running') return state;
  const fragments = state.fragments.map((f, i) =>
    i === state.fragments.length - 1 ? { ...f, runs: [...f.runs, run.figures] } : f,
  );
  return { ...state, fragments, last: run };
}

/** "Next": a new fragment, or the end of the session after the last one. */
export function nextSightFragment(
  state: SightSessionState,
  seed: number,
  version: number,
  at: number,
): SightSessionState {
  if (state.phase !== 'running') return state;
  if (state.fragments.length >= state.length) return endSightSession(state, at);
  return {
    ...state,
    fragments: [...state.fragments, { seed, version, runs: [] }],
    last: null,
  };
}

export function endSightSession(state: SightSessionState, at: number): SightSessionState {
  if (state.phase === 'done') return state;
  return { ...state, phase: 'done', endedAt: at };
}

/** A session as stored: the fragments played (at least one run each) and their runs. */
export interface SightSessionSummary {
  id: string;
  level: SightLevelId;
  startedAt: number;
  /** The end of its last run: the record is stored again after every run. */
  endedAt: number;
  /** Time spent; pauses longer than `IDLE_MS` count as `IDLE_MS`. */
  activeMs: number;
  /** Fragments planned. */
  length: number;
  fragments: SightFragmentRecord[];
}

/** The session as it is stored; null while no run was played. */
export function summarizeSightSession(
  state: Pick<SightSessionState, 'id' | 'level' | 'length' | 'startedAt' | 'fragments'>,
): SightSessionSummary | null {
  const fragments = state.fragments
    .filter((f) => f.runs.length > 0)
    .map((f) => ({ seed: f.seed, version: f.version, runs: [...f.runs] }));
  const runs = fragments.flatMap((f) => f.runs);
  if (runs.length === 0) return null;
  const endedAt = Math.max(...runs.map((r) => r.endedAt));
  const moments = [state.startedAt, ...runs.flatMap((r) => [r.startedAt, r.endedAt])].sort(
    (a, b) => a - b,
  );
  return {
    id: state.id,
    level: state.level,
    startedAt: state.startedAt,
    endedAt,
    activeMs: activeTime(moments),
    length: state.length,
    fragments,
  };
}

/** How many runs a session has: of two copies of it, the one with more is the later. */
export const sightRunCount = (s: Pick<SightSessionSummary, 'fragments'>): number =>
  s.fragments.reduce((n, f) => n + f.runs.length, 0);

/** A fragment's run that counts: its first in time (sight-reading is the first reading). */
export function firstTimeRun(f: Pick<SightFragmentRecord, 'runs'>): TimeRunFigures | null {
  return f.runs.find((r): r is TimeRunFigures => r.mode === 'time') ?? null;
}

// --- Mastery ---------------------------------------------------------------------------------

export const SIGHT_MASTERY_FRAGMENTS = 5;
export const SIGHT_MASTERY_SHARE = 0.9;

export interface SightLevelProgress {
  level: SightLevelId;
  /** Fragments ever played in time at this level. */
  total: number;
  /** The shares right and in time of the last ones (at most `SIGHT_MASTERY_FRAGMENTS`). */
  window: number[];
  mastered: boolean;
}

/**
 * Mastery: the last 5 fragments played in time each had at least 90 % of their notes right and in
 * time, each by its first run in time. `sessions` in any order.
 */
export function sightLevelProgress(
  sessions: readonly SightSessionSummary[],
  level: SightLevelId,
): SightLevelProgress {
  const runs = sessions
    .filter((s) => s.level === level)
    .flatMap((s) => s.fragments.map(firstTimeRun))
    .filter((r) => r !== null)
    .sort((a, b) => a.startedAt - b.startedAt);
  const window = runs.slice(-SIGHT_MASTERY_FRAGMENTS).map(inTimeShare);
  return {
    level,
    total: runs.length,
    window,
    mastered:
      window.length >= SIGHT_MASTERY_FRAGMENTS && window.every((s) => s >= SIGHT_MASTERY_SHARE),
  };
}

/** The first level not mastered yet, or the last once all are. */
export function suggestedSightLevel(
  progress: ReadonlyMap<SightLevelId, SightLevelProgress>,
): SightLevelId {
  return SIGHT_LEVELS.find((l) => !progress.get(l.id)?.mastered)?.id ?? SIGHT_LEVELS.at(-1)!.id;
}
