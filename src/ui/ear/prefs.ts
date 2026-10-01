import {
  CHORD_STYLES,
  DEFAULT_CHORD_STYLE,
  DEFAULT_DIRECTION,
  DIRECTION_SETTINGS,
  EAR_FAMILIES,
  type ChordStyle,
  type DirectionSetting,
  type EarFamily,
} from '../../core/earItems.ts';
import {
  ANSWER_MODES,
  DEFAULT_ECHO_SESSION_LENGTH,
  ECHO_SESSION_LENGTHS,
  type AnswerMode,
  type EchoSessionLength,
} from '../../core/earSession.ts';
import {
  DEFAULT_RHYTHM_EAR_SESSION_LENGTH,
  RHYTHM_EAR_FAMILY,
  RHYTHM_EAR_MODES,
  RHYTHM_EAR_SESSION_LENGTHS,
  type RhythmEarFamily,
  type RhythmEarMode,
  type RhythmEarSessionLength,
} from '../../core/rhythmEar.ts';
import { keptLevels } from '../../core/levelChoice.ts';
import { DEFAULT_SESSION_LENGTH, SESSION_LENGTHS, type SessionLength } from '../../core/session.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

/** What the Ear page practises: intervals, chords, melodies, cadences, tunes, or rhythm (dictation). */
export type EarPageFamily = EarFamily | RhythmEarFamily;
export const EAR_PAGE_FAMILIES: readonly EarPageFamily[] = [...EAR_FAMILIES, RHYTHM_EAR_FAMILY];

/** A tune in the key of its lead sheet, or in another one drawn for the session. */
export const TUNE_KEYS = ['own', 'other'] as const;
export type TuneKeyChoice = (typeof TUNE_KEYS)[number];

/** The choices of the Ear page's setup, remembered per browser. */
export interface EarPrefs {
  family: EarPageFamily;
  by: AnswerMode;
  direction: DirectionSetting;
  chordStyle: ChordStyle;
  /** Questions per session of intervals or chords. */
  length: SessionLength;
  /** Melodies per session of Echo. */
  echoLength: EchoSessionLength;
  /** Rhythm: tap it back (`play`) or choose it (`name`). */
  rhythmBy: RhythmEarMode;
  /** Bars per session of rhythm. (Its tempo is Read's, per level: `read/rhythmPrefs.ts`.) */
  rhythmLength: RhythmEarSessionLength;
  /** Tunes: in the lead sheet's key, or in another. */
  tuneKey: TuneKeyChoice;
  /**
   * The level (or tune) picked last for each family: its setup opens on it until that level is
   * mastered (core/levelChoice.ts). A family not here follows the level suggested.
   */
  levels: Partial<Record<EarPageFamily, string>>;
}

export const EAR_PREFS_KEY = 'dacapo.ear';

export const DEFAULT_EAR_PREFS: EarPrefs = {
  family: 'interval',
  by: 'play',
  direction: DEFAULT_DIRECTION,
  chordStyle: DEFAULT_CHORD_STYLE,
  length: DEFAULT_SESSION_LENGTH,
  echoLength: DEFAULT_ECHO_SESSION_LENGTH,
  rhythmBy: 'play',
  rhythmLength: DEFAULT_RHYTHM_EAR_SESSION_LENGTH,
  tuneKey: 'own',
  levels: {},
};

const oneOf = <T>(values: readonly T[], value: unknown, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback;

/** The stored choices; each one that is missing or unknown falls back to its default. */
export function parseEarPrefs(text: string | null): EarPrefs {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = text === null ? null : JSON.parse(text);
    if (typeof value === 'object' && value !== null) stored = value as Record<string, unknown>;
  } catch {
    // A broken value: the defaults.
  }
  const d = DEFAULT_EAR_PREFS;
  return {
    family: oneOf(EAR_PAGE_FAMILIES, stored.family, d.family),
    by: oneOf(ANSWER_MODES, stored.by, d.by),
    direction: oneOf(DIRECTION_SETTINGS, stored.direction, d.direction),
    chordStyle: oneOf(CHORD_STYLES, stored.chordStyle, d.chordStyle),
    length: oneOf(SESSION_LENGTHS, stored.length, d.length),
    echoLength: oneOf(ECHO_SESSION_LENGTHS, stored.echoLength, d.echoLength),
    rhythmBy: oneOf(RHYTHM_EAR_MODES, stored.rhythmBy, d.rhythmBy),
    rhythmLength: oneOf(RHYTHM_EAR_SESSION_LENGTHS, stored.rhythmLength, d.rhythmLength),
    tuneKey: oneOf(TUNE_KEYS, stored.tuneKey, d.tuneKey),
    levels: keptLevels(stored.levels, EAR_PAGE_FAMILIES),
  };
}

export const readEarPrefs = (): EarPrefs => parseEarPrefs(readPref(EAR_PREFS_KEY));

export function writeEarPrefs(prefs: EarPrefs): void {
  writePref(EAR_PREFS_KEY, JSON.stringify(prefs));
}
