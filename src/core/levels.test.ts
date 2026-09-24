import { describe, expect, it } from 'vitest';
import {
  getLevel,
  isLevelId,
  LEVEL_IDS,
  LEVELS,
  nextLevel,
  noteKey,
  parseNoteKey,
  staffNote,
  type LevelId,
} from './levels.ts';
import { ledgerLineCount, parsePitch, pitchToMidi, staffPosition, type Pitch } from './note.ts';

const p = (text: string): Pitch => {
  const pitch = parsePitch(text);
  if (!pitch) throw new Error(`bad pitch ${text}`);
  return pitch;
};

const keys = (id: LevelId) => getLevel(id).notes.map((note) => note.key);
const onStaff = (id: LevelId, clef: string) =>
  getLevel(id)
    .notes.filter((note) => note.clef === clef)
    .map((note) => note.key.split('@')[0]);

describe('note keys', () => {
  it('separates the same pitch on the two staves', () => {
    expect(noteKey(p('C4'), 'treble')).toBe('C4@treble');
    expect(noteKey(p('C4'), 'bass')).toBe('C4@bass');
    expect(noteKey(p('Db4'), 'bass')).toBe('Db4@bass');
  });

  it('round-trips through parseNoteKey', () => {
    for (const level of LEVELS) {
      for (const note of level.notes) expect(parseNoteKey(note.key)).toEqual(note);
    }
    expect(parseNoteKey('C4')).toBeNull();
    expect(parseNoteKey('C4@alto')).toBeNull();
    expect(parseNoteKey('H4@treble')).toBeNull();
    expect(parseNoteKey('C4@treble@bass')).toBeNull();
  });

  it('knows the MIDI number', () => {
    expect(staffNote(p('C4'), 'bass').midi).toBe(60);
    expect(staffNote(p('Bb3'), 'treble').midi).toBe(58);
  });
});

describe('levels', () => {
  it('defines L1–L7 in order', () => {
    expect(LEVELS.map((level) => level.id)).toEqual([...LEVEL_IDS]);
    expect(LEVEL_IDS).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']);
  });

  it('has non-empty pools without duplicate keys, inside the level range', () => {
    for (const level of LEVELS) {
      expect(level.notes.length).toBeGreaterThan(1);
      expect(new Set(level.notes.map((note) => note.key)).size).toBe(level.notes.length);
      for (const note of level.notes) {
        expect(note.midi).toBeGreaterThanOrEqual(pitchToMidi(level.low));
        expect(note.midi).toBeLessThanOrEqual(pitchToMidi(level.high));
        expect(level.clefs).toContain(note.clef);
      }
    }
  });

  it('L1–L6 use natural notes only', () => {
    for (const id of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const) {
      expect(getLevel(id).notes.every((note) => note.pitch.accidental === 0)).toBe(true);
    }
  });

  it('L1 is the treble middle-C position', () => {
    expect(keys('L1')).toEqual(['C4', 'D4', 'E4', 'F4', 'G4'].map((n) => `${n}@treble`));
  });

  it('L2 is treble C4–C5', () => {
    expect(onStaff('L2', 'treble')).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect(onStaff('L2', 'bass')).toEqual([]);
  });

  it('L3 is the bass middle-C position', () => {
    expect(keys('L3')).toEqual(['F3', 'G3', 'A3', 'B3', 'C4'].map((n) => `${n}@bass`));
  });

  it('L4 is bass C3–C4', () => {
    expect(onStaff('L4', 'bass')).toEqual(['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4']);
    expect(onStaff('L4', 'treble')).toEqual([]);
  });
});

describe('L5 grand staff pool', () => {
  it('writes G2–A3 in bass, E4–G5 in treble and B3–D4 on both staves', () => {
    expect(onStaff('L5', 'bass')).toEqual([
      'G2',
      'A2',
      'B2',
      'C3',
      'D3',
      'E3',
      'F3',
      'G3',
      'A3',
      'B3',
      'C4',
      'D4',
    ]);
    expect(onStaff('L5', 'treble')).toEqual([
      'B3',
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
      'D5',
      'E5',
      'F5',
      'G5',
    ]);
  });

  it('includes middle C on either staff', () => {
    expect(keys('L5')).toEqual(expect.arrayContaining(['C4@treble', 'C4@bass']));
  });

  it('needs at most one ledger line and covers every natural in G2–G5', () => {
    const level = getLevel('L5');
    for (const note of level.notes) {
      expect(ledgerLineCount(staffPosition(note.pitch, note.clef))).toBeLessThanOrEqual(1);
    }
    const covered = new Set(level.notes.map((note) => note.midi));
    for (let midi = 43; midi <= 79; midi++) {
      if (![1, 3, 6, 8, 10].includes(midi % 12)) expect(covered.has(midi)).toBe(true);
    }
  });
});

describe('L6 ledger-line pool', () => {
  it('spans C2–C6 with up to two ledger lines on either side', () => {
    const level = getLevel('L6');
    const ledger = level.notes.map((n) => ledgerLineCount(staffPosition(n.pitch, n.clef)));
    expect(Math.max(...ledger)).toBe(2);
    expect(keys('L6')).toEqual(expect.arrayContaining(['C2@bass', 'C6@treble']));
    expect(onStaff('L6', 'bass').at(-1)).toBe('F4');
    expect(onStaff('L6', 'treble')[0]).toBe('G3');
  });
});

describe('L7 sharps and flats pool', () => {
  const level = getLevel('L7');

  it('is the L5 staff notes with a sharp or flat, black keys only', () => {
    for (const note of level.notes) {
      expect(note.pitch.accidental).not.toBe(0);
      expect([1, 3, 6, 8, 10]).toContain(note.midi % 12);
      const natural = `${note.pitch.letter}${note.pitch.octave}@${note.clef}`;
      expect(keys('L5')).toContain(natural);
    }
  });

  it('writes every black key in G2–G5 both ways', () => {
    for (let midi = 44; midi <= 78; midi++) {
      if (![1, 3, 6, 8, 10].includes(midi % 12)) continue;
      const spellings = level.notes.filter((note) => note.midi === midi);
      expect(spellings.some((note) => note.pitch.accidental === 1)).toBe(true);
      expect(spellings.some((note) => note.pitch.accidental === -1)).toBe(true);
    }
  });

  it('stays inside G2–G5 and leaves out E♯, B♯, C♭ and F♭', () => {
    expect(keys('L7')).not.toContain('Gb2@bass');
    expect(keys('L7')).not.toContain('G#5@treble');
    expect(keys('L7').some((key) => /^(E#|B#|Cb|Fb)/.test(key))).toBe(false);
    expect(keys('L7')).toEqual(
      expect.arrayContaining(['C#4@treble', 'Db4@treble', 'C#4@bass', 'Db4@bass', 'Bb3@treble']),
    );
  });
});

describe('level helpers', () => {
  it('nextLevel walks the list and stops at the end', () => {
    expect(nextLevel('L1')).toBe('L2');
    expect(nextLevel('L6')).toBe('L7');
    expect(nextLevel('L7')).toBeNull();
  });

  it('isLevelId validates stored values', () => {
    expect(isLevelId('L3')).toBe(true);
    expect(isLevelId('L8')).toBe(false);
    expect(isLevelId(3)).toBe(false);
  });
});
