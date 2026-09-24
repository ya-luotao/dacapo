import type { StaffNote } from '../../../core/levels.ts';
import {
  isBlack,
  PIANO_HIGHEST,
  PIANO_LOWEST,
  pitchClass,
  STAFF_TOP_LINE,
  staffPosition,
  type Accidental,
  type Clef,
} from '../../../core/note.ts';

// Geometry of the heatmap's grand staff, in staff spaces (the distance between two staff lines).
// Notes stand in columns, ordered by pitch; a staff that runs out of width wraps into another
// system, like a line of text. Under each system, a strip of bars shows the error rate.

/** From the left edge to the staff lines: room for the brace. */
export const STAFF_LEFT = 1.5;
/** From the staff's left edge to the first column: room for the clefs. */
const CLEF_ROOM = 3.8;
const COLUMN = 3;
const ACCIDENTAL_ROOM = 1.2;
const RIGHT_PAD = 0.8;
/** Height of the error-rate bars at 100 %. */
export const STRIP_HEIGHT = 2.5;
const STRIP_GAP = 1.5;
/** Half the length of a ledger line. */
export const LEDGER_HALF = 1.05;

export interface StaffGeometry {
  /** Top line of each staff. */
  trebleTop: number;
  bassTop: number;
  /** Baseline of the error-rate bars. */
  stripBase: number;
  height: number;
}

export interface Column<T> {
  item: T;
  /** Left edge and width of the column, which is also its hit area. */
  left: number;
  width: number;
  /** Centre of the note head. */
  x: number;
  y: number;
  clef: Clef;
  accidental: Accidental;
  /** Heights of the ledger lines the note needs. */
  ledgers: number[];
}

export interface System<T> {
  columns: Column<T>[];
  /** Where the staff lines end. */
  width: number;
}

const halfSpaces = (position: number) => position / 2;

/**
 * Room above, between and below the staves for the notes that are there, with at least the
 * room the clefs need. Every system uses the same geometry, so the staves line up.
 */
export function staffGeometry(notes: readonly StaffNote[]): StaffGeometry {
  const positions = (clef: Clef) =>
    notes.filter((n) => n.clef === clef).map((n) => staffPosition(n.pitch, clef));
  const treble = positions('treble');
  const bass = positions('bass');
  const above = Math.max(2, halfSpaces(Math.max(STAFF_TOP_LINE, ...treble) - STAFF_TOP_LINE) + 1);
  const trebleBelow = halfSpaces(-Math.min(0, ...treble)) + 0.75;
  const bassAbove = halfSpaces(Math.max(STAFF_TOP_LINE, ...bass) - STAFF_TOP_LINE) + 0.75;
  const gap = Math.max(4, trebleBelow + bassAbove);
  const below = Math.max(1.5, halfSpaces(-Math.min(0, ...bass)) + 1);
  const trebleTop = above;
  const bassTop = trebleTop + 4 + gap;
  const stripBase = bassTop + 4 + below + STRIP_GAP + STRIP_HEIGHT;
  return { trebleTop, bassTop, stripBase, height: stripBase + 0.5 };
}

/** Vertical centre of a note on its staff. */
export function noteY(note: StaffNote, geometry: StaffGeometry): number {
  const top = note.clef === 'treble' ? geometry.trebleTop : geometry.bassTop;
  return top + halfSpaces(STAFF_TOP_LINE - staffPosition(note.pitch, note.clef));
}

/** Heights of the ledger lines of a note, nearest the staff first. */
export function ledgerLines(note: StaffNote, geometry: StaffGeometry): number[] {
  const position = staffPosition(note.pitch, note.clef);
  const top = note.clef === 'treble' ? geometry.trebleTop : geometry.bassTop;
  const lines: number[] = [];
  for (let p = STAFF_TOP_LINE + 2; p <= position; p += 2) lines.push(p);
  for (let p = -2; p >= position; p -= 2) lines.push(p);
  return lines.map((p) => top + halfSpaces(STAFF_TOP_LINE - p));
}

export function columnWidth(note: StaffNote): number {
  return COLUMN + (note.pitch.accidental === 0 ? 0 : ACCIDENTAL_ROOM);
}

/** Where the first column starts. */
export const FIRST_COLUMN = STAFF_LEFT + CLEF_ROOM;

/**
 * Splits `items` (in pitch order) into systems no wider than `width`; each system holds at
 * least one note, however narrow the space.
 */
export function layoutSystems<T extends { note: StaffNote }>(
  items: readonly T[],
  width: number,
  geometry: StaffGeometry,
): System<T>[] {
  const systems: System<T>[] = [];
  let current: Column<T>[] = [];
  let x = FIRST_COLUMN;
  const close = () => {
    systems.push({ columns: current, width: x + RIGHT_PAD });
    current = [];
    x = FIRST_COLUMN;
  };
  for (const item of items) {
    const w = columnWidth(item.note);
    if (current.length > 0 && x + w + RIGHT_PAD > width) close();
    const accidental = item.note.pitch.accidental;
    current.push({
      item,
      left: x,
      width: w,
      x: x + w - COLUMN / 2,
      y: noteY(item.note, geometry),
      clef: item.note.clef,
      accidental,
      ledgers: ledgerLines(item.note, geometry),
    });
    x += w;
  }
  if (current.length > 0) close();
  return systems;
}

/**
 * The keys to draw for the keyboard view: whole octaves (C to B) around the practised keys,
 * within the 88 keys. Null when there is nothing on the piano to show.
 */
export function keyboardRange(midis: readonly number[]): { low: number; high: number } | null {
  const onPiano = midis.filter((m) => m >= PIANO_LOWEST && m <= PIANO_HIGHEST);
  if (onPiano.length === 0) return null;
  const min = Math.min(...onPiano);
  const max = Math.max(...onPiano);
  const low = Math.max(PIANO_LOWEST, min - pitchClass(min));
  const high = Math.min(PIANO_HIGHEST, max - pitchClass(max) + 11);
  // Both ends are white keys: C, B, A0 or C8.
  if (isBlack(low) || isBlack(high)) throw new RangeError(`Bad keyboard range ${low}–${high}`);
  return { low, high };
}
