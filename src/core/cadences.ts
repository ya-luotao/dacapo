import type { MelodyKey } from './earMelody.ts';
import {
  keyChord,
  keyTonic,
  progressionKeys,
  type KeyChord,
  type ProgressionChord,
  type ProgressionKey,
} from './progressions.ts';
import type { Rng } from './random.ts';
import { closeVoicings, leadVoices } from './voiceLeading.ts';

// Cadences by ear (docs/HARMONY.md, "Progressions (H2)" and "Clarifications (decided during
// H2)"; the Ear page's rules, docs/EAR.md): a short progression of block chords in a key set by
// its tonic chord, whose last two chords are the cadence to name: authentic, plagal, half or
// deceptive. Pure, so every rule is unit-tested over many seeds.

export const CADENCES = ['authentic', 'plagal', 'half', 'deceptive'] as const;
export type Cadence = (typeof CADENCES)[number];

export const isCadence = (v: unknown): v is Cadence => (CADENCES as readonly unknown[]).includes(v);

/**
 * A cadence by its two chords, as a button and a heading show it under or instead of its name
 * (the same in every language; the major key's numerals, `…` for the half cadence's any chord).
 */
export const CADENCE_NUMERALS: Readonly<Record<Cadence, string>> = {
  authentic: 'V–I',
  plagal: 'IV–I',
  half: '…–V',
  deceptive: 'V–vi',
};

/** `cad:deceptive`: an item is its cadence. */
export const cadenceItem = (cadence: Cadence) => `cad:${cadence}`;

// --- The chords ------------------------------------------------------------------------------

const chord = (numeral: string, steps: number, semitones: number, minor: boolean) =>
  ({
    numeral,
    steps,
    semitones,
    quality: minor ? 'min' : 'maj',
    figure: '',
  }) satisfies ProgressionChord;

/** The triads a prompt is made of, in a major key and in a minor one (V with its leading note). */
export const CADENCE_CHORDS = {
  major: {
    I: chord('I', 0, 0, false),
    ii: chord('ii', 1, 2, true),
    IV: chord('IV', 3, 5, false),
    V: chord('V', 4, 7, false),
    vi: chord('vi', 5, 9, true),
  },
  minor: {
    i: chord('i', 0, 0, true),
    iv: chord('iv', 3, 5, true),
    V: chord('V', 4, 7, false),
    VI: chord('VI', 5, 8, false),
  },
} as const;

type Mode = 'major' | 'minor';

/**
 * The progressions a cadence is heard in: the tonic chord, then one or two chords leading to the
 * last two, which are the cadence. The chord after the tonic is one of the same few whatever the
 * cadence (IV, ii or vi; iv or VI in minor), so nothing before the last two gives it away.
 */
export const CADENCE_PROGRESSIONS: Readonly<
  Record<Mode, Readonly<Record<Cadence, readonly (readonly string[])[]>>>
> = {
  major: {
    authentic: [
      ['I', 'IV', 'V', 'I'],
      ['I', 'ii', 'V', 'I'],
      ['I', 'vi', 'V', 'I'],
    ],
    plagal: [
      ['I', 'vi', 'IV', 'I'],
      ['I', 'ii', 'IV', 'I'],
    ],
    half: [
      ['I', 'vi', 'IV', 'V'],
      ['I', 'IV', 'I', 'V'],
      ['I', 'vi', 'ii', 'V'],
    ],
    deceptive: [
      ['I', 'IV', 'V', 'vi'],
      ['I', 'ii', 'V', 'vi'],
      ['I', 'vi', 'V', 'vi'],
    ],
  },
  minor: {
    authentic: [
      ['i', 'iv', 'V', 'i'],
      ['i', 'VI', 'V', 'i'],
    ],
    plagal: [['i', 'VI', 'iv', 'i']],
    half: [
      ['i', 'VI', 'iv', 'V'],
      ['i', 'iv', 'i', 'V'],
    ],
    deceptive: [
      ['i', 'iv', 'V', 'VI'],
      ['i', 'VI', 'V', 'VI'],
    ],
  },
};

const chordOf = (mode: Mode, id: string): ProgressionChord =>
  (CADENCE_CHORDS[mode] as Readonly<Record<string, ProgressionChord>>)[id]!;

// --- Levels ----------------------------------------------------------------------------------

export const CADENCE_LEVEL_IDS = ['CA1', 'CA2', 'CA3', 'CA4'] as const;
export type CadenceLevelId = (typeof CADENCE_LEVEL_IDS)[number];

export const isCadenceLevelId = (v: unknown): v is CadenceLevelId =>
  (CADENCE_LEVEL_IDS as readonly unknown[]).includes(v);

export interface CadenceRules {
  /** In the order of the answer buttons. */
  cadences: readonly Cadence[];
  /** Minor keys as well as major ones. */
  minor: boolean;
}

/**
 * CA1 the question and the answer: half and authentic · CA2 + plagal · CA3 + deceptive, all four,
 * in major keys · CA4 all four in major and minor keys.
 */
export const CADENCE_RULES: Readonly<Record<CadenceLevelId, CadenceRules>> = {
  CA1: { cadences: ['authentic', 'half'], minor: false },
  CA2: { cadences: ['authentic', 'plagal', 'half'], minor: false },
  CA3: { cadences: CADENCES, minor: false },
  CA4: { cadences: CADENCES, minor: true },
};

// --- Prompts ---------------------------------------------------------------------------------

/** A prompt as drawn: its key, its chords by numeral, and its keys, a chord at a time. */
export interface CadencePrompt {
  key: ProgressionKey;
  numerals: string[];
  /** Each chord low to high: the bass, then the three keys of the right hand. */
  chords: number[][];
}

/** F2 to E3: the bass, the root of each chord. */
const BASS_LOW = 41;
/** The chords over it: A3 to A5, best around G4. */
const UPPER_LOW = 57;
const UPPER_HIGH = 81;
const UPPER_CENTER = 67;

const pick = <T>(items: readonly T[], rng: Rng): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))]!;

const from = (pc: number, low: number) => low + ((((pc - low) % 12) + 12) % 12);

/**
 * The keys of a progression in a key: each chord's root in the bass from F2, the triad over it in
 * close position, the first voicing chosen (a different top note makes the prompts less alike)
 * and the others moving as little as they can.
 */
export function voiceCadence(
  key: ProgressionKey,
  numerals: readonly string[],
  firstInversion: number,
): number[][] {
  const { mode } = keyTonic(key);
  const chords = numerals.map((n) => keyChord(key, chordOf(mode, n)));
  const lead = chords.map((c) => {
    const bass = from(c.pcs[0]!, BASS_LOW);
    return { pcs: c.pcs, bass, floor: bass + 3 };
  });
  const firsts = closeVoicings(
    lead[0]!.pcs,
    Math.max(UPPER_LOW, lead[0]!.floor),
    UPPER_HIGH,
  ).filter((v) => Math.abs((v[0]! + v.at(-1)!) / 2 - UPPER_CENTER) <= 6);
  const first = firsts[firstInversion % firsts.length]!;
  const upper = leadVoices(lead, {
    low: UPPER_LOW,
    high: UPPER_HIGH,
    center: UPPER_CENTER,
    cyclic: false,
    first,
  });
  return lead.map((c, i) => [c.bass, ...upper[i]!]);
}

/** The chords of a progression in its key, spelled and named (`Bm`, `vi`). */
export function cadenceKeyChords(key: ProgressionKey, numerals: readonly string[]): KeyChord[] {
  const { mode } = keyTonic(key);
  return numerals.map((n) => keyChord(key, chordOf(mode, n)));
}

/** The keys a level's prompts are in: the twelve majors, and in CA4 the twelve minors too. */
export function cadenceKeys(level: CadenceLevelId): ProgressionKey[] {
  return CADENCE_RULES[level].minor
    ? [...progressionKeys('major'), ...progressionKeys('minor')]
    : progressionKeys('major');
}

/** Draws a prompt for `cadence` at `level`: a key, a progression that ends in it, a voicing. */
export function makeCadence(cadence: Cadence, level: CadenceLevelId, rng: Rng): CadencePrompt {
  const key = pick(cadenceKeys(level), rng);
  const { mode } = keyTonic(key);
  const numerals = [...pick(CADENCE_PROGRESSIONS[mode][cadence], rng)];
  const chords = voiceCadence(key, numerals, Math.floor(rng() * 3));
  return { key, numerals, chords };
}

/** The key as an answer keeps it (`EarAnswer.key`): a minor one with its harmonic minor's V. */
export function cadenceMelodyKey(key: ProgressionKey): MelodyKey {
  const { tonic, mode } = keyTonic(key);
  return { tonic, scale: mode === 'major' ? 'major' : 'harmonicMinor' };
}

/** The key an answer's `key` names, or null when it is not one of the level's. */
export function cadenceKeyOf(level: CadenceLevelId, key: unknown): ProgressionKey | null {
  if (typeof key !== 'object' || key === null || Array.isArray(key)) return null;
  const { tonic, scale } = key as Record<string, unknown>;
  if (Object.keys(key).length !== 2 || typeof tonic !== 'string') return null;
  const name = scale === 'major' ? tonic : scale === 'harmonicMinor' ? `${tonic}m` : null;
  return name !== null && cadenceKeys(level).includes(name) ? name : null;
}

/** The chords of a prompt stored flat: a chord is four keys. */
export const CADENCE_VOICES = 4;

/**
 * The numerals a prompt's keys make in `key`, or null when they are not a prompt of this app
 * (four chords of a bass and a close triad above it, each a chord of the key in root position).
 */
export function readCadence(key: ProgressionKey, notes: readonly number[]): string[] | null {
  if (notes.length !== CADENCE_VOICES * 4) return null;
  const { mode } = keyTonic(key);
  const numerals: string[] = [];
  for (let i = 0; i < notes.length; i += CADENCE_VOICES) {
    const [bass, ...upper] = notes.slice(i, i + CADENCE_VOICES) as [number, ...number[]];
    if (upper.some((m, k) => m <= (k === 0 ? bass : upper[k - 1]!))) return null;
    if (upper.at(-1)! - upper[0]! >= 12) return null;
    const pcs = new Set(upper.map((m) => m % 12));
    const id = Object.keys(CADENCE_CHORDS[mode]).find((n) => {
      const c = keyChord(key, chordOf(mode, n));
      return (
        c.pcs[0] === bass % 12 && pcs.size === c.pcs.length && c.pcs.every((pc) => pcs.has(pc))
      );
    });
    if (!id) return null;
    numerals.push(id);
  }
  return numerals;
}

/** Whether `notes` are a prompt of `cadence` in `key`: its keys read as one of its progressions. */
export function cadenceFits(
  cadence: Cadence,
  key: ProgressionKey,
  notes: readonly number[],
): boolean {
  const numerals = readCadence(key, notes);
  if (!numerals) return false;
  const { mode } = keyTonic(key);
  if (!notes.every((m) => m >= 36 && m <= 84)) return false;
  return CADENCE_PROGRESSIONS[mode][cadence].some((p) => p.join() === numerals.join());
}

/** The cadence the last two numerals make. */
export function cadenceOfNumerals(numerals: readonly string[]): Cadence {
  const [a, b] = numerals.slice(-2).map((n) => n.toUpperCase()) as [string, string];
  if (b === 'V') return 'half';
  if (a === 'IV') return 'plagal';
  return b === 'I' ? 'authentic' : 'deceptive';
}

// --- Timing ----------------------------------------------------------------------------------

/** A chord of the progression starts this long after the one before … */
export const CADENCE_STEP_MS = 1000;
/** … and sounds this long; the last one longer. */
export const CADENCE_CHORD_MS = 900;
export const CADENCE_LAST_MS = 1800;

/** When each key sounds: a chord a second, together (the answer opens at the last chord). */
export function cadenceTiming(notes: readonly number[]) {
  const count = notes.length / CADENCE_VOICES;
  return notes.map((midi, i) => {
    const n = Math.floor(i / CADENCE_VOICES);
    const on = n * CADENCE_STEP_MS;
    return { midi, on, off: on + (n === count - 1 ? CADENCE_LAST_MS : CADENCE_CHORD_MS) };
  });
}
