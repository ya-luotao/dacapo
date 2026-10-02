import { useMemo } from 'react';
import type { PieceSessionRecord } from '../../core/log.ts';
import type { PieceFacts } from '../../core/pieceRecords.ts';
import { tempoLadder } from '../../core/tempoLadder.ts';
import { useT } from '../../i18n/index.ts';
import { usePieceSteps, usePractice } from '../practice/context.ts';
import { usePieceFormat } from './format.ts';
import { readPiecePrefs } from './prefs.ts';
import { usePieceReview } from './review.ts';
import { useSteadyBars } from './steady.ts';

/**
 * A quiet line on a library card: when the piece was last practised, how many runs, how many of
 * its bars are steady for the hands last chosen and the tempo reached with them, and where it
 * stands in review. Nothing before the first run.
 */
export function PieceProgress({ pieceId, facts }: { pieceId: string; facts?: PieceFacts }) {
  const t = useT();
  const format = usePieceFormat();
  const { sessions } = usePractice();
  const runs = useMemo(
    () =>
      sessions.filter((s): s is PieceSessionRecord => s.kind === 'piece' && s.pieceId === pieceId),
    [sessions, pieceId],
  );
  if (runs.length === 0) return null;
  const last = Math.max(...runs.map((s) => s.endedAt));
  return (
    <span className="library-piece-progress">
      {t('pieces.progress.last', { date: format.date(last) })}
      {' · '}
      {runs.length === 1
        ? t('pieces.progress.runs.one')
        : t('pieces.progress.runs.other', { n: runs.length })}
      {facts && <Steady pieceId={pieceId} facts={facts} />}
      {facts && <Ladder pieceId={pieceId} facts={facts} runs={runs} />}
      {facts && <Review pieceId={pieceId} facts={facts} />}
    </span>
  );
}

/** Where the piece stands in the review schedule: due, next in n days, or taken out. */
function Review({ pieceId, facts }: { pieceId: string; facts: PieceFacts }) {
  const t = useT();
  const review = usePieceReview(pieceId, facts);
  if (!review) return null;
  const { status, out } = review;
  return (
    <>
      {' · '}
      {out
        ? t('pieces.review.out')
        : status.isDue
          ? t('pieces.review.due')
          : status.overdue === -1
            ? t('pieces.review.next.one')
            : t('pieces.review.next.other', { n: -status.overdue })}
    </>
  );
}

/**
 * The tempo reached in rhythm mode with the hands last chosen (docs/ADVICE.md, "The tempo
 * ladder"): after the steady bars, which name the hands. Nothing before a clean run in time.
 */
function Ladder({
  pieceId,
  facts,
  runs,
}: {
  pieceId: string;
  facts: PieceFacts;
  runs: readonly PieceSessionRecord[];
}) {
  const t = useT();
  const records = usePieceSteps(pieceId);
  const { hands } = readPiecePrefs(pieceId);
  const reached = useMemo(
    () => (records ? tempoLadder(pieceId, hands, runs, records, facts).reached : null),
    [pieceId, hands, runs, records, facts],
  );
  if (reached === null) return null;
  return (
    <>
      {' · '}
      {t('pieces.progress.ladder', { tempo: t('pieces.tempo.percent', { percent: reached }) })}
    </>
  );
}

function Steady({ pieceId, facts }: { pieceId: string; facts: PieceFacts }) {
  const t = useT();
  const steady = useSteadyBars(pieceId, facts);
  if (steady === null) return null;
  return (
    <>
      {' · '}
      {t('pieces.progress.steady', {
        n: steady.steady,
        m: steady.of,
        hands: t(`pieces.progress.hands.${steady.hands}`),
      })}
    </>
  );
}
