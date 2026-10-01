import {
  isChordSymbolAnswer,
  isEarAnswer,
  isRhythmAnswer,
  isTheoryAnswer,
  type Answer as StoredAnswer,
} from './answers.ts';
import {
  formatSymbol,
  HARMONY_FAMILIES,
  HARMONY_LEVEL_IDS,
  HARMONY_LEVELS,
  harmonyLevelItems,
  isHarmonyFamily,
  isHarmonyLevelId,
  parseSymbol,
  parseSymbolItem,
  rootPc,
  SYMBOL_QUALITIES,
  SYMBOL_ROOTS,
  SYMBOL_TONES,
  type ChordSymbol,
  type HarmonyFamily,
  type HarmonyLevelId,
  type SymbolQuality,
} from './chordSymbols.ts';
import {
  CHORD_QUALITIES,
  CHORD_TONES,
  EAR_FAMILIES,
  getEarLevel,
  INTERVAL_SEMITONES,
  intervalOfSemitones,
  INVERSIONS,
  isEarLevelId,
  isIntervalName,
  levelItems,
  levelsOf,
  parseItem,
  voicing,
  DIRECTIONS,
  type ChordQuality,
  type EarFamily,
  type EarLevelId,
  type Inversion,
} from './earItems.ts';
import { judgeEchoAnswer } from './earMelody.ts';
import { CADENCES, isCadence } from './cadences.ts';
import {
  EAR_TARGET_MS,
  earLevelProgress,
  earStats,
  isTimedAnswer,
  type AnswerMode,
  type EarAnswer,
} from './earSession.ts';
import { MIN_ATTEMPTS } from './heatmap.ts';
import {
  HARMONY_MASTERY_WINDOW,
  HARMONY_TARGET_MS,
  harmonyLevelProgress,
  harmonyStats,
  isTimedHarmony,
  type ChordSymbolAnswer,
} from './harmonySession.ts';
import { midiOf } from './musicxml.ts';
import { pitchClass } from './note.ts';
import { SIGNATURE_FIFTHS, signatureTonic, tonicPitch } from './scales.ts';
import { median } from './session.ts';
import {
  getTheoryLevel,
  isTheoryLevelId,
  parseChordName,
  parseIntervalName,
  parseSpelled,
  parseTheoryItem,
  QUALITIES,
  READ_CHORD_QUALITIES,
  READ_INVERSIONS,
  rootOf,
  signatureId,
  THEORY_FAMILIES,
  theoryLevelItems,
  theoryLevelsOf,
  type TheoryFamily,
  type TheoryLevelId,
} from './theoryItems.ts';
import {
  isTimedTheory,
  THEORY_MASTERY_WINDOW,
  theoryLevelProgress,
  theoryStats,
  theoryTargetMs,
  type TheoryAnswer,
} from './theorySession.ts';
import { noteWeight, RECENT_LENGTH, type NoteStats } from './weakness.ts';

// Progress per family of the answers store (docs/EAR.md, "Records and figures" and
// "Clarifications (decided during E4)"): each level's mastery, per-item figures, the weakest
// items, and the confusion table of what was asked against what was answered. Recomputed from
// the raw answers whenever they change; pure, so every rule is unit-tested. The chord symbols of
// the Harmony page are a family of their own (docs/HARMONY.md, "Clarifications (decided during
// H1)").

/**
 * The answers the families here are made of: ear, theory and chord-symbol answers, not rhythm
 * (R1's own).
 */
export type FamilyAnswer = Exclude<StoredAnswer, { family: 'rhythm' }>;
type Answer = FamilyAnswer;
export const isFamilyAnswer = (answer: StoredAnswer): answer is FamilyAnswer =>
  !isRhythmAnswer(answer);

export type AnswerFamily = EarFamily | TheoryFamily | HarmonyFamily;
/** Ear's four families, then Read's three, then Harmony's: the order of the Progress page. */
export const ANSWER_FAMILIES: readonly AnswerFamily[] = [
  ...EAR_FAMILIES,
  ...THEORY_FAMILIES,
  ...HARMONY_FAMILIES,
];
export type FamilyLevelId = EarLevelId | TheoryLevelId | HarmonyLevelId;

const isEarFamily = (family: AnswerFamily): family is EarFamily =>
  (EAR_FAMILIES as readonly string[]).includes(family);

/** The family's levels, in order. */
export function familyLevelIds(family: AnswerFamily): FamilyLevelId[] {
  if (isHarmonyFamily(family)) return [...HARMONY_LEVEL_IDS];
  return (isEarFamily(family) ? levelsOf(family) : theoryLevelsOf(family)).map((l) => l.id);
}

export function isFamilyLevel(family: AnswerFamily, level: unknown): level is FamilyLevelId {
  return (familyLevelIds(family) as readonly unknown[]).includes(level);
}

/** A family's answers, in the order given (the store's: the order they happened). */
export function familyAnswers(family: AnswerFamily, answers: readonly Answer[]): Answer[] {
  return answers.filter((a) => a.family === family);
}

/** What the figures and the confusion table are over: a level or all, and how answered. */
export interface AnswerFilter {
  level: FamilyLevelId | 'all';
  by: AnswerMode | 'all';
}

export const ALL_ANSWERS: AnswerFilter = { level: 'all', by: 'all' };

export function filterAnswers(answers: readonly Answer[], filter: AnswerFilter): Answer[] {
  return answers.filter(
    (a) =>
      (filter.level === 'all' || a.level === filter.level) &&
      (filter.by === 'all' || a.by === filter.by),
  );
}

// --- Levels ----------------------------------------------------------------------------------

/** A level's mastery, the same figures for Ear's levels, Read's and Harmony's. */
export interface FamilyLevel {
  level: FamilyLevelId;
  /** Every answer at the level, replayed or hinted or not. */
  total: number;
  /** Answers in the mastery window: those without a replay (Ear) or the hint (Read, Harmony). */
  counted: number;
  /** The window's size: 40 answers, or 20 melodies. */
  window: number;
  accuracy: number | null;
  medianMs: number | null;
  mastered: boolean;
}

/**
 * Every level of the family with its mastery, by the rules of its page (`earLevelProgress`,
 * `theoryLevelProgress`, `harmonyLevelProgress`). `answers` must be in the order they happened.
 */
export function familyLevels(family: AnswerFamily, answers: readonly Answer[]): FamilyLevel[] {
  const own = familyAnswers(family, answers);
  if (isHarmonyFamily(family)) {
    const harmony = own.filter(isChordSymbolAnswer);
    return HARMONY_LEVEL_IDS.map((id) => {
      const p = harmonyLevelProgress(harmony, id);
      const { total, accuracy, medianMs, mastered } = p;
      const window = HARMONY_MASTERY_WINDOW;
      return { level: p.level, total, counted: p.cards, window, accuracy, medianMs, mastered };
    });
  }
  if (isEarFamily(family)) {
    const ear = own.filter(isEarAnswer);
    return levelsOf(family).map((level) => {
      const p = earLevelProgress(ear, level.id);
      const { total, window, accuracy, medianMs, mastered } = p;
      return { level: p.level, total, counted: p.answers, window, accuracy, medianMs, mastered };
    });
  }
  const theory = own.filter(isTheoryAnswer);
  return theoryLevelsOf(family).map((level) => {
    const p = theoryLevelProgress(theory, level.id);
    const { total, accuracy, medianMs, mastered } = p;
    const window = THEORY_MASTERY_WINDOW;
    return { level: p.level, total, counted: p.cards, window, accuracy, medianMs, mastered };
  });
}

// --- Items -----------------------------------------------------------------------------------

/** The figures of an item are over its last 10 answers, as the note heatmap's "lately". */
export const ITEM_WINDOW = RECENT_LENGTH;
/** An item is ranked among the weakest once it has this many answers, as a note is. */
export const MIN_ITEM_ANSWERS = MIN_ATTEMPTS;

export interface ItemFigures {
  /** `int:M3:up`, `echo:EC3`, `ks:3f:minor`. */
  item: string;
  /** Every answer to the item. */
  answers: number;
  /** Of its last `ITEM_WINDOW` answers: how many, and how many right. */
  recentCount: number;
  recentCorrect: number;
  /** Median of the timed answers among the last `ITEM_WINDOW`; null without one. */
  medianMs: number | null;
  /**
   * Among the last `ITEM_WINDOW`: "Hear again" pressed (Ear), or answers with the hint (Read,
   * Harmony).
   */
  aids: number;
  /** The weakness model's weight, as the next item is drawn by: the higher, the weaker. */
  weight: number;
}

/** Every item the family can ask, in the order of its levels. */
function itemOrder(family: AnswerFamily): string[] {
  const items = isHarmonyFamily(family)
    ? HARMONY_LEVELS.flatMap(harmonyLevelItems)
    : isEarFamily(family)
      ? levelsOf(family).flatMap((level) => levelItems(level, DIRECTIONS))
      : theoryLevelsOf(family).flatMap(theoryLevelItems);
  return [...new Set(items)];
}

function statsOf(family: AnswerFamily, answers: readonly Answer[]): Record<string, NoteStats> {
  if (isHarmonyFamily(family)) return harmonyStats(answers.filter(isChordSymbolAnswer));
  return isEarFamily(family)
    ? earStats(answers.filter(isEarAnswer))
    : theoryStats(answers.filter(isTheoryAnswer));
}

const targetMsOf = (family: AnswerFamily) =>
  isHarmonyFamily(family)
    ? HARMONY_TARGET_MS
    : isEarFamily(family)
      ? EAR_TARGET_MS
      : theoryTargetMs(family);

const isTimed = (answer: Answer) =>
  isTheoryAnswer(answer)
    ? isTimedTheory(answer)
    : isChordSymbolAnswer(answer)
      ? isTimedHarmony(answer)
      : isTimedAnswer(answer);

const aidsOf = (answer: Answer) => (isEarAnswer(answer) ? answer.replays : Number(answer.hinted));

/**
 * The figures of every item answered, in the order of the levels. `answers` are the family's,
 * in the order they happened.
 */
export function itemFigures(family: AnswerFamily, answers: readonly Answer[]): ItemFigures[] {
  const own = familyAnswers(family, answers);
  const byItem = new Map<string, Answer[]>();
  for (const answer of own) {
    const list = byItem.get(answer.item);
    if (list) list.push(answer);
    else byItem.set(answer.item, [answer]);
  }
  const stats = statsOf(family, own);
  const target = targetMsOf(family);
  const order = itemOrder(family);
  const rank = (item: string) => {
    const i = order.indexOf(item);
    return i === -1 ? order.length : i;
  };
  return [...byItem.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0))
    .map(([item, list]) => {
      const recent = list.slice(-ITEM_WINDOW);
      return {
        item,
        answers: list.length,
        recentCount: recent.length,
        recentCorrect: recent.filter((a) => a.correct).length,
        medianMs: median(recent.filter(isTimed).map((a) => a.ms)),
        aids: recent.reduce((sum, a) => sum + aidsOf(a), 0),
        weight: noteWeight(stats[item], target),
      };
    });
}

/**
 * The `n` weakest items with at least `MIN_ITEM_ANSWERS` answers, by the model's weight; of
 * equal weight, the less accurate lately, then the slower, then the earlier in the levels.
 * `items` in the order of `itemFigures`.
 */
export function weakestItems(items: readonly ItemFigures[], n = 3): ItemFigures[] {
  const ratio = (i: ItemFigures) => (i.recentCount === 0 ? 1 : i.recentCorrect / i.recentCount);
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.answers >= MIN_ITEM_ANSWERS)
    .sort(
      (a, b) =>
        b.item.weight - a.item.weight ||
        ratio(a.item) - ratio(b.item) ||
        (b.item.medianMs ?? 0) - (a.item.medianMs ?? 0) ||
        a.index - b.index,
    )
    .slice(0, n)
    .map(({ item }) => item);
}

// --- What was answered -----------------------------------------------------------------------

/** An answer that is none of the family's: a key that makes no interval or chord, a wrong root. */
export const OTHER = 'other';

/**
 * One cell of the confusion table: what was asked, and what was answered, both as labels:
 * - `interval`: the interval's name, whatever the direction (`m6`);
 * - `chord`, `readChord`: the chord and its position (`min:1st`);
 * - `echo`: the melodic interval into a note, in signed semitones (`+5`, `-3`);
 * - `cadence`: the cadence (`half`), named;
 * - `readInterval`: the name as the level asks it (`A2`; RI1 the number alone, `3`);
 * - `keySignature`: the key (`3f:major`);
 * - `chordSymbol`: the symbol as written (`Dm7`), the keys held read as a symbol on its root.
 */
export interface Confusion {
  asked: string;
  answered: string;
}

const signed = (semitones: number) => (semitones > 0 ? `+${semitones}` : String(semitones));

/** A step of a melody as played: within the octave either way; the same key again is other. */
const echoLabel = (semitones: number) =>
  semitones === 0 || Math.abs(semitones) > 12 ? OTHER : signed(semitones);

const chordLabel = (quality: string, inversion: string) => `${quality}:${inversion}`;

const isChordLabel = (quality: unknown, inversion: unknown) =>
  (CHORD_QUALITIES as readonly unknown[]).includes(quality) &&
  (INVERSIONS as readonly unknown[]).includes(inversion);

interface ChordChoice {
  quality: ChordQuality;
  inversion: Inversion;
}

/**
 * The chord keys held make, read on the root that was asked: the choices containing every key
 * held (and, where the bass matters, with the lowest key as their bass); of several, the one
 * sharing most tones with the chord asked, then the first. The keys held when a chord is judged
 * wrong are part of it and the one wrong key, so a whole other chord is rarely held.
 */
function chordOfKeys(
  held: readonly number[],
  root: number,
  choices: readonly ChordChoice[],
  bassMatters: boolean,
  asked: ChordQuality,
): string {
  if (held.length === 0) return OTHER;
  const relative = (midi: number) => (((midi - root) % 12) + 12) % 12;
  const tones = new Set(held.map(relative));
  const bass = relative(Math.min(...held));
  const askedTones = CHORD_TONES[asked];
  let best: { label: string; shared: number } | null = null;
  for (const { quality, inversion } of choices) {
    const chord = CHORD_TONES[quality];
    if (![...tones].every((t) => chord.includes(t))) continue;
    if (bassMatters && voicing(quality, inversion)[0]! % 12 !== bass) continue;
    const shared = chord.filter((t) => askedTones.includes(t)).length;
    if (!best || shared > best.shared) best = { label: chordLabel(quality, inversion), shared };
  }
  return best?.label ?? OTHER;
}

/** The key whose tonic `midi` is, in `mode`: the fewest sharps or flats, then the asked side. */
export function keyOfTonic(midi: number, mode: 'major' | 'minor', side: number): number | null {
  const pc = pitchClass(midi);
  const fits = SIGNATURE_FIFTHS.filter(
    (f) => pitchClass(midiOf(tonicPitch(signatureTonic(f, mode), 4))) === pc,
  );
  const prefer = side < 0 ? -1 : 1;
  return (
    [...fits].sort(
      (a, b) =>
        Math.abs(a) - Math.abs(b) ||
        Number(Math.sign(b) === prefer) - Number(Math.sign(a) === prefer),
    )[0] ?? null
  );
}

export const keyLabel = (fifths: number, mode: 'major' | 'minor') =>
  `${signatureId(fifths)}:${mode}`;

/**
 * What one answer puts in the confusion table: its item as asked against what was answered,
 * or, for a melody, every step reached (those before the wrong note as right, the step into it
 * as played). An answer played wrong that maps to what was asked (a chord named on the wrong
 * root, a chord's keys in the wrong octave) counts as `OTHER`, so the diagonal is the right
 * answers. Nothing for an answer that cannot be read.
 */
export function confusionsOf(answer: Answer): Confusion[] {
  const pairs = isTheoryAnswer(answer)
    ? theoryConfusions(answer)
    : isChordSymbolAnswer(answer)
      ? symbolConfusions(answer)
      : earConfusions(answer);
  return pairs.map((pair) =>
    pair.wrong && pair.answered === pair.asked
      ? { asked: pair.asked, answered: OTHER }
      : { asked: pair.asked, answered: pair.answered },
  );
}

interface Pair extends Confusion {
  wrong: boolean;
}

const right = (asked: string): Pair => ({ asked, answered: asked, wrong: false });
const wrong = (asked: string, answered: string): Pair => ({ asked, answered, wrong: true });

function earConfusions(answer: EarAnswer): Pair[] {
  const item = parseItem(answer.item);
  if (!item || item.family !== answer.family || !isEarLevelId(answer.level)) return [];
  const { prompt } = answer;

  if (item.family === 'echo') {
    if (!Array.isArray(answer.answer)) return [];
    const played = answer.answer;
    const judged = judgeEchoAnswer(prompt, played);
    if (judged === null) return [];
    // Every step reached: all of them for a melody played right, those up to the wrong note
    // otherwise. A wrong first note has no step into it.
    const reached = judged ? prompt.length - 1 : played.length - 1;
    const pairs: Pair[] = [];
    for (let i = 1; i <= reached; i++) {
      const asked = signed(prompt[i]! - prompt[i - 1]!);
      pairs.push(
        judged || i < reached ? right(asked) : wrong(asked, echoLabel(played[i]! - prompt[i - 1]!)),
      );
    }
    return pairs;
  }

  if (item.family === 'interval') {
    const asked = item.name;
    if (answer.correct) return [right(asked)];
    if (typeof answer.answer === 'string') {
      return [wrong(asked, isIntervalName(answer.answer) ? answer.answer : OTHER)];
    }
    const played = answer.answer[0];
    const given = prompt[0];
    if (played === undefined || given === undefined) return [wrong(asked, OTHER)];
    const distance = item.direction === 'down' ? given - played : played - given;
    return [wrong(asked, (distance > 0 && intervalOfSemitones(distance)) || OTHER)];
  }

  if (item.family === 'cadence') {
    const asked = item.cadence;
    if (answer.correct) return [right(asked)];
    return [wrong(asked, isCadence(answer.answer) ? answer.answer : OTHER)];
  }

  const asked = chordLabel(item.quality, item.inversion);
  if (answer.correct) return [right(asked)];
  if (typeof answer.answer === 'string') {
    const [quality, inversion, ...rest] = answer.answer.split(':');
    const valid = rest.length === 0 && isChordLabel(quality, inversion);
    return [wrong(asked, valid ? answer.answer : OTHER)];
  }
  const level = getEarLevel(answer.level);
  if (level.family !== 'chord' || prompt.length === 0) return [wrong(asked, OTHER)];
  const root = prompt[0]! - voicing(item.quality, item.inversion)[0]!;
  return [
    wrong(asked, chordOfKeys(answer.answer, root, level.chords, level.bassMatters, item.quality)),
  ];
}

function theoryConfusions(answer: TheoryAnswer): Pair[] {
  const item = parseTheoryItem(answer.item);
  if (!item || item.family !== answer.family || !isTheoryLevelId(answer.level)) return [];
  const level = getTheoryLevel(answer.level);
  if (level.family !== item.family) return [];

  if (item.family === 'readInterval' && level.family === 'readInterval') {
    const { quality, number } = item.name;
    const asked = level.numberOnly ? String(number) : `${quality}${number}`;
    if (answer.correct) return [right(asked)];
    const name = answer.answer;
    const valid =
      typeof name === 'string' &&
      (level.numberOnly ? /^[2-8]$/.test(name) : parseIntervalName(name) !== null);
    return [wrong(asked, valid ? name : OTHER)];
  }

  if (item.family === 'keySignature') {
    const asked = keyLabel(item.fifths, item.mode);
    if (answer.correct) return [right(asked)];
    const played = Array.isArray(answer.answer) ? answer.answer[0] : undefined;
    const key = played === undefined ? null : keyOfTonic(played, item.mode, item.fifths);
    return [wrong(asked, key === null ? OTHER : keyLabel(key, item.mode))];
  }

  if (item.family === 'readChord' && level.family === 'readChord') {
    const asked = chordLabel(item.quality, item.inversion);
    if (answer.correct) return [right(asked)];
    if (typeof answer.answer === 'string') {
      const name = parseChordName(answer.answer);
      return [wrong(asked, name ? chordLabel(name.quality, name.inversion) : OTHER)];
    }
    const notes = Array.isArray(answer.prompt)
      ? answer.prompt.map(parseSpelled).filter((p) => p !== null)
      : [];
    const root = rootOf(answer.item, notes);
    if (!root) return [wrong(asked, OTHER)];
    const rootMidi = midiOf({ step: root.step, alter: root.alter, octave: 4 });
    // The chord's own notes in a wrong octave read as the chord asked, so they count as other
    // (where the position is named, as the position their lowest key gives).
    const played = chordOfKeys(
      answer.answer,
      rootMidi,
      level.chords,
      level.withPosition,
      item.quality,
    );
    return [wrong(asked, played)];
  }
  return [];
}

/** A note's spelling for a bass read from a key: the asked one where it is, else on its side. */
function bassSpelling(pc: number, asked: ChordSymbol): ChordSymbol['root'] {
  if (asked.bass && rootPc(asked.bass) === pc) return asked.bass;
  const options = SYMBOL_ROOTS.filter((r) => rootPc(r) === pc);
  return (
    options.find((r) => r.alter === 0) ??
    options.find((r) => r.alter === (asked.root.alter > 0 ? 1 : -1))!
  );
}

/**
 * The keys held for a symbol, read as a symbol on the root asked: the qualities containing every
 * key held (for a slash chord asked, every key but a lowest one that is not the root, which is
 * then read as the bass); of several, the one sharing most tones with the chord asked, then the
 * first of `SYMBOL_QUALITIES` (the simplest). `other` when none contains them.
 */
export function symbolOfKeys(held: readonly number[], asked: ChordSymbol): string {
  if (held.length === 0) return OTHER;
  const root = rootPc(asked.root);
  const relative = (midi: number) => (((midi - root) % 12) + 12) % 12;
  const lowest = relative(Math.min(...held));
  const withBass = asked.bass !== null && lowest !== 0;
  const tones = new Set(held.map(relative));
  if (withBass) tones.delete(lowest);
  const askedTones = new Set(SYMBOL_TONES[asked.quality].map((t) => t.semitones % 12));
  let best: { quality: SymbolQuality; shared: number } | null = null;
  for (const quality of SYMBOL_QUALITIES) {
    const chord = SYMBOL_TONES[quality].map((t) => t.semitones % 12);
    if (![...tones].every((t) => chord.includes(t))) continue;
    const shared = chord.filter((t) => askedTones.has(t)).length;
    if (!best || shared > best.shared) best = { quality, shared };
  }
  if (!best) return OTHER;
  const bass = withBass ? bassSpelling((root + lowest) % 12, asked) : null;
  return formatSymbol({ root: asked.root, quality: best.quality, bass });
}

function symbolConfusions(answer: ChordSymbolAnswer): Pair[] {
  const asked = parseSymbolItem(answer.item);
  if (!asked || !isHarmonyLevelId(answer.level)) return [];
  const label = formatSymbol(asked);
  if (answer.correct) return [right(label)];
  return [wrong(label, symbolOfKeys(answer.answer, asked))];
}

// --- The confusion table ---------------------------------------------------------------------

/** A row of the table with fewer answers than this is "not enough data" to colour. */
export const CONFUSION_MIN_ASKED = 5;

/**
 * Upper edges of the colour buckets of a cell, as its share of the row: under 5 %, 5–10 %,
 * 10–20 %, 20–30 %, 30–40 %, 40–50 %, 50 % or more. As many buckets as the note heatmap's.
 */
export const SHARE_EDGES: readonly number[] = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5];

export function shareBucket(share: number): number {
  const index = SHARE_EDGES.findIndex((edge) => share < edge);
  return index === -1 ? SHARE_EDGES.length : index;
}

export interface ConfusionMatrix {
  /** What was asked, in the family's order. */
  rows: string[];
  /** The rows and every other answer given, in the same order; `OTHER` last. */
  columns: string[];
  /** Counts by asked, then by answered. */
  counts: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Answers by what was asked. */
  totals: ReadonlyMap<string, number>;
}

export function cellCount(matrix: ConfusionMatrix, asked: string, answered: string): number {
  return matrix.counts.get(asked)?.get(answered) ?? 0;
}

const QUALITY_RANK = ['', ...QUALITIES];

/** Where a label sorts in the family's order: by size, by chord, round the circle of fifths. */
function labelRank(family: AnswerFamily, label: string): number {
  if (label === OTHER) return Number.POSITIVE_INFINITY;
  switch (family) {
    case 'interval':
      return isIntervalName(label) ? INTERVAL_SEMITONES[label] : Number.MAX_VALUE;
    case 'echo':
      return Number(label);
    case 'cadence':
      return isCadence(label) ? CADENCES.indexOf(label) : Number.MAX_VALUE;
    case 'readInterval': {
      const number = Number(label.slice(-1));
      return number * 10 + QUALITY_RANK.indexOf(label.slice(0, -1));
    }
    case 'keySignature': {
      const [signature, mode] = label.split(':');
      const fifths = signature === '0' ? 0 : Number(signature!.slice(0, -1));
      const sign = signature!.endsWith('f') ? -1 : 1;
      return (mode === 'minor' ? 100 : 0) + sign * fifths;
    }
    case 'chordSymbol': {
      // By root round the octave from C, then quality, then bass (none first).
      const symbol = parseSymbol(label);
      if (!symbol) return Number.MAX_VALUE;
      const bass = symbol.bass ? ((rootPc(symbol.bass) - rootPc(symbol.root) + 12) % 12) + 1 : 0;
      return rootPc(symbol.root) * 10_000 + SYMBOL_QUALITIES.indexOf(symbol.quality) * 100 + bass;
    }
    case 'chord':
    case 'readChord': {
      const [quality, inversion] = label.split(':');
      const qualities: readonly string[] =
        family === 'chord' ? CHORD_QUALITIES : READ_CHORD_QUALITIES;
      const inversions: readonly string[] = family === 'chord' ? INVERSIONS : READ_INVERSIONS;
      return qualities.indexOf(quality!) * 3 + inversions.indexOf(inversion!);
    }
  }
}

export function compareLabels(family: AnswerFamily, a: string, b: string): number {
  return labelRank(family, a) - labelRank(family, b) || (a < b ? -1 : a > b ? 1 : 0);
}

/** The confusion table of a family's answers (filtered as they are given). */
export function confusionMatrix(family: AnswerFamily, answers: readonly Answer[]): ConfusionMatrix {
  const counts = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  const seen = new Set<string>();
  for (const answer of familyAnswers(family, answers)) {
    for (const { asked, answered } of confusionsOf(answer)) {
      let row = counts.get(asked);
      if (!row) counts.set(asked, (row = new Map<string, number>()));
      row.set(answered, (row.get(answered) ?? 0) + 1);
      totals.set(asked, (totals.get(asked) ?? 0) + 1);
      seen.add(answered);
    }
  }
  const byOrder = (a: string, b: string) => compareLabels(family, a, b);
  const rows = [...counts.keys()].sort(byOrder);
  const columns = [...new Set([...rows, ...seen])].sort(byOrder);
  return { rows, columns, counts, totals };
}

export interface TopConfusion {
  asked: string;
  answered: string;
  count: number;
  /** Answers to what was asked. */
  total: number;
}

/** Every wrong cell, the most frequent first (then the larger share, then in table order). */
export function topConfusions(family: AnswerFamily, matrix: ConfusionMatrix): TopConfusion[] {
  const cells: TopConfusion[] = [];
  for (const asked of matrix.rows) {
    const total = matrix.totals.get(asked) ?? 0;
    for (const answered of matrix.columns) {
      const count = cellCount(matrix, asked, answered);
      if (answered !== asked && count > 0) cells.push({ asked, answered, count, total });
    }
  }
  return cells.sort(
    (a, b) =>
      b.count - a.count ||
      b.count / b.total - a.count / a.total ||
      compareLabels(family, a.asked, b.asked) ||
      compareLabels(family, a.answered, b.answered),
  );
}
