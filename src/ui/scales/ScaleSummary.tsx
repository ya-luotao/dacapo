import type { HandAnalysis, ProblemPlace, RunAnalysis } from '../../core/evenness.ts';
import { IN_TIME_MS, TENDENCY_MS, type RhythmSummary } from '../../core/rhythmRun.ts';
import type { ClickSettings } from '../../core/scaleClick.ts';
import type { Hand } from '../../core/score.ts';
import { SENTENCE_GAP, useI18n } from '../../i18n/index.ts';
import { fewKeys } from './format.ts';
import { weakestPlace, type LoopPlace } from './loop.ts';
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

/** With the click: the run against it (rhythm mode's figures) and the grid it was played on. */
export interface ClickResult {
  settings: ClickSettings;
  summary: RhythmSummary;
}

/**
 * After a run: how even it was (the spread of each hand, against the published professional
 * figure), how far apart the hands were, the tempo and the wrong notes, and with the click how the
 * notes sat against it; then in a few sentences, the most telling first, where it went uneven,
 * whether the notes came early or late, whether the hands and the fingers kept together, whether
 * the tempo moved and what the loudness did; then every note of each hand on a chart, and the
 * weakest place offered as a focus loop.
 */
export function ScaleSummary({
  analysis,
  names,
  end,
  pedal,
  click = null,
  onLoop,
}: {
  analysis: RunAnalysis;
  /** Each note's name as the scale spells it, per hand, by index. */
  names: NamesByHand;
  end: RunEnd | null;
  /** The sustain pedal was down during the run. */
  pedal: boolean;
  /** Played with the click. */
  click?: ClickResult | null;
  /** A focus loop round a place of the run. */
  onLoop?: (place: LoopPlace) => void;
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
  /** The first few keys, and "…" for the rest. */
  const someKeys = (hand: Hand, indexes: readonly number[]) =>
    fewKeys(
      indexes.map((i) => names[hand][i] ?? ''),
      t('app.listSeparator'),
    );
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
    const timing = t(problem.deviation > 0 ? 'scales.problem.late' : 'scales.problem.early', {
      ms: Math.round(Math.abs(problem.deviation)),
    });
    // A pattern has no crossings: its place is a note of every group (in a direction, unless
    // the pattern never turns).
    if (problem.crossing === null) {
      const hand = hands.find((h) => h.hand === problem.hand);
      const way = hand?.notes.every((n) => n.direction === 'up') ? 'any' : problem.direction;
      return forHand(
        problem.hand,
        t(`scales.problem.pattern.${way}`, {
          n: (problem.degree ?? 0) + 1,
          timing,
          keys: someKeys(problem.hand, problem.indexes),
        }),
      );
    }
    return forHand(
      problem.hand,
      t(`scales.problem.${problem.crossing}.${problem.direction}`, {
        timing,
        keys: keysOf(problem.hand, problem.indexes),
      }),
    );
  }

  /** How a hand's chords were struck: together, or which were broken. */
  function chordSentence(hand: HandAnalysis): string | null {
    const c = hand.chords;
    if (!c || c.medianSpread === null) return null;
    const text =
      c.broken.length === 0
        ? t('scales.result.chordsTogether', { ms: Math.round(c.medianSpread) })
        : c.broken.length > MAX_NAMED_GAPS || c.broken.length * 2 >= c.chords
          ? t('scales.result.chordsBrokenMany', { n: c.broken.length, total: c.chords })
          : t('scales.result.chordsBroken', { keys: keysOf(hand.hand, c.broken) });
    return forHand(hand.hand, text);
  }

  /** Whether each chord's top key stood out, by the median over the run. */
  function balanceSentence(hand: HandAnalysis): string | null {
    const c = hand.chords;
    if (!c || c.medianBalance === null || c.balanceStep === null) return null;
    const n = Math.round(Math.abs(c.medianBalance));
    const text =
      c.medianBalance >= c.balanceStep
        ? t('scales.result.topOver', { n })
        : c.medianBalance <= -c.balanceStep
          ? t('scales.result.topUnder', { n })
          : t('scales.result.balanceEven');
    return forHand(hand.hand, text);
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
  // Chords: whether they were struck together is what the exercise is for.
  for (const hand of hands) {
    const sentence = chordSentence(hand);
    if (sentence) sentences.push(sentence);
  }
  // With the click, whether the notes sat on it: what the click is there for.
  const tendency = click?.summary.tendency ?? null;
  if (click)
    sentences.push(
      tendency === null
        ? t('pieces.rhythm.noTendency')
        : Math.abs(tendency) < TENDENCY_MS
          ? t('scales.result.onBeat', { ms: TENDENCY_MS })
          : t(tendency > 0 ? 'scales.result.late' : 'scales.result.early', {
              ms: Math.round(Math.abs(tendency)),
            }),
    );
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
      const balance = balanceSentence(hand);
      if (balance) {
        sentences.push(balance);
        continue;
      }
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
  const chordRun = hands.some((h) => h.chords);
  const chordSpreadOf = (hand: HandAnalysis) =>
    hand.chords?.medianSpread == null ? '–' : ms(hand.chords.medianSpread);
  const balanceOf = (hand: HandAnalysis) => {
    const c = hand.chords;
    if (!c || c.medianBalance === null || c.balanceStep === null) return '–';
    const n = Math.round(Math.abs(c.medianBalance));
    return c.medianBalance >= c.balanceStep
      ? t('scales.result.topLouder', { n })
      : c.medianBalance <= -c.balanceStep
        ? t('scales.result.topSofter', { n })
        : t('scales.result.topEven');
  };
  const weakest = onLoop ? weakestPlace(analysis) : null;
  const clicked = click?.summary;

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
        {chordRun && (
          <div>
            <dt>{t('scales.result.chordSpread')}</dt>
            <dd>
              {two ? (
                <PerHand hands={hands} value={chordSpreadOf} word={handWord} />
              ) : (
                chordSpreadOf(lead)
              )}
            </dd>
          </div>
        )}
        {chordRun && analysis.velocityMeasured && (
          <div>
            <dt>{t('scales.result.topNote')}</dt>
            <dd>
              {two ? <PerHand hands={hands} value={balanceOf} word={handWord} /> : balanceOf(lead)}
            </dd>
          </div>
        )}
      </dl>
      {click && clicked && (
        <dl className="figures scale-click-figures">
          <div>
            <dt>{t('scales.result.clickTendency')}</dt>
            <dd>
              {tendency === null
                ? '–'
                : Math.abs(tendency) < TENDENCY_MS
                  ? t('scales.result.onTheBeat')
                  : t(tendency > 0 ? 'scales.problem.late' : 'scales.problem.early', {
                      ms: Math.round(Math.abs(tendency)),
                    })}
            </dd>
          </div>
          <div>
            <dt>{t('pieces.rhythm.inTime', { ms: IN_TIME_MS })}</dt>
            <dd>
              {clicked.notes === 0
                ? '–'
                : t('scales.result.percent', {
                    percent: whole.format((100 * clicked.inTime) / clicked.notes),
                  })}
            </dd>
          </div>
          <div>
            <dt>{t('scales.result.clickTempo')}</dt>
            <dd>
              {t('scales.result.clickGrid', {
                bpm: click.settings.bpm,
                n: click.settings.perBeat,
              })}
            </dd>
          </div>
        </dl>
      )}
      <p className="help">{t('scales.result.reference')}</p>
      <p className="scale-verdict">{sentences.slice(0, MAX_SENTENCES).join(gap)}</p>
      {weakest && onLoop && (
        <p className="scale-loop-offer">
          <button type="button" className="button is-compact" onClick={() => onLoop(weakest)}>
            {t('scales.loop.around', { key: names[weakest.hand][weakest.index] ?? '' })}
          </button>
          <span className="muted">{t('scales.loop.offer')}</span>
        </p>
      )}
      {hands.map((hand) => (
        <ProfileChart
          key={hand.hand}
          hand={hand}
          names={names[hand.hand]}
          caption={
            two
              ? t(hand.chords ? 'scales.chart.hand.chords' : 'scales.chart.hand', {
                  hand: handWord(hand.hand),
                })
              : undefined
          }
          onLoop={onLoop && ((index) => onLoop({ hand: hand.hand, index }))}
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
