// A piece's plan (docs/PIECES.md, "A piece's plan"): how a teacher takes a new piece. Phrase by
// phrase, each hand, then together; then each phrase in time; then the whole piece. A stage is
// done by the records of the piece's runs, by lines the app already draws: the bar heatmap's
// "steady", the review's clean and in time, a run to the end. Pure, and nothing of it is stored:
// the plan is the records read another way, so it is the same wherever the records are.

import { barHeatmap, barStepsIn, type BarSteps } from './barHeatmap.ts';
import type { PieceSessionRecord } from './log.ts';
import { phraseStarts } from './memory.ts';
import {
  byStepTime,
  pieceFacts,
  rhythmCounts,
  stepMode,
  type LoopRange,
  type PieceFacts,
  type PieceStep,
} from './pieceRecords.ts';
import { performanceOrder } from './repeats.ts';
import { gradeFigures, IN_TIME_SHARE, isRunToTheEnd, playsEveryNote } from './review.ts';
import { buildSteps, type Hand, type HandSelection, type Score } from './score.ts';
import { SCORE_TEMPO, tempoLadder } from './tempoLadder.ts';

/** The stages of a phrase, in the order they are worked. */
export const PHRASE_STAGES = ['right', 'left', 'together', 'inTime'] as const;
export type PhraseStage = (typeof PHRASE_STAGES)[number];
/** A stage of the plan: one of a phrase's, or the whole piece after them. */
export const STAGES = [...PHRASE_STAGES, 'whole'] as const;
export type Stage = (typeof STAGES)[number];

/**
 * A phrase of a piece, as memory mode knows it (`phraseStarts`: four bars, or fewer up to a
 * double bar or the end; an upbeat belongs to the first), named by its bars.
 */
export interface PiecePhrase {
  /** Its first and last written bar, as a loop takes them, with their printed numbers. */
  from: number;
  to: number;
  fromLabel: string;
  toLabel: string;
  /** Its written bars that each hand selection has something to play in. */
  bars: Readonly<Record<HandSelection, readonly number[]>>;
  /** The steps one time through it takes, per hand selection. */
  steps: Readonly<Record<HandSelection, number>>;
}

/** What a piece's plan is made of: its phrases, and the facts of the notes they are of. */
export interface PlanSource {
  phrases: readonly PiecePhrase[];
  facts: PieceFacts;
  /**
   * The steps a time through each bar takes, per hand selection: they tell the rounds of a loop
   * of one bar apart (a first ending is a phrase of one bar).
   */
  barSteps: Readonly<Record<HandSelection, BarSteps>>;
}

/** The steps a time through each written bar of a score takes, per hand selection. */
export function stepsPerBar(score: Score): Record<HandSelection, Map<number, number>> {
  const order = performanceOrder(score.measures);
  const count = (hands: HandSelection) => barStepsIn(buildSteps(score, hands, order));
  return { right: count('right'), left: count('left'), both: count('both') };
}

/**
 * The phrases of a score, each with the bars its hands play. A phrase in which nothing is played
 * is left out. Bars are written measures, as a loop's are: a repeated phrase is one phrase.
 */
export function piecePhrases(score: Score): PiecePhrase[] {
  const { measures } = score;
  const counts = stepsPerBar(score);
  const starts = phraseStarts(measures);
  return starts.flatMap((start, i): PiecePhrase[] => {
    // An upbeat belongs to the first phrase, which is counted from the bar after it.
    const from = i === 0 ? 0 : start;
    const to = (starts[i + 1] ?? measures.length) - 1;
    const span = Array.from({ length: to - from + 1 }, (_, n) => from + n);
    const bars = (hands: HandSelection) => span.filter((bar) => counts[hands].has(bar));
    const steps = (hands: HandSelection) =>
      span.reduce((sum, bar) => sum + (counts[hands].get(bar) ?? 0), 0);
    if (bars('both').length === 0) return [];
    return [
      {
        from,
        to,
        fromLabel: measures[from]!.number,
        toLabel: measures[to]!.number,
        bars: { right: bars('right'), left: bars('left'), both: bars('both') },
        steps: { right: steps('right'), left: steps('left'), both: steps('both') },
      },
    ];
  });
}

/** What a piece's plan is made of, from its score as written. */
export function planSource(score: Score): PlanSource {
  return { phrases: piecePhrases(score), facts: pieceFacts(score), barSteps: stepsPerBar(score) };
}

/**
 * What starting a stage sets on the piece's page, and what names it elsewhere (today's plan keeps
 * it for the day): the loop, the hands, the mode and the tempo.
 */
export interface StageStart {
  stage: Stage;
  /** The phrase's bars as a loop; null for the whole piece. */
  bars: LoopRange | null;
  hands: HandSelection;
  mode: 'wait' | 'rhythm';
  /**
   * Percent of the score's tempo: the tempo ladder's rung for In time. Null in wait mode, where
   * the tempo paces only what the instrument plays, and stays as the player has it.
   */
  tempo: number | null;
}

/** A stage of the plan with where it stands. */
export interface PlanStage extends StageStart {
  /** Its phrase, by position in the plan's rows; null for the whole piece. */
  phrase: number | null;
  done: boolean;
}

export interface PiecePlan {
  /** The stages the phrases have between them, in the order they are worked: the columns. */
  stages: PhraseStage[];
  /** A row per phrase: for each column its stage, or null where the phrase has none. */
  rows: { phrase: PiecePhrase; stages: (PlanStage | null)[] }[];
  /** The whole piece: a run to its end, which is also what brings it into review. */
  whole: PlanStage;
  /**
   * The next step: the first stage not done, phrase by phrase (each hand, then together), then
   * In time phrase by phrase, then the whole piece. Null once every stage is done.
   */
  next: PlanStage | null;
}

export interface PlanInput extends PlanSource {
  pieceId: string;
  /** The piece's sessions and step records (any order; other pieces' are left out). */
  sessions: readonly PieceSessionRecord[];
  steps: readonly PieceStep[];
}

/**
 * The plan of a piece from its phrases and the records of its runs. A stage is done:
 *
 * - a hand, or together: when every bar of the phrase those hands play is steady with them, by
 *   the bar heatmap's own rule (`barHeatmap`: the bar's last runs without a wrong note and
 *   without hesitating, each round of a loop a run). In a piece written for one hand, Both is
 *   that hand, and counts for it.
 * - in time: by one time through the phrase's bars in rhythm mode, with the hands that play
 *   every note, that the review would grade clean and in time (`gradeFigures`), at any tempo;
 * - the whole piece: by a run to the end (`isRunToTheEnd`).
 *
 * Runs in another key count for nothing, as for the review; nor do runs of another version of
 * the notes, as for the heatmap. A run with a left hand made from the chord symbols was played
 * on other notes: only its right hand alone, the melody as written, counts (as for an
 * assignment's task), and the run to the end that puts a lead sheet in review.
 */
export function piecePlan(input: PlanInput): PiecePlan {
  const { pieceId, phrases, facts } = input;
  const { checksum } = facts;
  const sessions = input.sessions.filter((s) => s.kind === 'piece' && s.pieceId === pieceId);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const own = input.steps.filter((s) => s.pieceId === pieceId);
  const written = own.flatMap((step): PieceStep[] => {
    if (sessionById.get(step.sessionId)?.leftHand === undefined) return [step];
    return step.hands === 'right' ? [{ ...step, checksum }] : [];
  });

  // The hand of a piece written for one hand only; with it, Both is that hand.
  const only: Hand | null =
    facts.bars.left === 0 ? 'right' : facts.bars.right === 0 ? 'left' : null;
  const every: HandSelection = only ?? 'both';

  const steadyBars = new Map<HandSelection, Set<number>>();
  const steadyWith = (hands: HandSelection): Set<number> => {
    let steady = steadyBars.get(hands);
    if (!steady) {
      const bars = [...new Set(phrases.flatMap((p) => p.bars[hands]))];
      const barSteps = input.barSteps[hands];
      const { cells } = barHeatmap(written, { checksum, hands, bars, barSteps });
      steady = new Set(cells.filter((c) => c.steady).map((c) => c.measure));
      steadyBars.set(hands, steady);
    }
    return steady;
  };
  const steady = (phrase: PiecePhrase, hands: HandSelection): boolean => {
    const all = (selection: HandSelection) =>
      phrase.bars[hands].every((bar) => steadyWith(selection).has(bar));
    return all(hands) || (hands === only && all('both'));
  };

  // Rhythm runs of the notes as written, in the written key, with hands that play every note:
  // each run's steps in the order played.
  const timed = new Map<string, PieceStep[]>();
  for (const step of written) {
    if (stepMode(step) !== 'rhythm' || step.transpose !== undefined) continue;
    if (step.checksum !== checksum || !playsEveryNote(step.hands, facts)) continue;
    const list = timed.get(step.sessionId);
    if (list) list.push(step);
    else timed.set(step.sessionId, [step]);
  }
  for (const list of timed.values()) list.sort(byStepTime);
  const inTime = (phrase: PiecePhrase): boolean => {
    for (const run of timed.values()) {
      const perPass = phrase.steps[run[0]!.hands];
      if (perPass === 0) continue;
      const bars = phrase.bars[run[0]!.hands];
      // Each stretch of the run inside the phrase, a time through at a time: a loop goes round.
      let stretch: PieceStep[] = [];
      for (const step of [...run, null]) {
        if (step && step.measure >= phrase.from && step.measure <= phrase.to) {
          stretch.push(step);
          if (stretch.length < perPass) continue;
          if (cleanInTime(stretch, bars)) return true;
        }
        stretch = [];
      }
    }
    return false;
  };

  const bySession = new Map<string, PieceStep[]>();
  for (const step of own) {
    const list = bySession.get(step.sessionId);
    if (list) list.push(step);
    else bySession.set(step.sessionId, [step]);
  }
  const played = sessions.some((s) => isRunToTheEnd(s, bySession.get(s.id), facts));
  // The rung to take in time: the ladder's next, and the score's tempo once it is climbed.
  const rung = tempoLadder(pieceId, every, sessions, own, facts).next ?? SCORE_TEMPO;

  const present = (phrase: PiecePhrase): PhraseStage[] =>
    phrase.bars.right.length > 0 && phrase.bars.left.length > 0
      ? ['right', 'left', 'together', 'inTime']
      : [phrase.bars.right.length > 0 ? 'right' : 'left', 'inTime'];
  const stages = PHRASE_STAGES.filter((stage) => phrases.some((p) => present(p).includes(stage)));
  const rows = phrases.map((phrase, index) => {
    const { from, to, fromLabel, toLabel } = phrase;
    const bars: LoopRange = { from, to, fromLabel, toLabel };
    const has = present(phrase);
    const stage = (name: PhraseStage): PlanStage | null => {
      if (!has.includes(name)) return null;
      if (name === 'inTime')
        return {
          stage: name,
          phrase: index,
          bars,
          hands: every,
          mode: 'rhythm',
          tempo: rung,
          done: inTime(phrase),
        };
      const hands: HandSelection = name === 'together' ? 'both' : name;
      return {
        stage: name,
        phrase: index,
        bars,
        hands,
        mode: 'wait',
        tempo: null,
        done: steady(phrase, hands),
      };
    };
    return { phrase, stages: stages.map(stage) };
  });
  const whole: PlanStage = {
    stage: 'whole',
    phrase: null,
    bars: null,
    hands: every,
    mode: 'wait',
    tempo: null,
    done: played,
  };

  const open = (wanted: (stage: PlanStage) => boolean): PlanStage | undefined =>
    rows.flatMap((row) => row.stages).find((s) => s !== null && !s.done && wanted(s)) ?? undefined;
  const next =
    open((s) => s.stage !== 'inTime') ??
    open((s) => s.stage === 'inTime') ??
    (played ? null : whole);
  return { stages, rows, whole, next };
}

/**
 * One time through a phrase in rhythm mode, as the review grades a run: through every bar its
 * hands play, at most one note in `CLEAN_NOTES` missed or extra, and `IN_TIME_SHARE` in time.
 */
function cleanInTime(steps: readonly PieceStep[], bars: readonly number[]): boolean {
  const through = new Set(steps.map((s) => s.measure));
  if (!bars.every((bar) => through.has(bar))) return false;
  const { notes, hits, inTime } = rhythmCounts(steps);
  const errors = notes - hits + steps.reduce((sum, s) => sum + s.wrong, 0);
  return gradeFigures(errors, notes, inTime >= IN_TIME_SHARE * notes) === 'better';
}

/** What a stage starts with, without where it stands: as it is kept and named elsewhere. */
export function stageStart({ stage, bars, hands, mode, tempo }: StageStart): StageStart {
  return { stage, bars: bars && { ...bars }, hands, mode, tempo };
}

/** The next step of a piece's plan, as it is opened from elsewhere; null once all are done. */
export function nextStep(input: PlanInput): StageStart | null {
  const { next } = piecePlan(input);
  return next && stageStart(next);
}
