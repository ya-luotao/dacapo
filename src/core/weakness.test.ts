import { describe, expect, it } from 'vitest';
import { getLevel, type StaffNote } from './levels.ts';
import { seededRng } from './random.ts';
import {
  emptyStats,
  errorRate,
  EWMA_ALPHA,
  noteWeight,
  pickNext,
  RECENT_LENGTH,
  statsFromAttempts,
  UNSEEN_NOVELTY,
  updateStats,
  type NoteStats,
  type ScoredAnswer,
  type StatsByKey,
} from './weakness.ts';

const answer = (patch: Partial<ScoredAnswer> = {}): ScoredAnswer => ({
  correct: true,
  ms: 1000,
  hinted: false,
  timedOut: false,
  at: 1_700_000_000_000,
  ...patch,
});

const apply = (answers: Partial<ScoredAnswer>[], key = 'C4@treble'): NoteStats =>
  answers.reduce((stats, a) => updateStats(stats, answer(a)), emptyStats(key));

function counts(
  pool: readonly StaffNote[],
  stats: StatsByKey,
  draws: number,
  seed = 1,
): Map<string, number> {
  const rng = seededRng(seed);
  const result = new Map<string, number>(pool.map((note) => [note.key, 0]));
  let previous: StaffNote | null = null;
  for (let i = 0; i < draws; i++) {
    previous = pickNext(pool, stats, previous, rng);
    result.set(previous.key, result.get(previous.key)! + 1);
  }
  return result;
}

describe('updateStats', () => {
  it('counts attempts, correct answers and errors and remembers when', () => {
    const stats = apply([{ correct: true }, { correct: false, at: 5 }]);
    expect(stats).toMatchObject({
      key: 'C4@treble',
      attempts: 2,
      correct: 1,
      errors: 1,
      lastSeen: 5,
    });
    expect(stats.recent).toEqual([true, false]);
  });

  it('seeds the EWMA with the first timely answer, then smooths with α = 0.3', () => {
    const stats = apply([{ ms: 1000 }, { ms: 2000 }]);
    expect(EWMA_ALPHA).toBe(0.3);
    expect(stats.ewmaMs).toBeCloseTo(0.3 * 2000 + 0.7 * 1000);
  });

  it('updates the EWMA only on correct, un-hinted, timely answers', () => {
    const base = apply([{ ms: 1000 }]);
    expect(updateStats(base, answer({ correct: false, ms: 9000 })).ewmaMs).toBe(1000);
    expect(updateStats(base, answer({ hinted: true, ms: 9000 })).ewmaMs).toBe(1000);
    expect(updateStats(base, answer({ timedOut: true, ms: 40_000 })).ewmaMs).toBe(1000);
    expect(updateStats(base, answer({ ms: 2000 })).ewmaMs).not.toBe(1000);
    expect(apply([{ hinted: true }, { correct: false }]).ewmaMs).toBeNull();
  });

  it('still counts hinted and timed-out answers towards accuracy', () => {
    const stats = apply([{ hinted: true }, { timedOut: true, correct: false }]);
    expect(stats).toMatchObject({ attempts: 2, correct: 1, errors: 1 });
  });

  it('keeps only the last ten results', () => {
    const stats = apply(Array.from({ length: 12 }, (_, i) => ({ correct: i >= 2 })));
    expect(stats.recent).toHaveLength(RECENT_LENGTH);
    expect(stats.recent.every(Boolean)).toBe(true);
  });

  it('does not mutate its input and round-trips through JSON', () => {
    const before = apply([{ ms: 1200 }]);
    const copy = structuredClone(before);
    updateStats(before, answer({ correct: false }));
    expect(before).toEqual(copy);
    expect(JSON.parse(JSON.stringify(before))).toEqual(before);
  });
});

describe('noteWeight', () => {
  it('gives unseen notes the novelty weight', () => {
    expect(noteWeight(undefined)).toBe(UNSEEN_NOVELTY);
    expect(noteWeight(emptyStats('x'))).toBe(UNSEEN_NOVELTY);
    expect(UNSEEN_NOVELTY).toBeGreaterThan(noteWeight(apply([{ ms: 1500 }])));
  });

  it('is 1 for a note answered correctly at the target speed', () => {
    expect(noteWeight(apply([{ ms: 1500 }]))).toBeCloseTo(1);
  });

  it('grows with the recent error rate: w × (1 + errorRate × 3)', () => {
    const stats = apply([{ ms: 1500 }, { correct: false }]);
    expect(errorRate(stats)).toBe(0.5);
    expect(noteWeight(stats)).toBeCloseTo(2.5);
  });

  it('scales with speed, clamped to 0.5–3', () => {
    expect(noteWeight(apply([{ ms: 3000 }]))).toBeCloseTo(2);
    expect(noteWeight(apply([{ ms: 100 }]))).toBeCloseTo(0.5);
    expect(noteWeight(apply([{ ms: 20_000 }]))).toBeCloseTo(3);
  });

  it('treats a note without a timely answer as on target speed', () => {
    expect(noteWeight(apply([{ correct: false }]))).toBeCloseTo(4);
  });
});

describe('pickNext', () => {
  const pool = getLevel('L2').notes;

  it('is deterministic for a given rng', () => {
    const a = counts(pool, {}, 200, 42);
    const b = counts(pool, {}, 200, 42);
    expect([...a]).toEqual([...b]);
    const sequence = (seed: number) => {
      const rng = seededRng(seed);
      return Array.from({ length: 10 }, () => pickNext(pool, {}, null, rng).key);
    };
    expect(sequence(7)).toEqual(sequence(7));
    expect(sequence(7)).not.toEqual(sequence(8));
  });

  it('never returns the previous note twice in a row', () => {
    const rng = seededRng(3);
    // A pool of two with one note weighted heavily makes a repeat very likely if unguarded.
    const two = pool.slice(0, 2);
    const stats: StatsByKey = { [two[0]!.key]: apply([{ correct: false }, { correct: false }]) };
    let previous = pickNext(two, stats, null, rng);
    for (let i = 0; i < 500; i++) {
      const next = pickNext(two, stats, previous, rng);
      expect(next.key).not.toBe(previous.key);
      previous = next;
    }
  });

  it('never repeats the same key on the other staff either', () => {
    const grand = getLevel('L5').notes;
    const rng = seededRng(11);
    let previous = pickNext(grand, {}, null, rng);
    for (let i = 0; i < 2000; i++) {
      const next = pickNext(grand, {}, previous, rng);
      expect(next.midi).not.toBe(previous.midi);
      previous = next;
    }
  });

  it('samples weak notes measurably more often', () => {
    const seen: Record<string, NoteStats> = {};
    for (const note of pool) seen[note.key] = apply([{ ms: 1500 }], note.key);
    const weak = pool[3]!.key;
    seen[weak] = apply([{ ms: 3000 }, { correct: false }, { correct: false }], weak);
    const drawn = counts(pool, seen, 20_000);
    const others = pool.filter((n) => n.key !== weak).map((n) => drawn.get(n.key)!);
    const mean = others.reduce((a, b) => a + b, 0) / others.length;
    expect(drawn.get(weak)!).toBeGreaterThan(2.5 * mean);
  });

  it('samples slow notes more often than fast ones', () => {
    const seen: Record<string, NoteStats> = {};
    for (const note of pool) seen[note.key] = apply([{ ms: 1500 }], note.key);
    const slow = pool[1]!.key;
    const fast = pool[5]!.key;
    seen[slow] = apply([{ ms: 4000 }], slow);
    seen[fast] = apply([{ ms: 600 }], fast);
    const drawn = counts(pool, seen, 20_000);
    expect(drawn.get(slow)!).toBeGreaterThan(3 * drawn.get(fast)!);
  });

  it('favours unseen notes over well-known ones', () => {
    const seen: Record<string, NoteStats> = {};
    for (const note of pool.slice(0, 6)) seen[note.key] = apply([{ ms: 1500 }], note.key);
    const drawn = counts(pool, seen, 20_000);
    const unseen = pool.slice(6).map((n) => drawn.get(n.key)!);
    const known = pool.slice(0, 6).map((n) => drawn.get(n.key)!);
    expect(Math.min(...unseen)).toBeGreaterThan(2.5 * Math.max(...known));
  });

  it('still reaches every note', () => {
    const drawn = counts(getLevel('L6').notes, {}, 5000);
    expect([...drawn.values()].every((n) => n > 0)).toBe(true);
  });

  it('throws when nothing but the previous note is left', () => {
    const one = pool.slice(0, 1);
    expect(() => pickNext(one, {}, one[0]!, seededRng(1))).toThrow(RangeError);
  });
});

describe('statsFromAttempts', () => {
  it('equals recording the attempts one by one, in order of time', () => {
    const rng = seededRng(3);
    const notes = ['C4@treble', 'D4@treble', 'C4@bass'];
    const attempts = Array.from({ length: 200 }, (_, i) => ({
      note: notes[Math.floor(rng() * notes.length)]!,
      ...answer({
        correct: rng() > 0.3,
        ms: 300 + Math.floor(rng() * 4000),
        hinted: rng() > 0.9,
        timedOut: false,
        at: 1_700_000_000_000 + i * 1000,
      }),
    }));
    const incremental: Record<string, NoteStats> = {};
    for (const a of attempts) {
      incremental[a.note] = updateStats(incremental[a.note] ?? emptyStats(a.note), a);
    }
    const shuffled = [...attempts].sort(() => rng() - 0.5);
    expect(statsFromAttempts(shuffled)).toEqual(incremental);
  });

  it('is empty without attempts', () => {
    expect(statsFromAttempts([])).toEqual({});
  });
});
