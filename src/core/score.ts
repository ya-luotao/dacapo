// A piece as the rest of the app sees it: measures and note events in integer ticks, parsed once
// from MusicXML (musicxml.ts). The renderer only draws; everything that counts or compares uses
// this model.

import type { Letter } from './note.ts';
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
}

export interface TempoMark {
  /** Written tick. */
  tick: number;
  /** Quarter notes per minute. */
  bpm: number;
}

/** Which hand plays each staff, keyed by `staffKey`; null: not practised. */
export type StaffHands = Readonly<Record<string, Hand | null>>;

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
  /** Sorted by onset, then staff, then pitch. Grace notes, rests and unpitched notes are absent. */
  notes: ScoreNote[];
  tempos: TempoMark[];
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
}

/** Steps for a hand selection in play order. Onsets with only tied notes are no step. */
export function buildSteps(
  score: Score,
  hands: HandSelection,
  order: readonly PlayedMeasure[] = performanceOrder(score.measures),
): Step[] {
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
      });
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
