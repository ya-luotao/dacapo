// How you are doing (docs/PROGRESS.md, "Trends (Q1)"): one figure per practice and week over the
// last 26 weeks, and the last four weeks against the four before. Everything is recomputed from
// the stored records; nothing is stored. A week is the owner's week, as the year grid has it
// (`yearGrid` in streak.ts), and records count for the local date they were made on.

import {
  isChordSymbolAnswer,
  isEarAnswer,
  isRhythmAnswer,
  isRhythmEarAnswer,
  isTheoryAnswer,
  type Answer,
} from './answers.ts';
import type { SessionRecord } from './log.ts';
import { stepMode, type PieceStep } from './pieceRecords.ts';
import { runFigures } from './scaleProgress.ts';
import { parseExerciseKey } from './scales.ts';
import { isTimed, median, type Attempt } from './session.ts';
import { firstTimeRun } from './sightRead.ts';
import { addDays, dayKey, weekday, type DayKey } from './streak.ts';
import { isTechnique } from './technique.ts';

/** The weeks shown: half a year, the week under way the last. */
export const TREND_WEEKS = 26;
/** The comparison: the last this many weeks (the one under way included) against as many before. */
export const COMPARE_WEEKS = 4;
/** A chart needs this many counted weeks; with fewer it is left out. */
export const MIN_WEEKS = 3;
/** A time or a spread within this share of the earlier one is "about the same". */
export const SAME_WITHIN = 0.05;
/**
 * A share within this many percentage points of the earlier one is "about the same": near 90 %,
 * 5 % of the figure would be 4 or 5 points, which is a real change.
 */
export const SAME_WITHIN_POINTS = 0.02;
export type TrendPractice =
  'reading' | 'sight' | 'theory' | 'ear' | 'rhythmEar' | 'chords' | 'inTime' | 'scales' | 'pieces';

/** In the order the section shows them: reading, then the ear, then playing. */
export const TREND_PRACTICES: readonly TrendPractice[] = [
  'reading',
  'sight',
  'theory',
  'ear',
  'rhythmEar',
  'chords',
  'inTime',
  'scales',
  'pieces',
];

export interface TrendRule {
  /** The week's figure: the median of the values, or the share of 1s among them. */
  figure: 'median' | 'share';
  better: 'lower' | 'higher';
  /** What a week is counted in: observations (answers, timed notes) or distinct runs. */
  unit: 'answers' | 'notes' | 'runs';
  /** A week counts with at least this many. */
  minimum: number;
  /** Observations carry a level, and levels differ in difficulty. */
  levels: boolean;
  /**
   * A level is compared when each period has at least this many of it, in the rule's unit: fewer,
   * and its figure is one or two answers (or one fragment), which says nothing.
   */
  levelMinimum: number;
}

const ANSWERS = { unit: 'answers', minimum: 20, levels: true, levelMinimum: 5 } as const;

const UNLEVELLED = { levels: false, levelMinimum: 0 } as const;

export const TREND_RULES: Readonly<Record<TrendPractice, TrendRule>> = {
  /** Median time of the right, un-hinted, timely answers (`attempts`). */
  reading: { figure: 'median', better: 'lower', ...ANSWERS },
  /**
   * Sight-reading (R3): the share of notes right and in time, over each fragment's first run in
   * time (what its mastery counts), counted in those runs.
   */
  sight: {
    figure: 'share',
    better: 'higher',
    unit: 'runs',
    minimum: 3,
    levels: true,
    levelMinimum: 2,
  },
  /** Share right of the theory cards' answers. */
  theory: { figure: 'share', better: 'higher', ...ANSWERS },
  /** Share right without "Hear again" of the ear answers. */
  ear: { figure: 'share', better: 'higher', ...ANSWERS },
  /** Rhythm dictation (R2): share right without "Hear again", cells tapped and bars chosen. */
  rhythmEar: { figure: 'share', better: 'higher', ...ANSWERS },
  /** Share right of the chord symbols' answers (Harmony). */
  chords: { figure: 'share', better: 'higher', ...ANSWERS },
  /** Median distance from the beat, ms, of the notes played in time with a click. */
  inTime: { figure: 'median', better: 'lower', unit: 'notes', minimum: 50, ...UNLEVELLED },
  /** Median timing spread of the scale and arpeggio runs, in % of the note length. */
  scales: { figure: 'median', better: 'lower', unit: 'runs', minimum: 3, ...UNLEVELLED },
  /** Share of the wait-mode steps played without a wrong note. */
  pieces: { figure: 'share', better: 'higher', unit: 'runs', minimum: 3, ...UNLEVELLED },
};

/** One thing measured: an answer, a note, a step or a run. */
export interface Observation {
  /** Epoch ms. */
  at: number;
  /** Ms, a distance from the beat, a spread share (%), or 1/0 for right/wrong. */
  value: number;
  level?: string;
  /** The run it belongs to, where weeks are counted in runs. */
  run?: string;
}

// --- Observations from the records ----------------------------------------------------------------

/** Reading notes: the time of each right, un-hinted, timely answer (the figure's own answers). */
export function readingObservations(attempts: readonly Attempt[]): Observation[] {
  return attempts.filter(isTimed).map((a) => ({ at: a.at, value: a.ms, level: a.level }));
}

/** Theory cards on Read: right or wrong, hinted ones too (the hint counts for accuracy). */
export function theoryObservations(answers: readonly Answer[]): Observation[] {
  return answers
    .filter(isTheoryAnswer)
    .map((a) => ({ at: a.at, value: a.correct ? 1 : 0, level: a.level }));
}

/** Ear: right without hearing it again. */
export function earObservations(answers: readonly Answer[]): Observation[] {
  return answers
    .filter(isEarAnswer)
    .map((a) => ({ at: a.at, value: a.correct && a.replays === 0 ? 1 : 0, level: a.level }));
}

/** Rhythm dictation on Ear: right without hearing it again, a cell tapped back or a bar chosen. */
export function rhythmEarObservations(answers: readonly Answer[]): Observation[] {
  return answers
    .filter(isRhythmEarAnswer)
    .map((a) => ({ at: a.at, value: a.correct && a.replays === 0 ? 1 : 0, level: a.level }));
}

/**
 * Sight-reading: each note of each fragment's first run in time, right and in time or not, by run
 * and with the session's level. A fragment played only in wait mode says nothing about reading in
 * time, and later runs of a fragment are no longer at first sight.
 */
export function sightObservations(sessions: readonly SessionRecord[]): Observation[] {
  const out: Observation[] = [];
  for (const session of sessions) {
    if (session.kind !== 'sight') continue;
    session.fragments.forEach((fragment, i) => {
      const run = firstTimeRun(fragment);
      if (!run) return;
      const id = `${session.id}:${i}`;
      for (let k = 0; k < run.notes; k++) {
        out.push({
          at: run.startedAt,
          value: k < run.inTime ? 1 : 0,
          level: session.level,
          run: id,
        });
      }
    });
  }
  return out;
}

/** Chord symbols on Harmony: right or wrong, with the notes shown or not, as theory cards. */
export function chordObservations(answers: readonly Answer[]): Observation[] {
  return answers
    .filter(isChordSymbolAnswer)
    .map((a) => ({ at: a.at, value: a.correct ? 1 : 0, level: a.level }));
}

/**
 * Read's rhythm lines (R1) and the cells of rhythm dictation tapped back (R2): how far each onset
 * tapped was from the beat, against the same click and judged by the same rule. Missed ones say
 * nothing.
 */
export function rhythmLineObservations(answers: readonly Answer[]): Observation[] {
  const out: Observation[] = [];
  const add = (at: number, deviations: readonly (number | null)[]) => {
    for (const d of deviations) if (d !== null) out.push({ at, value: Math.abs(d) });
  };
  for (const answer of answers) {
    if (isRhythmAnswer(answer)) for (const line of answer.answer.deviations) add(answer.at, line);
    else if (isRhythmEarAnswer(answer) && answer.by === 'play') {
      add(answer.at, answer.answer.deviations);
    }
  }
  return out;
}

/** A clicked scale run's notes against the click (computed from its keys and its grid). */
export function clickedRunObservations(
  at: number,
  deviations: readonly (number | null)[],
): Observation[] {
  return deviations.flatMap((d) => (d === null ? [] : [{ at, value: Math.abs(d) }]));
}

/**
 * What a piece run's steps give: in wait mode each step, right on the first try (no wrong note)
 * or not, by run; in rhythm mode each note played, by its distance from the beat.
 */
export function pieceStepObservations(steps: readonly PieceStep[]): {
  wait: Observation[];
  timed: Observation[];
} {
  const wait: Observation[] = [];
  const timed: Observation[] = [];
  for (const step of steps) {
    if (stepMode(step) === 'wait') {
      wait.push({ at: step.at, value: step.wrong === 0 ? 1 : 0, run: step.sessionId });
      continue;
    }
    for (const note of step.notes ?? []) {
      if (note.deviation !== null) timed.push({ at: step.at, value: Math.abs(note.deviation) });
    }
  }
  return { wait, timed };
}

/**
 * Scales: each scale or arpeggio run's timing spread in % of its note length, from the headline
 * its session keeps (so no run is read); figures of another analysis version are left out, as
 * everywhere. Technique runs (Hanon, chords, trills, octaves …) are left out: their spread is of
 * another kind of playing, and a week of trills would not compare with a week of scales.
 */
export function scaleObservations(sessions: readonly SessionRecord[]): Observation[] {
  const out: Observation[] = [];
  for (const session of sessions) {
    if (session.kind !== 'scale') continue;
    for (const run of session.runs) {
      const exercise = parseExerciseKey(run.exercise);
      if (!exercise || isTechnique(exercise.type)) continue;
      const share = runFigures(run.headline)?.spreadShare;
      if (share != null) out.push({ at: run.startedAt, value: share, run: run.id });
    }
  }
  return out;
}

// --- Weeks ----------------------------------------------------------------------------------------

/** The local date of an instant, remembered per quarter hour (every zone's offset is a multiple). */
export function createDayOf(timeZone?: string): (epochMs: number) => DayKey {
  const QUARTER = 15 * 60_000;
  const cache = new Map<number, DayKey>();
  return (epochMs) => {
    const bucket = Math.floor(epochMs / QUARTER);
    let day = cache.get(bucket);
    if (day === undefined) cache.set(bucket, (day = dayKey(bucket * QUARTER, timeZone)));
    return day;
  };
}

/** The first day of the week `day` is in, weeks starting on `firstDay` (1 Monday … 7 Sunday). */
export function weekStart(day: DayKey, firstDay: number): DayKey {
  return addDays(day, -((weekday(day) - firstDay + 7) % 7));
}

/** The first days of the `weeks` weeks up to and including today's, oldest first. */
export function trendWeekStarts(today: DayKey, firstDay: number, weeks = TREND_WEEKS): DayKey[] {
  const last = weekStart(today, firstDay);
  return Array.from({ length: weeks }, (_, i) => addDays(last, -7 * (weeks - 1 - i)));
}

const DAY_MS = 86_400_000;

function utcMidnight(day: DayKey): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d);
}

const dayNumber = (day: DayKey) => Math.round(utcMidnight(day) / DAY_MS);

/** No instant of `day`, in any time zone (UTC+14 is the earliest), is before this. */
export const earliestInstant = (day: DayKey) => utcMidnight(day) - 14 * 60 * 60_000;

// --- Figures --------------------------------------------------------------------------------------

export interface TrendWeek {
  /** The week's first day. */
  start: DayKey;
  /** Answers or timed notes; for runs, distinct runs. */
  count: number;
  counted: boolean;
  /** The week's figure, whether counted or not; null without observations. */
  value: number | null;
  /** The count per level, in the same unit, most first (levelled practices only; else empty). */
  levels: { level: string; count: number }[];
}

export interface LevelShare {
  level: string;
  /** 0–1 of the counted weeks' count (answers, or runs for sight-reading). */
  share: number;
}

export type Verdict = 'better' | 'same' | 'worse';

export interface TrendComparison {
  verdict: Verdict;
  /** The last `COMPARE_WEEKS` weeks' figure and the figure of the ones before. */
  recent: number;
  earlier: number;
  /**
   * The levels compared within, when the observations have levels: those both periods have at
   * least the rule's `levelMinimum` of, each weighted by its count in both, so a change of level
   * does not pass for a change of skill.
   */
  levels: string[];
  /** Levels practised in one period or the other but left out of the comparison. */
  leftOut: string[];
}

export interface Trend {
  practice: TrendPractice;
  rule: TrendRule;
  /** `TREND_WEEKS` weeks, oldest first. */
  weeks: TrendWeek[];
  /** Weeks reaching the rule's minimum. */
  counted: number;
  /** Enough counted weeks for a chart. */
  shown: boolean;
  comparison: TrendComparison | null;
  /**
   * Why there is no comparison: `few`, a period without a counted week; `levels`, no level both
   * periods have enough of. Null when there is one.
   */
  noComparison: 'few' | 'levels' | null;
  /** The share of each level over the counted weeks, most first; null without levels. */
  levels: LevelShare[] | null;
  /** The week under way so far, in the rule's unit. */
  thisWeek: number;
  /** Any observation in the weeks shown. */
  any: boolean;
}

export interface TrendOptions {
  today: DayKey;
  /** 1 Monday … 7 Sunday, as the year grid's. */
  firstDay: number;
  /** The local date of an instant (`createDayOf`). */
  dayOf: (epochMs: number) => DayKey;
}

function figureOf(rule: TrendRule, values: readonly number[]): number | null {
  if (values.length === 0) return null;
  if (rule.figure === 'median') return median(values);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function countOf(rule: TrendRule, observations: readonly Observation[]): number {
  if (rule.unit !== 'runs') return observations.length;
  return new Set(observations.map((o) => o.run ?? '')).size;
}

function byLevel(observations: readonly Observation[]): Map<string, Observation[]> {
  const out = new Map<string, Observation[]>();
  for (const o of observations) {
    const level = o.level ?? '';
    const list = out.get(level);
    if (list) list.push(o);
    else out.set(level, [o]);
  }
  return out;
}

const levelOrder = (a: string, b: string) =>
  a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });

/**
 * Better, worse or about the same: a share (0–1) by percentage points, a time or a spread relative
 * to the earlier figure.
 */
export function verdictOf(rule: TrendRule, recent: number, earlier: number): Verdict {
  let change: number;
  let within: number;
  if (rule.figure === 'share') {
    change = recent - earlier;
    within = SAME_WITHIN_POINTS;
  } else {
    const scale = Math.abs(earlier);
    change = scale === 0 ? (recent === 0 ? 0 : Math.sign(recent)) : (recent - earlier) / scale;
    within = SAME_WITHIN;
  }
  // A hair over the line from floating point stays "the same".
  if (Math.abs(change) <= within + 1e-9) return 'same';
  return change < 0 === (rule.better === 'lower') ? 'better' : 'worse';
}

function compare(
  rule: TrendRule,
  recent: readonly Observation[],
  earlier: readonly Observation[],
): Pick<Trend, 'comparison' | 'noComparison'> {
  if (!rule.levels) {
    const r = figureOf(
      rule,
      recent.map((o) => o.value),
    );
    const e = figureOf(
      rule,
      earlier.map((o) => o.value),
    );
    if (r === null || e === null) return { comparison: null, noComparison: 'few' };
    return {
      comparison: {
        verdict: verdictOf(rule, r, e),
        recent: r,
        earlier: e,
        levels: [],
        leftOut: [],
      },
      noComparison: null,
    };
  }
  const recentBy = byLevel(recent);
  const earlierBy = byLevel(earlier);
  const all = [...new Set([...recentBy.keys(), ...earlierBy.keys()])].sort(levelOrder);
  const enough = (by: Map<string, Observation[]>, level: string) =>
    countOf(rule, by.get(level) ?? []) >= rule.levelMinimum;
  const common = all.filter((level) => enough(recentBy, level) && enough(earlierBy, level));
  const inCommon = (by: Map<string, Observation[]>) =>
    countOf(
      rule,
      common.flatMap((level) => by.get(level)!),
    );
  // Within the levels both have, each period still needs a week's worth of observations.
  if (
    common.length === 0 ||
    inCommon(recentBy) < rule.minimum ||
    inCommon(earlierBy) < rule.minimum
  ) {
    return { comparison: null, noComparison: 'levels' };
  }
  let weights = 0;
  let r = 0;
  let e = 0;
  for (const level of common) {
    const a = recentBy.get(level)!;
    const b = earlierBy.get(level)!;
    const weight = countOf(rule, a) + countOf(rule, b);
    weights += weight;
    r +=
      weight *
      figureOf(
        rule,
        a.map((o) => o.value),
      )!;
    e +=
      weight *
      figureOf(
        rule,
        b.map((o) => o.value),
      )!;
  }
  r /= weights;
  e /= weights;
  return {
    comparison: {
      verdict: verdictOf(rule, r, e),
      recent: r,
      earlier: e,
      levels: common,
      leftOut: all.filter((level) => !common.includes(level)),
    },
    noComparison: null,
  };
}

/** One practice's weeks, chart and comparison from its observations (any order, any dates). */
export function trendOf(
  practice: TrendPractice,
  observations: readonly Observation[],
  { today, firstDay, dayOf }: TrendOptions,
): Trend {
  const rule = TREND_RULES[practice];
  const starts = trendWeekStarts(today, firstDay);
  const first = dayNumber(starts[0]!);
  const byWeek: Observation[][] = starts.map(() => []);
  for (const o of observations) {
    const day = dayOf(o.at);
    if (day > today) continue;
    const index = Math.floor((dayNumber(day) - first) / 7);
    if (index >= 0 && index < TREND_WEEKS) byWeek[index]!.push(o);
  }

  const weeks: TrendWeek[] = byWeek.map((list, i) => {
    const count = countOf(rule, list);
    const levels = rule.levels
      ? [...byLevel(list)]
          .map(([level, os]) => ({ level, count: countOf(rule, os) }))
          .sort((a, b) => b.count - a.count || levelOrder(a.level, b.level))
      : [];
    return {
      start: starts[i]!,
      count,
      counted: count >= rule.minimum,
      value: figureOf(
        rule,
        list.map((o) => o.value),
      ),
      levels,
    };
  });
  const counted = weeks.filter((w) => w.counted).length;

  let levels: LevelShare[] | null = null;
  if (rule.levels) {
    const totals = new Map<string, number>();
    let all = 0;
    weeks.forEach((week) => {
      if (!week.counted) return;
      for (const { level, count } of week.levels) {
        totals.set(level, (totals.get(level) ?? 0) + count);
        all += count;
      }
    });
    levels = [...totals]
      .map(([level, count]) => ({ level, share: count / all }))
      .sort((a, b) => b.share - a.share || levelOrder(a.level, b.level));
  }

  // Each period needs a counted week; its figure is then pooled over all its observations.
  const recentWeeks = weeks.slice(-COMPARE_WEEKS);
  const earlierWeeks = weeks.slice(-2 * COMPARE_WEEKS, -COMPARE_WEEKS);
  const enough =
    counted >= MIN_WEEKS &&
    recentWeeks.some((w) => w.counted) &&
    earlierWeeks.some((w) => w.counted);
  const { comparison, noComparison } = enough
    ? compare(
        rule,
        byWeek.slice(-COMPARE_WEEKS).flat(),
        byWeek.slice(-2 * COMPARE_WEEKS, -COMPARE_WEEKS).flat(),
      )
    : { comparison: null, noComparison: 'few' as const };

  return {
    practice,
    rule,
    weeks,
    counted,
    shown: counted >= MIN_WEEKS,
    comparison,
    noComparison,
    levels,
    thisWeek: weeks.at(-1)!.count,
    any: byWeek.some((list) => list.length > 0),
  };
}

/** Observations loaded on demand (piece steps, clicked scale runs); null while they load. */
export interface LoadedObservations {
  pieceWait: readonly Observation[];
  /** Rhythm-mode piece notes and clicked scale runs' notes. */
  timed: readonly Observation[];
}

export interface TrendInput {
  attempts: readonly Attempt[];
  answers: readonly Answer[];
  sessions: readonly SessionRecord[];
  loaded: LoadedObservations | null;
}

/**
 * Every practice's trend; in time and pieces are null while their records load. Records clearly
 * older than the weeks shown are skipped before their date is worked out.
 */
export function trends(
  { attempts, answers, sessions, loaded }: TrendInput,
  options: TrendOptions,
): Record<TrendPractice, Trend | null> {
  const since = earliestInstant(trendWeekStarts(options.today, options.firstDay)[0]!);
  const recent = <T extends { at: number }>(list: readonly T[]) =>
    list.filter((x) => x.at >= since);
  const fresh = recent(answers);
  return {
    reading: trendOf('reading', readingObservations(recent(attempts)), options),
    sight: trendOf('sight', recent(sightObservations(sessions)), options),
    theory: trendOf('theory', theoryObservations(fresh), options),
    ear: trendOf('ear', earObservations(fresh), options),
    rhythmEar: trendOf('rhythmEar', rhythmEarObservations(fresh), options),
    chords: trendOf('chords', chordObservations(fresh), options),
    inTime: loaded
      ? trendOf('inTime', [...rhythmLineObservations(fresh), ...recent(loaded.timed)], options)
      : null,
    scales: trendOf('scales', recent(scaleObservations(sessions)), options),
    pieces: loaded ? trendOf('pieces', recent(loaded.pieceWait), options) : null,
  };
}
