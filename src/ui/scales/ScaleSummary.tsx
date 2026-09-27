import type { HandAnalysis, ProblemPlace, RunAnalysis } from '../../core/evenness.ts';
import type { Hand } from '../../core/score.ts';
import { SENTENCE_GAP, useI18n } from '../../i18n/index.ts';
import { ProfileChart } from './ProfileChart.tsx';
import type { RunEnd } from './run.ts';

/** A tempo that moved less than this from the start to the end of the run is steady. */
const DRIFT_SHARE = 0.1;
const MAX_SENTENCES = 3;
/** More gaps (or pairs apart) than this are counted, not named. */
const MAX_NAMED_GAPS = 4;
/** Pairs apart this often are the way the hands were played, not a place. */
const APART_OFTEN = 0.25;

export type NamesByHand = Readonly<Record<Hand, readonly string[]>>;

/**
 * After a run: how even it was (the spread of each hand, against the published professional
 * figure), how far apart the hands were, the tempo and the wrong notes; then in a few sentences,
 * the most telling first, where it went uneven, whether the hands and the fingers kept together,
 * whether the tempo moved and what the loudness did; then every note of each hand on a chart.
 */
export function ScaleSummary({
  analysis,
  names,
  end,
  pedal,
}: {
  analysis: RunAnalysis;
  /** Each note's name as the scale spells it, per hand, by index. */
  names: NamesByHand;
  end: RunEnd | null;
  /** The sustain pedal was down during the run. */
  pedal: boolean;
}) {
  const { t, locale } = useI18n();
  const gap = SENTENCE_GAP[locale];
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const tenth = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
  const list = (items: readonly string[]) => items.join(t('app.listSeparator'));
  const ms = (value: number) => t('scales.result.ms', { ms: whole.format(Math.round(value)) });

  const { counts, hands, together } = analysis;
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

  const two = hands.length > 1;
  const handWord = (hand: Hand) => t(`scales.hand.${hand}`);
  const keysOf = (hand: Hand, indexes: readonly number[]) =>
    list(indexes.map((i) => names[hand][i] ?? ''));
  // With both hands, a sentence about one of them says which.
  const forHand = (hand: Hand, text: string) =>
    two ? t('scales.result.forHand', { hand: handWord(hand), text }) : text;

  // The tempo of the run: both hands play it, so the first hand's intervals tell it.
  const lead = hands[0]!;
  const perSecond = (interval: number | null) =>
    interval === null || interval <= 0 ? null : 1000 / interval;
  const tempo = perSecond(lead.timing.medianInterval);
  const start = perSecond(lead.timing.startInterval);
  const finish = perSecond(lead.timing.endInterval);
  const moved = start !== null && finish !== null ? finish / start - 1 : 0;

  function problemSentence(problem: ProblemPlace): string {
    return forHand(
      problem.hand,
      t(`scales.problem.${problem.crossing}.${problem.direction}`, {
        timing: t(problem.deviation > 0 ? 'scales.problem.late' : 'scales.problem.early', {
          ms: Math.round(Math.abs(problem.deviation)),
        }),
        keys: keysOf(problem.hand, problem.indexes),
      }),
    );
  }

  function connectionSentence(hand: HandAnalysis): string | null {
    const c = hand.connection;
    if (!c || c.medianOverlap === null) return null;
    // Gaps here and there are named; gaps nearly everywhere are the way it was played.
    const text =
      c.medianOverlap < 0
        ? t('scales.result.detached', { ms: Math.round(-c.medianOverlap) })
        : c.gaps.length > MAX_NAMED_GAPS || c.gaps.length * 2 >= c.notes
          ? t('scales.result.gapsMany', { n: c.gaps.length })
          : c.gaps.length > 0
            ? t('scales.result.gaps', { keys: keysOf(hand.hand, c.gaps) })
            : t('scales.result.legato', { ms: Math.round(c.medianOverlap) });
    return forHand(hand.hand, text);
  }

  // Most telling first; at most three are shown.
  const sentences: string[] = end === 'stopped' ? [t('scales.result.stopped')] : [];
  if (analysis.problem) sentences.push(problemSentence(analysis.problem));
  for (const hand of hands)
    if (hand.timing.hesitations.length > 0)
      sentences.push(
        forHand(
          hand.hand,
          t('scales.result.hesitations', {
            keys: keysOf(
              hand.hand,
              hand.timing.hesitations.map((h) => h.index),
            ),
          }),
        ),
      );
  if (together && together.median !== null) {
    // 30 ms apart happens by chance to loose hands: a few such pairs are named, many are how the
    // hands were, and a hand ahead every time says it all.
    const measured = together.pairs.filter((p) => p.asynchrony !== null).length;
    const apart = together.apart;
    sentences.push(
      together.leads
        ? t(`scales.result.leads.${together.leads}`, {
            ms: Math.round(Math.abs(together.median)),
          })
        : measured > 0 && apart.length / measured >= APART_OFTEN && together.spread !== null
          ? t('scales.result.apartOften', { ms: Math.round(together.spread) })
          : apart.length > MAX_NAMED_GAPS
            ? t('scales.result.apartMany', { n: apart.length })
            : apart.length > 0
              ? // A pair is named by its left-hand note, the lower of the two.
                t('scales.result.apart', { keys: keysOf('left', apart) })
              : t('scales.result.together'),
    );
  }
  for (const hand of hands) {
    const sentence = connectionSentence(hand);
    if (sentence) sentences.push(sentence);
  }
  if (pedal && hands.some((h) => h.connection)) sentences.push(t('scales.result.pedal'));
  if (start !== null && finish !== null && Math.abs(moved) >= DRIFT_SHARE)
    sentences.push(
      t(moved > 0 ? 'scales.result.faster' : 'scales.result.slower', {
        from: tenth.format(start),
        to: tenth.format(finish),
      }),
    );
  if (!analysis.velocityMeasured) sentences.push(t('scales.result.noLoudness'));
  else
    for (const hand of hands) {
      if (!hand.loudness) continue;
      sentences.push(
        forHand(
          hand.hand,
          hand.loudness.accents.length > 0
            ? t('scales.result.accents', { keys: keysOf(hand.hand, hand.loudness.accents) })
            : t('scales.result.evenLoudness'),
        ),
      );
    }

  const spreadOf = (hand: HandAnalysis) =>
    hand.timing.spread === null ? '–' : ms(hand.timing.spread);
  const shareOf = (hand: HandAnalysis) =>
    hand.timing.spreadShare === null
      ? '–'
      : t('scales.result.percent', { percent: whole.format(hand.timing.spreadShare) });
  const rough = hands.some((h) => h.timing.rough);

  return (
    <section className="scale-summary" aria-labelledby="scale-summary-title">
      <h3 id="scale-summary-title" className="visually-hidden">
        {t('scales.result.title')}
      </h3>
      <dl className="figures">
        <div>
          <dt>{t('scales.result.spread')}</dt>
          <dd>
            {two ? <PerHand hands={hands} value={spreadOf} word={handWord} /> : spreadOf(lead)}
            {rough && <span className="scale-rough"> {t('scales.result.rough')}</span>}
          </dd>
        </div>
        <div>
          <dt>{t('scales.result.share')}</dt>
          <dd>{two ? <PerHand hands={hands} value={shareOf} word={handWord} /> : shareOf(lead)}</dd>
        </div>
        {together ? (
          <div>
            <dt>{t('scales.result.handsApart')}</dt>
            <dd>{together.median === null ? '–' : ms(Math.abs(together.median))}</dd>
          </div>
        ) : (
          <div>
            <dt>{t('scales.result.tempo')}</dt>
            <dd>
              {tempo === null ? '–' : t('scales.result.perSecond', { n: tenth.format(tempo) })}
            </dd>
          </div>
        )}
        <div>
          <dt>{t('scales.result.wrong')}</dt>
          <dd>{counts.wrong + counts.missed + counts.extra}</dd>
        </div>
      </dl>
      <p className="help">{t('scales.result.reference')}</p>
      <p className="scale-verdict">{sentences.slice(0, MAX_SENTENCES).join(gap)}</p>
      {hands.map((hand) => (
        <ProfileChart
          key={hand.hand}
          hand={hand}
          names={names[hand.hand]}
          caption={two ? t('scales.chart.hand', { hand: handWord(hand.hand) }) : undefined}
        />
      ))}
    </section>
  );
}

/** A figure for each hand, on its own line. */
function PerHand({
  hands,
  value,
  word,
}: {
  hands: readonly HandAnalysis[];
  value: (hand: HandAnalysis) => string;
  word: (hand: Hand) => string;
}) {
  return (
    <span className="scale-per-hand">
      {hands.map((hand) => (
        <span key={hand.hand}>
          <span className="scale-per-hand-word">{word(hand.hand)}</span> {value(hand)}
        </span>
      ))}
    </span>
  );
}
