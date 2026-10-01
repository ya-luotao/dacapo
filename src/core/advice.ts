// What to work on next (docs/ADVICE.md): after a run, at most one sentence of advice, chosen by a
// fixed order of rules from the figures its summary already shows, with the action that does it.
// The rules draw no line of their own: they use the review's (`CLEAN_NOTES`, `POOR_NOTES`,
// `IN_TIME_SHARE`, `SLOW_BAR`) and rhythm mode's (`TENDENCY_MS`). Pure: figures in, an `Advice`
// (the rule, the values its sentence takes, the action as data) or null out; the UI turns it into
// words and a button.

import { MEMORY_STAGES, promptsByBar, type MemoryStage } from './memory.ts';
import {
  evenBars,
  gradeFigures,
  IN_TIME_SHARE,
  POOR_NOTES,
  slowBars,
  type ReviewGrade,
  type ReviewSchedule,
} from './review.ts';
import { loopableDrift, TENDENCY_MS, type RhythmSummary } from './rhythmRun.ts';
import type { DriftDirection } from './drift.ts';
import type { Hand, HandSelection } from './score.ts';
import { LADDER_STEP, SCORE_TEMPO, tempoBelow } from './tempoLadder.ts';

/** What an advice's button does: it sets the page up, and the run starts. */
export type AdviceAction =
  /** One hand alone. */
  | { kind: 'hands'; hands: Hand }
  /** Loop written bars `from`–`to`. */
  | { kind: 'loop'; from: number; to: number }
  /** Rhythm mode, at a percent of the score's tempo. */
  | { kind: 'rhythm'; tempo: number }
  /** Memory mode with more of the score hidden. */
  | { kind: 'stage'; stage: MemoryStage }
  /** The same again at another tempo. */
  | { kind: 'tempo'; tempo: number }
  /** The latency calibration. */
  | { kind: 'calibrate' };

type Loop = Extract<AdviceAction, { kind: 'loop' }>;

/** The advice after a run of a piece: the rule that applied, with its figures and its action. */
export type PieceAdvice =
  /** Many wrong notes with both hands: one hand at a time first. */
  | {
      rule: 'oneHand';
      wrong: number;
      steps: number;
      action: Extract<AdviceAction, { kind: 'hands' }>;
    }
  /** Many wrong notes with one hand: a few bars at a time. */
  | { rule: 'fewBars'; wrong: number; steps: number; action: Loop }
  /** A bar took over twice as long as the rest. */
  | { rule: 'slowBar'; measure: number; action: Loop }
  /** Memory mode: the bar that needed most prompts. */
  | { rule: 'promptedBar'; measure: number; prompts: number; action: Loop }
  /** Clean and even: now in time, at the ladder's next rung. */
  | { rule: 'toRhythm'; tempo: number; action: Extract<AdviceAction, { kind: 'rhythm' }> }
  /** Clean and even by heart: now with more of the score hidden. */
  | { rule: 'toStage'; stage: MemoryStage; action: Extract<AdviceAction, { kind: 'stage' }> }
  /** Notes went missing: twenty less. */
  | {
      rule: 'missed';
      missed: number;
      extra: number;
      notes: number;
      tempo: number;
      action: Extract<AdviceAction, { kind: 'tempo' }>;
    }
  /** Not in time: ten less. */
  | {
      rule: 'notInTime';
      inTime: number;
      notes: number;
      tempo: number;
      action: Extract<AdviceAction, { kind: 'tempo' }>;
    }
  /** A stretch where the tempo moved: loop it with the click. */
  | { rule: 'drift'; direction: DriftDirection; action: Loop }
  /**
   * Early (−) or late (+) throughout, in ms. Late without a calibration, the delay may be the
   * computer's: the action is the calibration. Otherwise there is nothing to press.
   */
  | { rule: 'tendency'; ms: number; action: Extract<AdviceAction, { kind: 'calibrate' }> | null }
  /** Clean and in time: the ladder's next rung. */
  | {
      rule: 'nextTempo';
      tempo: number;
      action: Extract<AdviceAction, { kind: 'tempo' }>;
    }
  /** Clean and in time at the score's tempo (or beyond): nothing further is advised. */
  | { rule: 'scoreTempo'; tempo: number; action: null };

/** "Notes went missing" takes the tempo down two rungs, "not in time" one. */
export const MISSED_STEP = 2 * LADDER_STEP;

/** One step of a wait-mode or memory-mode run, as its summary counts it. */
export interface WaitStep {
  /** Written measure index. */
  measure: number;
  ms: number;
  wrong: number;
  /** Memory mode: the prompts on the step. */
  prompts?: number;
  /** The hand that plays the step when only one does: its wrong notes are that hand's. */
  hand?: Hand | null;
}

/** A run in wait or memory mode, for its advice. */
export interface WaitRun {
  /** Memory mode: the stage it was played at; null in wait mode. */
  stage: MemoryStage | null;
  hands: HandSelection;
  /** The piece has notes for each hand, so one can be taken alone. */
  twoHands: boolean;
  /** Its steps, in the order played. */
  steps: readonly WaitStep[];
  /** The notes its wrong ones are counted against for the review's grade (`gradeRun`). */
  notes: number;
  /** A run to the end that counts for the ladder of its hands (`countsForLadder`). */
  whole: boolean;
  /** The ladder's next rung for its hands; null once the score's tempo is reached. */
  next: number | null;
}

/** The hand with more wrong notes, where the steps tell; the right otherwise. */
function weakerHand(steps: readonly WaitStep[]): Hand {
  const wrong = (hand: Hand) => steps.reduce((sum, s) => sum + (s.hand === hand ? s.wrong : 0), 0);
  return wrong('left') > wrong('right') ? 'left' : 'right';
}

/** The written bars of a run, in order. */
const barsOf = (steps: readonly WaitStep[]): number[] =>
  [...new Set(steps.map((s) => s.measure))].sort((a, b) => a - b);

/**
 * The bar with most wrong notes (the earliest of equals) and the bar either side, of the bars the
 * run played. Null when the run played nothing outside them: there is nothing to cut down to.
 */
function barsToLoop(steps: readonly WaitStep[]): Loop | null {
  const bars = barsOf(steps);
  const wrong = new Map<number, number>();
  for (const s of steps) wrong.set(s.measure, (wrong.get(s.measure) ?? 0) + s.wrong);
  let worst = 0;
  bars.forEach((bar, i) => {
    if (wrong.get(bar)! > wrong.get(bars[worst]!)!) worst = i;
  });
  const from = bars[Math.max(0, worst - 1)]!;
  const to = bars[Math.min(bars.length - 1, worst + 1)]!;
  return from === bars[0] && to === bars.at(-1) ? null : { kind: 'loop', from, to };
}

/**
 * After a run in wait or memory mode (docs/ADVICE.md, "After a run in wait or memory mode"); the
 * first rule that applies:
 *
 * 1. many wrong notes (more than 1 in `POOR_NOTES` steps) with both hands: one hand at a time;
 * 2. many wrong notes with one hand: the bar with most of them and the bar either side;
 * 3. a bar that held the run up (its mean step over `SLOW_BAR` times the median; by heart, the
 *    bar that needed most prompts): loop it;
 * 4. a run to the end the review grades better: rhythm mode at the ladder's next rung; by heart,
 *    the next stage while there is one.
 */
export function waitAdvice(run: WaitRun): PieceAdvice | null {
  const { steps } = run;
  if (steps.length === 0) return null;
  const wrong = steps.reduce((sum, s) => sum + s.wrong, 0);

  if (wrong * POOR_NOTES > steps.length) {
    if (run.hands === 'both' && run.twoHands)
      return {
        rule: 'oneHand',
        wrong,
        steps: steps.length,
        action: { kind: 'hands', hands: weakerHand(steps) },
      };
    const loop = barsToLoop(steps);
    if (loop) return { rule: 'fewBars', wrong, steps: steps.length, action: loop };
  }

  // A bar stands out only against others: a run of one bar has none to loop out of.
  if (barsOf(steps).length > 1) {
    const prompted = run.stage === null ? undefined : promptsByBar(steps)[0];
    if (prompted) {
      const { measure, prompts } = prompted;
      return {
        rule: 'promptedBar',
        measure,
        prompts,
        action: { kind: 'loop', from: measure, to: measure },
      };
    }
    const slow = slowBars(steps)[0];
    if (slow)
      return {
        rule: 'slowBar',
        measure: slow.measure,
        action: { kind: 'loop', from: slow.measure, to: slow.measure },
      };
  }

  if (!run.whole || gradeFigures(wrong, run.notes, evenBars(steps)) !== 'better') return null;
  const stage =
    run.stage === null ? undefined : MEMORY_STAGES[MEMORY_STAGES.indexOf(run.stage) + 1];
  if (stage) return { rule: 'toStage', stage, action: { kind: 'stage', stage } };
  if (run.next === null) return null;
  return { rule: 'toRhythm', tempo: run.next, action: { kind: 'rhythm', tempo: run.next } };
}

/** A run in rhythm mode, for its advice. */
export interface RhythmRun {
  /** Percent of the score's tempo it was played at. */
  tempo: number;
  /** Its summary's figures. */
  summary: Pick<
    RhythmSummary,
    'notes' | 'inTime' | 'missed' | 'extra' | 'tendency' | 'drift' | 'wholeRun'
  >;
  /** The latency was calibrated in this browser. */
  calibrated: boolean;
  /** A run to the end that counts for the ladder of its hands (`countsForLadder`). */
  whole: boolean;
  /** The ladder's next rung with this run counted; null once the score's tempo is reached. */
  next: number | null;
}

/**
 * After a run in rhythm mode (docs/ADVICE.md, "After a run in rhythm mode"); the first rule that
 * applies:
 *
 * 1. notes went missing (missed and extra over 1 in `POOR_NOTES`): twenty less, not under the
 *    slowest;
 * 2. not in time (under `IN_TIME_SHARE` of the notes): ten less;
 * 3. a stretch where the tempo moved that can be looped: loop it;
 * 4. always early or late (the tendency at `TENDENCY_MS` or beyond, the tempo otherwise steady):
 *    the calibration when the run was late and the latency was never calibrated;
 * 5. a run to the end the review grades better: the ladder's next rung, or nothing further at the
 *    score's tempo.
 *
 * At the slowest tempo there is nothing slower to take, so 1 and 2 do not apply there.
 */
export function rhythmAdvice(run: RhythmRun): PieceAdvice | null {
  const { tempo, summary } = run;
  const { notes, missed, extra, inTime, tendency } = summary;
  if (notes === 0) return null;
  const errors = missed + extra;

  if (errors * POOR_NOTES > notes) {
    const lower = tempoBelow(tempo, MISSED_STEP);
    if (lower !== null)
      return {
        rule: 'missed',
        missed,
        extra,
        notes,
        tempo,
        action: { kind: 'tempo', tempo: lower },
      };
  }
  if (inTime < IN_TIME_SHARE * notes) {
    const lower = tempoBelow(tempo, LADDER_STEP);
    if (lower !== null)
      return { rule: 'notInTime', inTime, notes, tempo, action: { kind: 'tempo', tempo: lower } };
  }

  const stretch = loopableDrift(summary);
  if (stretch)
    return {
      rule: 'drift',
      direction: stretch.direction,
      action: { kind: 'loop', from: stretch.from.measure, to: stretch.to.measure },
    };

  if (summary.drift.length === 0 && tendency !== null && Math.abs(tendency) >= TENDENCY_MS)
    return {
      rule: 'tendency',
      ms: tendency,
      // A delay of the computer's makes the notes late, never early.
      action: tendency > 0 && !run.calibrated ? { kind: 'calibrate' } : null,
    };

  if (!run.whole || gradeFigures(errors, notes, inTime >= IN_TIME_SHARE * notes) !== 'better')
    return null;
  if (run.next !== null)
    return { rule: 'nextTempo', tempo, action: { kind: 'tempo', tempo: run.next } };
  return tempo >= SCORE_TEMPO ? { rule: 'scoreTempo', tempo, action: null } : null;
}

/** What a run did to the piece's review, and in how many days it comes back. */
export interface ReviewLine {
  /** It came into review, or it was reviewed and the interval went up, stayed, or went down. */
  kind: 'new' | ReviewGrade;
  days: number;
}

/**
 * The line under the advice (docs/ADVICE.md, "What the run did to the review"), from the piece's
 * schedule without the run and with it. Null when the run set no date (not a run to the end, or
 * one before the date due: those count only for the figures) and when the piece was taken out of
 * review.
 */
export function reviewLine(
  before: ReviewSchedule | null,
  after: ReviewSchedule | null,
  out: boolean,
): ReviewLine | null {
  if (out || !after) return null;
  if (!before) return { kind: 'new', days: after.interval };
  if (after.last.sessionId === before.last.sessionId) return null;
  return { kind: after.last.grade, days: after.interval };
}
