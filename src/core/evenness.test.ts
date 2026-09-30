import { describe, expect, it } from 'vitest';
import {
  ACCENT_VELOCITY,
  analyzeRun,
  APART_MS,
  GAP_MS,
  LEAD_MS,
  MAX_ERROR_SHARE,
  MIN_CONNECTED,
  MIN_MATCHED,
  runHeadline,
  ANALYSIS_VERSION,
  runQuality,
  type PlayedNote,
  type RunAnalysis,
  type RunInput,
} from './evenness.ts';
import { seededRng, type Rng } from './random.ts';
import { quantile } from './robust.ts';
import { scaleNotes, tonicsOf } from './scales.ts';
import type { Hand } from './score.ts';
import { SCALE_OCTAVES, SCALE_TYPES, type ScaleNote } from './scaleTypes.ts';

const STEPS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const SEMITONES = [0, 2, 4, 5, 7, 9, 11];
/** Right hand, C major going up: 1 2 3 1 2 3 4, the top note 5. */
const RIGHT_FINGERS = [1, 2, 3, 1, 2, 3, 4];
/** Left hand, C major going up: 5 4 3 2 1 3 2, the top note 1. */
const LEFT_FINGERS = [5, 4, 3, 2, 1, 3, 2];

/** C major up `octaves` octaves and back down, with Hanon's fingering and its crossings. */
function cMajor(octaves: number, hand: Hand = 'right'): ScaleNote[] {
  const up = 7 * octaves + 1;
  const count = 2 * up - 1;
  const base = hand === 'right' ? 4 : 3;
  const notes: ScaleNote[] = [];
  for (let index = 0; index < count; index++) {
    const pos = index < up ? index : count - 1 - index;
    const degree = pos % 7;
    const octave = base + Math.floor(pos / 7);
    const direction = index < up ? 'up' : 'down';
    const turn = index === up - 1;
    const finger = turn
      ? hand === 'right'
        ? 5
        : 1
      : (hand === 'right' ? RIGHT_FINGERS : LEFT_FINGERS)[degree]!;
    const prev = notes[index - 1];
    let crossing: ScaleNote['crossing'] = null;
    if (prev) {
      const thumbGoing = hand === 'right' ? 'up' : 'down';
      if (direction === thumbGoing && finger === 1 && prev.finger !== 2) crossing = 'thumbUnder';
      if (direction !== thumbGoing && prev.finger === 1 && finger > 2) crossing = 'fingerOver';
    }
    notes.push({
      hand,
      index,
      pitch: { step: STEPS[degree]!, alter: 0, octave },
      midi: 12 * (octave + 1) + SEMITONES[degree]!,
      finger,
      direction,
      turn,
      degree,
      crossing,
    });
  }
  return notes;
}

interface Player {
  octaves: number;
  /** Interval at the start, ms. */
  ioi: number;
  /** Onset jitter, ms: a steady player's SD(IOI) is σ√2. */
  sigma: number;
  /** Tempo change over the run (+0.3: 30 % faster at the end). */
  drift?: number;
  /** Every thumb passing under comes this late, ms. */
  thumb?: number;
  /** Hesitations: this many, each delaying everything after it by `stop` ms. */
  stops?: number;
  stop?: number;
  /** A pause after the top note, ms. */
  turnPause?: number;
  velocity?: number;
  /** Each key comes up this long after the next goes down, ms (negative: a gap); else 0.9 × ioi. */
  legato?: number;
  /** Release jitter with `legato`, ms. */
  releaseSigma?: number;
  /** With `legato`: the key before each thumb passing under comes up this long before it, ms. */
  thumbGap?: number;
}

interface Simulated {
  notes: ScaleNote[];
  played: PlayedNote[];
  stopsAt: Set<number>;
}

function gaussian(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

/** One run of a player, right hand, every note played with the right key. */
function play(rng: Rng, p: Player): Simulated {
  const notes = cMajor(p.octaves);
  const n = notes.length;
  const turn = notes.findIndex((x) => x.turn);
  const on: number[] = [];
  let clock = 0;
  for (let i = 0; i < n; i++) {
    const late = notes[i]!.crossing === 'thumbUnder' ? (p.thumb ?? 0) : 0;
    on.push(clock + p.sigma * gaussian(rng) + late);
    clock += p.ioi / (1 + ((p.drift ?? 0) * i) / (n - 1)) + (i === turn ? (p.turnPause ?? 0) : 0);
  }
  const stopsAt = new Set<number>();
  while (stopsAt.size < (p.stops ?? 0)) {
    const at = 3 + Math.floor(rng() * (n - 6));
    if (at === turn || at === turn + 1 || stopsAt.has(at)) continue;
    stopsAt.add(at);
    for (let i = at; i < n; i++) on[i]! += p.stop ?? 150;
  }
  const played = notes.map((x, i) => ({
    midi: x.midi,
    on: on[i]!,
    off: on[i]! + 0.9 * p.ioi,
    velocity: Math.round(70 + (p.velocity ?? 0) * gaussian(rng)),
  }));
  if (p.legato !== undefined) {
    // Releases against the next onset as played, stops included; the last key as before.
    for (let i = 0; i < n - 1; i++) {
      const overlap =
        notes[i + 1]!.crossing === 'thumbUnder' ? -(p.thumbGap ?? -p.legato) : p.legato;
      played[i]!.off = on[i + 1]! + overlap + (p.releaseSigma ?? 0) * gaussian(rng);
    }
  }
  return { notes, played, stopsAt };
}

interface Pair {
  octaves: number;
  ioi: number;
  /** Onset jitter per hand, ms. */
  sigma: number;
  /** The right hand comes this late on average, ms. */
  lag?: number;
  /** Each key comes up this long after the same hand's next key goes down; else no releases. */
  legato?: number;
  /** Right-hand notes played this much later still, by index, ms. */
  shift?: Record<number, number>;
  /** Left-hand notes left out, by index. */
  leftMissing?: number[];
}

/** One run hands together, C major an octave apart, every note played with the right key. */
function playBoth(rng: Rng, p: Pair): { expected: ScaleNote[]; played: PlayedNote[] } {
  const right = cMajor(p.octaves, 'right');
  const left = cMajor(p.octaves, 'left');
  const hands = [
    { run: right, lag: p.lag ?? 0 },
    { run: left, lag: 0 },
  ].map(({ run, lag }) => {
    const on = run.map(
      (x, i) =>
        p.ioi * i + lag + p.sigma * gaussian(rng) + (x.hand === 'right' ? (p.shift?.[i] ?? 0) : 0),
    );
    return run
      .map((x, i) => ({
        midi: x.midi,
        on: on[i]!,
        off: p.legato === undefined ? null : (on[i + 1] ?? on[i]! + p.ioi) + p.legato,
        velocity: 70,
      }))
      .filter((_, i) => run[i]!.hand === 'right' || !p.leftMissing?.includes(i));
  });
  return {
    expected: [...left, ...right],
    played: hands.flat().sort((a, b) => a.on - b.on),
  };
}

const together = (input: Omit<RunInput, 'velocityMeasured'>) =>
  analyzeRun({ ...input, velocityMeasured: false }).together;

const analyze = (s: Simulated, velocityMeasured = false) =>
  analyzeRun({ expected: s.notes, played: s.played, velocityMeasured });

const mean = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const median = (v: readonly number[]) => quantile(v, 0.5)!;

function sdIoi(s: Simulated): number {
  const turn = s.notes.findIndex((x) => x.turn);
  const iois = s.played
    .slice(1)
    .map((p, i) => p.on - s.played[i]!.on)
    .filter((_, i) => i !== turn - 1 && i !== turn);
  const m = mean(iois);
  return Math.sqrt(iois.reduce((a, x) => a + (x - m) ** 2, 0) / (iois.length - 1));
}

/** Mean deviation of the thumb notes, and that minus the mean of the other notes. */
function thumbFigures(a: RunAnalysis): { thumb: number; relative: number } {
  const notes = a.hands[0]!.notes.filter((n) => n.deviation !== null && !n.turn);
  const thumb = mean(notes.filter((n) => n.crossing === 'thumbUnder').map((n) => n.deviation!));
  const other = mean(notes.filter((n) => n.crossing !== 'thumbUnder').map((n) => n.deviation!));
  return { thumb, relative: thumb - other };
}

describe('timing', () => {
  it('the spread of a steady player reads SD(IOI): the scaling constant', () => {
    const rng = seededRng(1);
    let spread = 0;
    let sd = 0;
    for (const octaves of [2, 3, 4])
      for (const [ioi, sigma] of [
        [125, 8],
        [250, 20],
        [300, 40],
      ] as const)
        for (let r = 0; r < 40; r++) {
          const s = play(rng, { octaves, ioi, sigma });
          spread += analyze(s).hands[0]!.timing.spread!;
          sd += sdIoi(s);
        }
    expect(spread / sd).toBeGreaterThan(0.95);
    expect(spread / sd).toBeLessThan(1.05);
  });

  it('recovers a steady player’s SD(IOI), in ms and in % of the interval', () => {
    const rng = seededRng(2);
    for (const [octaves, ioi, sigma] of [
      [2, 250, 20],
      [4, 125, 10],
    ] as const) {
      const runs = Array.from({ length: 100 }, () => analyze(play(rng, { octaves, ioi, sigma })));
      const spread = median(runs.map((a) => a.hands[0]!.timing.spread!));
      expect(spread / (sigma * Math.SQRT2)).toBeGreaterThan(0.85);
      expect(spread / (sigma * Math.SQRT2)).toBeLessThan(1.15);
      const share = median(runs.map((a) => a.hands[0]!.timing.spreadShare!));
      expect(share).toBeCloseTo((100 * sigma * Math.SQRT2) / ioi, -0.5);
      expect(runs.every((a) => !a.hands[0]!.timing.rough)).toBe(true);
    }
  });

  it('a tempo drift is not unevenness, and shows as the tempo at the start and the end', () => {
    const steady: number[] = [];
    const drifting: number[] = [];
    const tempo: number[] = [];
    const a = seededRng(3);
    const b = seededRng(3);
    for (let r = 0; r < 100; r++) {
      steady.push(analyze(play(a, { octaves: 4, ioi: 200, sigma: 10 })).hands[0]!.timing.spread!);
      const t = analyze(play(b, { octaves: 4, ioi: 200, sigma: 10, drift: 0.3 })).hands[0]!.timing;
      drifting.push(t.spread!);
      tempo.push(t.endInterval! / t.startInterval!);
    }
    expect(median(drifting) / median(steady)).toBeGreaterThan(0.93);
    expect(median(drifting) / median(steady)).toBeLessThan(1.07);
    // 30 % faster at the end: the last intervals are about 1/1.28 of the first.
    expect(median(tempo)).toBeGreaterThan(0.74);
    expect(median(tempo)).toBeLessThan(0.82);
  });

  it('places a late thumb at the thumb notes, with or without a drift', () => {
    const rng = seededRng(4);
    for (const drift of [0, 0.25]) {
      const figures = Array.from({ length: 100 }, () =>
        thumbFigures(
          analyze(play(rng, { octaves: drift ? 4 : 2, ioi: 250, sigma: 15, thumb: 25, drift })),
        ),
      );
      // Against the other notes: the bump itself.
      expect(Math.abs(mean(figures.map((f) => f.relative)) - 25)).toBeLessThan(5);
      // As shown: a little less, since the lines pass through other thumb notes too.
      expect(mean(figures.map((f) => f.thumb))).toBeGreaterThan(19);
      expect(mean(figures.map((f) => f.thumb))).toBeLessThan(30);
    }
  });

  it('finds hesitations and stays quiet for a steady beginner', () => {
    const rng = seededRng(5);
    let due = 0;
    let found = 0;
    let falseFound = 0;
    for (let r = 0; r < 200; r++) {
      const s = play(rng, { octaves: 2, ioi: 250, sigma: 20, stops: 2, stop: 150 });
      const h = analyze(s).hands[0]!.timing.hesitations;
      due += s.stopsAt.size;
      found += h.filter((x) => s.stopsAt.has(x.index)).length;
      falseFound += h.filter((x) => !s.stopsAt.has(x.index)).length;
      for (const x of h.filter((x) => s.stopsAt.has(x.index))) {
        expect(x.excess).toBeGreaterThan(60);
        expect(x.excess).toBeLessThan(240);
      }
    }
    expect(found / due).toBeGreaterThanOrEqual(0.7);
    expect(falseFound / 200).toBeLessThan(0.05);

    let flagged = 0;
    for (let r = 0; r < 200; r++) {
      const t = analyze(play(rng, { octaves: 2, ioi: 250, sigma: 40 })).hands[0]!.timing;
      if (t.hesitations.length > 0) flagged++;
    }
    expect(flagged / 200).toBeLessThanOrEqual(0.15);
  });

  it('a hesitation is left out of the spread', () => {
    const a = seededRng(6);
    const b = seededRng(6);
    const clean: number[] = [];
    const stopped: number[] = [];
    for (let r = 0; r < 100; r++) {
      clean.push(analyze(play(a, { octaves: 2, ioi: 250, sigma: 10 })).hands[0]!.timing.spread!);
      stopped.push(
        analyze(play(b, { octaves: 2, ioi: 250, sigma: 10, stops: 2, stop: 300 })).hands[0]!.timing
          .spread!,
      );
    }
    expect(median(stopped) / median(clean)).toBeLessThan(1.1);
  });

  it('closes the gaps, so stops do not scatter the thumb figure', () => {
    const rng = seededRng(7);
    const figures = Array.from(
      { length: 150 },
      () =>
        thumbFigures(
          analyze(play(rng, { octaves: 2, ioi: 250, sigma: 10, thumb: 25, stops: 2, stop: 150 })),
        ).relative,
    );
    // A stop just at or after a thumb takes some of its lateness with it: ~3 ms lower on average.
    expect(mean(figures)).toBeGreaterThan(17);
    expect(mean(figures)).toBeLessThan(30);
    // Without closing the gaps the 10–90 % range is about 62 ms wide (−9 to 53); closed, ~20.
    expect(quantile(figures, 0.9)! - quantile(figures, 0.1)!).toBeLessThan(30);
  });

  it('leaves the intervals around the turn out of the figures', () => {
    const a = seededRng(8);
    const b = seededRng(8);
    for (let r = 0; r < 20; r++) {
      const plain = analyze(play(a, { octaves: 2, ioi: 250, sigma: 15 }));
      const breath = analyze(play(b, { octaves: 2, ioi: 250, sigma: 15, turnPause: 600 }));
      const t = breath.hands[0]!.timing;
      expect(t.hesitations).toEqual([]);
      expect(t.spread).toBeCloseTo(plain.hands[0]!.timing.spread!, 6);
      expect(t.intervals).toBe(26);
      const afterTop = breath.hands[0]!.notes[15]!;
      expect(afterTop.turnInterval).toBe(true);
      expect(afterTop.interval).toBeGreaterThan(700);
      expect(afterTop.hesitation).toBeNull();
    }
  });

  it('calls one octave rough', () => {
    const rng = seededRng(9);
    const one = analyze(play(rng, { octaves: 1, ioi: 250, sigma: 20 })).hands[0]!.timing;
    expect(one.rough).toBe(true);
    expect(one.spread).not.toBeNull();
    const two = analyze(play(rng, { octaves: 2, ioi: 250, sigma: 20 })).hands[0]!.timing;
    expect(two.rough).toBe(false);
    // Two octaves with one missed note: 24 intervals left, not rough.
    const s = play(rng, { octaves: 2, ioi: 250, sigma: 20 });
    s.played.splice(9, 1);
    const missed = analyze(s).hands[0]!.timing;
    expect(missed.intervals).toBe(24);
    expect(missed.rough).toBe(false);
  });

  it('a missed or wrong note breaks the intervals around it', () => {
    const s = play(seededRng(10), { octaves: 2, ioi: 250, sigma: 10 });
    s.played[5]!.midi += 1; // a wrong key at A4
    s.played.splice(9, 1); // E5 missed
    const hand = analyze(s).hands[0]!;
    expect(hand.counts).toEqual({ expected: 29, matched: 27, wrong: 1, missed: 1 });
    const n = hand.notes;
    expect(n[5]!.outcome).toBe('wrong');
    expect(n[9]!.outcome).toBe('missed');
    expect([n[5]!.interval, n[6]!.interval, n[9]!.interval, n[10]!.interval]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(n[5]!.deviation).toBeNull();
    expect(n[6]!.deviation).not.toBeNull();
    expect(n[4]!.interval).not.toBeNull();
    // Four intervals lost: 22 left, fewer than 24, so rough.
    expect(hand.timing.rough).toBe(true);
    expect(hand.timing.intervals).toBe(22);
  });

  it('an extra note inside an interval breaks it', () => {
    const s = play(seededRng(11), { octaves: 2, ioi: 250, sigma: 10 });
    s.played.splice(7, 0, { midi: 90, on: s.played[6]!.on + 100, off: null, velocity: 60 });
    const a = analyze(s);
    expect(a.extra).toEqual([7]);
    expect(a.hands[0]!.notes[7]!.interval).toBeNull();
    expect(a.hands[0]!.notes[7]!.outcome).toBe('played');
  });
});

describe('loudness', () => {
  it('is not measured without velocity — null, never zero', () => {
    const a = analyze(play(seededRng(12), { octaves: 2, ioi: 250, sigma: 10, velocity: 4 }), false);
    expect(a.hands[0]!.loudness).toBeNull();
    expect(a.hands[0]!.notes.every((n) => n.velocity === null && n.velocityResidual === null)).toBe(
      true,
    );
    expect(runHeadline(a).velocityMeasured).toBe(false);
  });

  it('finds an accent and hardly any in plain noise', () => {
    const rng = seededRng(13);
    let spikes = 0;
    let caught = 0;
    let falseAccents = 0;
    let notes = 0;
    const spreads: number[] = [];
    for (let r = 0; r < 100; r++) {
      const quiet = analyze(play(rng, { octaves: 2, ioi: 250, sigma: 10, velocity: 4 }), true);
      const l = quiet.hands[0]!.loudness!;
      falseAccents += l.accents.length;
      notes += quiet.hands[0]!.notes.length;
      spreads.push(l.spread!);
      expect(l.medianVelocity).toBeGreaterThan(65);
      expect(l.medianVelocity).toBeLessThan(75);

      const s = play(rng, { octaves: 2, ioi: 250, sigma: 10, velocity: 4 });
      const at = 2 + Math.floor(rng() * 25);
      if (at === 14) continue; // the top note is left out
      s.played[at]!.velocity += 20;
      spikes++;
      if (analyze(s, true).hands[0]!.loudness!.accents.includes(at)) caught++;
    }
    expect(caught / spikes).toBeGreaterThan(0.95);
    // Noise σ = 4 crosses the provisional threshold for about 0.4 % of notes (so one run in ten
    // of two octaves shows one): the threshold is set from recorded runs in S1.
    expect(falseAccents / notes).toBeLessThan(0.01);
    // IQR of normal noise is 1.35 σ, a little more against a neighbours' median.
    expect(median(spreads)).toBeGreaterThan(4);
    expect(median(spreads)).toBeLessThan(8);
    expect(ACCENT_VELOCITY).toBe(12);
  });
});

describe('quality gate', () => {
  it('passes a scale run and rejects noodling, restarts and near-empty runs', () => {
    expect(runQuality({ expected: 29, matched: 20, wrong: 3, missed: 3, extra: 3 })).toBe('ok');
    expect(runQuality({ expected: 30, matched: 20, wrong: 4, missed: 3, extra: 3 })).toBe('ok');
    expect(runQuality({ expected: 30, matched: 20, wrong: 4, missed: 3, extra: 4 })).toBe(
      'not-a-scale-run',
    );
    expect(runQuality({ expected: 8, matched: 7, wrong: 0, missed: 1, extra: 0 })).toBe(
      'not-a-scale-run',
    );
    expect(MIN_MATCHED).toBe(8);
    expect(MAX_ERROR_SHARE).toBeCloseTo(1 / 3);

    const s = play(seededRng(14), { octaves: 2, ioi: 250, sigma: 10 });
    expect(analyze(s).quality).toBe('ok');
    // Played around before the tonic, then restarted: a third of the notes again as extras.
    const restart = { ...s, played: [...s.played.slice(0, 10), ...s.played] };
    expect(analyze(restart).quality).toBe('not-a-scale-run');
    expect(analyze({ ...s, played: s.played.slice(0, 7) }).quality).toBe('not-a-scale-run');
    expect(analyze({ ...s, played: [] }).quality).toBe('not-a-scale-run');
  });
});

describe('problem place', () => {
  it('names the late thumb, and rarely anything in a steady run', () => {
    const rng = seededRng(15);
    let named = 0;
    for (let r = 0; r < 50; r++) {
      const p = analyze(play(rng, { octaves: 3, ioi: 250, sigma: 10, thumb: 30 })).problem;
      if (p?.crossing === 'thumbUnder' && p.direction === 'up' && p.hand === 'right') {
        named++;
        expect(p.indexes).toEqual([3, 7, 10, 14, 17]);
        expect(p.deviation).toBeGreaterThan(15);
      }
    }
    expect(named / 50).toBeGreaterThan(0.9);

    // Not a scale run (played around first, a third of the notes again): no place is named.
    const late = play(rng, { octaves: 3, ioi: 250, sigma: 5, thumb: 40 });
    expect(analyze(late).problem).not.toBeNull();
    const noodled = analyze({ ...late, played: [...late.played.slice(0, 15), ...late.played] });
    expect(noodled.quality).toBe('not-a-scale-run');
    expect(noodled.problem).toBeNull();

    let spurious = 0;
    for (let r = 0; r < 100; r++) {
      if (analyze(play(rng, { octaves: 2, ioi: 250, sigma: 20 })).problem) spurious++;
    }
    expect(spurious / 100).toBeLessThan(0.12);
  });
});

describe('the result', () => {
  it('is plain data that survives JSON, and the headline carries the figures', () => {
    const s = play(seededRng(16), { octaves: 2, ioi: 250, sigma: 15 });
    for (const p of s.played.slice(5)) p.on += 300; // a stop before the 6th note
    s.played.splice(20, 1); // a missed note going down
    const a = analyze(s, true);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    const h = runHeadline(a);
    expect(h.hands[0]).toEqual({
      hand: 'right',
      spread: a.hands[0]!.timing.spread,
      spreadShare: a.hands[0]!.timing.spreadShare,
      rough: false,
      hesitations: 1,
      medianInterval: a.hands[0]!.timing.medianInterval,
    });
    expect(h.version).toBe(ANALYSIS_VERSION);
    expect(h).not.toHaveProperty('notes');
  });

  it('analyses both hands of a run hands together, each on its own', () => {
    const rng = seededRng(17);
    const right = cMajor(2, 'right');
    const left = cMajor(2, 'left');
    const played: PlayedNote[] = [];
    right.forEach((r, i) => {
      const t = 250 * i;
      const pair = [
        { midi: r.midi, on: t + 10 * gaussian(rng), off: null, velocity: 70 },
        { midi: left[i]!.midi, on: t + 10 * gaussian(rng), off: null, velocity: 70 },
      ].sort((x, y) => x.on - y.on);
      played.push(...pair);
    });
    const a = analyzeRun({ expected: [...left, ...right], played, velocityMeasured: false });
    expect(a.quality).toBe('ok');
    expect(a.hands.map((h) => h.hand)).toEqual(['right', 'left']);
    expect(a.counts).toEqual({ expected: 58, matched: 58, wrong: 0, missed: 0, extra: 0 });
    for (const h of a.hands) {
      expect(h.timing.spread).toBeGreaterThan(8);
      expect(h.timing.spread).toBeLessThan(25);
      // No releases: nothing to say about connection.
      expect(h.connection).toBeNull();
    }
  });

  it('survives JSON with connection and hands together', () => {
    const s = playBoth(seededRng(18), { octaves: 2, ioi: 250, sigma: 10, lag: 20, legato: 15 });
    const a = analyzeRun({
      ...s,
      velocityMeasured: true,
      pedal: { atStart: false, changes: [{ down: true, time: 1000 }] },
    });
    expect(a.together).not.toBeNull();
    expect(a.hands.every((h) => h.connection?.pedal)).toBe(true);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});

describe('connection', () => {
  it('reads a legato player’s overlap, the turn included and the last note left out', () => {
    const rng = seededRng(20);
    const medians: number[] = [];
    for (let r = 0; r < 50; r++) {
      const s = play(rng, { octaves: 2, ioi: 250, sigma: 10, legato: 20, releaseSigma: 5 });
      const hand = analyze(s).hands[0]!;
      const c = hand.connection!;
      medians.push(c.medianOverlap!);
      expect(c.gaps).toEqual([]);
      expect(c.pedal).toBe(false);
      // 29 notes, 28 joins: the last note has no next.
      expect(c.notes).toBe(28);
      expect(hand.notes[28]!.overlap).toBeNull();
      // Into the top note and out of it: measured, unlike the intervals there.
      expect(hand.notes[13]!.overlap).not.toBeNull();
      expect(hand.notes[14]!.overlap).not.toBeNull();
      expect(hand.notes[14]!.turn).toBe(true);
      expect(c.overlapShare).toBeCloseTo((100 * c.medianOverlap!) / hand.timing.medianInterval!, 9);
    }
    expect(Math.abs(median(medians) - 20)).toBeLessThan(2);
    for (const m of medians) expect(Math.abs(m - 20)).toBeLessThan(5);
    // 20 ms of 250: 8 % of the interval.
    expect(median(medians) / 250).toBeCloseTo(0.08, 2);
  });

  it('finds the gaps at the thumb of a player legato elsewhere', () => {
    const rng = seededRng(21);
    for (let r = 0; r < 50; r++) {
      const s = play(rng, {
        octaves: 2,
        ioi: 250,
        sigma: 10,
        legato: 15,
        releaseSigma: 5,
        thumbGap: 50,
      });
      const c = analyze(s).hands[0]!.connection!;
      // The thumb passes under at 3, 7 and 10 going up: the note before each lets go too soon.
      expect(c.gaps).toEqual([2, 6, 9]);
      expect(c.medianOverlap).toBeGreaterThan(10);
      expect(c.medianOverlap).toBeLessThan(20);
    }
    expect(GAP_MS).toBe(30);
  });

  it('leaves out notes without a release, and says nothing with too few', () => {
    const s = play(seededRng(22), { octaves: 2, ioi: 250, sigma: 10, legato: 20 });
    for (const i of [4, 11, 20]) s.played[i]!.off = null;
    const hand = analyze(s).hands[0]!;
    expect([4, 11, 20].map((i) => hand.notes[i]!.overlap)).toEqual([null, null, null]);
    // The note before still has its own release.
    expect(hand.notes[3]!.overlap).not.toBeNull();
    expect(hand.connection!.notes).toBe(25);

    // One octave with releases on only a few notes.
    const one = play(seededRng(23), { octaves: 1, ioi: 250, sigma: 10, legato: 20 });
    one.played.forEach((p, i) => {
      if (i >= MIN_CONNECTED - 1) p.off = null;
    });
    expect(analyze(one).hands[0]!.connection).toBeNull();
    one.played[MIN_CONNECTED - 1]!.off = one.played[MIN_CONNECTED]!.on + 20;
    expect(analyze(one).hands[0]!.connection!.notes).toBe(MIN_CONNECTED);
  });

  it('a slip, a miss or a wrong key breaks the joins around it', () => {
    const s = play(seededRng(24), { octaves: 2, ioi: 250, sigma: 10, legato: 20 });
    s.played[5]!.midi += 1; // a wrong key at A4
    s.played.splice(12, 1); // A5 missed
    s.played.splice(7, 0, { midi: 90, on: s.played[6]!.on + 100, off: null, velocity: 60 });
    const n = analyze(s).hands[0]!.notes;
    const overlaps = n.map((x) => x.overlap);
    // Into and out of the wrong key, into the extra note, into and out of the missed note.
    for (const i of [4, 5, 6, 11, 12]) expect(overlaps[i]).toBeNull();
    for (const i of [3, 7, 10, 13]) expect(overlaps[i]).not.toBeNull();
    expect(overlaps.filter((o) => o !== null)).toHaveLength(23);
  });

  it('marks the pedal from the start of the run or from a change, and figures stay the same', () => {
    const s = play(seededRng(25), { octaves: 2, ioi: 250, sigma: 10, legato: 20 });
    const withPedal = (pedal: RunInput['pedal']) =>
      analyzeRun({ expected: s.notes, played: s.played, velocityMeasured: false, pedal }).hands[0]!
        .connection!;
    const plain = withPedal(undefined);
    expect(plain.pedal).toBe(false);
    expect(withPedal({ atStart: false, changes: [] }).pedal).toBe(false);
    expect(withPedal({ atStart: true, changes: [] }).pedal).toBe(true);
    expect(withPedal({ atStart: true, changes: [{ down: false, time: 10 }] }).pedal).toBe(true);
    const pressed = withPedal({
      atStart: false,
      changes: [
        { down: true, time: 2000 },
        { down: false, time: 2400 },
      ],
    });
    expect(pressed.pedal).toBe(true);
    expect({ ...pressed, pedal: false }).toEqual(plain);
    // Let go at once, never pressed: not used.
    expect(withPedal({ atStart: false, changes: [{ down: false, time: 5 }] }).pedal).toBe(false);
  });
});

describe('hands together', () => {
  it('pairs the same index of both hands, which have the same length and shape', () => {
    for (const type of SCALE_TYPES)
      for (const tonic of tonicsOf(type))
        for (const octaves of SCALE_OCTAVES) {
          const { right, left } = scaleNotes({ type, tonic, octaves, hands: 'both' });
          expect(right.length).toBe(left.length);
          right.forEach((r, i) => {
            expect([r.direction, r.turn, r.midi - 12]).toEqual([
              left[i]!.direction,
              left[i]!.turn,
              left[i]!.midi,
            ]);
          });
        }

    // A real exercise, played together, the right hand 20 ms late: every pair measured.
    const { right, left } = scaleNotes({
      type: 'harmonicMinor',
      tonic: 'G#',
      octaves: 2,
      hands: 'both',
    });
    const played = [...right, ...left]
      .map((n) => ({
        midi: n.midi,
        on: 250 * n.index + (n.hand === 'right' ? 20 : 0),
        off: null,
        velocity: 70,
      }))
      .sort((a, b) => a.on - b.on);
    const t = together({ expected: [...right, ...left], played })!;
    expect(t.pairs).toHaveLength(29);
    expect(t.pairs.every((p) => p.asynchrony === 20)).toBe(true);
    expect([t.median, t.leads, t.spread]).toEqual([20, 'left', 0]);

    // Runs of different lengths are not paired.
    const unequal = [...cMajor(2, 'right'), ...cMajor(1, 'left')];
    const notes = unequal.map((n) => ({
      midi: n.midi,
      on: 250 * n.index,
      off: null,
      velocity: 70,
    }));
    expect(together({ expected: unequal, played: notes.sort((a, b) => a.on - b.on) })).toBeNull();
  });

  it('a right hand 25 ms late: the left leads', () => {
    const rng = seededRng(30);
    const medians: number[] = [];
    let left = 0;
    for (let r = 0; r < 100; r++) {
      const t = together(playBoth(rng, { octaves: 2, ioi: 250, sigma: 10, lag: 25 }))!;
      medians.push(t.median!);
      if (t.leads === 'left') left++;
      // Asynchrony of two onsets with σ = 10 each: σ√2 = 14 ms.
      expect(t.spread).toBeGreaterThan(6);
      expect(t.spread).toBeLessThan(24);
    }
    expect(left).toBeGreaterThanOrEqual(99);
    expect(Math.abs(median(medians) - 25)).toBeLessThan(2);

    const t = together(playBoth(rng, { octaves: 2, ioi: 250, sigma: 5, lag: -25 }))!;
    expect(t.leads).toBe('right');
    expect(t.median).toBeLessThan(-LEAD_MS);
  });

  it('jitter alone: no hand leads', () => {
    const rng = seededRng(31);
    let led = 0;
    const runs = 200;
    for (let r = 0; r < runs; r++) {
      const octaves = r % 2 === 0 ? 1 : 2;
      if (together(playBoth(rng, { octaves, ioi: 250, sigma: 10 }))!.leads !== null) led++;
    }
    expect(led / runs).toBeLessThanOrEqual(0.05);
  });

  it('names the pairs far apart', () => {
    const rng = seededRng(32);
    for (let r = 0; r < 20; r++) {
      const t = together(
        playBoth(rng, { octaves: 2, ioi: 250, sigma: 3, shift: { 5: 60, 12: -60, 20: 60 } }),
      )!;
      expect(t.apart).toEqual([5, 12, 20]);
      expect(t.leads).toBeNull();
      expect(t.pairs[12]!.asynchrony).toBeLessThan(-APART_MS);
    }
  });

  it('a note missing in one hand leaves its pair unmeasured', () => {
    const t = together(
      playBoth(seededRng(33), { octaves: 2, ioi: 250, sigma: 10, leftMissing: [4, 10] }),
    )!;
    expect(t.pairs).toHaveLength(29);
    expect(t.pairs.map((p) => p.index)).toEqual([...Array(29).keys()]);
    const unmeasured = t.pairs.filter((p) => p.asynchrony === null).map((p) => p.index);
    expect(unmeasured).toEqual([4, 10]);
    expect(t.median).not.toBeNull();
  });

  it('is null for one hand', () => {
    const a = analyze(play(seededRng(34), { octaves: 2, ioi: 250, sigma: 10 }));
    expect(a.together).toBeNull();
    expect(analyzeRun({ expected: [], played: [], velocityMeasured: false }).together).toBeNull();
  });
});

describe('contrary motion', () => {
  const e = { type: 'major', tonic: 'C', octaves: 2, hands: 'contrary' } as const;
  const { right, left } = scaleNotes(e);
  const expected = [...right, ...left];
  /** Both hands in time, the unison at both ends struck once (or twice when asked). */
  function played(twice = false, lag = 0) {
    const keys = [...right, ...left].flatMap((n) => {
      const unison = n.index === 0 || n.index === right.length - 1;
      if (unison && n.hand === 'left' && !twice) return [];
      return [
        {
          midi: n.midi,
          on:
            250 * n.index + (n.hand === 'right' ? lag : 0) + (unison && n.hand === 'left' ? 3 : 0),
          off: 250 * n.index + 240,
          velocity: 70,
        },
      ];
    });
    return keys.sort((a, b) => a.on - b.on);
  }

  it('takes a unison struck once for both hands: a clean run, the pair unmeasured', () => {
    const a = analyzeRun({ expected, played: played(), velocityMeasured: false });
    expect(a.quality).toBe('ok');
    expect(a.counts).toMatchObject({ matched: 58, wrong: 0, missed: 0, extra: 0 });
    const t = a.together!;
    expect(t.pairs[0]!.asynchrony).toBeNull();
    expect(t.pairs.at(-1)!.asynchrony).toBeNull();
    expect(t.pairs.slice(1, -1).every((p) => p.asynchrony === 0)).toBe(true);
  });

  it('measures each hand in its own direction, and a late hand as leading', () => {
    const a = analyzeRun({ expected, played: played(true, 25), velocityMeasured: false });
    expect(a.counts).toMatchObject({ matched: 58, missed: 0, extra: 0 });
    expect(a.together!.leads).toBe('left');
    const lh = a.hands.find((h) => h.hand === 'left')!;
    expect(lh.notes[14]!.turn).toBe(true);
    expect(lh.notes.slice(0, 14).every((n) => n.direction === 'down')).toBe(true);
    expect(lh.timing.spread).toBeLessThan(2);
  });
});
