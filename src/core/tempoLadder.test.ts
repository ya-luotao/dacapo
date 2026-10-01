import { describe, expect, it } from 'vitest';
import type { PieceSessionRecord } from './log.ts';
import { pieceSession, stepId, type PieceFacts, type PieceStep } from './pieceRecords.ts';
import { CLEAN_NOTES, IN_TIME_SHARE } from './review.ts';
import type { HandSelection } from './score.ts';
import {
  countsForLadder,
  LADDER_START,
  LADDER_STEP,
  rungAbove,
  SCORE_TEMPO,
  tempoBelow,
  tempoLadder,
  TEMPOS,
} from './tempoLadder.ts';

const T0 = Date.UTC(2026, 8, 1, 18);
const HOUR = 3_600_000;
/** Four bars for each hand and for both. */
const FACTS: PieceFacts = {
  checksum: 'abcdef01',
  bars: { right: 4, left: 4, both: 4 },
  notes: { play: 100, skip: 80 },
};
/** Notes due in a run: enough that one more wrong note crosses the review's line for "clean". */
const NOTES = 2 * CLEAN_NOTES;
const CLEAN = { notes: NOTES, hits: NOTES - 2, inTime: IN_TIME_SHARE * NOTES };

interface RunOptions {
  tempo: number;
  /** Hours after T0: the later run is the last. */
  at?: number;
  hands?: HandSelection;
  rhythm?: { notes: number; hits: number; inTime: number } | null;
  bars?: number;
  completed?: boolean;
  loop?: boolean;
  transpose?: number;
  leftHand?: 'block';
  pieceId?: string;
}

/** A rhythm run (clean and in time unless said otherwise): its session and its steps, two a bar. */
function run(id: string, o: RunOptions): { session: PieceSessionRecord; steps: PieceStep[] } {
  const start = T0 + (o.at ?? 0) * HOUR;
  const rhythm = o.rhythm === undefined ? CLEAN : o.rhythm;
  const steps: PieceStep[] = [];
  for (let n = 0; n < (o.bars ?? 4) * 2; n++)
    steps.push({
      id: stepId(id, n),
      sessionId: id,
      pieceId: o.pieceId ?? 'p',
      checksum: FACTS.checksum,
      hands: o.hands ?? 'both',
      measure: Math.floor(n / 2),
      pass: 1,
      ms: 500,
      wrong: 0,
      at: start + n * 500,
      ...(rhythm && { mode: 'rhythm' as const, notes: [{ midi: 60, deviation: 0 }] }),
      ...(o.transpose !== undefined && { transpose: o.transpose }),
    });
  const session = pieceSession(
    {
      id,
      pieceId: o.pieceId ?? 'p',
      title: 'Piece',
      hands: o.hands ?? 'both',
      loop: o.loop ? { from: 0, to: 3, fromLabel: '1', toLabel: '4' } : null,
      repeats: 'play',
      tempo: o.tempo,
      startedAt: start,
      ...(rhythm && { mode: 'rhythm' as const }),
      ...(o.leftHand && { leftHand: o.leftHand }),
      ...(o.transpose !== undefined && { transpose: o.transpose }),
    },
    steps,
    o.completed ?? true,
  );
  return { session: rhythm ? { ...session, rhythm } : session, steps };
}

function ladder(
  runs: { session: PieceSessionRecord; steps: PieceStep[] }[],
  hands: HandSelection = 'both',
) {
  return tempoLadder(
    'p',
    hands,
    runs.map((r) => r.session),
    runs.flatMap((r) => r.steps),
    FACTS,
  );
}

describe('the tempo reached', () => {
  it('is the highest tempo of a rhythm run to the end that was clean and in time', () => {
    expect(ladder([run('a', { tempo: 70 })])).toEqual({ reached: 70, next: 80 });
    expect(
      ladder([run('a', { tempo: 60 }), run('b', { tempo: 80 }), run('c', { tempo: 70 })]),
    ).toEqual({ reached: 80, next: 90 });
  });

  it('wants the run clean: at most one wrong or missed note in CLEAN_NOTES', () => {
    const over = { ...CLEAN, hits: CLEAN.hits - 1 };
    expect(ladder([run('a', { tempo: 60 }), run('b', { tempo: 80, rhythm: over })]).reached).toBe(
      60,
    );
    expect(ladder([run('a', { tempo: 60 }), run('b', { tempo: 80, rhythm: CLEAN })]).reached).toBe(
      80,
    );
  });

  it('wants the run in time: IN_TIME_SHARE of its notes', () => {
    const under = { ...CLEAN, inTime: CLEAN.inTime - 1 };
    expect(ladder([run('a', { tempo: 60 }), run('b', { tempo: 80, rhythm: under })]).reached).toBe(
      60,
    );
  });

  it('counts a run with one hand for that hand', () => {
    const runs = [run('a', { tempo: 90, hands: 'right' }), run('b', { tempo: 70, hands: 'left' })];
    expect(ladder(runs, 'right')).toEqual({ reached: 90, next: 100 });
    expect(ladder(runs, 'left')).toEqual({ reached: 70, next: 80 });
    expect(ladder(runs, 'both')).toEqual({ reached: null, next: LADDER_START });
  });

  it('counts nothing but a rhythm run of the whole piece as written, played to the end', () => {
    const clean = run('a', { tempo: 60 });
    const not = [
      run('loop', { tempo: 90, loop: true }),
      run('key', { tempo: 90, transpose: 2 }),
      run('left', { tempo: 90, leftHand: 'block' }),
      run('hands', { tempo: 90, hands: 'right' }),
      run('wait', { tempo: 90, rhythm: null }),
      run('stopped', { tempo: 90, completed: false }),
      run('part', { tempo: 90, bars: 3 }),
      run('other', { tempo: 90, pieceId: 'q' }),
    ];
    expect(ladder([clean, ...not]).reached).toBe(60);
    for (const r of not) expect(ladder([r]).reached, r.session.id).toBeNull();
  });

  it('counts a run whose step records are not here by its session', () => {
    const { session } = run('a', { tempo: 80, bars: 3 });
    expect(tempoLadder('p', 'both', [session], null, FACTS).reached).toBe(80);
  });
});

describe('the next rung', () => {
  it('is ten more, up to the score’s tempo and no further', () => {
    expect(ladder([run('a', { tempo: 90 })])).toEqual({ reached: 90, next: SCORE_TEMPO });
    expect(ladder([run('a', { tempo: SCORE_TEMPO })])).toEqual({
      reached: SCORE_TEMPO,
      next: null,
    });
    expect(ladder([run('a', { tempo: 120 })])).toEqual({ reached: 120, next: null });
  });

  it('starts at LADDER_START before any run', () => {
    expect(ladder([])).toEqual({ reached: null, next: LADDER_START });
    expect(ladder([run('wait', { tempo: 100, rhythm: null })]).next).toBe(LADDER_START);
  });

  it('starts ten under the last rhythm run when that is lower', () => {
    const poor = { notes: NOTES, hits: NOTES / 2, inTime: 0 };
    expect(ladder([run('a', { tempo: 60, rhythm: poor })]).next).toBe(60 - LADDER_STEP);
    expect(ladder([run('a', { tempo: 50, rhythm: poor })]).next).toBe(TEMPOS[0]);
    // Not under the slowest tempo there is.
    expect(ladder([run('a', { tempo: TEMPOS[0], rhythm: poor })]).next).toBe(TEMPOS[0]);
    // Higher up, the start stays where it is.
    expect(ladder([run('a', { tempo: 100, rhythm: poor })]).next).toBe(LADDER_START);
    // The last run, not the slowest: and a stopped one tells as much.
    expect(
      ladder([
        run('a', { tempo: 50, rhythm: poor, at: 0 }),
        run('b', { tempo: 90, rhythm: poor, at: 1, completed: false }),
      ]).next,
    ).toBe(LADDER_START);
    expect(
      ladder([
        run('a', { tempo: 90, rhythm: poor, at: 0 }),
        run('b', { tempo: 60, rhythm: poor, at: 1, completed: false }),
      ]).next,
    ).toBe(50);
  });

  it('takes the last run of the piece as written with those hands only', () => {
    const poor = { notes: NOTES, hits: NOTES / 2, inTime: 0 };
    const others = [
      run('loop', { tempo: 40, rhythm: poor, loop: true, at: 1 }),
      run('key', { tempo: 40, rhythm: poor, transpose: -1, at: 2 }),
      run('left', { tempo: 40, rhythm: poor, leftHand: 'block', at: 3 }),
      run('hands', { tempo: 40, rhythm: poor, hands: 'left', at: 4 }),
    ];
    expect(ladder(others).next).toBe(LADDER_START);
    expect(ladder([run('a', { tempo: 60, rhythm: poor }), ...others]).next).toBe(50);
  });
});

describe('countsForLadder', () => {
  const session = run('a', { tempo: 60, hands: 'right' }).session;
  const bars = (n: number) => Array.from({ length: n }, (_, measure) => ({ measure }));

  it('is the review’s run to the end, for whichever hands it was played with', () => {
    expect(countsForLadder(session, bars(4), FACTS)).toBe(true);
    expect(countsForLadder(session, bars(3), FACTS)).toBe(false);
    expect(countsForLadder({ ...session, completed: false }, bars(4), FACTS)).toBe(false);
  });

  it('leaves out a loop, another key and a left hand made from the chord symbols', () => {
    const loop = { from: 0, to: 3, fromLabel: '1', toLabel: '4' };
    expect(countsForLadder({ ...session, loop }, bars(4), FACTS)).toBe(false);
    expect(countsForLadder({ ...session, transpose: 3 }, bars(4), FACTS)).toBe(false);
    expect(countsForLadder({ ...session, leftHand: 'block' }, bars(4), FACTS)).toBe(false);
  });
});

describe('the tempo choices', () => {
  it('step up to the score’s tempo', () => {
    expect(rungAbove(60)).toBe(70);
    expect(rungAbove(90)).toBe(SCORE_TEMPO);
    expect(rungAbove(SCORE_TEMPO)).toBeNull();
    expect(rungAbove(150)).toBeNull();
    // A tempo between two choices goes to the next one.
    expect(rungAbove(65)).toBe(70);
  });

  it('step down, not under the slowest', () => {
    expect(tempoBelow(90, 10)).toBe(80);
    expect(tempoBelow(90, 20)).toBe(70);
    expect(tempoBelow(50, 20)).toBe(TEMPOS[0]);
    expect(tempoBelow(TEMPOS[0], 10)).toBeNull();
  });
});
