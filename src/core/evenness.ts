// How even a scale run was: in time (the spread of its intervals, hesitations, each note's
// deviation from a line through its neighbours, the tempo at the start and the end) and in
// loudness, per hand and per note, and the clearest problem place. Every figure is judged against
// the run itself, never against a grid: the tempo is the player's own. See docs/SCALES.md,
// "Analysis" and "Clarifications: Timing figures, Deviation per note".
//
// Hands together (asynchrony per pair) and connection (legato) are S3: they will join
// `RunAnalysis` and `HandAnalysis` as further fields beside `timing` and `loudness`; the played
// notes already carry what they need (`off`).

import { quantile, theilSen } from './robust.ts';
import { alignHand, alignHands, type HandMatch } from './scaleAlign.ts';
import type { Hand } from './score.ts';
import type { Crossing, Direction, ScaleNote } from './scaleTypes.ts';

/** One key of the run, in the order played. Held keys from before the run are not in it. */
export interface PlayedNote {
  midi: number;
  /** Onset, ms on the run's clock. */
  on: number;
  /** Release, ms; null when the key was still down at the end of the run. */
  off: number | null;
  /** 1–127; meaningless when the input measures none (see `RunInput.velocityMeasured`). */
  velocity: number;
}

export interface RunInput {
  /** The run as asked, one or both hands (`ScaleNote.hand`), each from index 0. */
  expected: readonly ScaleNote[];
  /** Note-ons in time order. */
  played: readonly PlayedNote[];
  /** False for the computer keyboard and the on-screen piano: loudness is then not measured. */
  velocityMeasured: boolean;
}

// --- Constants ------------------------------------------------------------------------------------

/**
 * Bumped whenever a rule or threshold below changes what a run's figures come out as, so figures
 * stored with a run (S2) can be told from current ones and recomputed from its raw notes.
 */
export const ANALYSIS_VERSION = 1;

/** A run is a scale run with at least this many notes played right... */
export const MIN_MATCHED = 8;
/** ...and at most this share of the notes asked for gone wrong (wrong, missed and extra notes). */
export const MAX_ERROR_SHARE = 1 / 3;

/**
 * An interval is judged against the median of this many intervals around it in the same
 * direction (the window shifted at the ends, the interval itself left out), so a run that speeds
 * up or slows down is not called uneven for it. From S0: σ = 10 ms slowing by 30 % over four
 * octaves reads 36 ms against one line per direction and SD(IOI) doubles, but ~12 ms this way.
 */
export const NEIGHBOUR_INTERVALS = 8;
/** Fewer neighbours than this (a direction nearly all missed) say nothing about an interval. */
const MIN_NEIGHBOURS = 3;

/**
 * A hesitation is an interval longer than its neighbours' median by at least this share of it...
 */
export const HESITATION_SHARE = 0.4;
/**
 * ...and by at least this many robust standard deviations of the run's excesses. At 4, S0 found
 * only half the 150 ms stops. Measured here (500 runs per case, onset jitter σ): 79 % of 150 ms
 * stops found on 250 ms notes at σ = 20 ms, 99 % of 400 ms stops at σ = 40, 53 % of 60 ms stops on
 * 125 ms notes at σ = 10; an interval flagged in 11 % of runs of a steady beginner (σ = 40 ms, 250
 * ms notes) and 9 % at σ = 25 on 125 ms notes. A stop just after a thumb note is the hardest to
 * find: the late thumb shortens the interval after it.
 */
export const HESITATION_Z = 3;
/** The median absolute deviation times this estimates the standard deviation of normal noise. */
const MAD_TO_SD = 1.4826;
/**
 * Timing is never exact to better than this (input resolution), so a perfectly steady run (a
 * sequencer, a test) does not make every interval 1 µs long a hesitation.
 */
const NOISE_FLOOR_MS = 1;
/** Fewer excesses than this in a hand cannot tell a hesitation from the run's own spread. */
const MIN_EXCESSES = 6;

/**
 * The spread is the standard deviation of the excesses times this, so that a steady player's
 * figure reads the standard deviation of the intervals (SD(IOI), the measure the literature
 * uses): the neighbours' median carries noise of its own. Simulated with steady onset jitter (200
 * runs per case, two to four octaves, σ = 5–40 ms, 125–300 ms notes, hesitations removed as
 * below), the raw figure is 1.13× SD(IOI) at two octaves and 1.14–1.15× at three and four, 1.14×
 * overall. A player whose jitter is in the intervals rather than the onsets (a clock that wanders,
 * each interval independent) reads 1.08–1.09× raw, so about 5 % low after scaling; real players
 * are a mix of the two. A test locks the scaling to ±5 % on onset jitter.
 */
export const SPREAD_SCALE = 1 / 1.14;
/**
 * With fewer intervals than this in the run (both directions, the turn left out) the spread is
 * rough: 12 per direction, as a one-octave run has 12 in all and two octaves 26. A missed or wrong
 * note takes two, so two octaves with one slip still count and one octave never does. At σ = 20 ms
 * (SD(IOI) 28 ms) one octave reads 20–42 ms (10–90 %), two octaves 22–35 ms.
 */
export const MIN_INTERVALS = 24;

/**
 * A note's deviation is its onset against a Theil–Sen line through the notes around it: the
 * window is this many notes of its direction centred on it (shifted at the ends), the note itself
 * left out, so six are fitted (S0's window). One line per direction instead shrinks a bump by the
 * drift it has to absorb (S0: 21 ms for 25). Measured here, a thumb 25 ms late at σ = 15 ms reads
 * 24 ms against the other notes and 21–23 ms as shown (the lines pass partly through the other
 * thumb notes), with or without a 25 % drift over four octaves.
 */
export const FIT_WINDOW = 7;
/** A line needs this many notes. */
const MIN_FIT_NOTES = 3;

/** The tempo at the start and at the end: the median of this many intervals there. */
export const TEMPO_INTERVALS = 7;

/** Velocities are taken against the median of this many neighbours on each side (same direction). */
export const VELOCITY_NEIGHBOURS = 3;
/**
 * An accent is a note at least this many velocity units above its neighbours' median. Provisional:
 * the thresholds are set in S1 from runs recorded on real instruments (docs/SCALES.md, "Still
 * open for S1"); velocity curves differ between instruments. Simulated, velocity noise of σ = 3
 * crosses it in 0.7 % of two-octave runs, σ = 4 in 11 % and σ = 6 in 64 %.
 */
export const ACCENT_VELOCITY = 12;

/**
 * The clearest problem place: the crossings of one kind in one direction of one hand (e.g. the
 * thumb passing under going up) whose mean deviation is at least this far from zero...
 */
export const PROBLEM_MIN_MS = 15;
/**
 * ...and this many standard errors, the standard error being the hand's robust deviation spread
 * (1.4826 × MAD over its notes, the turn left out) over √n. The hand's spread rather than the
 * group's own: two or three notes give no usable standard deviation of their own. Simulated
 * (500 runs): a steady player (σ = 20 ms, two octaves) is given a place in 6 % of runs; a thumb 25
 * ms late at σ = 15 is named in 44 % of two-octave runs and 90 % of four-octave ones. Over several
 * runs (S2) the same rule gets the power a single run lacks.
 */
export const PROBLEM_MIN_Z = 2;
/** A place needs at least this many notes in the run. */
const PROBLEM_MIN_NOTES = 2;

// --- Output ---------------------------------------------------------------------------------------

export type RunQuality = 'ok' | 'not-a-scale-run';

export interface Counts {
  /** Notes asked for. */
  expected: number;
  /** Played with the right key. */
  matched: number;
  /** Played with a wrong key where the note was due. */
  wrong: number;
  missed: number;
}

export interface RunCounts extends Counts {
  /** Played notes that are no note of the run (in hands together they belong to neither hand). */
  extra: number;
}

export interface Hesitation {
  /** Expected index of the note after the pause. */
  index: number;
  /** How much longer the interval was than its neighbours' median, ms. */
  excess: number;
}

export interface Timing {
  /**
   * The spread of the intervals, each against the median of its neighbours, hesitations left out,
   * in ms: for a steady player, the standard deviation of the intervals. Null with too few.
   */
  spread: number | null;
  /** The spread in % of the median interval (a slow scale and a fast one compare). */
  spreadShare: number | null;
  /** Fewer than `MIN_INTERVALS` intervals in the run: the spread is rough. */
  rough: boolean;
  /** Intervals the figures come from (both directions, turn and hesitations left out). */
  intervals: number;
  hesitations: Hesitation[];
  /** Median interval of the run, ms. */
  medianInterval: number | null;
  /** Median of the first and of the last `TEMPO_INTERVALS` intervals, ms: the drift. */
  startInterval: number | null;
  endInterval: number | null;
}

export interface Loudness {
  /** Median velocity of the hand's notes. */
  medianVelocity: number | null;
  /** IQR of the velocities, each against the median of its neighbours. Null with too few. */
  spread: number | null;
  /** Expected indexes of the accented notes. */
  accents: number[];
}

export type NoteOutcome = 'played' | 'wrong' | 'missed';

/** One expected note: where it sits in the scale and how it was played. For the profile chart. */
export interface NoteFigures {
  index: number;
  midi: number;
  degree: number;
  direction: Direction;
  turn: boolean;
  finger: number | null;
  crossing: Crossing;
  outcome: NoteOutcome;
  /** The played note (the right key or the wrong one), index into `RunInput.played`. */
  played: number | null;
  /** The interval from the previous note, ms, when both were played right with nothing between. */
  interval: number | null;
  /** The interval into the turn or out of it: shown, but left out of the figures. */
  turnInterval: boolean;
  /** Excess of a hesitation just before this note, ms. */
  hesitation: number | null;
  /** Onset against the line through its neighbours, ms (early −, late +), gaps closed. */
  deviation: number | null;
  velocity: number | null;
  /** Velocity against the median of its neighbours; null when not measured. */
  velocityResidual: number | null;
  accent: boolean;
}

export interface HandAnalysis {
  hand: Hand;
  counts: Counts;
  timing: Timing;
  /** Null: not measured (the input has no velocity) — never zero. */
  loudness: Loudness | null;
  notes: NoteFigures[];
}

export interface ProblemPlace {
  hand: Hand;
  direction: Direction;
  crossing: Exclude<Crossing, null>;
  /** Expected indexes of the notes it rests on. */
  indexes: number[];
  /** Mean deviation of those notes, ms (early −, late +). */
  deviation: number;
  standardError: number;
}

export interface RunAnalysis {
  quality: RunQuality;
  counts: RunCounts;
  /** Played notes that are no note of the run, indexes into `RunInput.played`. */
  extra: number[];
  velocityMeasured: boolean;
  /** Right hand first. */
  hands: HandAnalysis[];
  /** From this run alone; S2 adds the places irregular over the last runs. */
  problem: ProblemPlace | null;
}

/** What a session keeps of a run, for lists and trends (the run itself keeps the raw notes). */
export interface RunHeadline {
  /** `ANALYSIS_VERSION` when it was computed: stored figures of an older one are recomputed. */
  version: number;
  quality: RunQuality;
  counts: RunCounts;
  velocityMeasured: boolean;
  hands: {
    hand: Hand;
    spread: number | null;
    spreadShare: number | null;
    rough: boolean;
    hesitations: number;
    medianInterval: number | null;
  }[];
}

// --- Analysis -------------------------------------------------------------------------------------

/** Aligns the run, checks it is a scale run, and measures it. */
export function analyzeRun(input: RunInput): RunAnalysis {
  const byHand = (hand: Hand) =>
    input.expected.filter((n) => n.hand === hand).sort((a, b) => a.index - b.index);
  const expected = { right: byHand('right'), left: byHand('left') };
  const hands = (['right', 'left'] as const).filter((h) => expected[h].length > 0);
  const keys = input.played.map((p) => p.midi);

  const matches = {} as Record<Hand, HandMatch>;
  let extra: number[];
  if (hands.length === 2) {
    const a = alignHands(
      keys,
      expected.right.map((n) => n.midi),
      expected.left.map((n) => n.midi),
    );
    matches.right = a.right;
    matches.left = a.left;
    extra = a.extra;
  } else if (hands.length === 1) {
    const a = alignHand(
      keys,
      expected[hands[0]!].map((n) => n.midi),
    );
    matches[hands[0]!] = a;
    extra = a.extra;
  } else {
    extra = keys.map((_, i) => i);
  }

  const analyses = hands.map((hand) =>
    analyzeHand(hand, expected[hand], matches[hand], extra, input),
  );
  const counts: RunCounts = { expected: 0, matched: 0, wrong: 0, missed: 0, extra: extra.length };
  for (const a of analyses) {
    counts.expected += a.counts.expected;
    counts.matched += a.counts.matched;
    counts.wrong += a.counts.wrong;
    counts.missed += a.counts.missed;
  }
  const quality = runQuality(counts);
  return {
    quality,
    counts,
    extra,
    velocityMeasured: input.velocityMeasured,
    hands: analyses,
    // A place is only named in a scale run: in anything else the notes are not where they seem.
    problem: quality === 'ok' ? findProblemPlace(analyses) : null,
  };
}

/**
 * At least `MIN_MATCHED` notes played right and at most `MAX_ERROR_SHARE` of the notes asked for
 * gone wrong: a restart, or playing around before the tonic, is not a scale run.
 */
export function runQuality(counts: RunCounts): RunQuality {
  const errors = counts.wrong + counts.missed + counts.extra;
  return counts.matched >= MIN_MATCHED && errors <= MAX_ERROR_SHARE * counts.expected
    ? 'ok'
    : 'not-a-scale-run';
}

/** The figures a session keeps. */
export function runHeadline(run: RunAnalysis): RunHeadline {
  return {
    version: ANALYSIS_VERSION,
    quality: run.quality,
    counts: run.counts,
    velocityMeasured: run.velocityMeasured,
    hands: run.hands.map((h) => ({
      hand: h.hand,
      spread: h.timing.spread,
      spreadShare: h.timing.spreadShare,
      rough: h.timing.rough,
      hesitations: h.timing.hesitations.length,
      medianInterval: h.timing.medianInterval,
    })),
  };
}

/** An interval between two consecutive notes of a hand, both played right. */
interface Interval {
  /** Expected index of the note it leads into. */
  into: number;
  ms: number;
  direction: Direction;
  /** Into the turning note or out of it. */
  turn: boolean;
  /** Against the median of its neighbours; null with too few neighbours or at the turn. */
  excess: number | null;
  /** That median. */
  around: number | null;
  hesitation: boolean;
}

function analyzeHand(
  hand: Hand,
  notes: readonly ScaleNote[],
  match: HandMatch,
  extra: readonly number[],
  input: RunInput,
): HandAnalysis {
  const n = notes.length;
  const turn = turnIndex(notes);
  const onset = match.played.map((p) => (p === null ? null : input.played[p]!.on));
  const intervals = measureIntervals(match, onset, extra, turn);
  const timing = summarizeTiming(intervals);

  // Close the gaps: a hesitation delays every note after it, a step that would break the lines.
  const closed = onset.map((t, j) => {
    if (t === null) return null;
    let shift = 0;
    for (const h of timing.hesitations) if (h.index <= j) shift += h.excess;
    return t - shift;
  });
  const deviation = localResiduals(closed, turn, FIT_WINDOW, (xs, ys, x) => {
    const line = theilSen(xs, ys);
    return line && line.intercept + line.slope * x;
  });

  const velocity = match.played.map((p) =>
    p === null || !input.velocityMeasured ? null : input.played[p]!.velocity,
  );
  const velocityResidual = input.velocityMeasured
    ? localResiduals(velocity, turn, 2 * VELOCITY_NEIGHBOURS + 1, (_xs, ys) => quantile(ys, 0.5))
    : velocity.map(() => null);
  const accent = velocityResidual.map((r, j) => r !== null && j !== turn && r >= ACCENT_VELOCITY);

  const wrongAt = new Map(match.wrong.map((w) => [w.index, w.played]));
  const intervalInto = new Map(intervals.map((iv) => [iv.into, iv]));
  const figures: NoteFigures[] = notes.map((note, j) => {
    const iv = intervalInto.get(j);
    const wrongPlayed = wrongAt.get(j);
    return {
      index: j,
      midi: note.midi,
      degree: note.degree,
      direction: note.direction,
      turn: j === turn,
      finger: note.finger,
      crossing: note.crossing,
      outcome: match.played[j] !== null ? 'played' : wrongPlayed !== undefined ? 'wrong' : 'missed',
      played: match.played[j] ?? wrongPlayed ?? null,
      interval: iv ? iv.ms : null,
      turnInterval: j === turn || j === turn + 1,
      hesitation: iv?.hesitation ? iv.excess : null,
      deviation: deviation[j]!,
      velocity: velocity[j]!,
      velocityResidual: velocityResidual[j]!,
      accent: accent[j]!,
    };
  });

  let loudness: Loudness | null = null;
  if (input.velocityMeasured) {
    const residuals = velocityResidual.filter((r, j): r is number => r !== null && j !== turn);
    const q1 = quantile(residuals, 0.25);
    const q3 = quantile(residuals, 0.75);
    loudness = {
      medianVelocity: quantile(
        velocity.filter((v): v is number => v !== null),
        0.5,
      ),
      spread: residuals.length >= MIN_FIT_NOTES && q1 !== null && q3 !== null ? q3 - q1 : null,
      accents: figures.filter((f) => f.accent).map((f) => f.index),
    };
  }

  const matched = match.played.filter((p) => p !== null).length;
  return {
    hand,
    counts: { expected: n, matched, wrong: match.wrong.length, missed: match.missed.length },
    timing,
    loudness,
    notes: figures,
  };
}

/** The top note: the last one going up. */
function turnIndex(notes: readonly ScaleNote[]): number {
  const marked = notes.findIndex((n) => n.turn);
  if (marked >= 0) return marked;
  const firstDown = notes.findIndex((n) => n.direction === 'down');
  return firstDown > 0 ? firstDown - 1 : notes.length - 1;
}

/**
 * The intervals of a hand. An interval exists only between two consecutive notes of the run both
 * played with the right key and with no extra note played between them: a missed or wrong note
 * breaks the two intervals around it (an interval over two notes is no interval of the scale), and
 * a slip inside an interval is a mistake, not unevenness. The intervals into the turning note and
 * out of it are kept for the chart but take no part in the figures: a turn may breathe.
 */
function measureIntervals(
  match: HandMatch,
  onset: readonly (number | null)[],
  extra: readonly number[],
  turn: number,
): Interval[] {
  const intervals: Interval[] = [];
  for (let j = 1; j < onset.length; j++) {
    const a = match.played[j - 1];
    const b = match.played[j];
    if (a === null || b === null) continue;
    if (extra.some((x) => x > a! && x < b!)) continue;
    intervals.push({
      into: j,
      ms: onset[j]! - onset[j - 1]!,
      direction: j <= turn ? 'up' : 'down',
      turn: j === turn || j === turn + 1,
      excess: null,
      around: null,
      hesitation: false,
    });
  }

  // Each interval against the median of its neighbours in the same direction. The window runs
  // over the intervals there are, so a missed note does not narrow it.
  for (const direction of ['up', 'down'] as const) {
    const list = intervals.filter((iv) => iv.direction === direction && !iv.turn);
    const half = NEIGHBOUR_INTERVALS / 2;
    list.forEach((iv, p) => {
      const lo = Math.max(0, Math.min(p - half, list.length - 1 - NEIGHBOUR_INTERVALS));
      const hi = Math.min(list.length - 1, Math.max(p + half, NEIGHBOUR_INTERVALS));
      const around: number[] = [];
      for (let q = lo; q <= hi; q++) if (q !== p) around.push(list[q]!.ms);
      if (around.length < MIN_NEIGHBOURS) return;
      iv.around = quantile(around, 0.5)!;
      iv.excess = iv.ms - iv.around;
    });
  }

  // Hesitations first, so one stop does not hide how even the rest was.
  const judged = intervals.filter((iv) => iv.excess !== null);
  if (judged.length >= MIN_EXCESSES) {
    const excesses = judged.map((iv) => iv.excess!);
    const centre = quantile(excesses, 0.5)!;
    const robustSd = Math.max(
      NOISE_FLOOR_MS,
      MAD_TO_SD *
        quantile(
          excesses.map((e) => Math.abs(e - centre)),
          0.5,
        )!,
    );
    for (const iv of judged) {
      iv.hesitation =
        iv.excess! >= HESITATION_SHARE * iv.around! && iv.excess! >= HESITATION_Z * robustSd;
    }
  }
  return intervals;
}

function summarizeTiming(intervals: readonly Interval[]): Timing {
  const counted = intervals.filter((iv) => !iv.turn);
  const rough = counted.length < MIN_INTERVALS;
  const hesitations = counted
    .filter((iv) => iv.hesitation)
    .map((iv) => ({ index: iv.into, excess: iv.excess! }));

  const steady = counted.filter((iv) => !iv.hesitation);
  const excesses = steady.filter((iv) => iv.excess !== null).map((iv) => iv.excess!);
  const medianInterval = quantile(
    steady.map((iv) => iv.ms),
    0.5,
  );
  const sd = standardDeviation(excesses);
  const spread = sd === null ? null : sd * SPREAD_SCALE;

  const edge = Math.min(TEMPO_INTERVALS, Math.floor(steady.length / 2));
  const edgeMedian = (list: readonly Interval[]) =>
    edge === 0
      ? null
      : quantile(
          list.map((iv) => iv.ms),
          0.5,
        );
  return {
    spread,
    spreadShare:
      spread !== null && medianInterval !== null && medianInterval > 0
        ? (100 * spread) / medianInterval
        : null,
    rough,
    intervals: excesses.length,
    hesitations,
    medianInterval,
    startInterval: edgeMedian(steady.slice(0, edge)),
    endInterval: edgeMedian(steady.slice(steady.length - edge)),
  };
}

/** Sample standard deviation; null for fewer than three values. */
function standardDeviation(values: readonly number[]): number | null {
  if (values.length < 3) return null;
  const mean = values.reduce((a, v) => a + v, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (values.length - 1));
}

/**
 * Each value against a local fit of its neighbours in the same direction: the `window` values of
 * that direction centred on it (shifted at the ends), the value itself left out, positions x being
 * the notes' indexes in the run (so a missed note leaves a gap in x, not a shift). The turning note
 * belongs to the notes going up, as a neighbour and for its own figure, and not to those going
 * down: a turn may breathe, and a pause after the top note would otherwise pull the first notes
 * down off their line. Simulated (two octaves, σ = 15 ms, 400 runs; median |deviation| of the six
 * notes around the turn): no pause 12.1 ms (11.9 with the turn in both directions, 13.0 in
 * neither), a 100 ms pause after the top 11.6 ms (14.4 in both), the top note 100 ms late 14.5 ms
 * (17.5 in both, 12.1 in neither, which in turn blurs the notes near the top when nothing happens).
 */
function localResiduals(
  values: readonly (number | null)[],
  turn: number,
  window: number,
  predict: (xs: number[], ys: number[], x: number) => number | null,
): (number | null)[] {
  const out: (number | null)[] = values.map(() => null);
  const half = Math.floor(window / 2);
  for (const [from, to] of [
    [0, turn],
    [turn + 1, values.length - 1],
  ] as const) {
    const present: number[] = [];
    for (let j = from; j <= to; j++) if (values[j] !== null) present.push(j);
    present.forEach((j, p) => {
      const lo = Math.max(0, Math.min(p - half, present.length - window));
      const hi = Math.min(present.length - 1, lo + window - 1);
      const xs: number[] = [];
      const ys: number[] = [];
      for (let q = lo; q <= hi; q++) {
        if (q === p) continue;
        xs.push(present[q]!);
        ys.push(values[present[q]!]!);
      }
      if (xs.length < MIN_FIT_NOTES) return;
      const expected = predict(xs, ys, j);
      if (expected !== null) out[j] = values[j]! - expected;
    });
  }
  return out;
}

/**
 * The clearest problem place in this run: of the crossings of one kind in one direction of one
 * hand, with at least `PROBLEM_MIN_NOTES` deviations, those whose mean deviation is at least
 * `PROBLEM_MIN_MS` and `PROBLEM_MIN_Z` standard errors from zero; the one furthest in standard
 * errors wins. The turning note never counts (a turn may breathe).
 */
export function findProblemPlace(hands: readonly HandAnalysis[]): ProblemPlace | null {
  let best: { place: ProblemPlace; z: number } | null = null;
  for (const h of hands) {
    const measured = h.notes.filter((n) => n.deviation !== null && !n.turn);
    const devs = measured.map((n) => n.deviation!);
    const centre = quantile(devs, 0.5);
    if (centre === null) continue;
    const spread = Math.max(
      NOISE_FLOOR_MS,
      MAD_TO_SD *
        quantile(
          devs.map((d) => Math.abs(d - centre)),
          0.5,
        )!,
    );
    const groups = new Map<string, NoteFigures[]>();
    for (const n of measured) {
      if (n.crossing === null) continue;
      const key = `${n.direction}:${n.crossing}`;
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
    for (const group of groups.values()) {
      if (group.length < PROBLEM_MIN_NOTES) continue;
      const mean = group.reduce((a, n) => a + n.deviation!, 0) / group.length;
      const standardError = spread / Math.sqrt(group.length);
      const z = Math.abs(mean) / standardError;
      if (Math.abs(mean) < PROBLEM_MIN_MS || z < PROBLEM_MIN_Z) continue;
      if (best && z <= best.z) continue;
      best = {
        place: {
          hand: h.hand,
          direction: group[0]!.direction,
          crossing: group[0]!.crossing!,
          indexes: group.map((n) => n.index),
          deviation: mean,
          standardError,
        },
        z,
      };
    }
  }
  return best?.place ?? null;
}
