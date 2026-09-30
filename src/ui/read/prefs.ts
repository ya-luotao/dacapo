import { ANSWER_MODES, type AnswerMode } from '../../core/earSession.ts';
import { THEORY_FAMILIES, type TheoryFamily } from '../../core/theoryItems.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

/** What Read's setup offers to read: single notes, one of the theory cards, or a rhythm line. */
export type ReadChoice = 'notes' | TheoryFamily | 'rhythm';

/**
 * The choices, in groups: the cards, and what is read in time (Rhythm; Sight-reading will join
 * it, docs/READING.md).
 */
export const READ_CHOICE_GROUPS: readonly {
  id: 'cards' | 'time';
  choices: readonly ReadChoice[];
}[] = [
  { id: 'cards', choices: ['notes', ...THEORY_FAMILIES] },
  { id: 'time', choices: ['rhythm'] },
];

export const READ_CHOICES: readonly ReadChoice[] = READ_CHOICE_GROUPS.flatMap((g) => g.choices);

/** The choices of Read's setup remembered per browser. */
export interface ReadPrefs {
  choice: ReadChoice;
  /** How chords are answered: played as written (the default) or named. */
  chordBy: AnswerMode;
}

export const READ_PREFS_KEY = 'dacapo.read';

export const DEFAULT_READ_PREFS: ReadPrefs = { choice: 'notes', chordBy: 'play' };

const oneOf = <T>(values: readonly T[], value: unknown, fallback: T): T =>
  values.includes(value as T) ? (value as T) : fallback;

/** The stored choices; each one that is missing or unknown falls back to its default. */
export function parseReadPrefs(text: string | null): ReadPrefs {
  let stored: Record<string, unknown> = {};
  try {
    const value: unknown = text === null ? null : JSON.parse(text);
    if (typeof value === 'object' && value !== null) stored = value as Record<string, unknown>;
  } catch {
    // A broken value: the defaults.
  }
  return {
    choice: oneOf(READ_CHOICES, stored.choice, DEFAULT_READ_PREFS.choice),
    chordBy: oneOf(ANSWER_MODES, stored.chordBy, DEFAULT_READ_PREFS.chordBy),
  };
}

export const readReadPrefs = (): ReadPrefs => parseReadPrefs(readPref(READ_PREFS_KEY));

export function writeReadPrefs(prefs: ReadPrefs): void {
  writePref(READ_PREFS_KEY, JSON.stringify(prefs));
}
