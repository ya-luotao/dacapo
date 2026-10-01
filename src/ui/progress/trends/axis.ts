/**
 * Steps of an axis: whole multiples of a power of ten, so a tick reads as it is at the precision
 * its figure is written with (a tenth of a second, a whole ms, a whole or a tenth of a percent).
 */
const MANTISSAS = [1, 2, 3, 4, 5, 6, 8, 10, 20];

const tidy = (x: number) => Number(x.toPrecision(12));

/**
 * Three evenly spaced round ticks covering `[lo, hi]`, for a line whose axis need not start at
 * zero: at least `minSpan` apart end to end (a flat line is not drawn as a wild one), and within
 * `floor` and `ceiling`.
 */
export function niceTicks(
  lo: number,
  hi: number,
  { minSpan, floor = 0, ceiling = Infinity }: { minSpan: number; floor?: number; ceiling?: number },
): [number, number, number] {
  const mid = (lo + hi) / 2;
  const span = Math.max(hi - lo, minSpan);
  let a = mid - span / 2;
  let b = mid + span / 2;
  if (a < floor) [a, b] = [floor, floor + span];
  if (b > ceiling) [a, b] = [Math.max(floor, ceiling - span), ceiling];
  const power = 10 ** Math.floor(Math.log10((b - a) / 2));
  for (const mantissa of MANTISSAS) {
    const step = mantissa * power;
    let start = Math.floor(tidy(a / step)) * step;
    if (start + 2 * step > ceiling) start = ceiling - 2 * step;
    start = Math.max(floor, start);
    if (start <= a + 1e-9 && start + 2 * step >= b - 1e-9) {
      return [tidy(start), tidy(start + step), tidy(start + 2 * step)];
    }
  }
  return [a, (a + b) / 2, b];
}
