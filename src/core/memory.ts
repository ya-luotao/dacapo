// Memorising a piece (docs/PIECES.md, "Memorising"): the score fades in stages, bar by bar, and
// the player plays on in wait mode. A phrase is four bars, or less where the score itself marks a
// section (a double bar, a repeat sign, a volta or a rehearsal mark); a key played wrong in a
// hidden bar, or a peek at it, is a prompt.

import { TICKS_PER_QUARTER, type Measure } from './score.ts';

/** How much of the score is shown, from all of it to nothing but the first bar. */
export const MEMORY_STAGES = ['all', 'alternate', 'phrases', 'first'] as const;
export type MemoryStage = (typeof MEMORY_STAGES)[number];

export function isMemoryStage(value: unknown): value is MemoryStage {
  return (MEMORY_STAGES as readonly unknown[]).includes(value);
}

/** Bars in a phrase when the score marks nothing shorter. */
export const PHRASE_BARS = 4;
/** How long a wrong key shows the step's notes. */
export const PROMPT_SHOW_MS = 1500;
/** How long "Start anywhere" shows the bar it starts from. */
export const START_SHOW_MS = 2000;

type Bars = readonly Pick<
  Measure,
  'index' | 'duration' | 'beats' | 'beatType' | 'repeat' | 'doubleBar' | 'rehearsal'
>[];

/** The first bar, when it is shorter than its time signature: an upbeat, part of the first phrase. */
export function isPickup(measures: Bars, index: number): boolean {
  const m = measures[index];
  if (index !== 0 || !m || measures.length < 2) return false;
  const nominal = (m.beats * 4 * TICKS_PER_QUARTER) / m.beatType;
  return m.duration < nominal;
}

/** Whether a section of the score begins at written bar `index`. */
function sectionStart(measures: Bars, index: number): boolean {
  if (index === 0) return true;
  const m = measures[index]!;
  const before = measures[index - 1]!;
  if (before.doubleBar || before.repeat.backwardTimes !== null) return true;
  if (m.repeat.forward || m.rehearsal) return true;
  // A volta begins.
  return m.repeat.ending.length > 0 && m.repeat.ending.join() !== before.repeat.ending.join();
}

/**
 * The written bars that begin a phrase: every section's first bar (after an upbeat, the bar after
 * it) and every fourth bar after it within the section.
 */
export function phraseStarts(measures: Bars): number[] {
  const starts: number[] = [];
  let count = 0;
  for (let i = 0; i < measures.length; i++) {
    if (isPickup(measures, i)) continue;
    if (sectionStart(measures, i) || (i === 1 && isPickup(measures, 0))) count = 0;
    if (count % PHRASE_BARS === 0) starts.push(i);
    count++;
  }
  return starts;
}

/**
 * The written bars hidden at a stage, for a run whose first bar is `first`: every other bar of
 * each phrase, all but each phrase's first, or all but the first. The run's first bar is always
 * shown (and the bar after an upbeat with it), and an upbeat with its phrase's first bar.
 */
export function hiddenBars(measures: Bars, stage: MemoryStage, first: number): Set<number> {
  const hidden = new Set<number>();
  if (stage === 'all') return hidden;
  const starts = phraseStarts(measures);
  const shown = new Set<number>([first]);
  if (isPickup(measures, first)) shown.add(first + 1);
  let phrase = -1;
  for (let i = 0; i < measures.length; i++) {
    if (starts.includes(i)) phrase = i;
    const start = phrase === i;
    if (isPickup(measures, i)) {
      if (stage !== 'first') shown.add(i);
      continue;
    }
    if (stage === 'alternate' && (i - phrase) % 2 === 0) shown.add(i);
    if (stage === 'phrases' && start) shown.add(i);
  }
  for (let i = 0; i < measures.length; i++) if (!shown.has(i)) hidden.add(i);
  return hidden;
}

/** The prompts of a run, per written bar (passes together), most first. */
export interface BarPrompts {
  measure: number;
  prompts: number;
}

export function promptsByBar(
  records: readonly { measure: number; prompts?: number }[],
): BarPrompts[] {
  const bars = new Map<number, number>();
  for (const r of records)
    if (r.prompts) bars.set(r.measure, (bars.get(r.measure) ?? 0) + r.prompts);
  return [...bars]
    .map(([measure, prompts]) => ({ measure, prompts }))
    .sort((a, b) => b.prompts - a.prompts || a.measure - b.measure);
}

/**
 * Where "Start anywhere" starts: a phrase start among `candidates` (the written bars of the run's
 * span), not `current` when there is another, chosen by `random` in [0, 1).
 */
export function randomPhraseStart(
  measures: Bars,
  candidates: readonly number[],
  current: number,
  random: () => number = Math.random,
): number | null {
  const inSpan = new Set(candidates);
  const starts = phraseStarts(measures).filter((s) => inSpan.has(s));
  const others = starts.length > 1 ? starts.filter((s) => s !== current) : starts;
  if (others.length === 0) return null;
  return others[Math.min(others.length - 1, Math.floor(random() * others.length))]!;
}
