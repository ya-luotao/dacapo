import { useMemo } from 'react';
import { barHeatmap, steadyBars } from '../../core/barHeatmap.ts';
import type { PieceSessionRecord } from '../../core/log.ts';
import type { PieceFacts } from '../../core/pieceRecords.ts';
import type { HandSelection } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import { usePieceSteps, usePractice } from '../practice/context.ts';
import { usePieceFormat } from './format.ts';
import { readPref } from '../../lib/localPrefs.ts';
import { readPiecePrefs, WEAK_ALL_KEYS_PREF } from './prefs.ts';
import { usePieceReview } from './review.ts';

/**
 * A quiet line on a library card: when the piece was last practised, how many runs, and how many
 * of its bars are steady for the hands last chosen. Nothing before the first run.
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

function Steady({ pieceId, facts }: { pieceId: string; facts: PieceFacts }) {
  const t = useT();
  const records = usePieceSteps(pieceId);
  const prefs = readPiecePrefs(pieceId);
  const hands: HandSelection = prefs.hands;
  // With a left hand from the symbols the piece is practised on other notes: the practice page
  // leaves their checksum and bar counts here (docs/HARMONY.md, H3).
  const { checksum, bars: counts } = prefs.practised ?? facts;
  // Runs in the written key, unless Weak bars was asked for every key (H4).
  const allKeys = readPref(WEAK_ALL_KEYS_PREF) === '1';
  const steady = useMemo(() => {
    if (!records) return null;
    const bars = [
      ...new Set(
        records
          .filter((r) => r.hands === hands && r.checksum === checksum)
          .filter((r) => allKeys || r.transpose === undefined)
          .map((r) => r.measure),
      ),
    ];
    return steadyBars(barHeatmap(records, { checksum, hands, bars, allKeys }).cells).steady;
  }, [records, checksum, hands, allKeys]);
  if (steady === null) return null;
  return (
    <>
      {' · '}
      {t('pieces.progress.steady', {
        n: steady,
        m: counts[hands],
        hands: t(`pieces.progress.hands.${hands}`),
      })}
    </>
  );
}
