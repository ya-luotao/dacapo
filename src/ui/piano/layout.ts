import { isBlack, PIANO_HIGHEST, PIANO_LOWEST, pitchClass } from '../../core/note.ts';

// Real key widths in millimetres. Only their ratio matters.
const WHITE_MM = 23.5;
const BLACK_MM = 13.7;

/** Black key width as a fraction of a white key. */
export const BLACK_WIDTH = BLACK_MM / WHITE_MM;
/** Black key length as a fraction of a white key. */
export const BLACK_LENGTH = 0.63;

// Black keys are spaced evenly within their group (C–E: 2 blacks over 3 whites, F–B: 3 over 4),
// so they sit off-centre relative to the gaps between white keys: C♯ and F♯ lean left,
// D♯ and A♯ lean right, G♯ is centred.
function groupCentres(whites: number, blacks: number): number[] {
  const gap = (whites * WHITE_MM - blacks * BLACK_MM) / whites;
  return Array.from({ length: blacks }, (_, i) => (i + 1) * gap + (i + 0.5) * BLACK_MM);
}

const [CS, DS] = groupCentres(3, 2) as [number, number];
const [FS, GS, AS] = groupCentres(4, 3) as [number, number, number];

/** Centre of each black key relative to the white-key gap it sits over, in white-key widths. */
export const BLACK_OFFSETS: Readonly<Record<number, number>> = {
  1: (CS - WHITE_MM) / WHITE_MM,
  3: (DS - 2 * WHITE_MM) / WHITE_MM,
  6: (FS - WHITE_MM) / WHITE_MM,
  8: (GS - 2 * WHITE_MM) / WHITE_MM,
  10: (AS - 3 * WHITE_MM) / WHITE_MM,
};

export interface KeyGeometry {
  midi: number;
  black: boolean;
  /** Left edge, in white-key widths from the left edge of the lowest white key. */
  left: number;
  /** Width, in white-key widths. */
  width: number;
}

export interface PianoLayout {
  keys: readonly KeyGeometry[];
  /** Total width in white-key widths (the number of white keys). */
  width: number;
}

/** Geometry of the keys from `low` to `high`; both must be white keys. */
export function pianoLayout(low = PIANO_LOWEST, high = PIANO_HIGHEST): PianoLayout {
  if (isBlack(low) || isBlack(high) || low > high) {
    throw new RangeError(`A keyboard must start and end on white keys: ${low}–${high}`);
  }
  const keys: KeyGeometry[] = [];
  let whites = 0;
  for (let midi = low; midi <= high; midi++) {
    if (isBlack(midi)) {
      const centre = whites + BLACK_OFFSETS[pitchClass(midi)]!;
      keys.push({ midi, black: true, left: centre - BLACK_WIDTH / 2, width: BLACK_WIDTH });
    } else {
      keys.push({ midi, black: false, left: whites, width: 1 });
      whites++;
    }
  }
  return { keys, width: whites };
}

/** Velocity 1–127 → fill opacity, so soft notes are lighter but never invisible. */
export function velocityOpacity(velocity: number): number {
  return 0.35 + 0.65 * Math.min(1, Math.max(0, velocity / 127));
}
