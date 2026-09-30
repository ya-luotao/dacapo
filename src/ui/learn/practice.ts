// Sums for the lesson on practising.

/**
 * A session of `total` minutes split by `weights` into whole minutes that add up to it: each part
 * its share rounded down (at least a minute), then the minutes left over to the parts that lost
 * most in rounding.
 */
export function splitMinutes(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (sum > 0 ? (total * w) / sum : 0));
  const out = exact.map((x) => Math.max(1, Math.floor(x)));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, rest: x - Math.floor(x) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length) {
    out[order[k]!.i]! += 1;
    left--;
  }
  // A minute given to a tiny part is taken back from the largest.
  while (left < 0) {
    out[out.indexOf(Math.max(...out))]! -= 1;
    left++;
  }
  return out;
}

/** The tempos of a ladder to `target`: each rung a share of it, in whole beats per minute. */
export function tempoLadder(target: number, percents: readonly number[]): number[] {
  return percents.map((p) => Math.round((target * p) / 100));
}
