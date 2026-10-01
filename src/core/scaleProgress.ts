// Progress on the scales: per exercise, how even the runs have been lately and over the weeks,
// and which exercise to play next (scaleRanking.ts, from the headline figures the sessions keep);
// and, over the last runs of one exercise (re-analysed from their raw notes), where the same
// place is off every time. See docs/SCALES.md, "Analysis → Where" and "Records and progress".

import {
  analyzeRun,
  PROBLEM_MIN_MS,
  PROBLEM_MIN_Z,
  runFigures,
  type HandFigures,
} from './evenness.ts';
import { quantile } from './robust.ts';
import type { StoredScaleRun } from './scaleRecords.ts';
import { parseExerciseKey, scaleNotes } from './scales.ts';
import { stepsOf, type Crossing, type Direction } from './scaleTypes.ts';
import type { Hand } from './score.ts';

// --- Progress per exercise -----------------------------------------------------------------------

// A run's figures are read where its headline is made, and the exercises are ranked in a file of
// their own: what needs only them (an assignment's checklist and today's plan on the home page)
// then loads without the exercises' rules.
export { runFigures, type HandFigures };
export {
  byWeakness,
  playedLately,
  RECENT_RUNS,
  scaleProgress,
  SUGGEST_DAYS,
  suggestedExercise,
  TREND_DAYS,
  weakestLately,
  type ExerciseProgress,
} from './scaleRanking.ts';

const median = (values: readonly number[]) => quantile(values, 0.5);

// --- Places over runs ----------------------------------------------------------------------------

/** Over-run figures need at least this many runs (the spec's 3). */
export const MIN_RUNS = 3;
/** By default the places are judged on the last this many runs. */
export const PLACE_RUNS = 10;
/**
 * A crossing place (the crossings of one kind, direction and hand) is named at this many standard
 * errors: S1's `PROBLEM_MIN_Z`, since a hand has at most two such places per direction.
 */
export const CROSSING_MIN_Z = PROBLEM_MIN_Z;
/**
 * A degree place (the notes of one degree, direction and hand that are no crossing) needs more:
 * a hand has some ten of them against two crossing places. Simulated (300 exercises per case, C
 * major two octaves, σ = 15–25 ms, 3–10 runs), a steady player gets a degree place in 5–21 % of
 * exercises at 2.5 standard errors and 3–10 % at 3, where a thumb 25 ms late also pulls the lines
 * enough that a note beside it is named in up to 19 % of four-octave exercises. At 3.5 both stay
 * under 10 % (the figures in `placesOverRuns`).
 */
export const DEGREE_MIN_Z = 3.5;
/**
 * Hands together each hand has its own places, twice the tests, and a steady player was named
 * falsely in up to 12 % of exercises (1,000 simulated, C major two octaves, σ = 25 ms, 3 runs; 13 %
 * over 300), 11 points of it at crossing places: no degree threshold alone gets it under 10 % (at
 * 4.5 it is still 10 %). At 2.2 standard errors for a crossing place it is 8.5 % there and 0–9 % in
 * every case, at the cost of a late thumb over 3 runs at σ = 25 (named in 71 % instead of 80 %).
 * At 2.1 it is 9.8 %, too close.
 */
export const CROSSING_MIN_Z_TWO_HANDS = 2.2;
/**
 * Hands together, a thumb late in both hands pulls the lines of notes beside it in both, and one of
 * them was named in up to 17 % of exercises at 3.5 (C major four octaves, σ = 25 ms, 10 runs) and
 * 8 % at 3.75, which keeps both hands to the one-hand standard: under 10 % either way.
 */
export const DEGREE_MIN_Z_TWO_HANDS = 3.75;
/** The median absolute deviation times this estimates the standard deviation of normal noise. */
const MAD_TO_SD = 1.4826;
/** Timing is never exact to better than this (input resolution). */
const NOISE_FLOOR_MS = 1;

/** One expected note over the last runs: its figures for the profile chart and the table. */
export interface PlaceOverRuns {
  /** Expected index in the hand's run. */
  index: number;
  hand: Hand;
  direction: Direction;
  crossing: Crossing;
  degree: number;
  turn: boolean;
  /** Runs in which it was played with the right key and has a deviation. */
  runs: number;
  /** Mean deviation over those runs, ms (early −, late +). */
  irregularity: number;
  /** IQR of those deviations, ms. */
  instability: number;
  /**
   * SD of those deviations / √runs. Descriptive only: from 3–5 values the SD is noise of its own
   * (at 3 runs a "2 standard errors" test on it is really a t test at 2 degrees of freedom, whose
   * 5 % point is 4.3), so `irregular` does not use it.
   */
  standardError: number;
}

/**
 * A place irregular over the last runs, in one direction of one hand: either the crossings of one
 * kind (`crossing` set, as S1's `ProblemPlace`, so a summary can tell when a run and its
 * predecessors agree), or the notes of one degree that are no crossing (`degree` set).
 */
export interface IrregularPlace {
  hand: Hand;
  direction: Direction;
  /** A crossing place: its kind; null for a degree place. */
  crossing: Crossing;
  /**
   * A degree place: its degree (0-based from the tonic), or in a pattern its place in the group;
   * null for a crossing place.
   */
  degree: number | null;
  /** The notes are a pattern's (`ScaleNote.pattern`): `degree` is the place in the group. */
  pattern?: true;
  /** Expected indexes of the notes it rests on. */
  indexes: number[];
  /** Runs with at least one of those notes measured, and the deviations counted. */
  runs: number;
  notes: number;
  /** Mean deviation of those notes over the runs, ms (early −, late +). */
  irregularity: number;
  /** IQR of the same deviations, ms. */
  instability: number;
  /** The hand's robust deviation spread over the runs / √notes. */
  standardError: number;
}

export interface PlacesOverRuns {
  /** Runs used: of the last ones asked for, the scale runs. */
  runs: number;
  /** Every expected note measured in at least `MIN_RUNS` runs, right hand first, in run order. */
  places: PlaceOverRuns[];
  /** Strongest (most standard errors from zero) first. */
  irregular: IrregularPlace[];
}

/**
 * Over the last `last` runs of one exercise, re-analysed from their raw notes: each note's
 * deviations (the `places`) and the places named irregular. A run that is not a scale run under
 * today's analysis is skipped (its notes are not where they seem); runs of more than one exercise
 * are an error, since their notes do not line up.
 *
 * Places are named by groups over the runs, never note by note: in one direction of one hand, the
 * crossings of one kind (the thumb passing under, a finger crossing over), and, for the notes that
 * are no crossing (all of them in a scale without fingering), the notes of one degree, the run's
 * first and last notes left out. A group is named when it was measured in at least `MIN_RUNS`
 * runs and its mean deviation is at least `PROBLEM_MIN_MS` from zero and `CROSSING_MIN_Z` (a
 * crossing) or `DEGREE_MIN_Z` (a degree) standard errors — hands together, with twice the places,
 * `CROSSING_MIN_Z_TWO_HANDS` and `DEGREE_MIN_Z_TWO_HANDS` — the standard error being the hand's
 * robust deviation spread over all its notes and runs (1.4826 × MAD, the turn left out) over the
 * square root of the group's deviations. The turning note is never named (a turn may breathe).
 *
 * The spec's first reading — each note against its own SD over the runs — names a place for a
 * steady player in 62 % (two octaves) and 85 % (four) of exercises at σ = 15 ms over 5 runs, and
 * in 80–94 % at σ = 25 ms over 10: an SD of 3–10 values is noise of its own and some 28–56 notes
 * are tested at once. As built (300 exercises per case, 250 ms notes, onset jitter σ = 15 and 25
 * ms, 3, 5 and 10 runs, two and four octaves, C major either hand and A natural minor): a steady
 * player is named in 0–9 % of exercises; a thumb 25 ms late in every run is named in 92–100 % at σ
 * = 15 and 54–96 % at σ = 25, and a note of no crossing (A, going up, in C major) 38–100 % and
 * 7–97 %, with 0–9 % of exercises naming some other place beside it. In A natural minor, which
 * has no fingering, the thumb's notes (where A harmonic minor puts it) are degree places: 25 ms
 * late, they are named in 24–100 % at σ = 15 and 5–96 % at σ = 25, and a note beside them in up
 * to 12 % (22 % at 3 standard errors, where the thumb is named more often: 47–100 % and 12–99 %).
 * One octave, where each place has one note per run, is named less often (thumb: 61–98 % at
 * σ = 15) and a steady player at most 9 % of the time. Hands together (the same cases, each hand
 * jittered on its own), a steady player is named in 0–8 % of exercises (0–13 % at the one-hand
 * thresholds); a thumb 25 ms late in both hands in 100 % at σ = 15 and 74–100 % at σ = 25, A going
 * up in the right hand in 30–100 % and 4–96 %, and A natural minor's thumb notes in 41–100 % and
 * 6–99 %, with 0–9 % of exercises naming some other place beside them. Real hands keep time
 * together more than independent ones, so their false namings coincide more and are fewer.
 */
export function placesOverRuns(runs: readonly StoredScaleRun[], last = PLACE_RUNS): PlacesOverRuns {
  if (runs.length === 0) return { runs: 0, places: [], irregular: [] };
  const exercise = runs[0]!.exercise;
  if (runs.some((r) => r.exercise !== exercise))
    throw new Error(`runs of more than one exercise: ${exercise} and others`);
  const parsed = parseExerciseKey(exercise);
  if (!parsed) throw new Error(`not an exercise key: ${exercise}`);
  const notes = scaleNotes(parsed);
  const expected = [...notes.right, ...notes.left];
  // One place per step: a chord's lowest key stands for it, as in the analysis.
  const right = stepsOf(notes.right).map((step) => step[0]!);
  const left = stepsOf(notes.left).map((step) => step[0]!);
  const twoHands = right.length > 0 && left.length > 0;
  const crossingMinZ = twoHands ? CROSSING_MIN_Z_TWO_HANDS : CROSSING_MIN_Z;
  const degreeMinZ = twoHands ? DEGREE_MIN_Z_TWO_HANDS : DEGREE_MIN_Z;

  const recent = [...runs]
    .sort((a, b) => b.startedAt - a.startedAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
    .slice(0, Math.max(0, last));
  // Per hand and expected index: the deviation in each run used (one per run at most), and the run.
  const deviations = {
    right: right.map(() => [] as Measured[]),
    left: left.map(() => [] as Measured[]),
  };
  let used = 0;
  for (const run of recent) {
    const analysis = analyzeRun({
      expected,
      played: run.keys,
      velocityMeasured: run.velocityMeasured,
    });
    if (analysis.quality !== 'ok') continue;
    used++;
    for (const hand of analysis.hands) {
      for (const note of hand.notes) {
        if (note.outcome === 'played' && note.deviation !== null)
          deviations[hand.hand][note.index]!.push({ run: used, deviation: note.deviation });
      }
    }
  }

  const places: PlaceOverRuns[] = [];
  const irregular: { place: IrregularPlace; z: number }[] = [];
  for (const [hand, notes] of [
    ['right', right],
    ['left', left],
  ] as const) {
    const byIndex = deviations[hand];
    for (const note of notes) {
      const d = byIndex[note.index]!.map((m) => m.deviation);
      if (d.length < MIN_RUNS) continue;
      places.push({
        index: note.index,
        hand,
        direction: note.direction,
        crossing: note.crossing,
        degree: note.degree,
        turn: note.turn,
        runs: d.length,
        irregularity: mean(d),
        instability: iqr(d),
        standardError: sampleSd(d) / Math.sqrt(d.length),
      });
    }

    // The hand's spread over every note and run, the turn left out (a turn may breathe).
    const all = notes.flatMap((n) => (n.turn ? [] : byIndex[n.index]!.map((m) => m.deviation)));
    const centre = median(all);
    if (centre === null) continue;
    const spread = Math.max(
      NOISE_FLOOR_MS,
      MAD_TO_SD * median(all.map((v) => Math.abs(v - centre)))!,
    );
    const groups = new Map<string, typeof notes>();
    const lastIndex = notes.length - 1;
    for (const n of notes) {
      if (n.turn) continue;
      // The first and last notes' lines are fitted from one side only: their deviations spread
      // about a quarter more (21–22 ms against 17 at σ = 15), too much for a place of their own.
      if (n.crossing === null && (n.index === 0 || n.index === lastIndex)) continue;
      const key =
        n.crossing === null ? `${n.direction}:${n.degree}` : `${n.direction}:${n.crossing}`;
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
    for (const group of groups.values()) {
      const crossing = group[0]!.crossing;
      const measured = group.flatMap((n) => byIndex[n.index]!);
      const runsWith = new Set(measured.map((m) => m.run)).size;
      const d = measured.map((m) => m.deviation);
      if (runsWith < MIN_RUNS) continue;
      const irregularity = mean(d);
      const standardError = spread / Math.sqrt(d.length);
      const z = Math.abs(irregularity) / standardError;
      const minZ = crossing === null ? degreeMinZ : crossingMinZ;
      if (Math.abs(irregularity) < PROBLEM_MIN_MS || z < minZ) continue;
      irregular.push({
        place: {
          hand,
          direction: group[0]!.direction,
          crossing,
          degree: crossing === null ? group[0]!.degree : null,
          ...(crossing === null && group[0]!.pattern && { pattern: true as const }),
          indexes: group.filter((n) => byIndex[n.index]!.length > 0).map((n) => n.index),
          runs: runsWith,
          notes: d.length,
          irregularity,
          instability: iqr(d),
          standardError,
        },
        z,
      });
    }
  }
  irregular.sort((a, b) => b.z - a.z);
  return { runs: used, places, irregular: irregular.map((i) => i.place) };
}

interface Measured {
  /** Which of the runs used. */
  run: number;
  deviation: number;
}

const mean = (values: readonly number[]) => values.reduce((a, v) => a + v, 0) / values.length;

function iqr(values: readonly number[]): number {
  return quantile(values, 0.75)! - quantile(values, 0.25)!;
}

/** Sample standard deviation (n − 1); callers pass at least `MIN_RUNS` values. */
function sampleSd(values: readonly number[]): number {
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}
