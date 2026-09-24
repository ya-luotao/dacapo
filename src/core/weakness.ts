import type { StaffNote } from './levels.ts';
import type { Rng } from './random.ts';

/** What the app knows about reading one written note. Plain data, so it can be stored as is. */
export interface NoteStats {
  /** `StaffNote.key`, e.g. `C4@treble`. */
  key: string;
  attempts: number;
  correct: number;
  errors: number;
  /** Smoothed reaction time of correct, un-hinted, timely answers; null until there is one. */
  ewmaMs: number | null;
  /** Epoch ms of the latest attempt; null if never answered. */
  lastSeen: number | null;
  /** Correctness of the latest attempts, oldest first, at most `RECENT_LENGTH`. */
  recent: boolean[];
}

export type StatsByKey = Readonly<Record<string, NoteStats>>;

export interface ScoredAnswer {
  correct: boolean;
  ms: number;
  hinted: boolean;
  timedOut: boolean;
  /** Epoch ms. */
  at: number;
}

export const EWMA_ALPHA = 0.3;
export const TARGET_MS = 1500;
export const RECENT_LENGTH = 10;
/** Weight factor of a note that has never been answered; seen notes get 1. */
export const UNSEEN_NOVELTY = 4;
const ERROR_FACTOR = 3;
const SPEED_MIN = 0.5;
const SPEED_MAX = 3;

export function emptyStats(key: string): NoteStats {
  return { key, attempts: 0, correct: 0, errors: 0, ewmaMs: null, lastSeen: null, recent: [] };
}

export function updateStats(stats: NoteStats, answer: ScoredAnswer): NoteStats {
  const timely = answer.correct && !answer.hinted && !answer.timedOut;
  return {
    key: stats.key,
    attempts: stats.attempts + 1,
    correct: stats.correct + (answer.correct ? 1 : 0),
    errors: stats.errors + (answer.correct ? 0 : 1),
    ewmaMs: !timely
      ? stats.ewmaMs
      : stats.ewmaMs === null
        ? answer.ms
        : EWMA_ALPHA * answer.ms + (1 - EWMA_ALPHA) * stats.ewmaMs,
    lastSeen: answer.at,
    recent: [...stats.recent, answer.correct].slice(-RECENT_LENGTH),
  };
}

/** Share of wrong answers among the recent ones, so a note stops being "weak" once it is learnt. */
export function errorRate(stats: NoteStats): number {
  if (stats.recent.length === 0) return 0;
  return stats.recent.filter((ok) => !ok).length / stats.recent.length;
}

/**
 * `novelty × (1 + errorRate × 3) × clamp(ewmaMs / targetMs, 0.5, 3)`.
 * Unseen notes get `UNSEEN_NOVELTY`; a note without a timely answer yet counts as on target speed.
 */
export function noteWeight(stats: NoteStats | undefined): number {
  if (!stats || stats.attempts === 0) return UNSEEN_NOVELTY;
  const speed =
    stats.ewmaMs === null ? 1 : Math.min(SPEED_MAX, Math.max(SPEED_MIN, stats.ewmaMs / TARGET_MS));
  return (1 + errorRate(stats) * ERROR_FACTOR) * speed;
}

/**
 * Draws the next card, favouring weak and unseen notes. Never returns a note on the same key as
 * `previous` (not even on the other staff), so the answer is never the key just played.
 */
export function pickNext(
  candidates: readonly StaffNote[],
  stats: StatsByKey,
  previous: StaffNote | null,
  rng: Rng,
): StaffNote {
  const pool = previous ? candidates.filter((note) => note.midi !== previous.midi) : candidates;
  if (pool.length === 0) throw new RangeError('No candidate note differs from the previous one');
  const weights = pool.map((note) => noteWeight(stats[note.key]));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]!;
    if (r < 0) return pool[i]!;
  }
  return pool.at(-1)!;
}
