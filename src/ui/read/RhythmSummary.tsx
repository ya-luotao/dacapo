import { getRhythmLevel, nextRhythmLevel } from '../../core/rhythmCells.ts';
import type { RhythmLevelProgress, RhythmSessionSummary } from '../../core/rhythmRead.ts';
import { useT } from '../../i18n/index.ts';
import { useReadFormat } from './format.ts';
import { useRhythmFormat } from './rhythmFormat.ts';

/** How many of the cells missed most the summary names. */
const MISSED_SHOWN = 5;

interface RhythmSummaryProps {
  summary: RhythmSessionSummary;
  progress: RhythmLevelProgress;
  onAgain: () => void;
  onNextLevel: () => void;
  onChooseLevel: () => void;
}

/** The end of a session of rhythm lines, as Read's summary: figures, tendency, misses, mastery. */
export function RhythmSummary({
  summary,
  progress,
  onAgain,
  onNextLevel,
  onChooseLevel,
}: RhythmSummaryProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useRhythmFormat();
  const complete = summary.exercises >= summary.length;
  const next = nextRhythmLevel(summary.level);
  const level = format.level(summary.level);

  return (
    <section className="read-summary rhythm-summary" aria-labelledby="rhythm-summary-title">
      <h2 id="rhythm-summary-title">
        {t(complete ? 'read.summary.done' : 'read.summary.stopped')}
      </h2>
      <p className="muted">
        {t('read.what.rhythm')} · {level}
      </p>

      <dl className="figures">
        <div>
          <dt>{t('rhythm.summary.exercises')}</dt>
          <dd>
            {summary.exercises < summary.length
              ? `${summary.exercises}/${summary.length}`
              : summary.exercises}
          </dd>
        </div>
        <div>
          <dt>{t('rhythm.summary.cells')}</dt>
          <dd>{read.percent(summary.accuracy)}</dd>
        </div>
        <div>
          <dt>{t('rhythm.summary.median')}</dt>
          <dd>{format.ms(summary.medianDeviation)}</dd>
        </div>
        <div>
          <dt>{t('rhythm.summary.tempo')}</dt>
          <dd>{format.tempo(getRhythmLevel(summary.level).meters[0]!, summary.bpm)}</dd>
        </div>
      </dl>
      <p className="rhythm-tendency">{format.tendency(summary.tendency)}</p>

      <div className="note-list rhythm-missed">
        <h3>{t('rhythm.summary.missed')}</h3>
        {summary.missed.length > 0 ? (
          <ul>
            {summary.missed.slice(0, MISSED_SHOWN).map(({ item, count }) => (
              <li key={item}>
                <span>{format.capitalize(format.item(item))}</span>{' '}
                <span className="muted">{t('rhythm.summary.times', { n: count })}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('read.summary.none')}</p>
        )}
      </div>

      <p className={progress.mastered ? 'read-mastery is-mastered' : 'read-mastery'}>
        {progress.mastered
          ? t('read.summary.mastered', { level })
          : t('read.summary.progress', { level, stats: format.stats(progress) })}
      </p>

      <div className="actions">
        {/* Focused on arrival: Enter or Space starts again. */}
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
