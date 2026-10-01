import { useEffect, useMemo, useReducer } from 'react';
import type { PieceStep } from '../../core/pieceRecords.ts';
import type { TodayPiece, TodayRecords } from '../../core/today.ts';
import { BUILT_IN } from '../../pieces/library/index.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';

/**
 * The records today's plan and "Where you are" are worked out from (docs/TODAY.md): everything
 * practised, and every piece here with its facts and whether it was taken out of review. Null
 * while they are being read. Step records are read only for the pieces with a completed run
 * without a loop (a run to the end is told by them), as the review schedule reads them, and stay
 * in the store's cache.
 */
export function useTodayRecords(): TodayRecords | null {
  const store = usePracticeStore();
  const { loaded } = useStorageStatus();
  const { sessions, attempts, answers, pieces: stored, reviewOff } = usePractice();
  // The step cache tells when a piece's records are in.
  const [stepsVersion, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => store.subscribePieceSteps(bump), [store]);

  const pieces = useMemo(
    (): TodayPiece[] => [
      ...BUILT_IN.map((piece) => ({
        id: piece.id,
        grade: piece.level,
        leadSheet: piece.leadSheet === true,
        facts: piece.facts,
        out: reviewOff.includes(piece.id),
      })),
      // Facts are filled in when the piece is next listed; until then its runs are told by
      // their sessions alone.
      ...stored.map((piece) => ({
        id: piece.id,
        grade: null,
        leadSheet: false,
        facts: piece.facts ?? null,
        out: piece.review === false,
      })),
    ],
    [stored, reviewOff],
  );

  const withRuns = useMemo(() => {
    const here = new Set(pieces.map((piece) => piece.id));
    const ids = new Set<string>();
    for (const s of sessions) {
      if (s.kind === 'piece' && s.completed && s.loop === null && here.has(s.pieceId))
        ids.add(s.pieceId);
    }
    return [...ids].sort();
  }, [sessions, pieces]);
  useEffect(() => {
    for (const id of withRuns) store.loadPieceSteps(id);
  }, [withRuns, store]);

  return useMemo(() => {
    void stepsVersion;
    if (!loaded) return null;
    const steps = new Map<string, readonly PieceStep[]>();
    for (const id of withRuns) {
      const loadedSteps = store.getPieceSteps(id);
      if (loadedSteps === null) return null;
      steps.set(id, loadedSteps);
    }
    return { sessions, attempts, answers, steps, pieces };
  }, [loaded, sessions, attempts, answers, pieces, withRuns, store, stepsVersion]);
}
