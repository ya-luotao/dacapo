import { describe, expect, it } from 'vitest';
import { seededRng } from './random.ts';
import {
  alignHand,
  alignHands,
  HANDS_BAND,
  MAX_PLAYED_PER_EXPECTED,
  type HandsAlignment,
} from './scaleAlign.ts';

const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];

/** MIDI of a C-major run up `octaves` octaves from `tonic` and back down. */
function upDown(tonic: number, octaves: number): number[] {
  const up = Array.from(
    { length: 7 * octaves + 1 },
    (_, i) => tonic + 12 * Math.floor(i / 7) + C_MAJOR[i % 7]!,
  );
  return [...up, ...up.slice(0, -1).reverse()];
}

describe('alignHand', () => {
  const rh = upDown(60, 2); // C4–C6–C4, 29 notes

  it('matches a clean run note for note', () => {
    const r = alignHand(rh, rh);
    expect(r.played).toEqual(rh.map((_, i) => i));
    expect(r.wrong).toEqual([]);
    expect(r.missed).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it('a wrong key in place costs that note only', () => {
    const played = [...rh];
    played[3] = 66; // F♯ for F
    const r = alignHand(played, rh);
    expect(r.wrong).toEqual([{ index: 3, played: 3 }]);
    expect(r.played[3]).toBeNull();
    expect(r.played.filter((p) => p !== null)).toHaveLength(rh.length - 1);
    expect(r.missed).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it('a missed note shifts nothing after it', () => {
    const played = rh.filter((_, i) => i !== 8);
    const r = alignHand(played, rh);
    expect(r.missed).toEqual([8]);
    expect(r.played[9]).toBe(8);
    expect(r.played.at(-1)).toBe(played.length - 1);
    expect(r.wrong).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it('an extra note is left out', () => {
    const played = [...rh.slice(0, 12), 81, ...rh.slice(12)];
    const r = alignHand(played, rh);
    expect(r.extra).toEqual([12]);
    expect(r.played[12]).toBe(13);
    expect(r.missed).toEqual([]);
    expect(r.wrong).toEqual([]);
  });

  it('a slip corrected at once is an extra note, not a wrong key', () => {
    // E F♯ F G: the F♯ is a slip, the F that follows is the note.
    const played = [...rh.slice(0, 3), 66, ...rh.slice(3)];
    const r = alignHand(played, rh);
    expect(r.extra).toEqual([3]);
    expect(r.played[3]).toBe(4);
    expect(r.wrong).toEqual([]);
  });

  it('a run that stops early has its last notes missed', () => {
    const played = [60, 61, 62]; // C, a slip, D; then nothing
    const r = alignHand(played, [60, 62, 64]);
    expect(r.played).toEqual([0, 2, null]);
    expect(r.extra).toEqual([1]);
    expect(r.missed).toEqual([2]);
    expect(r.wrong).toEqual([]);
  });

  it('caps the played notes it aligns', () => {
    const played = Array.from({ length: 100 }, (_, i) => 30 + (i % 5));
    const r = alignHand(played, [60, 62, 64]);
    expect(r.capped).toBe(true);
    // Only the first nine are aligned (three of them as wrong keys); the rest are extra.
    expect(r.wrong).toHaveLength(3);
    expect(r.wrong.every((w) => w.played < 9)).toBe(true);
    expect(r.extra).toHaveLength(97);
    expect(r.extra.slice(6)).toEqual(Array.from({ length: 91 }, (_, i) => 9 + i));
    expect(alignHand(rh, rh).capped).toBe(false);
    expect(MAX_PLAYED_PER_EXPECTED).toBe(3);
  });

  it('handles empty input', () => {
    expect(alignHand([], [60, 62])).toMatchObject({ played: [null, null], missed: [0, 1] });
    expect(alignHand([60], [])).toMatchObject({ played: [], extra: [0] });
  });
});

describe('alignHands', () => {
  const rh = upDown(60, 2);
  const lh = upDown(48, 2);

  /** Played order with the left hand first in every third pair. */
  const interleave = (r: readonly number[], l: readonly number[]) =>
    r.flatMap((x, i) => (i % 3 === 0 ? [l[i]!, x] : [x, l[i]!]));

  it('gives every note of a clean run to its hand and step', () => {
    const played = interleave(rh, lh);
    const r = alignHands(played, rh, lh);
    rh.forEach((_, i) => {
      const first = 2 * i;
      const [lPlayed, rPlayed] = i % 3 === 0 ? [first, first + 1] : [first + 1, first];
      expect(r.right.played[i]).toBe(rPlayed);
      expect(r.left.played[i]).toBe(lPlayed);
    });
    expect(r.extra).toEqual([]);
    expect(r.right.missed).toEqual([]);
    expect(r.left.missed).toEqual([]);
  });

  it('reports a wrong key as a wrong key, not a missed and an extra note', () => {
    // Pair 10: the right hand plays a semitone off.
    const played = interleave(rh, lh);
    const at = played.indexOf(rh[10]!, 20);
    played[at] = rh[10]! + 1;
    const r = alignHands(played, rh, lh);
    expect(r.right.wrong).toEqual([{ index: 10, played: at }]);
    expect(r.right.missed).toEqual([]);
    expect(r.extra).toEqual([]);
    expect(r.left.wrong).toEqual([]);
  });

  it('two wrong keys in one gap pair in order, closest in pitch first', () => {
    // Right hand, steps 5 and 6 (A4, B4) played as A♭4 and B♭4.
    const played = interleave(rh, lh);
    const a = played.indexOf(rh[5]!);
    const b = played.indexOf(rh[6]!);
    played[a] = rh[5]! - 1;
    played[b] = rh[6]! - 1;
    const r = alignHands(played, rh, lh);
    expect(r.right.wrong).toEqual([
      { index: 5, played: a },
      { index: 6, played: b },
    ]);
    expect(r.right.missed).toEqual([]);
    expect(r.extra).toEqual([]);
  });

  it('an extra note away from any missed note stays extra', () => {
    const played = interleave(rh, lh);
    played.splice(30, 0, 100);
    const r = alignHands(played, rh, lh);
    expect(r.extra).toEqual([30]);
    expect(r.right.wrong).toEqual([]);
    expect(r.left.wrong).toEqual([]);
  });

  it('a missed note with an extra note elsewhere is not a wrong key', () => {
    // Left hand misses step 4; an extra note comes at step 20, far from it.
    const played: number[] = [];
    rh.forEach((x, i) => {
      if (i !== 4) played.push(lh[i]!);
      played.push(x);
      if (i === 20) played.push(99);
    });
    const r = alignHands(played, rh, lh);
    expect(r.left.missed).toEqual([4]);
    expect(r.left.wrong).toEqual([]);
    expect(r.extra).toEqual([played.indexOf(99)]);
  });

  it('labels every note played as asked with its hand and step, in runs with mistakes', () => {
    // Random hand order within each pair; each note missed 4 %, a wrong key (a semitone off)
    // 3 %, followed by an extra note 3 %.
    const rng = seededRng(2024);
    let correct = 0;
    let wrongLabel = 0;
    let calledExtra = 0;
    let wrongKeys = 0;
    let wrongFound = 0;
    for (const octaves of [2, 3]) {
      const right = upDown(octaves === 3 ? 48 : 60, octaves);
      const left = right.map((x) => x - 12);
      for (let run = 0; run < 150; run++) {
        const notes: { midi: number; label: string | null; wrongFor: string | null }[] = [];
        right.forEach((_, i) => {
          const pair = [
            { midi: left[i]!, label: `left${i}` },
            { midi: right[i]!, label: `right${i}` },
          ];
          if (rng() < 0.5) pair.reverse();
          for (const p of pair) {
            const u = rng();
            if (u < 0.04) continue;
            if (u < 0.07) {
              notes.push({
                midi: p.midi + (rng() < 0.5 ? 1 : -1),
                label: null,
                wrongFor: p.label,
              });
            } else notes.push({ ...p, wrongFor: null });
            if (rng() < 0.03) notes.push({ midi: p.midi + 2, label: null, wrongFor: null });
          }
        });
        const r = alignHands(
          notes.map((n) => n.midi),
          right,
          left,
        );
        const got = new Map<number, string>();
        const wrongGot = new Map<number, string>();
        for (const hand of ['right', 'left'] as const) {
          r[hand].played.forEach((p, i) => p !== null && got.set(p, `${hand}${i}`));
          for (const w of r[hand].wrong) wrongGot.set(w.played, `${hand}${w.index}`);
        }
        notes.forEach((n, i) => {
          if (n.wrongFor !== null) {
            wrongKeys++;
            if (wrongGot.get(i) === n.wrongFor) wrongFound++;
          }
          if (n.label === null) return;
          correct++;
          const label = got.get(i);
          if (label === undefined) calledExtra++;
          else if (label !== n.label) wrongLabel++;
        });
      }
    }
    expect(correct).toBeGreaterThan(9000);
    expect(wrongLabel).toBe(0);
    expect(calledExtra / correct).toBeLessThanOrEqual(0.002);
    // Most wrong keys come back as wrong keys at their place (some fall on a scale key and are
    // taken for the neighbouring note, or tie with an extra note).
    expect(wrongFound / wrongKeys).toBeGreaterThan(0.8);
  });

  it('aligns four octaves hands together quickly', () => {
    const right = upDown(48, 4);
    const left = upDown(36, 4);
    const played = interleave(right, left);
    expect(played).toHaveLength(114);
    alignHands(played, right, left);
    const t0 = performance.now();
    const r = alignHands(played, right, left);
    const ms = performance.now() - t0;
    expect(r.extra).toEqual([]);
    // About 1 ms here (5 over the whole table); the bound is generous for slow machines.
    expect(ms).toBeLessThan(50);
  });

  it('aligns four chromatic octaves at the cap in bounded time', () => {
    // 97 notes a hand, 582 played notes aligned: the largest table there is.
    const right = Array.from({ length: 49 }, (_, i) => 48 + i);
    const full = [...right, ...right.slice(0, -1).reverse()];
    const left = full.map((x) => x - 12);
    const played = Array.from({ length: 700 }, (_, i) => 20 + (i % 7));
    alignHands(played, full, left);
    const t0 = performance.now();
    const r = alignHands(played, full, left);
    const ms = performance.now() - t0;
    expect(r.capped).toBe(true);
    expect(r.extra.length + r.right.wrong.length + r.left.wrong.length).toBe(700);
    // About 50 ms here, 6 of them the DP (110 over the whole table) and the rest pairing the wrong
    // keys; the bound is generous for slow machines.
    expect(ms).toBeLessThan(500);
  });

  it('caps the played notes it aligns', () => {
    const played = Array.from({ length: 200 }, (_, i) => 20 + (i % 7));
    const r = alignHands(played, [60, 62], [48, 50]);
    expect(r.capped).toBe(true);
    // Twelve are aligned, four of them as wrong keys; the rest are extra.
    const wrong = [...r.right.wrong, ...r.left.wrong];
    expect(wrong).toHaveLength(4);
    expect(wrong.every((w) => w.played < 12)).toBe(true);
    expect(r.extra).toHaveLength(196);
    expect(r.extra.slice(8)).toEqual(Array.from({ length: 188 }, (_, i) => 12 + i));
  });
});

// --- The band against the whole table -----------------------------------------------------------

/**
 * The hands-together DP as it was before the band (S1): the whole (played × right × left) table.
 * It returns the DP's own result, a wrong key still a missed note and an extra one.
 */
function wholeTable(played: readonly number[], right: readonly number[], left: readonly number[]) {
  const R = right.length;
  const L = left.length;
  const m = Math.min(played.length, MAX_PLAYED_PER_EXPECTED * (R + L));
  const wk = L + 1;
  const wj = (R + 1) * wk;
  const cost = new Int32Array((m + 1) * wj);
  const from = new Uint8Array((m + 1) * wj);
  const lag = (j: number, k: number) => Math.max(0, Math.abs(j - k) - 1) * 3;
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= R; j++) {
      for (let k = 0; k <= L; k++) {
        const at = i * wj + j * wk + k;
        if (at === 0) continue;
        const move = lag(j, k);
        // In order of preference; a later option wins only when strictly cheaper.
        let best = Infinity;
        let how = 0;
        const consider = (c: number, option: number) => {
          if (c < best) [best, how] = [c, option];
        };
        if (i > 0 && j > 0 && played[i - 1] === right[j - 1])
          consider(cost[at - wj - wk]! + move, 1);
        if (i > 0 && k > 0 && played[i - 1] === left[k - 1]) consider(cost[at - wj - 1]! + move, 2);
        if (i > 0) consider(cost[at - wj]! + 5, 3);
        if (j > 0) consider(cost[at - wk]! + 5 + move, 4);
        if (k > 0) consider(cost[at - 1]! + 5 + move, 5);
        from[at] = how;
        cost[at] = best;
      }
    }
  }
  const out = {
    right: { played: new Array<number | null>(R).fill(null), missed: [] as number[] },
    left: { played: new Array<number | null>(L).fill(null), missed: [] as number[] },
    extra: [] as number[],
  };
  for (let x = played.length - 1; x >= m; x--) out.extra.push(x);
  let [i, j, k] = [m, R, L];
  while (i > 0 || j > 0 || k > 0) {
    const how = from[i * wj + j * wk + k];
    if (how === 1) out.right.played[--j] = --i;
    else if (how === 2) out.left.played[--k] = --i;
    else if (how === 3) out.extra.push(--i);
    else if (how === 4) out.right.missed.push(--j);
    else out.left.missed.push(--k);
  }
  out.right.missed.reverse();
  out.left.missed.reverse();
  out.extra.sort((a, b) => a - b);
  return out;
}

/** An alignment with its wrong keys turned back into the DP's missed and extra notes. */
function beforeWrongKeys(a: HandsAlignment) {
  const hand = (h: HandsAlignment['right']) => ({
    played: h.played,
    missed: [...h.missed, ...h.wrong.map((w) => w.index)].sort((x, y) => x - y),
  });
  const wrongPlayed = [...a.right.wrong, ...a.left.wrong].map((w) => w.played);
  return {
    right: hand(a.right),
    left: hand(a.left),
    extra: [...a.extra, ...wrongPlayed].sort((x, y) => x - y),
  };
}

/** Every played note is matched, a wrong key or extra, once. */
function accountsForEvery(a: HandsAlignment, played: number): boolean {
  const seen = [
    ...[...a.right.played, ...a.left.played].filter((p) => p !== null),
    ...[...a.right.wrong, ...a.left.wrong].map((w) => w.played),
    ...a.extra,
  ].sort((x, y) => x - y);
  return seen.length === played && seen.every((p, i) => p === i);
}

/** Up and down `octaves` chromatic octaves from `tonic`. */
function chromatic(tonic: number, octaves: number): number[] {
  const up = Array.from({ length: 12 * octaves + 1 }, (_, i) => tonic + i);
  return [...up, ...up.slice(0, -1).reverse()];
}

/** Right hand at time t plays its note t, the left hand its note t − `behind`. */
function laggingLeft(right: readonly number[], left: readonly number[], behind: number): number[] {
  const played: number[] = [];
  for (let t = 0; t < right.length + behind; t++) {
    if (t < right.length) played.push(right[t]!);
    if (t >= behind) played.push(left[t - behind]!);
  }
  return played;
}

describe('alignHands in a band', () => {
  it('finds the alignment of the whole table in runs with every kind of mistake', () => {
    // Onset jitter up to 0.7 of a note; a hand up to 6 notes behind over a stretch; up to 12 notes
    // of a hand missed in a row; early stops; a burst of stray keys; wrong keys and extra notes.
    const rng = seededRng(77);
    const gaussian = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]!;
    for (let run = 0; run < 250; run++) {
      const diatonic = rng() < 0.7;
      const octaves = 1 + Math.floor(rng() * (diatonic ? 3 : 2));
      const right = diatonic ? upDown(48, octaves) : chromatic(48, octaves);
      const left = right.map((x) => x - 12);
      const sigma = pick([0.05, 0.2, 0.4, 0.7]);
      const [miss, wrong, extra] = [pick([0.02, 0.08]), pick([0.02, 0.08]), pick([0.02, 0.08])];
      const lagging = pick(['right', 'left']);
      const behind = rng() < 0.4 ? Math.floor(rng() * 7) : 0;
      const lagFrom = Math.floor(rng() * right.length);
      const lagTo = lagFrom + Math.floor(rng() * right.length);
      const gapHand = pick(['right', 'left']);
      const gap = rng() < 0.4 ? 2 + Math.floor(rng() * 11) : 0;
      const gapAt = Math.floor(rng() * right.length);
      const stopHand = pick(['right', 'left']);
      const stopAt = rng() < 0.15 ? Math.floor(rng() * right.length) : Infinity;
      const notes: { t: number; midi: number }[] = [];
      for (const [hand, run] of [
        ['right', right],
        ['left', left],
      ] as const) {
        run.forEach((midi, i) => {
          if (hand === gapHand && i >= gapAt && i < gapAt + gap) return;
          if (hand === stopHand && i >= stopAt) return;
          const u = rng();
          if (u < miss) return;
          const late = hand === lagging && i >= lagFrom && i < lagTo ? behind : 0;
          const t = i + sigma * gaussian() + late;
          notes.push({ t, midi: u < miss + wrong ? midi + pick([-2, -1, 1, 2]) : midi });
          if (rng() < extra) notes.push({ t: t + 0.1, midi: midi + pick([-3, -1, 1, 2, 4]) });
        });
      }
      if (rng() < 0.1) {
        const at = rng() * right.length;
        for (let x = 0; x < 5 + rng() * 30; x++) notes.push({ t: at + x / 50, midi: pick(right) });
      }
      const played = notes.sort((a, b) => a.t - b.t).map((n) => n.midi);
      const banded = alignHands(played, right, left);
      expect(beforeWrongKeys(banded), `run ${run}`).toEqual(wholeTable(played, right, left));
      expect(accountsForEvery(banded, played.length)).toBe(true);
    }
  });

  it('follows a hand two notes behind the other', () => {
    const right = upDown(60, 2);
    const left = right.map((x) => x - 12);
    const played = laggingLeft(right, left, 2);
    const r = alignHands(played, right, left);
    expect(beforeWrongKeys(r)).toEqual(wholeTable(played, right, left));
    expect(r.left.played.every((p) => p !== null)).toBe(true);
    expect(r.left.missed).toEqual([]);
  });

  it('a hand three notes behind or more has its notes missed and played extra, as over the whole table', () => {
    const right = upDown(60, 2);
    const left = right.map((x) => x - 12);
    for (const behind of [3, HANDS_BAND + 1, 2 * HANDS_BAND]) {
      const played = laggingLeft(right, left, behind);
      const r = alignHands(played, right, left);
      expect(beforeWrongKeys(r), `${behind} behind`).toEqual(wholeTable(played, right, left));
      expect(accountsForEvery(r, played.length)).toBe(true);
      expect(r.right.played.every((p) => p !== null)).toBe(true);
      // The left hand is matched only where it is close enough to the right (the first notes, the
      // turn, the end); the rest of its notes are missed and its keys extra.
      const lost = r.left.missed.length + r.left.wrong.length;
      expect(lost, `${behind} behind`).toBeGreaterThan(right.length / 2);
      expect(r.extra.length + r.left.wrong.length).toBe(lost);
    }
  });

  it('keeps hands of different lengths in the band to the end', () => {
    const right = upDown(60, 2);
    const left = right.slice(0, 20).map((x) => x - 12);
    const played = interleaveShort(right, left);
    const r = alignHands(played, right, left);
    expect(beforeWrongKeys(r)).toEqual(wholeTable(played, right, left));
    expect(r.right.played.every((p) => p !== null)).toBe(true);
    expect(r.left.played.every((p) => p !== null)).toBe(true);
    expect(r.extra).toEqual([]);
  });
});

/** Both hands note for note while the shorter one lasts, then the longer one alone. */
function interleaveShort(right: readonly number[], left: readonly number[]): number[] {
  return right.flatMap((x, i) => (i < left.length ? [x, left[i]!] : [x]));
}
