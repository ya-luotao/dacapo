import type { ProblemPlace, RunAnalysis } from '../../core/evenness.ts';
import { SENTENCE_GAP, useI18n } from '../../i18n/index.ts';
import { ProfileChart } from './ProfileChart.tsx';
import type { RunEnd } from './run.ts';

/** A tempo that moved less than this from the start to the end of the run is steady. */
const DRIFT_SHARE = 0.1;
const MAX_SENTENCES = 3;

/**
 * After a run: how even it was (the spread, against the published professional figure), the tempo,
 * the hesitations and the wrong notes; then in a few sentences where it went uneven, whether the
 * tempo moved and what the loudness did; then every note on the profile chart.
 */
export function ScaleSummary({
  analysis,
  names,
  end,
}: {
  analysis: RunAnalysis;
  /** Each note's name as the scale spells it, by index. */
  names: readonly string[];
  end: RunEnd | null;
}) {
  const { t, locale } = useI18n();
  const gap = SENTENCE_GAP[locale];
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const tenth = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const list = (items: readonly string[]) => items.join(t('app.listSeparator'));

  const { counts } = analysis;
  if (analysis.quality !== 'ok') {
    return (
      <section className="scale-summary" aria-live="polite">
        <p className="scale-verdict">
          {t('scales.result.notARun', {
            mistakes: counts.wrong + counts.missed + counts.extra,
            total: counts.expected,
          })}
        </p>
      </section>
    );
  }

  const hand = analysis.hands[0]!;
  const { timing, loudness } = hand;
  const perSecond = (interval: number | null) =>
    interval === null || interval <= 0 ? null : 1000 / interval;
  const tempo = perSecond(timing.medianInterval);
  const start = perSecond(timing.startInterval);
  const finish = perSecond(timing.endInterval);
  const moved = start !== null && finish !== null ? finish / start - 1 : 0;

  const sentences: string[] = end === 'stopped' ? [t('scales.result.stopped')] : [];
  if (analysis.problem) sentences.push(problemSentence(analysis.problem));
  if (timing.hesitations.length > 0)
    sentences.push(
      t('scales.result.hesitations', {
        keys: list(timing.hesitations.map((h) => names[h.index] ?? '')),
      }),
    );
  if (start !== null && finish !== null && Math.abs(moved) >= DRIFT_SHARE)
    sentences.push(
      t(moved > 0 ? 'scales.result.faster' : 'scales.result.slower', {
        from: tenth.format(start),
        to: tenth.format(finish),
      }),
    );
  if (loudness === null) sentences.push(t('scales.result.noLoudness'));
  else if (loudness.accents.length > 0)
    sentences.push(
      t('scales.result.accents', { keys: list(loudness.accents.map((i) => names[i] ?? '')) }),
    );
  else sentences.push(t('scales.result.evenLoudness'));

  function problemSentence(problem: ProblemPlace): string {
    const ms = Math.round(Math.abs(problem.deviation));
    return t(`scales.problem.${problem.crossing}.${problem.direction}`, {
      timing: t(problem.deviation > 0 ? 'scales.problem.late' : 'scales.problem.early', { ms }),
      keys: list(problem.indexes.map((i) => names[i] ?? '')),
    });
  }

  return (
    <section className="scale-summary" aria-labelledby="scale-summary-title">
      <h3 id="scale-summary-title" className="visually-hidden">
        {t('scales.result.title')}
      </h3>
      <dl className="figures">
        <div>
          <dt>{t('scales.result.spread')}</dt>
          <dd>
            {timing.spread === null
              ? '–'
              : t('scales.result.ms', { ms: whole.format(timing.spread) })}
            {timing.rough && <span className="scale-rough"> {t('scales.result.rough')}</span>}
          </dd>
        </div>
        <div>
          <dt>{t('scales.result.share')}</dt>
          <dd>
            {timing.spreadShare === null
              ? '–'
              : t('scales.result.percent', { percent: whole.format(timing.spreadShare) })}
          </dd>
        </div>
        <div>
          <dt>{t('scales.result.tempo')}</dt>
          <dd>{tempo === null ? '–' : t('scales.result.perSecond', { n: tenth.format(tempo) })}</dd>
        </div>
        <div>
          <dt>{t('scales.result.wrong')}</dt>
          <dd>{counts.wrong + counts.missed + counts.extra}</dd>
        </div>
      </dl>
      <p className="help">{t('scales.result.reference')}</p>
      <p className="scale-verdict">
        {/* Three sentences at most, the most telling first. */}
        {sentences.slice(0, MAX_SENTENCES).join(gap)}
      </p>
      <ProfileChart hand={hand} names={names} />
    </section>
  );
}
