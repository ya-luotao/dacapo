import { describe, expect, it } from 'vitest';
import { parseNoteKey, type StaffNote } from '../../../core/levels.ts';
import {
  columnWidth,
  FIRST_COLUMN,
  keyboardRange,
  layoutSystems,
  ledgerLines,
  noteY,
  staffGeometry,
} from './layout.ts';

const note = (key: string): StaffNote => parseNoteKey(key)!;
const items = (...keys: string[]) => keys.map((key) => ({ note: note(key) }));

describe('staffGeometry', () => {
  it('leaves room for the clefs and six spaces between the staves by default', () => {
    const g = staffGeometry([note('E4@treble'), note('G2@bass')]);
    expect(g.trebleTop).toBe(2);
    expect(g.bassTop - g.trebleTop).toBe(8);
    expect(g.height).toBeGreaterThan(g.bassTop + 4);
  });

  it('grows for ledger lines above, between and below the staves', () => {
    const plain = staffGeometry([note('E4@treble')]);
    const wide = staffGeometry([
      note('C6@treble'),
      note('G3@treble'),
      note('F4@bass'),
      note('C2@bass'),
    ]);
    expect(wide.trebleTop).toBeGreaterThan(plain.trebleTop);
    expect(wide.bassTop - wide.trebleTop).toBeGreaterThan(plain.bassTop - plain.trebleTop);
    expect(wide.stripBase - wide.bassTop).toBeGreaterThan(plain.stripBase - plain.bassTop);
    // Nothing is drawn above the top of the picture.
    const c6 = note('C6@treble');
    expect(noteY(c6, wide) - 0.5).toBeGreaterThanOrEqual(0);
  });
});

describe('note positions', () => {
  const g = staffGeometry([]);

  it('puts lines and spaces half a space apart, from the top line down', () => {
    expect(noteY(note('F5@treble'), g)).toBe(g.trebleTop);
    expect(noteY(note('E4@treble'), g)).toBe(g.trebleTop + 4);
    expect(noteY(note('D4@treble'), g)).toBe(g.trebleTop + 4.5);
    expect(noteY(note('A3@bass'), g)).toBe(g.bassTop);
    expect(noteY(note('G2@bass'), g)).toBe(g.bassTop + 4);
    // Accidentals do not move a note.
    expect(noteY(note('C#4@treble'), g)).toBe(noteY(note('C4@treble'), g));
  });

  it('draws ledger lines on the line positions between the staff and the note', () => {
    expect(ledgerLines(note('E4@treble'), g)).toEqual([]);
    expect(ledgerLines(note('C4@treble'), g)).toEqual([g.trebleTop + 5]);
    expect(ledgerLines(note('B3@treble'), g)).toEqual([g.trebleTop + 5]);
    expect(ledgerLines(note('A3@treble'), g)).toEqual([g.trebleTop + 5, g.trebleTop + 6]);
    expect(ledgerLines(note('C4@bass'), g)).toEqual([g.bassTop - 1]);
    expect(ledgerLines(note('C6@treble'), g)).toEqual([g.trebleTop - 1, g.trebleTop - 2]);
    expect(ledgerLines(note('C2@bass'), g)).toEqual([g.bassTop + 5, g.bassTop + 6]);
  });
});

describe('layoutSystems', () => {
  const g = staffGeometry([]);

  it('places columns left to right after the clefs, wider for accidentals', () => {
    const [system] = layoutSystems(items('C4@treble', 'C#4@treble', 'D4@treble'), 100, g);
    const [c, cs, d] = system!.columns;
    expect(c!.left).toBe(FIRST_COLUMN);
    expect(cs!.left).toBe(c!.left + c!.width);
    expect(cs!.width).toBeGreaterThan(c!.width);
    expect(d!.left).toBe(cs!.left + cs!.width);
    expect(cs!.accidental).toBe(1);
    // The head stands at the same place in every column; an accidental goes to its left.
    expect(c!.x - c!.left).toBeCloseTo(d!.x - d!.left, 9);
    expect(cs!.x - cs!.left).toBeGreaterThan(c!.x - c!.left);
    expect(system!.width).toBeGreaterThan(d!.left + d!.width);
  });

  it('wraps into systems that fit the width, keeping the order', () => {
    const list = items('C4@treble', 'D4@treble', 'E4@treble', 'F4@treble', 'G4@treble');
    const width = FIRST_COLUMN + 2 * columnWidth(note('C4@treble')) + 1;
    const systems = layoutSystems(list, width, g);
    expect(systems.map((s) => s.columns.map((c) => c.item.note.key))).toEqual([
      ['C4@treble', 'D4@treble'],
      ['E4@treble', 'F4@treble'],
      ['G4@treble'],
    ]);
    for (const s of systems) expect(s.width).toBeLessThanOrEqual(width);
  });

  it('keeps at least one note per system when the space is too narrow', () => {
    expect(layoutSystems(items('C4@treble', 'D4@treble'), 1, g)).toHaveLength(2);
    expect(layoutSystems([], 50, g)).toEqual([]);
  });
});

describe('keyboardRange', () => {
  it('spans whole octaves around the keys', () => {
    expect(keyboardRange([60, 67])).toEqual({ low: 60, high: 71 });
    expect(keyboardRange([61, 43, 72])).toEqual({ low: 36, high: 83 });
  });

  it('stays on the 88 keys and ignores keys off the piano', () => {
    expect(keyboardRange([22, 108])).toEqual({ low: 21, high: 108 });
    expect(keyboardRange([10])).toBeNull();
    expect(keyboardRange([])).toBeNull();
  });
});
