import { describe, expect, it } from 'vitest';
import {
  formatPitch,
  LETTERS,
  letterName,
  midiName,
  parsePitch,
  PIANO_HIGHEST,
  PIANO_LOWEST,
  pitchId,
  type Accidental,
  type Pitch,
} from './note.ts';
import {
  createNoteNames,
  fillNoteNames,
  isNoteNaming,
  isNotePlaceholder,
  NOTE_NAMINGS,
  noteName,
  WORD_JOINER,
} from './noteNames.ts';

const LOCALES = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'] as const;
const ACCIDENTALS: readonly Accidental[] = [-1, 0, 1];
/** A name as it is seen: without the joiners that keep a Japanese name on one line. */
const seen = (name: string) => name.replaceAll(WORD_JOINER, '');

describe('noteName', () => {
  it('names every letter as do re mi, C as Do whatever the key', () => {
    const names = (locale: string) =>
      LETTERS.map((letter) => noteName({ letter, alter: 0 }, 'solfege', locale));
    expect(names('en')).toEqual(['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']);
    expect(names('zh-CN')).toEqual(names('en'));
    expect(names('zh-TW')).toEqual(names('en'));
    expect(names('ja').map(seen)).toEqual(['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ']);
    expect(names('ko')).toEqual(['도', '레', '미', '파', '솔', '라', '시']);
  });

  it('keeps the letters in every language', () => {
    for (const locale of LOCALES) {
      expect(LETTERS.map((letter) => noteName({ letter, alter: 0 }, 'letters', locale))).toEqual([
        ...LETTERS,
      ]);
    }
  });

  it('writes the sign after the name and the octave after the sign', () => {
    expect(noteName({ letter: 'C', alter: 0, octave: 4 }, 'solfege', 'en')).toBe('Do4');
    expect(noteName({ letter: 'F', alter: 1, octave: 3 }, 'solfege', 'en')).toBe('Fa♯3');
    expect(noteName({ letter: 'B', alter: -1 }, 'solfege', 'en')).toBe('Si♭');
    expect(noteName({ letter: 'G', alter: 1, octave: 4 }, 'solfege', 'en')).toBe('Sol♯4');
    expect(seen(noteName({ letter: 'F', alter: 1, octave: 4 }, 'solfege', 'ja'))).toBe('ファ♯4');
    expect(seen(noteName({ letter: 'B', alter: -1, octave: 2 }, 'solfege', 'ja'))).toBe('シ♭2');
    expect(noteName({ letter: 'G', alter: 1, octave: 4 }, 'solfege', 'ko')).toBe('솔♯4');
    expect(noteName({ letter: 'E', alter: -1 }, 'solfege', 'ko')).toBe('미♭');
    expect(noteName({ letter: 'F', alter: 1, octave: 3 }, 'letters', 'ja')).toBe('F♯3');
  });

  it('writes the double signs a scale or a chord may need', () => {
    expect(noteName({ letter: 'F', alter: 2, octave: 5 }, 'letters', 'en')).toBe('F𝄪5');
    expect(noteName({ letter: 'F', alter: 2, octave: 5 }, 'solfege', 'en')).toBe('Fa𝄪5');
    expect(seen(noteName({ letter: 'B', alter: -2 }, 'solfege', 'ja'))).toBe('シ𝄫');
    expect(noteName({ letter: 'B', alter: -2 }, 'solfege', 'ko')).toBe('시𝄫');
  });

  it('writes every octave of the keyboard, and those below it', () => {
    expect(noteName({ letter: 'A', alter: 0, octave: 0 }, 'solfege', 'en')).toBe('La0');
    expect(seen(noteName({ letter: 'C', alter: 0, octave: 8 }, 'solfege', 'ja'))).toBe('ド8');
    expect(noteName({ letter: 'C', alter: 0, octave: -1 }, 'solfege', 'ko')).toBe('도-1');
    expect(noteName({ letter: 'C', alter: 0, octave: null }, 'solfege', 'en')).toBe('Do');
  });

  it('keeps a Japanese name in one piece: a word joiner wherever a line could end in it', () => {
    const J = WORD_JOINER;
    expect(J).toBe('⁠');
    expect(noteName({ letter: 'C', alter: 0, octave: 4 }, 'solfege', 'ja')).toBe(`ド${J}4`);
    expect(noteName({ letter: 'F', alter: 1, octave: 4 }, 'solfege', 'ja')).toBe(`フ${J}ァ${J}♯4`);
    expect(noteName({ letter: 'F', alter: 0 }, 'solfege', 'ja')).toBe(`フ${J}ァ`);
    expect(noteName({ letter: 'B', alter: -1 }, 'solfege', 'ja')).toBe(`シ${J}♭`);
    // A syllable alone has nothing to be parted from.
    expect(noteName({ letter: 'C', alter: 0 }, 'solfege', 'ja')).toBe('ド');
    // Letters, and the languages that wrap between words, take none.
    expect(noteName({ letter: 'F', alter: 1, octave: 4 }, 'letters', 'ja')).toBe('F♯4');
    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ko']) {
      expect(noteName({ letter: 'F', alter: 1, octave: 4 }, 'solfege', locale)).not.toContain(J);
    }
  });
});

describe('createNoteNames', () => {
  const pitches: Pitch[] = LETTERS.flatMap((letter) =>
    ACCIDENTALS.flatMap((accidental) =>
      [0, 4, 8].map((octave): Pitch => ({ letter, accidental, octave })),
    ),
  );

  it('in letters names every pitch and key as core/note.ts does, in every language', () => {
    for (const locale of LOCALES) {
      const names = createNoteNames('letters', locale);
      for (const pitch of pitches) {
        expect(names.formatPitch(pitch)).toBe(formatPitch(pitch));
        expect(names.letterName(pitch)).toBe(letterName(pitch));
        expect(names.spelledName({ step: pitch.letter, alter: pitch.accidental, octave: 4 })).toBe(
          formatPitch({ ...pitch, octave: 4 }),
        );
        expect(names.letterOf({ step: pitch.letter, alter: pitch.accidental })).toBe(
          letterName(pitch),
        );
      }
      for (let midi = PIANO_LOWEST; midi <= PIANO_HIGHEST; midi++) {
        expect(names.midiName(midi)).toBe(midiName(midi));
        expect(names.midiName(midi, 'flat')).toBe(midiName(midi, 'flat'));
      }
    }
  });

  it('in do re mi names a key by its sharp, or by its flat when asked', () => {
    const names = createNoteNames('solfege', 'en');
    expect(names.midiName(60)).toBe('Do4');
    expect(names.midiName(61)).toBe('Do♯4');
    expect(names.midiName(61, 'flat')).toBe('Re♭4');
    expect(names.midiName(21)).toBe('La0');
    expect(names.midiName(108)).toBe('Do8');
    expect(names.formatPitch({ letter: 'B', accidental: 1, octave: 3 })).toBe('Si♯3');
    expect(names.letterName({ letter: 'G', accidental: -1 })).toBe('Sol♭');
    expect(names.spelledName({ step: 'F', alter: 2, octave: 5 })).toBe('Fa𝄪5');
    expect(names.letterOf({ step: 'E', alter: -1 })).toBe('Mi♭');
    expect(names.naming).toBe('solfege');
  });

  it('writes do re mi in the language’s own script', () => {
    expect(seen(createNoteNames('solfege', 'ja').midiName(66))).toBe('ファ♯4');
    expect(createNoteNames('solfege', 'ko').midiName(68)).toBe('솔♯4');
    expect(createNoteNames('solfege', 'zh-CN').midiName(68)).toBe('Sol♯4');
    expect(createNoteNames('solfege', 'zh-TW').midiName(70, 'flat')).toBe('Si♭4');
    // A language the app does not have falls back to the Latin spelling.
    expect(createNoteNames('solfege', 'fr').midiName(62)).toBe('Re4');
  });
});

describe('the stable forms', () => {
  it('are letters whatever the naming: ids are made and read back by core/note.ts alone', () => {
    const pitch: Pitch = { letter: 'F', accidental: 1, octave: 3 };
    expect(pitchId(pitch)).toBe('F#3');
    expect(parsePitch('F#3')).toEqual(pitch);
    expect(parsePitch('F♯3')).toEqual(pitch);
    expect(parsePitch(pitchId({ letter: 'B', accidental: -1, octave: 2 }))).toEqual({
      letter: 'B',
      accidental: -1,
      octave: 2,
    });
    // A name in do re mi is for the screen: it is no id, and is never read back.
    expect(parsePitch(createNoteNames('solfege', 'en').formatPitch(pitch))).toBeNull();
    expect(parsePitch(createNoteNames('solfege', 'ja').formatPitch(pitch))).toBeNull();
  });
});

describe('fillNoteNames', () => {
  it('names the notes a dictionary’s string holds, in the naming and the language', () => {
    const template = 'Treble: {C4} to {C5}, with {Fs3}, {Bb} and middle {C}';
    expect(fillNoteNames(template, 'letters', 'en')).toBe(
      'Treble: C4 to C5, with F♯3, B♭ and middle C',
    );
    expect(fillNoteNames(template, 'solfege', 'en')).toBe(
      'Treble: Do4 to Do5, with Fa♯3, Si♭ and middle Do',
    );
    expect(seen(fillNoteNames('{A0}〜{C8}', 'solfege', 'ja'))).toBe('ラ0〜ド8');
    expect(fillNoteNames('가운데 {C}', 'solfege', 'ko')).toBe('가운데 도');
  });

  it('leaves every other placeholder, and a string without one, as it is', () => {
    expect(fillNoteNames('{n} of {total}: {name}', 'solfege', 'en')).toBe('{n} of {total}: {name}');
    expect(fillNoteNames('{low}–{high}', 'solfege', 'ja')).toBe('{low}–{high}');
    expect(fillNoteNames('C major', 'solfege', 'en')).toBe('C major');
  });

  it('tells a note’s placeholder from the others', () => {
    for (const name of ['C', 'C4', 'Fs3', 'Bb', 'A0', 'Gs']) {
      expect(isNotePlaceholder(name), name).toBe(true);
    }
    for (const name of ['n', 'name', 'tonic', 'b', 'H4', 'C44', 'Cx', 'bass']) {
      expect(isNotePlaceholder(name), name).toBe(false);
    }
  });
});

describe('isNoteNaming', () => {
  it('knows the two namings and nothing else', () => {
    expect(NOTE_NAMINGS).toEqual(['letters', 'solfege']);
    expect(isNoteNaming('letters')).toBe(true);
    expect(isNoteNaming('solfege')).toBe(true);
    expect(isNoteNaming('numbers')).toBe(false);
    expect(isNoteNaming(null)).toBe(false);
    expect(isNoteNaming(undefined)).toBe(false);
  });
});
