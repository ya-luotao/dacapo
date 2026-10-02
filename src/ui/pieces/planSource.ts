import { useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
import type { PieceSessionRecord } from '../../core/log.ts';
import { nextStep, planSource, type PlanSource, type StageStart } from '../../core/piecePlan.ts';
import type { PieceStep } from '../../core/pieceRecords.ts';
import type { StaffHands } from '../../core/score.ts';
import { isBuiltInId, loadBuiltIn, type BuiltInId } from '../../pieces/library/index.ts';
import { readScore } from '../../pieces/load.ts';
import { usePractice, usePracticeStore } from '../practice/context.ts';

// What a piece's plan is made of when the piece is not open (docs/PIECES.md, "A piece's plan"):
// its phrases, read from its score, and its step records. For "Next for you" and today's plan,
// which name the next step of the piece in hand; the piece's own page has its score at hand.

/** A score's phrases and facts; null when it cannot be read. */
function sourceOf(xml: string, hands: StaffHands | null): PlanSource | null {
  try {
    return planSource(readScore(xml, hands));
  } catch {
    return null;
  }
}

/** The built-in pieces read so far: a file does not change while the page is open. */
const BUILT_IN_SOURCES = new Map<BuiltInId, PlanSource | null>();

/**
 * What the plan of piece `pieceId` is made of. Undefined while its score is being read; null
 * when there is none to read (no piece, a piece no longer here, a score that cannot be read).
 */
export function usePlanSource(pieceId: string | null): PlanSource | null | undefined {
  const { pieces } = usePractice();
  const builtIn = pieceId !== null && isBuiltInId(pieceId) ? pieceId : null;
  const [, read] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (builtIn === null || BUILT_IN_SOURCES.has(builtIn)) return;
    let cancelled = false;
    void loadBuiltIn(builtIn)
      .then(
        (xml) => sourceOf(xml, null),
        () => null,
      )
      .then((source) => {
        BUILT_IN_SOURCES.set(builtIn, source);
        if (!cancelled) read();
      });
    return () => {
      cancelled = true;
    };
  }, [builtIn]);

  const stored = builtIn === null ? pieces.find((piece) => piece.id === pieceId) : undefined;
  const xml = stored?.xml ?? null;
  const hands = stored?.hands ?? null;
  const own = useMemo(() => (xml === null ? null : sourceOf(xml, hands)), [xml, hands]);
  if (builtIn !== null) return BUILT_IN_SOURCES.get(builtIn);
  return own;
}

/** A piece's step records, read on first use; null while they are read, and for no piece. */
export function useStepsOf(pieceId: string | null): readonly PieceStep[] | null {
  const store = usePracticeStore();
  const steps = useSyncExternalStore(store.subscribePieceSteps, () =>
    pieceId === null ? null : store.getPieceSteps(pieceId),
  );
  useEffect(() => {
    if (pieceId !== null && steps === null) store.loadPieceSteps(pieceId);
  }, [store, pieceId, steps]);
  return steps;
}

/**
 * The next step of the plan of piece `pieceId`, from its score and its records as they are now.
 * Undefined while they are being read; null when the piece has no plan to read, or no step left.
 */
export function useNextStep(pieceId: string): StageStart | null | undefined {
  const { sessions } = usePractice();
  const source = usePlanSource(pieceId);
  const steps = useStepsOf(pieceId);
  return useMemo(() => {
    if (source === undefined || steps === null) return undefined;
    if (source === null) return null;
    const runs = sessions.filter((s): s is PieceSessionRecord => s.kind === 'piece');
    return nextStep({ pieceId, ...source, sessions: runs, steps });
  }, [pieceId, source, steps, sessions]);
}
