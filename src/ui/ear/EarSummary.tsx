import { nextEarLevel, parseItem } from '../../core/earItems.ts';
import type { EarLevelProgress, EarSessionSummary } from '../../core/earSession.ts';
import { WHOLE_TUNE } from '../../core/tuneList.ts';
import { useT } from '../../i18n/index.ts';
import { useReadFormat } from '../read/format.ts';
import { useEarFormat } from './format.ts';

interface EarSummaryProps {
  summary: EarSessionSummary;
  progress: EarLevelProgress;
  onAgain: () => void;
  onNextLevel: () => void;
  onChooseLevel: () => void;
  /** A tune: the same one in another key. */
  onAnotherKey?: () => void;
}

export function EarSummary({
  summary,
  progress,
  onAgain,
  onNextLevel,
  onChooseLevel,
  onAnotherKey,
}: EarSummaryProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useEarFormat();
  const complete = summary.items >= summary.length;
  const next = nextEarLevel(summary.level);
  const level = format.level(summary.level);
  const echo = summary.family === 'echo';
  const tune = summary.family === 'tune';
  // A tune's last item is the whole of it: asked once every phrase was, missed or not.
  const wholeAsked = tune && complete;
  const wholeMissed = summary.missed.some((m) => {
    const item = parseItem(m.item);
    return item?.family === 'tune' && item.part === WHOLE_TUNE;
  });

  return (
    <section className="read-summary ear-summary" aria-labelledby="ear-summary-title">
      <h2 id="ear-summary-title">{t(complete ? 'read.summary.done' : 'read.summary.stopped')}</h2>
      <p className="muted">
        {tune && summary.key
          ? t('ear.tune.inKey', {
              tune: level,
              key: format.key(summary.key.tonic, summary.key.scale),
            })
          : level}
      </p>

      <dl className="figures ear-figures">
        <div>
          <dt>
            {t(
              tune
                ? 'ear.summary.phrases'
                : echo
                  ? 'ear.summary.melodies'
                  : 'ear.summary.questions',
            )}
          </dt>
          <dd>{wholeAsked ? summary.items - 1 : summary.items}</dd>
        </div>
        <div>
          <dt>{t('read.summary.accuracy')}</dt>
          <dd>{read.percent(summary.accuracy)}</dd>
        </div>
        {/* How long a phrase took to play says nothing of the ear: the whole tune instead. */}
        {tune ? (
          <div>
            <dt>{t('ear.summary.whole')}</dt>
            <dd>
              {wholeAsked
                ? t(wholeMissed ? 'ear.summary.whole.wrong' : 'ear.summary.whole.right')
                : t('read.none')}
            </dd>
          </div>
        ) : (
          <div>
            <dt>{t('ear.summary.median')}</dt>
            <dd>{read.seconds(summary.medianMs)}</dd>
          </div>
        )}
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
                {tune
                  ? format.tuneMiss(missed)
                  : echo
                    ? format.echoMiss(missed)
                    : t('ear.summary.answeredAs', {
                        item: format.capitalize(format.item(missed.item, summary.level)),
                        answer: format.answer(missed, summary.level),
                      })}
                {summary.family === 'cadence' && (
                  <span className="ear-missed-cadence">
                    {format.missedCadence(missed, summary.level)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('read.summary.none')}</p>
        )}
      </div>

      <p className={progress.mastered ? 'read-mastery is-mastered' : 'read-mastery'}>
        {progress.mastered
          ? tune
            ? t('ear.tune.mastered', { tune: level })
            : t('read.summary.mastered', { level })
          : t(tune ? 'ear.tune.progress' : 'read.summary.progress', {
              level,
              tune: level,
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
        {tune && onAnotherKey && (
          <button type="button" className="button" onClick={onAnotherKey}>
            {t('ear.tune.key.other')}
          </button>
        )}
        {next && (
          <button type="button" className="button" onClick={onNextLevel}>
            {t(tune ? 'ear.tune.next' : 'read.nextLevel')}
          </button>
        )}
        <button type="button" className="button" onClick={onChooseLevel}>
          {t(tune ? 'ear.tune.choose' : 'read.chooseLevel')}
        </button>
      </div>
    </section>
  );
}
