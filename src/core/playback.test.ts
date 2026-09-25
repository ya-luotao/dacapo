import { describe, expect, it } from 'vitest';
import {
  accompanimentPlan,
  baseTempo,
  DEFAULT_BPM,
  demoPlan,
  performedNotes,
  playSpan,
  RELEASE_GAP_MS,
  timeline,
} from './playback.ts';
import { performanceOrder, writtenOrder } from './repeats.ts';
import {
  buildSteps,
  type Hand,
  type HandSelection,
  type Measure,
  type Score,
  type ScoreNote,
} from './score.ts';

const Q = 960;
/** Milliseconds per quarter at the default tempo. */
const MSQ = 60_000 / DEFAULT_BPM;

interface NoteOptions {
  tieStart?: boolean;
  tieStop?: boolean;
  part?: number;
}

function note(
  measure: number,
  at: number,
  duration: number,
  midi: number,
  hand: Hand | null,
  options: NoteOptions = {},
): ScoreNote {
  return {
    id: `${measure}-${at}-${midi}-${hand}`,
    part: options.part ?? (hand === null ? 1 : 0),
    measure,
    onset: measure * 4 * Q + at,
    duration,
    midi,
    pitch: { step: 'C', alter: 0, octave: 4 },
    staff: hand === 'left' ? 2 : 1,
    hand,
    voice: '1',
    tieStart: options.tieStart ?? false,
    tieStop: options.tieStop ?? false,
  };
}

function bars(count: number, repeatFrom: number | null = null): Measure[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    number: String(index + 1),
    start: index * 4 * Q,
    duration: 4 * Q,
    beats: 4,
    beatType: 4,
    repeat: {
      forward: index === repeatFrom,
      backwardTimes: repeatFrom !== null && index === count - 1 ? 2 : null,
      ending: [],
    },
    jumps: [],
  }));
}

function score(measures: Measure[], notes: ScoreNote[], tempos: Score['tempos'] = []): Score {
  notes.sort((a, b) => a.onset - b.onset || a.midi - b.midi);
  return { title: '', composer: '', parts: [], hands: {}, measures, notes, tempos, warnings: [] };
}

/** Two bars, the second repeated: right C5 D5 per bar, left a C3–G3 half-note chord, and a voice. */
function song(): Score {
  const notes: ScoreNote[] = [];
  for (const m of [0, 1]) {
    notes.push(note(m, 0, Q, 72, 'right'), note(m, Q, Q, 74, 'right'));
    notes.push(note(m, 0, 2 * Q, 48, 'left'), note(m, 0, 2 * Q, 55, 'left'));
  }
  notes.push(note(0, 2 * Q, Q, 76, null));
  return score(bars(2, 1), notes);
}

function demo(s: Score, hands: HandSelection, extra: Partial<Parameters<typeof demoPlan>[0]> = {}) {
  const order = extra.order ?? performanceOrder(s.measures);
  return demoPlan({
    score: s,
    order,
    steps: buildSteps(s, hands, order),
    hands,
    loop: null,
    startBar: 0,
    scale: 1,
    ...extra,
  })!;
}

const round = (n: number) => Math.round(n * 100) / 100;
const times = (plan: { notes: { midi: number; on: number; off: number }[] }) =>
  plan.notes.map((n) => `${n.midi}:${round(n.on)}-${round(n.off)}`);

describe('tempo', () => {
  it('uses the first tempo mark, else a moderate default', () => {
    expect(baseTempo({ tempos: [] })).toBe(DEFAULT_BPM);
    expect(baseTempo({ tempos: [{ tick: 0, bpm: 126 }] })).toBe(126);
  });

  it('turns ticks into milliseconds, scaled', () => {
    const s = score(bars(2), []);
    const order = performanceOrder(s.measures);
    expect(timeline(s, order)(Q)).toBeCloseTo(MSQ);
    expect(timeline(s, order, 0.5)(Q)).toBeCloseTo(2 * MSQ);
    expect(timeline(s, order, 2)(8 * Q)).toBeCloseTo(4 * MSQ);
  });

  it('follows tempo changes through the play order, including inside a bar and a repeat', () => {
    // 120 in bar 1, 60 from bar 2 (repeated), 240 from beat 3 of bar 2.
    const s = score(
      bars(2, 1),
      [],
      [
        { tick: 0, bpm: 120 },
        { tick: 4 * Q, bpm: 60 },
        { tick: 6 * Q, bpm: 240 },
      ],
    );
    const ms = timeline(s, performanceOrder(s.measures));
    expect(ms(4 * Q)).toBeCloseTo(2000);
    expect(ms(6 * Q)).toBeCloseTo(4000);
    expect(ms(8 * Q)).toBeCloseTo(4500);
    // The repeat starts at 60 again, as its bar is marked.
    expect(ms(10 * Q)).toBeCloseTo(6500);
    expect(ms(12 * Q)).toBeCloseTo(7000);
  });

  it('a mark later in the piece does not slow down the bars before it', () => {
    const s = score(bars(2), [], [{ tick: 4 * Q, bpm: 60 }]);
    const ms = timeline(s, performanceOrder(s.measures));
    expect(ms(4 * Q)).toBeCloseTo(4000);
  });
});

describe('performedNotes', () => {
  it('joins tied notes and never strikes a tied continuation again', () => {
    const s = score(bars(2), [
      note(0, 2 * Q, 2 * Q, 60, 'right', { tieStart: true }),
      note(1, 0, Q, 60, 'right', { tieStop: true, tieStart: true }),
      note(1, Q, Q, 60, 'right', { tieStop: true }),
      note(1, 2 * Q, Q, 60, 'right'),
    ]);
    const order = performanceOrder(s.measures);
    expect(performedNotes(s, order, () => true)).toEqual([
      { midi: 60, on: 2 * Q, off: 6 * Q },
      { midi: 60, on: 6 * Q, off: 7 * Q },
    ]);
    // Starting inside the tie: the continuation is not struck.
    expect(performedNotes(s, order, () => true, 1, 1)).toEqual([
      { midi: 60, on: 6 * Q, off: 7 * Q },
    ]);
  });

  it('merges a unison of the two hands and unrolls repeats', () => {
    const s = score(bars(2, 1), [
      note(0, 0, Q, 64, 'right'),
      note(0, 0, 2 * Q, 64, 'left'),
      note(1, 0, Q, 67, 'right'),
    ]);
    expect(performedNotes(s, performanceOrder(s.measures), () => true)).toEqual([
      { midi: 64, on: 0, off: 2 * Q },
      { midi: 67, on: 4 * Q, off: 5 * Q },
      { midi: 67, on: 8 * Q, off: 9 * Q },
    ]);
  });
});

describe('demoPlan', () => {
  it('plays the selected hands; both plays the whole score', () => {
    const s = song();
    expect(times(demo(s, 'right'))).toEqual([
      `72:0-${round(MSQ)}`,
      `74:${round(MSQ)}-${round(2 * MSQ)}`,
      `72:${round(4 * MSQ)}-${round(5 * MSQ)}`,
      `74:${round(5 * MSQ)}-${round(6 * MSQ)}`,
      `72:${round(8 * MSQ)}-${round(9 * MSQ)}`,
      `74:${round(9 * MSQ)}-${round(10 * MSQ)}`,
    ]);
    expect(demo(s, 'left').notes.map((n) => n.midi)).toEqual([48, 55, 48, 55, 48, 55]);
    const both = demo(s, 'both');
    expect(both.notes).toHaveLength(13);
    expect(both.notes.filter((n) => n.midi === 76)).toHaveLength(1); // the voice
    expect(both.length).toBeCloseTo(12 * MSQ);
    expect(both.loop).toBe(false);
  });

  it('gives the time of every step for the cursor', () => {
    const plan = demo(song(), 'right');
    expect(plan.steps.map((s) => s.step)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(plan.steps.map((s) => round(s.at))).toEqual(
      [0, 1, 4, 5, 8, 9].map((q) => round(q * MSQ)),
    );
  });

  it('skips repeats when asked', () => {
    const s = song();
    const plan = demo(s, 'right', { order: writtenOrder(s.measures) });
    expect(plan.notes).toHaveLength(4);
    expect(plan.length).toBeCloseTo(8 * MSQ);
  });

  it('plays a loop round and round from its first bar, and the first time from the start bar', () => {
    const s = song();
    const plan = demo(s, 'right', { loop: { from: 1, to: 1 }, startBar: 1 });
    expect(plan.loop).toBe(true);
    expect(plan.length).toBeCloseTo(4 * MSQ);
    expect(plan.start).toBe(0);
    expect(plan.notes.map((n) => n.midi)).toEqual([72, 74]);
    expect(plan.steps.map((st) => st.step)).toEqual([2, 3]);

    const fromBar2 = demo(s, 'right', { startBar: 1 });
    expect(fromBar2.start).toBeCloseTo(4 * MSQ);
    expect(fromBar2.notes).toHaveLength(6);
  });

  it('scales every time with the tempo', () => {
    const s = song();
    const slow = demo(s, 'right', { scale: 0.5 });
    const normal = demo(s, 'right');
    slow.notes.forEach((n, i) => {
      expect(n.on).toBeCloseTo(normal.notes[i]!.on * 2);
      expect(n.off).toBeCloseTo(normal.notes[i]!.off * 2);
    });
    expect(slow.length).toBeCloseTo(normal.length * 2);
  });

  it('releases a repeated key a little before striking it again, also across the loop', () => {
    const s = score(bars(1), [
      note(0, 0, Q, 60, 'right'),
      note(0, Q, Q, 60, 'right'),
      note(0, 2 * Q, 2 * Q, 60, 'right'),
    ]);
    const plan = demo(s, 'right');
    expect(times(plan)).toEqual([
      `60:0-${round(MSQ - RELEASE_GAP_MS)}`,
      `60:${round(MSQ)}-${round(2 * MSQ - RELEASE_GAP_MS)}`,
      `60:${round(2 * MSQ)}-${round(4 * MSQ)}`,
    ]);
    const looped = demo(s, 'right', { loop: { from: 0, to: 0 } });
    expect(looped.notes.at(-1)!.off).toBeCloseTo(4 * MSQ - RELEASE_GAP_MS);
    // Very fast repeats keep a quarter of the time between them as the gap.
    const fast = demo(s, 'right', { scale: 20 });
    expect(fast.notes[0]!.off).toBeCloseTo((MSQ / 20) * 0.75);
  });

  it('is null when there is nothing to play', () => {
    const s = score(bars(1), [note(0, 0, Q, 60, 'left')]);
    const order = performanceOrder(s.measures);
    expect(
      demoPlan({
        score: s,
        order,
        steps: buildSteps(s, 'right', order),
        hands: 'right',
        loop: null,
        startBar: 0,
        scale: 1,
      }),
    ).toBeNull();
  });
});

describe('playSpan', () => {
  it('matches the bars wait mode practises', () => {
    const s = song();
    const order = performanceOrder(s.measures);
    expect(playSpan(s, order, null, 0)).toEqual({
      first: 0,
      last: 2,
      start: 0,
      from: 0,
      to: 12 * Q,
      startTick: 0,
    });
    expect(playSpan(s, order, { from: 0, to: 1 }, 1)).toMatchObject({
      first: 0,
      last: 1,
      start: 1,
    });
    expect(playSpan(s, order, null, 1)).toMatchObject({ start: 1, startTick: 4 * Q });
  });
});

describe('accompanimentPlan', () => {
  /**
   * Bar 1: right C5 D5 . E5; left a C3–G3 chord, an A3 on the "and" of beat 1, and F3 on beat 3
   * tied into bar 2. Bar 2: left C3 on beat 1, right G5 on beat 2.
   */
  function piece(): Score {
    return score(bars(2), [
      note(0, 0, Q, 72, 'right'),
      note(0, Q, Q, 74, 'right'),
      note(0, 3 * Q, Q, 76, 'right'),
      note(0, 0, 2 * Q, 48, 'left'),
      note(0, 0, 2 * Q, 55, 'left'),
      note(0, Q / 2, Q / 2, 57, 'left'),
      note(0, 2 * Q, 2 * Q, 53, 'left', { tieStart: true }),
      note(1, 0, Q, 53, 'left', { tieStop: true }),
      note(1, 0, Q, 48, 'left'),
      note(1, Q, Q, 79, 'right'),
    ]);
  }

  function plan(s: Score, hand: Hand, loop: { from: number; to: number } | null = null) {
    const order = performanceOrder(s.measures);
    return accompanimentPlan({
      score: s,
      order,
      steps: buildSteps(s, hand, order),
      hand,
      loop,
      scale: 1,
    })!;
  }

  const describeStep = (group: {
    pos: number;
    notes: { midi: number; at: number; length: number; until: number }[];
  }) =>
    group.notes.map(
      (n) => `${n.midi}@${round(n.at / MSQ)}q+${round(n.length / MSQ)}q until ${n.until / Q}q`,
    );

  it('gives each step the other hand’s notes up to the next step, chords included', () => {
    const p = plan(piece(), 'right');
    expect(p.lapTicks).toBe(8 * Q);
    expect([...p.steps.keys()]).toEqual([0, 1, 2, 3]);
    expect(describeStep(p.steps.get(0)!)).toEqual([
      '48@0q+2q until 2q',
      '55@0q+2q until 2q',
      '57@0.5q+0.5q until 1q',
    ]);
    // F3 is struck once, on beat 3, and lasts through its tie into bar 2.
    expect(describeStep(p.steps.get(1)!)).toEqual(['53@1q+3q until 4q']);
    expect(describeStep(p.steps.get(2)!)).toEqual(['48@1q+1q until 2q']);
    expect(describeStep(p.steps.get(3)!)).toEqual([]);
    expect(p.steps.get(2)!.pos).toBe(3 * Q);
  });

  it('practising the left hand, the right hand accompanies', () => {
    const p = plan(piece(), 'left');
    // Left steps: beat 1 (C3 G3), "and" (A3), beat 3 (F3), bar 2 beat 1 (C3; F3 is held).
    expect([...p.steps.keys()]).toEqual([0, 1, 2, 3]);
    expect(describeStep(p.steps.get(0)!)).toEqual(['72@0q+1q until 1q']);
    expect(describeStep(p.steps.get(1)!)).toEqual(['74@0.5q+1q until 1.5q']);
    expect(describeStep(p.steps.get(2)!)).toEqual(['76@1q+1q until 2q']);
    expect(describeStep(p.steps.get(3)!)).toEqual(['79@1q+1q until 2q']);
  });

  it('in a loop, what comes before the first step is played after the last one, as a lead-in', () => {
    const p = plan(piece(), 'right', { from: 1, to: 1 });
    expect(p.lapTicks).toBe(4 * Q);
    // Only G5 is practised in bar 2; C3 on beat 1 leads into the next time round.
    // F3's tie starts outside the loop, so it is not struck.
    expect([...p.steps.keys()]).toEqual([3]);
    expect(describeStep(p.steps.get(3)!)).toEqual(['48@3q+1q until 4q']);
    expect(p.steps.get(3)!.pos).toBe(Q);
  });

  it('without a loop, notes before the first step are not played', () => {
    const s = score(bars(1), [note(0, 0, Q, 48, 'left'), note(0, Q, Q, 72, 'right')]);
    expect(describeStep(plan(s, 'right').steps.get(0)!)).toEqual([]);
  });

  it('includes parts nobody practises', () => {
    const p = plan(song(), 'left');
    expect(p.steps.get(0)!.notes.map((n) => n.midi)).toEqual([72, 74, 76]);
  });
});
