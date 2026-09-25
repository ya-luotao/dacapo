// Small hand-made scores for the tests of rhythm mode.

import { TICKS_PER_QUARTER, type Hand, type Measure, type Score, type ScoreNote } from './score.ts';

export const Q = TICKS_PER_QUARTER;

export function bar(
  index: number,
  start: number,
  options: {
    beats?: number;
    beatType?: number;
    duration?: number;
    repeat?: Measure['repeat'];
  } = {},
): Measure {
  const beats = options.beats ?? 4;
  const beatType = options.beatType ?? 4;
  return {
    index,
    number: String(index + 1),
    start,
    duration: options.duration ?? (beats * 4 * Q) / beatType,
    beats,
    beatType,
    repeat: options.repeat ?? { forward: false, backwardTimes: null, ending: [] },
    jumps: [],
  };
}

/** `count` bars of 4/4 (or the given meter), one after another. */
export function bars(count: number, beats = 4, beatType = 4): Measure[] {
  const length = (beats * 4 * Q) / beatType;
  return Array.from({ length: count }, (_, i) => bar(i, i * length, { beats, beatType }));
}

export function note(
  measure: number,
  onset: number,
  duration: number,
  midi: number,
  hand: Hand | null = 'right',
): ScoreNote {
  return {
    id: `${measure}-${onset}-${midi}-${hand}`,
    part: hand === null ? 1 : 0,
    measure,
    onset,
    duration,
    midi,
    pitch: { step: 'C', alter: 0, octave: 4 },
    staff: hand === 'left' ? 2 : 1,
    hand,
    voice: '1',
    tieStart: false,
    tieStop: false,
  };
}

export function score(
  measures: Measure[],
  notes: ScoreNote[],
  tempos: Score['tempos'] = [],
): Score {
  notes.sort((a, b) => a.onset - b.onset || a.midi - b.midi);
  return { title: '', composer: '', parts: [], hands: {}, measures, notes, tempos, warnings: [] };
}

/** Quarter notes on every beat of `count` 4/4 bars, the right hand, keys from `keys` in turn. */
export function quarters(count: number, keys: readonly number[] = [60]): ScoreNote[] {
  const notes: ScoreNote[] = [];
  for (let b = 0; b < count; b++) {
    for (let k = 0; k < 4; k++) {
      const n = b * 4 + k;
      notes.push(note(b, n * Q, Q, keys[n % keys.length]!));
    }
  }
  return notes;
}
