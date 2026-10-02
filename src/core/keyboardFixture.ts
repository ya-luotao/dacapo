// For tests of the instrument's keys (docs/PERSONAL.md, "The instrument's keys"): a small piece
// that goes beyond a keyboard of C3–C5 in every way a piece can, and the keyboard itself.

import type { KeyRange } from './instrument.ts';
import { emptyMarkings } from './markings.ts';
import type { Hand, Measure, Score, ScoreNote } from './score.ts';

export const Q = 960;

/** A keyboard of two octaves round middle C, C3–C5: a small controller. */
export const SMALL: KeyRange = { low: 48, high: 72 };

/** The piece's notes: bar (0-based), beat within it (0 or 1), length in beats, key and hand. */
const NOTES: readonly [bar: number, beat: number, beats: number, midi: number, hand: Hand][] = [
  // Bar 1: all on the keyboard.
  [0, 0, 1, 60, 'right'],
  [0, 1, 1, 64, 'right'],
  [0, 0, 2, 48, 'left'],
  // Bar 2: a chord split between the player (G4) and the app (E5), over a bass note held for the
  // bar that the app plays (G2).
  [1, 0, 1, 67, 'right'],
  [1, 0, 1, 76, 'right'],
  [1, 1, 1, 62, 'right'],
  [1, 0, 2, 43, 'left'],
  // Bar 3: nothing for the player (C6, B5; the left hand rests): both steps are passed.
  [2, 0, 1, 84, 'right'],
  [2, 1, 1, 83, 'right'],
  // Bar 4: an accented A5 with a mordent that the app plays, over the player's E3; then a chord.
  [3, 0, 1, 81, 'right'],
  [3, 0, 1, 52, 'left'],
  [3, 1, 1, 60, 'right'],
  [3, 1, 1, 48, 'left'],
  // Bar 5: the close.
  [4, 0, 2, 60, 'right'],
  [4, 0, 2, 48, 'left'],
];

/** The notes of the piece beyond `SMALL`: E5, G2, C6, B5 and A5. */
export const GIVEN_NOTES = 5;
/** Its steps with both hands, and of those the steps with none of the player's keys. */
export const STEPS = 9;
export const PASSED_STEPS = 2;

const measure = (index: number, repeat: Partial<Measure['repeat']> = {}): Measure => ({
  index,
  number: String(index + 1),
  start: index * 2 * Q,
  duration: 2 * Q,
  beats: 2,
  beatType: 4,
  repeat: { forward: false, backwardTimes: null, ending: [], ...repeat },
  jumps: [],
});

/**
 * The piece: five bars of 2/4 at ♩ = 60 for two hands. With `repeat`, bars 2–3 are played twice
 * (`|:` at bar 2, `:|` at bar 3).
 */
export function keyboardScore(repeat = false): Score {
  const notes = NOTES.map(([bar, beat, beats, midi, hand], i): ScoreNote => {
    const mordent = midi === 81;
    return {
      id: `n${i}`,
      part: 0,
      measure: bar,
      onset: (bar * 2 + beat) * Q,
      duration: beats * Q,
      midi,
      pitch: { step: 'C', alter: 0, octave: 4 },
      staff: hand === 'right' ? 1 : 2,
      hand,
      voice: hand === 'right' ? '1' : '2',
      tieStart: false,
      tieStop: false,
      finger: null,
      ...(mordent && {
        articulations: ['accent' as const],
        ornaments: [{ kind: 'mordent' as const, upper: 83, lower: 79 }],
      }),
    };
  });
  notes.sort((a, b) => a.onset - b.onset || a.staff - b.staff || a.midi - b.midi);
  return {
    title: 'Beyond the keyboard',
    composer: '',
    parts: [],
    hands: { '0.1': 'right', '0.2': 'left' },
    measures: [0, 1, 2, 3, 4].map((index) =>
      measure(
        index,
        repeat ? (index === 1 ? { forward: true } : index === 2 ? { backwardTimes: 2 } : {}) : {},
      ),
    ),
    notes,
    tempos: [{ tick: 0, bpm: 60 }],
    markings: emptyMarkings(),
    warnings: [],
  };
}
