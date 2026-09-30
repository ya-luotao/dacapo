import { describe, expect, it } from 'vitest';
import { formatSymbol, parseSymbol, type SymbolQuality } from '../../core/chordSymbols.ts';
import { pitchToMidi } from '../../core/note.ts';
import {
  accidentalShifts,
  chordOn,
  chordSymbol,
  invert,
  judgeChord,
  keyChords,
  noteName,
  ROOTS,
  SEVENTHS,
  TRIADS,
  type Quality,
} from './harmony.ts';
import { pitch } from './notes.ts';

const names = (ps: readonly Parameters<typeof noteName>[0][]) => ps.map(noteName).join(' ');

describe('chords for the lesson on harmony', () => {
  it('stack thirds from the root, each letter once', () => {
    expect(names(chordOn('C', 'major'))).toBe('C E G');
    expect(names(chordOn('C', 'minor'))).toBe('C E♭ G');
    expect(names(chordOn('Bb', 'diminished'))).toBe('B♭ D♭ F♭');
    expect(names(chordOn('A', 'augmented'))).toBe('A C♯ E♯');
    expect(names(chordOn('G', 'dom7'))).toBe('G B D F');
    expect(names(chordOn('D', 'hdim7'))).toBe('D F A♭ C');
    expect(names(chordOn('F', 'maj7'))).toBe('F A C E');
  });

  it('can build every quality on every root offered', () => {
    for (const root of ROOTS) {
      for (const quality of [...TRIADS, ...SEVENTHS]) {
        expect(() => chordOn(root, quality), `${root} ${quality}`).not.toThrow();
      }
    }
  });

  it('are named as lead sheets write them', () => {
    expect(chordSymbol(pitch('A4'), 'minor')).toBe('Am');
    expect(chordSymbol(pitch('B4'), 'diminished')).toBe('B°');
    expect(chordSymbol(pitch('Bb4'), 'maj7')).toBe('B♭maj7');
    expect(chordSymbol(pitch('D4'), 'hdim7')).toBe('Dm7♭5');
    expect(chordSymbol(pitch('F4'), 'major', pitch('A4'))).toBe('F/A');
    expect(chordSymbol(pitch('F4'), 'major', pitch('F3'))).toBe('F');
  });

  it('invert with the 3rd or the 5th in the bass, on the treble staff', () => {
    const c = chordOn('C', 'major');
    expect(invert(c, 1).map(pitchToMidi)).toEqual([64, 67, 72]);
    expect(invert(c, 2).map(pitchToMidi)).toEqual([67, 72, 76]);
    // A bass above B4 comes down an octave.
    expect(invert(chordOn('A', 'major'), 1).map(pitchToMidi)).toEqual([61, 64, 69]);
  });

  it('move accidentals a sixth or less apart into columns', () => {
    expect(accidentalShifts(chordOn('C', 'diminished'))).toEqual([0, 10, 0]);
    expect(accidentalShifts(chordOn('C', 'minor'))).toEqual([0, 0, 0]);
    expect(accidentalShifts(chordOn('Bb', 'diminished'))).toEqual([20, 10, 0]);
    expect(accidentalShifts(chordOn('Bb', 'hdim7'))).toEqual([0, 20, 10, 0]);
  });

  it('give a major key its seven triads: major on I, IV and V, minor on ii, iii, vi', () => {
    const chords = keyChords('C');
    expect(chords.map((c) => c.quality)).toEqual([
      'major',
      'minor',
      'minor',
      'major',
      'major',
      'minor',
      'diminished',
    ]);
    expect(names(chords[6]!.notes)).toBe('B D F');
    expect(keyChords('Eb').map((c) => names(c.notes))[4]).toBe('B♭ D F');
    expect(keyChords('A').map((c) => c.quality)).toEqual(chords.map((c) => c.quality));
  });

  it('judge a chord by its pitch classes, played together or one at a time', () => {
    const dMinor = [62, 65, 69];
    expect(judgeChord(dMinor, [50])).toBe('pending');
    expect(judgeChord(dMinor, [50, 77, 57])).toBe('right');
    expect(judgeChord(dMinor, [62, 66])).toBe('wrong');
    // F/A: A must be the lowest key.
    const fOverA = [57, 60, 65];
    expect(judgeChord(fOverA, [53, 57, 60], true)).toBe('wrong');
    expect(judgeChord(fOverA, [57, 65, 72], true)).toBe('right');
  });
});

describe('the lesson’s chord symbols', () => {
  it('are written as the Harmony page writes them', () => {
    const CORE: Record<Quality, SymbolQuality> = {
      major: 'maj',
      minor: 'min',
      diminished: 'dim',
      augmented: 'aug',
      dom7: 'dom7',
      maj7: 'maj7',
      min7: 'min7',
      hdim7: 'hdim7',
    };
    for (const [lesson, quality] of Object.entries(CORE) as [Quality, SymbolQuality][]) {
      for (const root of [
        { letter: 'C', accidental: 0 },
        { letter: 'B', accidental: -1 },
        { letter: 'F', accidental: 1 },
      ] as const) {
        const written = chordSymbol(root, lesson);
        expect(written).toBe(
          formatSymbol({
            root: { step: root.letter, alter: root.accidental },
            quality,
            bass: null,
          }),
        );
        expect(parseSymbol(written)).not.toBeNull();
      }
    }
    expect(
      chordSymbol({ letter: 'F', accidental: 0 }, 'major', { letter: 'A', accidental: 0 }),
    ).toBe('F/A');
    expect(parseSymbol('F/A')).not.toBeNull();
  });
});
