// A focus loop: a few notes either side of one place of the scale (a crossing named after a run, a
// note of the per-position figures), played round and round until Stop, in wait mode's sense —
// the cursor waits for each step's keys, a wrong key flashes, and after the last step it goes back
// to the first. A drill, not a run: nothing is timed, analysed or recorded (docs/SCALES.md, "After
// a run", and "Clarifications (decided during S4)"). Framework-free, so it is testable.

import type { RunAnalysis } from '../../core/evenness.ts';
import type { ScaleNote } from '../../core/scaleTypes.ts';
import type { Hand, Score } from '../../core/score.ts';

/** Notes either side of the place: seven in all, as a pianist cuts a passage to practise it. */
export const LOOP_SIDE = 3;

/** The place a loop is built round: one note of one hand's run. */
export interface LoopPlace {
  hand: Hand;
  index: number;
}

/** Indexes into each hand's run, inclusive. */
export interface LoopSpan {
  from: number;
  to: number;
}

/**
 * `LOOP_SIDE` notes either side of `index` in a run of `length` notes, shifted at the ends so the
 * loop keeps its length (the first notes of the scale loop from the tonic). Hands together play
 * the same indexes, so one span serves both.
 */
export function loopSpan(length: number, index: number, side = LOOP_SIDE): LoopSpan {
  const size = Math.min(length, 2 * side + 1);
  const from = Math.max(0, Math.min(index - side, length - size));
  return { from, to: from + size - 1 };
}

/** The notes of each hand in the span (a chord's keys all), the right hand's then the left's. */
export function loopNotes(
  notes: Readonly<Record<Hand, readonly ScaleNote[]>>,
  span: LoopSpan,
): ScaleNote[] {
  const cut = (run: readonly ScaleNote[]) =>
    run.filter((n) => n.index >= span.from && n.index <= span.to);
  return [...cut(notes.right), ...cut(notes.left)];
}

/** Steps in a hand's run: its last index and one (a chord is one step). */
export function stepCount(run: readonly Pick<ScaleNote, 'index'>[]): number {
  return run.reduce((a, n) => Math.max(a, n.index + 1), 0);
}

/** A note of a run by hand, step and key: `right:5:64`. */
export const noteKey = (note: Pick<ScaleNote, 'hand' | 'index' | 'midi'>) =>
  `${note.hand}:${note.index}:${note.midi}`;

/**
 * The score's note for each note of the run (`noteKey`): each hand's notes of the score by onset,
 * a chord's lowest first, are its run's in order (scaleXml.test.ts holds it).
 */
export function noteIdsOf(
  score: Pick<Score, 'notes'>,
  notes: Readonly<Record<Hand, readonly ScaleNote[]>>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const hand of ['right', 'left'] as const) {
    const drawn = score.notes
      .filter((n) => n.hand === hand)
      .sort((a, b) => a.onset - b.onset || a.midi - b.midi);
    const run = [...notes[hand]].sort((a, b) => a.index - b.index || a.midi - b.midi);
    run.forEach((note, i) => {
      const id = drawn[i]?.id;
      if (id) out.set(noteKey(note), id);
    });
  }
  return out;
}

export interface LoopState {
  /** The loop's notes, the right hand's then the left's (`loopNotes`). */
  expected: readonly ScaleNote[];
  /** The notes due together, as indexes into `expected`, in order round the loop. */
  steps: readonly (readonly number[])[];
  /** The step waited for. */
  next: number;
  /** Notes of this round played so far, indexes into `expected`. */
  played: readonly number[];
  /** Times round the loop. */
  rounds: number;
  /** The last key that was none of the step's, until the next right one; for a flash. */
  wrongKey: number | null;
}

export function startLoop(expected: readonly ScaleNote[]): LoopState {
  const first = Math.min(...expected.map((n) => n.index));
  const steps: number[][] = [];
  expected.forEach((note, i) => (steps[note.index - first] ??= []).push(i));
  return { expected, steps, next: 0, played: [], rounds: 0, wrongKey: null };
}

/**
 * A key goes down. It takes the step's notes of its key still to play — both, where both hands
 * play the key together (the unison of contrary motion) — or, being none of them, flashes. Only
 * key-downs count, so a key still held from the step before never completes a step.
 */
export function loopKey(state: LoopState, midi: number): LoopState {
  const step = state.steps[state.next] ?? [];
  const hits = step.filter((n) => state.expected[n]!.midi === midi && !state.played.includes(n));
  if (hits.length === 0) return { ...state, wrongKey: midi };
  const played = [...state.played, ...hits];
  if (!step.every((n) => played.includes(n))) return { ...state, played, wrongKey: null };
  const next = state.next + 1;
  if (next < state.steps.length) return { ...state, next, played, wrongKey: null };
  return { ...state, next: 0, played: [], rounds: state.rounds + 1, wrongKey: null };
}

/**
 * The place to loop after a run: of the clearest problem place, the note furthest off; else the
 * first hesitation. Null when the run named no place.
 */
export function weakestPlace(analysis: RunAnalysis): LoopPlace | null {
  const { problem } = analysis;
  if (problem) {
    const hand = analysis.hands.find((h) => h.hand === problem.hand)!;
    let index = problem.indexes[0]!;
    for (const i of problem.indexes)
      if (Math.abs(hand.notes[i]?.deviation ?? 0) > Math.abs(hand.notes[index]?.deviation ?? 0))
        index = i;
    return { hand: problem.hand, index };
  }
  for (const hand of analysis.hands) {
    const first = hand.timing.hesitations[0];
    if (first) return { hand: hand.hand, index: first.index };
  }
  return null;
}
