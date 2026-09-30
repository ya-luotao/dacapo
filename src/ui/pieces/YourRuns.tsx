import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeExpression, type Melody } from '../../core/expression.ts';
import type { PieceSessionRecord } from '../../core/log.ts';
import type { Score } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import { useLogFormat } from '../progress/format.ts';
import { ExpressionPanel } from './ExpressionPanel.tsx';
import type { PieceFormat } from './format.ts';
import { RunList } from './RunList.tsx';
import { usePieceRuns, useRunFacts, useRunTake } from './runs.ts';

/**
 * "Your runs": the piece's past runs, laid over the score, each with its expression, computed
 * from its take when it is opened.
 */
export function YourRuns({
  pieceId,
  checksum,
  score,
  format,
  melody,
  onMelody,
  onLoopBars,
  onClose,
}: {
  pieceId: string;
  checksum: string;
  score: Score;
  format: PieceFormat;
  melody: Melody;
  onMelody: (melody: Melody) => void;
  onLoopBars: (from: number, to: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const log = useLogFormat();
  const runs = usePieceRuns(pieceId);
  const facts = useRunFacts();
  const [open, setOpen] = useState<PieceSessionRecord | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [open]);

  return (
    <section
      className="piece-summary your-runs"
      aria-labelledby="your-runs-title"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        if (open) setOpen(null);
        else onClose();
      }}
    >
      <div className="weak-table-head">
        <h2 id="your-runs-title" ref={heading} tabIndex={-1}>
          {open ? log.dateTime(open.startedAt) : t('pieces.runs.title')}
        </h2>
        <div className="actions">
          {open && (
            <button type="button" className="button is-compact" onClick={() => setOpen(null)}>
              {t('pieces.runs.back')}
            </button>
          )}
          <button type="button" className="button is-compact" onClick={onClose}>
            {t('pieces.weak.table.close')}
          </button>
        </div>
      </div>
      {open && <p className="your-runs-facts">{facts(open)}</p>}
      {open ? (
        <PastRun
          run={open}
          checksum={checksum}
          score={score}
          format={format}
          melody={melody}
          onMelody={onMelody}
          onLoopBars={onLoopBars}
        />
      ) : (
        <RunList
          runs={runs}
          actions={(run) => (
            <button type="button" className="button is-compact" onClick={() => setOpen(run)}>
              {t('pieces.expression')}
            </button>
          )}
        />
      )}
    </section>
  );
}

function PastRun({
  run,
  checksum,
  score,
  format,
  melody,
  onMelody,
  onLoopBars,
}: {
  run: PieceSessionRecord;
  checksum: string;
  score: Score;
  format: PieceFormat;
  melody: Melody;
  onMelody: (melody: Melody) => void;
  onLoopBars: (from: number, to: number) => void;
}) {
  const t = useT();
  const take = useRunTake(run.id, checksum);
  const analysis = useMemo(
    () =>
      take.state === 'ready'
        ? analyzeExpression({
            score,
            hands: run.hands,
            repeats: run.repeats,
            loop: run.loop,
            mode: run.mode === 'rhythm' ? 'rhythm' : 'wait',
            scale: run.tempo / 100,
            latency: take.latency,
            events: take.events,
            melody,
          })
        : null,
    [take, score, run, melody],
  );
  if (take.state === 'loading') return <p className="muted">{t('pieces.runs.loading')}</p>;
  if (take.state === 'none') return <p className="muted">{t('pieces.runs.noTake')}</p>;
  if (take.state === 'changed') return <p className="muted">{t('pieces.runs.changed')}</p>;
  if (!analysis) return null;
  return (
    <ExpressionPanel
      analysis={analysis}
      format={format}
      hands={run.hands}
      melody={melody}
      onMelody={onMelody}
      onLoopBars={onLoopBars}
    />
  );
}
