// What a score marks besides its notes (docs/EXPRESSION.md, "The score's markings"): dynamics,
// hairpins, slurs, fermatas and pedal marks here; articulations, ornaments and grace notes on the
// notes themselves (`ScoreNote`). Everything is in written ticks, as note onsets are, and is laid
// out in performance order through the repeats by `performedMarks` and `performedSpans`.
// None of it enters the piece's checksum, which covers the notes as practised.

import type { ChordSymbol, MusicXmlDegree } from './chordSymbols.ts';
import type { PlayedMeasure } from './repeats.ts';
import type { Measure, SpelledPitch } from './score.ts';
import type { Root } from './theoryItems.ts';

/** The dynamics MusicXML names (`<dynamics>` children), soft to loud, then the accents. */
export const DYNAMICS = [
  'pppppp',
  'ppppp',
  'pppp',
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'ffff',
  'fffff',
  'ffffff',
  'fp',
  'pf',
  'sf',
  'sfp',
  'sfpp',
  'sfz',
  'sffz',
  'sfzp',
  'fz',
  'rf',
  'rfz',
  'n',
] as const;
export type Dynamic = (typeof DYNAMICS)[number];

export function isDynamic(value: string): value is Dynamic {
  return (DYNAMICS as readonly string[]).includes(value);
}

/** Where a marking stands: part, staff (1-based) and written tick, like a note's onset. */
export interface MarkPlace {
  part: number;
  staff: number;
  /** Written measure index. */
  measure: number;
  /** Written tick from the start of the piece. */
  tick: number;
}

export interface DynamicMark extends MarkPlace {
  dynamic: Dynamic;
}

/** A written end: measure index and written tick (the end of the span, exclusive). */
export interface WrittenEnd {
  measure: number;
  tick: number;
}

/**
 * A crescendo or diminuendo: a hairpin (`wedge`), or the words cresc., dim. or decresc., which
 * run to their dashes' end or, without one, to the next dynamic.
 */
export interface HairpinMark extends MarkPlace {
  kind: 'crescendo' | 'diminuendo';
  written: 'wedge' | 'words';
  end: WrittenEnd;
}

/**
 * A pedal mark. `sustain` is the right pedal (CC 64), `sostenuto` the middle one (CC 66),
 * `una-corda` the left one (CC 67), from the words una corda (`start`) and tre corde (`stop`).
 */
export interface PedalMark extends MarkPlace {
  pedal: 'sustain' | 'sostenuto' | 'una-corda';
  type: 'start' | 'stop' | 'change' | 'continue';
  /** Drawn as a bracket line rather than Ped. and ✱ signs. */
  line: boolean;
}

/** A slur from one note to another (note ids), in the voice and on the staff it starts in. */
export interface SlurMark {
  part: number;
  staff: number;
  voice: string;
  from: string;
  to: string;
}

export interface Markings {
  /** Sorted by tick, then part and staff. */
  dynamics: DynamicMark[];
  hairpins: HairpinMark[];
  pedals: PedalMark[];
  slurs: SlurMark[];
  /** On notes and rests, one per part, staff and tick. */
  fermatas: MarkPlace[];
}

/**
 * A chord symbol over the music (`<harmony>`), as a lead sheet prints it (docs/HARMONY.md, "Lead
 * sheets (H3)"). MusicXML gives a symbol a staff but no voice. Laid out through the repeats by
 * `performedMarks`, like the markings.
 */
export interface HarmonyMark extends MarkPlace {
  root: Root;
  /** MusicXML's `<kind>` value as written: `major`, `dominant`, `half-diminished` … */
  kind: string;
  bass: Root | null;
  /** Tones added, altered or taken away (`<degree>`); absent when none. */
  degrees?: MusicXmlDegree[];
  /**
   * What the score prints: the root, the kind's `text` attribute and the bass (`B♭maj7`, `D/F♯`);
   * without a `text`, the app's symbol, or the root and the kind.
   */
  text: string;
  /** The symbol in the app's one style (`core/chordSymbols.ts`), or null for one it has none for. */
  symbol: ChordSymbol | null;
}

export function emptyMarkings(): Markings {
  return { dynamics: [], hairpins: [], pedals: [], slurs: [], fermatas: [] };
}

export const ARTICULATIONS = [
  'staccato',
  'staccatissimo',
  'spiccato',
  'tenuto',
  'detached-legato',
  'accent',
  'strong-accent',
] as const;
export type Articulation = (typeof ARTICULATIONS)[number];

export const ORNAMENT_KINDS = [
  'trill',
  'mordent',
  'inverted-mordent',
  'turn',
  'inverted-turn',
  'delayed-turn',
  'delayed-inverted-turn',
] as const;
export type OrnamentKind = (typeof ORNAMENT_KINDS)[number];

/** An ornament on a note, with the neighbouring keys it plays. */
export interface Ornament {
  kind: OrnamentKind;
  /**
   * The next letter up and down from the note: in the key and the accidentals already in force in
   * the bar, unless an accidental is printed with the ornament (above: the upper, below: the lower).
   */
  upper: number;
  lower: number;
  /** A trill drawn with a wavy line. */
  wavyLine?: true;
  /** A long mordent: two alternations instead of one. */
  long?: true;
}

/** A grace note, kept on the note it leads to (the next note of its voice). */
export interface GraceNote {
  id: string;
  midi: number;
  pitch: SpelledPitch;
  /** Slashed: an acciaccatura, played just before the beat; otherwise an appoggiatura, on it. */
  slash: boolean;
  /** Sounds together with the grace note before it (a grace chord). */
  chord: boolean;
}

/** A marking at a place in the play order. */
export interface PerformedMark<T> {
  mark: T;
  /** Performance tick. */
  at: number;
  /** Position in the play order. */
  played: number;
}

type Bars = readonly Pick<Measure, 'start' | 'duration'>[];

/** Every occurrence of each mark in the play order, in performance ticks, sorted by tick. */
export function performedMarks<T extends MarkPlace>(
  marks: readonly T[],
  measures: Bars,
  order: readonly PlayedMeasure[],
): PerformedMark<T>[] {
  const byMeasure = new Map<number, T[]>();
  for (const mark of marks) {
    const list = byMeasure.get(mark.measure) ?? [];
    list.push(mark);
    byMeasure.set(mark.measure, list);
  }
  const out: PerformedMark<T>[] = [];
  order.forEach((played, index) => {
    const measure = measures[played.measure]!;
    for (const mark of byMeasure.get(played.measure) ?? [])
      out.push({ mark, at: played.start + mark.tick - measure.start, played: index });
  });
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Every occurrence of each span (a hairpin) in the play order, in performance ticks. The end is
 * the first time its written bar is played from the start on; when the order jumps away before
 * that (a repeat going back, a first ending skipped), the span ends where the order jumps.
 */
export function performedSpans<T extends MarkPlace & { end: WrittenEnd }>(
  spans: readonly T[],
  measures: Bars,
  order: readonly PlayedMeasure[],
): (PerformedMark<T> & { end: number })[] {
  return performedMarks(spans, measures, order).map((performed) => {
    const { mark } = performed;
    let end: number | null = null;
    for (let k = performed.played; k < order.length && end === null; k++) {
      const played = order[k]!;
      const measure = measures[played.measure]!;
      if (played.measure === mark.end.measure) {
        end = played.start + mark.end.tick - measure.start;
        break;
      }
      const next = order[k + 1];
      if (!next || next.measure !== played.measure + 1) end = played.start + measure.duration;
    }
    return { ...performed, end: Math.max(performed.at, end ?? performed.at) };
  });
}
