// Hanon's later technique exercises as printed (S7): the sevenths (Nos. 42 and 43), the repeated
// notes (Nos. 44, 45 and 47), the trill (No. 46), the thirds (No. 50) and the octaves (Nos. 51 and
// 53), from the transcription in hanonTechnique.ts. A part is one exercise as the page offers it
// (a section of No. 42, a fingering of No. 45, a key of No. 53); its notes, bars and digits are
// his. See docs/SCALES.md, "Technique" and "Clarifications (decided during S7)".

import { HANON_PARTS, type HanonPart } from './hanonTechnique.ts';
import { midiOf } from './musicxml.ts';
import { LETTERS } from './note.ts';
import type { Direction, ScaleNote } from './scaleTypes.ts';
import type { Hand, SpelledPitch } from './score.ts';

/** Every part of an exercise, in the order printed, the close left out. */
export function plateParts(number: number): HanonPart[] {
  return HANON_PARTS.filter((p) => p.number === number && p.part !== 'close');
}

/**
 * The parts a run of the exercise plays: the part, and after the last part of the exercise its
 * closing bar (No. 42's close follows its last section, No. 45's its sixth fingering).
 */
export function partsOf(number: number, part: string): HanonPart[] {
  const parts = plateParts(number);
  const found = parts.find((p) => p.part === part);
  if (!found) throw new Error(`no part ${part} of Hanon No. ${number}`);
  const close = HANON_PARTS.find((p) => p.number === number && p.part === 'close');
  return close && parts.at(-1) === found ? [found, close] : [found];
}

/** A step as the data writes it: a note `C4`, or a chord's keys joined by `+`, lowest first. */
function parseStep(step: string): SpelledPitch[] {
  return step.split('+').map((name) => {
    const match = /^([A-G])(bb|b|##|#|x)?(-?\d)$/.exec(name);
    if (!match) throw new Error(`not a note: ${name}`);
    const alter = { bb: -2, b: -1, '': 0, '#': 1, '##': 2, x: 2 }[match[2] ?? '']!;
    return { step: match[1] as SpelledPitch['step'], alter, octave: Number(match[3]) };
  });
}

/** One hand's steps of the parts, bar by bar, with their printed digits (per key, or null). */
export function partSteps(
  parts: readonly HanonPart[],
  hand: Hand,
): { bar: number; keys: SpelledPitch[]; fingers: (number | null)[] }[] {
  const out: { bar: number; keys: SpelledPitch[]; fingers: (number | null)[] }[] = [];
  let bar = 0;
  for (const part of parts) {
    const bars = (hand === 'right' ? part.right : part.left).split('|');
    const fingers = (hand === 'right' ? part.rightFingers : part.leftFingers).split('|');
    bars.forEach((text, b) => {
      const steps = text.trim().split(/\s+/);
      const digits = fingers[b]!.trim().split(/\s+/);
      if (digits.length !== steps.length)
        throw new Error(`Hanon No. ${part.number} ${part.part}: digits off in bar ${b + 1}`);
      steps.forEach((step, s) => {
        const keys = parseStep(step);
        const printed = [...digits[s]!];
        if (printed.length !== keys.length)
          throw new Error(`Hanon No. ${part.number} ${part.part}: a digit per key, bar ${b + 1}`);
        out.push({
          bar,
          keys,
          fingers: printed.map((d) => (d === '.' ? null : Number(d))),
        });
      });
      bar++;
    });
  }
  return out;
}

/**
 * How long each step lasts, in divisions of `perBeat` to the quarter: every step of a bar the same
 * (a bar's steps fill it), so a closing bar of one step lasts the bar. Both hands step together.
 */
export function partDurations(parts: readonly HanonPart[]): {
  perBeat: number;
  beatsPerBar: number;
  durations: number[];
  /** Divisions of rest after the last step (the last part's closing rest), else 0. */
  restAfter: number;
} {
  const { perBeat, beats } = parts[0]!;
  if (parts.some((p) => p.perBeat !== perBeat || p.beats !== beats))
    throw new Error(`Hanon No. ${parts[0]!.number}: parts in different metres`);
  if (parts.slice(0, -1).some((p) => p.rest))
    throw new Error(`Hanon No. ${parts[0]!.number}: a rest before the last part's end`);
  const bar = perBeat * beats;
  const restAfter = parts.at(-1)!.rest ?? 0;
  const durations: number[] = [];
  parts.forEach((part, p) => {
    const bars = part.right.split('|');
    bars.forEach((text, b) => {
      const steps = text.trim().split(/\s+/).length;
      // The last bar's steps share what its closing rest leaves.
      const sounding = p === parts.length - 1 && b === bars.length - 1 ? bar - restAfter : bar;
      if (sounding % steps !== 0)
        throw new Error(`Hanon No. ${part.number}: ${steps} steps in a bar`);
      for (let s = 0; s < steps; s++) durations.push(sounding / steps);
    });
  });
  return { perBeat, beatsPerBar: beats, durations, restAfter };
}

/** What a note's degree says in each kind of exercise (for its places over runs). */
export type PlateDegree =
  | { kind: 'chord'; root: SpelledPitch; intervals: readonly number[] }
  | { kind: 'repeat'; group: number }
  | { kind: 'trill' }
  | { kind: 'scale'; tonic: SpelledPitch }
  | { kind: 'chromatic'; tonic: SpelledPitch };

/**
 * One hand's run of the parts. The run turns at its highest step (the last going up); a trill,
 * which neither rises nor falls, goes one way and never turns. A note's degree: in a seventh, its
 * place in the chord (0 the root … 3 the seventh); in repeated notes, its place in the repeats of
 * one key, as a pattern; in a trill, 0 for the lower key of the bar's two and 1 for the upper, as a
 * pattern; in thirds and octaves, the scale degree (or the semitone from the tonic, chromatic) of
 * the step's lowest key. The digits are his, where he prints them.
 */
export function plateRun(
  parts: readonly HanonPart[],
  hand: Hand,
  degree: PlateDegree,
): ScaleNote[] {
  const steps = partSteps(parts, hand);
  const lowest = steps.map((s) => midiOf(s.keys[0]!));
  const turn = degree.kind === 'trill' ? -1 : lowest.indexOf(Math.max(...lowest));
  const notes: ScaleNote[] = [];
  let repeat = 0;
  steps.forEach((step, index) => {
    const direction: Direction = degree.kind === 'trill' || index <= turn ? 'up' : 'down';
    if (degree.kind === 'repeat')
      repeat = index > 0 && lowest[index] === lowest[index - 1] ? repeat + 1 : 0;
    const barKeys = steps.filter((s) => s.bar === step.bar).map((s) => midiOf(s.keys[0]!));
    step.keys.forEach((pitch, k) => {
      const midi = midiOf(pitch);
      let d = 0;
      switch (degree.kind) {
        case 'chord': {
          const semitones = (((midi - midiOf(degree.root)) % 12) + 12) % 12;
          d = Math.max(0, degree.intervals.indexOf(semitones));
          break;
        }
        case 'repeat':
          d = repeat % degree.group;
          break;
        case 'trill':
          d = midi === Math.min(...barKeys) ? 0 : 1;
          break;
        case 'scale': {
          const lowestKey = step.keys[0]!;
          d =
            (((LETTERS.indexOf(lowestKey.step) - LETTERS.indexOf(degree.tonic.step)) % 7) + 7) % 7;
          break;
        }
        case 'chromatic':
          d = (((midiOf(step.keys[0]!) - midiOf(degree.tonic)) % 12) + 12) % 12;
          break;
      }
      notes.push({
        hand,
        index,
        pitch,
        midi,
        finger: step.fingers[k] ?? null,
        direction,
        turn: index === turn,
        degree: d,
        crossing: null,
        ...((degree.kind === 'repeat' || degree.kind === 'trill') && { pattern: true as const }),
      });
    });
  });
  return notes;
}
