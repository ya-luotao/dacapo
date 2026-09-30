import { describe, expect, it } from 'vitest';
import {
  analyzeRun,
  BALANCE_FLOOR,
  CHORD_APART_MS,
  PATTERN_MIN_Z,
  type PlayedNote,
} from './evenness.ts';
import { seededRng } from './random.ts';
import { alignChords, CHORD_CHAIN_MS, chordClusters } from './scaleAlign.ts';
import { scaleNotes } from './scales.ts';
import { stepsOf, type ScaleExercise } from './scaleTypes.ts';

const C_CHORDS: ScaleExercise = { type: 'majorChords', tonic: 'C', octaves: 2, hands: 'right' };
const C_BOTH: ScaleExercise = { ...C_CHORDS, hands: 'both' };

/** Plays each step's keys at `ioi` apart, `at(step, key)` added to each key's onset. */
function play(
  e: ScaleExercise,
  ioi = 400,
  at: (step: number, key: number, midi: number) => number = () => 0,
  velocity: (step: number, key: number) => number = () => 64,
): PlayedNote[] {
  const { right, left } = scaleNotes(e);
  const steps = [stepsOf(right), stepsOf(left)];
  const out: PlayedNote[] = [];
  const length = Math.max(steps[0]!.length, steps[1]!.length);
  for (let s = 0; s < length; s++) {
    const keys = [...(steps[1]![s] ?? []), ...(steps[0]![s] ?? [])];
    keys.forEach((n, k) => {
      const on = s * ioi + at(s, k, n.midi);
      out.push({ midi: n.midi, on, off: on + ioi * 0.8, velocity: velocity(s, k) });
    });
  }
  return out.sort((a, b) => a.on - b.on);
}

const analyze = (e: ScaleExercise, played: PlayedNote[], velocityMeasured = true) => {
  const { right, left } = scaleNotes(e);
  return analyzeRun({ expected: [...right, ...left], played, velocityMeasured });
};

describe('alignChords', () => {
  it('clusters keys each within the chain of the one before', () => {
    expect(chordClusters([0, 10, 50, 200, 250, 400])).toEqual([[0, 1, 2], [3, 4], [5]]);
    expect(chordClusters([0, CHORD_CHAIN_MS, 2 * CHORD_CHAIN_MS + 1])).toEqual([[0, 1], [2]]);
  });

  it('matches each chord whatever order its keys came in', () => {
    const played = [
      { midi: 67, on: 0 },
      { midi: 60, on: 5 },
      { midi: 64, on: 9 },
      { midi: 72, on: 400 },
      { midi: 64, on: 402 },
      { midi: 67, on: 404 },
    ];
    const a = alignChords(played, [
      [60, 64, 67],
      [64, 67, 72],
    ]);
    expect(a.steps.map((s) => s.played)).toEqual([
      [1, 2, 0],
      [4, 5, 3],
    ]);
    expect(a.extra).toEqual([]);
  });

  it('takes a wrong key as one mistake, and a key too many as extra', () => {
    const played = [
      { midi: 60, on: 0 },
      { midi: 65, on: 3 },
      { midi: 67, on: 6 },
      { midi: 64, on: 400 },
      { midi: 67, on: 401 },
      { midi: 72, on: 402 },
      { midi: 74, on: 403 },
    ];
    const a = alignChords(played, [
      [60, 64, 67],
      [64, 67, 72],
    ]);
    expect(a.steps[0]).toEqual({
      played: [0, null, 2],
      wrong: [{ key: 1, played: 1 }],
      missed: [],
    });
    expect(a.steps[1]!.played).toEqual([3, 4, 5]);
    expect(a.extra).toEqual([6]);
  });

  it('lets a chord take two clusters: one hand 80 ms after the other', () => {
    const played = [
      { midi: 48, on: 0 },
      { midi: 52, on: 2 },
      { midi: 60, on: 80 },
      { midi: 64, on: 82 },
      { midi: 52, on: 400 },
      { midi: 55, on: 401 },
      { midi: 64, on: 480 },
      { midi: 67, on: 481 },
    ];
    const a = alignChords(played, [
      [48, 52, 60, 64],
      [52, 55, 64, 67],
    ]);
    expect(a.steps.map((s) => s.played)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]);
  });

  it('misses a chord not played and keeps the rest in place', () => {
    const played = [
      { midi: 60, on: 0 },
      { midi: 64, on: 1 },
      { midi: 67, on: 2 },
      { midi: 67, on: 800 },
      { midi: 72, on: 801 },
      { midi: 76, on: 802 },
    ];
    const a = alignChords(played, [
      [60, 64, 67],
      [64, 67, 72],
      [67, 72, 76],
    ]);
    expect(a.steps[1]).toEqual({ played: [null, null, null], wrong: [], missed: [0, 1, 2] });
    expect(a.steps[2]!.played).toEqual([3, 4, 5]);
  });
});

describe('a run of chords', () => {
  it('measures a clean run chord by chord: every key right, spread and balance', () => {
    const rng = seededRng(3);
    const played = play(
      C_CHORDS,
      400,
      (_, k) => k * 4 + rng() * 2,
      (_, k) => (k === 2 ? 76 : 60),
    );
    const a = analyze(C_CHORDS, played);
    expect(a.quality).toBe('ok');
    expect(a.counts).toEqual({ expected: 39, matched: 39, wrong: 0, missed: 0, extra: 0 });
    const hand = a.hands[0]!;
    expect(hand.notes).toHaveLength(13);
    expect(hand.notes.every((n) => n.outcome === 'played')).toBe(true);
    for (const n of hand.notes) {
      expect(n.chord!.keys).toBe(3);
      expect(n.chord!.spread).toBeGreaterThanOrEqual(6);
      expect(n.chord!.spread).toBeLessThan(10);
      expect(n.chord!.balance).toBe(16);
      // The chord's velocity is its keys' median.
      expect(n.velocity).toBe(60);
    }
    const c = hand.chords!;
    expect(c.chords).toBe(13);
    expect(c.broken).toEqual([]);
    expect(c.topOver).toHaveLength(13);
    expect(c.topUnder).toEqual([]);
    expect(c.medianBalance).toBe(16);
    // Range: 60 to 76 over 39 keys, 5th to 95th percentile.
    expect(c.balanceStep).toBeGreaterThanOrEqual(BALANCE_FLOOR);
    // Timing: the chords' first keys, every 400 ms.
    expect(hand.timing.medianInterval).toBeCloseTo(400, -1);
  });

  it('calls a chord broken when its keys spread beyond 30 ms', () => {
    const played = play(C_CHORDS, 400, (s, k) => (s === 4 && k === 2 ? 45 : k));
    const hand = analyze(C_CHORDS, played).hands[0]!;
    expect(hand.notes[4]!.chord!.spread).toBe(45);
    expect(hand.chords!.broken).toEqual([4]);
    expect(CHORD_APART_MS).toBe(30);
  });

  it('counts keys for the gate: a chord with a wrong key is one mistake', () => {
    const played = play(C_CHORDS).map((p, i) => (i === 7 ? { ...p, midi: p.midi + 1 } : p));
    const a = analyze(C_CHORDS, played);
    expect(a.counts).toEqual({ expected: 39, matched: 38, wrong: 1, missed: 0, extra: 0 });
    expect(a.hands[0]!.notes[2]!.outcome).toBe('wrong');
    expect(a.hands[0]!.notes[2]!.chord!.spread).toBeNull();
    // No interval into or out of the wrong chord.
    expect(a.hands[0]!.notes[2]!.interval).toBeNull();
    expect(a.hands[0]!.notes[3]!.interval).toBeNull();
    expect(a.quality).toBe('ok');
  });

  it('measures each hand’s chords hands together, and the hands against each other', () => {
    // The right hand 20 ms after the left, every chord.
    const played = play(C_BOTH, 400, (_, k) => (k >= 3 ? 20 : 0));
    const a = analyze(C_BOTH, played);
    expect(a.quality).toBe('ok');
    expect(a.hands.map((h) => h.counts.matched)).toEqual([39, 39]);
    expect(a.together!.median).toBe(20);
    for (const h of a.hands) expect(h.chords!.medianSpread).toBe(0);
  });

  it('has no balance without velocity, never zero', () => {
    const a = analyze(C_CHORDS, play(C_CHORDS), false);
    const c = a.hands[0]!.chords!;
    expect(c.range).toBeNull();
    expect(c.medianBalance).toBeNull();
    expect(a.hands[0]!.notes.every((n) => n.chord!.balance === null)).toBe(true);
  });

  it('joins the chords voice by voice for the connection', () => {
    // Each key held 30 ms into the next chord, but the top voice let go 20 ms before it.
    const plain = play(C_CHORDS);
    const top = (p: PlayedNote) =>
      p.midi === Math.max(...plain.filter((q) => q.on === p.on).map((q) => q.midi));
    const played = plain.map((p) => ({ ...p, off: p.on + (top(p) ? 380 : 430) }));
    const hand = analyze(C_CHORDS, played).hands[0]!;
    expect(hand.notes[0]!.overlap).toBe(-20);
    expect(hand.connection!.medianOverlap).toBe(-20);
  });
});

describe('a pattern that never turns (the five-finger group)', () => {
  it('measures every note, the last ones too, in one direction', () => {
    const e: ScaleExercise = { type: 'majorFiveFinger', tonic: 'G', octaves: 1, hands: 'right' };
    const expected = scaleNotes(e).right;
    const rng = seededRng(5);
    const played = expected.map((n, i) => {
      const on = i * 250 + (rng() - 0.5) * 20;
      return { midi: n.midi, on, off: on + 200, velocity: 64 };
    });
    const hand = analyzeRun({ expected, played, velocityMeasured: false }).hands[0]!;
    expect(hand.notes.every((n) => n.deviation !== null && Number.isFinite(n.deviation))).toBe(
      true,
    );
    expect(hand.notes.some((n) => n.turn)).toBe(false);
    // Every interval counts: none is a turn's.
    expect(hand.timing.intervals).toBe(expected.length - 1);
    expect(hand.timing.rough).toBe(false);
  });
});

describe('a pattern’s places in one run', () => {
  it('names a note of every group late, by its place in the group', () => {
    const e: ScaleExercise = { type: 'majorBrokenChords', tonic: 'C', octaves: 2, hands: 'right' };
    const expected = scaleNotes(e).right;
    const rng = seededRng(11);
    const played = expected.map((n, i) => {
      const late = n.degree === 2 && n.direction === 'up' && i > 0 ? 40 : 0;
      const on = i * 200 + (rng() - 0.5) * 8 + late;
      return { midi: n.midi, on, off: on + 180, velocity: 64 };
    });
    const a = analyzeRun({ expected, played, velocityMeasured: false });
    expect(a.problem).toMatchObject({ hand: 'right', direction: 'up', crossing: null, degree: 2 });
    expect(a.problem!.deviation).toBeGreaterThan(25);
    expect(PATTERN_MIN_Z).toBe(3);
    // The same run without the late notes names nothing.
    const even = expected.map((n, i) => {
      const on = i * 200 + (rng() - 0.5) * 8;
      return { midi: n.midi, on, off: on + 180, velocity: 64 };
    });
    expect(analyzeRun({ expected, played: even, velocityMeasured: false }).problem).toBeNull();
  });
});

describe('a line closing on a chord (Hanon No. 20)', () => {
  const e: ScaleExercise = { type: 'hanon', tonic: 'C', octaves: 2, hands: 'both', variant: '20' };
  const { right, left } = scaleNotes(e);
  const expected = [...right, ...left];
  const last = right.at(-1)!.index;
  /** Every step both hands, 125 ms apart; `drop`/`late` change the right hand's closing C4. */
  function run(change?: { drop?: true; late?: number }): PlayedNote[] {
    const out: PlayedNote[] = [];
    for (let s = 0; s <= last; s++) {
      for (const n of expected.filter((x) => x.index === s)) {
        const top = s === last && n.hand === 'right' && n.midi === 60;
        if (top && change?.drop) continue;
        const on = s * 125 + (n.hand === 'left' ? 4 : 0) + (top ? (change?.late ?? 6) : 0);
        out.push({ midi: n.midi, on, off: on + 110, velocity: 64 });
      }
    }
    return out.sort((a, b) => a.on - b.on);
  }

  it('aligns the line note by note and takes the chord’s other key from the keys struck with it', () => {
    const a = analyzeRun({ expected, played: run(), velocityMeasured: false });
    expect(a.quality).toBe('ok');
    expect(a.counts.matched).toBe(a.counts.expected);
    expect(a.counts.extra).toBe(0);
    for (const hand of a.hands) {
      const close = hand.notes.at(-1)!;
      expect(close.outcome).toBe('played');
      expect(close.chord?.keys).toBe(2);
      // One chord: its figures, but no summary of chords.
      expect(hand.chords).toBeUndefined();
      expect(hand.notes.slice(0, -1).every((n) => n.chord === undefined)).toBe(true);
    }
    expect(a.hands[0]!.notes.at(-1)!.chord!.spread).toBe(6);
  });

  it('a chord key not struck is a missed key, and the chord a mistake', () => {
    const a = analyzeRun({ expected, played: run({ drop: true }), velocityMeasured: false });
    expect(a.counts.missed).toBe(1);
    expect(a.counts.extra).toBe(0);
    expect(a.hands[0]!.notes.at(-1)!.outcome).toBe('wrong');
    expect(a.hands[1]!.notes.at(-1)!.outcome).toBe('played');
  });

  it('a chord key struck long after the chord is not its key', () => {
    const a = analyzeRun({ expected, played: run({ late: 300 }), velocityMeasured: false });
    expect(a.counts.missed).toBe(1);
    expect(a.counts.extra).toBe(1);
    expect(a.hands[0]!.notes.at(-1)!.outcome).toBe('wrong');
  });
});
