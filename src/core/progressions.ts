import {
  formatSymbol,
  noteAbove,
  rootPc,
  SYMBOL_TONES,
  symbolTones,
  type ChordSymbol,
  type SymbolQuality,
} from './chordSymbols.ts';
import type { Letter } from './note.ts';
import { keySignature, MAJOR_TONICS, MINOR_TONICS, tonicPitch } from './keys.ts';
import type { Hand, SpelledPitch } from './score.ts';
import type { Root } from './theoryItems.ts';
import { leadVoices, type LeadChord } from './voiceLeading.ts';

// Progressions on the Harmony page (docs/HARMONY.md, "Progressions (H2)" and "Clarifications
// (decided during H2)"): a progression of chords in a key, the left hand in a pattern and the
// right hand in close-position chords voiced to move as little as possible, written out as a
// score and practised as a piece. Everything here is a pure function of the progression, the key
// and the pattern, so the same choice always makes the same notes: the piece id names the three,
// and its step records are kept as a piece's are.

// --- Progressions ----------------------------------------------------------------------------

export type ProgressionMode = 'major' | 'minor';

/**
 * A chord of a progression: a degree of the key (letters and semitones above the tonic), its
 * quality, and its roman numeral with its figure (`ii` and `7`, `I` and `maj7`).
 */
export interface ProgressionChord {
  steps: number;
  semitones: number;
  quality: SymbolQuality;
  numeral: string;
  figure: '' | '7' | 'maj7';
}

const chord = (
  numeral: string,
  steps: number,
  semitones: number,
  quality: SymbolQuality,
  figure: ProgressionChord['figure'] = '',
): ProgressionChord => ({ steps, semitones, quality, numeral, figure });

const I = chord('I', 0, 0, 'maj');
const ii = chord('ii', 1, 2, 'min');
const IV = chord('IV', 3, 5, 'maj');
const V = chord('V', 4, 7, 'maj');
const vi = chord('vi', 5, 9, 'min');
const ii7 = chord('ii', 1, 2, 'min7', '7');
const V7 = chord('V', 4, 7, 'dom7', '7');
const Imaj7 = chord('I', 0, 0, 'maj7', 'maj7');
const I7 = chord('I', 0, 0, 'dom7', '7');
const IV7 = chord('IV', 3, 5, 'dom7', '7');
// Minor: the harmonic minor's major V, with its raised leading note.
const i = chord('i', 0, 0, 'min');
const iv = chord('iv', 3, 5, 'min');

export const PROGRESSION_IDS = [
  'I-IV-V-I',
  'I-vi-IV-V',
  'ii-V-I',
  'vi-ii-V-I',
  'i-iv-V-i',
  'blues',
] as const;
export type ProgressionId = (typeof PROGRESSION_IDS)[number];

export interface Progression {
  id: ProgressionId;
  mode: ProgressionMode;
  /** One chord to a bar. */
  bars: readonly ProgressionChord[];
}

export const PROGRESSIONS: Readonly<Record<ProgressionId, Progression>> = {
  'I-IV-V-I': { id: 'I-IV-V-I', mode: 'major', bars: [I, IV, V, I] },
  'I-vi-IV-V': { id: 'I-vi-IV-V', mode: 'major', bars: [I, vi, IV, V] },
  // The jazz ii–V–I is of seventh chords, its I held a second bar to round the phrase.
  'ii-V-I': { id: 'ii-V-I', mode: 'major', bars: [ii7, V7, Imaj7, Imaj7] },
  // The circle of fifths, as a pop or hymn turnaround plays it: triads.
  'vi-ii-V-I': { id: 'vi-ii-V-I', mode: 'major', bars: [vi, ii, V, I] },
  'i-iv-V-i': { id: 'i-iv-V-i', mode: 'minor', bars: [i, iv, V, i] },
  // The 12-bar blues of dominant sevenths, ending at home (no turnaround).
  blues: {
    id: 'blues',
    mode: 'major',
    bars: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, I7],
  },
};

export const isProgressionId = (v: unknown): v is ProgressionId =>
  (PROGRESSION_IDS as readonly unknown[]).includes(v);

/** The distinct numerals of a progression in order, as its name writes them: I–vi–IV–V. */
export function progressionNumerals(id: ProgressionId): ProgressionChord[] {
  const bars = PROGRESSIONS[id].bars;
  if (id === 'blues') return [I7, IV7, V7];
  // A chord held a second bar is named once.
  return bars.filter((c, n) => n === 0 || c !== bars[n - 1]);
}

// --- Keys ------------------------------------------------------------------------------------

/**
 * A key as the piece id writes it: the tonic as the Scales page names it, `m` after a minor one
 * (`C`, `F#`, `Bb`, `C#m`, `Ebm`).
 */
export type ProgressionKey = string;

/** The keys of a mode, round the circle of fifths (C G D … F; A E B … D). */
export function progressionKeys(mode: ProgressionMode): ProgressionKey[] {
  return mode === 'major' ? [...MAJOR_TONICS] : MINOR_TONICS.map((tonic) => `${tonic}m`);
}

export function keyTonic(key: ProgressionKey): { tonic: string; mode: ProgressionMode } {
  return key.endsWith('m')
    ? { tonic: key.slice(0, -1), mode: 'minor' }
    : { tonic: key, mode: 'major' };
}

const tonicRoot = (tonic: string): Root => {
  const { step, alter } = tonicPitch(tonic, 4);
  return { step, alter };
};

/** The key signature: sharps (+) or flats (−), and the mode. */
export function progressionSignature(key: ProgressionKey): {
  fifths: number;
  mode: 'major' | 'minor';
} {
  const { tonic, mode } = keyTonic(key);
  return keySignature(mode === 'major' ? 'major' : 'harmonicMinor', tonic);
}

// --- Patterns --------------------------------------------------------------------------------

/**
 * What the left hand plays under each chord: the chord on the 1 (its root lowest); root and
 * fifth together; a waltz (bass, chord, chord, in 3/4); Alberti (low, high, middle, high in
 * eighths); an arpeggio up (1–5–8–10); stride (bass on 1 and 3, chord on 2 and 4).
 */
export const PATTERN_IDS = [
  'block',
  'rootFifth',
  'waltz',
  'alberti',
  'arpeggio',
  'stride',
] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

export const isPatternId = (v: unknown): v is PatternId =>
  (PATTERN_IDS as readonly unknown[]).includes(v);

/** Beats to the bar, in quarters: the waltz in 3/4, every other pattern in 4/4. */
export const patternBeats = (pattern: PatternId): 3 | 4 => (pattern === 'waltz' ? 3 : 4);

// --- Ids -------------------------------------------------------------------------------------

export interface ProgressionSpec {
  progression: ProgressionId;
  key: ProgressionKey;
  pattern: PatternId;
}

const PREFIX = 'prog:';

/** `prog:I-IV-V-I:C:block`, `prog:i-iv-V-i:F#m:alberti`: the piece id of a progression. */
export const progressionPieceId = ({ progression, key, pattern }: ProgressionSpec) =>
  `${PREFIX}${progression}:${key}:${pattern}`;

export const isProgressionPieceId = (id: string) => id.startsWith(PREFIX);

/** The progression a piece id names, or null for anything that is not exactly such an id. */
export function parseProgressionPieceId(id: unknown): ProgressionSpec | null {
  if (typeof id !== 'string' || !id.startsWith(PREFIX)) return null;
  const parts = id.slice(PREFIX.length).split(':');
  if (parts.length !== 3) return null;
  const [progression, key, pattern] = parts as [string, string, string];
  if (!isProgressionId(progression) || !isPatternId(pattern)) return null;
  if (!progressionKeys(PROGRESSIONS[progression].mode).includes(key)) return null;
  return { progression, key, pattern };
}

// --- Chords in a key -------------------------------------------------------------------------

/** A chord of the progression in its key: its symbol, its tones as spelled, its numeral. */
export interface KeyChord {
  symbol: ChordSymbol;
  /** `B♭m`, `G7`, `Cmaj7`. */
  text: string;
  /** Root first, in stacking order (root, 3rd, 5th, 7th), as the key spells them. */
  tones: Root[];
  pcs: number[];
  numeral: string;
  figure: ProgressionChord['figure'];
}

/** The chord on a degree of the key, spelled from the key's tonic by letter (D♯ in G♯ minor). */
export function keyChord(key: ProgressionKey, c: ProgressionChord): KeyChord {
  const { tonic } = keyTonic(key);
  const root = noteAbove(tonicRoot(tonic), c.steps, c.semitones);
  const symbol: ChordSymbol = { root, quality: c.quality, bass: null };
  const tones = symbolTones(symbol);
  return {
    symbol,
    text: formatSymbol(symbol),
    tones,
    pcs: tones.map(rootPc),
    numeral: c.numeral,
    figure: c.figure,
  };
}

// --- The arrangement -------------------------------------------------------------------------

/** Eighths: the arrangement's unit of time. */
export const DIVISIONS = 2;

/** A note of the arrangement: in eighths from the start of its bar. */
export interface ArrangedNote {
  hand: Hand;
  midi: number;
  pitch: SpelledPitch;
  /** In eighths from the start of the bar. */
  onset: number;
  duration: number;
}

export interface ArrangedBar {
  chord: KeyChord;
  notes: ArrangedNote[];
}

export interface Arrangement {
  spec: ProgressionSpec;
  beats: 3 | 4;
  fifths: number;
  mode: 'major' | 'minor';
  bars: ArrangedBar[];
}

/** C4 to C6: the right hand's chords. */
export const RIGHT_LOW = 60;
export const RIGHT_HIGH = 84;
/** Where the middle of a right-hand chord is best placed: G4. */
const RIGHT_CENTER = 67;
/** C2: the bass of the low patterns (root and fifth, waltz, arpeggio, stride) from here … */
export const BASS_LOW = 36;
/** … and F2 for the chordal ones (the chord on the 1, Alberti), which sit an octave higher. */
export const CHORD_BASS_LOW = 41;
/** B3: the top of the waltz's and the stride's chords on the off-beats. */
export const OFFBEAT_HIGH = 59;
/** F♯3: where those chords are best placed. */
export const OFFBEAT_CENTER = 54;

const STEP_PC: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The key `midi` as the chord's tone of its pitch class spells it (B♯3 is 60). */
export function spellTone(midi: number, tones: readonly Root[]): SpelledPitch {
  const pc = ((midi % 12) + 12) % 12;
  const tone = tones.find((t) => rootPc(t) === pc);
  if (!tone) throw new RangeError(`${midi} is not a tone of the chord`);
  const octave = Math.round((midi - tone.alter - STEP_PC[tone.step]) / 12) - 1;
  return { step: tone.step, alter: tone.alter, octave };
}

/** The key of pitch class `pc` from `low` up (within the octave above it). */
const from = (pc: number, low: number) => low + ((((pc - low) % 12) + 12) % 12);

/** Semitones of the chord's 3rd, 5th and 7th above its root (null where it has none). */
function intervals(quality: SymbolQuality) {
  const find = (steps: number) =>
    SYMBOL_TONES[quality].find((t) => t.steps === steps)?.semitones ?? null;
  return { third: find(2)!, fifth: find(4)!, seventh: find(6) };
}

/** The left hand under one chord: its events, onset and duration in eighths from the bar's 1. */
export interface LeftBar {
  events: { onset: number; duration: number; keys: number[] }[];
}

/**
 * The left hand under one chord. The chord on the 1 is in root position (a seventh chord as root,
 * 3rd and 7th), from F2; root and fifth from C2; Alberti low–high–middle–high on the same three
 * keys; the arpeggio 1–5–8–10 (1–5–7–10 for a seventh chord) from C2; the waltz and stride their
 * bass from C2 and their chord on the off-beats (`offbeat`), voiced apart.
 */
function leftBar(
  pattern: PatternId,
  c: KeyChord,
  quality: SymbolQuality,
  offbeat: number[] | null,
): LeftBar {
  const root = rootPc(c.symbol.root);
  const { third, fifth, seventh } = intervals(quality);
  const top = seventh ?? fifth;
  switch (pattern) {
    case 'block': {
      const r = from(root, CHORD_BASS_LOW);
      return { events: [{ onset: 0, duration: 8, keys: [r, r + third, r + top] }] };
    }
    case 'rootFifth': {
      const r = from(root, BASS_LOW);
      return { events: [{ onset: 0, duration: 8, keys: [r, r + fifth] }] };
    }
    case 'alberti': {
      const r = from(root, CHORD_BASS_LOW);
      const [low, middle, high] = [r, r + third, r + top];
      const order = [low, high, middle, high, low, high, middle, high];
      return { events: order.map((key, n) => ({ onset: n, duration: 1, keys: [key] })) };
    }
    case 'arpeggio': {
      const r = from(root, BASS_LOW);
      const keys = [r, r + fifth, seventh === null ? r + 12 : r + seventh, r + 12 + third];
      return { events: keys.map((key, n) => ({ onset: n * 2, duration: 2, keys: [key] })) };
    }
    case 'waltz': {
      const r = from(root, BASS_LOW);
      return {
        events: [
          { onset: 0, duration: 2, keys: [r] },
          { onset: 2, duration: 2, keys: offbeat! },
          { onset: 4, duration: 2, keys: offbeat! },
        ],
      };
    }
    case 'stride': {
      const r = from(root, BASS_LOW);
      // The fifth a fourth below where that stays in the bass's octave, else a fifth above.
      const low = r + fifth - 12 >= BASS_LOW ? r + fifth - 12 : r + fifth;
      return {
        events: [
          { onset: 0, duration: 2, keys: [r] },
          { onset: 2, duration: 2, keys: offbeat! },
          { onset: 4, duration: 2, keys: [low] },
          { onset: 6, duration: 2, keys: offbeat! },
        ],
      };
    }
  }
}

/**
 * The chords on the off-beats of the waltz and the stride: a triad whole, a seventh chord without
 * its root (the bass has it), in close position within the tenor, each moving as little as it can
 * from the one before, as the right hand's do.
 */
function offbeatChords(
  chords: readonly KeyChord[],
  bars: readonly ProgressionChord[],
  cyclic: boolean,
): number[][] {
  const lead: LeadChord[] = chords.map((c, n) => {
    const pcs = SYMBOL_TONES[bars[n]!.quality].length === 4 ? c.pcs.slice(1) : c.pcs;
    const bass = from(rootPc(c.symbol.root), BASS_LOW);
    return { pcs, bass, floor: bass + 3 };
  });
  return leadVoices(lead, { low: BASS_LOW, high: OFFBEAT_HIGH, center: OFFBEAT_CENTER, cyclic });
}

/**
 * A progression that ends away from its tonic (I–vi–IV–V, on V) is heard going round, so the
 * move from its last chord to its first is voiced as any other; one that ends on its tonic comes
 * home, and its own chords are voiced best.
 */
const loopsOn = (progression: Progression) => progression.bars.at(-1)!.steps !== 0;

/**
 * The left hand of chords in a key, a bar to each, in `pattern` (the waltz's and the stride's
 * chords on the off-beats voiced round the loop when `cyclic`): the chords as the key spells them,
 * and each bar's events. Improvise's backings play it (docs/HARMONY.md, "Improvise (H6)").
 */
export function leftHand(
  bars: readonly ProgressionChord[],
  key: ProgressionKey,
  pattern: PatternId,
  cyclic: boolean,
): { chords: KeyChord[]; left: LeftBar[] } {
  const chords = bars.map((c) => keyChord(key, c));
  const offbeats =
    pattern === 'waltz' || pattern === 'stride' ? offbeatChords(chords, bars, cyclic) : null;
  const left = chords.map((c, n) => leftBar(pattern, c, bars[n]!.quality, offbeats?.[n] ?? null));
  return { chords, left };
}

/**
 * The progression written out: per bar, its chord and the notes of both hands. The left hand's
 * pattern first, then the right hand's close-position chords (a triad in three voices, a seventh
 * chord in four), voiced to move least (round the loop where the progression ends away from
 * home), each wholly above the left hand of its bar and within C4–C6.
 */
export function arrangeProgression(spec: ProgressionSpec): Arrangement {
  const progression = PROGRESSIONS[spec.progression];
  const beats = patternBeats(spec.pattern);
  const barLength = beats * DIVISIONS;
  const { chords, left } = leftHand(progression.bars, spec.key, spec.pattern, loopsOn(progression));
  const right = leadVoices(
    chords.map((c, n) => {
      const keys = left[n]!.events.flatMap((e) => e.keys);
      // The bass is the root on the 1 (the stride's fifth on the 3 may lie below it).
      const bass = Math.min(...left[n]!.events[0]!.keys);
      return { pcs: c.pcs, bass, floor: Math.max(...keys) + 1 };
    }),
    { low: RIGHT_LOW, high: RIGHT_HIGH, center: RIGHT_CENTER, cyclic: loopsOn(progression) },
  );
  const { fifths, mode } = progressionSignature(spec.key);
  const bars = chords.map((c, n): ArrangedBar => {
    const note = (hand: Hand, midi: number, onset: number, duration: number): ArrangedNote => ({
      hand,
      midi,
      pitch: spellTone(midi, c.tones),
      onset,
      duration,
    });
    return {
      chord: c,
      notes: [
        ...right[n]!.map((midi) => note('right', midi, 0, barLength)),
        ...left[n]!.events.flatMap((e) =>
          e.keys.map((midi) => note('left', midi, e.onset, e.duration)),
        ),
      ],
    };
  });
  return { spec, beats, fifths, mode, bars };
}
