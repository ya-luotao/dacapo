// Where the metronome clicks: on every beat of the bars played, the first beat of a bar accented,
// following the time signature and the tempo marks, and a one-bar count-in before the start.

import type { PlaySpan, Timeline } from './playback.ts';
import type { PlayedMeasure } from './repeats.ts';
import { TICKS_PER_QUARTER, type Measure, type Score } from './score.ts';

export interface Click {
  /** Milliseconds from the start of the span (negative in the count-in). */
  at: number;
  /** The first beat of a bar. */
  accent: boolean;
}

/**
 * Compound meters (6/8, 9/8, 12/8, 6/16 …) click the dotted beat: that is the beat a conductor
 * gives and a player counts. Clicking every eighth would make 6/8 sound like 3/4 and crowd the ear
 * at a normal tempo.
 */
export function isCompound(m: Pick<Measure, 'beats' | 'beatType'>): boolean {
  return m.beatType >= 8 && m.beats > 3 && m.beats % 3 === 0;
}

/** Ticks per click, and per full bar, in the measure's time signature. */
export function beatTicks(m: Pick<Measure, 'beats' | 'beatType'>): { beat: number; bar: number } {
  const unit = (4 * TICKS_PER_QUARTER) / m.beatType;
  return { beat: isCompound(m) ? unit * 3 : unit, bar: unit * m.beats };
}

/**
 * Where a bar's own beats begin: a short first bar is a pickup, so its beats line up with the end
 * of a full bar (a one-beat pickup in 3/4 is beat 3). Any other short bar counts from its start.
 */
function barOffset(m: Pick<Measure, 'index' | 'duration' | 'beats' | 'beatType'>): number {
  const { bar } = beatTicks(m);
  return m.index === 0 && m.duration < bar ? bar - m.duration : 0;
}

/** Clicks of the played measures `first`–`last` of the order, in ms from `zero`. */
export function clicks(
  score: Pick<Score, 'measures'>,
  order: readonly PlayedMeasure[],
  first: number,
  last: number,
  ms: Timeline,
  zero: number,
): Click[] {
  const out: Click[] = [];
  for (let p = first; p <= last; p++) {
    const played = order[p]!;
    const measure = score.measures[played.measure]!;
    const { beat } = beatTicks(measure);
    const offset = barOffset(measure);
    for (let pos = Math.ceil(offset / beat) * beat; pos - offset < measure.duration; pos += beat) {
      out.push({ at: ms(played.start + pos - offset) - zero, accent: pos === 0 });
    }
  }
  return out;
}

/**
 * The count-in: one full bar in the start bar's time signature and tempo, ending on the start
 * bar's downbeat. A pickup also gets the beats before it, so the meter runs on without a hitch
 * ("1 2 3 | 1 2" and the pickup comes on 3).
 */
export function countIn(
  score: Pick<Score, 'measures'>,
  order: readonly PlayedMeasure[],
  span: Pick<PlaySpan, 'start' | 'startTick'>,
  ms: Timeline,
  zero: number,
): Click[] {
  const measure = score.measures[order[span.start]!.measure]!;
  const { beat, bar } = beatTicks(measure);
  const offset = barOffset(measure);
  const start = ms(span.startTick) - zero;
  // The tempo at the start, held through the count-in.
  const msPerTick = (ms(span.startTick + beat) - ms(span.startTick)) / beat;
  const out: Click[] = [];
  for (let pos = 0; pos < bar + offset; pos += beat) {
    const at = start - (bar + offset - pos) * msPerTick;
    out.push({ at: Math.round(at * 1000) / 1000, accent: pos === 0 || pos === bar });
  }
  return out;
}
