import { barTicksOf } from '../../core/rhythmCells.ts';
import type { RhythmExercise } from '../../core/rhythmExercise.ts';
import type { BarBox, BarBoxes, EventBoxes } from '../notation/ScoreView.tsx';

// Where things are on the drawn rhythm line, from what Verovio drew: each note and rest of the
// file in order (ScoreView's event boxes), which the exercise knows the ticks of. Counts, the
// beat cursor and the timings after a run are placed by it; a moment between two drawn notes
// (a beat inside a long note, an extra tap) is placed in proportion between them.

export interface LineGeometry {
  /** The x of a moment (ticks from the start), in the score page's pixels. */
  x: (tick: number) => number;
  /** The bar a moment is drawn in (the final note's bar for anything after the last). */
  barOf: (tick: number) => number;
  /** A line's y in a bar: where its note heads sit. */
  lineY: (line: number, bar: number) => number;
  /** How far a line's notes reach up (stems, beams) and down in a bar. */
  top: (line: number, bar: number) => number;
  bottom: (line: number, bar: number) => number;
  box: (bar: number) => BarBox;
}

/** Null until the drawing is measured, or when it does not hold the exercise's notes. */
export function lineGeometry(
  exercise: RhythmExercise,
  bars: BarBoxes,
  events: EventBoxes,
): LineGeometry | null {
  const barTicks = barTicksOf(exercise.meter);
  const count = exercise.bars + 1;
  const anchors: { tick: number; x: number }[][] = [];
  const lines: { y: number; top: number; bottom: number }[][] = [];
  for (let b = 0; b < count; b++) {
    const box = bars.get(b);
    const staves = events.get(b);
    if (!box || !staves || staves.length < exercise.lines.length) return null;
    const points: { tick: number; x: number }[] = [];
    const perLine: { y: number; top: number; bottom: number }[] = [];
    for (let l = 0; l < exercise.lines.length; l++) {
      const notes = exercise.lines[l]!.filter((n) => Math.floor(n.tick / barTicks) === b);
      const drawn = staves[l]!;
      if (drawn.length !== notes.length || drawn.length === 0) return null;
      notes.forEach((n, i) => {
        const { head } = drawn[i]!;
        points.push({ tick: n.tick - b * barTicks, x: head.left + head.width / 2 });
      });
      const heads = drawn.filter((_, i) => !notes[i]!.rest);
      const y = (heads[0] ?? drawn[0]!).head;
      perLine.push({
        y: y.top + y.height / 2,
        top: Math.min(...drawn.map((d) => d.whole.top)),
        bottom: Math.max(...drawn.map((d) => d.whole.top + d.whole.height)),
      });
    }
    points.sort((p, q) => p.tick - q.tick || p.x - q.x);
    // The next bar starts at the barline (the last bar ends at its own).
    points.push({ tick: barTicks, x: box.left + box.width });
    anchors.push(points);
    lines.push(perLine);
  }
  const barOf = (tick: number) => Math.min(count - 1, Math.max(0, Math.floor(tick / barTicks)));
  return {
    barOf,
    x(tick) {
      const b = barOf(tick);
      const within = Math.min(barTicks, Math.max(0, tick - b * barTicks));
      const points = anchors[b]!;
      let before = points[0]!;
      let after = points.at(-1)!;
      for (const p of points) {
        if (p.tick <= within) before = p;
        if (p.tick > within) {
          after = p;
          break;
        }
      }
      if (after.tick === before.tick) return before.x;
      return (
        before.x + ((after.x - before.x) * (within - before.tick)) / (after.tick - before.tick)
      );
    },
    lineY: (line, bar) => lines[bar]![line]!.y,
    top: (line, bar) => lines[bar]![line]!.top,
    bottom: (line, bar) => lines[bar]![line]!.bottom,
    box: (bar) => bars.get(bar)!,
  };
}
