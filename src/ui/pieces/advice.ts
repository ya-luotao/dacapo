import { reviewLine, type ReviewLine } from '../../core/advice.ts';
import type { PieceSessionRecord } from '../../core/log.ts';
import type { PieceFacts, PieceStep } from '../../core/pieceRecords.ts';
import { playsEveryNote, reviewSchedule } from '../../core/review.ts';
import type { Hand, Step } from '../../core/score.ts';
import { countsForLadder, tempoLadder, type TempoLadder } from '../../core/tempoLadder.ts';
import type { RecordedRun } from './record.ts';

// What the summary of a run reads beside its own figures (docs/ADVICE.md): the run among the
// piece's other runs. Worked out from the run as its records will have it (`recordedRun`) and
// the records already stored, so the summary says it at once and nothing new is kept.

/** Where a run just played leaves the piece. */
export interface AfterRun {
  /** A run to the end that counts for the ladder of its hands. */
  whole: boolean;
  /** The ladder of its hands, with it counted. */
  ladder: TempoLadder;
  /** What it did to the piece's review; null when nothing. */
  review: ReviewLine | null;
  /** The notes the review counts its wrong ones against. */
  notes: number;
}

/**
 * The piece after `run`: `stored` are the piece's sessions and step records as the store has them
 * (with or without the run's own, which are left out and taken from `run`); `facts` the piece's
 * as written; `out` whether it was taken out of review.
 */
export function afterRun(
  run: RecordedRun,
  stored: { sessions: readonly PieceSessionRecord[]; steps: readonly PieceStep[] | null },
  facts: PieceFacts,
  out: boolean,
): AfterRun {
  const { session } = run;
  const { pieceId } = session;
  const sessions = stored.sessions.filter((s) => s.id !== session.id);
  const steps = stored.steps?.filter((s) => s.sessionId !== session.id) ?? null;
  const sessionsWith = [...sessions, session];
  const stepsWith = [...(steps ?? []), ...run.steps];
  // One hand of two is counted against its own steps, as the review counts a run whose notes it
  // does not know: the piece's facts count both hands' keys.
  const written = playsEveryNote(session.hands, facts) && session.leftHand === undefined;
  return {
    whole: countsForLadder(session, run.steps, facts),
    ladder: tempoLadder(pieceId, session.hands, sessionsWith, stepsWith, facts),
    // The other runs' grades need their steps: until those are read the line waits.
    review:
      steps === null
        ? null
        : reviewLine(
            reviewSchedule(pieceId, sessions, steps, facts),
            reviewSchedule(pieceId, sessionsWith, stepsWith, facts),
            out,
          ),
    notes: (written ? facts.notes?.[session.repeats] : undefined) ?? session.steps,
  };
}

/**
 * The hand that plays a step when only one does: a wrong note there is that hand's. Null where
 * both hands have a note (or a note has no hand): the step does not tell.
 */
export function stepHand(
  step: Pick<Step, 'noteIds'> | undefined,
  handOf: (noteId: string) => Hand | null | undefined,
): Hand | null {
  const hands = new Set(step?.noteIds.map(handOf));
  const [only] = hands;
  return hands.size === 1 && only ? only : null;
}
