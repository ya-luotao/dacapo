import { describe, expect, it } from 'vitest';
import { pieceSession, stepId, type PieceFacts, type PieceStep } from './pieceRecords.ts';
import {
  byReview,
  daysBetween,
  evenBars,
  gradeRun,
  isRunToTheEnd,
  REVIEW_INTERVALS,
  reviewSchedule,
  reviewStatus,
} from './review.ts';
import type { PieceSessionRecord } from './log.ts';

const TZ = 'UTC';
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 8, 1, 18); // 1 September, 18:00
/** Four bars, two steps each, a key a step: 8 notes, 9 skipping nothing. */
const FACTS: PieceFacts = {
  checksum: 'abcdef01',
  bars: { right: 4, left: 4, both: 4 },
  notes: { play: 100, skip: 80 },
};

interface RunOptions {
  day: number;
  wrong?: number;
  /** ms per step, and a slower bar. */
  ms?: number;
  slowBar?: number | null;
  bars?: number;
  completed?: boolean;
  loop?: boolean;
  hands?: 'right' | 'left' | 'both';
  rhythm?: { notes: number; hits: number; inTime: number };
  pieceId?: string;
}

/** A run on day `day` after T0: its steps (two per bar) and its session. */
function run(id: string, o: RunOptions): { session: PieceSessionRecord; steps: PieceStep[] } {
  const start = T0 + o.day * DAY;
  const steps: PieceStep[] = [];
  const bars = o.bars ?? 4;
  for (let n = 0; n < bars * 2; n++) {
    const measure = Math.floor(n / 2);
    const ms = measure === o.slowBar ? 3000 : (o.ms ?? 800);
    steps.push({
      id: stepId(id, n),
      sessionId: id,
      pieceId: o.pieceId ?? 'p',
      checksum: FACTS.checksum,
      hands: o.hands ?? 'both',
      measure,
      pass: 1,
      ms,
      wrong: n === 0 ? (o.wrong ?? 0) : 0,
      at: start + n * 1000,
      ...(o.rhythm && { mode: 'rhythm' as const, notes: [{ midi: 60, deviation: 0 }] }),
    });
  }
  const session = pieceSession(
    {
      id,
      pieceId: o.pieceId ?? 'p',
      title: 'Piece',
      hands: o.hands ?? 'both',
      loop: o.loop ? { from: 0, to: 1, fromLabel: '1', toLabel: '2' } : null,
      repeats: 'play',
      tempo: 100,
      startedAt: start,
      ...(o.rhythm && { mode: 'rhythm' as const }),
    },
    steps,
    o.completed ?? true,
  );
  return { session: o.rhythm ? { ...session, rhythm: o.rhythm } : session, steps };
}

function schedule(runs: { session: PieceSessionRecord; steps: PieceStep[] }[], facts = FACTS) {
  return reviewSchedule(
    'p',
    runs.map((r) => r.session),
    runs.flatMap((r) => r.steps),
    facts,
    TZ,
  );
}

describe('a run to the end', () => {
  it('is completed, without a loop, with every note, through every bar', () => {
    const ok = run('a', { day: 0 });
    expect(isRunToTheEnd(ok.session, ok.steps, FACTS)).toBe(true);
    for (const o of [
      { completed: false },
      { loop: true },
      { hands: 'right' as const },
      { bars: 3 },
    ]) {
      const r = run('b', { day: 0, ...o });
      expect(isRunToTheEnd(r.session, r.steps, FACTS), JSON.stringify(o)).toBe(false);
    }
    // One hand plays every note when the other has none.
    const right = run('c', { day: 0, hands: 'right' });
    expect(
      isRunToTheEnd(right.session, right.steps, { bars: { right: 4, left: 0, both: 4 } }),
    ).toBe(true);
    // A run in another key is practice at transposing, not a review of the piece.
    expect(isRunToTheEnd({ ...ok.session, transpose: 2 }, ok.steps, FACTS)).toBe(false);
    const sessions = [ok.session, { ...run('t', { day: 3 }).session, transpose: -1 }];
    expect(reviewSchedule('p', sessions, null, FACTS, TZ)!.runs.map((r) => r.sessionId)).toEqual([
      'a',
    ]);
    // Without its step records, a completed whole-piece run is taken at its word.
    expect(isRunToTheEnd(ok.session, undefined, FACTS)).toBe(true);
  });
});

describe('gradeRun', () => {
  it('moves up on a clean, even run; keeps it on a few slips; down on more than one in ten', () => {
    const grade = (o: Partial<RunOptions>) => {
      const r = run('a', { day: 0, ...o });
      return gradeRun(r.session, r.steps, FACTS);
    };
    expect(grade({})).toBe('better');
    expect(grade({ wrong: 2 })).toBe('better'); // 2 in 100
    expect(grade({ wrong: 3 })).toBe('same');
    expect(grade({ wrong: 10 })).toBe('same');
    expect(grade({ wrong: 11 })).toBe('worse');
    // A bar over twice the run's median step keeps it.
    expect(grade({ slowBar: 2 })).toBe('same');
  });

  it('counts a wait run against the keys of its repeats, or its steps without them', () => {
    const r = run('a', { day: 0, wrong: 2 });
    expect(gradeRun(r.session, r.steps, { notes: { play: 100, skip: 100 } })).toBe('better');
    expect(gradeRun(r.session, r.steps, { notes: { play: 99, skip: 99 } })).toBe('same');
    // With a left hand from the symbols the piece's facts do not count the run's keys: its
    // steps stand in (8 here), as for a piece without facts.
    const made = { ...r.session, leftHand: 'alberti' as const };
    expect(gradeRun(made, r.steps, { notes: { play: 100, skip: 100 } })).toBe('worse');
    expect(gradeRun({ ...made, wrong: 0 }, r.steps, { notes: { play: 100, skip: 100 } })).toBe(
      'better',
    );
    // 8 steps: 2 wrong is more than one in ten.
    expect(gradeRun(r.session, r.steps, {})).toBe('worse');
    // Without its step records the bars cannot be checked: kept at best.
    expect(gradeRun(r.session, undefined, FACTS)).toBe('same');
  });

  it('counts a rhythm run’s missed and extra notes against the notes due, and wants 80 % in time', () => {
    const grade = (rhythm: RunOptions['rhythm'], wrong = 0) => {
      const r = run('a', { day: 0, rhythm, wrong });
      return gradeRun(r.session, r.steps, FACTS);
    };
    expect(grade({ notes: 100, hits: 100, inTime: 80 })).toBe('better');
    expect(grade({ notes: 100, hits: 100, inTime: 79 })).toBe('same');
    expect(grade({ notes: 100, hits: 99, inTime: 90 }, 1)).toBe('better');
    expect(grade({ notes: 100, hits: 98, inTime: 90 }, 1)).toBe('same');
    expect(grade({ notes: 100, hits: 90, inTime: 90 }, 1)).toBe('worse');
  });

  it('finds the slow bar by its mean time per step', () => {
    const steps = run('a', { day: 0 }).steps;
    expect(evenBars(steps)).toBe(true);
    // 800 ms steps; a bar of 800 and 2500 ms has a mean of 1650 > 1600.
    expect(evenBars(steps.map((s, n) => (n === 5 ? { ...s, ms: 2500 } : s)))).toBe(false);
    expect(evenBars(steps.map((s, n) => (n === 5 ? { ...s, ms: 2400 } : s)))).toBe(true);
  });
});

describe('reviewSchedule', () => {
  it('is nothing until the piece is played to the end', () => {
    expect(schedule([run('a', { day: 0, loop: true })])).toBeNull();
    expect(schedule([])).toBeNull();
  });

  it('puts a piece in review a day after its first run to the end, and doubles on good runs', () => {
    const first = schedule([run('a', { day: 0 })])!;
    expect(first.due).toBe('2026-09-02');
    expect(first.interval).toBe(1);
    // Across the end of a month, by the calendar.
    const turn = schedule([run('a', { day: 29 }), run('b', { day: 30 })])!;
    expect(turn.runs.map((r) => [r.day, r.counted])).toEqual([
      ['2026-09-30', true],
      ['2026-10-01', true],
    ]);
    expect(turn.due).toBe('2026-10-03');
    // Each good run on its date moves a step up; the date runs from the run's own day.
    const runs = [run('a', { day: 0 })];
    let day = 0;
    for (const interval of REVIEW_INTERVALS.slice(0, 6)) {
      day += interval;
      runs.push(run(`r${day}`, { day }));
    }
    const s = schedule(runs)!;
    expect(s.stage).toBe(6);
    expect(s.interval).toBe(60);
    expect(s.runs.every((r) => r.counted)).toBe(true);
    // 60 days is as far as it goes.
    runs.push(run('later', { day: day + 60 }));
    expect(schedule(runs)!.interval).toBe(60);
  });

  it('counts runs before the date only for the figures', () => {
    const s = schedule([
      run('a', { day: 0 }),
      run('b', { day: 1 }), // due: up to 2 days
      run('c', { day: 2 }), // before 3 September + 2: not counted
      run('d', { day: 2, wrong: 50 }),
    ])!;
    expect(s.runs.map((r) => [r.sessionId, r.counted])).toEqual([
      ['a', true],
      ['b', true],
      ['c', false],
      ['d', false],
    ]);
    expect(s.interval).toBe(2);
    expect(s.due).toBe('2026-09-04');
    expect(s.last.sessionId).toBe('b');
  });

  it('keeps the interval on a so-so run and halves it on a poor one', () => {
    const base = [run('a', { day: 0 }), run('b', { day: 1 }), run('c', { day: 3 })]; // up to 4 days
    expect(schedule(base)!.interval).toBe(4);
    expect(schedule([...base, run('d', { day: 7, wrong: 5 })])!.interval).toBe(4);
    expect(schedule([...base, run('d', { day: 7, wrong: 20 })])!.interval).toBe(2);
    // A late review counts all the same, from its own day.
    const late = schedule([...base, run('d', { day: 30 })])!;
    expect(late.interval).toBe(7);
    expect(late.due).toBe('2026-10-08');
  });

  it('leaves out other pieces and runs that are not to the end', () => {
    const s = schedule([
      run('a', { day: 0 }),
      run('x', { day: 1, pieceId: 'other' }),
      run('y', { day: 1, completed: false }),
    ])!;
    expect(s.runs.map((r) => r.sessionId)).toEqual(['a']);
  });
});

describe('reviewStatus', () => {
  it('says whether it is due, for how long, and how long since the last review', () => {
    const s = schedule([run('a', { day: 0 }), run('b', { day: 1 })])!; // due 4 September
    expect(reviewStatus(s, '2026-09-03')).toEqual({ isDue: false, since: 1, overdue: -1 });
    expect(reviewStatus(s, '2026-09-04')).toEqual({ isDue: true, since: 2, overdue: 0 });
    expect(reviewStatus(s, '2026-09-10')).toEqual({ isDue: true, since: 8, overdue: 6 });
  });

  it('orders the longest overdue first, then what comes due soonest', () => {
    const list = [
      { isDue: false, since: 1, overdue: -3 },
      { isDue: true, since: 9, overdue: 2 },
      { isDue: true, since: 30, overdue: 20 },
      { isDue: false, since: 1, overdue: -1 },
    ];
    expect([...list].sort(byReview).map((s) => s.overdue)).toEqual([20, 2, -1, -3]);
  });

  it('counts calendar days', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-30', '2026-10-25')).toBe(-5);
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
  });
});
