import {
  defaultRhythmBpm,
  isRhythmBpm,
  isRhythmLevelId,
  type RhythmLevelId,
} from '../../core/rhythmCells.ts';
import {
  DEFAULT_RHYTHM_SESSION_LENGTH,
  RHYTHM_SESSION_LENGTHS,
  type RhythmSessionLength,
} from '../../core/rhythmRead.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

/**
 * Rhythm's settings on Read, kept in this browser (docs/READING.md, "Timing, shared"): the tempo
 * of each level, whether the click stops after the count-in, whether the counts are written under
 * the line, and how many exercises a session has.
 */
export interface RhythmPrefs {
  /** Beats a minute, per level; a level not here plays at its default. */
  tempos: Partial<Record<RhythmLevelId, number>>;
  /** The click stops after the count-in: the pulse is the player's own. */
  countInOnly: boolean;
  /** The counts under the line ("1 (2) & 3"). */
  counts: boolean;
  length: RhythmSessionLength;
}

export const RHYTHM_PREFS_KEY = 'dacapo.read.rhythm';

export const DEFAULT_RHYTHM_PREFS: RhythmPrefs = {
  tempos: {},
  countInOnly: false,
  counts: false,
  length: DEFAULT_RHYTHM_SESSION_LENGTH,
};

/** The stored settings; each one missing or out of range falls back to its default. */
export function parseRhythmPrefs(text: string | null): RhythmPrefs {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = text === null ? null : JSON.parse(text);
    if (typeof value === 'object' && value !== null) stored = value as Record<string, unknown>;
  } catch {
    // A broken value: the defaults.
  }
  const tempos: Partial<Record<RhythmLevelId, number>> = {};
  if (typeof stored.tempos === 'object' && stored.tempos !== null) {
    for (const [level, bpm] of Object.entries(stored.tempos))
      if (isRhythmLevelId(level) && isRhythmBpm(bpm)) tempos[level] = bpm;
  }
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  return {
    tempos,
    countInOnly: bool(stored.countInOnly, DEFAULT_RHYTHM_PREFS.countInOnly),
    counts: bool(stored.counts, DEFAULT_RHYTHM_PREFS.counts),
    length: (RHYTHM_SESSION_LENGTHS as readonly unknown[]).includes(stored.length)
      ? (stored.length as RhythmSessionLength)
      : DEFAULT_RHYTHM_PREFS.length,
  };
}

export const readRhythmPrefs = (): RhythmPrefs => parseRhythmPrefs(readPref(RHYTHM_PREFS_KEY));

export function writeRhythmPrefs(prefs: RhythmPrefs): void {
  writePref(RHYTHM_PREFS_KEY, JSON.stringify(prefs));
}

/** The tempo a level is played at: the one chosen for it, or its default. */
export function tempoOf(prefs: RhythmPrefs, level: RhythmLevelId): number {
  return prefs.tempos[level] ?? defaultRhythmBpm(level);
}

/** The prefs with `level`'s tempo set; the default is not stored. */
export function withTempo(prefs: RhythmPrefs, level: RhythmLevelId, bpm: number): RhythmPrefs {
  const tempos = { ...prefs.tempos };
  if (bpm === defaultRhythmBpm(level)) delete tempos[level];
  else tempos[level] = bpm;
  return { ...prefs, tempos };
}
