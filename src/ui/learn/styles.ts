import { performanceOrder } from '../../core/repeats.ts';
import type { Score } from '../../core/score.ts';
import type { BuiltInId } from '../../pieces/library/index.ts';

// The periods, the library's composers and the forms of a few of its pieces, for the lesson on
// styles and forms.

export type Period = 'baroque' | 'classical' | 'romantic' | 'modern';
export const PERIODS: readonly Period[] = ['baroque', 'classical', 'romantic', 'modern'];

/** Roughly, as the periods are usually dated; they overlap at their edges. */
export const PERIOD_SPANS: Readonly<Record<Period, readonly [number, number]>> = {
  baroque: [1600, 1750],
  classical: [1750, 1820],
  romantic: [1820, 1900],
  modern: [1890, 1950],
};

export type ComposerId =
  'petzold' | 'bach' | 'beethoven' | 'burgmuller' | 'chopin' | 'schumann' | 'tchaikovsky' | 'satie';

export interface Composer {
  id: ComposerId;
  born: number;
  died: number;
  period: Period;
}

/** The composers of the library's pieces, by birth. */
export const COMPOSERS: readonly Composer[] = [
  { id: 'petzold', born: 1677, died: 1733, period: 'baroque' },
  { id: 'bach', born: 1685, died: 1750, period: 'baroque' },
  { id: 'beethoven', born: 1770, died: 1827, period: 'classical' },
  { id: 'burgmuller', born: 1806, died: 1874, period: 'romantic' },
  { id: 'chopin', born: 1810, died: 1849, period: 'romantic' },
  { id: 'schumann', born: 1810, died: 1856, period: 'romantic' },
  { id: 'tchaikovsky', born: 1840, died: 1893, period: 'romantic' },
  { id: 'satie', born: 1866, died: 1925, period: 'modern' },
];

export type FormName = 'period' | 'binary' | 'songForm' | 'rondoSection';

export interface FormSpec {
  piece: BuiltInId;
  /** Quarter notes a minute to play it at. */
  bpm: number;
  /** The written bar (as printed) each section starts on, and its letter. */
  starts: Readonly<Record<string, string>>;
}

export const FORMS: Readonly<Record<FormName, FormSpec>> = {
  // Two phrases, a question and its answer, then a new phrase and the answer again.
  period: {
    piece: 'beethoven-ode-to-joy',
    bpm: 108,
    starts: { 1: 'a', 5: 'a′', 9: 'b', 13: 'a′' },
  },
  // Two halves, each repeated.
  binary: { piece: 'petzold-minuet-in-g', bpm: 126, starts: { 1: 'A', 17: 'B' } },
  // a a b a, from its upbeat.
  songForm: {
    piece: 'tchaikovsky-old-french-song',
    bpm: 70,
    starts: { 0: 'a', 9: 'a', 17: 'b', 25: 'a' },
  },
  // Für Elise's A section: ‖: a :‖: b a :‖, the return reached through its link, bars 14–15.
  rondoSection: { piece: 'beethoven-fur-elise', bpm: 66, starts: { 0: 'a', 10: 'b', 16: 'a' } },
};

export interface FormSegment {
  label: string;
  /** Positions in the play order, first and last. */
  first: number;
  last: number;
  /** Written bar numbers of its first and last bar. */
  from: string;
  to: string;
  /** How long it is, in ticks: a bar with an upbeat's few notes counts for less. */
  ticks: number;
}

/**
 * A piece's sections in the order they are played, repeats unrolled: a new one begins each time
 * the playing reaches a bar that starts one.
 */
export function formSegments(
  score: Pick<Score, 'measures'>,
  starts: Readonly<Record<string, string>>,
): FormSegment[] {
  const order = performanceOrder(score.measures);
  const out: FormSegment[] = [];
  order.forEach((played, i) => {
    const { number, duration } = score.measures[played.measure]!;
    const label = starts[number];
    const last = out.at(-1);
    if (label !== undefined || !last) {
      out.push({
        label: label ?? '',
        first: i,
        last: i,
        from: number,
        to: number,
        ticks: duration,
      });
    } else {
      last.last = i;
      last.to = number;
      last.ticks += duration;
    }
  });
  return out;
}
