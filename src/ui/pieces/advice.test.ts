import { describe, expect, it } from 'vitest';
import type { PieceFacts } from '../../core/pieceRecords.ts';
import { REVIEW_INTERVALS } from '../../core/review.ts';
import type { Hand, HandSelection } from '../../core/score.ts';
import { afterRun, stepHand } from './advice.ts';
import { recordedRun, type RecordedRun, type RunContext } from './record.ts';

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 1, 18).getTime();
/** Four bars for each hand; 16 keys with both. */
const FACTS: PieceFacts = {
  checksum: 'abcdef01',
  bars: { right: 4, left: 4, both: 4 },
  notes: { play: 16, skip: 16 },
};

interface RunOptions {
  day: number;
  hands?: HandSelection;
  rhythm?: number;
  bars?: number;
  loop?: boolean;
}

/** A clean run of two steps a bar on day `day`: in wait mode, or in rhythm mode at a tempo. */
function run(id: string, o: RunOptions): RecordedRun {
  const context: RunContext = {
    pieceId: 'p',
    checksum: FACTS.checksum,
    title: 'Piece',
    hands: o.hands ?? 'both',
    loop: o.loop ? { from: 0, to: 3, fromLabel: '1', toLabel: '4' } : null,
    repeats: 'play',
    tempo: o.rhythm ?? 100,
    ...(o.rhythm !== undefined && { mode: 'rhythm' as const }),
  };
  const start = T0 + o.day * DAY;
  const records = Array.from({ length: (o.bars ?? 4) * 2 }, (_, n) => ({
    measure: n >> 1,
    pass: 1,
    ms: 500,
    wrong: 0,
    epoch: start + n * 500,
    ...(o.rhythm !== undefined && { notes: [{ midi: 60, deviation: 4 }] }),
  }));
  return recordedRun(
    { id, records, startedEpoch: start, ended: { completed: true }, take: null, takeDone: true },
    context,
  )!;
}

const stored = (...runs: RecordedRun[]) => ({
  sessions: runs.map((r) => r.session),
  steps: runs.flatMap((r) => r.steps),
});

describe('afterRun', () => {
  it('counts the run for the ladder of its hands, stored yet or not', () => {
    const first = run('a', { day: 0, rhythm: 60, hands: 'right' });
    expect(afterRun(first, stored(), FACTS, false)).toMatchObject({
      whole: true,
      ladder: { reached: 60, next: 70 },
    });
    // The store has it already (and one of its steps twice over): it is counted once.
    expect(afterRun(first, stored(first), FACTS, false).ladder).toEqual({ reached: 60, next: 70 });
    const second = run('b', { day: 0, rhythm: 70, hands: 'right' });
    expect(afterRun(second, stored(first), FACTS, false).ladder).toEqual({
      reached: 70,
      next: 80,
    });
    // The other hand's ladder is its own.
    const left = run('c', { day: 0, rhythm: 60, hands: 'left' });
    expect(afterRun(left, stored(first, second), FACTS, false).ladder.reached).toBe(60);
  });

  it('does not count a loop or a run of some of the bars', () => {
    expect(afterRun(run('a', { day: 0, loop: true }), stored(), FACTS, false).whole).toBe(false);
    expect(afterRun(run('a', { day: 0, bars: 3 }), stored(), FACTS, false).whole).toBe(false);
  });

  it('says what the run did to the review', () => {
    const first = run('a', { day: 0 });
    expect(afterRun(first, stored(), FACTS, false).review).toEqual({
      kind: 'new',
      days: REVIEW_INTERVALS[0],
    });
    expect(afterRun(first, stored(first), FACTS, false).review?.kind).toBe('new');
    expect(afterRun(first, stored(), FACTS, true).review).toBeNull();
    const second = run('b', { day: 1 });
    expect(afterRun(second, stored(first), FACTS, false).review).toEqual({
      kind: 'better',
      days: REVIEW_INTERVALS[1],
    });
    // One hand of two is no review of the piece; nor is a run before the date.
    const right = run('c', { day: 1, hands: 'right' });
    expect(afterRun(right, stored(first), FACTS, false).review).toBeNull();
    expect(afterRun(run('d', { day: 2 }), stored(first, second), FACTS, false).review).toBeNull();
    // Until the other runs' steps are read, their grades cannot be told.
    expect(
      afterRun(second, { sessions: [first.session], steps: null }, FACTS, false).review,
    ).toBeNull();
  });

  it('counts wrong notes against the piece’s keys, or one hand’s against its steps', () => {
    expect(afterRun(run('a', { day: 0 }), stored(), FACTS, false).notes).toBe(16);
    expect(afterRun(run('a', { day: 0, hands: 'left' }), stored(), FACTS, false).notes).toBe(8);
    // A piece with nothing for the left hand: the right hand plays every note.
    const melody = { ...FACTS, bars: { right: 4, left: 0, both: 4 } };
    expect(afterRun(run('a', { day: 0, hands: 'right' }), stored(), melody, false).notes).toBe(16);
    // Facts kept before the keys were counted: the steps stand in.
    const old: PieceFacts = { checksum: FACTS.checksum, bars: FACTS.bars };
    expect(afterRun(run('a', { day: 0 }), stored(), old, false).notes).toBe(8);
  });
});

describe('stepHand', () => {
  const hands: Record<string, Hand | null> = { r1: 'right', r2: 'right', l1: 'left', x: null };
  const handOf = (id: string) => hands[id];

  it('is the hand that plays the step when only one does', () => {
    expect(stepHand({ noteIds: ['r1', 'r2'] }, handOf)).toBe('right');
    expect(stepHand({ noteIds: ['l1'] }, handOf)).toBe('left');
  });

  it('is none where both play, or a note has no hand', () => {
    expect(stepHand({ noteIds: ['r1', 'l1'] }, handOf)).toBeNull();
    expect(stepHand({ noteIds: ['x'] }, handOf)).toBeNull();
    expect(stepHand({ noteIds: ['r1', 'gone'] }, handOf)).toBeNull();
    expect(stepHand({ noteIds: [] }, handOf)).toBeNull();
    expect(stepHand(undefined, handOf)).toBeNull();
  });
});
