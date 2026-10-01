import { useMemo } from 'react';
import type { AdviceAction, PieceAdvice, ReviewLine } from '../../core/advice.ts';
import { SENTENCE_GAP, useI18n } from '../../i18n/index.ts';
import type { PieceFormat } from './format.ts';

/** An advice in words: its sentence, and what its button says (null without one). */
export interface AdviceWords {
  text: string;
  label: string | null;
}

/**
 * The words of a piece's advice and of the review line (docs/ADVICE.md): each rule its sentence,
 * with the figure it rests on, and each action its button's label.
 */
export function usePieceAdviceWords(format: PieceFormat): {
  advice: (advice: PieceAdvice) => AdviceWords;
  review: (line: ReviewLine) => string;
} {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const gap = SENTENCE_GAP[locale];
    const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const tempo = (percent: number) => t('pieces.tempo.percent', { percent });
    const tendencyMs = (ms: number) => Math.round(Math.abs(ms));

    function label(action: AdviceAction | null): string | null {
      switch (action?.kind) {
        case 'hands':
          return t(`pieces.hands.${action.hands}`);
        case 'loop':
          return action.from === action.to
            ? t('pieces.done.loopBar', { bar: format.barLabel(action.from) })
            : t('pieces.rhythm.loopBars', { bars: format.barSpan(action.from, action.to) });
        case 'rhythm':
          return t('pieces.advice.rhythmAt', { tempo: tempo(action.tempo) });
        case 'stage':
          return t(`pieces.memory.stage.${action.stage}`);
        case 'tempo':
          return t('pieces.advice.againAt', { tempo: tempo(action.tempo) });
        case 'calibrate':
          return t('pieces.latency.calibrate');
        default:
          return null;
      }
    }

    function sentence(advice: PieceAdvice): string {
      switch (advice.rule) {
        case 'oneHand':
          return t('pieces.advice.wrong.hands', { wrong: advice.wrong, steps: advice.steps });
        case 'fewBars':
          return t('pieces.advice.wrong.bars', { wrong: advice.wrong, steps: advice.steps });
        case 'slowBar':
          return t('pieces.advice.slowBar', { bar: format.barTitle(advice.measure) });
        case 'promptedBar':
          return advice.prompts === 1
            ? t('pieces.advice.prompts.one', { bar: format.barTitle(advice.measure) })
            : t('pieces.advice.prompts.other', {
                bar: format.barTitle(advice.measure),
                n: advice.prompts,
              });
        case 'toRhythm':
          return [
            t('pieces.advice.clean'),
            t('pieces.advice.clean.rhythm', { tempo: tempo(advice.tempo) }),
          ].join(gap);
        case 'toStage':
          return [t('pieces.advice.clean'), t('pieces.advice.clean.memory')].join(gap);
        case 'missed': {
          const values = {
            n: advice.missed,
            notes: advice.notes,
            tempo: tempo(advice.tempo),
            lower: tempo(advice.action.tempo),
          };
          return advice.extra === 0
            ? t('pieces.advice.missed', values)
            : t('pieces.advice.missed.extra', { ...values, extra: advice.extra });
        }
        case 'notInTime':
          return t('pieces.advice.notInTime', {
            // The summary's own figure, as it shows it.
            percent: t('pieces.rhythm.percent', {
              percent: whole.format((100 * advice.inTime) / advice.notes),
            }),
            tempo: tempo(advice.tempo),
            lower: tempo(advice.action.tempo),
          });
        case 'drift': {
          const { from, to } = advice.action;
          return t(`pieces.advice.${advice.direction}.${from === to ? 'bar' : 'bars'}`, {
            bars: format.barSpan(from, to),
          });
        }
        case 'tendency':
          return advice.action
            ? t('pieces.advice.late.calibrate', { ms: tendencyMs(advice.ms) })
            : t(advice.ms > 0 ? 'pieces.advice.late' : 'pieces.advice.early', {
                ms: tendencyMs(advice.ms),
              });
        case 'nextTempo':
          return t('pieces.advice.inTime.next', {
            tempo: tempo(advice.tempo),
            next: tempo(advice.action.tempo),
          });
        case 'scoreTempo':
          return t('pieces.advice.inTime.score');
      }
    }

    return {
      advice: (advice) => ({ text: sentence(advice), label: label(advice.action) }),
      review: (line) =>
        line.kind === 'new'
          ? t('pieces.advice.review.new')
          : line.days === 1
            ? t(`pieces.advice.review.${line.kind}.one`)
            : t(`pieces.advice.review.${line.kind}.other`, { n: line.days }),
    };
  }, [t, locale, format]);
}
