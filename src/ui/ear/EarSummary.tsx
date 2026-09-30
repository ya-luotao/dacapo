import { nextEarLevel } from '../../core/earItems.ts';
import type { EarLevelProgress, EarSessionSummary } from '../../core/earSession.ts';
import { useT } from '../../i18n/index.ts';
import { useReadFormat } from '../read/format.ts';
import { useEarFormat } from './format.ts';

interface EarSummaryProps {
  summary: EarSessionSummary;
  progress: EarLevelProgress;
  onAgain: () => void;
  onNextLevel: () => void;
  onChooseLevel: () => void;
}

export function EarSummary({
  summary,
  progress,
  onAgain,
  onNextLevel,
  onChooseLevel,
}: EarSummaryProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useEarFormat();
  const complete = summary.items >= summary.length;
  const next = nextEarLevel(summary.level);
  const level = format.level(summary.level);
  const echo = summary.family === 'echo';

  return (
    <section className="read-summary ear-summary" aria-labelledby="ear-summary-title">
      <h2 id="ear-summary-title">{t(complete ? 'read.summary.done' : 'read.summary.stopped')}</h2>
      <p className="muted">{level}</p>

      <dl className="figures ear-figures">
        <div>
          <dt>{t(echo ? 'ear.summary.melodies' : 'ear.summary.questions')}</dt>
          <dd>{summary.items}</dd>
        </div>
        <div>
          <dt>{t('read.summary.accuracy')}</dt>
          <dd>{read.percent(summary.accuracy)}</dd>
        </div>
        <div>
          <dt>{t('ear.summary.median')}</dt>
          <dd>{read.seconds(summary.medianMs)}</dd>
        </div>
        <div>
          <dt>{t('ear.summary.replays')}</dt>
          <dd>{summary.replays}</dd>
        </div>
      </dl>

      <div className="note-list ear-missed">
        <h3>{t('ear.summary.missed')}</h3>
        {summary.missed.length > 0 ? (
          <ul>
            {summary.missed.map((missed, i) => (
              <li key={i}>
                {echo
                  ? format.echoMiss(missed)
                  : t('ear.summary.answeredAs', {
                      item: format.capitalize(format.item(missed.item, summary.level)),
                      answer: format.answer(missed, summary.level),
                    })}
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
          : t('read.summary.progress', {
              level,
              stats: format.levelStats(
                progress,
                read.percent(progress.accuracy),
                read.seconds(progress.medianMs),
              ),
            })}
      </p>

      <div className="actions">
        {/* Focused on arrival: Enter or Space starts again (no question is live here). */}
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
