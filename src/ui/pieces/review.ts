import { useEffect, useMemo, useReducer } from 'react';
import type { PieceSessionRecord } from '../../core/log.ts';
import type { PieceFacts } from '../../core/pieceRecords.ts';
import {
  byReview,
  reviewSchedule,
  reviewStatus,
  type ReviewSchedule,
  type ReviewStatus,
} from '../../core/review.ts';
import { dayKey } from '../../core/streak.ts';
import { useT } from '../../i18n/index.ts';
import { BUILT_IN } from '../../pieces/library/index.ts';
import { usePieceSteps, usePractice, usePracticeStore } from '../practice/context.ts';
import { useNow } from '../progress/useNow.ts';

// The review schedule of every piece (docs/PIECES.md, "Review schedule"), for the Pieces page
// and the home page. Step records are read only for the pieces that have a run to the end to
// judge, and once read they stay in the store's cache.

/** A piece in review: its schedule, where it stands today, and whether it was taken out. */
export interface PieceReview {
  pieceId: string;
  title: string;
  composer: string;
  schedule: ReviewSchedule;
  status: ReviewStatus;
  /** Taken out of review: listed nowhere as due. */
  out: boolean;
}

interface Candidate {
  pieceId: string;
  title: string;
  composer: string;
  facts: PieceFacts;
  out: boolean;
}

/** Every piece once played to the end, due first (the longest overdue at the top). */
export function usePieceReviews(): { reviews: PieceReview[]; loading: boolean } {
  const t = useT();
  const store = usePracticeStore();
  const { sessions, pieces, reviewOff } = usePractice();
  const now = useNow();
  const today = dayKey(now);
  // The step cache tells when a piece's records are in.
  const [stepsVersion, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => store.subscribePieceSteps(bump), [store]);

  const candidates = useMemo(() => {
    // A piece can be in review only once a run of it was completed without a loop.
    const played = new Set(
      sessions
        .filter((s): s is PieceSessionRecord => s.kind === 'piece')
        .filter((s) => s.completed && s.loop === null)
        .map((s) => s.pieceId),
    );
    const list: Candidate[] = [];
    for (const piece of BUILT_IN) {
      if (!played.has(piece.id)) continue;
      list.push({
        pieceId: piece.id,
        title: t(`library.${piece.id}.title`),
        composer: t(`library.${piece.id}.composer`),
        facts: piece.facts,
        out: reviewOff.includes(piece.id),
      });
    }
    for (const piece of pieces) {
      // Facts are filled in when the piece is next listed; until then it waits.
      if (!played.has(piece.id) || !piece.facts) continue;
      list.push({
        pieceId: piece.id,
        title: piece.title || t('pieces.untitled'),
        composer: piece.composer,
        facts: piece.facts,
        out: piece.review === false,
      });
    }
    return list;
  }, [sessions, pieces, reviewOff, t]);

  useEffect(() => {
    for (const c of candidates) store.loadPieceSteps(c.pieceId);
  }, [candidates, store]);

  return useMemo(() => {
    void stepsVersion;
    const pieceSessions = sessions.filter((s): s is PieceSessionRecord => s.kind === 'piece');
    let loading = false;
    const reviews: PieceReview[] = [];
    for (const c of candidates) {
      const steps = store.getPieceSteps(c.pieceId);
      if (steps === null) {
        loading = true;
        continue;
      }
      const schedule = reviewSchedule(c.pieceId, pieceSessions, steps, c.facts);
      if (!schedule) continue;
      reviews.push({ ...c, schedule, status: reviewStatus(schedule, today) });
    }
    reviews.sort((a, b) => byReview(a.status, b.status) || a.title.localeCompare(b.title));
    return { reviews, loading };
  }, [candidates, sessions, store, today, stepsVersion]);
}

/** One piece's schedule and where it stands today; null when it is not in review (or loading). */
export function usePieceReview(
  pieceId: string,
  facts: PieceFacts | undefined,
): { schedule: ReviewSchedule; status: ReviewStatus; out: boolean } | null {
  const { sessions } = usePractice();
  const steps = usePieceSteps(pieceId);
  const today = dayKey(useNow());
  const out = useReviewOut(pieceId);
  return useMemo(() => {
    if (!facts || steps === null) return null;
    const pieceSessions = sessions.filter((s): s is PieceSessionRecord => s.kind === 'piece');
    const schedule = reviewSchedule(pieceId, pieceSessions, steps, facts);
    return schedule ? { schedule, status: reviewStatus(schedule, today), out } : null;
  }, [pieceId, facts, steps, sessions, today, out]);
}

/** Whether the piece was taken out of review: on the piece if imported, else on this device. */
export function useReviewOut(pieceId: string): boolean {
  const { pieces, reviewOff } = usePractice();
  const stored = pieces.find((p) => p.id === pieceId);
  return stored ? stored.review === false : reviewOff.includes(pieceId);
}

/** "Played through 9 days ago": how long since the run that set the date. */
export function useSinceLabel(): (review: Pick<PieceReview, 'status'>) => string {
  const t = useT();
  return ({ status }) =>
    status.since <= 0
      ? t('pieces.review.since.today')
      : status.since === 1
        ? t('pieces.review.since.one')
        : t('pieces.review.since.other', { n: status.since });
}
