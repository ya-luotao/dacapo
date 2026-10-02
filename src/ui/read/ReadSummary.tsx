import type { ReactNode } from 'react';
import type { CardAction, CardAdvice } from '../../core/advice.ts';
import { nextLevel } from '../../core/levels.ts';
import { MASTERY_WINDOW, type LevelProgress } from '../../core/mastery.ts';
import type { SessionSummary } from '../../core/session.ts';
import { useT } from '../../i18n/index.ts';
import { SummaryEnd } from '../SummaryEnd.tsx';
import { useReadFormat } from './format.ts';

interface ReadSummaryProps {
  summary: SessionSummary;
  progress: LevelProgress;
  onAgain: () => void;
  onNextLevel: () => void;
  onChooseLevel: () => void;
  /** What to work on next (docs/ADVICE.md, "Cards"), and what its button does. */
  advice?: CardAdvice | null;
  onAdvice?: (action: CardAction) => void;
}

export function ReadSummary({
  summary,
  progress,
  onAgain,
  onNextLevel,
  onChooseLevel,
  advice,
  onAdvice,
}: ReadSummaryProps) {
  const t = useT();
  const format = useReadFormat();
  const complete = summary.cards >= summary.length;
  const next = nextLevel(summary.level);
  const level = format.level(summary.level);

  return (
    <section className="read-summary" aria-labelledby="read-summary-title">
      <h2 id="read-summary-title">{t(complete ? 'read.summary.done' : 'read.summary.stopped')}</h2>
      <p className="muted">{level}</p>

      <dl className="figures">
        <div>
          <dt>{t('read.summary.cards')}</dt>
          <dd>{summary.cards}</dd>
        </div>
        <div>
          <dt>{t('read.summary.accuracy')}</dt>
          <dd>{format.percent(summary.accuracy)}</dd>
        </div>
        <div>
          <dt>{t('read.summary.median')}</dt>
          <dd>{format.seconds(summary.medianMs)}</dd>
        </div>
      </dl>

      <div className="note-lists">
        <NoteList title={t('read.summary.slowest')}>
          {summary.slowest.map(({ note, ms }) => (
            <li key={note}>
              <span>{format.note(note)}</span> <span className="muted">{format.seconds(ms)}</span>
            </li>
          ))}
        </NoteList>
        <NoteList title={t('read.summary.missed')}>
          {summary.missed.map((note) => (
            <li key={note}>{format.note(note)}</li>
          ))}
        </NoteList>
      </div>

      <SummaryEnd
        family="notes"
        level={level}
        mastery={{
          mastered: progress.mastered,
          text: progress.mastered
            ? t('read.summary.mastered', { level })
            : t('read.summary.progress', {
                level,
                stats: t('read.level.stats', {
                  cards: progress.cards,
                  window: MASTERY_WINDOW,
                  accuracy: format.percent(progress.accuracy),
                  median: format.seconds(progress.medianMs),
                }),
              }),
        }}
        percent={format.percent(summary.accuracy)}
        advice={advice}
        onAdvice={onAdvice}
        onAgain={onAgain}
        onNextLevel={next ? onNextLevel : null}
        onChooseLevel={onChooseLevel}
      />
    </section>
  );
}

function NoteList({ title, children }: { title: string; children: ReactNode[] }) {
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
