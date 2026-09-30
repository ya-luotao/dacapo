import { ledgerLineCount, LETTERS, STAFF_TOP_LINE, type Clef } from '../../core/note.ts';
import type { SpelledPitch } from '../../core/score.ts';

// Where a line of notes goes on the staff and how much room it needs above and below: plain
// arithmetic on staff positions, so it is tested without drawing. Positions count lines and
// spaces from the bottom line (0) to the top line (8), as `staffPosition` does.

/** One staff with its clef, or the braced grand staff. */
export type MelodySystem = Clef | 'grand';

const letterSteps = (p: SpelledPitch) => p.octave * 7 + LETTERS.indexOf(p.step);
const BOTTOM_LINE: Record<Clef, number> = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 };
const MIDDLE_C = 4 * 7;

/** The staff position of a written note: E4 is the treble staff's bottom line, G2 the bass's. */
export const positionOn = (pitch: SpelledPitch, clef: Clef) =>
  letterSteps(pitch) - BOTTOM_LINE[clef];

/** Middle C and above on the treble staff of a grand staff, the rest on the bass staff. */
export const grandClefOf = (pitch: SpelledPitch): Clef =>
  letterSteps(pitch) >= MIDDLE_C ? 'treble' : 'bass';

/** At most two ledger lines above or below a staff. */
const MOST_LEDGERS = 2;

/**
 * The staff for a melody and, drawn over it, the key played wrong: the one clef that writes the
 * melody with at most two ledger lines (of two that do, the one needing fewer, treble on a tie),
 * or else the grand staff. A wrong key that needs more ledger lines there, on the side where the
 * other staff would take it (below the treble staff, above the bass staff), calls for the grand
 * staff; one far out on the other side stays with its ledger lines, since the grand staff would
 * not help it.
 */
export function melodySystem(
  melody: readonly SpelledPitch[],
  wrong: SpelledPitch | null = null,
): MelodySystem {
  const ledgers = (p: SpelledPitch, clef: Clef) => ledgerLineCount(positionOn(p, clef));
  const fits = (clef: Clef) => melody.every((p) => ledgers(p, clef) <= MOST_LEDGERS);
  const total = (clef: Clef) => melody.reduce((sum, p) => sum + ledgers(p, clef), 0);
  let system: MelodySystem;
  if (fits('treble') && fits('bass')) system = total('bass') < total('treble') ? 'bass' : 'treble';
  else if (fits('treble')) system = 'treble';
  else system = fits('bass') ? 'bass' : 'grand';
  if (!wrong || system === 'grand' || ledgers(wrong, system) <= MOST_LEDGERS) return system;
  const position = positionOn(wrong, system);
  const otherSide = system === 'treble' ? position < 0 : position > STAFF_TOP_LINE;
  return otherSide ? 'grand' : system;
}

/** The stave of each pitch in `system`. */
export function clefIn(system: MelodySystem, pitch: SpelledPitch): Clef {
  return system === 'grand' ? grandClefOf(pitch) : system;
}

/** A stem is three and a half spaces: seven positions. */
const STEM = 7;
/** A notehead reaches half a space past its position; an accidental about one and a half. */
const HEAD = 1;
const SIGN = 3;

/**
 * The positions a quarter note (or a chord of them) reaches, stem included: the stem goes up
 * when the heads lie on average below the middle line, as VexFlow's automatic stems do.
 */
export function noteReach(
  positions: readonly number[],
  accidental: boolean,
): { top: number; bottom: number } {
  const high = Math.max(...positions);
  const low = Math.min(...positions);
  const up = (high + low) / 2 < STAFF_TOP_LINE / 2;
  return {
    top: Math.max(up ? high + STEM : high + HEAD, accidental ? high + SIGN : -Infinity),
    bottom: up ? low - HEAD : low - STEM,
  };
}

/**
 * How far past its top and bottom lines a staff's notes reach, in positions (0 when they stay
 * within it). `notes` are the columns on this staff, each the positions of its heads.
 */
export function staffReach(
  notes: readonly { positions: readonly number[]; accidental: boolean }[],
): { above: number; below: number } {
  let above = 0;
  let below = 0;
  for (const note of notes) {
    if (note.positions.length === 0) continue;
    const { top, bottom } = noteReach(note.positions, note.accidental);
    above = Math.max(above, top - STAFF_TOP_LINE);
    below = Math.max(below, -bottom);
  }
  return { above, below };
}
