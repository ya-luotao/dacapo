// What to work on next (docs/ADVICE.md): after a run or a session, at most one sentence of advice,
// chosen by a fixed order of rules from the figures its summary already shows, with the action
// that does it.
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
import { CLICK_MAX_BPM, CLICK_MIN_BPM } from './scaleClick.ts';
import type { LevelFamily } from './assignmentRecords.ts';
import type { DriftDirection } from './drift.ts';
import type { Hand, HandSelection } from './score.ts';
import { SESSION_LENGTHS } from './session.ts';
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
 * The calibration, for notes late throughout when the latency was never calibrated: a delay of
 * the computer's makes notes late, never early.
 */
const calibration = (
  tendency: number,
  calibrated: boolean,
): Extract<AdviceAction, { kind: 'calibrate' }> | null =>
  tendency > 0 && !calibrated ? { kind: 'calibrate' } : null;

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
    return { rule: 'tendency', ms: tendency, action: calibration(tendency, run.calibrated) };

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

// --- Scales and technique -------------------------------------------------------------------------

/**
 * What a sentence of a scale run's verdict says (docs/SCALES.md, "After a run"), in the words of
 * the Scales page: the kind of each finding, in the verdict's order.
 */
export type ScaleFinding =
  | 'stopped'
  /** A trill's and repeated notes' own sentences. */
  | 'trill'
  | 'repeats'
  /** The clearest problem place: a crossing late or early, or a note of each group of a pattern. */
  | 'thumbUnder'
  | 'fingerOver'
  | 'pattern'
  /** How the chords were struck. */
  | 'chords'
  /** Against the click: on it, after it, before it, or too few notes in time to tell. */
  | 'onClick'
  | 'clickLate'
  | 'clickEarly'
  | 'noTendency'
  | 'hesitation'
  /** The hands: one ahead, or apart often or at places; or together. */
  | 'apart'
  | 'together'
  /** How the keys were joined, and the pedal. */
  | 'connection'
  | 'pedal'
  /** The tempo moved from the start of the run to its end. */
  | 'faster'
  | 'slower'
  | 'loudness';

/** What a scale advice's button does. */
export type ScaleAction =
  /** A focus loop round the place the summary offers. */
  | { kind: 'loop' }
  /** With the click, at a tempo. */
  | { kind: 'click'; bpm: number }
  /** The same exercise with one hand. */
  | { kind: 'hands'; hands: Hand }
  | { kind: 'calibrate' };

type Click = Extract<ScaleAction, { kind: 'click' }>;

/** The advice after a scale run: the row of the table that applied, its figures and its action. */
export type ScaleAdvice =
  /** Too many mistakes to measure: slower; the click a fifth under the run's tempo, if it is known. */
  | { rule: 'slower'; action: Click | null }
  /** A place to loop: a crossing, a note of each group, a hesitation. */
  | {
      rule: 'thumbUnder' | 'fingerOver' | 'pattern' | 'hesitation';
      action: Extract<ScaleAction, { kind: 'loop' }>;
    }
  /** The tempo moved: the click at the tempo the run started at, `perBeat` notes to the beat. */
  | { rule: 'startTempo'; bpm: number; perBeat: number; action: Click }
  /** The hands apart: each alone first. */
  | { rule: 'eachHand'; action: Extract<ScaleAction, { kind: 'hands' }> }
  /** Before (−) or after (+) the click throughout, in ms: as rhythm mode's tendency. */
  | { rule: 'tendency'; ms: number; action: Extract<ScaleAction, { kind: 'calibrate' }> | null }
  /** Even with the click: the next tempo. */
  | { rule: 'evenClick'; bpm: number; action: Click }
  /** Even at free tempo: next, with the click, at the run's tempo. */
  | { rule: 'even'; action: Click };

/** "Slower": the click a fifth under the run's tempo. */
export const SLOWER_SHARE = 0.8;
/** "Even at ♩ = 60: next, ♩ = 68": the step from one tempo to the next. */
export const EVEN_STEP_BPM = 8;

/** A scale run, for its advice. */
export interface ScaleRun {
  /** The run could be measured (its quality is ok): not too many mistakes. */
  measured: boolean;
  /** A trill, repeated notes or chords: their verdicts get no advice yet (provisional thresholds). */
  provisional: boolean;
  /** The verdict's findings, every one, in its order. */
  findings: readonly ScaleFinding[];
  /** How many of them the verdict shows. */
  shown: number;
  /** The summary offers a place to loop (`weakestPlace`). */
  place: boolean;
  /** Played with the click: its tempo, and the tendency against it. */
  click: { bpm: number; tendency: number | null } | null;
  /** Notes to the beat of the grid: the click's, or what the click would be set to. */
  perBeat: number;
  /** Notes a second: over the run, and at its start; null when not measured. */
  tempo: number | null;
  startTempo: number | null;
  /** The latency was calibrated in this browser. */
  calibrated: boolean;
}

/** Beats a minute for `perSecond` notes a second, `perBeat` to the beat; null when not measured. */
const beats = (perSecond: number | null, perBeat: number): number | null =>
  perSecond === null || perBeat <= 0 ? null : (perSecond * 60) / perBeat;

/** A tempo the click can be set to: whole, and null outside its range. */
function clickTempo(bpm: number | null): number | null {
  if (bpm === null) return null;
  const whole = Math.round(bpm);
  return whole >= CLICK_MIN_BPM && whole <= CLICK_MAX_BPM ? whole : null;
}

/**
 * After a scale run (docs/ADVICE.md, "Scales and technique"): the advice for the first sentence
 * the verdict shows that the table has a row for. Sentences it has none for (the run stopped, how
 * the keys were joined, the loudness) are passed over; "even" is said when no sentence of the
 * whole verdict names a problem, the run was played to its end and, with the click, kept to it.
 */
export function scaleAdvice(run: ScaleRun): ScaleAdvice | null {
  if (run.provisional) return null;
  const { click, perBeat } = run;
  // The run's tempo in beats a minute: the click's, or what its notes a second come to.
  const played = click ? click.bpm : beats(run.tempo, perBeat);

  if (!run.measured) {
    // A fifth under the run's tempo, no faster than the click goes; nothing under its slowest.
    const slower =
      played === null ? null : clickTempo(Math.min(CLICK_MAX_BPM, played * SLOWER_SHARE));
    return { rule: 'slower', action: slower === null ? null : { kind: 'click', bpm: slower } };
  }

  const advised = (finding: ScaleFinding): ScaleAdvice | null => {
    switch (finding) {
      case 'thumbUnder':
      case 'fingerOver':
      case 'pattern':
      case 'hesitation':
        return run.place ? { rule: finding, action: { kind: 'loop' } } : null;
      case 'faster':
      case 'slower': {
        // With the click the run started at the click's tempo.
        const bpm = click ? click.bpm : clickTempo(beats(run.startTempo, perBeat));
        return bpm === null
          ? null
          : { rule: 'startTempo', bpm, perBeat, action: { kind: 'click', bpm } };
      }
      case 'apart':
        return { rule: 'eachHand', action: { kind: 'hands', hands: 'right' } };
      case 'clickLate':
      case 'clickEarly': {
        const ms = click?.tendency ?? null;
        return ms === null
          ? null
          : { rule: 'tendency', ms, action: calibration(ms, run.calibrated) };
      }
      default:
        return null;
    }
  };
  /** The findings the table has a row for: each names something to work on. */
  const problem = (finding: ScaleFinding) =>
    finding === 'thumbUnder' ||
    finding === 'fingerOver' ||
    finding === 'pattern' ||
    finding === 'hesitation' ||
    finding === 'faster' ||
    finding === 'slower' ||
    finding === 'apart' ||
    finding === 'clickLate' ||
    finding === 'clickEarly';

  const first = run.findings.slice(0, run.shown).find(problem);
  if (first) return advised(first);
  // A problem the verdict has no room to show is not advised on, and the run is not called even.
  if (run.findings.some(problem) || run.findings.includes('stopped')) return null;

  if (click) {
    // "Even at ♩ = 60" is said of notes that kept to the click, as the verdict says of them.
    if (!run.findings.includes('onClick')) return null;
    const next = click.bpm + EVEN_STEP_BPM;
    return next > CLICK_MAX_BPM
      ? null
      : { rule: 'evenClick', bpm: click.bpm, action: { kind: 'click', bpm: next } };
  }
  const bpm = clickTempo(played);
  return bpm === null ? null : { rule: 'even', action: { kind: 'click', bpm } };
}

// --- Cards (Read, Ear, Harmony) ------------------------------------------------------------------

/** A session with under this share of its answers right may be a level too far. */
export const TOO_FAR_SHARE = 0.6;
/**
 * A session stopped early is told so only with this many answers, the shortest session's length:
 * two cards say nothing of a level.
 */
export const TOO_FAR_MIN_ANSWERS: number = SESSION_LENGTHS[0];
/** "Practise these" is of at least this many items: the list is filled up to it. */
export const PRACTISE_MIN_ITEMS = 3;
/** Its cards: this many, or twice the items when that is more. */
export const PRACTISE_CARDS = 10;

/** What a card advice's button does. */
export type CardAction =
  /** A level of the same family (the next one, or the one below): started, and kept as picked. */
  | { kind: 'level'; level: string }
  /** Another family, at the level it suggests: its page is opened on it. */
  | { kind: 'family'; family: LevelFamily; level: string }
  /** A short session of the items listed. */
  | { kind: 'practise'; items: readonly string[]; length: number };

/** The one sentence a summary of cards says: the rule that applied, its figures, its button. */
export type CardSentence =
  /**
   * The session took the level from not mastered to mastered: the next level, or after the
   * family's last the family to go on with; nothing to press when there is neither.
   */
  | { rule: 'mastered'; action: Exclude<CardAction, { kind: 'practise' }> | null }
  /** Under `TOO_FAR_SHARE` right, and the level below is not mastered: that one first. */
  | {
      rule: 'tooFar';
      correct: number;
      answers: number;
      below: string;
      action: Extract<CardAction, { kind: 'level' }>;
    };

/** The advice after a session of cards. */
export interface CardAdvice {
  /** The sentence and the summary's primary button; null when neither rule applies. */
  say: CardSentence | null;
  /**
   * "Practise these": a button whenever there are missed or slow items, beside the sentence's
   * own and never in its place; a button without a sentence when no rule applies.
   */
  practise: Extract<CardAction, { kind: 'practise' }> | null;
}

/** A session of cards, for its advice. */
export interface CardSession {
  /** The level was mastered before the session's first answer, and is after its last. */
  masteredBefore: boolean;
  mastered: boolean;
  /** The family's next level; null after its last. */
  nextLevel: string | null;
  /** After the last level: the family to go on with and its suggested level; null without one. */
  nextFamily: { family: LevelFamily; level: string } | null;
  /** Its answers, and those right. */
  answers: number;
  correct: number;
  /** It was played to its end (not stopped before the last of what was planned). */
  complete: boolean;
  /** The level below and whether it is mastered; null at the family's first level. */
  below: { level: string; mastered: boolean } | null;
  /** The items "Practise these" would take (`practiceItems`); empty where there are none. */
  practise: readonly string[];
}

/** The cards of a "Practise these" session of `items` items. */
export const practiceLength = (items: number): number => Math.max(PRACTISE_CARDS, 2 * items);

/**
 * The one sentence after a session of cards; the first rule that applies:
 *
 * 1. mastered just now: the next level, or after the last the next family;
 * 2. a level too far: under `TOO_FAR_SHARE` of the answers right while the level below is not
 *    mastered: that level first. Said of a session played to its end, or stopped with at least
 *    `TOO_FAR_MIN_ANSWERS` answers.
 */
function cardSentence(session: CardSession): CardSentence | null {
  if (session.mastered && !session.masteredBefore) {
    const { nextLevel, nextFamily } = session;
    return {
      rule: 'mastered',
      action:
        nextLevel !== null
          ? { kind: 'level', level: nextLevel }
          : nextFamily && { kind: 'family', ...nextFamily },
    };
  }
  const { answers, correct, below } = session;
  const enough = answers > 0 && (session.complete || answers >= TOO_FAR_MIN_ANSWERS);
  if (enough && correct < TOO_FAR_SHARE * answers && below && !below.mastered)
    return {
      rule: 'tooFar',
      correct,
      answers,
      below: below.level,
      action: { kind: 'level', level: below.level },
    };
  return null;
}

/**
 * After a session of cards (docs/ADVICE.md, "Cards"): one sentence at most (`cardSentence`), and
 * "Practise these" when there are items for it: the third in the order, a button without a
 * sentence when neither rule applies, and beside the sentence's button when one does. Null when
 * there is nothing to say and nothing to practise.
 */
export function cardAdvice(session: CardSession): CardAdvice | null {
  const say = cardSentence(session);
  const practise =
    session.practise.length > 0
      ? {
          kind: 'practise' as const,
          items: session.practise,
          length: practiceLength(session.practise.length),
        }
      : null;
  return say || practise ? { say, practise } : null;
}

/**
 * Whether a session took its level to mastery: the family's own rule (`mastered`) over the
 * family's records without the session's (`ofSession`), and over them all. The records are the
 * rule's own: Read's attempts, a family's answers, sight-reading's sessions.
 */
export function sessionMastery<R>(
  records: readonly R[],
  ofSession: (record: R) => boolean,
  mastered: (records: readonly R[]) => boolean,
): Pick<CardSession, 'masteredBefore' | 'mastered'> {
  return {
    masteredBefore: mastered(records.filter((record) => !ofSession(record))),
    mastered: mastered(records),
  };
}

/**
 * What a session leaves to practise: the items it missed, then those of its "slowest" list that
 * were slow in fact, their slowest timed answer not under `line`, the line the family's mastery
 * draws for the median (an answer at the line is slow, as a median at it is not mastered). A
 * family whose mastery has no such line (`null`) has its missed items alone. Each item once.
 */
export function toPractise(
  missed: readonly string[],
  slowest: readonly { item: string; ms: number }[],
  line: number | null,
): string[] {
  const slow = line === null ? [] : slowest.filter((s) => s.ms >= line).map((s) => s.item);
  return [...new Set([...missed, ...slow])];
}

/**
 * The items of a "Practise these" session: those `listed` (the missed, then the slow ones:
 * `toPractise`) that are the level's own, each once; filled up to `PRACTISE_MIN_ITEMS`
 * with the level's weakest by the usual weights (the heaviest first, of equals the earlier in
 * the level). Empty when none of the listed ones is the level's.
 */
export function practiceItems(
  listed: readonly string[],
  levelItems: readonly string[],
  weight: (item: string) => number,
): string[] {
  const own = new Set(levelItems);
  const items = [...new Set(listed)].filter((item) => own.has(item));
  if (items.length === 0 || items.length >= PRACTISE_MIN_ITEMS) return items;
  const rest = levelItems
    .filter((item) => !items.includes(item))
    .map((item, index) => ({ item, index, weight: weight(item) }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return [...items, ...rest.slice(0, PRACTISE_MIN_ITEMS - items.length).map((r) => r.item)];
}

/**
 * The level a list of items is practised at (Progress's weakest, which may be of several levels):
 * the first of `levels` that has them all; else the first that has the first of them. Null when
 * no level has it.
 */
export function levelOfItems(
  items: readonly string[],
  levels: readonly { id: string; items: readonly string[] }[],
): string | null {
  const first = items[0];
  if (first === undefined) return null;
  const all = levels.find((level) => items.every((item) => level.items.includes(item)));
  return (all ?? levels.find((level) => level.items.includes(first)))?.id ?? null;
}

/** A family as today's plan sees it (`FamilyState` of `core/today.ts`): what the rule reads. */
export interface FamilyStanding {
  family: LevelFamily;
  open: boolean;
  /** Its first level not mastered; null once all are. */
  suggested: string | null;
  /** Epoch ms of its latest session; null when it was never practised. */
  lastAt: number | null;
}

/**
 * The family to go on with after `family`'s last level is mastered: of those open and not
 * mastered throughout, the one today's plan would put first (the longest left alone, a family
 * never practised before all; equals in the pages' order), a family of the same page before one
 * of another. Null when there is none.
 */
export function familyAfter(
  family: LevelFamily,
  families: readonly FamilyStanding[],
  pageOf: (family: LevelFamily) => string,
): { family: LevelFamily; level: string } | null {
  const page = pageOf(family);
  const left = families
    .map((f, index) => ({ f, index }))
    .filter(({ f }) => f.family !== family && f.open && f.suggested !== null)
    .sort(
      (a, b) =>
        Number(pageOf(b.f.family) === page) - Number(pageOf(a.f.family) === page) ||
        (a.f.lastAt ?? -Infinity) - (b.f.lastAt ?? -Infinity) ||
        a.index - b.index,
    );
  const next = left[0]?.f;
  return next ? { family: next.family, level: next.suggested! } : null;
}
