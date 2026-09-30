import { slotOf, type BeatSlot } from '../../core/expression.ts';
import type { PieceFormat } from './format.ts';

// The x axis the Expression charts share: the run's beats in the order played, round after round,
// with the bar numbers above them.

export const CHART_WIDTH = 640;
export const CHART_LEFT = 36;
export const CHART_RIGHT = 8;
/** Bar numbers at least this far apart (in the chart's units), and never over the one before. */
const LABEL_GAP = 26;

/** About how wide a label is at the chart's 11px: CJK characters twice a Latin one. */
export function textWidth(text: string): number {
  let width = 0;
  for (const c of text) width += c.codePointAt(0)! >= 0x2e80 ? 11 : 6;
  return width;
}

export function createBarGrid(slots: readonly BeatSlot[], format: PieceFormat) {
  const plotWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const unit = plotWidth / Math.max(1, slots.length);
  /** The left edge of slot `i`, and its centre. */
  const x = (i: number) => CHART_LEFT + i * unit;
  const cx = (i: number) => CHART_LEFT + (i + 0.5) * unit;

  /** x of a performance tick in a round; null outside the beats played. */
  const xAt = (round: number, tick: number) => {
    const i = slotOf(slots, round, tick);
    if (i < 0) return null;
    const s = slots[i]!;
    return x(i + (tick - s.tick) / s.length);
  };
  /** The end of a span: its last tick's place, or the right edge when it runs past the beats. */
  const xEnd = (round: number, tick: number) => {
    const inside = xAt(round, tick);
    if (inside !== null) return inside;
    const last = slots.findLastIndex((s) => s.round === round);
    return last >= 0 && tick > slots[last]!.tick ? x(last + 1) : null;
  };

  const rounds = [...new Set(slots.map((s) => s.round))];
  /** Slot indices where a bar begins, and where it ends (exclusive). */
  const bars = slots.flatMap((s, i) => (s.beat === 0 || i === 0 ? [i] : []));
  const barEnd = (i: number) => {
    const s = slots[i]!;
    const end = slots.findIndex((o, k) => k > i && (o.beat === 0 || o.round !== s.round));
    return end < 0 ? slots.length : end;
  };
  /** The bars whose number is drawn: each clear of the one before. */
  const labelled = new Set<number>();
  let labelEnd = -Infinity;
  for (const i of bars) {
    if (x(i) < labelEnd) continue;
    labelled.add(i);
    labelEnd = x(i) + Math.max(LABEL_GAP, textWidth(format.barShort(slots[i]!.measure)) + 8);
  }
  /** A bar that starts a later round of a loop. */
  const newRound = (i: number) => slots[i]!.round > 0 && slots[i - 1]?.round !== slots[i]!.round;

  return { slots, plotWidth, unit, x, cx, xAt, xEnd, rounds, bars, barEnd, labelled, newRound };
}

export type BarGrid = ReturnType<typeof createBarGrid>;
