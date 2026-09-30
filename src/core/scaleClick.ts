// Scales with the click: the scale is a Score, so it is played as rhythm mode plays a piece — a
// one-bar count-in, the click on every beat, each note due at its place on the grid — and its keys
// are matched to that grid by rhythm mode's own plan and matcher (rhythm.ts), unchanged. The
// timing against the click is recomputed from the run's raw keys and the grid its record keeps, so
// what is shown after a run and what a stored run gives are the same by construction. See
// docs/SCALES.md, "With the click" and "Clarifications (decided during S4)".

import type { PlayedNote } from './evenness.ts';
import { baseTempo } from './playback.ts';
import { playOrder } from './repeats.ts';
import { createMatcher, rhythmPlan, type RhythmPlan, type StepTiming } from './rhythm.ts';
import { buildSteps, type HandSelection, type Score } from './score.ts';

/** The spec's range for the click: ♩ = 40–160. */
export const CLICK_MIN_BPM = 40;
export const CLICK_MAX_BPM = 160;
export const NOTES_PER_BEAT = [2, 3, 4] as const;
/** 2: eighths, 3: triplet eighths, 4: sixteenths (the drawing follows, see scaleXml.ts). */
export type NotesPerBeat = (typeof NOTES_PER_BEAT)[number];

/** What the player sets: the tempo of the beat and how many notes go to it. */
export interface ClickSettings {
  bpm: number;
  perBeat: NotesPerBeat;
}

/** The grid of a clicked run, as its record keeps it: enough to match its keys again. */
export interface ScaleClick extends ClickSettings {
  /** Taken off every key: the calibrated latency when the run was played, ms. */
  latency: number;
  /** When the first note was due, on the run's clock (ms from its first key; negative: before). */
  zero: number;
  /** When Stop ended the run, on the run's clock; null when it ran to its end. */
  stoppedAt: number | null;
}

export function isClickTempo(bpm: unknown): bpm is number {
  return (
    typeof bpm === 'number' && Number.isInteger(bpm) && bpm >= CLICK_MIN_BPM && bpm <= CLICK_MAX_BPM
  );
}

export function isNotesPerBeat(value: unknown): value is NotesPerBeat {
  return (NOTES_PER_BEAT as readonly unknown[]).includes(value);
}

/**
 * The scale in time: its score (drawn with `perBeat` notes to the beat, so each beat of the score
 * is a click) at `bpm` quarter notes a minute, both hands' keys of a place due together. The
 * count-in is rhythm mode's: one full bar (four clicks, the scale's bars being 4/4) ending where
 * the first note is due.
 */
export function scaleRhythmPlan(
  score: Score,
  hands: HandSelection,
  bpm: number,
): RhythmPlan | null {
  const order = playOrder(score.measures, 'play');
  return rhythmPlan({
    score,
    order,
    steps: buildSteps(score, hands, order),
    loop: null,
    startBar: 0,
    scale: bpm / baseTempo(score),
  });
}

/**
 * The run's keys against the grid, as rhythm mode's matcher took them while it was played: each
 * key's onset brought onto the plan's clock (the grid's zero and the latency taken off), the steps
 * settled in order. A run that ran to its end settles every step (a note never played is missed);
 * a stopped one drops the steps not yet due when it stopped.
 */
export function clickTimings(
  plan: RhythmPlan,
  keys: readonly Pick<PlayedNote, 'midi' | 'on'>[],
  click: Pick<ScaleClick, 'latency' | 'zero' | 'stoppedAt'>,
): StepTiming[] {
  const matcher = createMatcher(plan);
  const at = (runTime: number) => runTime - click.zero - click.latency;
  const out: StepTiming[] = [];
  for (const key of keys) {
    const time = at(key.on);
    // Live, the run looks at the clock every 25 ms: the steps closed by now are settled first.
    out.push(...matcher.advance(time));
    matcher.play(key.midi, time);
  }
  out.push(...matcher.finish(click.stoppedAt === null ? Infinity : at(click.stoppedAt)));
  return out;
}
