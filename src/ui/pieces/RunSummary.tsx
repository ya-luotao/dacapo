import { useEffect, useRef } from 'react';
import type { RunSummary as Summary } from '../../core/pieceRun.ts';
import { useT } from '../../i18n/index.ts';
import { useLogFormat } from '../progress/format.ts';
import type { usePieceFormat } from './format.ts';

interface RunSummaryProps {
  summary: Summary;
  /** Ended with Finish while looping. */
  looped: boolean;
  format: ReturnType<typeof usePieceFormat>;
  onAgain: () => void;
  onLoopBar: (bar: number) => void;
}

/** The end of a run: a sheet laid over the score. */
export function RunSummary({ summary, looped, format, onAgain, onLoopBar }: RunSummaryProps) {
  const t = useT();
  const log = useLogFormat();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const slowest = summary.slowest[0];

  return (
    <section className="piece-summary" aria-labelledby="piece-summary-title">
      <h2 id="piece-summary-title" ref={heading} tabIndex={-1}>
        {looped ? t('pieces.done.loop') : t('pieces.done')}
      </h2>
      <dl className="figures">
        <div>
          <dt>{t('pieces.done.time')}</dt>
          <dd>{log.duration(summary.activeMs)}</dd>
        </div>
        <div>
          <dt>{t('pieces.done.wrong')}</dt>
          <dd>{summary.wrong}</dd>
        </div>
        <div>
          <dt>{t('pieces.done.steps')}</dt>
          <dd>{summary.steps}</dd>
        </div>
      </dl>
      <div className="note-list">
        <h3>{t('pieces.done.slowest')}</h3>
        {summary.slowest.length === 0 ? (
          <p>{t('pieces.done.none')}</p>
        ) : (
          <ul>
            {summary.slowest.map((bar) => (
              <li key={bar.measure}>
                {t('pieces.done.bar', {
                  bar: format.barTitle(bar.measure),
                  time: format.seconds(bar.meanMs),
                  wrong: bar.wrong,
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="help">{t('pieces.done.saved')}</p>
      <div className="actions">
        <button type="button" className="button button-primary" onClick={onAgain}>
          {t('pieces.done.again')}
        </button>
        {slowest && (
          <button type="button" className="button" onClick={() => onLoopBar(slowest.measure)}>
            {t('pieces.done.loopBar', { bar: format.barLabel(slowest.measure) })}
          </button>
        )}
      </div>
    </section>
  );
}
