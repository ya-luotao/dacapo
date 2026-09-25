// What practising a piece leaves behind: one record per step (the raw data every piece figure is
// recomputed from) and one session per run, in wait mode or rhythm mode. All times here are epoch
// ms.

import { IDLE_MS } from './activity.ts';
import { IN_TIME_MS } from './rhythmRun.ts';
import type { NoteTiming } from './rhythm.ts';
import type { RepeatMode } from './repeats.ts';
import { performanceOrder } from './repeats.ts';
import { buildSteps, type HandSelection, type Score } from './score.ts';
import type { BarLoop } from './wait.ts';

export const HAND_SELECTIONS: readonly HandSelection[] = ['right', 'left', 'both'];

export function isHandSelection(value: unknown): value is HandSelection {
  return HAND_SELECTIONS.includes(value as HandSelection);
}

/**
 * Wait mode waits for each step; rhythm mode moves in time. Records made before rhythm mode have
 * no mode: they are wait mode's.
 */
export type PracticeMode = 'wait' | 'rhythm';

/**
 * One step of a run. Plain data, so it can be stored as is. In wait mode it is completed when its
 * keys are pressed; in rhythm mode it is settled when its window closes.
 */
export interface PieceStep {
  /** `sessionId:n`, n the step's position in its run: stable, so imports merge by id. */
  id: string;
  sessionId: string;
  pieceId: string;
  /** `pieceChecksum` of the score as it was practised. */
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
  mode?: 'rhythm';
  /** Rhythm mode: each key of the step, how early (−) or late (+) in ms, null when missed. */
  notes?: NoteTiming[];
}

export const stepMode = (step: Pick<PieceStep, 'mode'>): PracticeMode => step.mode ?? 'wait';

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
  mode?: 'rhythm';
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
  steps: number;
  wrong: number;
  /** Played to the end, or a loop ended with Finish; false when left or restarted. */
  completed: boolean;
  /** Rhythm mode only. */
  rhythm?: RhythmCounts;
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
 */
export function pieceSession(
  header: PieceRunHeader,
  steps: readonly PieceStep[],
  completed: boolean,
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
    steps: steps.length,
    wrong: steps.reduce((sum, s) => sum + s.wrong, 0),
    completed,
    ...(header.mode === 'rhythm' && { rhythm: rhythmCounts(steps) }),
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
 * on the old one no longer count for the measure heatmap.
 */
export function pieceChecksum(score: Pick<Score, 'notes'>): string {
  return fnv1a(score.notes.map((n) => `${n.onset},${n.midi},${n.duration},${n.hand}`).join(';'));
}

/** What the library shows without opening the piece. */
export interface PieceFacts {
  checksum: string;
  /** Written bars with something to play, per hand selection. */
  bars: Readonly<Record<HandSelection, number>>;
}

export function pieceFacts(score: Score): PieceFacts {
  const order = performanceOrder(score.measures);
  const count = (hands: HandSelection) =>
    new Set(buildSteps(score, hands, order).map((s) => s.measure)).size;
  return {
    checksum: pieceChecksum(score),
    bars: { right: count('right'), left: count('left'), both: count('both') },
  };
}
