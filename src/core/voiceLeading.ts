// Voice leading for keyboard harmony (docs/HARMONY.md, "Progressions (H2)" and its
// clarifications): the right hand's chords in close position, each voiced to move as little as
// possible from the one before, the common tones kept in their voice, without parallel fifths or
// octaves where another voicing avoids them. Pure and deterministic, so a progression is always
// written the same way and its records keep their checksum.

/** Semitones apart that make a perfect consonance moving in parallel: unisons, octaves, fifths. */
const PERFECT = new Set([0, 7]);
/** Cost of parallel fifths or octaves between the bass and the top voice … */
export const OUTER_PARALLEL_COST = 40;
/** … and between any other two voices. */
export const INNER_PARALLEL_COST = 14;
/** Per semitone the chord's middle lies from the preferred register. */
const REGISTER_COST = 0.25;
/** A change in the number of voices (a triad after a seventh chord) costs this much. */
const VOICE_COUNT_COST = 1;

/**
 * Every close-position voicing of a chord (its pitch classes in stacking order, root first):
 * each inversion, in every octave where all its keys lie within `low`–`high`. Lowest first.
 */
export function closeVoicings(pcs: readonly number[], low: number, high: number): number[][] {
  const out: number[][] = [];
  for (let inversion = 0; inversion < pcs.length; inversion++) {
    const order = [...pcs.slice(inversion), ...pcs.slice(0, inversion)];
    const first = order[0]!;
    for (let base = low + ((((first - low) % 12) + 12) % 12); base <= high; base += 12) {
      const keys = [base];
      for (const pc of order.slice(1)) {
        const previous = keys.at(-1)!;
        keys.push(previous + 1 + ((((pc - previous - 1) % 12) + 12) % 12));
      }
      if (keys.at(-1)! <= high) out.push(keys);
    }
  }
  return out.sort((a, b) => a[0]! - b[0]! || a.length - b.length);
}

/** Moves between two voicings, the voices paired low to high (one voice dropped or added free). */
function pairs(a: readonly number[], b: readonly number[]): [number, number][] {
  if (a.length === b.length) return a.map((x, i) => [x, b[i]!]);
  const [long, short, flip] = a.length > b.length ? [a, b, false] : [b, a, true];
  let best: [number, number][] = [];
  let bestCost = Infinity;
  for (let skip = 0; skip < long.length; skip++) {
    const kept = long.filter((_, i) => i !== skip);
    const cost = kept.reduce((sum, x, i) => sum + Math.abs(x - short[i]!), 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = kept.map((x, i) => (flip ? [short[i]!, x] : [x, short[i]!]));
    }
  }
  return best;
}

/** Semitones every voice moves from `a` to `b`. */
export function motion(a: readonly number[], b: readonly number[]): number {
  return (
    pairs(a, b).reduce((sum, [x, y]) => sum + Math.abs(x - y), 0) +
    (a.length === b.length ? 0 : VOICE_COUNT_COST)
  );
}

/**
 * Pairs of voices moving in parallel fifths or octaves (or unisons) from one chord to the next:
 * both move, the same way, and are a perfect fifth or octave apart before and after. The bass is
 * a voice below the others; `outer` counts the pairs of the bass with the top voice.
 */
export function parallels(
  a: { bass: number; upper: readonly number[] },
  b: { bass: number; upper: readonly number[] },
): { outer: number; inner: number } {
  const moves: [number, number][] = [[a.bass, b.bass], ...pairs(a.upper, b.upper)];
  const top = moves.length - 1;
  let outer = 0;
  let inner = 0;
  for (let i = 0; i < moves.length; i++) {
    for (let j = i + 1; j < moves.length; j++) {
      const [x1, x2] = moves[i]!;
      const [y1, y2] = moves[j]!;
      const dx = x2 - x1;
      const dy = y2 - y1;
      if (dx === 0 || dy === 0 || Math.sign(dx) !== Math.sign(dy)) continue;
      const before = (((y1 - x1) % 12) + 12) % 12;
      const after = (((y2 - x2) % 12) + 12) % 12;
      if (before !== after || !PERFECT.has(before)) continue;
      if (i === 0 && j === top) outer++;
      else inner++;
    }
  }
  return { outer, inner };
}

export interface LeadChord {
  /** The chord's pitch classes in stacking order, root first. */
  pcs: readonly number[];
  /** The lowest note under it (the left hand's bass), for the parallels. */
  bass: number;
  /** The lowest key the voicing may use (above everything the left hand plays with it). */
  floor: number;
}

export interface LeadOptions {
  /** The right hand's range. */
  low: number;
  high: number;
  /** Where the middle of a chord is best placed. */
  center: number;
  /**
   * The progression goes round (a loop): the move from the last chord back to the first counts
   * as any other.
   */
  cyclic: boolean;
  /** The first chord's voicing, when it is given (a prompt that starts from a chosen position). */
  first?: readonly number[];
}

function moveCost(from: LeadChord, a: readonly number[], to: LeadChord, b: readonly number[]) {
  const p = parallels({ bass: from.bass, upper: a }, { bass: to.bass, upper: b });
  return motion(a, b) + p.outer * OUTER_PARALLEL_COST + p.inner * INNER_PARALLEL_COST;
}

function registerCost(keys: readonly number[], center: number) {
  const middle = (keys[0]! + keys.at(-1)!) / 2;
  return Math.abs(middle - center) * REGISTER_COST;
}

/**
 * Voices the chords: of every sequence of close-position voicings in range and above each
 * chord's floor, the one that moves least (each voice's semitones summed, parallel fifths and
 * octaves costing more, and the register a little), found exactly. Ties go to the lower voicing
 * earlier in the sequence, so the result is always the same.
 */
export function leadVoices(chords: readonly LeadChord[], options: LeadOptions): number[][] {
  if (chords.length === 0) return [];
  const candidates = chords.map((chord, i) => {
    const all = closeVoicings(chord.pcs, Math.max(options.low, chord.floor), options.high);
    if (i === 0 && options.first) return [[...options.first]];
    if (all.length === 0) throw new RangeError('No voicing fits the range');
    return all;
  });
  const starts = candidates[0]!.map((_, i) => i);
  let best: { cost: number; path: number[][] } | null = null;
  for (const start of starts) {
    // cost[i][k]: the least cost of a path to voicing k of chord i, from this start.
    let costs = [registerCost(candidates[0]![start]!, options.center)];
    let paths: number[][][] = [[candidates[0]![start]!]];
    for (let i = 1; i < chords.length; i++) {
      const nextCosts: number[] = [];
      const nextPaths: number[][][] = [];
      for (const voicing of candidates[i]!) {
        let bestHere = Infinity;
        let from = -1;
        paths.forEach((path, k) => {
          const cost =
            costs[k]! +
            moveCost(chords[i - 1]!, path.at(-1)!, chords[i]!, voicing) +
            registerCost(voicing, options.center);
          if (cost < bestHere) {
            bestHere = cost;
            from = k;
          }
        });
        nextCosts.push(bestHere);
        nextPaths.push([...paths[from]!, voicing]);
      }
      costs = nextCosts;
      paths = nextPaths;
    }
    paths.forEach((path, k) => {
      const wrap =
        options.cyclic && chords.length > 1
          ? moveCost(chords.at(-1)!, path.at(-1)!, chords[0]!, path[0]!)
          : 0;
      const total = costs[k]! + wrap;
      if (!best || total < best.cost - 1e-9) best = { cost: total, path };
    });
  }
  return best!.path;
}
