// The tempo ladder of a piece (docs/ADVICE.md, "The tempo ladder"): rhythm mode is played at a
// percent of the score's tempo, and a piece is brought up to tempo a rung at a time. For a piece
// and hands, the tempo reached is the highest at which a run to the end was clean and in time; the
// next rung is ten more, up to the score's own tempo. Worked out from the stored sessions and
// step records, as the review schedule is: nothing of it is stored.

import type { PieceSessionRecord } from './log.ts';
import type { PieceFacts, PieceStep } from './pieceRecords.ts';
import { gradeRun, isWholeRun } from './review.ts';
import type { HandSelection } from './score.ts';

/** Tempo choices, in percent of the score's tempo marks. */
export const TEMPOS = [
  40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200,
] as const;
/** The score's own tempo: the top of the ladder. Beyond it is the player's own choice. */
export const SCORE_TEMPO = 100;
/** Where the ladder starts (lesson 14's ladder: 60, 70, 80, 90 per cent, then the tempo aimed for). */
export const LADDER_START = 60;
/** From one rung to the next. */
export const LADDER_STEP = 10;

export interface TempoLadder {
  /** The highest tempo of a rhythm run to the end that was clean and in time; null before one. */
  reached: number | null;
  /** The tempo to take next; null once the score's tempo is reached. */
  next: number | null;
}

type LadderRun = Pick<PieceSessionRecord, 'loop' | 'transpose' | 'leftHand'>;

/**
 * A run of the piece as written: without a loop, in the written key, the left hand as written. A
 * loop, another key (H4) or a left hand made from the chord symbols (H3) counts for nothing here.
 */
const asWritten = (session: LadderRun): boolean =>
  session.loop === null && session.transpose === undefined && session.leftHand === undefined;

/**
 * A run to the end for the ladder of its hands: the review's rule (`isWholeRun`: completed,
 * through every bar its hands play), for whichever hands it was played with, of the piece as
 * written.
 */
export function countsForLadder(
  session: LadderRun & Pick<PieceSessionRecord, 'completed' | 'hands'>,
  steps: readonly Pick<PieceStep, 'measure'>[] | undefined,
  facts: Pick<PieceFacts, 'bars'>,
): boolean {
  return asWritten(session) && isWholeRun(session, steps, facts);
}

/** The first tempo choice above `tempo`, no further than the score's tempo; null there. */
export function rungAbove(tempo: number): number | null {
  if (tempo >= SCORE_TEMPO) return null;
  return TEMPOS.find((t) => t > tempo) ?? null;
}

/**
 * The tempo choice `by` under `tempo`, not under the slowest; null when that is no slower than
 * `tempo` (there is nothing slower to take).
 */
export function tempoBelow(tempo: number, by: number): number | null {
  const lower = TEMPOS.findLast((t) => t <= tempo - by) ?? TEMPOS[0];
  return lower < tempo ? lower : null;
}

/**
 * The ladder of a piece for `hands`, from its sessions and step records (any order; other pieces'
 * and other hands' are left out). Without a clean run in time it starts at `LADDER_START`, or ten
 * under the last rhythm run of the piece as written with those hands (ended or stopped) when that
 * is lower.
 */
export function tempoLadder(
  pieceId: string,
  hands: HandSelection,
  sessions: readonly PieceSessionRecord[],
  steps: readonly PieceStep[] | null,
  facts: Pick<PieceFacts, 'bars' | 'notes'>,
): TempoLadder {
  const runs = sessions.filter(
    (s) =>
      s.kind === 'piece' &&
      s.pieceId === pieceId &&
      s.mode === 'rhythm' &&
      s.hands === hands &&
      asWritten(s),
  );
  if (runs.length === 0) return { reached: null, next: LADDER_START };

  const bySession = new Map<string, PieceStep[]>();
  for (const s of steps ?? []) {
    if (s.pieceId !== pieceId) continue;
    const list = bySession.get(s.sessionId);
    if (list) list.push(s);
    else bySession.set(s.sessionId, [s]);
  }
  let reached: number | null = null;
  for (const run of runs) {
    const own = bySession.get(run.id);
    if (!isWholeRun(run, own, facts) || gradeRun(run, own, facts) !== 'better') continue;
    reached = Math.max(reached ?? 0, run.tempo);
  }
  if (reached !== null) return { reached, next: rungAbove(reached) };

  const last = runs.reduce((a, b) =>
    b.endedAt > a.endedAt || (b.endedAt === a.endedAt && b.id > a.id) ? b : a,
  );
  const under = tempoBelow(last.tempo, LADDER_STEP) ?? TEMPOS[0];
  return { reached: null, next: Math.min(LADDER_START, under) };
}
