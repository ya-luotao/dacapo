// Sight-reading's levels F1-F8 (docs/READING.md, "Sight-reading (R3)"): their keys, meters,
// rhythm levels and textures, and what a stored fragment is made from (a level, a seed and the
// generator's version). Kept apart from the generator (sightFragment.ts), so the records and their
// validation do not bring it into the main bundle.

import type { Rng } from './random.ts';
import type { RhythmLevelId } from './rhythmCells.ts';
import type { Tonic } from './scaleTypes.ts';
import { TICKS_PER_QUARTER } from './score.ts';

/** The rules' version: a fragment is its level, seed and this. Bump it whenever output changes. */
export const SIGHT_GENERATOR_VERSION = 1;
/** The versions this build can generate again. */
export const SIGHT_GENERATOR_VERSIONS: readonly number[] = [1];

export type SightLevelId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8';
export type SightMeter = '4/4' | '3/4' | '2/4';
export type Mode = 'major' | 'minor';

export interface SightKey {
  /** As `scales.ts` spells a tonic: `C`, `Bb`, `F#`. */
  tonic: Tonic;
  mode: Mode;
}

/**
 * - `right`, `left`: that hand alone, the other resting.
 * - `turns`: one line passed between the hands, bar by bar.
 * - `held`: a melody over one held bass note a bar.
 * - `halves`: a bass note per half bar.
 * - `moving`: fifths and sixths, single notes or a walking line under the melody.
 * - `chords`: block, broken or Alberti chords in the left hand.
 */
export type Texture = 'right' | 'left' | 'turns' | 'held' | 'halves' | 'moving' | 'chords';

export interface SightLevel {
  id: SightLevelId;
  bars: 4 | 8;
  keys: readonly SightKey[];
  /** With how often each is drawn. */
  meters: readonly (readonly [SightMeter, number])[];
  /** The rhythm levels whose cells the rhythms are made of: R1 up to this one. */
  rhythm: RhythmLevelId;
  texture: Texture;
  /** The widest melodic interval, in scale steps (1: a second, 4: a fifth, 5: a sixth). */
  maxLeap: number;
  /** ii and vi besides I, IV and V (VI in minor). */
  secondary: boolean;
  /** The right hand's position may stretch to a sixth (a five-finger position until F4). */
  extended: boolean;
  /** The right hand may move to another position between the phrases. */
  shifts: boolean;
  /** Raised lower neighbours: accidentals besides a minor key's leading tone. */
  chromatic: boolean;
  /** Notes tied over the barline (R4). */
  ties: boolean;
}

const key = (name: string): SightKey => ({
  tonic: name[0]!.toUpperCase() + name.slice(1),
  mode: name[0] === name[0]!.toLowerCase() ? 'minor' : 'major',
});
const keys = (...names: string[]) => names.map(key);

const FEW_METERS = [
  ['4/4', 3],
  ['3/4', 2],
] as const;
const ALL_METERS = [
  ['4/4', 3],
  ['3/4', 2],
  ['2/4', 1],
] as const;
/** A held bass note fills its bar, and a dotted half is R3's: 4/4 and 2/4 only. */
const HELD_METERS = [
  ['4/4', 3],
  ['2/4', 1],
] as const;

const F5_KEYS = keys('C', 'G', 'F', 'D', 'Bb', 'a');
const F6_KEYS = [...F5_KEYS, ...keys('e', 'd')];
/** Up to three sharps or flats, major and minor. */
const F7_KEYS = keys('C', 'G', 'D', 'A', 'F', 'Bb', 'Eb', 'a', 'e', 'b', 'f#', 'd', 'g', 'c');
/** Up to four. */
const F8_KEYS = [...F7_KEYS, ...keys('E', 'Ab', 'c#', 'f')];

const LEVEL = {
  bars: 4,
  maxLeap: 1,
  secondary: false,
  extended: false,
  shifts: false,
  chromatic: false,
  ties: false,
} as const;

export const SIGHT_LEVELS: readonly SightLevel[] = [
  { ...LEVEL, id: 'F1', keys: keys('C'), meters: FEW_METERS, rhythm: 'R1', texture: 'right' },
  { ...LEVEL, id: 'F2', keys: keys('C'), meters: FEW_METERS, rhythm: 'R1', texture: 'left' },
  { ...LEVEL, id: 'F3', keys: keys('C', 'G'), meters: FEW_METERS, rhythm: 'R1', texture: 'turns' },
  {
    ...LEVEL,
    id: 'F4',
    keys: keys('C', 'G', 'F'),
    meters: HELD_METERS,
    rhythm: 'R2',
    texture: 'held',
  },
  {
    ...LEVEL,
    id: 'F5',
    bars: 8,
    keys: F5_KEYS,
    meters: ALL_METERS,
    rhythm: 'R3',
    texture: 'halves',
    maxLeap: 4,
    extended: true,
  },
  {
    ...LEVEL,
    id: 'F6',
    bars: 8,
    keys: F6_KEYS,
    meters: ALL_METERS,
    rhythm: 'R3',
    texture: 'moving',
    maxLeap: 5,
    secondary: true,
    extended: true,
  },
  {
    id: 'F7',
    bars: 8,
    keys: F7_KEYS,
    meters: ALL_METERS,
    rhythm: 'R4',
    texture: 'moving',
    maxLeap: 5,
    secondary: true,
    extended: true,
    shifts: true,
    chromatic: true,
    ties: true,
  },
  {
    id: 'F8',
    bars: 8,
    keys: F8_KEYS,
    meters: ALL_METERS,
    rhythm: 'R5',
    texture: 'chords',
    maxLeap: 5,
    secondary: true,
    extended: true,
    shifts: true,
    chromatic: true,
    ties: true,
  },
];

export const SIGHT_LEVEL_IDS: readonly SightLevelId[] = SIGHT_LEVELS.map((l) => l.id);

export const isSightLevelId = (v: unknown): v is SightLevelId =>
  (SIGHT_LEVEL_IDS as readonly unknown[]).includes(v);

export function getSightLevel(id: SightLevelId): SightLevel {
  return SIGHT_LEVELS.find((l) => l.id === id)!;
}

export function nextSightLevel(id: SightLevelId): SightLevelId | null {
  return SIGHT_LEVEL_IDS[SIGHT_LEVEL_IDS.indexOf(id) + 1] ?? null;
}

/** The rhythm cells a level's rhythms may use: those of R1 up to its rhythm level. */
export function levelCells(level: SightLevel): readonly string[] {
  const upTo = Number(level.rhythm.slice(1));
  return RHYTHM_ADDS.slice(0, upTo).flat();
}

/** R1-R5's cells, as `rhythmCells.ts` has them (R4 adds the tied cells). */
const RHYTHM_ADDS: readonly (readonly string[])[] = [
  ['q', 'qr', 'h', 'w'],
  ['ee', 'er-e'],
  ['hd', 'qd-e'],
  ['~q', '~h', '~ee', '~qd-e'],
  ['ssss', 'e-ss', 'ss-e', 'ed-s'],
];

/** Whether the level draws sixteenths: its tempo starts at 60 (docs/READING.md, "Timing, shared"). */
export const sightSixteenths = (level: SightLevel): boolean => Number(level.rhythm.slice(1)) >= 5;

export const beatsOf = (meter: SightMeter): number => Number(meter[0]);
export const barTicks = (meter: SightMeter): number => beatsOf(meter) * TICKS_PER_QUARTER;

/** Seeds are unsigned 32-bit integers. */
export const isSightSeed = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 0xffffffff;

/** A new seed from `rng`. */
export const drawSeed = (rng: Rng): number => Math.floor(rng() * 0x100000000) >>> 0;
