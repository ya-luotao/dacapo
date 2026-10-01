import { useEffect, useRef, type ReactNode } from 'react';
import type { BarPrompts } from '../../core/memory.ts';
import type { RunSummary as Summary } from '../../core/pieceRun.ts';
import { useT } from '../../i18n/index.ts';
import { useLogFormat } from '../progress/format.ts';
import type { usePieceFormat } from './format.ts';
import { PlayBackButton } from './PlayBackButton.tsx';

interface RunSummaryProps {
  summary: Summary;
  /** Memory mode: the prompts per bar (none needed: an empty list); null in wait mode. */
  prompts?: BarPrompts[] | null;
  /** Ended with Finish while looping. */
  looped: boolean;
  format: ReturnType<typeof usePieceFormat>;
  onAgain: () => void;
  onLoopBar: (bar: number) => void;
  /** The run's Expression panel. */
  expression?: ReactNode;
  /** Plays the run back (absent when nothing of it was kept). */
  onPlayBack?: () => void;
}

/** The end of a run: a sheet laid over the score. */
export function RunSummary({
  summary,
  prompts = null,
  looped,
  format,
  onAgain,
  onLoopBar,
  expression,
  onPlayBack,
}: RunSummaryProps) {
  const t = useT();
  const log = useLogFormat();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  // The bar to loop: by heart, the one that needed most prompts; else the slowest.
  const loopBar = prompts?.[0]?.measure ?? summary.slowest[0]?.measure;

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
        {prompts && (
          <div>
            <dt>{t('pieces.memory.prompts')}</dt>
            <dd>{prompts.reduce((sum, bar) => sum + bar.prompts, 0)}</dd>
          </div>
        )}
      </dl>
      {prompts && (
        <div className="note-list">
          <h3>{t('pieces.memory.bars')}</h3>
          {prompts.length === 0 ? (
            <p>{t('pieces.memory.bars.none')}</p>
          ) : (
            <ul>
              {prompts.map((bar) => (
                <li key={bar.measure}>
                  {bar.prompts === 1
                    ? t('pieces.memory.bar.one', { bar: format.barTitle(bar.measure) })
                    : t('pieces.memory.bar.other', {
                        bar: format.barTitle(bar.measure),
                        n: bar.prompts,
                      })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
        {loopBar !== undefined && (
          <button type="button" className="button" onClick={() => onLoopBar(loopBar)}>
            {t('pieces.done.loopBar', { bar: format.barLabel(loopBar) })}
          </button>
        )}
        {onPlayBack && <PlayBackButton onClick={onPlayBack} />}
      </div>
      {expression}
    </section>
  );
}
