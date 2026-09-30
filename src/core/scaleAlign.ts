// Which played note was which note of the scale. A scale run has mistakes — a wrong key, a note
// left out, a note too many, a slip corrected at once — and each must cost that one note, not the
// rest of the run, so the notes are matched by sequence alignment (edit distance) rather than in
// order. See docs/SCALES.md, "Playing a scale" and "Clarifications: Alignment".

import type { Hand } from './score.ts';

/**
 * At most this many played notes per expected note are aligned; the rest are extras without
 * looking. The tables have a row per played note, so a run that never ends (a cat on the keys, a
 * stuck source) must not grow them without bound. Nothing is lost: past the cap the extras alone
 * are twice the notes asked for, and a run is only a scale run with at most a third (evenness.ts's
 * quality gate).
 */
export const MAX_PLAYED_PER_EXPECTED = 3;

/**
 * Costs in fifths of a note, so the sums are exact integers and ties are real ties rather than
 * rounding. A wrong key, a missed note and an extra note cost one note each.
 */
const STEP = 5;
/**
 * Hands together: every move of a hand while the hands are more than one note apart costs 0.6 of
 * a note per note of difference. The hands move together, so this settles which hand a key shared
 * by both belongs to (in two octaves or more the same key is the right hand's going up and the
 * left hand's later). 0.6 from S0: on 600 labelled runs no played note went to the wrong hand.
 */
const DRIFT = 3;
/**
 * Hands together, the table keeps only the states where the hands are at most this many notes
 * apart. A hand that keeps two notes behind the other puts them two and three notes apart by turns,
 * 1.8 of a note per pair (0.6 + 1.2) against 2 for giving its note up as a missed note and an extra
 * one, so it is followed; three behind costs 3 a pair (1.2 + 1.8), so it is given up. The cheapest
 * alignment thus stays within three notes, and one more is margin. Simulated (26,000 runs of one
 * to four octaves with jitter up to 0.7 of a note, a hand lagging up to ten notes over a stretch,
 * up to 26 notes missed in a row, early stops and bursts of stray keys, and 200,000 small random
 * cases), the cheapest alignment over the whole table was never more than three notes apart, and
 * the banded one was the same alignment every time. A hand further behind has its notes missed and
 * played extra, as over the whole table.
 */
export const HANDS_BAND = 4;

/** A wrong key played where an expected note was due. */
export interface WrongKey {
  /** The expected note's index in its hand's run. */
  index: number;
  /** The played note's index. */
  played: number;
}

/** How one hand's expected notes were played. */
export interface HandMatch {
  /** Per expected index, the played note that matched it (the right key), or null. */
  played: (number | null)[];
  /** Expected notes played with a wrong key, by expected index. */
  wrong: WrongKey[];
  /** Expected indexes with no played note, ascending. */
  missed: number[];
}

/** One hand alone. */
export interface HandAlignment extends HandMatch {
  /** Played notes that are no expected note, ascending. */
  extra: number[];
  /** Played notes past `MAX_PLAYED_PER_EXPECTED` were not aligned (they are in `extra`). */
  capped: boolean;
}

/** Both hands. Extra notes belong to neither hand. */
export interface HandsAlignment {
  right: HandMatch;
  left: HandMatch;
  extra: number[];
  capped: boolean;
}

// Back-pointers of the tables.
const MATCH = 1;
const EXTRA = 2;
const MISS = 3;
const WRONG = 4;
const MATCH_R = 1;
const MATCH_L = 6;
const MATCH_BOTH = 7;
const MISS_R = 4;
const MISS_L = 5;

/**
 * One hand: edit distance of the played note-ons against the expected notes, a match costing 0
 * and a wrong key, a missed note or an extra note one note each. Of equally cheap alignments, the
 * one chosen prefers — from the end of the run backwards — a match, then an extra note, then a
 * missed note, then a wrong key: a slip corrected at once (a wrong key, then the right one) is an
 * extra note and a match, not a wrong key and an extra; and a run that stops early has its last
 * notes missed rather than its played notes shifted onto them as wrong keys.
 */
export function alignHand(played: readonly number[], expected: readonly number[]): HandAlignment {
  const n = expected.length;
  const m = Math.min(played.length, MAX_PLAYED_PER_EXPECTED * n);
  const w = n + 1;
  const cost = new Int32Array((m + 1) * w);
  const from = new Uint8Array((m + 1) * w);
  for (let i = 1; i <= m; i++) {
    cost[i * w] = i * STEP;
    from[i * w] = EXTRA;
  }
  for (let j = 1; j <= n; j++) {
    cost[j] = j * STEP;
    from[j] = MISS;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const same = played[i - 1] === expected[j - 1];
      // In order of preference; a later option wins only when strictly cheaper.
      let best = same ? cost[(i - 1) * w + j - 1]! : Infinity;
      let how = MATCH;
      const extra = cost[(i - 1) * w + j]! + STEP;
      if (extra < best) {
        best = extra;
        how = EXTRA;
      }
      const miss = cost[i * w + j - 1]! + STEP;
      if (miss < best) {
        best = miss;
        how = MISS;
      }
      const wrong = same ? Infinity : cost[(i - 1) * w + j - 1]! + STEP;
      if (wrong < best) {
        best = wrong;
        how = WRONG;
      }
      cost[i * w + j] = best;
      from[i * w + j] = how;
    }
  }

  const matched: (number | null)[] = new Array<number | null>(n).fill(null);
  const wrong: WrongKey[] = [];
  const missed: number[] = [];
  const extra: number[] = [];
  for (let k = played.length - 1; k >= m; k--) extra.push(k);
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const how = from[i * w + j];
    if (how === MATCH) matched[--j] = --i;
    else if (how === WRONG) wrong.push({ index: --j, played: --i });
    else if (how === EXTRA) extra.push(--i);
    else missed.push(--j);
  }
  return {
    played: matched,
    wrong: wrong.reverse(),
    missed: missed.reverse(),
    extra: extra.reverse(),
    capped: m < played.length,
  };
}

/**
 * Both hands, in parallel or contrary motion: a DP over (played note, right-hand note, left-hand
 * note). A played note matches the next note of its key in either hand or is extra; either hand's
 * next note can be missed; every move of a hand while the hands are more than one note apart costs
 * `DRIFT` per note of difference. The hands' runs are paired by index, whichever way each goes, so
 * the DP is the same for contrary motion. Where both hands' next notes are the same key at the same
 * place (the unison of contrary motion, where the two thumbs share a key), one key-down matches
 * both, since a key struck once cannot sound twice; struck twice, each hand takes its own. Of
 * equally cheap alignments, the one chosen prefers, from the end backwards, a unison match, a
 * right-hand match, a left-hand match, an extra note, a right-hand miss, a left-hand miss.
 *
 * Only states with the hands at most `HANDS_BAND` notes apart are kept (more when the hands' runs
 * differ in length, so that the end is in the band): (played + 1)(right + 1)(2 · band + 1)
 * back-pointers and two rows of costs, 0.5 MB at the cap for four chromatic octaves where the
 * whole table took 28 MB.
 *
 * The DP has no wrong key (a key matches only its own note), so a wrong key comes out as a missed
 * note and an extra one at the same place; `reclassifyWrongKeys` turns those pairs back into wrong
 * keys.
 */
export function alignHands(
  played: readonly number[],
  right: readonly number[],
  left: readonly number[],
): HandsAlignment {
  const R = right.length;
  const L = left.length;
  const m = Math.min(played.length, MAX_PLAYED_PER_EXPECTED * (R + L));
  // State (j, k) sits at j · w + (k − j − lo): k runs over the band around j.
  const lo = Math.min(0, L - R) - HANDS_BAND;
  const w = Math.abs(R - L) + 2 * HANDS_BAND + 1;
  const row = (R + 1) * w;
  const from = new Uint8Array((m + 1) * row);
  // Costs after the previous played note and after this one; the back-pointers keep the path.
  let before = new Int32Array(row);
  let now = new Int32Array(row);
  const lag = (j: number, k: number) => Math.max(0, Math.abs(j - k) - 1) * DRIFT;
  const BIG = 0x3fffffff;

  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= R; j++) {
      const first = Math.max(0, -j - lo);
      const last = Math.min(w - 1, L - j - lo);
      for (let d = first; d <= last; d++) {
        const k = j + lo + d;
        const at = j * w + d;
        if (i === 0 && j === 0 && k === 0) {
          now[at] = 0;
          continue;
        }
        const move = lag(j, k);
        // (j − 1, k) is in the band unless d is its top; (j, k − 1) unless d is its bottom.
        const up = j > 0 && d < w - 1;
        const down = k > 0 && d > 0;
        let best = BIG;
        let how = 0;
        // The same key due in both hands at the same place: one key-down for both. (j, k) and
        // (j − 1, k − 1) share the band's column d.
        if (
          i > 0 &&
          j === k &&
          j > 0 &&
          right[j - 1] === left[k - 1] &&
          played[i - 1] === right[j - 1]
        ) {
          const c = before[at - w]!;
          if (c < best) {
            best = c;
            how = MATCH_BOTH;
          }
        }
        if (i > 0 && up && played[i - 1] === right[j - 1]) {
          const c = before[at - w + 1]! + move;
          if (c < best) {
            best = c;
            how = MATCH_R;
          }
        }
        if (i > 0 && down && played[i - 1] === left[k - 1]) {
          const c = before[at - 1]! + move;
          if (c < best) {
            best = c;
            how = MATCH_L;
          }
        }
        if (i > 0) {
          const c = before[at]! + STEP;
          if (c < best) {
            best = c;
            how = EXTRA;
          }
        }
        if (up) {
          const c = now[at - w + 1]! + STEP + move;
          if (c < best) {
            best = c;
            how = MISS_R;
          }
        }
        if (down) {
          const c = now[at - 1]! + STEP + move;
          if (c < best) {
            best = c;
            how = MISS_L;
          }
        }
        now[at] = best;
        from[i * row + at] = how;
      }
    }
    [before, now] = [now, before];
  }

  const matchR: (number | null)[] = new Array<number | null>(R).fill(null);
  const matchL: (number | null)[] = new Array<number | null>(L).fill(null);
  const missedR: number[] = [];
  const missedL: number[] = [];
  const extra: number[] = [];
  for (let x = played.length - 1; x >= m; x--) extra.push(x);
  let i = m;
  let j = R;
  let k = L;
  while (i > 0 || j > 0 || k > 0) {
    const how = from[i * row + j * w + (k - j - lo)];
    if (how === MATCH_BOTH) {
      i--;
      matchR[--j] = i;
      matchL[--k] = i;
    } else if (how === MATCH_R) matchR[--j] = --i;
    else if (how === MATCH_L) matchL[--k] = --i;
    else if (how === EXTRA) extra.push(--i);
    else if (how === MISS_R) missedR.push(--j);
    else missedL.push(--k);
  }
  extra.reverse();

  const hands = {
    right: { played: matchR, wrong: [], missed: missedR.reverse() },
    left: { played: matchL, wrong: [], missed: missedL.reverse() },
  };
  const leftover = reclassifyWrongKeys(played, m, { right, left }, hands, extra);
  return { ...leftover.hands, extra: leftover.extra, capped: m < played.length };
}

/**
 * Turns a missed note and an extra note at the same place back into a wrong key. "The same place":
 * a missed note of one hand lies in a gap of that hand's run — the missed notes between two
 * matched ones (or the start or end of the aligned notes) — and an extra note played strictly between those
 * two matched notes is at its place. Where several pairs are possible, the pairs closest in pitch
 * are taken first (a wrong key is usually a neighbour of the right one), then the earliest played;
 * each extra note and each missed note is used once, and within a hand the pairs keep the order
 * of the run (a later played note never takes an earlier expected one).
 */
function reclassifyWrongKeys(
  played: readonly number[],
  aligned: number,
  expected: Record<Hand, readonly number[]>,
  hands: Record<Hand, HandMatch>,
  extra: readonly number[],
): { hands: Record<Hand, HandMatch>; extra: number[] } {
  interface Candidate {
    hand: Hand;
    index: number;
    played: number;
    distance: number;
  }
  const candidates: Candidate[] = [];
  for (const hand of ['right', 'left'] as const) {
    const match = hands[hand];
    for (const index of match.missed) {
      let lo = -1;
      for (let j = index - 1; j >= 0; j--) {
        if (match.played[j] !== null) {
          lo = match.played[j]!;
          break;
        }
      }
      let hi = aligned;
      for (let j = index + 1; j < match.played.length; j++) {
        if (match.played[j] !== null) {
          hi = match.played[j]!;
          break;
        }
      }
      for (const x of extra) {
        if (x > lo && x < hi) {
          candidates.push({
            hand,
            index,
            played: x,
            distance: Math.abs(played[x]! - expected[hand][index]!),
          });
        }
      }
    }
  }
  candidates.sort(
    (a, b) =>
      a.distance - b.distance ||
      a.played - b.played ||
      (a.hand === b.hand ? a.index - b.index : a.hand === 'right' ? -1 : 1),
  );

  const usedPlayed = new Set<number>();
  const taken: Record<Hand, WrongKey[]> = { right: [], left: [] };
  for (const c of candidates) {
    if (usedPlayed.has(c.played)) continue;
    const mine = taken[c.hand];
    if (mine.some((t) => t.index === c.index)) continue;
    if (mine.some((t) => (t.index - c.index) * (t.played - c.played) <= 0)) continue;
    mine.push({ index: c.index, played: c.played });
    usedPlayed.add(c.played);
  }

  const result = {} as Record<Hand, HandMatch>;
  for (const hand of ['right', 'left'] as const) {
    const wrong = taken[hand].sort((a, b) => a.index - b.index);
    const wrongAt = new Set(wrong.map((w) => w.index));
    result[hand] = {
      played: hands[hand].played,
      wrong,
      missed: hands[hand].missed.filter((j) => !wrongAt.has(j)),
    };
  }
  return { hands: result, extra: extra.filter((x) => !usedPlayed.has(x)) };
}

// Chords -------------------------------------------------------------------------------------------

/**
 * Keys struck together are one chord when each comes within this long of the key before it: the
 * spec's 60 ms (docs/SCALES.md, "Technique"). A chord struck wider than this, or two hands a
 * little apart, comes out as two clusters, and a step may take both (`alignChords`).
 */
export const CHORD_CHAIN_MS = 60;

/** Played keys grouped into clusters: indexes into the keys, in the order played. */
export function chordClusters(onsets: readonly number[], chain = CHORD_CHAIN_MS): number[][] {
  const clusters: number[][] = [];
  onsets.forEach((on, i) => {
    const last = clusters.at(-1);
    if (last && on - onsets[last.at(-1)!]! <= chain) last.push(i);
    else clusters.push([i]);
  });
  return clusters;
}

/** How one step of chords was played: its keys matched, wrong or missed, by position in the step. */
export interface ChordStepMatch {
  /** Per key of the step (lowest first), the played key that matched it, or null. */
  played: (number | null)[];
  /** Keys of the step played with a wrong key (position in the step, and the played key). */
  wrong: { key: number; played: number }[];
  /** Positions in the step with no key played. */
  missed: number[];
}

export interface ChordAlignment {
  steps: ChordStepMatch[];
  /** Played keys that belong to no step, ascending. */
  extra: number[];
  capped: boolean;
}

/**
 * Which keys struck which chord. The played keys are grouped into clusters (`chordClusters`) and
 * the clusters aligned against the steps (each a set of keys, lowest first) by edit distance: a
 * cluster matches a step, or the step takes two clusters in a row (a chord broken wider than the
 * chain, a hand late), or the cluster is extra, or the step is missed. Matching a set costs its
 * mistakes — a key of the step not struck and a struck key not in it make one wrong key, what is
 * left over is missed or extra — so a chord with one wrong key costs one, as a scale's wrong note
 * does. Of equally cheap alignments the one chosen prefers, from the end backwards, a match, a
 * step taking two clusters, an extra cluster, a missed step.
 */
export function alignChords(
  played: readonly { midi: number; on: number }[],
  steps: readonly (readonly number[])[],
): ChordAlignment {
  const clusters = chordClusters(played.map((p) => p.on));
  const n = steps.length;
  const size = steps.reduce((a, s) => a + s.length, 0);
  // As `alignHand`, a run that never ends is cut: past three keys per key asked for, all extra.
  let kept = 0;
  let m = 0;
  while (m < clusters.length && kept + clusters[m]!.length <= MAX_PLAYED_PER_EXPECTED * size) {
    kept += clusters[m]!.length;
    m++;
  }
  const keysOf = (from: number, to: number) => clusters.slice(from, to).flat();
  /** Mistakes of `keys` struck for `step`: wrong keys paired, the rest missed or extra. */
  const mistakes = (keys: readonly number[], step: readonly number[]) => {
    const left = [...step];
    let extra = 0;
    for (const k of keys) {
      const at = left.indexOf(played[k]!.midi);
      if (at >= 0) left.splice(at, 1);
      else extra++;
    }
    return Math.max(left.length, extra);
  };
  const w = n + 1;
  const cost = new Float64Array((m + 1) * w);
  const from = new Uint8Array((m + 1) * w);
  const TAKE = 1;
  const TAKE_TWO = 2;
  const EXTRA_CLUSTER = 3;
  const MISS_STEP = 4;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0 && j === 0) continue;
      let best = Infinity;
      let how = 0;
      if (i > 0 && j > 0) {
        const c = cost[(i - 1) * w + j - 1]! + mistakes(clusters[i - 1]!, steps[j - 1]!);
        if (c < best) {
          best = c;
          how = TAKE;
        }
      }
      if (i > 1 && j > 0) {
        const c = cost[(i - 2) * w + j - 1]! + mistakes(keysOf(i - 2, i), steps[j - 1]!);
        if (c < best) {
          best = c;
          how = TAKE_TWO;
        }
      }
      if (i > 0) {
        const c = cost[(i - 1) * w + j]! + clusters[i - 1]!.length;
        if (c < best) {
          best = c;
          how = EXTRA_CLUSTER;
        }
      }
      if (j > 0) {
        const c = cost[i * w + j - 1]! + steps[j - 1]!.length;
        if (c < best) {
          best = c;
          how = MISS_STEP;
        }
      }
      cost[i * w + j] = best;
      from[i * w + j] = how;
    }
  }

  const out: ChordStepMatch[] = steps.map((step) => ({
    played: step.map(() => null),
    wrong: [],
    missed: [],
  }));
  const extra: number[] = [];
  for (let c = clusters.length - 1; c >= m; c--) extra.push(...clusters[c]!);
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const how = from[i * w + j];
    if (how === TAKE || how === TAKE_TWO) {
      const take = how === TAKE ? 1 : 2;
      const keys = keysOf(i - take, i);
      const step = steps[j - 1]!;
      const match = out[j - 1]!;
      const unused: number[] = [];
      for (const k of keys) {
        const at = step.findIndex(
          (midi, p) => midi === played[k]!.midi && match.played[p] === null,
        );
        if (at >= 0) match.played[at] = k;
        else unused.push(k);
      }
      // A key of the step not struck and a key struck that is not in it: a wrong key, the
      // nearest in pitch first (as `reclassifyWrongKeys` pairs them for the scales).
      const open = step.map((_, p) => p).filter((p) => match.played[p] === null);
      const pairs = open
        .flatMap((p) => unused.map((k) => ({ p, k, d: Math.abs(played[k]!.midi - step[p]!) })))
        .sort((a, b) => a.d - b.d || a.k - b.k || a.p - b.p);
      const usedKeys = new Set<number>();
      const usedPlaces = new Set<number>();
      for (const { p, k } of pairs) {
        if (usedKeys.has(k) || usedPlaces.has(p)) continue;
        usedKeys.add(k);
        usedPlaces.add(p);
        match.wrong.push({ key: p, played: k });
      }
      match.wrong.sort((a, b) => a.key - b.key);
      match.missed = open.filter((p) => !usedPlaces.has(p));
      for (const k of unused) if (!usedKeys.has(k)) extra.push(k);
      i -= take;
      j--;
    } else if (how === EXTRA_CLUSTER) {
      extra.push(...clusters[--i]!);
    } else {
      const step = steps[--j]!;
      out[j]!.missed = step.map((_, p) => p);
    }
  }
  return { steps: out, extra: extra.sort((a, b) => a - b), capped: m < clusters.length };
}
