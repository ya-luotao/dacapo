import { useEffect, useRef, type ReactNode } from 'react';
import type { AdviceAction, PieceAdvice, ReviewLine } from '../../core/advice.ts';
import {
  IN_TIME_MS,
  loopableDrift,
  TENDENCY_MS,
  type RhythmStretch,
  type RhythmSummary as Summary,
} from '../../core/rhythmRun.ts';
import { SENTENCE_GAP, useI18n } from '../../i18n/index.ts';
import { Advice } from '../Advice.tsx';
import { usePieceAdviceWords } from './adviceWords.ts';
import { DeviationChart } from './DeviationChart.tsx';
import type { PieceFormat } from './format.ts';
import { PlayBackButton } from './PlayBackButton.tsx';
import { SaveMidiButton } from './SaveMidiButton.tsx';

interface RhythmSummaryProps {
  summary: Summary;
  /** Played to the end (not stopped). */
  done: boolean;
  /** A loop, which only ends with Stop. */
  looped: boolean;
  format: PieceFormat;
  onAgain: () => void;
  /** Loop the written bars of a stretch. */
  onLoopBars: (from: number, to: number) => void;
  onClose: () => void;
  /** What to work on next, and what the run did to the piece's review (docs/ADVICE.md). */
  advice?: PieceAdvice | null;
  review?: ReviewLine | null;
  onAdvice?: (action: AdviceAction) => void;
  /** The run's Expression panel. */
  expression?: ReactNode;
  /** Plays the run back (absent when nothing of it was kept). */
  onPlayBack?: () => void;
  /** Saves the run as a MIDI file (absent when nothing of it was kept). */
  onSaveMidi?: () => void;
}

/** The end of a rhythm run: the figures, the tendency, where the tempo moved, and every note. */
export function RhythmSummary({
  summary,
  done,
  looped,
  format,
  onAgain,
  onLoopBars,
  onClose,
  advice = null,
  review = null,
  onAdvice,
  expression,
  onPlayBack,
  onSaveMidi,
}: RhythmSummaryProps) {
  const { t, locale } = useI18n();
  const words = usePieceAdviceWords(format);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const gap = SENTENCE_GAP[locale];
  const share = (n: number) =>
    t('pieces.rhythm.percent', {
      percent: percent.format(summary.notes === 0 ? 0 : (100 * n) / summary.notes),
    });

  const bars = (s: RhythmStretch) => {
    const span = format.barSpan(s.from.measure, s.to.measure);
    if (summary.rounds === 1) return span;
    if (s.from.round === s.to.round)
      return t('pieces.rhythm.barsRound', { bars: span, n: s.from.round + 1 });
    return t('pieces.rhythm.barsAcross', {
      from: format.barLabel(s.from.measure),
      to: format.barLabel(s.to.measure),
      n: s.from.round + 1,
      m: s.to.round + 1,
    });
  };
  // The advice's button is the summary's primary one; "Again" steps down beside it.
  const said = advice && words.advice(advice);
  const action = advice?.action ?? null;
  // A stretch that can be looped has its button here, unless looping it is the advice.
  const loopable = advice?.rule === 'drift' ? null : loopableDrift(summary);

  return (
    <section
      className="piece-summary rhythm-summary"
      aria-labelledby="rhythm-summary-title"
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onClose();
      }}
    >
      <div className="rhythm-summary-head">
        <h2 id="rhythm-summary-title" ref={heading} tabIndex={-1}>
          {done
            ? t('pieces.rhythm.done')
            : looped
              ? t('pieces.done.loop')
              : t('pieces.rhythm.stopped')}
        </h2>
        <div className="actions">
          <button
            type="button"
            className={said?.label ? 'button is-compact' : 'button button-primary is-compact'}
            onClick={onAgain}
          >
            {t('pieces.rhythm.again')}
          </button>
          {loopable && (
            <button
              type="button"
              className="button is-compact"
              onClick={() => onLoopBars(loopable.from.measure, loopable.to.measure)}
            >
              {loopable.from.measure === loopable.to.measure
                ? t('pieces.done.loopBar', { bar: format.barLabel(loopable.from.measure) })
                : t('pieces.rhythm.loopBars', {
                    bars: format.barSpan(loopable.from.measure, loopable.to.measure),
                  })}
            </button>
          )}
          {onPlayBack && <PlayBackButton onClick={onPlayBack} compact />}
          {onSaveMidi && <SaveMidiButton onClick={onSaveMidi} compact />}
          <button type="button" className="button is-compact" onClick={onClose}>
            {t('pieces.weak.table.close')}
          </button>
        </div>
      </div>
      <dl className="figures">
        <div>
          <dt>{t('pieces.rhythm.hits')}</dt>
          <dd>{share(summary.hits)}</dd>
        </div>
        <div>
          <dt>{t('pieces.rhythm.inTime', { ms: IN_TIME_MS })}</dt>
          <dd>{share(summary.inTime)}</dd>
        </div>
        <div>
          <dt>{t('pieces.rhythm.missed')}</dt>
          <dd>{summary.missed}</dd>
        </div>
        <div>
          <dt>{t('pieces.rhythm.extra')}</dt>
          <dd>{summary.extra}</dd>
        </div>
      </dl>
      <p className="rhythm-verdict">
        <Tendency tendency={summary.tendency} />
        {gap}
        {summary.drift.length === 0
          ? summary.tendency !== null && t('pieces.rhythm.steady')
          : summary.wholeRun
            ? t(
                summary.drift[0]!.direction === 'faster'
                  ? 'pieces.rhythm.faster.whole'
                  : 'pieces.rhythm.slower.whole',
                { ms: Math.round(Math.abs(summary.drift[0]!.change)) },
              )
            : summary.drift
                .map((s) =>
                  t(s.direction === 'faster' ? 'pieces.rhythm.faster' : 'pieces.rhythm.slower', {
                    bars: bars(s),
                  }),
                )
                .join(gap)}
      </p>
      <Advice
        text={said?.text ?? null}
        note={review && words.review(review)}
        action={
          said?.label && action && onAdvice
            ? { label: said.label, onClick: () => onAdvice(action) }
            : null
        }
        compact
      />
      <DeviationChart summary={summary} format={format} />
      <p className="help">{t('pieces.rhythm.saved')}</p>
      {expression}
    </section>
  );
}

function Tendency({ tendency }: { tendency: number | null }) {
  const { t } = useI18n();
  if (tendency === null) return t('pieces.rhythm.noTendency');
  const ms = Math.round(Math.abs(tendency));
  if (Math.abs(tendency) < TENDENCY_MS) return t('pieces.rhythm.onBeat', { ms: TENDENCY_MS });
  return t(tendency > 0 ? 'pieces.rhythm.late' : 'pieces.rhythm.early', { ms });
}
