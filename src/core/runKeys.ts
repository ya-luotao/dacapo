// The keyboard a past run was played on (docs/PERSONAL.md, "The instrument's keys"). A run whose
// hands had a note beyond the keyboard keeps the keyboard on its session (`keys`), and that is
// what a reader goes by. What follows it here is for a session that says notes were played for
// the player (`given`) and has no keyboard (a build from before SYNC_SCHEMA 22 kept it without
// one): which notes they were is read off what the run did keep. In rhythm mode a step's record
// lists the keys that were the player's, so the step's other keys were the app's. In wait and
// memory mode a step is completed only with every key the player has, so a key of a completed
// step that the take has no stroke for was the app's, and so was every key of a step passed.
// From those the keyboard is told as far as the run's own notes go.

import { runSteps } from './expression.ts';
import type { KeyRange } from './instrument.ts';
import { PIANO_HIGHEST, PIANO_LOWEST } from './note.ts';
import type { PieceStep } from './pieceRecords.ts';
import type { RepeatMode } from './repeats.ts';
import type { HandSelection, Score, Step } from './score.ts';
import { TAKE_ON, type TakeEvent } from './takes.ts';
import type { BarLoop } from './wait.ts';

/** What a run showed of its keyboard: keys the player struck, and keys the app played for them. */
export interface KeyEvidence {
  own: ReadonlySet<number>;
  given: ReadonlySet<number>;
}

/**
 * The widest keyboard that has every key the player struck and none of those the app played:
 * from above the highest key given under the player's keys to under the lowest given over them.
 * A key given between two of the player's cannot be (a keyboard has no gap) and is left out.
 * Null when nothing was given outside the player's keys, or the player struck none.
 */
export function keysFrom({ own, given }: KeyEvidence): KeyRange | null {
  if (own.size === 0) return null;
  const lowest = Math.min(...own);
  const highest = Math.max(...own);
  let low = PIANO_LOWEST;
  let high = PIANO_HIGHEST;
  for (const key of given) {
    if (key < lowest) low = Math.max(low, key + 1);
    else if (key > highest) high = Math.min(high, key - 1);
  }
  return low === PIANO_LOWEST && high === PIANO_HIGHEST ? null : { low, high };
}

/**
 * The evidence of a rhythm run's step records (of that run, any order): each record is the step
 * it was settled for, the `n`th of its bar and pass as the run played them (round a loop of one
 * bar, the `n`th again), and the step's keys it does not list were the app's.
 */
export function recordEvidence(steps: readonly Step[], records: readonly PieceStep[]): KeyEvidence {
  const own = new Set<number>();
  const given = new Set<number>();
  const inBar = new Map<string, Step[]>();
  for (const step of steps) {
    const id = `${step.measure}:${step.pass}`;
    const list = inBar.get(id);
    if (list) list.push(step);
    else inBar.set(id, [step]);
  }
  let bar = '';
  let n = 0;
  for (const record of [...records].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const id = `${record.measure}:${record.pass}`;
    n = id === bar ? n + 1 : 0;
    bar = id;
    const list = inBar.get(id);
    const step = list?.[n % list.length];
    if (!step || !record.notes) continue;
    const listed = new Set(record.notes.map((note) => note.midi));
    // Another version of the notes: its keys say nothing of this score's.
    if (![...listed].every((midi) => step.midis.includes(midi))) continue;
    for (const midi of step.midis) (listed.has(midi) ? own : given).add(midi);
  }
  return { own, given };
}

/**
 * The evidence of a take in wait or memory mode: the keys struck on their steps are the
 * player's; of a step the run completed and left (a later stroke is on another step), the keys
 * without a stroke were the app's, and so were the keys of the steps between two that have
 * strokes (within `first`–`last`, round the loop). The last step the take reaches says nothing,
 * since the run may have stopped on it, unless the run was played to its end (`ended`): then it
 * was completed too.
 */
export function takeEvidence(
  steps: readonly Step[],
  events: readonly TakeEvent[],
  first: number,
  last: number,
  ended = false,
): KeyEvidence {
  const own = new Set<number>();
  const given = new Set<number>();
  let current: Step | null = null;
  let struck = new Set<number>();
  const leave = (next: Step) => {
    if (!current) return;
    for (const midi of current.midis) if (!struck.has(midi)) given.add(midi);
    // The steps gone by on the way, round the loop when the next one is earlier.
    const through: number[] = [];
    if (next.index > current.index) {
      for (let i = current.index + 1; i < next.index; i++) through.push(i);
    } else {
      for (let i = current.index + 1; i <= last; i++) through.push(i);
      for (let i = first; i < next.index; i++) through.push(i);
    }
    for (const i of through) for (const midi of steps[i]?.midis ?? []) given.add(midi);
  };
  for (const event of events) {
    if (event[1] !== TAKE_ON) continue;
    const step = steps[event[4]!];
    const key = event[2]!;
    // A key of an ornament names its step too: only the step's own keys count.
    if (!step || !step.midis.includes(key)) continue;
    if (step !== current || struck.has(key)) {
      // Another step, or the same one again (a loop of one step): the one before is left.
      if (step !== current || struck.size === step.midis.length) {
        leave(step);
        current = step;
        struck = new Set();
      }
    }
    struck.add(key);
    own.add(key);
  }
  const reached: Step | null = current;
  if (ended && reached) for (const midi of reached.midis) if (!struck.has(midi)) given.add(midi);
  return { own, given };
}

/** A past run, as its session, its take and its step records give it. */
export interface PastRun {
  score: Score;
  hands: HandSelection;
  repeats: RepeatMode;
  loop: BarLoop | null;
  mode: 'wait' | 'rhythm';
  /** The keyboard the run was played on, as its session has it; absent on 88 keys. */
  keys?: readonly [lowest: number, highest: number];
  /** The notes played for the player, as the session has them; absent or 0: none. */
  given?: number;
  /** Played to the end (the session's `completed`). */
  completed?: boolean;
  events: readonly TakeEvent[];
  /**
   * The run's step records, when they are at hand: a rhythm run's keyboard is told from them,
   * and in wait and memory mode they say which steps were passed.
   */
  records?: readonly PieceStep[];
}

/**
 * The keyboard a past run was played on: the one its session keeps; without one, as far as the
 * run's notes tell. Null for a run with nothing played for the player (every run from before
 * the keyboard could be chosen), and for a rhythm run without a keyboard whose step records
 * are not here.
 */
export function keysOfRun(run: PastRun): KeyRange | null {
  if (run.keys) return { low: run.keys[0], high: run.keys[1] };
  if (!run.given) return null;
  const { steps, first, last } = runSteps(run.score, run.hands, run.repeats, run.loop);
  const recorded = run.records ? recordEvidence(steps, run.records) : null;
  if (run.mode === 'rhythm') return recorded && keysFrom(recorded);
  const ended = Boolean(run.completed) && run.loop === null;
  const taken = takeEvidence(steps, run.events, Math.max(0, first), Math.max(first, last), ended);
  // A step passed has a record that says so: every key of it was the app's.
  return keysFrom({
    own: taken.own,
    given: new Set([...taken.given, ...(recorded?.given ?? [])]),
  });
}
