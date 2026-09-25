import { useMemo } from 'react';
import { barHeatmap, steadyBars } from '../../core/barHeatmap.ts';
import type { PieceSessionRecord } from '../../core/log.ts';
import type { PieceFacts } from '../../core/pieceRecords.ts';
import type { HandSelection } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import { usePieceSteps, usePractice } from '../practice/context.ts';
import { usePieceFormat } from './format.ts';
import { readPiecePrefs } from './prefs.ts';

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
    </span>
  );
}

function Steady({ pieceId, facts }: { pieceId: string; facts: PieceFacts }) {
  const t = useT();
  const records = usePieceSteps(pieceId);
  const hands: HandSelection = readPiecePrefs(pieceId).hands;
  const steady = useMemo(() => {
    if (!records) return null;
    const bars = [
      ...new Set(
        records
          .filter((r) => r.hands === hands && r.checksum === facts.checksum)
          .map((r) => r.measure),
      ),
    ];
    return steadyBars(barHeatmap(records, { checksum: facts.checksum, hands, bars }).cells).steady;
  }, [records, facts.checksum, hands]);
  if (steady === null) return null;
  return (
    <>
      {' · '}
      {t('pieces.progress.steady', {
        n: steady,
        m: facts.bars[hands],
        hands: t(`pieces.progress.hands.${hands}`),
      })}
    </>
  );
}
