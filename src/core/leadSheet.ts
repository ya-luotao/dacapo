// The left hand of a lead sheet, from its chord symbols (docs/HARMONY.md, "Lead sheets (H3)" and
// "Clarifications (decided during H3)"): a pattern of H2 laid under the melody, bar by bar, from
// the symbols the score prints. Pure and deterministic: the same score and pattern always make
// the same notes, so a piece practised with a pattern keeps its checksum.
//
// What is made here is written into the score's bass staff by leadSheetXml.ts, so it is drawn,
// heard, judged and recorded as a written left hand is.

import {
  MUSICXML_KIND,
  rootPc,
  SYMBOL_QUALITIES,
  SYMBOL_TONES,
  symbolTones,
  type SymbolQuality,
} from './chordSymbols.ts';
import type { HarmonyMark } from './markings.ts';
import {
  BASS_LOW,
  CHORD_BASS_LOW,
  isPatternId,
  OFFBEAT_CENTER,
  OFFBEAT_HIGH,
  PATTERN_IDS,
  spellTone,
  type PatternId,
} from './progressions.ts';
import { TICKS_PER_QUARTER, type Measure, type Score, type SpelledPitch } from './score.ts';
import type { Root } from './theoryItems.ts';
import { closeVoicings, leadVoices, type LeadChord } from './voiceLeading.ts';

/** What a piece's left hand plays: what the score writes, or a pattern made from its symbols. */
export type LeftHandChoice = 'written' | PatternId;

export const isLeftHandChoice = (v: unknown): v is LeftHandChoice =>
  v === 'written' || isPatternId(v);

// --- Meters ----------------------------------------------------------------------------------

/**
 * A time signature as the patterns count it: two, three or four beats (`simple`), dotted beats of
 * three (`compound`: 6/8, 9/8, 12/8), or anything else (`other`: 5/4, 7/8, 6/4).
 */
export interface Meter {
  kind: 'simple' | 'compound' | 'other';
  /** Beats to the bar: the dotted ones of a compound meter. */
  beats: number;
  /** A beat, and the whole bar, in ticks. */
  beat: number;
  bar: number;
}

export function meterOf({ beats, beatType }: Pick<Measure, 'beats' | 'beatType'>): Meter {
  const unit = (4 * TICKS_PER_QUARTER) / beatType;
  const bar = beats * unit;
  // Halves of a beat (thirds of a dotted one) must be whole ticks that a note value can write.
  const writable = Number.isInteger(unit / 2) && unit % 60 === 0;
  if (writable && beatType >= 8 && (beats === 6 || beats === 9 || beats === 12))
    return { kind: 'compound', beats: beats / 3, beat: 3 * unit, bar };
  if (writable && beats >= 2 && beats <= 4) return { kind: 'simple', beats, beat: unit, bar };
  return { kind: 'other', beats, beat: unit, bar };
}

/**
 * The patterns a meter takes. Block chords and root and fifth are held, so they fit any bar;
 * stride (bass, chord) needs two or four beats; the waltz (bass, chord, chord) three, or the
 * three eighths of a dotted beat; Alberti and the arpeggio any of these.
 */
export function meterPatterns(meter: Meter): PatternId[] {
  if (meter.kind === 'other') return ['block', 'rootFifth'];
  if (meter.kind === 'compound' || meter.beats === 3)
    return ['block', 'rootFifth', 'waltz', 'alberti', 'arpeggio'];
  return ['block', 'rootFifth', 'alberti', 'arpeggio', 'stride'];
}

/**
 * The patterns offered for a score: those every one of its bars takes, in the Harmony page's
 * order; none for a score without chord symbols.
 */
export function leftHandPatterns(score: Pick<Score, 'measures' | 'harmonies'>): PatternId[] {
  if (!score.harmonies || score.harmonies.length === 0) return [];
  const sets = score.measures.map((m) => meterPatterns(meterOf(m)));
  return PATTERN_IDS.filter((p) => sets.every((set) => set.includes(p)));
}

/**
 * What a piece's left hand is until the player chooses: block chords from the symbols for a lead
 * sheet whose left hand is empty, the written one otherwise.
 */
export function defaultLeftHand(
  score: Pick<Score, 'measures' | 'harmonies' | 'notes'>,
): LeftHandChoice {
  if (leftHandPatterns(score).length === 0) return 'written';
  return score.notes.some((n) => n.hand === 'left') ? 'written' : 'block';
}

/** The choice in effect: the one asked for where the score offers it, else its default. */
export function leftHandFor(
  score: Pick<Score, 'measures' | 'harmonies' | 'notes'>,
  asked: LeftHandChoice | undefined,
): LeftHandChoice {
  if (asked === 'written') return 'written';
  if (asked !== undefined && leftHandPatterns(score).includes(asked)) return asked;
  return defaultLeftHand(score);
}

// --- Chords ----------------------------------------------------------------------------------

/**
 * Kinds the app has no symbol for, read as their nearest seventh chord or triad: a ninth, an
 * eleventh or a thirteenth as its seventh chord, a minor chord with a major seventh as its triad,
 * an augmented seventh as its triad.
 */
const REDUCED_KINDS: Readonly<Record<string, SymbolQuality>> = {
  'dominant-ninth': 'dom7',
  'dominant-11th': 'dom7',
  'dominant-13th': 'dom7',
  'major-ninth': 'maj7',
  'major-11th': 'maj7',
  'major-13th': 'maj7',
  'minor-ninth': 'min7',
  'minor-11th': 'min7',
  'minor-13th': 'min7',
  'major-minor': 'min',
  'augmented-seventh': 'aug',
};

/** A symbol as the left hand plays it. */
interface Chord {
  /** Tells two chords apart within a bar. */
  id: string;
  /** Pitch classes: the root, and the lowest note (a slash chord's bass, else the root). */
  root: number;
  bass: number;
  /** Semitones above the root: the tone next to it, the fifth, and the seventh if it has one. */
  middle: number;
  fifth: number;
  seventh: number | null;
  /** Its tones as named, root first, and a bass that is none of them: how its keys are spelled. */
  tones: Root[];
  /** The chord on the off-beats: whole, or a seventh chord without its root. */
  offbeat: number[];
}

/**
 * The chord the left hand plays under a symbol: its kind as one of the app's qualities (degrees
 * are left out, so `C7♯9` is played as C7), or null where it has none (`power`, `none`, `other`,
 * an augmented sixth): the left hand rests there.
 */
function chordOf(mark: HarmonyMark): Chord | null {
  const quality =
    SYMBOL_QUALITIES.find((q) => q !== 'add9' && MUSICXML_KIND[q] === mark.kind) ??
    REDUCED_KINDS[mark.kind];
  if (quality === undefined) return null;
  const root = rootPc(mark.root);
  const bass = mark.bass && rootPc(mark.bass) !== root ? mark.bass : null;
  const tones = SYMBOL_TONES[quality];
  const pcs = tones.map((t) => (root + t.semitones) % 12);
  return {
    id: `${mark.root.step}${mark.root.alter}:${quality}:${bass ? `${bass.step}${bass.alter}` : ''}`,
    root,
    bass: bass ? rootPc(bass) : root,
    middle: tones[1]!.semitones,
    fifth: tones.find((t) => t.steps === 4)!.semitones,
    seventh: tones.find((t) => t.steps === 6)?.semitones ?? null,
    tones: symbolTones({ root: mark.root, quality, bass }),
    offbeat: tones.length === 4 ? pcs.slice(1) : pcs,
  };
}

// --- Bars and segments -----------------------------------------------------------------------

/** A sixteenth: where a held chord may change (a symbol between two is struck on the next). */
const HELD_GRID = TICKS_PER_QUARTER / 4;

/** The pattern's unit of time in a meter, in ticks; null for a held pattern. */
function patternGrid(pattern: PatternId, meter: Meter): number | null {
  if (pattern === 'block' || pattern === 'rootFifth') return null;
  if (meter.kind === 'compound') return meter.beat / 3;
  if (pattern === 'alberti') return meter.beat / 2;
  if (pattern === 'arpeggio') return meter.beats === 2 ? meter.beat / 2 : meter.beat;
  return meter.beat;
}

/** The pattern played in a bar: the one asked for where the bar's meter takes it, else block. */
const patternIn = (pattern: PatternId, meter: Meter): PatternId =>
  meterPatterns(meter).includes(pattern) ? pattern : 'block';

interface Segment {
  measure: number;
  /** Ticks from the start of the bar. */
  start: number;
  end: number;
  chord: Chord;
}

interface BarFrame {
  meter: Meter;
  /** Where the bar starts within its meter: over 0 for an upbeat, which ends on the barline. */
  phase: number;
  pattern: PatternId;
}

/**
 * A bar shorter than its time signature is an upbeat when it is the first bar, or the second
 * part of a bar divided in two (by a repeat sign or a double bar): it ends on the barline, and
 * its beats are the last of the meter. Any other short bar starts on the 1.
 */
function barFrames(measures: readonly Measure[], pattern: PatternId): BarFrame[] {
  const frames: BarFrame[] = [];
  measures.forEach((m, i) => {
    const meter = meterOf(m);
    const before = measures[i - 1];
    const short = m.duration < meter.bar;
    const secondPart =
      before !== undefined &&
      frames[i - 1]!.phase === 0 &&
      before.duration < frames[i - 1]!.meter.bar &&
      before.duration + m.duration <= meter.bar;
    const upbeat = short && (i === 0 || secondPart);
    frames.push({
      meter,
      phase: upbeat ? meter.bar - m.duration : 0,
      pattern: patternIn(pattern, meter),
    });
  });
  return frames;
}

/**
 * The chords bar by bar. A symbol stands until the next one in the score as written (repeats are
 * not unrolled: the left hand is written once per bar); it takes effect where it stands, or on
 * the pattern's next note when it stands between two (past the bar's end: with the next bar). An
 * upbeat bar is left to the melody until a symbol stands in it.
 */
function segments(score: Score, frames: readonly BarFrame[]): Segment[] {
  const all = score.harmonies ?? [];
  // One line of symbols: the part and staff of the first.
  const marks = all.filter((h) => h.part === all[0]!.part && h.staff === all[0]!.staff);
  const byMeasure = new Map<number, HarmonyMark[]>();
  for (const mark of marks)
    byMeasure.set(mark.measure, [...(byMeasure.get(mark.measure) ?? []), mark]);

  const out: Segment[] = [];
  let current: Chord | null = null;
  /** A symbol that falls past its bar's end: it starts the next bar. */
  let pending: { chord: Chord | null } | null = null;
  score.measures.forEach((m, i) => {
    const { meter, phase, pattern } = frames[i]!;
    const grid = patternGrid(pattern, meter) ?? HELD_GRID;
    const changes: { at: number; chord: Chord | null }[] = [];
    if (pending) {
      current = pending.chord;
      changes.push({ at: 0, chord: current });
      pending = null;
    } else {
      changes.push({ at: 0, chord: phase > 0 ? null : current });
    }
    for (const mark of byMeasure.get(i) ?? []) {
      const within = Math.max(0, mark.tick - m.start);
      const at = Math.ceil((phase + within) / grid) * grid - phase;
      const chord = chordOf(mark);
      if (at >= m.duration) pending = { chord };
      else {
        pending = null;
        changes.push({ at, chord });
      }
      current = chord;
    }
    changes.forEach((change, k) => {
      const next = changes[k + 1];
      const end = next ? next.at : m.duration;
      // A later symbol on the same note takes its place.
      if (end <= change.at || !change.chord) return;
      const last = out.at(-1);
      // The same chord again within the bar goes on: the pattern does not start over.
      if (last && last.measure === i && last.end === change.at && last.chord.id === change.chord.id)
        last.end = end;
      else out.push({ measure: i, start: change.at, end, chord: change.chord });
    });
  });
  return out;
}

// --- The patterns ----------------------------------------------------------------------------

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** The key of pitch class `pc` from `low` up (within the octave above it). */
const from = (pc: number, low: number) => low + mod12(pc - low);

/** The chord's other tones in close position above its bass, low to high. */
function above(bass: number, chord: Chord): number[] {
  const top = chord.seventh ?? chord.fifth;
  const pcs = [chord.root, chord.root + chord.middle, chord.root + top].map(mod12);
  const steps = [...new Set(pcs.map((pc) => mod12(pc - bass)))].filter((s) => s !== 0);
  return steps.sort((a, b) => a - b).map((s) => bass + s);
}

/** The second bass of the stride and the waltz: the fifth, a fourth below where that stays above C2. */
function secondBass(bass: number, chord: Chord): number {
  const fifth = mod12(chord.root + chord.fifth);
  // Over a bass that is the fifth, the root.
  const key = bass + mod12((fifth === mod12(bass) ? chord.root : fifth) - bass);
  return key - 12 >= BASS_LOW ? key - 12 : key;
}

/** The notes of a pattern under one chord, in units of the pattern's grid: `null` is the chord on the off-beat. */
type Figure = (number[] | null)[];

/** The bass register a pattern starts from: F2 for the chordal ones, C2 for the others. */
const lowOf = (pattern: PatternId) =>
  pattern === 'block' || pattern === 'alberti' ? CHORD_BASS_LOW : BASS_LOW;

/**
 * The pattern under one chord, `count` notes long, on the bass key `bass`. It starts over with
 * each chord; a chord that lasts less than the pattern gets its beginning.
 */
function figure(
  pattern: PatternId,
  meter: Meter,
  chord: Chord,
  bass: number,
  count: number,
): Figure {
  const upper = above(bass, chord);
  const slash = chord.bass !== chord.root;
  const at = (cycle: readonly (number[] | null)[], special?: (j: number) => number[] | null) =>
    Array.from({ length: count }, (_, j) => special?.(j) ?? cycle[j % cycle.length]!);
  switch (pattern) {
    case 'block':
      return [[bass, ...upper]];
    case 'rootFifth':
      // Over another bass, the bass and the root.
      return [[bass, slash ? bass + mod12(chord.root - bass) : bass + chord.fifth]];
    case 'alberti': {
      const [low, middle, high] = [bass, upper[0]!, upper.at(-1)!];
      if (meter.kind === 'compound') return at([[low], [middle], [high]]);
      // Low, high, middle, high; a beat left over at the end goes on middle, high (as in 3/4).
      const tail = count % 4 === 2 && count > 2 ? count - 2 : Infinity;
      return at([[low], [high], [middle], [high]], (j) =>
        j >= tail ? [j === tail ? middle : high] : null,
      );
    }
    case 'arpeggio': {
      const up = slash
        ? [bass, ...upper, bass + 12, upper[0]! + 12].slice(0, 4)
        : [
            bass,
            bass + chord.fifth,
            chord.seventh === null ? bass + 12 : bass + chord.seventh,
            bass + 12 + chord.middle,
          ];
      const [one, five, eight, ten] = up as [number, number, number, number];
      // Up, and in a compound meter down again: 1–5–8, 10–8–5.
      return meter.kind === 'compound'
        ? at([[one], [five], [eight], [ten], [eight], [five]])
        : at([[one], [five], [eight], [ten]]);
    }
    case 'waltz': {
      const second = [secondBass(bass, chord)];
      return meter.kind === 'compound'
        ? at([[bass], null, null, second, null, null])
        : at([[bass], null, null]);
    }
    case 'stride':
      return at([[bass], null, [secondBass(bass, chord)], null]);
  }
}

/**
 * The figure kept under `limit` (the highest key the left hand may play): as it is where it fits;
 * an octave lower where it then fits and its bass stays at or above C2; else its keys above the
 * limit are left out, and a note that would be left with none takes the highest chord tone under
 * the limit (none at all where the bass itself would reach it).
 */
function fitted(make: (bass: number) => Figure, chord: Chord, low: number, limit: number): Figure {
  const bass = from(chord.bass, low);
  const top = (f: Figure) => Math.max(...f.flatMap((keys) => keys ?? []));
  const plain = make(bass);
  if (top(plain) <= limit) return plain;
  const canDrop = bass - 12 >= BASS_LOW;
  if (canDrop) {
    const lower = make(bass - 12);
    if (top(lower) <= limit) return lower;
  }
  const base = canDrop ? bass - 12 : bass;
  const pcs = new Set(chord.tones.map(rootPc));
  return make(base).map((keys) => {
    if (keys === null) return null;
    const kept = keys.filter((key) => key <= limit);
    if (kept.length > 0) return kept;
    for (let key = Math.min(limit, 127); key >= base; key--) if (pcs.has(mod12(key))) return [key];
    return [];
  });
}

// --- The left hand ---------------------------------------------------------------------------

export interface GeneratedNote {
  midi: number;
  pitch: SpelledPitch;
}

/** A note or chord of the generated left hand. */
export interface GeneratedEvent {
  /** Ticks from the start of the bar. */
  onset: number;
  duration: number;
  /** Low to high. */
  notes: GeneratedNote[];
}

/** One written bar of the generated left hand. */
export interface GeneratedBar {
  meter: Meter;
  /** Where the bar starts within its meter (over 0 for an upbeat). */
  phase: number;
  /** In time order; the bar rests where there is none. */
  events: GeneratedEvent[];
}

/**
 * The left hand `pattern` makes from the score's chord symbols: one entry per written bar.
 *
 * Every key lies under the lowest key the right hand plays anywhere in the piece, so the hands
 * never cross and no key is ever asked of both. The chord on the off-beats of the waltz and the
 * stride is in close position in the tenor (up to B3), each led from the one before as H2's are.
 */
export function leftHandFromSymbols(score: Score, pattern: PatternId): GeneratedBar[] {
  const frames = barFrames(score.measures, pattern);
  const bars: GeneratedBar[] = frames.map(({ meter, phase }) => ({ meter, phase, events: [] }));
  if (!score.harmonies || score.harmonies.length === 0) return bars;
  const melody = score.notes.filter((n) => n.hand === 'right').map((n) => n.midi);
  const limit = melody.length > 0 ? Math.min(...melody) - 1 : Infinity;
  const all = segments(score, frames);

  // The chords on the off-beats, led through the piece (where one fits under the limit).
  const offbeats = new Map<Segment, number[]>();
  const led: { segment: Segment; chord: LeadChord }[] = [];
  for (const segment of all) {
    const name = frames[segment.measure]!.pattern;
    if (name !== 'waltz' && name !== 'stride') continue;
    const bass = from(segment.chord.bass, BASS_LOW);
    const chord: LeadChord = { pcs: segment.chord.offbeat, bass, floor: bass + 3 };
    const high = Math.min(OFFBEAT_HIGH, limit);
    if (closeVoicings(chord.pcs, Math.max(BASS_LOW, chord.floor), high).length > 0)
      led.push({ segment, chord });
  }
  if (led.length > 0) {
    const voiced = leadVoices(
      led.map((l) => l.chord),
      {
        low: BASS_LOW,
        high: Math.min(OFFBEAT_HIGH, limit),
        center: OFFBEAT_CENTER,
        cyclic: false,
      },
    );
    led.forEach((l, k) => offbeats.set(l.segment, voiced[k]!));
  }

  for (const segment of all) {
    const { meter, pattern: name } = frames[segment.measure]!;
    const { chord } = segment;
    const grid = patternGrid(name, meter);
    const length = segment.end - segment.start;
    const count = grid === null ? 1 : Math.floor(length / grid);
    if (count === 0) continue;
    const keys = fitted(
      (bass) => figure(name, meter, chord, bass, count),
      chord,
      lowOf(name),
      limit,
    );
    const offbeat = offbeats.get(segment) ?? [];
    keys.forEach((own, j) => {
      const midis = own ?? offbeat;
      if (midis.length === 0) return;
      bars[segment.measure]!.events.push({
        onset: segment.start + j * (grid ?? 0),
        duration: grid ?? length,
        notes: [...new Set(midis)]
          .sort((a, b) => a - b)
          .map((midi) => ({ midi, pitch: spellTone(midi, chord.tones) })),
      });
    });
  }
  return bars;
}
