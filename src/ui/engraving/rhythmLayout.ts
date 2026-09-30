import type { Duration } from './EngravedStaff.tsx';

// The time of a rhythm written on one line (`RhythmLine.tsx`): notes as the lessons spell them,
// placed in ticks, twelve to a quarter note, so that an eighth (6), a sixteenth (3) and an eighth
// of a triplet (4) are all whole numbers; and the counts said under them.

export interface Beat {
  duration: Duration;
  dotted?: boolean;
  rest?: boolean;
  /** Tied to the next note: one sound, held through both; the next is not played again. */
  tie?: boolean;
  /** One of three in the time of two: an eighth of a triplet lasts a third of a beat. */
  triplet?: boolean;
}

/** A time signature, as [beats, beat unit]: [4, 4], [6, 8]. */
export type Time = readonly [number, number];

export const QUARTER = 12;
export const TICKS: Record<Duration, number> = {
  whole: 48,
  half: 24,
  quarter: 12,
  eighth: 6,
  sixteenth: 3,
};

export function ticksOf(b: Beat): number {
  const written = TICKS[b.duration] * (b.dotted ? 1.5 : 1);
  return b.triplet ? (written * 2) / 3 : written;
}

/**
 * How a time signature divides the bar, in ticks: the counts (one per unit of the bottom number)
 * and the beat. In 6/8 the beat is a dotted quarter, three eighths: two beats of three counts.
 */
export interface Meter {
  bar: number;
  /** Ticks per count: a quarter in 4/4, an eighth in 6/8. */
  count: number;
  /** Counts in a bar: the top number. */
  counts: number;
  beat: number;
  compound: boolean;
}

export function meterOf([top, bottom]: Time): Meter {
  const count = (QUARTER * 4) / bottom;
  const compound = bottom === 8 && top % 3 === 0 && top > 3;
  return { bar: top * count, count, counts: top, beat: compound ? 3 * count : count, compound };
}

export interface Placed extends Beat {
  /** Where it starts, in ticks from the start. */
  at: number;
  length: number;
  /** The second half of a tie: it sounds on from the note before, and is not played. */
  held: boolean;
}

export function place(rhythm: readonly Beat[]): Placed[] {
  let at = 0;
  return rhythm.map((b, i) => {
    const length = ticksOf(b);
    const placed = { ...b, at, length, held: !b.rest && Boolean(rhythm[i - 1]?.tie) };
    at += length;
    return placed;
  });
}

/** What a rhythm occupies: its notes placed in ticks, its length, how many bars. */
export function layout(rhythm: readonly Beat[], meter: Meter) {
  const placed = place(rhythm);
  const total = placed.length === 0 ? 0 : placed.at(-1)!.at + placed.at(-1)!.length;
  const bars = Math.max(1, Math.ceil(total / meter.bar - 1e-9));
  return { placed, total, bars };
}

/** How long a struck note sounds: through every note it is tied to. */
export function soundingTicks(placed: readonly Placed[], i: number): number {
  let length = placed[i]!.length;
  for (let j = i; placed[j]?.tie && placed[j + 1] && !placed[j + 1]!.rest; j++) {
    length += placed[j + 1]!.length;
  }
  return length;
}

/** The count said at a tick of a beat, when the beat is divided into `step` ticks. */
function countText(
  meter: Meter,
  tick: number,
  step: number,
  words: { trip: string; let: string },
): string {
  const inBar = tick % meter.bar;
  if (inBar % meter.count === 0) return String(inBar / meter.count + 1);
  if (meter.compound) return '&';
  const offset = inBar % meter.count;
  if (step === 4) return offset === 4 ? words.trip : words.let;
  if (step === 3) return offset === 3 ? 'e' : offset === 6 ? '&' : 'a';
  return '&';
}

/**
 * The counts under a line, beat by beat. Each beat is divided as finely as the notes in it need:
 * "1", "1 &", "1 trip let", "1 e & a" (in 6/8, "1 2 3"). `bracket` counts only what each beat
 * needs and puts the ones not played on in brackets, "1 (2) & 3"; without it every beat of a line
 * with eighths says its "&", as in the first rhythm lesson.
 */
export function countLabels(
  placed: readonly Placed[],
  meter: Meter,
  bars: number,
  bracket: boolean,
  words: { trip: string; let: string },
): { tick: number; text: string; held: boolean }[] {
  const struck = new Set(placed.filter((b) => !b.rest && !b.held).map((b) => b.at));
  const starts = placed.map((b) => b.at);
  const hasEighths = placed.some((b) => b.duration === 'eighth' && !b.triplet);
  const out: { tick: number; text: string; held: boolean }[] = [];
  for (let from = 0; from < bars * meter.bar; from += meter.beat) {
    const offsets = starts.filter((t) => t >= from && t < from + meter.beat).map((t) => t - from);
    const steps = meter.compound ? [meter.beat, meter.count, meter.count / 2] : [12, 6, 4, 3];
    let step = steps.find((s) => offsets.every((o) => o % s === 0)) ?? steps.at(-1)!;
    // Lesson 4's rule: in a line with eighths, every beat of simple time says its "&".
    if (!bracket && hasEighths && step === 12) step = 6;
    if (!bracket && meter.compound) step = Math.min(step, meter.count);
    for (let t = from; t < from + meter.beat; t += step) {
      const text = countText(meter, t, step, words);
      const held = bracket && !struck.has(t);
      out.push({ tick: t, text: held ? `(${text})` : text, held });
    }
  }
  return out;
}
