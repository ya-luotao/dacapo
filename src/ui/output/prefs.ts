import { readPref, writePref } from '../../lib/localPrefs.ts';

const LEVEL_PREF = 'dacapo.accompaniment.level';

/** Accompaniment loudness as MIDI velocity: a little softer than the demo by default. */
export const ACCOMPANIMENT_LEVELS = { quiet: 44, soft: 60, medium: 72, loud: 88 } as const;
export type AccompanimentLevel = keyof typeof ACCOMPANIMENT_LEVELS;
export const ACCOMPANIMENT_LEVEL_NAMES = Object.keys(ACCOMPANIMENT_LEVELS) as AccompanimentLevel[];

export function readAccompanimentLevel(): AccompanimentLevel {
  const value = readPref(LEVEL_PREF);
  return value !== null && Object.hasOwn(ACCOMPANIMENT_LEVELS, value)
    ? (value as AccompanimentLevel)
    : 'soft';
}

export function writeAccompanimentLevel(level: AccompanimentLevel): void {
  writePref(LEVEL_PREF, level === 'soft' ? null : level);
}
