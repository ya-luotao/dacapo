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
import { DEFAULT_SESSION_LENGTH, SESSION_LENGTHS, type SessionLength } from '../../core/session.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

/** The choices of the Ear page's setup, remembered per browser. */
export interface EarPrefs {
  family: EarFamily;
  by: AnswerMode;
  direction: DirectionSetting;
  chordStyle: ChordStyle;
  /** Questions per session of intervals or chords. */
  length: SessionLength;
  /** Melodies per session of Echo. */
  echoLength: EchoSessionLength;
}

export const EAR_PREFS_KEY = 'dacapo.ear';

export const DEFAULT_EAR_PREFS: EarPrefs = {
  family: 'interval',
  by: 'play',
  direction: DEFAULT_DIRECTION,
  chordStyle: DEFAULT_CHORD_STYLE,
  length: DEFAULT_SESSION_LENGTH,
  echoLength: DEFAULT_ECHO_SESSION_LENGTH,
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
    family: oneOf(EAR_FAMILIES, stored.family, d.family),
    by: oneOf(ANSWER_MODES, stored.by, d.by),
    direction: oneOf(DIRECTION_SETTINGS, stored.direction, d.direction),
    chordStyle: oneOf(CHORD_STYLES, stored.chordStyle, d.chordStyle),
    length: oneOf(SESSION_LENGTHS, stored.length, d.length),
    echoLength: oneOf(ECHO_SESSION_LENGTHS, stored.echoLength, d.echoLength),
  };
}

export const readEarPrefs = (): EarPrefs => parseEarPrefs(readPref(EAR_PREFS_KEY));

export function writeEarPrefs(prefs: EarPrefs): void {
  writePref(EAR_PREFS_KEY, JSON.stringify(prefs));
}
