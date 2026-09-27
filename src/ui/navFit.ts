// Which navigation items the header has room for. Items that do not fit go into the More menu,
// the lowest priority first; the rest keep their order. See docs/SCALES.md, UI.

export interface NavFit {
  /** Indexes of the items shown in the bar, in order. */
  shown: number[];
  /** Indexes of the items in the More menu, in order; empty: no More button. */
  more: number[];
}

/**
 * `widths` are the items' widths, `priorities` their priorities (higher stays longer; `Infinity`
 * never moves), `gap` the space between two items, `moreWidth` the More button's. Everything fits
 * or the lowest priorities move, one at a time (ties: the later item first), until what is left
 * and the More button fit.
 */
export function fitNav(
  widths: readonly number[],
  priorities: readonly number[],
  available: number,
  gap: number,
  moreWidth: number,
): NavFit {
  const all = widths.map((_, i) => i);
  const width = (items: readonly number[], withMore: boolean) => {
    const count = items.length + (withMore ? 1 : 0);
    const sum = items.reduce((total, i) => total + widths[i]!, 0) + (withMore ? moreWidth : 0);
    return sum + gap * Math.max(0, count - 1);
  };
  if (width(all, false) <= available) return { shown: all, more: [] };
  const order = [...all]
    .filter((i) => priorities[i] !== Infinity)
    .sort((a, b) => priorities[a]! - priorities[b]! || b - a);
  const moved = new Set<number>();
  for (const i of order) {
    moved.add(i);
    if (
      width(
        all.filter((j) => !moved.has(j)),
        true,
      ) <= available
    )
      break;
  }
  return { shown: all.filter((i) => !moved.has(i)), more: all.filter((i) => moved.has(i)) };
}
