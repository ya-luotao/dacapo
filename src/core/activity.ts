/** A pause this long ends a free-play session; longer pauses inside a read session count as this. */
export const IDLE_MS = 60_000;

/**
 * Time between consecutive moments of activity (epoch ms, in order), where a gap longer than
 * `idleMs` counts as `idleMs`: walking away from the piano is not practice.
 */
export function activeTime(times: readonly number[], idleMs = IDLE_MS): number {
  let total = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i]! - times[i - 1]!;
    if (gap > 0) total += Math.min(gap, idleMs);
  }
  return total;
}
