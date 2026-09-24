import {
  isBlack,
  LETTERS,
  ledgerLineCount,
  parsePitch,
  pitchId,
  pitchToMidi,
  staffPosition,
  type Accidental,
  type Clef,
  type Pitch,
} from './note.ts';

/** A written note: the same pitch on the treble and on the bass staff are different notes to read. */
export interface StaffNote {
  /** Stable id for stats and storage, e.g. `C4@treble`, `Db4@bass`. */
  key: string;
  pitch: Pitch;
  clef: Clef;
  midi: number;
}

export function noteKey(pitch: Pitch, clef: Clef): string {
  return `${pitchId(pitch)}@${clef}`;
}

/** Reverses `noteKey`; null for anything else. */
export function parseNoteKey(key: string): StaffNote | null {
  const [text, clef, ...rest] = key.split('@');
  const pitch = parsePitch(text ?? '');
  if (!pitch || rest.length > 0 || (clef !== 'treble' && clef !== 'bass')) return null;
  return staffNote(pitch, clef);
}

export function staffNote(pitch: Pitch, clef: Clef): StaffNote {
  return { key: noteKey(pitch, clef), pitch, clef, midi: pitchToMidi(pitch) };
}

export const LEVEL_IDS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export interface Level {
  id: LevelId;
  /** Lowest and highest key of the level, as written in the spec. */
  low: Pitch;
  high: Pitch;
  /** Staves the notes are written on. */
  clefs: readonly Clef[];
  /** Candidate cards; never empty and without duplicate keys. */
  notes: readonly StaffNote[];
}

const natural = (letter: Pitch['letter'], octave: number): Pitch => ({
  letter,
  accidental: 0,
  octave,
});

/** Natural pitches from `low` to `high`, both inclusive. */
function naturals(low: Pitch, high: Pitch): Pitch[] {
  const result: Pitch[] = [];
  for (let octave = low.octave; octave <= high.octave; octave++) {
    for (const letter of LETTERS) {
      const midi = pitchToMidi(natural(letter, octave));
      if (midi >= pitchToMidi(low) && midi <= pitchToMidi(high)) {
        result.push(natural(letter, octave));
      }
    }
  }
  return result;
}

function oneStaff(clef: Clef, low: Pitch, high: Pitch): StaffNote[] {
  return naturals(low, high).map((pitch) => staffNote(pitch, clef));
}

/**
 * Every natural in `low`–`high`, on each staff where it needs at most `maxLedgerLines`.
 * Around middle C a note fits both staves, so it appears once per staff: bass notes first.
 */
function grandStaff(low: Pitch, high: Pitch, maxLedgerLines: number): StaffNote[] {
  const fits = (pitch: Pitch, clef: Clef) =>
    ledgerLineCount(staffPosition(pitch, clef)) <= maxLedgerLines;
  const all = naturals(low, high);
  return (['bass', 'treble'] as const).flatMap((clef) =>
    all.filter((pitch) => fits(pitch, clef)).map((pitch) => staffNote(pitch, clef)),
  );
}

/**
 * Black keys written with a sharp or flat next to the given naturals, on the same staff.
 * Only sharps and flats of black keys: E♯, B♯, C♭ and F♭ are left out on purpose.
 */
function withAccidentals(notes: readonly StaffNote[], low: Pitch, high: Pitch): StaffNote[] {
  const min = pitchToMidi(low);
  const max = pitchToMidi(high);
  return notes.flatMap(({ pitch, clef }) =>
    ([1, -1] as const satisfies readonly Accidental[]).flatMap((accidental) => {
      const altered: Pitch = { ...pitch, accidental };
      const midi = pitchToMidi(altered);
      if (!isBlack(midi) || midi < min || midi > max) return [];
      return [staffNote(altered, clef)];
    }),
  );
}

const C2 = natural('C', 2);
const G2 = natural('G', 2);
const C3 = natural('C', 3);
const F3 = natural('F', 3);
const C4 = natural('C', 4);
const G4 = natural('G', 4);
const C5 = natural('C', 5);
const G5 = natural('G', 5);
const C6 = natural('C', 6);

// L5 keeps to the staves plus one ledger line, so B3–D4 appear on both staves;
// L6 allows two ledger lines, like C2 and C6 themselves need.
const L5_NOTES = grandStaff(G2, G5, 1);

export const LEVELS: readonly Level[] = [
  { id: 'L1', low: C4, high: G4, clefs: ['treble'], notes: oneStaff('treble', C4, G4) },
  { id: 'L2', low: C4, high: C5, clefs: ['treble'], notes: oneStaff('treble', C4, C5) },
  { id: 'L3', low: F3, high: C4, clefs: ['bass'], notes: oneStaff('bass', F3, C4) },
  { id: 'L4', low: C3, high: C4, clefs: ['bass'], notes: oneStaff('bass', C3, C4) },
  { id: 'L5', low: G2, high: G5, clefs: ['bass', 'treble'], notes: L5_NOTES },
  { id: 'L6', low: C2, high: C6, clefs: ['bass', 'treble'], notes: grandStaff(C2, C6, 2) },
  {
    id: 'L7',
    low: G2,
    high: G5,
    clefs: ['bass', 'treble'],
    notes: withAccidentals(L5_NOTES, G2, G5),
  },
];

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && (LEVEL_IDS as readonly string[]).includes(value);
}

export function getLevel(id: LevelId): Level {
  return LEVELS.find((level) => level.id === id)!;
}

/** The level after `id`, or null for the last one. */
export function nextLevel(id: LevelId): LevelId | null {
  return LEVEL_IDS[LEVEL_IDS.indexOf(id) + 1] ?? null;
}
