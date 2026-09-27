import { describe, expect, it } from 'vitest';
import { seededRng } from './random.ts';
import { alignHand, alignHands, MAX_PLAYED_PER_EXPECTED } from './scaleAlign.ts';

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
    const t0 = performance.now();
    const r = alignHands(played, right, left);
    const ms = performance.now() - t0;
    expect(r.extra).toEqual([]);
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
