import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../pieces/library/index.ts';
import type { PieceSessionRecord } from './log.ts';
import { stepId, type PieceStep } from './pieceRecords.ts';
import {
  IN_HAND_DAYS,
  piecesStanding,
  runsToTheEnd,
  type StandingPiece,
  type StandingRecords,
} from './piecesStanding.ts';

const TZ = 'UTC';
const DAY = 86_400_000;
/** Friday 2 October 2026. */
const TODAY = '2026-10-02';
const at = (days: number, hour = 17) => Date.UTC(2026, 9, 2, hour) + days * DAY;

const LIBRARY: StandingPiece[] = BUILT_IN.map((p) => ({
  id: p.id,
  grade: p.level,
  leadSheet: p.leadSheet === true,
  facts: p.facts,
  out: false,
}));
const FIRST = 'turk-aller-anfang';
const ODE = 'beethoven-ode-to-joy';
const ELISE = 'beethoven-fur-elise';

/** A run of a piece `day` days from today: to its end (`whole`) or not. */
function played(
  id: string,
  pieceId: string,
  day: number,
  o: { whole?: boolean; hands?: 'right' | 'left' | 'both' } = {},
): PieceSessionRecord {
  const startedAt = at(day);
  return {
    kind: 'piece',
    id,
    pieceId,
    title: pieceId,
    hands: o.hands ?? 'both',
    loop: null,
    repeats: 'play',
    tempo: 100,
    startedAt,
    endedAt: startedAt + 120_000,
    activeMs: 120_000,
    steps: 40,
    wrong: 0,
    completed: o.whole ?? false,
  };
}

const standing = (sessions: PieceSessionRecord[], patch: Partial<StandingRecords> = {}) =>
  piecesStanding({ sessions, pieces: LIBRARY, ...patch }, { today: TODAY, timeZone: TZ });

describe('where the pieces stand', () => {
  it('proposes the first Initial piece to someone who has played none, open or not', () => {
    // No lesson is asked for here: "open" is Today's and Where you are's, and no page reads it.
    expect(standing([])).toEqual({
      finished: new Set(),
      inReview: 0,
      due: [],
      grades: expect.any(Array) as unknown,
      inHand: null,
      next: FIRST,
    });
  });

  it('has the piece in hand in place of a next piece', () => {
    const state = standing([played('a', FIRST, -2)]);
    expect(state.inHand).toEqual({ id: FIRST, day: '2026-09-30' });
    expect(state.next).toBeNull();
    // Left for longer than the piece in hand is looked for: the next piece without a session.
    const left = standing([played('a', FIRST, -IN_HAND_DAYS)]);
    expect(left.inHand).toBeNull();
    expect(left.next).toBe(ODE);
  });

  it('knows the pieces played to their end, and goes on from the grade reached', () => {
    const state = standing([played('a', ELISE, -3, { whole: true }), played('b', ODE, -40)]);
    expect([...state.finished]).toEqual([ELISE]);
    expect(state.inHand).toBeNull();
    // Für Elise is grade 3: no Initial piece is proposed.
    expect(state.next).toBe('burgmuller-arabesque');
    expect(state.grades.find((g) => g.grade === 3)).toMatchObject({ played: 1 });
    expect(state.inReview).toBe(1);
  });

  it('tells a run to the end by the step records when they are here', () => {
    const run = played('a', ODE, -1, { whole: true });
    const steps: PieceStep[] = [0, 1, 2].map((measure, n) => ({
      id: stepId('a', n),
      sessionId: 'a',
      pieceId: ODE,
      checksum: '7a47ee21',
      hands: 'both',
      measure,
      pass: 1,
      ms: 800,
      wrong: 0,
      at: run.startedAt + n * 1000,
    }));
    const ode = LIBRARY.find((p) => p.id === ODE)!;
    expect(runsToTheEnd(ode, [run], undefined)).toEqual([run]);
    expect(runsToTheEnd(ode, [run], steps)).toEqual([]);
    // Three bars of sixteen: still in hand.
    const state = standing([run], { steps: new Map([[ODE, steps]]) });
    expect(state.finished.size).toBe(0);
    expect(state.inHand).toEqual({ id: ODE, day: '2026-10-01' });
  });
});
