import { isSightLevelId, type SightLevelId } from '../../core/sightLevels.ts';
import {
  DEFAULT_LOOK_SECONDS,
  DEFAULT_SIGHT_SESSION_LENGTH,
  defaultSightBpm,
  isSightBpm,
  LOOK_SECONDS,
  READ_AHEADS,
  SIGHT_PLAYS,
  SIGHT_SESSION_LENGTHS,
  type LookSeconds,
  type ReadAhead,
  type SightPlay,
  type SightSessionLength,
} from '../../core/sightRead.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

/**
 * Sight-reading's settings on Read, kept in this browser (docs/READING.md, "Sight-reading (R3)"):
 * the tempo of each level, how a fragment is played, read ahead, the look before a run, whether
 * the click stops after the count-in, and how many fragments a session has.
 */
export interface SightPrefs {
  /** Quarters a minute, per level; a level not here plays at its default. */
  tempos: Partial<Record<SightLevelId, number>>;
  play: SightPlay;
  readAhead: ReadAhead;
  look: LookSeconds;
  countInOnly: boolean;
  length: SightSessionLength;
}

export const SIGHT_PREFS_KEY = 'dacapo.read.sight';

export const DEFAULT_SIGHT_PREFS: SightPrefs = {
  tempos: {},
  play: 'time',
  readAhead: 'off',
  look: DEFAULT_LOOK_SECONDS,
  countInOnly: false,
  length: DEFAULT_SIGHT_SESSION_LENGTH,
};

const oneOf = <T>(values: readonly T[], value: unknown, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback;

/** The stored settings; each one missing or out of range falls back to its default. */
export function parseSightPrefs(text: string | null): SightPrefs {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = text === null ? null : JSON.parse(text);
    if (typeof value === 'object' && value !== null) stored = value as Record<string, unknown>;
  } catch {
    // A broken value: the defaults.
  }
  const tempos: Partial<Record<SightLevelId, number>> = {};
  if (typeof stored.tempos === 'object' && stored.tempos !== null) {
    for (const [level, bpm] of Object.entries(stored.tempos))
      if (isSightLevelId(level) && isSightBpm(bpm)) tempos[level] = bpm;
  }
  const d = DEFAULT_SIGHT_PREFS;
  return {
    tempos,
    play: oneOf(SIGHT_PLAYS, stored.play, d.play),
    readAhead: oneOf(READ_AHEADS, stored.readAhead, d.readAhead),
    look: oneOf(LOOK_SECONDS, stored.look, d.look),
    countInOnly: typeof stored.countInOnly === 'boolean' ? stored.countInOnly : d.countInOnly,
    length: oneOf(SIGHT_SESSION_LENGTHS, stored.length, d.length),
  };
}

export const readSightPrefs = (): SightPrefs => parseSightPrefs(readPref(SIGHT_PREFS_KEY));

export function writeSightPrefs(prefs: SightPrefs): void {
  writePref(SIGHT_PREFS_KEY, JSON.stringify(prefs));
}

/** The tempo a level is played at: the one chosen for it, or its default. */
export function sightTempoOf(prefs: SightPrefs, level: SightLevelId): number {
  return prefs.tempos[level] ?? defaultSightBpm(level);
}

/** The prefs with `level`'s tempo set; the default is not stored. */
export function withSightTempo(prefs: SightPrefs, level: SightLevelId, bpm: number): SightPrefs {
  const tempos = { ...prefs.tempos };
  if (bpm === defaultSightBpm(level)) delete tempos[level];
  else tempos[level] = bpm;
  return { ...prefs, tempos };
}
