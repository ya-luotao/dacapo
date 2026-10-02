// Where the pieces stand (docs/TODAY.md, "The curriculum" and "Today's plan"; docs/PIECES.md,
// "Next for you"): which were played to their end, which are in review and due, the piece in
// hand and the piece to begin next. Today's plan and "Where you are" read it through today.ts,
// and the Pieces page reads it here, apart from the rules of every other practice. Pure.

import { nextPiece, type CurriculumPiece } from './curriculum.ts';
import type { PieceSessionRecord, SessionRecord } from './log.ts';
import type { PieceFacts, PieceStep } from './pieceRecords.ts';
import { byReview, isRunToTheEnd, reviewSchedule, reviewStatus } from './review.ts';
import { addDays, dayKey, type DayKey } from './streak.ts';

/** A piece on this device, with what its standing is told by. */
export interface StandingPiece extends CurriculumPiece {
  /**
   * Its bar and note counts: a run to the end and the review schedule are told by them. Null for
   * an imported piece whose facts are not kept yet (they are when it is next listed).
   */
  facts: Pick<PieceFacts, 'bars' | 'notes'> | null;
  /** Taken out of review. */
  out: boolean;
}

/** The records the pieces' standing is worked out from. */
export interface StandingRecords {
  sessions: readonly SessionRecord[];
  /**
   * Step records by piece id, for the pieces whose records are loaded: a run to the end is told
   * by them (every bar played); without them, by its session alone.
   */
  steps?: ReadonlyMap<string, readonly PieceStep[]>;
  /** Every piece here: the built-in ones in the library's order, then the imported ones. */
  pieces: readonly StandingPiece[];
}

/**
 * The piece in hand is looked for among those practised in the last this many calendar days:
 * the Scales page's fourteen (`SUGGEST_DAYS`; a test holds the two together).
 */
export const IN_HAND_DAYS = 14;

export interface PiecesStanding {
  /** The pieces played to their end at least once. */
  finished: ReadonlySet<string>;
  /** Pieces in review (those taken out are not), and the ones due, the longest overdue first. */
  inReview: number;
  due: { id: string; overdue: number }[];
  /** Per grade, the built-in pieces played to their end of those the grade has. */
  grades: { grade: number; played: number; of: number }[];
  /**
   * The piece in hand: the one practised most recently in the last `IN_HAND_DAYS` days that was
   * never played to its end, with the day it was last practised.
   */
  inHand: { id: string; day: DayKey } | null;
  /** The piece to begin when none is in hand; null when there is none to propose. */
  next: string | null;
}

/** A whole run when the piece's facts are not here to tell: completed, no loop, as written. */
const wholeRun = (s: PieceSessionRecord): boolean =>
  s.completed && s.loop === null && s.transpose === undefined && s.hands === 'both';

/** The runs to the end among `sessions` of one piece, told by its facts and step records. */
export function runsToTheEnd(
  piece: StandingPiece,
  sessions: readonly PieceSessionRecord[],
  steps: readonly PieceStep[] | undefined,
): PieceSessionRecord[] {
  const { facts } = piece;
  if (!facts) return sessions.filter(wholeRun);
  const bySession = new Map<string, PieceStep[]>();
  for (const step of steps ?? []) {
    const list = bySession.get(step.sessionId);
    if (list) list.push(step);
    else bySession.set(step.sessionId, [step]);
  }
  return sessions.filter((s) => isRunToTheEnd(s, bySession.get(s.id), facts));
}

export function sessionsByPiece(
  sessions: readonly SessionRecord[],
): Map<string, PieceSessionRecord[]> {
  const byPiece = new Map<string, PieceSessionRecord[]>();
  for (const session of sessions) {
    if (session.kind !== 'piece') continue;
    const list = byPiece.get(session.pieceId);
    if (list) list.push(session);
    else byPiece.set(session.pieceId, [session]);
  }
  return byPiece;
}

/**
 * Where the pieces stand on `today`, from the records given, whether or not Pieces is open
 * (docs/TODAY.md: "open" only decides what Today and Where you are propose).
 */
export function piecesStanding(
  records: StandingRecords,
  { today, timeZone }: { today: DayKey; timeZone?: string },
): PiecesStanding {
  const byPiece = sessionsByPiece(records.sessions);
  const finished = new Set<string>();
  const reviews: { id: string; isDue: boolean; since: number; overdue: number }[] = [];
  const grades = new Map<number, { grade: number; played: number; of: number }>();
  const lately = addDays(today, -(IN_HAND_DAYS - 1));
  let inHand: { id: string; at: number; day: DayKey } | null = null;

  for (const piece of records.pieces) {
    const sessions = byPiece.get(piece.id) ?? [];
    const steps = records.steps?.get(piece.id);
    if (runsToTheEnd(piece, sessions, steps).length > 0) finished.add(piece.id);
    if (piece.grade !== null) {
      let entry = grades.get(piece.grade);
      if (!entry) grades.set(piece.grade, (entry = { grade: piece.grade, played: 0, of: 0 }));
      entry.of++;
      if (finished.has(piece.id)) entry.played++;
    }
    if (piece.facts && !piece.out) {
      const schedule = reviewSchedule(piece.id, sessions, steps ?? null, piece.facts, timeZone);
      if (schedule) reviews.push({ id: piece.id, ...reviewStatus(schedule, today) });
    }
    if (finished.has(piece.id) || sessions.length === 0) continue;
    // Practised lately and never played to its end: the latest such piece is the one in hand.
    const at = Math.max(...sessions.map((s) => s.startedAt));
    const day = dayKey(at, timeZone);
    if (day >= lately && (inHand === null || at > inHand.at)) inHand = { id: piece.id, at, day };
  }

  return {
    finished,
    inReview: reviews.length,
    due: reviews
      .filter((r) => r.isDue)
      .sort(byReview)
      .map(({ id, overdue }) => ({ id, overdue })),
    grades: [...grades.values()].sort((a, b) => a.grade - b.grade),
    inHand: inHand && { id: inHand.id, day: inHand.day },
    next: inHand === null ? nextPiece(records.pieces, new Set(byPiece.keys()), finished) : null,
  };
}
