// The order a short score is played in, with its repeats, its first and second endings and its
// jumps (D.C., D.S., Fine, To Coda and the coda): the glossary's road map (docs/GLOSSARY.md).
// A plain list of bars, not a score: core/repeats.ts unrolls a piece's repeats and follows no
// jump. The usual convention: a repeat is played once more, and after the jump back no repeat is
// taken again, and only the last ending of each is played.

/** Where a D.C. or a D.S. goes back to, and where it then stops or leaves. */
export interface RoadJump {
  /** `dc` from the beginning; `ds` from the segno. */
  from: 'dc' | 'ds';
  /** `fine` to the Fine; `coda` to the To Coda and then the coda; `end` to the end. */
  to: 'fine' | 'coda' | 'end';
}

/** A bar, and the signs written on it. */
export interface RoadBar {
  /** `|:` at its start. */
  start?: boolean;
  /** `:|` at its end: back to the last `|:`, or to the beginning. */
  end?: boolean;
  /** Under a bracket: the times through it is played, `[1]` for a first ending. */
  ending?: readonly number[];
  /** 𝄋 over its start: where a D.S. goes back to. */
  segno?: boolean;
  /** 𝄌 over its start: the coda begins here. */
  coda?: boolean;
  /** "To Coda" over its end. */
  toCoda?: boolean;
  /** "Fine" over its end. */
  fine?: boolean;
  /** "D.C. al Fine" and the like under its end. */
  jump?: RoadJump;
}

/** The highest ending of the brackets around bar `i`: the one played after the jump back. */
function lastEnding(bars: readonly RoadBar[], i: number): number {
  let from = i;
  while (from > 0 && bars[from - 1]!.ending) from--;
  let to = i;
  while (to < bars.length - 1 && bars[to + 1]!.ending) to++;
  return Math.max(...bars.slice(from, to + 1).flatMap((bar) => bar.ending ?? []));
}

/** The bars by index, in the order they are played. */
export function roadOrder(bars: readonly RoadBar[]): number[] {
  const order: number[] = [];
  // Every bar at most twice before the jump and once after it, the coda once: the rest is a
  // mistake in the bars, which must not play for ever.
  const limit = bars.length * 4;
  let section = 0;
  let time = 1;
  let back = false;
  let jumped: RoadJump | null = null;
  let i = 0;
  while (i < bars.length && order.length < limit) {
    const bar = bars[i]!;
    if (bar.start && !back && !jumped) {
      section = i;
      time = 1;
    }
    back = false;
    if (bar.ending) {
      const played = jumped ? lastEnding(bars, i) : time;
      if (!bar.ending.includes(played)) {
        i++;
        continue;
      }
    } else if (time > 1 && i > 0 && bars[i - 1]!.ending) {
      // Past the endings: the next repeat starts afresh.
      section = i;
      time = 1;
    }
    order.push(i);

    if (jumped) {
      if (jumped.to === 'fine' && bar.fine) break;
      if (jumped.to === 'coda' && bar.toCoda) {
        const coda = bars.findIndex((b, at) => b.coda && at > i);
        if (coda < 0) break;
        // Once there, the coda plays to the end with nothing more to follow.
        jumped = { from: jumped.from, to: 'end' };
        i = coda;
        continue;
      }
    } else {
      if (bar.end && time === 1) {
        time = 2;
        back = true;
        i = section;
        continue;
      }
      if (bar.end) {
        section = i + 1;
        time = 1;
      }
      if (bar.jump) {
        jumped = bar.jump;
        const to = bar.jump.from === 'dc' ? 0 : bars.findIndex((b) => b.segno);
        if (to < 0) break;
        i = to;
        continue;
      }
    }
    i++;
  }
  return order;
}
