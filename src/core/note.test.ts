import { describe, expect, it } from 'vitest';
import {
  formatPitch,
  isBlack,
  isMidiNote,
  isOnLine,
  isPianoKey,
  ledgerLineCount,
  MIDDLE_C,
  midiName,
  midiToPitch,
  parsePitch,
  PIANO_HIGHEST,
  PIANO_KEY_COUNT,
  PIANO_LOWEST,
  pitchClass,
  pitchId,
  pitchToMidi,
  samePitch,
  spellingsOf,
  staffPosition,
  type Clef,
  type Pitch,
} from './note.ts';

const p = (text: string): Pitch => {
  const pitch = parsePitch(text);
  if (!pitch) throw new Error(`bad pitch ${text}`);
  return pitch;
};

describe('ranges', () => {
  it('describes an 88-key piano from A0 to C8', () => {
    expect(PIANO_LOWEST).toBe(21);
    expect(PIANO_HIGHEST).toBe(108);
    expect(PIANO_KEY_COUNT).toBe(88);
    expect(MIDDLE_C).toBe(60);
    expect(pitchToMidi(p('A0'))).toBe(PIANO_LOWEST);
    expect(pitchToMidi(p('C8'))).toBe(PIANO_HIGHEST);
    expect(pitchToMidi(p('C4'))).toBe(MIDDLE_C);
  });

  it('isPianoKey accepts exactly 21..108', () => {
    expect(isPianoKey(20)).toBe(false);
    expect(isPianoKey(21)).toBe(true);
    expect(isPianoKey(108)).toBe(true);
    expect(isPianoKey(109)).toBe(false);
    expect(isPianoKey(60.5)).toBe(false);
  });

  it('isMidiNote accepts exactly 0..127 integers', () => {
    expect(isMidiNote(-1)).toBe(false);
    expect(isMidiNote(0)).toBe(true);
    expect(isMidiNote(127)).toBe(true);
    expect(isMidiNote(128)).toBe(false);
    expect(isMidiNote(Number.NaN)).toBe(false);
  });
});

describe('isBlack / pitchClass', () => {
  it('marks the five black keys of every octave', () => {
    const blacks = Array.from({ length: 12 }, (_, i) => isBlack(60 + i));
    expect(blacks).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
    ]);
  });

  it('has 52 white and 36 black keys on the piano', () => {
    let black = 0;
    for (let m = PIANO_LOWEST; m <= PIANO_HIGHEST; m++) if (isBlack(m)) black++;
    expect(black).toBe(36);
    expect(PIANO_KEY_COUNT - black).toBe(52);
  });

  it('handles the piano edges and negative numbers', () => {
    expect(isBlack(21)).toBe(false); // A0
    expect(isBlack(22)).toBe(true); // A#0
    expect(isBlack(108)).toBe(false); // C8
    expect(pitchClass(-1)).toBe(11);
    expect(pitchClass(-12)).toBe(0);
  });
});

describe('pitchToMidi', () => {
  it.each([
    ['C-1', 0],
    ['A0', 21],
    ['Bb0', 22],
    ['C4', 60],
    ['C#4', 61],
    ['Db4', 61],
    ['A4', 69],
    ['C8', 108],
    ['G9', 127],
  ])('%s = %i', (text, midi) => {
    expect(pitchToMidi(p(text))).toBe(midi);
  });

  it('keeps the octave with the letter across the B/C boundary', () => {
    expect(pitchToMidi(p('B#3'))).toBe(60);
    expect(pitchToMidi(p('Cb4'))).toBe(59);
    expect(pitchToMidi(p('B#7'))).toBe(108);
    expect(pitchToMidi(p('Cb1'))).toBe(23);
    expect(pitchToMidi(p('E#4'))).toBe(65);
    expect(pitchToMidi(p('Fb4'))).toBe(64);
  });
});

describe('midiToPitch', () => {
  it('spells white keys as naturals', () => {
    expect(midiToPitch(60)).toEqual(p('C4'));
    expect(midiToPitch(59)).toEqual(p('B3'));
    expect(midiToPitch(21)).toEqual(p('A0'));
    expect(midiToPitch(108)).toEqual(p('C8'));
    expect(midiToPitch(0)).toEqual(p('C-1'));
    expect(midiToPitch(127)).toEqual(p('G9'));
  });

  it('spells black keys with sharps by default and flats on request', () => {
    expect(midiToPitch(61)).toEqual(p('C#4'));
    expect(midiToPitch(61, 'flat')).toEqual(p('Db4'));
    expect(midiToPitch(22, 'flat')).toEqual(p('Bb0'));
    expect(midiToPitch(70)).toEqual(p('A#4'));
    expect(midiToPitch(70, 'flat')).toEqual(p('Bb4'));
  });

  it('round-trips every MIDI note in both spellings', () => {
    for (let m = 0; m <= 127; m++) {
      expect(pitchToMidi(midiToPitch(m, 'sharp'))).toBe(m);
      expect(pitchToMidi(midiToPitch(m, 'flat'))).toBe(m);
    }
  });

  it('rejects non-integers', () => {
    expect(() => midiToPitch(60.5)).toThrow(RangeError);
  });
});

describe('spellingsOf', () => {
  const ids = (midi: number) => spellingsOf(midi).map(pitchId);

  it('lists every single-accidental spelling', () => {
    expect(ids(60)).toEqual(['C4', 'B#3']);
    expect(ids(59)).toEqual(['Cb4', 'B3']);
    expect(ids(61)).toEqual(['Db4', 'C#4']);
    expect(ids(64)).toEqual(['Fb4', 'E4']);
    expect(ids(65)).toEqual(['F4', 'E#4']);
    expect(ids(62)).toEqual(['D4']);
    expect(ids(21)).toEqual(['A0']);
    expect(ids(108)).toEqual(['C8', 'B#7']);
  });

  it('every spelling maps back to the same key', () => {
    for (let m = PIANO_LOWEST; m <= PIANO_HIGHEST; m++) {
      for (const spelling of spellingsOf(m)) expect(pitchToMidi(spelling)).toBe(m);
    }
  });
});

describe('names', () => {
  it('formats with musical symbols and ids with ASCII', () => {
    expect(formatPitch(p('C#4'))).toBe('C♯4');
    expect(formatPitch(p('Db4'))).toBe('D♭4');
    expect(pitchId(p('C♯4'))).toBe('C#4');
    expect(midiName(60)).toBe('C4');
    expect(midiName(61)).toBe('C♯4');
    expect(midiName(61, 'flat')).toBe('D♭4');
  });

  it('parses valid names and rejects invalid ones', () => {
    expect(parsePitch(' Bb-1 ')).toEqual({ letter: 'B', accidental: -1, octave: -1 });
    for (const bad of ['', 'H4', 'c4', 'C', 'C##4', 'Cx4', '4C', 'C4.5']) {
      expect(parsePitch(bad), bad).toBeNull();
    }
  });

  it('samePitch distinguishes enharmonic spellings', () => {
    expect(samePitch(p('C#4'), p('C#4'))).toBe(true);
    expect(samePitch(p('C#4'), p('Db4'))).toBe(false);
    expect(samePitch(p('C4'), p('C5'))).toBe(false);
  });
});

describe('staffPosition', () => {
  const pos = (text: string, clef: Clef) => staffPosition(p(text), clef);

  it('puts the treble clef lines on E4 G4 B4 D5 F5', () => {
    expect(['E4', 'G4', 'B4', 'D5', 'F5'].map((n) => pos(n, 'treble'))).toEqual([0, 2, 4, 6, 8]);
    expect(pos('F4', 'treble')).toBe(1);
  });

  it('puts the bass clef lines on G2 B2 D3 F3 A3', () => {
    expect(['G2', 'B2', 'D3', 'F3', 'A3'].map((n) => pos(n, 'bass'))).toEqual([0, 2, 4, 6, 8]);
  });

  it('places middle C one ledger line below treble and above bass', () => {
    expect(pos('C4', 'treble')).toBe(-2);
    expect(pos('C4', 'bass')).toBe(10);
    expect(ledgerLineCount(-2)).toBe(1);
    expect(ledgerLineCount(10)).toBe(1);
  });

  it('ignores accidentals, so B#3 and Cb4 follow their letter', () => {
    expect(pos('B#3', 'treble')).toBe(pos('B3', 'treble'));
    expect(pos('B#3', 'treble')).toBe(-3);
    expect(pos('Cb4', 'treble')).toBe(pos('C4', 'treble'));
    expect(pos('F#5', 'treble')).toBe(8);
    expect(pos('Bb2', 'bass')).toBe(2);
  });

  it('reaches the piano extremes', () => {
    expect(pos('A0', 'bass')).toBe(-13);
    expect(pos('C8', 'treble')).toBe(26);
    expect(ledgerLineCount(-13)).toBe(6);
    expect(ledgerLineCount(26)).toBe(9);
  });
});

describe('isOnLine / ledgerLineCount', () => {
  it('alternates line and space, including below the staff', () => {
    expect([-3, -2, -1, 0, 1, 8, 9, 10].map(isOnLine)).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it('counts ledger lines only outside the staff', () => {
    expect([-4, -3, -2, -1, 0, 4, 8, 9, 10, 11, 12].map(ledgerLineCount)).toEqual([
      2, 1, 1, 0, 0, 0, 0, 0, 1, 1, 2,
    ]);
  });
});
