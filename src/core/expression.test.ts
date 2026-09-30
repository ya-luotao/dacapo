import { describe, expect, it } from 'vitest';
import {
  ACCENT_STEP_MIN,
  analyzeExpression,
  articulationToLookAt,
  CHANGE_MAX_MS,
  dynamicsToLookAt,
  DYNAMIC_STEP,
  pedalToLookAt,
  playedNotes,
  RELEASE_MAX_MS,
  runClock,
  runSteps,
  runTimes,
  slotOf,
  velocityMeasured,
  type ExpressionInput,
} from './expression.ts';
import type { Dynamic, HairpinMark, PedalMark } from './markings.ts';
import {
  CHANGE_MAX_MS as LESSON_CHANGE_MAX_MS,
  RELEASE_MAX_MS as LESSON_RELEASE_MAX_MS,
} from '../ui/learn/expression.ts';
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
    const { slots } = analysis;
    const { curve } = analysis.dynamics;
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
    expect(analysis.slots).toHaveLength(2);
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

describe('articulation', () => {
  /** A right-hand line: quarters C D E F (a slur over them), G and A halves, one bar each. */
  function line(
    options: { slur?: boolean; arts?: Partial<Record<number, ScoreNote['articulations']>> } = {},
  ) {
    const notes = [
      note(0, 0, Q, 60),
      note(0, Q, Q, 62),
      note(0, 2 * Q, Q, 64),
      note(0, 3 * Q, Q, 65),
      note(1, 4 * Q, 2 * Q, 67),
      note(1, 6 * Q, 2 * Q, 69),
      note(2, 8 * Q, 4 * Q, 72),
    ];
    for (const n of notes) {
      const arts = options.arts?.[n.midi];
      if (arts) n.articulations = arts;
    }
    const s = piano(notes, 3);
    if (options.slur !== false)
      s.markings.slurs.push({
        part: 0,
        staff: 1,
        voice: '1',
        from: notes[0]!.id,
        to: notes[3]!.id,
      });
    return s;
  }
  const judged = (s: Score, held: (n: ScoreNote) => number, extra: Partial<ExpressionInput> = {}) =>
    run(s, take(s, 'right', { velocity: jitter, held }), { hands: 'right', ...extra }).articulation;
  const verdicts = (a: ReturnType<typeof judged>) =>
    a.notes.map((n) => [n.played.note.midi, n.touch, n.verdict]);

  it('joins a slur: let go within 20 ms before the next note, or 80 ms after', () => {
    // 1.06 of a 500 ms quarter: 30 ms into the next note. 0.9: a 50 ms gap. 1.2: 100 ms over.
    const a = judged(line(), (n) => (n.midi === 62 ? 0.9 : n.midi === 64 ? 1.2 : 1.06));
    expect(verdicts(a).slice(0, 3)).toEqual([
      [60, 'legato', 'right'],
      [62, 'legato', 'broken'],
      [64, 'legato', 'smudged'],
    ]);
    expect(a.notes[1]!.join).toBe(50);
    // The slur's last note (F) may be shorter: not judged.
    expect(a.notes.some((n) => n.played.note.midi === 65)).toBe(false);
  });

  it('holds plain notes at least seven tenths, except before a rest or at the end', () => {
    const a = judged(line({ slur: false }), (n) => (n.midi === 67 ? 0.6 : 0.8));
    expect(verdicts(a)).toEqual([
      [60, 'plain', 'right'],
      [62, 'plain', 'right'],
      [64, 'plain', 'right'],
      [65, 'plain', 'right'],
      [67, 'plain', 'cut-short'],
      [69, 'plain', 'right'],
    ]);
    // The last note is the run's end, and may breathe.
    const rest = piano([note(0, 0, Q, 60), note(0, 2 * Q, Q, 62), note(0, 3 * Q, Q, 64)], 1);
    const b = judged(rest, () => 0.3);
    expect(verdicts(b)).toEqual([[62, 'plain', 'cut-short']]);
  });

  it('keeps staccato short, staccatissimo shorter and tenuto held', () => {
    const s = line({
      slur: false,
      arts: {
        60: ['staccato'],
        62: ['staccatissimo'],
        64: ['tenuto'],
        65: ['spiccato'],
        67: ['staccato', 'tenuto'],
      },
    });
    expect(verdicts(judged(s, () => 0.45)).slice(0, 4)).toEqual([
      [60, 'staccato', 'right'],
      [62, 'staccatissimo', 'long'],
      [64, 'tenuto', 'short'],
      [65, 'staccato', 'right'],
    ]);
    expect(verdicts(judged(s, () => 0.3)).slice(0, 3)).toEqual([
      [60, 'staccato', 'right'],
      [62, 'staccatissimo', 'right'],
      [64, 'tenuto', 'short'],
    ]);
    const long = judged(s, () => 0.95);
    expect(verdicts(long).slice(0, 3)).toEqual([
      [60, 'staccato', 'long'],
      [62, 'staccatissimo', 'long'],
      [64, 'tenuto', 'right'],
    ]);
    // Portato (tenuto and staccato together) is not judged.
    expect(long.notes.some((n) => n.played.note.midi === 67)).toBe(false);
  });

  it('does not judge a note let go under the sustain pedal, and counts it', () => {
    const s = line({ slur: false });
    const events = take(s, 'right', { velocity: jitter, held: () => 0.5 });
    // The pedal down from 200 to 1400 ms: the first three notes are let go under it.
    events.push([200, 64, 127], [1400, 64, 0]);
    events.sort((a, b) => a[0]! - b[0]!);
    const a = run(s, events, { hands: 'right' }).articulation;
    expect(a.pedalled).toBe(3);
    expect(verdicts(a).map((v) => v[0])).toEqual([65, 67, 69]);
  });

  it('skips a slurred key struck again, and a next note never played', () => {
    const notes = [
      note(0, 0, Q, 60),
      note(0, Q, Q, 60),
      note(0, 2 * Q, Q, 62),
      note(0, 3 * Q, Q, 64),
    ];
    const s = piano(notes, 1);
    s.markings.slurs.push({ part: 0, staff: 1, voice: '1', from: notes[0]!.id, to: notes[3]!.id });
    const events = take(s, 'right', {
      velocity: jitter,
      held: (n) => (n.onset === 0 ? 0.9 : 1.02),
    }).filter((e) => !(e[1] === 1 && e[2] === 64) && !(e[1] === 0 && e[2] === 64));
    const a = run(s, events, { hands: 'right' }).articulation;
    // C to C cannot be joined; C to D can; D's next note (E) was never played.
    expect(verdicts(a)).toEqual([[60, 'legato', 'right']]);
    expect(a.notes[0]!.played.step).toBe(1);
  });

  it('joins a note tied over the barline into one length', () => {
    const first = note(0, 3 * Q, Q, 67);
    first.tieStart = true;
    const second = note(1, 4 * Q, Q, 67);
    second.tieStop = true;
    const s = piano([note(0, 0, 3 * Q, 60), first, second, note(1, 5 * Q, 3 * Q, 64)], 2);
    // G held for 900 of its 1000 ms (tied), then E.
    const events: TakeEvent[] = [
      [0, 1, 60, 60, 0],
      [1400, 0, 60],
      [1500, 1, 67, 62, 1],
      [2400, 0, 67],
      [2500, 1, 64, 64, 2],
    ];
    const a = run(s, events, { hands: 'right' }).articulation;
    expect(a.notes.map((n) => [n.played.note.midi, Math.round(n.written!), n.verdict])).toEqual([
      [60, 1500, 'right'],
      [67, 1000, 'right'],
    ]);
  });

  it('times a written length in wait mode by when the run reached its end', () => {
    // A right-hand half note over left-hand quarters: it ends where the third left-hand note is.
    const s = piano(
      [
        note(0, 0, 2 * Q, 72),
        note(0, 2 * Q, 2 * Q, 74),
        ...[0, 1, 2, 3].map((k) => note(0, k * Q, Q, 48, 'left')),
      ],
      1,
    );
    const events: TakeEvent[] = [
      [0, 1, 72, 70, 0],
      [0, 1, 48, 50, 0],
      [300, 0, 48],
      [800, 1, 48, 50, 1],
      [1100, 0, 48],
      [1350, 0, 72],
      [2000, 1, 74, 70, 2],
      [2000, 1, 48, 50, 2],
    ];
    const a = run(s, events).articulation;
    const half = a.notes.find((n) => n.played.note.midi === 72)!;
    expect(half.written).toBe(2000);
    expect(half.verdict).toBe('cut-short');
    // Between two steps, the time is shared out by the ticks: bar 1's second left-hand note ends
    // halfway from 800 to 2000.
    const lh = a.notes.find((n) => n.played.note.midi === 48 && n.played.step === 1)!;
    expect(lh.written).toBe(1200);
  });

  it('times a written length in rhythm mode at the run’s tempo', () => {
    const s = line({ slur: false, arts: { 60: ['staccato'] } });
    s.tempos.push({ tick: 0, bpm: 120 });
    // Held 400 ms: at ♩ = 120 a quarter is 500 ms (too long), at half speed 1000 ms.
    const events: TakeEvent[] = [
      [0, 1, 60, 60, 0],
      [400, 0, 60],
      [500, 1, 62, 60, 1],
    ];
    const at = (scale: number) =>
      run(s, events, { hands: 'right', mode: 'rhythm', scale }).articulation.notes[0]!;
    expect([Math.round(at(1).written!), at(1).verdict]).toEqual([500, 'long']);
    expect([Math.round(at(0.5).written!), at(0.5).verdict]).toEqual([1000, 'right']);
  });

  it('counts each bar played, and ranks the bars to look at', () => {
    const a = judged(line(), (n) =>
      n.midi === 62 || n.midi === 64 ? 0.8 : n.midi === 67 ? 0.5 : 1.06,
    );
    expect(
      a.bars.map((b) => [b.measure, b.judged, b.right, b.problems.broken, b.problems['cut-short']]),
    ).toEqual([
      [0, 3, 1, 2, 0],
      [1, 2, 1, 0, 1],
      [2, 0, 0, 0, 0],
    ]);
    expect(articulationToLookAt(a).map((p) => [p.bars.from, p.problems])).toEqual([
      [0, [{ touch: 'legato', verdict: 'broken', count: 2 }]],
      [1, [{ touch: 'plain', verdict: 'cut-short', count: 1 }]],
    ]);
  });

  it('judges held lengths without velocities', () => {
    const s = line();
    const events = take(s, 'right', { velocity: () => 96, held: () => 0.8 });
    const analysis = run(s, events, { hands: 'right' });
    expect(analysis.dynamics.velocityMeasured).toBe(false);
    expect(analysis.articulation.judged).toBeGreaterThan(0);
  });
});

describe('the pedal', () => {
  /** Quarters in both hands, three bars, every key held `held` of its 500 ms. */
  function chorale(
    marks: [number, number, PedalMark['type']][],
    pedal: PedalMark['pedal'] = 'sustain',
  ) {
    const s = piano(twoHands(3), 3);
    for (const [measure, tick, type] of marks)
      s.markings.pedals.push({ part: 0, staff: 2, measure, tick, pedal, type, line: true });
    return s;
  }
  function played(s: Score, pedal: TakeEvent[], held = 0.95, extra: Partial<ExpressionInput> = {}) {
    const keys = take(s, 'both', { velocity: jitter, held: () => held });
    const events = [...keys, ...pedal].sort((a, b) => a[0]! - b[0]!);
    return run(s, events, extra).pedal;
  }
  const verdicts = (p: ReturnType<typeof played>) =>
    p.judgements.map((j) => [
      j.mark,
      j.tick / Q,
      j.verdict,
      j.ms === null ? null : Math.round(j.ms),
    ]);
  /** Start on bar 1's downbeat, a change on each of its beats, the stop on bar 2's downbeat. */
  const changes = () =>
    chorale([
      [0, 0, 'start'],
      [0, Q, 'change'],
      [0, 2 * Q, 'change'],
      [0, 3 * Q, 'change'],
      [1, 4 * Q, 'stop'],
    ]);
  const down = (t: number): TakeEvent => [t, 64, 127];
  const up = (t: number): TakeEvent => [t, 64, 0];

  it('draws nothing and judges nothing without the sustain pedal in the take', () => {
    const p = played(changes(), []);
    expect(p.used).toBe(false);
    expect(p.marked).toBe(true);
    expect(p.marks.map((m) => m.type)).toEqual(['start', 'change', 'change', 'change', 'stop']);
    expect(p.judgements).toEqual([]);
    expect(p.lines.sustain).toEqual([]);
    expect(p.down).toBeNull();
  });

  it('is clean: up just after each new note, down again straight away', () => {
    const pedal = [down(100)];
    for (const n of [500, 1000, 1500]) pedal.push(up(n + 80), down(n + 200));
    pedal.push(up(2100));
    const p = played(changes(), pedal);
    expect(verdicts(p)).toEqual([
      ['start', 0, 'clean', null],
      ['change', 1, 'clean', null],
      ['change', 2, 'clean', null],
      ['change', 3, 'clean', null],
      ['stop', 4, 'clean', null],
    ]);
    expect(pedalToLookAt(p)).toEqual([]);
  });

  it('hears a gap when the pedal comes up before the note, unless the hand holds it over', () => {
    const pedal = [down(100), up(420), down(600), up(2100)];
    // Every key let go at 0.8 of its length: nothing sounds from 420 to the note at 500.
    expect(verdicts(played(changes(), pedal, 0.8))[1]).toEqual(['change', 1, 'gap', 80]);
    // Held to the next note: no gap, and down again 100 ms after the note.
    expect(verdicts(played(changes(), pedal, 1))[1]).toEqual(['change', 1, 'clean', null]);
  });

  it('measures a blur: up too late, or not at all before the next mark', () => {
    const late = played(changes(), [down(100), up(800), down(900)]);
    expect(verdicts(late)[1]).toEqual(['change', 1, 'blur', 300]);
    // Never lifted: each change blurs to the next note, the stop to the end of the take.
    const held = verdicts(played(changes(), [down(100)]));
    expect(held.slice(1, 4)).toEqual([
      ['change', 1, 'blur', 500],
      ['change', 2, 'blur', 500],
      ['change', 3, 'blur', 500],
    ]);
    expect(held[4]).toEqual(['stop', 4, 'blur', 5975 - 2000]);
  });

  it('says missed when the pedal never goes down, and a gap when it goes down too late', () => {
    // The pedal moved (so it is there) but never reached down.
    expect(verdicts(played(changes(), [[3000, 64, 30]]))).toEqual([
      ['start', 0, 'missed', null],
      ['change', 1, 'missed', null],
      ['change', 2, 'missed', null],
      ['change', 3, 'missed', null],
    ]);
    // Up 50 ms after the note, down again 550 ms later, the keys let go at 400 of 500: nothing
    // sounds from 900 to the next note at 1000. Held over, the late pedal leaves no gap.
    const s = chorale([
      [0, 0, 'start'],
      [0, Q, 'change'],
      [1, 4 * Q, 'stop'],
    ]);
    const pedal = [down(100), up(550), down(1100), up(2100)];
    expect(verdicts(played(s, pedal, 0.8))[1]).toEqual(['change', 1, 'gap', 100]);
    expect(verdicts(played(s, pedal, 1))[1]).toEqual(['change', 1, 'clean', null]);
    // Not down again before the next mark: the new harmony was not pedalled.
    expect(verdicts(played(changes(), pedal))[1]).toEqual(['change', 1, 'missed', null]);
  });

  it('judges a lift inside a marked span where the sound broke, at its place', () => {
    const s = chorale([
      [0, 0, 'start'],
      [1, 4 * Q, 'stop'],
    ]);
    const p = played(s, [down(100), up(700), down(1200), up(2100)], 0.8);
    expect(verdicts(p)).toEqual([
      ['start', 0, 'clean', null],
      ['lift', 1.5, 'gap', 100],
      ['stop', 4, 'clean', null],
    ]);
    expect(p.judgements[1]).toMatchObject({ measure: 0, beat: 2.5 });
    expect(pedalToLookAt(p)).toEqual([
      {
        bars: { from: 0, to: 0 },
        weight: 2,
        problems: [{ kind: 'sustain', judgement: p.judgements[1] }],
      },
    ]);
  });

  it('reads a stop and a start struck on the same note as a change', () => {
    // The stop just before bar 2 (as Für Elise marks it) is heard at bar 2's first note.
    const s = chorale([
      [0, 0, 'start'],
      [0, 3.5 * Q, 'stop'],
      [1, 4 * Q, 'start'],
    ]);
    const p = played(s, [down(100), up(2080), down(2200)]);
    expect(verdicts(p)).toEqual([
      ['start', 0, 'clean', null],
      ['change', 4, 'clean', null],
    ]);
    expect(p.marks.map((m) => [m.type, m.tick / Q])).toEqual([
      ['start', 0],
      ['stop', 3.5],
      ['start', 4],
    ]);
  });

  it('judges each round of a loop, the pedal going on from one to the next', () => {
    const s = chorale([
      [0, 0, 'start'],
      [0, 2 * Q, 'change'],
    ]);
    const { steps } = runSteps(s, 'both', 'play', { from: 0, to: 0 });
    const events: TakeEvent[] = [];
    for (let round = 0; round < 2; round++)
      for (const step of steps.filter((x) => x.measure === 0)) {
        const at = round * 2000 + (step.tick / Q) * 500;
        for (const midi of step.midis)
          events.push([at, 1, midi, 60, step.index], [at + 475, 0, midi]);
      }
    events.push(down(100), up(1080), down(1200), up(2050), down(2150), up(3300), down(3400));
    events.sort((a, b) => a[0]! - b[0]!);
    const p = run(s, events, { loop: { from: 0, to: 0 } }).pedal;
    expect(p.judgements.map((j) => [j.round, j.mark, j.verdict, j.ms])).toEqual([
      [0, 'start', 'clean', null],
      [0, 'change', 'clean', null],
      [1, 'start', 'clean', null],
      [1, 'change', 'blur', 300],
    ]);
  });

  it('draws the raw positions, half pedal too, and the share of the time down', () => {
    const s = changes();
    const p = played(s, [down(100), [1000, 64, 40], up(1500)]);
    expect(p.lines.sustain.map((x) => [x.round, x.tick / Q, x.value])).toEqual([
      [0, 0, 0],
      [0, 0.2, 127],
      [0, 2, 40],
      [0, 3, 0],
    ]);
    // Down from 100 to 1000 of the run's 0 to 5975.
    expect(p.down).toBeCloseTo(900 / 5975);
    expect(
      p.bars.map((b) => [b.measure, b.down === null ? null : Math.round(b.down * 100)]),
    ).toEqual([
      [0, 45],
      [1, 0],
      [2, 0],
    ]);
    expect(p.lines.unaCorda).toBeNull();
    expect(p.lines.sostenuto).toBeNull();
  });

  it('places the take in the score: by the steps in wait mode, by the clock in rhythm mode', () => {
    const s = changes();
    s.tempos.push({ tick: 0, bpm: 120 });
    const events = take(s, 'both', { velocity: jitter });
    const { order, steps } = runSteps(s, 'both', 'play', null);
    const wait = runTimes(playedNotes(s, steps, events, null), null);
    expect(wait.at(0, 1.5 * Q)).toBe(750);
    expect(wait.place(750)).toEqual({ round: 0, tick: 1.5 * Q });
    const clock = runClock(s, order, { from: 0, to: 0 }, 1)!;
    const rhythm = runTimes(playedNotes(s, steps, events, clock, 20), clock, 20);
    expect(rhythm.at(1, Q)).toBeCloseTo(20 + 2000 + 500);
    const at = rhythm.place(520)!;
    expect(at.round).toBe(0);
    expect(at.tick).toBeCloseTo(Q, 0);
    // One round played: a later moment is held at the end of the loop.
    expect(rhythm.place(2520)).toEqual({ round: 0, tick: 4 * Q });
  });

  it('checks una corda against its words, when the take has the left pedal', () => {
    const s = chorale(
      [
        [0, 0, 'start'],
        [1, 4 * Q, 'stop'],
      ],
      'una-corda',
    );
    const half = played(s, [
      [0, 67, 127],
      [1000, 67, 0],
    ]);
    expect(half.corde.map((c) => [c.pedal, c.verdict, c.share])).toEqual([
      ['una-corda', 'partly', 0.5],
    ]);
    expect(half.lines.unaCorda?.length).toBeGreaterThan(0);
    expect(played(s, [[0, 67, 127]]).corde[0]!.verdict).toBe('held');
    expect(played(s, [[3000, 67, 0]]).corde[0]!.verdict).toBe('missed');
    // Without the left pedal in the take, nothing is judged.
    expect(played(s, [down(100)]).corde).toEqual([]);
  });

  it('shares the change window with the lesson on the pedals', () => {
    expect([LESSON_CHANGE_MAX_MS, LESSON_RELEASE_MAX_MS]).toEqual([CHANGE_MAX_MS, RELEASE_MAX_MS]);
  });
});
