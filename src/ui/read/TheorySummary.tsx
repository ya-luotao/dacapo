import type { ReactNode } from 'react';
import { nextTheoryLevel } from '../../core/theoryItems.ts';
import {
  THEORY_MASTERY_WINDOW,
  type TheoryLevelProgress,
  type TheorySessionSummary,
} from '../../core/theorySession.ts';
import { useT } from '../../i18n/index.ts';
import { useReadFormat } from './format.ts';
import { useTheoryFormat } from './theoryFormat.ts';

interface TheorySummaryProps {
  summary: TheorySessionSummary;
  progress: TheoryLevelProgress;
  onAgain: () => void;
  onNextLevel: () => void;
  onChooseLevel: () => void;
}

/** The end of a session of theory cards, as Read's summary: figures, slowest, missed, mastery. */
export function TheorySummary({
  summary,
  progress,
  onAgain,
  onNextLevel,
  onChooseLevel,
}: TheorySummaryProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useTheoryFormat();
  const complete = summary.cards >= summary.length;
  const next = nextTheoryLevel(summary.level);
  const level = format.level(summary.level);

  return (
    <section className="read-summary theory-summary" aria-labelledby="theory-summary-title">
      <h2 id="theory-summary-title">
        {t(complete ? 'read.summary.done' : 'read.summary.stopped')}
      </h2>
      <p className="muted">
        {t(`read.what.${summary.family}`)} · {level}
      </p>

      <dl className="figures">
        <div>
          <dt>{t('read.summary.cards')}</dt>
          <dd>{summary.cards}</dd>
        </div>
        <div>
          <dt>{t('read.summary.accuracy')}</dt>
          <dd>{read.percent(summary.accuracy)}</dd>
        </div>
        <div>
          <dt>{t('ear.summary.median')}</dt>
          <dd>{read.seconds(summary.medianMs)}</dd>
        </div>
      </dl>

      <div className="note-lists theory-lists">
        <ItemList title={t('theory.summary.slowest')}>
          {summary.slowest.map(({ item, ms }) => (
            <li key={item}>
              <span>{format.capitalize(format.item(item, summary.level))}</span>{' '}
              <span className="muted">{read.seconds(ms)}</span>
            </li>
          ))}
        </ItemList>
        <ItemList title={t('theory.summary.missed')}>
          {summary.missed.map((missed, i) => (
            <li key={i}>
              {t('theory.summary.miss', {
                card: format.card(missed.prompt, missed.clef),
                right: format.right(missed, summary.level),
                answer: format.answer(missed, summary.level),
              })}
            </li>
          ))}
        </ItemList>
      </div>

      <p className={progress.mastered ? 'read-mastery is-mastered' : 'read-mastery'}>
        {progress.mastered
          ? t('read.summary.mastered', { level })
          : t('read.summary.progress', {
              level,
              stats: t('read.level.stats', {
                cards: progress.cards,
                window: THEORY_MASTERY_WINDOW,
                accuracy: read.percent(progress.accuracy),
                median: read.seconds(progress.medianMs),
              }),
            })}
      </p>

      <div className="actions">
        {/* Focused on arrival: Enter or Space starts again (no card is live here). */}
        <button type="button" className="button button-primary" onClick={onAgain} autoFocus>
          {t('read.again')}
        </button>
        {next && (
          <button type="button" className="button" onClick={onNextLevel}>
            {t('read.nextLevel')}
          </button>
        )}
        <button type="button" className="button" onClick={onChooseLevel}>
          {t('read.chooseLevel')}
        </button>
      </div>
    </section>
  );
}

function ItemList({ title, children }: { title: string; children: ReactNode[] }) {
  const t = useT();
  return (
    <div className="note-list">
      <h3>{title}</h3>
      {children.length > 0 ? (
        <ul>{children}</ul>
      ) : (
        <p className="muted">{t('read.summary.none')}</p>
      )}
    </div>
  );
}
