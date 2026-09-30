import { describe, expect, it } from 'vitest';
import {
  ACCENT_STEP_MIN,
  analyzeExpression,
  dynamicsToLookAt,
  DYNAMIC_STEP,
  playedNotes,
  runSteps,
  slotOf,
  velocityMeasured,
  type ExpressionInput,
} from './expression.ts';
import type { Dynamic, HairpinMark } from './markings.ts';
import { bars, note, Q, score as makeScore } from './scoreFixtures.ts';
import type { HandSelection, Score, ScoreNote } from './score.ts';
import type { TakeEvent } from './takes.ts';

// A synthetic run: every note of the steps played at a steady pace, with a velocity (and a held
// length) from functions of the note, as a take records it.

const MS_PER_Q = 500;

function piano(notes: ScoreNote[], count: number, beats = 4): Score {
  const s = makeScore(bars(count, beats), notes);
  return { ...s, hands: { '0.1': 'right', '0.2': 'left' } };
}

/** Quarter notes in both hands: the right hand on 72, the left on 48, `count` bars of 4/4. */
function twoHands(count: number): ScoreNote[] {
  const out: ScoreNote[] = [];
  for (let b = 0; b < count; b++) {
    for (let k = 0; k < 4; k++) {
      const tick = (b * 4 + k) * Q;
      out.push(note(b, tick, Q, 72 + (k % 2), 'right'), note(b, tick, Q, 48, 'left'));
    }
  }
  return out;
}

function dynamic(s: Score, measure: number, tick: number, value: Dynamic, staff = 1) {
  s.markings.dynamics.push({ part: 0, staff, measure, tick, dynamic: value });
}

function hairpin(
  s: Score,
  kind: HairpinMark['kind'],
  from: [number, number],
  to: [number, number],
  staff = 1,
) {
  s.markings.hairpins.push({
    part: 0,
    staff,
    measure: from[0],
    tick: from[1],
    kind,
    written: 'wedge',
    end: { measure: to[0], tick: to[1] },
  });
}

interface Play {
  velocity: (n: ScoreNote, tick: number) => number;
  /** Held share of the note's written length (default 0.95). */
  held?: (n: ScoreNote) => number;
  /** Time of a note-on (default: the tick at MS_PER_Q). */
  at?: (n: ScoreNote, tick: number) => number;
}

/** The take of playing every step of the run once (wait mode's step indices). */
function take(s: Score, hands: HandSelection, play: Play): TakeEvent[] {
  const { steps } = runSteps(s, hands, 'play', null);
  const byId = new Map(s.notes.map((n) => [n.id, n]));
  const events: TakeEvent[] = [];
  for (const step of steps) {
    for (const id of step.noteIds) {
      const n = byId.get(id)!;
      const on = Math.round(play.at?.(n, step.tick) ?? (step.tick / Q) * MS_PER_Q);
      const held = Math.round((play.held?.(n) ?? 0.95) * (n.duration / Q) * MS_PER_Q);
      events.push([on, 1, n.midi, play.velocity(n, step.tick), step.index]);
      events.push([on + held, 0, n.midi]);
    }
  }
  return events.sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!);
}

function run(s: Score, events: TakeEvent[], extra: Partial<ExpressionInput> = {}) {
  return analyzeExpression({
    score: s,
    hands: 'both',
    repeats: 'play',
    loop: null,
    mode: 'wait',
    events,
    ...extra,
  });
}

/** Velocities around a base with a little spread, so the range is not zero. */
const jitter = (n: ScoreNote, tick: number) => ((tick / Q + n.midi) % 3) - 1;

describe('reconstructing the notes', () => {
  it('pairs each key with its release and the pedal, and leaves wrong keys out', () => {
    const s = piano([note(0, 0, Q, 60), note(0, Q, Q, 62), note(0, 2 * Q, 2 * Q, 64)], 1);
    const { steps } = runSteps(s, 'right', 'play', null);
    const events: TakeEvent[] = [
      [0, 1, 60, 70, 0],
      [300, 1, 61, 50, -1],
      [350, 0, 61],
      [480, 0, 60],
      [500, 1, 62, 72, 1],
      [700, 64, 127],
      [900, 0, 62],
      [950, 64, 0],
      [1000, 1, 64, 74, 2],
    ];
    const notes = playedNotes(s, steps, events, null);
    expect(notes.map((n) => [n.note.midi, n.on, n.off, n.velocity, n.pedalled])).toEqual([
      [60, 0, 480, 70, false],
      [62, 500, 900, 72, true],
      [64, 1000, null, 74, false],
    ]);
  });

  it('keeps the last stroke of a key struck again on its step', () => {
    const s = piano([note(0, 0, Q, 60), note(0, 0, Q, 64), note(0, Q, Q, 62)], 1);
    const { steps } = runSteps(s, 'right', 'play', null);
    const events: TakeEvent[] = [
      [0, 1, 60, 40, 0],
      [100, 0, 60],
      [150, 1, 60, 80, 0],
      [160, 1, 64, 80, 0],
      [400, 0, 60],
      [400, 0, 64],
      [500, 1, 62, 70, 1],
    ];
    const notes = playedNotes(s, steps, events, null);
    expect(notes.map((n) => [n.note.midi, n.on, n.velocity])).toEqual([
      [60, 150, 80],
      [64, 160, 80],
      [62, 500, 70],
    ]);
  });

  it('counts the rounds of a loop: in wait mode by the steps going back', () => {
    const s = piano([note(0, 0, Q, 60), note(0, Q, Q, 62)], 1);
    const { steps } = runSteps(s, 'right', 'play', null);
    const events: TakeEvent[] = [
      [0, 1, 60, 70, 0],
      [500, 1, 62, 70, 1],
      [1000, 1, 60, 70, 0],
      [1500, 1, 62, 70, 1],
    ];
    expect(playedNotes(s, steps, events, null).map((n) => n.round)).toEqual([0, 0, 1, 1]);
  });

  it('counts the rounds of a loop in rhythm mode by the nearest due time', () => {
    // One bar of 4/4 at ♩ = 120 looped: 2 s a round.
    const s = piano([note(0, 0, Q, 60), note(0, 2 * Q, Q, 62)], 1);
    s.tempos.push({ tick: 0, bpm: 120 });
    const events: TakeEvent[] = [
      [30, 1, 60, 70, 0],
      [1010, 1, 62, 70, 1],
      [1990, 1, 60, 70, 0],
      [3020, 1, 62, 70, 1],
    ];
    const analysis = run(s, events, {
      hands: 'right',
      mode: 'rhythm',
      scale: 1,
      latency: 20,
      loop: { from: 0, to: 0 },
    });
    expect(analysis.notes.map((n) => n.round)).toEqual([0, 0, 1, 1]);
    expect(analysis.rounds).toBe(2);
  });

  it('knows a fixed velocity (the computer keyboard) measures no loudness', () => {
    expect(
      velocityMeasured([
        [0, 1, 60, 96, 0],
        [10, 0, 60],
        [20, 1, 62, 96, 1],
      ]),
    ).toBe(false);
    expect(
      velocityMeasured([
        [0, 1, 60, 96, 0],
        [20, 1, 62, 90, 1],
      ]),
    ).toBe(true);
  });
});

describe('the loudness curve', () => {
  it('is the median velocity per hand and beat', () => {
    const s = piano(twoHands(2), 2);
    const analysis = run(
      s,
      take(s, 'both', { velocity: (n, tick) => (n.hand === 'right' ? 70 : 50) + tick / Q }),
    );
    const { slots, curve } = analysis.dynamics;
    expect(slots).toHaveLength(8);
    expect(curve.right).toEqual([70, 71, 72, 73, 74, 75, 76, 77]);
    expect(curve.left).toEqual([50, 51, 52, 53, 54, 55, 56, 57]);
    expect(slotOf(slots, 0, 5 * Q + 10)).toBe(5);
    expect(analysis.dynamics.bars).toEqual([
      { round: 0, played: 0, measure: 0, right: 71.5, left: 51.5 },
      { round: 0, played: 1, measure: 1, right: 75.5, left: 55.5 },
    ]);
  });

  it('counts a compound meter in dotted beats', () => {
    const notes = Array.from({ length: 6 }, (_, k) => note(0, (k * Q) / 2, Q / 2, 60 + k));
    const s = { ...makeScore(bars(1, 6, 8), notes), hands: { '0.1': 'right' as const } };
    const analysis = run(s, take(s, 'right', { velocity: (n) => n.midi }), { hands: 'right' });
    expect(analysis.dynamics.slots).toHaveLength(2);
    expect(analysis.dynamics.curve.right).toEqual([61, 64]);
  });

  it('judges nothing on loudness without velocities', () => {
    const s = piano(twoHands(4), 4);
    dynamic(s, 0, 0, 'p');
    dynamic(s, 2, 8 * Q, 'f');
    const analysis = run(s, take(s, 'both', { velocity: () => 96 }));
    expect(analysis.dynamics.velocityMeasured).toBe(false);
    expect(analysis.dynamics.judgements).toEqual([]);
    expect(analysis.dynamics.balance).toBeNull();
    expect(analysis.dynamics.marked).toBe(true);
  });
});

describe('levels', () => {
  function pToF(after: number) {
    const s = piano(twoHands(4), 4);
    dynamic(s, 0, 0, 'p');
    dynamic(s, 2, 8 * Q, 'f');
    const velocity = (n: ScoreNote, tick: number) =>
      (tick < 8 * Q ? 40 : after) + (n.hand === 'right' ? 6 : 0) + jitter(n, tick);
    return run(s, take(s, 'both', { velocity })).dynamics;
  }

  it('asks p to f for three steps of the range', () => {
    const d = pToF(80);
    const j = d.judgements[0]!;
    expect(j).toMatchObject({ kind: 'level', from: 'p', to: 'f', levels: 3, verdict: 'right' });
    expect(j.kind === 'level' && j.needed).toBeCloseTo(
      3 * DYNAMIC_STEP * (d.range!.high - d.range!.low),
    );
    // The change is heard from the bar before the barline where f is written.
    expect(j.bars).toEqual({ from: 1, to: 2 });
  });

  it('says too little, the wrong way round, and too much', () => {
    expect(pToF(44).judgements[0]!.verdict).toBe('too-little');
    expect(pToF(38).judgements[0]!.verdict).toBe('too-little');
    expect(pToF(28).judgements[0]!.verdict).toBe('wrong-way');
    // In a piece from p to f, mp to mf played as a leap across the whole range.
    const s = piano(twoHands(6), 6);
    dynamic(s, 0, 0, 'p');
    dynamic(s, 2, 8 * Q, 'mp');
    dynamic(s, 3, 12 * Q, 'mf');
    dynamic(s, 5, 20 * Q, 'f');
    const velocity = (n: ScoreNote, tick: number) =>
      (tick < 8 * Q ? 30 : tick < 12 * Q ? 35 : tick < 20 * Q ? 100 : 104) + jitter(n, tick);
    const judged = run(s, take(s, 'both', { velocity })).dynamics.judgements;
    expect(judged.map((j) => j.verdict)).toEqual(['too-little', 'too-much', 'too-little']);
    // The widest contrast marked is never too much.
    expect(pToF(120).judgements[0]!.verdict).toBe('right');
  });

  it('merges a level written again and on both staves, and applies it to both hands', () => {
    const s = piano(twoHands(4), 4);
    dynamic(s, 0, 0, 'p', 1);
    dynamic(s, 0, 0, 'p', 2);
    dynamic(s, 1, 4 * Q, 'p');
    dynamic(s, 2, 8 * Q, 'f', 2);
    const velocity = (n: ScoreNote, tick: number) => (tick < 8 * Q ? 40 : 80) + jitter(n, tick);
    const d = run(s, take(s, 'right', { velocity }), { hands: 'right' }).dynamics;
    expect(d.judgements.map((j) => j.kind === 'level' && [j.from, j.to])).toEqual([['p', 'f']]);
  });

  it('leaves out passages shorter than two beats, and says missed without the notes', () => {
    const s = piano(twoHands(4), 4);
    dynamic(s, 0, 0, 'p');
    dynamic(s, 1, 4 * Q, 'f');
    dynamic(s, 1, 5 * Q, 'p');
    dynamic(s, 2, 8 * Q, 'f');
    const velocity = (n: ScoreNote, tick: number) => 60 + jitter(n, tick);
    const events = take(s, 'both', { velocity }).filter(
      (e) => e[1] !== 1 || e[4]! < 8 || e[4]! > 14,
    );
    const d = run(s, events).dynamics;
    expect(d.judgements.map((j) => [j.kind === 'level' && j.to, j.verdict])).toEqual([
      ['f', 'missed'],
    ]);
  });

  it('takes the levels marked in what was played: a loop’s widest contrast is never too much', () => {
    // pp to ff in the piece; the loop (bars 3-4) plays p to f only, across its whole range.
    const s = piano(twoHands(6), 6);
    dynamic(s, 0, 0, 'pp');
    dynamic(s, 2, 8 * Q, 'p');
    dynamic(s, 3, 12 * Q, 'f');
    dynamic(s, 5, 20 * Q, 'ff');
    const velocity = (n: ScoreNote, tick: number) => (tick < 12 * Q ? 30 : 110) + jitter(n, tick);
    const { steps } = runSteps(s, 'both', 'play', null);
    const inLoop = (e: TakeEvent) => e[1] !== 1 || [2, 3].includes(steps[e[4]!]!.measure);
    const events = take(s, 'both', { velocity }).filter(inLoop);
    const d = run(s, events, { loop: { from: 2, to: 3 } }).dynamics;
    expect(d.judgements.map((j) => j.kind === 'level' && [j.from, j.to, j.verdict])).toEqual([
      ['p', 'f', 'right'],
    ]);
  });

  it('is unmarked where the run played no dynamic, though the piece has some later', () => {
    const s = piano(twoHands(4), 4);
    dynamic(s, 3, 12 * Q, 'f');
    const { steps } = runSteps(s, 'both', 'play', null);
    const events = take(s, 'both', { velocity: (n, tick) => 60 + jitter(n, tick) }).filter(
      (e) => e[1] !== 1 || steps[e[4]!]!.measure < 2,
    );
    expect(run(s, events, { loop: { from: 0, to: 1 } }).dynamics.marked).toBe(false);
    expect(run(s, take(s, 'both', { velocity: jitter })).dynamics.marked).toBe(true);
    // One level throughout, written again and again: marked, but no change to judge.
    const f = piano(twoHands(4), 4);
    for (let b = 0; b < 4; b++) dynamic(f, b, b * 4 * Q, 'f');
    const d = run(f, take(f, 'both', { velocity: (n, tick) => 60 + jitter(n, tick) })).dynamics;
    expect([d.marked, d.changes, d.judgements]).toEqual([true, false, []]);
  });

  it('keeps notes under a hairpin out of the passages', () => {
    const s = piano(twoHands(4), 4);
    dynamic(s, 0, 0, 'p');
    hairpin(s, 'crescendo', [1, 4 * Q], [2, 8 * Q]);
    dynamic(s, 2, 8 * Q, 'f');
    const velocity = (n: ScoreNote, tick: number) =>
      (tick < 4 * Q ? 40 : tick < 8 * Q ? 40 + ((tick - 4 * Q) / Q) * 10 : 80) + jitter(n, tick);
    const d = run(s, take(s, 'both', { velocity })).dynamics;
    const level = d.judgements.find((j) => j.kind === 'level');
    expect(level?.kind === 'level' && level.change).toBeCloseTo(40, 0);
  });
});

describe('hairpins', () => {
  function crescendo(rise: number, hands: HandSelection = 'both') {
    const s = piano(twoHands(3), 3);
    hairpin(s, 'crescendo', [1, 4 * Q], [2, 8 * Q]);
    const velocity = (n: ScoreNote, tick: number) =>
      (n.hand === 'right' ? 60 : 30) +
      (tick >= 4 * Q && tick <= 8 * Q
        ? ((tick - 4 * Q) / (4 * Q)) * rise
        : tick > 8 * Q
          ? rise
          : 0) +
      (tick % (2 * Q) === 0 ? 1 : 0);
    return run(s, take(s, hands, { velocity }), { hands }).dynamics.judgements;
  }

  it('fits the rise of the hand the hairpin is written for', () => {
    const j = crescendo(20)[0]!;
    expect(j).toMatchObject({ kind: 'hairpin', hairpin: 'crescendo', hand: 'right' });
    expect(j.verdict).toBe('right');
    expect(j.kind === 'hairpin' && j.change).toBeGreaterThan(17);
    expect(j.bars).toEqual({ from: 1, to: 1 });
  });

  it('is too little when it hardly rises, the wrong way round when it falls', () => {
    expect(crescendo(2)[0]!.verdict).toBe('too-little');
    // No change at all is too little; only a fall of a whole step or more is the wrong way round.
    expect(crescendo(0)[0]!.verdict).toBe('too-little');
    expect(crescendo(-1)[0]!.verdict).toBe('too-little');
    expect(crescendo(-12)[0]!.verdict).toBe('wrong-way');
  });

  it('is not judged when its hand is not practised', () => {
    expect(crescendo(20, 'left')).toEqual([]);
  });

  it('judges a diminuendo falling as right', () => {
    const s = piano(twoHands(3), 3);
    hairpin(s, 'diminuendo', [0, 0], [1, 4 * Q]);
    const velocity = (_: ScoreNote, tick: number) =>
      (tick <= 4 * Q ? 90 - (tick / Q) * 8 : 58) + (tick % (2 * Q) === 0 ? 1 : 0);
    expect(run(s, take(s, 'both', { velocity })).dynamics.judgements[0]!.verdict).toBe('right');
  });
});

describe('accents', () => {
  function accented(boost: number, mark: 'accent' | 'sf' = 'accent') {
    const notes = twoHands(2);
    const target = notes.find((n) => n.hand === 'right' && n.onset === 5 * Q)!;
    if (mark === 'accent') target.articulations = ['accent'];
    const s = piano(notes, 2);
    if (mark === 'sf') dynamic(s, 1, 5 * Q, 'sf');
    const velocity = (n: ScoreNote, tick: number) =>
      (n.hand === 'right' ? 60 : 40) + (n === target ? boost : 0) + jitter(n, tick);
    return run(s, take(s, 'both', { velocity })).dynamics.judgements;
  }

  it('stands above its neighbours by the accent step', () => {
    expect(accented(20)[0]).toMatchObject({ kind: 'accent', mark: 'accent', verdict: 'right' });
    expect(accented(4)[0]!.verdict).toBe('too-little');
    expect(accented(-5)[0]!.verdict).toBe('wrong-way');
  });

  it('reads an sf on the staff as the accent of its hand there', () => {
    expect(accented(30, 'sf')[0]).toMatchObject({ mark: 'sf', hand: 'right', verdict: 'right' });
  });

  it('needs at least a few velocity units above however narrow the range', () => {
    const j = accented(20)[0]!;
    expect(j.kind === 'accent' && j.needed).toBeGreaterThanOrEqual(ACCENT_STEP_MIN);
  });

  it('is missed when its note is not played', () => {
    const notes = twoHands(2);
    const target = notes.find((n) => n.hand === 'right' && n.onset === 5 * Q)!;
    target.articulations = ['accent'];
    const s = piano(notes, 2);
    const events = take(s, 'both', {
      velocity: (n, tick) => 60 + jitter(n, tick),
    }).filter((e) => !(e[2] === target.midi && e[1] === 1 && e[0] === 5 * MS_PER_Q));
    expect(run(s, events).dynamics.judgements[0]!.verdict).toBe('missed');
  });
});

describe('balance', () => {
  function balance(right: number, left: number, melody?: 'right' | 'left' | 'top') {
    const s = piano(twoHands(2), 2);
    const velocity = (n: ScoreNote, tick: number) =>
      (n.hand === 'right' ? right : left) + jitter(n, tick);
    return run(s, take(s, 'both', { velocity }), { melody }).dynamics.balance;
  }

  it('finds the melody over the accompaniment, per bar', () => {
    const b = balance(80, 50)!;
    expect(b.groups).toBe(8);
    expect(b.balanced).toBe(8);
    expect(b.bars.map((bar) => bar.verdict)).toEqual(['balanced', 'balanced']);
  });

  it('says equal, or the accompaniment on top', () => {
    expect(balance(60, 60)!.bars[0]!.verdict).toBe('equal');
    expect(balance(50, 80)!.bars[0]!.verdict).toBe('under');
    expect(balance(50, 80, 'left')!.bars[0]!.verdict).toBe('balanced');
    expect(balance(50, 80, 'top')!.bars[0]!.verdict).toBe('under');
  });

  it('ranks the bars to look at: markings played wrong, then the balance', () => {
    const notes = twoHands(4);
    notes.find((n) => n.hand === 'right' && n.onset === 5 * Q)!.articulations = ['accent'];
    const s = piano(notes, 4);
    dynamic(s, 0, 0, 'p');
    dynamic(s, 2, 8 * Q, 'f');
    // Softer where f is marked, the accent not played louder, the left hand on top in bar 4.
    const velocity = (n: ScoreNote, tick: number) =>
      (tick < 8 * Q ? 60 : 45) +
      (n.hand === 'left' ? (tick >= 12 * Q ? 20 : -15) : 0) +
      jitter(n, tick);
    const places = dynamicsToLookAt(run(s, take(s, 'both', { velocity })).dynamics);
    expect(places.map((p) => [p.bars, p.problems.map((x) => x.kind)])).toEqual([
      [{ from: 1, to: 1 }, ['marking']],
      [{ from: 1, to: 2 }, ['marking']],
      [{ from: 3, to: 3 }, ['balance']],
    ]);
  });

  it('needs both hands struck together within 30 ms', () => {
    const s = piano(twoHands(2), 2);
    const events = take(s, 'both', {
      velocity: (n) => (n.hand === 'right' ? 80 : 50),
      at: (n, tick) => (tick / Q) * MS_PER_Q + (n.hand === 'left' ? 40 : 0),
    });
    expect(run(s, events).dynamics.balance).toBeNull();
    const one = run(s, take(s, 'right', { velocity: jitter }), { hands: 'right' });
    expect(one.dynamics.balance).toBeNull();
  });
});
