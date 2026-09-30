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
