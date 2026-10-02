// What practising a piece leaves behind: one record per step (the raw data every piece figure is
// recomputed from) and one session per run, in wait mode or rhythm mode. All times here are epoch
// ms.

import { IDLE_MS } from './activity.ts';
import { IN_TIME_MS } from './rhythmRun.ts';
import type { NoteTiming } from './rhythm.ts';
import type { RepeatMode } from './repeats.ts';
import { performanceOrder, playOrder } from './repeats.ts';
import { buildSteps, keyRange, type HandSelection, type Score } from './score.ts';
import type { BarLoop } from './wait.ts';
import type { MemoryStage } from './memory.ts';
import type { PatternId } from './progressions.ts';

export const HAND_SELECTIONS: readonly HandSelection[] = ['right', 'left', 'both'];

export function isHandSelection(value: unknown): value is HandSelection {
  return HAND_SELECTIONS.includes(value as HandSelection);
}

/**
 * Wait mode waits for each step; rhythm mode moves in time; memory mode waits, with the score
 * faded (P7). Records made before rhythm mode have no mode: they are wait mode's.
 */
export type PracticeMode = 'wait' | 'rhythm' | 'memory';

/**
 * One step of a run. Plain data, so it can be stored as is. In wait mode it is completed when its
 * keys are pressed; in rhythm mode it is settled when its window closes.
 */
export interface PieceStep {
  /** `sessionId:n`, n the step's position in its run: stable, so imports merge by id. */
  id: string;
  sessionId: string;
  pieceId: string;
  /**
   * `pieceChecksum` of the score as it was practised, in its written key: a transposed run has
   * the checksum of the piece it transposes.
   */
  checksum: string;
  hands: HandSelection;
  /** Written measure index, and which pass through it. */
  measure: number;
  pass: number;
  /**
   * Wait mode: from the step appearing (or the first key after a pause) to its last required
   * key. Rhythm mode: the step's share of the run at its tempo (the time to the next step).
   */
  ms: number;
  /** Wrong notes; in rhythm mode, note-ons that matched nothing and were closest to this step. */
  wrong: number;
  /** When it was completed; in rhythm mode, when it was due. */
  at: number;
  mode?: 'rhythm' | 'memory';
  /**
   * Rhythm mode: each key of the step that was the player's, how early (−) or late (+) in ms,
   * null when missed. The keys the app played for the player (beyond their keyboard,
   * docs/PERSONAL.md, "The instrument's keys") are not among them. In every mode an empty list
   * says the step had none of the player's keys and was passed (`isPassed`); a step of wait or
   * memory mode that was played has no list at all.
   */
  notes?: NoteTiming[];
  /**
   * Memory mode: the prompts on the step (a wrong key or a peek while its bar was hidden), and
   * how much of the score was shown.
   */
  prompts?: number;
  stage?: MemoryStage;
  /**
   * Semitones the piece was moved by (docs/HARMONY.md, "Transposing (H4)"), −6 … 6; absent in
   * the written key.
   */
  transpose?: number;
}

export const stepMode = (step: Pick<PieceStep, 'mode'>): PracticeMode => step.mode ?? 'wait';

/**
 * A step that had none of the player's keys (all of them beyond their keyboard): the app played
 * it and the run went by. It is a step of the run all the same, counted wherever steps are
 * counted to tell a pass or a round (an assignment's runs, a loop's rounds, the bars a run went
 * through); it is left out where the player's own steps are judged.
 */
export const isPassed = (step: Pick<PieceStep, 'notes'>): boolean => step.notes?.length === 0;

/** The written bars a run looped over, with their printed numbers for the log. */
export interface LoopRange extends BarLoop {
  fromLabel: string;
  toLabel: string;
}

/** What is known about a run when its first step is stored. */
export interface PieceRunHeader {
  /** The session id. */
  id: string;
  pieceId: string;
  /** The title when practised: the piece may be renamed or deleted later. */
  title: string;
  hands: HandSelection;
  loop: LoopRange | null;
  repeats: RepeatMode;
  /** Percent of the score's tempo marks, for the demo and the other hand. */
  tempo: number;
  /** The first key of the run; in rhythm mode, the first step due. */
  startedAt: number;
  mode?: 'rhythm' | 'memory';
  /**
   * The left hand was made from the chord symbols, in this pattern (docs/HARMONY.md, H3); absent
   * when it was played as written. The checksum of such a run's steps is that of the notes with
   * this left hand.
   */
  leftHand?: PatternId;
  /** Semitones the piece was moved by (H4), −6 … 6; absent in the written key. */
  transpose?: number;
  /**
   * The keyboard the run was played on, its lowest and highest key, when it had fewer than 88
   * (docs/PERSONAL.md, "The instrument's keys"): which notes the app played for the player is
   * read from it, whatever keyboard reads the run. Absent on 88 keys, and on every run from
   * before the keyboard could be chosen.
   */
  keys?: readonly [lowest: number, highest: number];
}

/** A rhythm run's notes: due, played within their window, and within `IN_TIME_MS`. */
export interface RhythmCounts {
  notes: number;
  hits: number;
  inTime: number;
}

/** A run as it appears in the practice log. */
export interface PieceSession extends PieceRunHeader {
  kind: 'piece';
  /** The last completed step. */
  endedAt: number;
  /** Time on the steps, each capped at `IDLE_MS` (the same idle rule as every other session). */
  activeMs: number;
  /** The steps the player had a key of: a step passed (`isPassed`) is not among them. */
  steps: number;
  wrong: number;
  /** Played to the end, or a loop ended with Finish; false when left or restarted. */
  completed: boolean;
  /**
   * The notes of the run the app played for the player, beyond their keyboard (docs/PERSONAL.md,
   * "The instrument's keys"); absent when none. The run's other figures are of the notes the
   * player had.
   */
  given?: number;
  /** Rhythm mode only. */
  rhythm?: RhythmCounts;
  /** Memory mode only: the stage it was played at, and its prompts. */
  memory?: MemoryCounts;
}

export interface MemoryCounts {
  stage: MemoryStage;
  prompts: number;
}

export function stepId(sessionId: string, n: number): string {
  return `${sessionId}:${String(n).padStart(5, '0')}`;
}

export function byStepTime(a: PieceStep, b: PieceStep): number {
  return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * The session of a run from its steps (of that run, in order). Time is the sum of the step
 * times, so a pause to listen to the demo, which restarts the step's clock, is never practice.
 * `given`: the notes the app played for the player, which the step records do not count.
 */
export function pieceSession(
  header: PieceRunHeader,
  steps: readonly PieceStep[],
  completed: boolean,
  given = 0,
): PieceSession {
  const last = steps.at(-1);
  return {
    kind: 'piece',
    ...header,
    loop: header.loop ? { ...header.loop } : null,
    endedAt: Math.max(
      header.startedAt,
      last ? last.at + (header.mode === 'rhythm' ? Math.min(last.ms, IDLE_MS) : 0) : 0,
    ),
    activeMs: steps.reduce((sum, s) => sum + Math.min(s.ms, IDLE_MS), 0),
    steps: steps.reduce((sum, s) => sum + (isPassed(s) ? 0 : 1), 0),
    wrong: steps.reduce((sum, s) => sum + s.wrong, 0),
    completed,
    ...(given > 0 && { given }),
    ...(header.mode === 'rhythm' && { rhythm: rhythmCounts(steps) }),
    ...(header.mode === 'memory' && {
      memory: {
        stage: steps[0]?.stage ?? 'all',
        prompts: steps.reduce((sum, s) => sum + (s.prompts ?? 0), 0),
      },
    }),
  };
}

export function rhythmCounts(steps: readonly Pick<PieceStep, 'notes'>[]): RhythmCounts {
  const counts = { notes: 0, hits: 0, inTime: 0 };
  for (const note of steps.flatMap((s) => s.notes ?? [])) {
    counts.notes++;
    if (note.deviation === null) continue;
    counts.hits++;
    if (Math.abs(note.deviation) <= IN_TIME_MS) counts.inTime++;
  }
  return counts;
}

/**
 * The session of a run whose tab went away before it was recorded, from its header and whatever
 * steps were stored. Null when no step was stored.
 */
export function recoverPieceSession(
  header: PieceRunHeader,
  steps: readonly PieceStep[],
): PieceSession | null {
  const own = steps.filter((s) => s.sessionId === header.id).sort(byStepTime);
  return own.length === 0 ? null : pieceSession(header, own, false);
}

/** FNV-1a, 32 bits: enough to notice any change to the notes. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Identifies the notes as practised: (written onset, key, duration, hand) of every note. A changed
 * encoding, another file or another hand assignment gives another checksum, and step records made
 * on the old one no longer count for the measure heatmap. A piece played in another key keeps the
 * checksum of its written key (its records say how far it was moved).
 */
export function pieceChecksum(score: Pick<Score, 'notes'>): string {
  return fnv1a(score.notes.map((n) => `${n.onset},${n.midi},${n.duration},${n.hand}`).join(';'));
}

/** What the library shows without opening the piece. */
export interface PieceFacts {
  checksum: string;
  /** Written bars with something to play, per hand selection. */
  bars: Readonly<Record<HandSelection, number>>;
  /**
   * The keys a run of the whole piece with both hands strikes, the repeats played or skipped: what
   * the review schedule counts wrong notes against (docs/PIECES.md, P6). Absent in facts kept
   * before it, until they are filled in again.
   */
  notes?: Readonly<Record<RepeatMode, number>>;
  /**
   * The lowest and the highest key its hands play: what a library card needs to say that the
   * piece goes beyond the player's keyboard (docs/PERSONAL.md, "The instrument's keys"). Absent
   * in facts kept before it, until they are filled in again, and for a piece without a note.
   */
  keys?: readonly [lowest: number, highest: number];
}

export function pieceFacts(score: Score): PieceFacts {
  const order = performanceOrder(score.measures);
  const count = (hands: HandSelection) =>
    new Set(buildSteps(score, hands, order).map((s) => s.measure)).size;
  const span = keyRange(score, 'both');
  const keys = (repeats: RepeatMode) =>
    buildSteps(score, 'both', playOrder(score.measures, repeats)).reduce(
      (sum, step) => sum + step.midis.length,
      0,
    );
  return {
    checksum: pieceChecksum(score),
    bars: { right: count('right'), left: count('left'), both: count('both') },
    notes: { play: keys('play'), skip: keys('skip') },
    ...(span && { keys: span }),
  };
}
