import { getLevel, parseNoteKey, type LevelId, type StaffNote } from './levels.ts';
import { LETTERS } from './note.ts';
import {
  errorRate,
  noteWeight,
  SPEED_MAX,
  SPEED_MIN,
  TARGET_MS,
  type NoteStats,
  type StatsByKey,
} from './weakness.ts';

// Data for the weakness heatmap: one cell per written note (or per key, for the keyboard view),
// coloured by reaction speed and marked by the recent error rate.

/** Fewer answers than this, or no timely correct answer yet, is "not enough data" to colour. */
export const MIN_ATTEMPTS = 3;

/**
 * Upper edges of the speed buckets in ms, anchored on the target and the weight's clamp:
 * 0.5×, ⅔×, 1×, 1⅓×, 2× and 3× `TARGET_MS` (750 … 4500 ms at the default target).
 */
export const SPEED_EDGES_MS: readonly number[] = [SPEED_MIN, 2 / 3, 1, 4 / 3, 2, SPEED_MAX].map(
  (factor) => Math.round(factor * TARGET_MS),
);
export const SPEED_BUCKETS = SPEED_EDGES_MS.length + 1;

/** 0 (faster than `SPEED_EDGES_MS[0]`) … `SPEED_BUCKETS - 1` (at or over the last edge). */
export function speedBucket(ms: number): number {
  const index = SPEED_EDGES_MS.findIndex((edge) => ms < edge);
  return index === -1 ? SPEED_EDGES_MS.length : index;
}

export type LevelFilter = LevelId | 'all';

/** What the heatmap shows for one written note, or for one key when aggregated. */
export interface Figures {
  attempts: number;
  correct: number;
  /** Answers among the last `RECENT_LENGTH` of each note, and how many of them were right. */
  recentCount: number;
  recentCorrect: number;
  /** Wrong share of the recent answers, 0 when there are none. */
  errorRate: number;
  /** Typical reaction time (the EWMA), or null without a timely correct answer. */
  ewmaMs: number | null;
  /** Speed bucket, or null when there is not enough data to colour the note. */
  bucket: number | null;
}

export interface NoteCell extends Figures {
  key: string;
  note: StaffNote;
  /** The sampler's weight: the higher, the weaker. */
  weight: number;
}

export interface KeyCell extends Figures {
  midi: number;
  /** The written notes played on this key, in pitch order. */
  notes: readonly NoteCell[];
}

export function hasEnoughData(figures: Pick<Figures, 'attempts' | 'ewmaMs'>): boolean {
  return figures.attempts >= MIN_ATTEMPTS && figures.ewmaMs !== null;
}

function bucketOf(figures: Pick<Figures, 'attempts' | 'ewmaMs'>): number | null {
  return hasEnoughData(figures) ? speedBucket(figures.ewmaMs!) : null;
}

/** Left to right on the staff: by key, bass staff before treble, then by letter (C♯ before D♭). */
export function comparePitch(a: StaffNote, b: StaffNote): number {
  return (
    a.midi - b.midi ||
    (a.clef === b.clef ? 0 : a.clef === 'bass' ? -1 : 1) ||
    a.pitch.octave * 7 +
      LETTERS.indexOf(a.pitch.letter) -
      (b.pitch.octave * 7 + LETTERS.indexOf(b.pitch.letter))
  );
}

function noteCell(stats: NoteStats, note: StaffNote): NoteCell {
  const recentCorrect = stats.recent.filter(Boolean).length;
  return {
    key: stats.key,
    note,
    attempts: stats.attempts,
    correct: stats.correct,
    recentCount: stats.recent.length,
    recentCorrect,
    errorRate: errorRate(stats),
    ewmaMs: stats.ewmaMs,
    bucket: bucketOf(stats),
    weight: noteWeight(stats),
  };
}

/** Every practised note (of the level's pool, when filtered), in pitch order. */
export function noteCells(stats: StatsByKey, filter: LevelFilter = 'all'): NoteCell[] {
  const pool = filter === 'all' ? null : new Set(getLevel(filter).notes.map((n) => n.key));
  const cells: NoteCell[] = [];
  for (const entry of Object.values(stats)) {
    if (entry.attempts === 0 || (pool && !pool.has(entry.key))) continue;
    const note = parseNoteKey(entry.key);
    if (note) cells.push(noteCell(entry, note));
  }
  return cells.sort((a, b) => comparePitch(a.note, b.note));
}

/**
 * One cell per key, for the keyboard: both staves and both spellings together. Counts add up;
 * the typical reaction time is the mean of the notes that have one, weighted by their attempts.
 */
export function keyCells(cells: readonly NoteCell[]): KeyCell[] {
  const byMidi = new Map<number, NoteCell[]>();
  for (const cell of cells) {
    const group = byMidi.get(cell.note.midi);
    if (group) group.push(cell);
    else byMidi.set(cell.note.midi, [cell]);
  }
  return [...byMidi.entries()]
    .sort(([a], [b]) => a - b)
    .map(([midi, group]) => {
      const notes = [...group].sort((a, b) => comparePitch(a.note, b.note));
      const sum = (pick: (cell: NoteCell) => number) => notes.reduce((n, c) => n + pick(c), 0);
      const timed = notes.filter((c) => c.ewmaMs !== null);
      const timedAttempts = timed.reduce((n, c) => n + c.attempts, 0);
      const ewmaMs =
        timedAttempts === 0
          ? null
          : timed.reduce((n, c) => n + c.ewmaMs! * c.attempts, 0) / timedAttempts;
      const attempts = sum((c) => c.attempts);
      const recentCount = sum((c) => c.recentCount);
      const recentCorrect = sum((c) => c.recentCorrect);
      return {
        midi,
        notes,
        attempts,
        correct: sum((c) => c.correct),
        recentCount,
        recentCorrect,
        errorRate: recentCount === 0 ? 0 : (recentCount - recentCorrect) / recentCount,
        ewmaMs,
        bucket: bucketOf({ attempts, ewmaMs }),
      };
    });
}

/**
 * Weakest first, by the sampler's weight. Notes with fewer than `MIN_ATTEMPTS` answers come last
 * (in pitch order): one unlucky answer is not a weakness yet.
 */
export function byWeakness(a: NoteCell, b: NoteCell): number {
  const aRanked = a.attempts >= MIN_ATTEMPTS;
  const bRanked = b.attempts >= MIN_ATTEMPTS;
  if (aRanked !== bRanked) return aRanked ? -1 : 1;
  if (!aRanked) return comparePitch(a.note, b.note);
  return b.weight - a.weight || (b.ewmaMs ?? 0) - (a.ewmaMs ?? 0) || comparePitch(a.note, b.note);
}

/** The `n` weakest notes with at least `MIN_ATTEMPTS` answers. */
export function weakestNotes(cells: readonly NoteCell[], n = 3): NoteCell[] {
  return cells
    .filter((cell) => cell.attempts >= MIN_ATTEMPTS)
    .sort(byWeakness)
    .slice(0, n);
}

export const SORT_COLUMNS = ['weakness', 'note', 'attempts', 'recent', 'overall', 'speed'] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDirection = 'ascending' | 'descending';

/** The order a column sorts in when first chosen: the weakest or most interesting first. */
export const DEFAULT_DIRECTION: Readonly<Record<SortColumn, SortDirection>> = {
  weakness: 'descending',
  note: 'ascending',
  attempts: 'descending',
  recent: 'ascending',
  overall: 'ascending',
  speed: 'descending',
};

const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

/** Sort value of a column; null (no value) always sorts last. */
function sortValue(cell: NoteCell, column: Exclude<SortColumn, 'weakness' | 'note'>) {
  switch (column) {
    case 'attempts':
      return cell.attempts;
    case 'recent':
      return ratio(cell.recentCorrect, cell.recentCount);
    case 'overall':
      return ratio(cell.correct, cell.attempts);
    case 'speed':
      return cell.ewmaMs;
  }
}

/** A sorted copy for the table. Ties, and cells without a value, keep pitch order. */
export function sortCells(
  cells: readonly NoteCell[],
  column: SortColumn,
  direction: SortDirection = DEFAULT_DIRECTION[column],
): NoteCell[] {
  const sign = direction === 'ascending' ? 1 : -1;
  if (column === 'weakness') {
    // "Descending weakness" is weakest first; unranked notes stay last either way.
    return [...cells].sort((a, b) => {
      const aRanked = a.attempts >= MIN_ATTEMPTS;
      if (aRanked !== b.attempts >= MIN_ATTEMPTS || !aRanked) return byWeakness(a, b);
      return direction === 'descending' ? byWeakness(a, b) : byWeakness(b, a);
    });
  }
  if (column === 'note') return [...cells].sort((a, b) => sign * comparePitch(a.note, b.note));
  return [...cells].sort((a, b) => {
    const x = sortValue(a, column);
    const y = sortValue(b, column);
    if (x === null || y === null) {
      return (x === null ? 1 : 0) - (y === null ? 1 : 0) || comparePitch(a.note, b.note);
    }
    return sign * (x - y) || comparePitch(a.note, b.note);
  });
}
