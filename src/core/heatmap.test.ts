import { describe, expect, it } from 'vitest';
import {
  byWeakness,
  comparePitch,
  hasEnoughData,
  keyCells,
  MIN_ATTEMPTS,
  noteCells,
  SPEED_BUCKETS,
  SPEED_EDGES_MS,
  sortCells,
  speedBucket,
  weakestNotes,
  type NoteCell,
} from './heatmap.ts';
import { getLevel, parseNoteKey } from './levels.ts';
import {
  emptyStats,
  noteWeight,
  TARGET_MS,
  updateStats,
  type NoteStats,
  type ScoredAnswer,
} from './weakness.ts';

type Answer = Partial<ScoredAnswer>;

function stats(key: string, answers: Answer[]): NoteStats {
  return answers.reduce(
    (s, a, i) =>
      updateStats(s, { correct: true, ms: 1000, hinted: false, timedOut: false, at: i, ...a }),
    emptyStats(key),
  );
}

const times = (n: number, answer: Answer = {}): Answer[] => Array.from({ length: n }, () => answer);

function byKey(...list: NoteStats[]): Record<string, NoteStats> {
  return Object.fromEntries(list.map((s) => [s.key, s]));
}

const keys = (cells: readonly NoteCell[]) => cells.map((c) => c.key);

describe('speed buckets', () => {
  it('are anchored on the target and the weight clamp: 750, 1000, 1500, 2000, 3000, 4500 ms', () => {
    expect(TARGET_MS).toBe(1500);
    expect(SPEED_EDGES_MS).toEqual([750, 1000, 1500, 2000, 3000, 4500]);
    expect(SPEED_BUCKETS).toBe(7);
  });

  it('put each edge into the slower bucket', () => {
    expect(speedBucket(0)).toBe(0);
    expect(speedBucket(749)).toBe(0);
    expect(speedBucket(750)).toBe(1);
    expect(speedBucket(1499)).toBe(2);
    expect(speedBucket(1500)).toBe(3);
    expect(speedBucket(4499)).toBe(5);
    expect(speedBucket(4500)).toBe(6);
    expect(speedBucket(60_000)).toBe(6);
  });

  it('grow with the reaction time', () => {
    let last = 0;
    for (let ms = 0; ms < 6000; ms += 50) {
      expect(speedBucket(ms)).toBeGreaterThanOrEqual(last);
      last = speedBucket(ms);
    }
  });
});

describe('noteCells', () => {
  it('needs 3 answers and a timely correct one before a note gets a colour', () => {
    const cells = noteCells(
      byKey(
        stats('C4@treble', times(2, { ms: 900 })),
        stats('D4@treble', times(3, { ms: 900 })),
        stats('E4@treble', times(5, { correct: false })),
        stats('F4@treble', times(4, { ms: 900, hinted: true })),
      ),
    );
    expect(cells.map((c) => [c.key, c.bucket])).toEqual([
      ['C4@treble', null],
      ['D4@treble', 1],
      ['E4@treble', null],
      ['F4@treble', null],
    ]);
    expect(MIN_ATTEMPTS).toBe(3);
    expect(hasEnoughData({ attempts: 3, ewmaMs: 0 })).toBe(true);
  });

  it('reports counts, recent accuracy, error rate and the sampler weight', () => {
    const s = stats('G4@treble', [
      ...times(8, { correct: false }),
      ...times(8, { ms: 3200 }),
      { correct: false },
      { correct: false },
    ]);
    const [cell] = noteCells(byKey(s));
    expect(cell).toMatchObject({
      key: 'G4@treble',
      attempts: 18,
      correct: 8,
      recentCount: 10,
      recentCorrect: 8,
      errorRate: 0.2,
      ewmaMs: 3200,
      bucket: 5,
    });
    expect(cell!.weight).toBe(noteWeight(s));
    expect(cell!.note).toEqual(parseNoteKey('G4@treble'));
  });

  it('orders by pitch: bass before treble on the same key, C♯ before D♭', () => {
    const list = ['Db4@treble', 'C4@treble', 'C#4@treble', 'C4@bass', 'B3@bass', 'C#4@bass'];
    const cells = noteCells(byKey(...list.map((k) => stats(k, times(1)))));
    expect(keys(cells)).toEqual([
      'B3@bass',
      'C4@bass',
      'C4@treble',
      'C#4@bass',
      'C#4@treble',
      'Db4@treble',
    ]);
  });

  it('keeps only practised notes of the level pool when filtered', () => {
    const all = byKey(
      stats('C4@treble', times(1)),
      stats('A4@treble', times(1)),
      stats('C4@bass', times(1)),
      stats('F#4@treble', times(1)),
      { ...emptyStats('D4@treble') },
    );
    expect(keys(noteCells(all))).toEqual(['C4@bass', 'C4@treble', 'F#4@treble', 'A4@treble']);
    expect(keys(noteCells(all, 'L1'))).toEqual(['C4@treble']);
    expect(keys(noteCells(all, 'L3'))).toEqual(['C4@bass']);
    expect(keys(noteCells(all, 'L7'))).toEqual(['F#4@treble']);
    for (const cell of noteCells(all, 'L5')) {
      expect(getLevel('L5').notes.some((n) => n.key === cell.key)).toBe(true);
    }
  });

  it('ignores keys it cannot read', () => {
    expect(noteCells(byKey(stats('H4@treble', times(3))))).toEqual([]);
  });
});

describe('keyCells', () => {
  it('adds up both staves and spellings of a key, weighting the time by attempts', () => {
    const cells = noteCells(
      byKey(
        stats('C#4@treble', times(3, { ms: 1000 })),
        stats('Db4@bass', times(1, { ms: 4000 })),
        stats('C#4@bass', times(2, { correct: false })),
        stats('E4@treble', times(4, { ms: 2000 })),
      ),
    );
    const [cs, e] = keyCells(cells);
    expect(cs).toMatchObject({
      midi: 61,
      attempts: 6,
      correct: 4,
      recentCount: 6,
      recentCorrect: 4,
      ewmaMs: (3 * 1000 + 1 * 4000) / 4,
      bucket: 3,
    });
    expect(cs!.errorRate).toBeCloseTo(2 / 6, 9);
    expect(cs!.notes.map((n) => n.key)).toEqual(['C#4@bass', 'Db4@bass', 'C#4@treble']);
    expect(e).toMatchObject({ midi: 64, ewmaMs: 2000, bucket: 4 });
  });

  it('has no colour without enough answers or without a timely correct one', () => {
    const [few, wrong] = keyCells(
      noteCells(
        byKey(
          stats('C4@treble', times(1, { ms: 900 })),
          stats('C4@bass', times(1, { ms: 900 })),
          stats('D4@treble', times(4, { correct: false })),
        ),
      ),
    );
    expect(few).toMatchObject({ attempts: 2, bucket: null });
    expect(wrong).toMatchObject({ attempts: 4, ewmaMs: null, bucket: null, errorRate: 1 });
  });
});

describe('weakness order', () => {
  const cells = noteCells(
    byKey(
      stats('C4@treble', times(5, { ms: 800 })), // weight 0.53
      stats('D4@treble', times(5, { ms: 3000 })), // weight 2
      stats('E4@treble', [...times(4, { ms: 1500 }), { correct: false }]), // 1.6
      stats('F4@treble', times(4, { correct: false })), // no time, weight 4
      stats('G4@treble', times(2, { correct: false })), // too few answers
      stats('A4@treble', times(5, { ms: 1500 })), // weight 1
    ),
  );

  it('uses the sampler weight, weakest first, and leaves notes with few answers out', () => {
    expect(keys(weakestNotes(cells))).toEqual(['F4@treble', 'D4@treble', 'E4@treble']);
    expect(keys(weakestNotes(cells, 10))).not.toContain('G4@treble');
    expect(keys([...cells].sort(byWeakness)).at(-1)).toBe('G4@treble');
  });

  it('breaks weight ties by the slower time, then by pitch', () => {
    const tied = noteCells(
      byKey(
        stats('C4@treble', times(3, { ms: 500 })),
        stats('D4@treble', times(3, { ms: 700 })),
        stats('E4@treble', times(3, { ms: 700 })),
      ),
    );
    expect(keys(weakestNotes(tied))).toEqual(['D4@treble', 'E4@treble', 'C4@treble']);
  });

  it('sorts the table by any column, with missing values and few answers last', () => {
    expect(keys(sortCells(cells, 'weakness'))).toEqual([
      'F4@treble',
      'D4@treble',
      'E4@treble',
      'A4@treble',
      'C4@treble',
      'G4@treble',
    ]);
    expect(keys(sortCells(cells, 'weakness', 'ascending')).slice(0, 2)).toEqual([
      'C4@treble',
      'A4@treble',
    ]);
    expect(keys(sortCells(cells, 'weakness', 'ascending')).at(-1)).toBe('G4@treble');
    expect(keys(sortCells(cells, 'speed'))).toEqual([
      'D4@treble',
      'E4@treble',
      'A4@treble',
      'C4@treble',
      'F4@treble',
      'G4@treble',
    ]);
    expect(keys(sortCells(cells, 'speed', 'ascending')).slice(-2)).toEqual([
      'F4@treble',
      'G4@treble',
    ]);
    expect(keys(sortCells(cells, 'recent')).slice(0, 2)).toEqual(['F4@treble', 'G4@treble']);
    expect(keys(sortCells(cells, 'note', 'descending'))[0]).toBe('A4@treble');
    expect(sortCells(cells, 'attempts').map((c) => c.attempts)).toEqual([5, 5, 5, 5, 4, 2]);
  });
});

describe('comparePitch', () => {
  it('is a total order that puts lower keys first', () => {
    const a = parseNoteKey('B3@treble')!;
    const b = parseNoteKey('C4@bass')!;
    expect(comparePitch(a, b)).toBeLessThan(0);
    expect(comparePitch(b, a)).toBeGreaterThan(0);
    expect(comparePitch(a, a)).toBe(0);
  });
});
