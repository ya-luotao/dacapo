import { LETTERS, pitchClass, type Letter } from './note.ts';
import type { Root } from './theoryItems.ts';

// Chord symbols on the Harmony page (docs/HARMONY.md, "Chords (H1)" and "Clarifications (decided
// during H1)"): the symbols a lead sheet prints over a tune, as the page writes them, how each is
// spelled, what it holds, its levels, and how the keys played for one are judged. Pure, so every
// rule is unit-tested.

export type HarmonyFamily = 'chordSymbol';
export const HARMONY_FAMILIES: readonly HarmonyFamily[] = ['chordSymbol'];
export const isHarmonyFamily = (v: unknown): v is HarmonyFamily => v === 'chordSymbol';

// --- Qualities -------------------------------------------------------------------------------

/**
 * What a symbol adds to its root. The ids of the Ear page's chords where they are the same chord
 * (`maj` … `hdim7`), then the others.
 */
export const SYMBOL_QUALITIES = [
  'maj',
  'min',
  'dim',
  'aug',
  'sus2',
  'sus4',
  'dom7',
  'maj7',
  'min7',
  'hdim7',
  'dim7',
  'maj6',
  'min6',
  'add9',
] as const;
export type SymbolQuality = (typeof SYMBOL_QUALITIES)[number];

/** A tone of a chord: semitones above the root, and letters above it (its name as a degree). */
interface Tone {
  semitones: number;
  steps: number;
}

const tones = (...pairs: [semitones: number, steps: number][]): readonly Tone[] =>
  pairs.map(([semitones, steps]) => ({ semitones, steps }));

/** The tones of each quality, root first, in the order they are named (the 9th last). */
export const SYMBOL_TONES: Readonly<Record<SymbolQuality, readonly Tone[]>> = {
  maj: tones([0, 0], [4, 2], [7, 4]),
  min: tones([0, 0], [3, 2], [7, 4]),
  dim: tones([0, 0], [3, 2], [6, 4]),
  aug: tones([0, 0], [4, 2], [8, 4]),
  sus2: tones([0, 0], [2, 1], [7, 4]),
  sus4: tones([0, 0], [5, 3], [7, 4]),
  dom7: tones([0, 0], [4, 2], [7, 4], [10, 6]),
  maj7: tones([0, 0], [4, 2], [7, 4], [11, 6]),
  min7: tones([0, 0], [3, 2], [7, 4], [10, 6]),
  hdim7: tones([0, 0], [3, 2], [6, 4], [10, 6]),
  dim7: tones([0, 0], [3, 2], [6, 4], [9, 6]),
  maj6: tones([0, 0], [4, 2], [7, 4], [9, 5]),
  min6: tones([0, 0], [3, 2], [7, 4], [9, 5]),
  add9: tones([0, 0], [4, 2], [7, 4], [14, 8]),
};

/**
 * The one way each quality is written everywhere in the app: `maj7`, not `Δ` or `M7`; `°` for
 * diminished, `+` for augmented, `m7♭5` for half-diminished. The Learn lesson on chords lists the
 * other spellings a learner will meet.
 */
export const SYMBOL_SUFFIX: Readonly<Record<SymbolQuality, string>> = {
  maj: '',
  min: 'm',
  dim: '°',
  aug: '+',
  sus2: 'sus2',
  sus4: 'sus4',
  dom7: '7',
  maj7: 'maj7',
  min7: 'm7',
  hdim7: 'm7♭5',
  dim7: '°7',
  maj6: '6',
  min6: 'm6',
  add9: 'add9',
};

/**
 * A quality without its root, as a heading names it where no root is asked (the Ear page's and
 * Read's chords on Progress): the symbol's own suffix, and `maj` for the major triad, whose symbol
 * is its root alone.
 */
export const rootlessSuffix = (quality: SymbolQuality) =>
  quality === 'maj' ? 'maj' : SYMBOL_SUFFIX[quality];

/** Qualities with a minor third: their root is spelled as a minor key's tonic on a tie. */
const hasMinorThird = (quality: SymbolQuality) =>
  SYMBOL_TONES[quality].some((t) => t.steps === 2 && t.semitones === 3);

// --- Symbols ---------------------------------------------------------------------------------

/** A chord symbol: a root, a quality, and a bass other than the root after a slash. */
export interface ChordSymbol {
  root: Root;
  quality: SymbolQuality;
  bass: Root | null;
}

const SIGN: Readonly<Record<number, string>> = { [-1]: '♭', 0: '', 1: '♯' };

/** A root or a bass as a symbol writes it: `B♭`, `F♯`, `C`. */
export const noteLetter = (root: Root) => `${root.step}${SIGN[root.alter] ?? ''}`;

/** `Dm7`, `B♭`, `F♯m`, `C/E`, `Am/G`, `Dm7♭5`, `C♯°7`. */
export function formatSymbol({ root, quality, bass }: ChordSymbol): string {
  const chord = `${noteLetter(root)}${SYMBOL_SUFFIX[quality]}`;
  return bass ? `${chord}/${noteLetter(bass)}` : chord;
}

// The longest first, so `m7♭5` is not read as `m7` and the rest.
const SUFFIXES = [...SYMBOL_QUALITIES].sort(
  (a, b) => SYMBOL_SUFFIX[b].length - SYMBOL_SUFFIX[a].length,
);

function readNote(text: string): { root: Root; rest: string } | null {
  const step = text[0];
  if (!step || !(LETTERS as readonly string[]).includes(step)) return null;
  const sign = text[1];
  const alter = sign === '♭' ? -1 : sign === '♯' ? 1 : 0;
  return { root: { step: step as Letter, alter }, rest: text.slice(alter === 0 ? 1 : 2) };
}

/**
 * Reads a symbol written in the app's one style, and nothing else: `Bb`, `A#`, `CM7`, `Cdim`, `C/C`
 * or a slash without a bass are null. Every symbol `formatSymbol` writes reads back as itself.
 */
export function parseSymbol(text: unknown): ChordSymbol | null {
  if (typeof text !== 'string' || text.length > 20) return null;
  const [chordText, bassText, ...more] = text.split('/');
  if (more.length > 0 || chordText === undefined) return null;
  const head = readNote(chordText);
  if (!head) return null;
  const quality = SUFFIXES.find((q) => SYMBOL_SUFFIX[q] === head.rest);
  if (quality === undefined) return null;
  let bass: Root | null = null;
  if (bassText !== undefined) {
    const read = readNote(bassText);
    if (!read || read.rest !== '') return null;
    bass = read.root;
  }
  const symbol: ChordSymbol = { root: head.root, quality, bass };
  if (bass && pitchClass(rootPc(bass)) === pitchClass(rootPc(head.root))) return null;
  return formatSymbol(symbol) === text ? symbol : null;
}

const STEP_PC: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A note name's pitch class (0 = C). */
export const rootPc = (root: Root) => (((STEP_PC[root.step] + root.alter) % 12) + 12) % 12;

/** The pitch classes a symbol holds: its chord's, and a bass that is none of them. */
export function symbolPitchClasses(symbol: ChordSymbol): Set<number> {
  const root = rootPc(symbol.root);
  const pcs = new Set(SYMBOL_TONES[symbol.quality].map((t) => (root + t.semitones) % 12));
  if (symbol.bass) pcs.add(rootPc(symbol.bass));
  return pcs;
}

/** A note named `steps` letters and `semitones` above `root`, with whatever sign that takes. */
export function noteAbove(root: Root, steps: number, semitones: number): Root {
  const step = LETTERS[(LETTERS.indexOf(root.step) + steps) % 7]!;
  const natural = STEP_PC[step];
  let alter = (rootPc(root) + semitones - natural) % 12;
  if (alter > 6) alter -= 12;
  if (alter < -6) alter += 12;
  return { step, alter };
}

/**
 * The chord's tones as named, root first (C E♭ G♭ B𝄫 for C°7: a tone may take a double sign),
 * then a bass that is not one of them; a bass that is, is the tone it names.
 */
export function symbolTones(symbol: ChordSymbol): Root[] {
  const chord = SYMBOL_TONES[symbol.quality].map((t) =>
    noteAbove(symbol.root, t.steps, t.semitones),
  );
  const { bass } = symbol;
  if (!bass || chord.some((t) => rootPc(t) === rootPc(bass))) return chord;
  return [...chord, bass];
}

/** The tone the bass is (the chord's own spelling of it), or null for a symbol without one. */
export function bassTone(symbol: ChordSymbol): Root | null {
  const { bass } = symbol;
  if (!bass) return null;
  return symbolTones(symbol).find((t) => rootPc(t) === rootPc(bass)) ?? bass;
}

// --- MusicXML --------------------------------------------------------------------------------

/**
 * MusicXML's `<kind>` of each quality, and the text a lead sheet prints for it in the app's one
 * style (the `text` attribute, so Verovio draws `maj7`, `°` and `m7♭5` as written). `add9` is a
 * major triad with an added 9th (`<degree>`).
 */
export const MUSICXML_KIND: Readonly<Record<SymbolQuality, string>> = {
  maj: 'major',
  min: 'minor',
  dim: 'diminished',
  aug: 'augmented',
  sus2: 'suspended-second',
  sus4: 'suspended-fourth',
  dom7: 'dominant',
  maj7: 'major-seventh',
  min7: 'minor-seventh',
  hdim7: 'half-diminished',
  dim7: 'diminished-seventh',
  maj6: 'major-sixth',
  min6: 'minor-sixth',
  add9: 'major',
};

/** A `<degree>` of a `<harmony>`: a tone added to, altered in or taken from its kind. */
export interface MusicXmlDegree {
  value: number;
  alter: number;
  type: 'add' | 'alter' | 'subtract';
}

/**
 * The symbol a `<harmony>` stands for, from its root, `<kind>` value, bass and degrees: null for a
 * kind the app has no symbol for (`dominant-ninth`, `power`, `none`, `other` …), any degree but a
 * 9th added to a major triad, a root or a bass outside `SYMBOL_ROOTS` (E♯, C♭, a double sign), and
 * a bass that is the root.
 */
export function symbolFromMusicXml(
  root: Root,
  kind: string,
  bass: Root | null,
  degrees: readonly MusicXmlDegree[] = [],
): ChordSymbol | null {
  let quality = SYMBOL_QUALITIES.find((q) => q !== 'add9' && MUSICXML_KIND[q] === kind);
  if (quality === undefined) return null;
  if (degrees.length > 0) {
    const [degree, ...more] = degrees;
    const addNine = degree!.type === 'add' && degree!.value === 9 && degree!.alter === 0;
    if (more.length > 0 || quality !== 'maj' || !addNine) return null;
    quality = 'add9';
  }
  if (!isSymbolRoot(root) || (bass && !isSymbolRoot(bass))) return null;
  if (bass && rootPc(bass) === rootPc(root)) return null;
  return { root, quality, bass };
}

// --- Spelling --------------------------------------------------------------------------------

/**
 * The roots a symbol is written on: the naturals and the sharps and flats of the black keys. E♯,
 * F♭, B♯ and C♭ are never a symbol's root or bass.
 */
export const SYMBOL_ROOTS: readonly Root[] = LETTERS.flatMap((step) =>
  [-1, 0, 1]
    .map((alter) => ({ step, alter }))
    .filter(({ step: s, alter }) => {
      if (alter === 0) return true;
      const pc = rootPc({ step: s, alter });
      return [1, 3, 6, 8, 10].includes(pc);
    }),
);

export const isSymbolRoot = (root: Root) =>
  SYMBOL_ROOTS.some((r) => r.step === root.step && r.alter === root.alter);

const FIFTHS_OF: Readonly<Record<Letter, number>> = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };

/** Sharps or flats in the signature of the key with this tonic, major or minor. */
function signatureSize(root: Root, minor: boolean): number {
  return Math.abs(FIFTHS_OF[root.step] + 7 * root.alter - (minor ? 3 : 0));
}

const signs = (notes: readonly Root[]) => notes.reduce((sum, n) => sum + Math.abs(n.alter), 0);

/**
 * The root a chord of `quality` on pitch class `pc` is written on, as lead sheets write it: of the
 * spellings in `SYMBOL_ROOTS`, the one whose tones need the fewest sharps and flats (a double one
 * counting two), so B♭ not A♯, F♯m not G♭m, D♯° not E♭° (E♭ G♭ B𝄫); on a tie, the one whose key
 * (major, or minor for a chord with a minor third) has the smaller signature, so G♯m6 not A♭m6;
 * still tied, the flat: G♭ (not F♯) major, E♭m (not D♯m).
 */
export function spellRoot(pc: number, quality: SymbolQuality): Root {
  const minor = hasMinorThird(quality);
  const candidates = SYMBOL_ROOTS.filter((r) => rootPc(r) === ((pc % 12) + 12) % 12);
  const cost = (root: Root) => signs(symbolTones({ root, quality, bass: null }));
  return [...candidates].sort(
    (a, b) =>
      cost(a) - cost(b) || signatureSize(a, minor) - signatureSize(b, minor) || a.alter - b.alter,
  )[0]!;
}

/** The symbol of `quality` on pitch class `pc`, spelled by `spellRoot`. */
export const symbolOn = (pc: number, quality: SymbolQuality): ChordSymbol => ({
  root: spellRoot(pc, quality),
  quality,
  bass: null,
});

// --- Judging ---------------------------------------------------------------------------------

/**
 * Keys held for a symbol (pressed since it was painted and not let go): wrong as soon as one is
 * outside its pitch classes; right once they are exactly its pitch classes, in any octave, any
 * voicing and any inversion, with a slash chord's bass the lowest key. All of them held over
 * another bass is still `pending`: the bass may come after the chord, as it does when a left hand
 * is a moment late.
 */
export function judgeSymbolKeys(
  symbol: ChordSymbol,
  held: readonly number[],
): 'right' | 'wrong' | 'pending' {
  const pcs = symbolPitchClasses(symbol);
  const played = new Set(held.map(pitchClass));
  for (const pc of played) if (!pcs.has(pc)) return 'wrong';
  if (played.size < pcs.size) return 'pending';
  return bassMissing(symbol, held) ? 'pending' : 'right';
}

/** Every pitch class of a slash chord is held, but not over its bass. */
export function bassMissing(symbol: ChordSymbol, held: readonly number[]): boolean {
  if (!symbol.bass || held.length === 0) return false;
  const pcs = symbolPitchClasses(symbol);
  const played = new Set(held.map(pitchClass));
  if ([...pcs].some((pc) => !played.has(pc))) return false;
  return pitchClass(Math.min(...held)) !== rootPc(symbol.bass);
}

/** A tone's key at or above `from`. */
const keyFrom = (pc: number, from: number) => from + ((((pc - from) % 12) + 12) % 12);

/**
 * Keys to show a symbol on the Harmony page's keyboard (C3–B5): the chord in close position from
 * its root at or above middle C (an add9 a step lower if its 9th would pass B5), and a slash
 * chord's bass in the octave below.
 */
export function symbolVoicing(symbol: ChordSymbol): number[] {
  let root = keyFrom(rootPc(symbol.root), 60);
  const chord = SYMBOL_TONES[symbol.quality].map((t) => t.semitones);
  if (root + Math.max(...chord) > 83) root -= 12;
  const keys = chord.map((s) => root + s);
  const bass = symbol.bass ? [keyFrom(rootPc(symbol.bass), 48)] : [];
  return [...bass, ...keys].sort((a, b) => a - b);
}

// --- Items -----------------------------------------------------------------------------------

/** `sym:Dm7`, `sym:C/E`: an item is its symbol as written. */
export const symbolItem = (symbol: string) => `sym:${symbol}`;

/** The symbol of an item, or null for anything that is not one written in the app's style. */
export function parseSymbolItem(key: unknown): ChordSymbol | null {
  if (typeof key !== 'string' || !key.startsWith('sym:')) return null;
  return parseSymbol(key.slice(4));
}

/** `sym:B♭` → `B♭`. */
export const itemSymbol = (key: string) => key.slice(4);

// --- Levels ----------------------------------------------------------------------------------

export const HARMONY_LEVEL_IDS = ['H1', 'H2', 'H3', 'H4', 'H5'] as const;
export type HarmonyLevelId = (typeof HARMONY_LEVEL_IDS)[number];

export const isHarmonyLevelId = (v: unknown): v is HarmonyLevelId =>
  (HARMONY_LEVEL_IDS as readonly unknown[]).includes(v);

export interface HarmonyLevel {
  id: HarmonyLevelId;
  family: 'chordSymbol';
  /** The level's symbols as written, in the order of the level's description. */
  symbols: readonly string[];
}

/** The twelve pitch classes, from C. */
const PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** I ii iii IV V vi of a major key: the degree's letters and semitones above the tonic. */
const DIATONIC: readonly [steps: number, semitones: number, quality: SymbolQuality][] = [
  [0, 0, 'maj'],
  [1, 2, 'min'],
  [2, 4, 'min'],
  [3, 5, 'maj'],
  [4, 7, 'maj'],
  [5, 9, 'min'],
];

function diatonicTriads(tonics: readonly Root[]): string[] {
  const symbols = tonics.flatMap((tonic) =>
    DIATONIC.map(([steps, semitones, quality]) =>
      formatSymbol({ root: noteAbove(tonic, steps, semitones), quality, bass: null }),
    ),
  );
  return [...new Set(symbols)];
}

const onEveryRoot = (...qualities: SymbolQuality[]) =>
  PCS.flatMap((pc) => qualities.map((q) => formatSymbol(symbolOn(pc, q))));

/**
 * A slash chord of H4: a major or minor triad over a bass named `steps` letters and `semitones`
 * above its root: its 3rd or 5th (an inversion), or a note of the bass line outside it.
 */
const SLASHES: readonly [quality: 'maj' | 'min', steps: number, semitones: number][] = [
  ['maj', 2, 4], // C/E
  ['maj', 4, 7], // C/G
  ['min', 2, 3], // Am/C
  ['min', 4, 7], // Am/E
  ['maj', 6, 11], // C/B: the bass stepping down from C
  ['min', 6, 10], // Am/G: from A down to G
  ['maj', 1, 2], // F/G: the chord a step below its bass
];

const slashChords = () =>
  PCS.flatMap((pc) =>
    SLASHES.map(([quality, steps, semitones]) => {
      const { root } = symbolOn(pc, quality);
      return formatSymbol({ root, quality, bass: noteAbove(root, steps, semitones) });
    }),
  );

const C: Root = { step: 'C', alter: 0 };
const G: Root = { step: 'G', alter: 0 };
const F: Root = { step: 'F', alter: 0 };

export const HARMONY_LEVELS: readonly HarmonyLevel[] = [
  { id: 'H1', family: 'chordSymbol', symbols: diatonicTriads([C, G, F]) },
  { id: 'H2', family: 'chordSymbol', symbols: onEveryRoot('maj', 'min') },
  { id: 'H3', family: 'chordSymbol', symbols: onEveryRoot('dom7', 'maj7', 'min7') },
  { id: 'H4', family: 'chordSymbol', symbols: slashChords() },
  {
    id: 'H5',
    family: 'chordSymbol',
    symbols: onEveryRoot('dim', 'aug', 'sus2', 'sus4', 'hdim7', 'dim7', 'maj6', 'min6', 'add9'),
  },
];

export function getHarmonyLevel(id: HarmonyLevelId): HarmonyLevel {
  return HARMONY_LEVELS.find((level) => level.id === id)!;
}

/** The level after `id`, or null for the last. */
export function nextHarmonyLevel(id: HarmonyLevelId): HarmonyLevelId | null {
  return HARMONY_LEVEL_IDS[HARMONY_LEVEL_IDS.indexOf(id) + 1] ?? null;
}

export const harmonyLevelItems = (level: HarmonyLevel): string[] => level.symbols.map(symbolItem);

export const harmonyItemInLevel = (item: string, level: HarmonyLevel) =>
  item.startsWith('sym:') && level.symbols.includes(itemSymbol(item));
