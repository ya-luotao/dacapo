// Statistics that a few stray values cannot pull around: timing data always has some (a note
// caught by the edge of its window, a hesitation, a slip).

/** The q-quantile (0–1) with linear interpolation; null for no values. */
export function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** The mean of the values left after dropping `trim` (0–0.5) of them at each end. */
export function trimmedMean(values: readonly number[], trim = 0.2): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * Math.min(0.49, Math.max(0, trim)));
  const kept = sorted.slice(cut, sorted.length - cut);
  return kept.reduce((sum, v) => sum + v, 0) / kept.length;
}

export interface Line {
  /** Change of y per unit of x. */
  slope: number;
  intercept: number;
}

/**
 * Theil–Sen line: the median of the slopes between every pair of points, and the median
 * intercept. Up to about 29 % of the points can be wild without moving it. Null with fewer than
 * two distinct x values.
 */
export function theilSen(xs: readonly number[], ys: readonly number[]): Line | null {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const dx = xs[j]! - xs[i]!;
      if (dx !== 0) slopes.push((ys[j]! - ys[i]!) / dx);
    }
  }
  const slope = quantile(slopes, 0.5);
  if (slope === null) return null;
  const intercept = quantile(
    ys.map((y, i) => y - slope * xs[i]!),
    0.5,
  )!;
  return { slope, intercept };
}
