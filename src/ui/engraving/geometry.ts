import type { Clef } from '../../core/note.ts';

// Where things go on EngravedStaff's staves, in SVG units of 10 to a staff space.

export const SPACE = 10;
/** Font units (1000 per em, four spaces) to SVG units. */
export const GLYPH = (SPACE * 4) / 1000;
export const NOTE_WIDTH = 1.688 * SPACE;
export const LEDGER_OVERHANG = 0.4 * SPACE;
/**
 * Where the bottom line of each staff lies: a single staff (room for ledger lines above and
 * below), a bare staff (no notes outside it), or the two staves of a grand staff.
 */
const SINGLE_BOTTOM = 80;
const PLAIN_BOTTOM = 55;
const GRAND_BOTTOM: Record<Clef, number> = { treble: 80, bass: 160 };
export const LEFT = 24;

/** `treble` and `bass`: one staff with its clef; `plain`: five lines and no clef; `grand`: both. */
export type StaffSystem = 'treble' | 'bass' | 'plain' | 'grand';

export function staffBottom(system: StaffSystem, clef: Clef): number {
  if (system === 'grand') return GRAND_BOTTOM[clef];
  return system === 'plain' ? PLAIN_BOTTOM : SINGLE_BOTTOM;
}

/** The y of a staff position on `clef`'s staff. */
export function staffY(system: StaffSystem, clef: Clef, position: number): number {
  return staffBottom(system, clef) - (position * SPACE) / 2;
}

export function staffHeight(system: StaffSystem): number {
  if (system === 'grand') return 186;
  return system === 'plain' ? 70 : 120;
}
