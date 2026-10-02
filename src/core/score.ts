// A piece as the rest of the app sees it: measures and note events in integer ticks, parsed once
// from MusicXML (musicxml.ts). The renderer only draws; everything that counts or compares uses
// this model.

import { hasKey, isFullKeys, type KeyRange } from './instrument.ts';
import type { Articulation, GraceNote, HarmonyMark, Markings, Ornament } from './markings.ts';
import type { Letter } from './note.ts';
import { ornamentKeys } from './ornaments.ts';
import { performanceOrder, type PlayedMeasure } from './repeats.ts';

/** Ticks per quarter note. 960 = 2^6·3·5 divides every common MusicXML `divisions` value. */
export const TICKS_PER_QUARTER = 960;

export type Hand = 'right' | 'left';
export type HandSelection = Hand | 'both';

/** Written pitch as MusicXML spells it. `alter` may be ±2 (double sharp/flat). */
export interface SpelledPitch {
  step: Letter;
  alter: number;
  octave: number;
}

export interface PartInfo {
  index: number;
  /** The `id` of the `<score-part>`. */
  id: string;
  name: string;
  /** The first `<instrument-name>` of the part, if any. */
  instrument: string;
  /** General MIDI program (1–128) of the first `<midi-instrument>`, if any. */
  program: number | null;
  staves: number;
}

export interface ScoreNote {
  /** Stable within a parse: part, written measure and the note's order among its `<note>`s. */
  id: string;
  part: number;
  /** Written measure index (0-based, document order). */
  measure: number;
  /** Written onset in ticks from the start of the piece, ignoring repeats. */
  onset: number;
  duration: number;
  midi: number;
  pitch: SpelledPitch;
  /** 1-based staff within its part. */
  staff: number;
  /** null: another instrument (a voice, a violin), drawn but not practised. */
  hand: Hand | null;
  voice: string;
  /** This note is tied to the next one of the same pitch. */
  tieStart: boolean;
  /** This note continues a tie: it sounds, but it is not a new key press. */
  tieStop: boolean;
  /** The finger printed for this note (1 = thumb … 5), if the file gives one. */
  finger: number | null;
  /** Its articulations, as printed; absent when none. */
  articulations?: Articulation[];
  /** Its ornaments, as printed; absent when none. */
  ornaments?: Ornament[];
  /** The grace notes leading to it, in order; absent when none. They are no step of their own. */
  graces?: GraceNote[];
}

export interface Repeat {
  /** `|:` at the start of the measure. */
  forward: boolean;
  /** `:|` at the end of the measure; how often the section is played in total (default 2). */
  backwardTimes: number | null;
  /** Volta numbers this measure belongs to (e.g. [1] or [1, 2]); empty if none. */
  ending: number[];
}

export interface Measure {
  index: number;
  /** The printed measure number (`number` attribute), e.g. "0" for a pickup. */
  number: string;
  /** Written start in ticks. */
  start: number;
  duration: number;
  /** Time signature in force. */
  beats: number;
  beatType: number;
  repeat: Repeat;
  /** Navigation the model does not follow (D.C., D.S., Fine, Coda). */
  jumps: string[];
  /** A double or final barline ends it (also one drawn at the next measure's start). */
  doubleBar?: true;
  /** A rehearsal mark at it ("A", "12"). */
  rehearsal?: string;
}

/** A key signature, where the score sets it (docs/HARMONY.md, "Transposing (H4)"). */
export interface KeySignature {
  /** Written measure index. */
  measure: number;
  /** Sharps (+) or flats (−). */
  fifths: number;
  /** The mode the file names (`<mode>`), when it is major or minor. */
  mode: 'major' | 'minor' | null;
}

export interface TempoMark {
  /** Written tick. */
  tick: number;
  /** Quarter notes per minute. */
  bpm: number;
}

/** Which hand plays each staff, keyed by `staffKey`; null: not practised. */
export type StaffHands = Readonly<Record<string, Hand | null>>;

/**
 * What the parser left out or had to guess. `grace-notes` and `ornaments` are no longer reported
 * (both are kept since X0), but pieces imported before still carry them.
 */
export type ScoreWarning =
  | 'finer-than-ticks'
  | 'grace-notes'
  | 'ornaments'
  | 'unknown-step'
  | 'microtones'
  | 'tie-mismatch'
  | 'jumps'
  | 'hands-guessed';

export interface Score {
  title: string;
  composer: string;
  parts: PartInfo[];
  /** The hands in effect: detected, with the piece's override applied. */
  hands: StaffHands;
  measures: Measure[];
  /**
   * Sorted by onset, then staff, then pitch. Rests and unpitched notes are absent, and grace notes
   * are kept on the note they lead to (`ScoreNote.graces`).
   */
  notes: ScoreNote[];
  tempos: TempoMark[];
  /**
   * The key signatures of the practised part (of the first part when none is practised), in
   * written order, each where it changes; absent when the score sets none. They name the piece's
   * key for the Key control and enter neither the steps nor the checksum.
   */
  keys?: KeySignature[];
  /** Dynamics, hairpins, slurs, fermatas and pedal marks (docs/EXPRESSION.md). */
  markings: Markings;
  /**
   * The chord symbols (`<harmony>`) of a lead sheet, sorted by tick, then part and staff; absent
   * when the score has none. They are no notes: nothing is practised or judged from them, and
   * they do not enter the checksum.
   */
  harmonies?: HarmonyMark[];
  /** What the parser left out or had to guess, for the import report. */
  warnings: ScoreWarning[];
}

export function staffKey(part: number, staff: number): string {
  return `${part}.${staff}`;
}

export function inHands(hand: Hand | null, selection: HandSelection): boolean {
  return hand !== null && (selection === 'both' || selection === hand);
}

/** The keys that start together: what wait mode asks for next. */
export interface Step {
  index: number;
  /** Onset in performance ticks. */
  tick: number;
  /** Index into the play order this step belongs to. */
  played: number;
  /** Written measure index, and which pass through it. */
  measure: number;
  pass: number;
  /** Written onset in ticks (the same for every pass). */
  writtenTick: number;
  /** 1-based beat within the measure, in the time signature's beat unit (2.5 = halfway). */
  beat: number;
  /** Keys to press, ascending, without duplicates. */
  midis: number[];
  /** Notes that start here (their heads are the cursor's target). */
  noteIds: string[];
  /** Tied continuations still sounding at this onset: shown, not pressed. */
  heldIds: string[];
  /** The notes here with grace notes or an ornament, and the keys those add; absent when none. */
  ornaments?: StepOrnament[];
  /**
   * The keys here beyond the player's keyboard, ascending, and their notes: the app plays them
   * (docs/PERSONAL.md, "The instrument's keys"). Absent when the step has none. `midis` and
   * `noteIds` are then the player's alone; with none of them left the step is passed.
   */
  given?: number[];
  givenIds?: string[];
}

/** A note of a step with grace notes or an ornament (docs/EXPRESSION.md, "Playing them"). */
export interface StepOrnament {
  noteId: string;
  /** The principal: the note's own key, one of the step's. */
  midi: number;
  /** The other keys its grace notes and ornament play, ascending (`ornamentKeys`). */
  keys: number[];
}

/**
 * Steps for a hand selection in play order. Onsets with only tied notes are no step. On a
 * keyboard with fewer keys (`keys`) the steps are the same ones, each with its keys beyond the
 * keyboard set apart (`given`): a step is never left out, so a step's index means the same on
 * every keyboard.
 */
export function buildSteps(
  score: Score,
  hands: HandSelection,
  order: readonly PlayedMeasure[] = performanceOrder(score.measures),
  keys?: KeyRange | null,
): Step[] {
  const beyond = keys && !isFullKeys(keys) ? (midi: number) => !hasKey(keys, midi) : null;
  const byMeasure = new Map<number, ScoreNote[]>();
  for (const note of score.notes) {
    if (!inHands(note.hand, hands)) continue;
    const list = byMeasure.get(note.measure) ?? [];
    list.push(note);
    byMeasure.set(note.measure, list);
  }
  const steps: Step[] = [];
  order.forEach((played, playedIndex) => {
    const measure = score.measures[played.measure]!;
    const groups = new Map<number, ScoreNote[]>();
    for (const note of byMeasure.get(played.measure) ?? []) {
      const group = groups.get(note.onset) ?? [];
      group.push(note);
      groups.set(note.onset, group);
    }
    for (const [onset, group] of [...groups].sort((a, b) => a[0] - b[0])) {
      const pressed = group.filter((n) => !n.tieStop);
      if (pressed.length === 0) continue;
      const within = onset - measure.start;
      const beatTicks = (4 * TICKS_PER_QUARTER) / measure.beatType;
      const ornaments = pressed.flatMap((n): StepOrnament[] => {
        const keys = ornamentKeys(n);
        return keys.length > 0 ? [{ noteId: n.id, midi: n.midi, keys }] : [];
      });
      steps.push({
        index: steps.length,
        tick: played.start + within,
        played: playedIndex,
        measure: played.measure,
        pass: played.pass,
        writtenTick: onset,
        beat: 1 + within / beatTicks,
        midis: [...new Set(pressed.map((n) => n.midi))].sort((a, b) => a - b),
        noteIds: pressed.map((n) => n.id),
        heldIds: group.filter((n) => n.tieStop).map((n) => n.id),
        ...(ornaments.length > 0 && { ornaments }),
      });
      const step = steps.at(-1)!;
      if (beyond && step.midis.some(beyond)) {
        step.given = step.midis.filter(beyond);
        step.givenIds = pressed.filter((n) => beyond(n.midi)).map((n) => n.id);
        step.midis = step.midis.filter((midi) => !beyond(midi));
        step.noteIds = pressed.filter((n) => !beyond(n.midi)).map((n) => n.id);
      }
    }
  });
  return steps;
}

/** Lowest and highest key the selected hands play, or null when they play nothing. */
export function keyRange(score: Score, hands: HandSelection): [number, number] | null {
  let low = Infinity;
  let high = -Infinity;
  for (const note of score.notes) {
    if (!inHands(note.hand, hands)) continue;
    low = Math.min(low, note.midi);
    high = Math.max(high, note.midi);
  }
  return low === Infinity ? null : [low, high];
}
