import type { Clef } from '../../core/note.ts';

// Where things go on EngravedStaff's staves, in SVG units of 10 to a staff space.

export const SPACE = 10;
/** Font units (1000 per em, four spaces) to SVG units. */
export const GLYPH = (SPACE * 4) / 1000;
/** Noteheads: a whole note, and the half and black ones every other duration uses. */
export const WHOLE_WIDTH = 1.688 * SPACE;
export const HEAD_WIDTH = 1.18 * SPACE;
export const STEM_LENGTH = 3.5 * SPACE;
export const STEM_WIDTH = 1.2;
export const LEDGER_OVERHANG = 0.4 * SPACE;
/**
 * Where the bottom line of each staff lies: a single staff (room for ledger lines above and
 * below), a bare staff or a rhythm line (no notes outside it), or the two staves of a grand staff.
 */
const SINGLE_BOTTOM = 80;
const PLAIN_BOTTOM = 55;
const GRAND_BOTTOM: Record<Clef, number> = { treble: 80, bass: 160 };
export const LEFT = 24;

/**
 * `treble` and `bass`: one staff with its clef; `plain`: five lines and no clef; `grand`: both
 * clefs, braced; `rhythm`: a single line, for rhythms written without pitch.
 */
export type StaffSystem = 'treble' | 'bass' | 'plain' | 'grand' | 'rhythm';

export function staffBottom(system: StaffSystem, clef: Clef): number {
  if (system === 'grand') return GRAND_BOTTOM[clef];
  return system === 'plain' || system === 'rhythm' ? PLAIN_BOTTOM : SINGLE_BOTTOM;
}

/** The y of a staff position on `clef`'s staff. */
export function staffY(system: StaffSystem, clef: Clef, position: number): number {
  return staffBottom(system, clef) - (position * SPACE) / 2;
}

export function staffHeight(system: StaffSystem): number {
  if (system === 'grand') return 186;
  return system === 'plain' || system === 'rhythm' ? 70 : 120;
}

/** The staff positions of a key signature's sharps and flats, in order, on the treble staff. */
const KEY_POSITIONS = { sharp: [8, 5, 9, 6, 3, 7, 4], flat: [4, 7, 3, 6, 2, 5, 1] } as const;
export const KEY_STEP = 9;
const CLEF_ROOM = 44;
const TIME_ROOM = 26;

/** Where a key signature's accidentals go: sharps (fifths > 0) or flats (< 0), bass a line lower. */
export function keySignaturePositions(fifths: number, clef: Clef): number[] {
  const order = fifths > 0 ? KEY_POSITIONS.sharp : KEY_POSITIONS.flat;
  return order.slice(0, Math.abs(fifths)).map((p) => (clef === 'bass' ? p - 2 : p));
}

export function keySignatureX(system: StaffSystem): number {
  return LEFT + (system === 'plain' || system === 'rhythm' ? 8 : CLEF_ROOM);
}

export function timeSignatureX(system: StaffSystem, fifths = 0): number {
  return keySignatureX(system) + Math.abs(fifths) * KEY_STEP + (fifths === 0 ? 0 : 4);
}

/** Where the music may start after the clef, the key signature and the time signature. */
export function bodyStart(system: StaffSystem, fifths = 0, time = false): number {
  return timeSignatureX(system, fifths) + (time ? TIME_ROOM : 0) + 10;
}

/** Where an up-stem on a rhythm line ends, for a caller drawing a beam: the stem's top right. */
export function stemTop(system: StaffSystem, x: number): { x: number; y: number } {
  return { x: x + HEAD_WIDTH, y: staffY(system, 'treble', 4) - STEM_LENGTH };
}
