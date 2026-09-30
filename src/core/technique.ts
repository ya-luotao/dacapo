// The technique exercises of the Scales page (docs/SCALES.md, "Technique"): what each is, in which
// keys, octaves and hands it is offered, and its notes. They are exercises like the scales — plain
// data with a stable key, drawn from generated MusicXML, measured by evenness.ts — so this module
// only says what is played; scales.ts dispatches to it.

import { midiOf } from './musicxml.ts';
import { HANON_PART_ONE, type HanonPartOne } from './hanonPartOne.ts';
import { partsOf, plateParts, plateRun, type PlateDegree } from './techniquePlates.ts';
import { MAJOR_TONICS, MINOR_TONICS, scaleDegree, startingTonics } from './scales.ts';
import type {
  Direction,
  ScaleExercise,
  ScaleHands,
  ScaleNote,
  ScaleOctaves,
  TechniqueType,
  Tonic,
} from './scaleTypes.ts';
import { TECHNIQUE_TYPES } from './scaleTypes.ts';
import type { Hand, SpelledPitch } from './score.ts';
import type { Letter } from './note.ts';

export function isTechnique(type: string): type is TechniqueType {
  return (TECHNIQUE_TYPES as readonly string[]).includes(type);
}

/** What a technique exercise can be set to: its keys, octaves, hands and forms. */
export interface TechniqueRules {
  tonics: readonly Tonic[];
  octaves: readonly ScaleOctaves[];
  hands: readonly ScaleHands[];
  /** The forms it has in a key (Hanon's numbers); empty when it has one. */
  variants: readonly string[];
  /**
   * Notes to the beat as drawn at free tempo, and whether the click keeps it (the rhythm is the
   * exercise's own: Hanon's as printed, a broken chord's four notes, a block chord to the beat)
   * rather than taking the 2, 3 or 4 chosen for the scales. Hanon's later plates set their own
   * (`plateLayout`).
   */
  perBeat: 1 | 2 | 3 | 4;
  fixedRhythm: boolean;
  /** The keys a form is offered in, where it is not every key of `tonics` (Hanon's trill: C). */
  tonicsOf?: (variant: string | undefined) => readonly Tonic[];
}

const HANDS: readonly ScaleHands[] = ['right', 'left', 'both'];

/** Hanon's Part I, by number: the exercises transcribed (all twenty). */
export const HANON_NUMBERS: readonly string[] = HANON_PART_ONE.map((h) => String(h.number));

/**
 * The trill on a pair of fingers (the right hand's, lower key first; the left hand plays the
 * mirror pair, 1 for 5 and 2 for 4, as Hanon's No. 46 pairs them): the neighbouring pairs and those
 * a finger apart.
 */
export const TRILL_PAIRS = ['12', '23', '34', '45', '13', '24', '35'] as const;
/** Bars of the trill on a pair, sixteen sixteenths a bar. */
export const TRILL_BARS = [4, 8, 16] as const;
/** Hanon's No. 46 as a form of the trill: its first six bars. */
export const HANON_TRILL = '46';
const TRILL_VARIANTS = [
  HANON_TRILL,
  ...TRILL_PAIRS.flatMap((pair) => TRILL_BARS.map((bars) => `${pair}-${bars}`)),
];

/** A trill's form read: Hanon's, or a pair of fingers and a length. */
export function trillForm(
  variant: string | undefined,
): { hanon: true } | { hanon: false; lower: number; upper: number; bars: number } {
  if (variant === HANON_TRILL) return { hanon: true };
  const match = /^([1-5])([1-5])-(\d+)$/.exec(variant ?? '');
  if (!match) throw new Error(`not a trill: ${variant}`);
  return { hanon: false, lower: Number(match[1]), upper: Number(match[2]), bars: Number(match[3]) };
}

/** The parts of a Hanon plate a type offers by key: No. 42's sections, No. 53's keys. */
const partTonics = (number: number, suffix = '') =>
  plateParts(number)
    .filter((p) => p.part.endsWith(suffix))
    .map((p) => p.part.slice(0, p.part.length - suffix.length));

/** No. 45's fingerings as forms: `45.1` … `45.6`. */
const repeatVariants = () => [
  ...plateParts(44).map(() => '44'),
  ...plateParts(45).map((p) => `45.${p.part}`),
  ...plateParts(47).map(() => '47'),
];

export function techniqueRules(type: TechniqueType): TechniqueRules {
  switch (type) {
    case 'majorFiveFinger':
    case 'minorFiveFinger':
      return {
        tonics: type === 'majorFiveFinger' ? MAJOR_TONICS : MINOR_TONICS,
        octaves: [1],
        hands: HANDS,
        variants: [],
        perBeat: 2,
        fixedRhythm: false,
      };
    case 'hanon':
      return {
        tonics: ['C'],
        octaves: [2],
        hands: HANDS,
        variants: HANON_NUMBERS,
        perBeat: 4,
        fixedRhythm: true,
      };
    case 'majorChords':
    case 'minorChords':
      return {
        tonics: type === 'majorChords' ? MAJOR_TONICS : MINOR_TONICS,
        // An octave up and back is seven chords: too few intervals a direction for any timing
        // figure (each needs three neighbours). Two octaves are thirteen, three nineteen.
        octaves: [2, 3],
        hands: HANDS,
        variants: [],
        perBeat: 1,
        fixedRhythm: true,
      };
    case 'majorBrokenChords':
    case 'minorBrokenChords':
      return {
        tonics: type === 'majorBrokenChords' ? MAJOR_TONICS : MINOR_TONICS,
        octaves: [1, 2],
        hands: HANDS,
        variants: [],
        perBeat: 4,
        fixedRhythm: true,
      };
    case 'diminishedSevenths':
    case 'dominantSevenths':
      return {
        tonics: partTonics(type === 'diminishedSevenths' ? 42 : 43),
        octaves: [3],
        hands: HANDS,
        variants: [],
        perBeat: 4,
        fixedRhythm: true,
      };
    case 'repeatedNotes':
      return {
        tonics: ['C'],
        octaves: [2],
        hands: HANDS,
        variants: repeatVariants(),
        perBeat: 4,
        fixedRhythm: true,
      };
    case 'trill':
      return {
        tonics: MAJOR_TONICS,
        octaves: [1],
        hands: HANDS,
        variants: TRILL_VARIANTS,
        perBeat: 4,
        fixedRhythm: true,
        tonicsOf: (variant) => (variant === HANON_TRILL ? ['C'] : MAJOR_TONICS),
      };
    case 'thirds':
      return {
        tonics: ['C'],
        octaves: [2],
        hands: HANDS,
        variants: plateParts(50).map((p) => p.part),
        perBeat: 4,
        fixedRhythm: true,
      };
    case 'octaves':
      return {
        tonics: ['C'],
        octaves: [2],
        hands: HANDS,
        variants: [],
        perBeat: 4,
        fixedRhythm: true,
      };
    case 'majorOctaves':
    case 'minorOctaves':
      return {
        tonics: partTonics(53, type === 'majorOctaves' ? ' major' : ' minor'),
        octaves: [2],
        hands: HANDS,
        variants: [],
        perBeat: 4,
        fixedRhythm: true,
      };
  }
}

/** The Hanon plate and part an exercise plays, for the types drawn from his later plates. */
export function plateOf(
  e: Pick<ScaleExercise, 'type' | 'tonic' | 'variant'>,
): { number: number; part: string } | null {
  switch (e.type) {
    case 'diminishedSevenths':
      return { number: 42, part: e.tonic };
    case 'dominantSevenths':
      return { number: 43, part: e.tonic };
    case 'repeatedNotes': {
      const [number, part] = (e.variant ?? '').split('.');
      return { number: Number(number), part: part ?? '' };
    }
    case 'trill':
      return e.variant === HANON_TRILL ? { number: 46, part: '1-6' } : null;
    case 'thirds':
      return { number: 50, part: e.variant ?? '' };
    case 'octaves':
      return { number: 51, part: '1-3' };
    case 'majorOctaves':
      return { number: 53, part: `${e.tonic} major` };
    case 'minorOctaves':
      return { number: 53, part: `${e.tonic} minor` };
    default:
      return null;
  }
}

/** Whether `e` is a technique exercise as offered: its key, octaves, hands and form. */
export function isTechniqueExercise(e: {
  type: TechniqueType;
  tonic: unknown;
  octaves: unknown;
  hands: unknown;
  variant?: unknown;
}): boolean {
  const rules = techniqueRules(e.type);
  const tonics = rules.tonicsOf ? rules.tonicsOf(e.variant as string | undefined) : rules.tonics;
  return (
    (tonics as readonly unknown[]).includes(e.tonic) &&
    (rules.octaves as readonly unknown[]).includes(e.octaves) &&
    (rules.hands as readonly unknown[]).includes(e.hands) &&
    (rules.variants.length === 0
      ? e.variant === undefined
      : (rules.variants as readonly unknown[]).includes(e.variant))
  );
}

/** Hanon's exercise of that number (Part I). */
export function hanonPartOne(variant: string | undefined): HanonPartOne {
  const found = HANON_PART_ONE.find((h) => String(h.number) === variant);
  if (!found) throw new Error(`no Hanon exercise ${variant}`);
  return found;
}

// Notes -------------------------------------------------------------------------------------------

const scaleOf = (type: TechniqueType) =>
  type.startsWith('major') ? ('major' as const) : ('naturalMinor' as const);

/** The note `position` steps up the key's triad from `tonic` (0 root, 1 third, 2 fifth, 3 root…). */
function triadNote(type: TechniqueType, tonic: SpelledPitch, position: number): SpelledPitch {
  return scaleDegree(scaleOf(type), tonic, 7 * Math.floor(position / 3) + 2 * (position % 3));
}

function note(
  hand: Hand,
  index: number,
  pitch: SpelledPitch,
  extra: Partial<ScaleNote> & Pick<ScaleNote, 'direction' | 'degree'>,
): ScaleNote {
  return {
    hand,
    index,
    pitch,
    midi: midiOf(pitch),
    finger: null,
    turn: false,
    crossing: null,
    ...extra,
  };
}

/** Times the five-finger group is played before the closing tonic. */
export const FIVE_FINGER_GROUPS = 4;

/**
 * 1 2 3 4 5 4 3 2 from the tonic four times over, the hand still, then the tonic: the finger is
 * the degree (the right hand's thumb on the tonic, the left hand's fifth finger), so the fingering
 * needs no edition. Played once (nine notes) it has too few intervals for any figure; repeated, it
 * is a pattern that neither rises nor falls: every note goes one way, nothing turns, and a note's
 * degree is its place in the group.
 */
function fiveFinger(type: TechniqueType, hand: Hand, tonic: SpelledPitch): ScaleNote[] {
  const group = [0, 1, 2, 3, 4, 3, 2, 1];
  const positions = [...Array.from({ length: FIVE_FINGER_GROUPS }, () => group).flat(), 0];
  return positions.map((position, index) =>
    note(hand, index, scaleDegree(scaleOf(type), tonic, position), {
      direction: 'up',
      degree: index % group.length,
      pattern: true,
      finger: hand === 'right' ? position + 1 : 5 - position,
    }),
  );
}

/**
 * The chords of the key's triad from `tonic` up `octaves` and back: root position, the first and
 * second inversions, and so on to the root position an octave (or two) higher, then down the same
 * way. Chord k is the triad's notes k, k + 1 and k + 2 (0 the root, 1 the third, 2 the fifth, 3 the
 * root an octave up…).
 */
function chordStarts(octaves: number): number[] {
  const top = 3 * octaves;
  const up = Array.from({ length: top + 1 }, (_, k) => k);
  return [...up, ...up.slice(0, -1).reverse()];
}

/** Block chords: each chord's three keys together, one step; `degree` is the inversion. */
function blockChords(
  type: TechniqueType,
  hand: Hand,
  tonic: SpelledPitch,
  octaves: number,
): ScaleNote[] {
  const top = 3 * octaves;
  return chordStarts(octaves).flatMap((k, index) =>
    [k, k + 1, k + 2].map((position) =>
      note(hand, index, triadNote(type, tonic, position), {
        direction: index <= top ? 'up' : 'down',
        turn: index === top,
        degree: k % 3,
      }),
    ),
  );
}

/**
 * Broken chords: each chord low, middle, high, middle, then the root to close. The four notes are
 * a group repeated up and down (`pattern`): a note's degree is its place in the group (0–3).
 */
function brokenChords(
  type: TechniqueType,
  hand: Hand,
  tonic: SpelledPitch,
  octaves: number,
): ScaleNote[] {
  const top = 3 * octaves;
  const notes: ScaleNote[] = [];
  const starts = chordStarts(octaves);
  starts.forEach((k, chord) => {
    [k, k + 1, k + 2, k + 1].forEach((position, place) => {
      const index = notes.length;
      notes.push(
        note(hand, index, triadNote(type, tonic, position), {
          direction: chord <= top ? 'up' : 'down',
          // The top chord's last note: the run turns after it.
          turn: chord === top && place === 3,
          degree: place,
          pattern: true,
        }),
      );
    });
  });
  notes.push(
    note(hand, notes.length, triadNote(type, tonic, 0), {
      direction: 'down',
      degree: 0,
      pattern: true,
    }),
  );
  return notes;
}

/** A note name as the transcription writes it: `C4`, `F#3`, `Bb2`. */
export function parseNoteName(name: string): SpelledPitch {
  const match = /^([A-G])(##|#|bb|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`not a note: ${name}`);
  const alter = { '##': 2, '#': 1, '': 0, b: -1, bb: -2 }[match[2] ?? '']!;
  return { step: match[1] as Letter, alter, octave: Number(match[3]) };
}

/** A hand's bars as the data module writes them: bars split by `|`, steps by spaces. */
export function barsOf(text: string): string[][] {
  return text.split('|').map((bar) => bar.trim().split(/\s+/));
}

/**
 * Hanon's exercise as printed, one hand: the ascending half's bars, the descending half's and the
 * closing bar. Each bar is the group moved a step on, so a note's degree is its place in the bar;
 * the run turns after the last ascending bar. The fingering is his, where he prints it: from the
 * third bar he prints only the fingers the exercise trains, and the other notes have none.
 */
function hanonRun(h: HanonPartOne, hand: Hand): ScaleNote[] {
  const bars = barsOf(hand === 'right' ? h.right : h.left);
  const fingers = (hand === 'right' ? h.rightFingers : h.leftFingers)
    .split('|')
    .map((bar) => bar.trim());
  const notes: ScaleNote[] = [];
  let index = 0;
  bars.forEach((bar, b) => {
    bar.forEach((step, place) => {
      const printed = fingers[b]?.[place];
      const direction: Direction = b < h.up ? 'up' : 'down';
      // A step is a note, or a chord's keys joined by `+` (No. 20 closes on one), lowest first.
      for (const name of step.split('+'))
        notes.push(
          note(hand, index, parseNoteName(name), {
            direction,
            turn: b === h.up - 1 && place === bar.length - 1,
            degree: place,
            pattern: true,
            finger: printed === undefined || printed === '.' ? null : Number(printed),
          }),
        );
      index++;
    });
  });
  return notes;
}

/** The chord members of a seventh, in semitones from its root. */
const SEVENTHS = { diminishedSevenths: [0, 3, 6, 9], dominantSevenths: [0, 4, 7, 10] } as const;

/** How many times each key is struck in a row: No. 44 in threes, No. 45 in twos, No. 47 in fours. */
const REPEAT_GROUP: Record<number, number> = { 44: 3, 45: 2, 47: 4 };

/** What a note's degree is in each of Hanon's later plates (see `plateRun`). */
function plateDegree(e: ScaleExercise & { type: TechniqueType }): PlateDegree {
  switch (e.type) {
    case 'diminishedSevenths':
    case 'dominantSevenths':
      return { kind: 'chord', root: tonicAt(e.tonic), intervals: SEVENTHS[e.type] };
    case 'repeatedNotes':
      return { kind: 'repeat', group: REPEAT_GROUP[plateOf(e)!.number] ?? 1 };
    case 'trill':
      return { kind: 'trill' };
    case 'thirds':
      return e.variant === 'chromatic'
        ? { kind: 'chromatic', tonic: tonicAt('C') }
        : { kind: 'scale', tonic: tonicAt('C') };
    default:
      return { kind: 'scale', tonic: tonicAt(e.tonic) };
  }
}

/** A tonic as a pitch (its octave does not matter to a degree). */
function tonicAt(tonic: Tonic): SpelledPitch {
  const match = /^([A-G])(#|b)?$/.exec(tonic);
  if (!match) throw new Error(`not a tonic: ${tonic}`);
  return {
    step: match[1] as Letter,
    alter: match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0,
    octave: 4,
  };
}

/**
 * A trill on a pair of fingers: the tonic and the next degree of its major scale, lower key
 * first, sixteen sixteenths a bar for `bars` bars and the tonic to close; the right hand from the
 * tonic at or above C4, the left an octave lower with the mirror fingers (1 for 5, 2 for 4). The
 * fingers are the pair chosen, so every note has one, written at the start of each bar.
 */
function pairTrill(e: ScaleExercise, hand: Hand, lower: number, upper: number, bars: number) {
  const tonic = startingTonics(e)[hand];
  const second = scaleDegree('major', tonic, 1);
  const fingers = hand === 'right' ? [lower, upper] : [6 - lower, 6 - upper];
  const count = 16 * bars;
  const notes: ScaleNote[] = [];
  for (let index = 0; index <= count; index++) {
    const place = index === count ? 0 : index % 2;
    notes.push(
      note(hand, index, place === 0 ? tonic : second, {
        direction: 'up',
        degree: place,
        pattern: true,
        finger: fingers[place]!,
        ...(index % 16 > 1 && { unmarked: true as const }),
      }),
    );
  }
  return notes;
}

/** Each hand's notes of a technique exercise; empty for a hand not played. */
export function techniqueNotes(e: ScaleExercise & { type: TechniqueType }): {
  right: ScaleNote[];
  left: ScaleNote[];
} {
  const run = (hand: Hand): ScaleNote[] => {
    if (e.hands !== 'both' && e.hands !== hand) return [];
    if (e.type === 'hanon') return hanonRun(hanonPartOne(e.variant), hand);
    if (e.type === 'trill') {
      const form = trillForm(e.variant);
      if (!form.hanon) return pairTrill(e, hand, form.lower, form.upper, form.bars);
    }
    const plate = plateOf(e);
    if (plate) return plateRun(partsOf(plate.number, plate.part), hand, plateDegree(e));
    const tonic = startingTonics(e)[hand];
    switch (e.type) {
      case 'majorFiveFinger':
      case 'minorFiveFinger':
        return fiveFinger(e.type, hand, tonic);
      case 'majorChords':
      case 'minorChords':
        return blockChords(e.type, hand, tonic, e.octaves);
      case 'majorBrokenChords':
      case 'minorBrokenChords':
        return brokenChords(e.type, hand, tonic, e.octaves);
      default:
        throw new Error(`no notes for ${e.type}`);
    }
  };
  return { right: run('right'), left: run('left') };
}

/** Whether the exercise strikes several keys at once in a hand (its steps are chords). */
export function hasChords(type: string): boolean {
  return type === 'majorChords' || type === 'minorChords';
}
