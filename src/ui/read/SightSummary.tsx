import { useMemo } from 'react';
import { generateFragment } from '../../core/sightFragment.ts';
import { nextSightLevel, SIGHT_GENERATOR_VERSIONS } from '../../core/sightLevels.ts';
import {
  firstTimeRun,
  inTimeShare,
  type SightLevelProgress,
  type SightSessionSummary,
} from '../../core/sightRead.ts';
import { useT } from '../../i18n/index.ts';
import { useReadFormat } from './format.ts';
import { useRhythmFormat } from './rhythmFormat.ts';
import { useSightFormat } from './sightFormat.ts';

interface SightSummaryProps {
  summary: SightSessionSummary;
  progress: SightLevelProgress;
  onAgain: () => void;
  onNextLevel: () => void;
  onChooseLevel: () => void;
}

/** The end of a sight-reading session: each fragment's first run in time, and mastery. */
export function SightSummary({
  summary,
  progress,
  onAgain,
  onNextLevel,
  onChooseLevel,
}: SightSummaryProps) {
  const t = useT();
  const read = useReadFormat();
  const rhythm = useRhythmFormat();
  const format = useSightFormat();
  const complete = summary.fragments.length >= summary.length;
  const next = nextSightLevel(summary.level);
  const level = format.level(summary.level);

  const rows = useMemo(
    () =>
      summary.fragments.map((f) => {
        const drawn = SIGHT_GENERATOR_VERSIONS.includes(f.version)
          ? generateFragment(summary.level, f.seed, f.version)
          : null;
        return { fragment: f, drawn, first: firstTimeRun(f) };
      }),
    [summary],
  );
  const timed = rows.flatMap((r) => (r.first ? [r.first] : []));
  const notes = timed.reduce((n, r) => n + r.notes, 0);
  const inTime = timed.reduce((n, r) => n + r.inTime, 0);
  const deviations = timed.flatMap((r) => (r.tendency === null ? [] : [r.tendency]));
  const tendency =
    deviations.length === 0 ? null : deviations.reduce((a, b) => a + b, 0) / deviations.length;

  return (
    <section
      className="read-summary rhythm-summary sight-summary"
      aria-labelledby="sight-summary-title"
    >
      <h2 id="sight-summary-title">{t(complete ? 'read.summary.done' : 'read.summary.stopped')}</h2>
      <p className="muted">
        {t('read.what.sight')} · {level}
      </p>

      <dl className="figures">
        <div>
          <dt>{t('sight.summary.fragments')}</dt>
          <dd>
            {summary.fragments.length < summary.length
              ? `${summary.fragments.length}/${summary.length}`
              : summary.fragments.length}
          </dd>
        </div>
        <div>
          <dt>{t('sight.result.inTime')}</dt>
          <dd>{notes === 0 ? t('read.none') : read.percent(inTime / notes)}</dd>
        </div>
        <div>
          <dt>{t('sight.summary.runs')}</dt>
          <dd>{summary.fragments.reduce((n, f) => n + f.runs.length, 0)}</dd>
        </div>
      </dl>
      {timed.length > 0 && <p className="rhythm-tendency">{rhythm.tendency(tendency)}</p>}

      <div className="note-list sight-fragments">
        <h3>{t('sight.summary.list')}</h3>
        <ol>
          {rows.map(({ fragment, drawn, first }, i) => (
            <li key={i}>
              <span>
                {drawn
                  ? t('sight.keyMeter', { key: format.key(drawn.key), meter: drawn.meter })
                  : t('sight.summary.fragment', { n: i + 1 })}
              </span>{' '}
              <span className="muted">
                {first
                  ? t('sight.summary.first', { share: read.percent(inTimeShare(first)) })
                  : t('sight.summary.waitOnly')}
                {fragment.runs.length > 1 &&
                  ` · ${t('sight.summary.runsOf', { n: fragment.runs.length })}`}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <p className={progress.mastered ? 'read-mastery is-mastered' : 'read-mastery'}>
        {progress.mastered
          ? t('read.summary.mastered', { level })
          : t('read.summary.progress', { level, stats: format.stats(progress) })}
      </p>

      <div className="actions">
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
