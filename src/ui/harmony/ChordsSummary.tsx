import type { ReactNode } from 'react';
import { nextHarmonyLevel, parseSymbolItem } from '../../core/chordSymbols.ts';
import {
  HARMONY_MASTERY_WINDOW,
  type HarmonyLevelProgress,
  type HarmonySessionSummary,
} from '../../core/harmonySession.ts';
import { useT } from '../../i18n/index.ts';
import { useReadFormat } from '../read/format.ts';
import { heldNames, useHarmonyFormat } from './format.ts';
import { SymbolText } from './SymbolText.tsx';

interface ChordsSummaryProps {
  summary: HarmonySessionSummary;
  progress: HarmonyLevelProgress;
  onAgain: () => void;
  onNextLevel: () => void;
  onChooseLevel: () => void;
}

/** The end of a session of chord symbols, as Read's summary: figures, slowest, missed, mastery. */
export function ChordsSummary({
  summary,
  progress,
  onAgain,
  onNextLevel,
  onChooseLevel,
}: ChordsSummaryProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useHarmonyFormat();
  const complete = summary.cards >= summary.length;
  const next = nextHarmonyLevel(summary.level);
  const level = format.level(summary.level);

  return (
    <section className="read-summary harmony-summary" aria-labelledby="harmony-summary-title">
      <h2 id="harmony-summary-title">
        {t(complete ? 'read.summary.done' : 'read.summary.stopped')}
      </h2>
      <p className="muted">
        {t('harmony.practice.chords')} · {level}
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

      <div className="note-lists harmony-lists">
        <ItemList title={t('theory.summary.slowest')}>
          {summary.slowest.map(({ item, ms }) => {
            const symbol = parseSymbolItem(item);
            return (
              <li key={item}>
                {symbol ? <SymbolText symbol={symbol} label={format.words(symbol)} /> : item}{' '}
                <span className="muted">{read.seconds(ms)}</span>
              </li>
            );
          })}
        </ItemList>
        <ItemList title={t('theory.summary.missed')}>
          {summary.missed.map((missed, i) => {
            const symbol = parseSymbolItem(missed.item);
            if (!symbol) return <li key={i}>{missed.item}</li>;
            return (
              <li key={i}>
                <SymbolText symbol={symbol} label={format.words(symbol)} />{' '}
                {t('harmony.summary.miss', {
                  notes: format.notes(symbol),
                  played: heldNames(missed.answer, symbol),
                })}
              </li>
            );
          })}
        </ItemList>
      </div>

      <p className={progress.mastered ? 'read-mastery is-mastered' : 'read-mastery'}>
        {progress.mastered
          ? t('read.summary.mastered', { level })
          : t('read.summary.progress', {
              level,
              stats: t('read.level.stats', {
                cards: progress.cards,
                window: HARMONY_MASTERY_WINDOW,
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
