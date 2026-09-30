import { useState, type ReactNode } from 'react';
import type { PieceSessionRecord } from '../../core/log.ts';
import { useT } from '../../i18n/index.ts';
import { useLogFormat } from '../progress/format.ts';
import { useRunFacts } from './runs.ts';

/** Runs shown at first, and added by "Show more". */
export const RUNS_PER_PAGE = 10;

/**
 * A piece's runs, most recent first: when, the mode, the hands, the bars and the tempo, and
 * whatever each row offers (its expression; later, playing it back).
 */
export function RunList({
  runs,
  actions,
}: {
  runs: readonly PieceSessionRecord[];
  actions: (run: PieceSessionRecord) => ReactNode;
}) {
  const t = useT();
  const log = useLogFormat();
  const facts = useRunFacts();
  const [shown, setShown] = useState(RUNS_PER_PAGE);
  if (runs.length === 0) return <p className="muted">{t('pieces.runs.none')}</p>;

  return (
    <>
      <ol className="run-list">
        {runs.slice(0, shown).map((run) => (
          <li key={run.id} className="run-row">
            <div className="run-facts">
              <time dateTime={new Date(run.startedAt).toISOString()}>
                {log.dateTime(run.startedAt)}
              </time>
              <span>{facts(run)}</span>
            </div>
            <div className="run-actions">{actions(run)}</div>
          </li>
        ))}
      </ol>
      {shown < runs.length && (
        <button
          type="button"
          className="button is-compact run-more"
          onClick={() => setShown((n) => n + RUNS_PER_PAGE)}
        >
          {t('progress.showMore')}
        </button>
      )}
    </>
  );
}
