// How a note is named on the screen (docs/PERSONAL.md, "Note names"): by its letter, as the app
// always has, or as do re mi for those who ask. Fixed do: C is Do, whatever the key. A naming is
// for display alone: ids, storage and routes keep the letters (`pitchId`, `parsePitch`), and so do
// the names of keys and scales, of chords and their symbols.

import { midiToPitch, type Letter, type Pitch, type Spelling } from './note.ts';
import type { SpelledPitch } from './score.ts';

export const NOTE_NAMINGS = ['letters', 'solfege'] as const;
export type NoteNaming = (typeof NOTE_NAMINGS)[number];

export function isNoteNaming(value: unknown): value is NoteNaming {
  return typeof value === 'string' && (NOTE_NAMINGS as readonly string[]).includes(value);
}

type Syllables = Readonly<Record<Letter, string>>;

const LETTER_NAMES: Syllables = { C: 'C', D: 'D', E: 'E', F: 'F', G: 'G', A: 'A', B: 'B' };
const SOLFEGE: Syllables = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
/**
 * Japanese may end a line between any two kana, and between a kana and the sign or the octave
 * after it. A word joiner (U+2060: it shows nothing, and is not read aloud) keeps a name in one
 * piece, as a letter name is: ド4 never ends a line as ド, with 4 on the next. Korean wraps
 * between words already, and the Latin syllables are words.
 */
export const WORD_JOINER = '⁠';
/** The languages that write do re mi in their own script; the others write it as above. */
const SOLFEGE_BY_LANGUAGE: Readonly<Record<string, Syllables>> = {
  ja: { C: 'ド', D: 'レ', E: 'ミ', F: `フ${WORD_JOINER}ァ`, G: 'ソ', A: 'ラ', B: 'シ' },
  ko: { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' },
};
const JOINED: ReadonlySet<string> = new Set(['ja']);

/** A written note may take a double sign (F𝄪 in G♯ harmonic minor). */
const SIGNS: Readonly<Record<number, string>> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

function syllables(naming: NoteNaming, locale: string): Syllables {
  if (naming === 'letters') return LETTER_NAMES;
  return SOLFEGE_BY_LANGUAGE[locale] ?? SOLFEGE;
}

/**
 * A note's name: the letter or the syllable, the sign after it and the octave after that, in
 * `locale`'s script: `F♯3`, `Fa♯3`, `ファ♯3`, `파♯3`; without an octave, `B♭`, `Si♭`.
 */
export function noteName(
  note: { letter: Letter; alter: number; octave?: number | null },
  naming: NoteNaming,
  locale: string,
): string {
  const rest = `${SIGNS[note.alter] ?? ''}${note.octave ?? ''}`;
  const joiner = naming === 'solfege' && rest !== '' && JOINED.has(locale) ? WORD_JOINER : '';
  return `${syllables(naming, locale)[note.letter]}${joiner}${rest}`;
}

/**
 * The names of notes in one naming and language, for both of the app's spellings: a key's
 * (`Pitch`: `formatPitch`, `letterName`, `midiName`, as `core/note.ts` names them in letters) and
 * a written note's (`SpelledPitch`: `spelledName`, and `letterOf` without the octave).
 */
export interface NoteNames {
  naming: NoteNaming;
  /** `C♯4`, `Do♯4`. */
  formatPitch: (pitch: Pitch) => string;
  /** The name without the octave: `C♯`, `Do♯`. */
  letterName: (pitch: Pick<Pitch, 'letter' | 'accidental'>) => string;
  /** A key by its default spelling: `C♯4` or, with flats, `D♭4`. */
  midiName: (midi: number, spelling?: Spelling) => string;
  /** A written note as its score spells it: `F𝄪5`, `Mi♭4`. */
  spelledName: (pitch: SpelledPitch) => string;
  /** A written note without its octave: `F𝄪`, `Mi♭`. */
  letterOf: (pitch: Pick<SpelledPitch, 'step' | 'alter'>) => string;
}

export function createNoteNames(naming: NoteNaming, locale: string): NoteNames {
  const formatPitch = ({ letter, accidental, octave }: Pitch) =>
    noteName({ letter, alter: accidental, octave }, naming, locale);
  return {
    naming,
    formatPitch,
    letterName: ({ letter, accidental }) => noteName({ letter, alter: accidental }, naming, locale),
    midiName: (midi, spelling = 'sharp') => formatPitch(midiToPitch(midi, spelling)),
    spelledName: ({ step, alter, octave }) =>
      noteName({ letter: step, alter, octave }, naming, locale),
    letterOf: ({ step, alter }) => noteName({ letter: step, alter }, naming, locale),
  };
}

// A dictionary's string names a note of the keyboard as a placeholder: `{C4}`, `{Fs3}`, `{Bb}`
// (the letter, `s` for a sharp or `b` for a flat, the octave if it has one). The letters between
// the braces are the note, never its name: `{C4}` reads C4, Do4, ド4 or 도4.
const NOTE_PLACEHOLDER = /\{([A-G])([sb]?)(\d?)\}/g;
const PLACEHOLDER_ALTER: Readonly<Record<string, number>> = { s: 1, b: -1, '': 0 };

/** `template` with its note placeholders named; every other placeholder is left as it is. */
export function fillNoteNames(template: string, naming: NoteNaming, locale: string): string {
  if (!template.includes('{')) return template;
  return template.replace(NOTE_PLACEHOLDER, (_, letter: Letter, sign: string, octave: string) =>
    noteName(
      { letter, alter: PLACEHOLDER_ALTER[sign]!, octave: octave === '' ? null : Number(octave) },
      naming,
      locale,
    ),
  );
}

/** Whether a placeholder's name (`C4`, `Bb`, not `n` or `tonic`) is a note's. */
export function isNotePlaceholder(name: string): boolean {
  return /^[A-G][sb]?\d?$/.test(name);
}
