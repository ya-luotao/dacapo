import { useMemo } from 'react';
import type { Stage, StageStart } from '../../core/piecePlan.ts';
import type { LoopRange } from '../../core/pieceRecords.ts';
import { useI18n, type Locale, type Translate } from '../../i18n/index.ts';
import type { PieceFormat } from './format.ts';

/** A step as it is named: its stage, and its phrase's bars (none for the whole piece). */
type Named = Pick<StageStart, 'stage' | 'bars'>;

/**
 * A piece's plan in words (docs/PIECES.md, "A piece's plan"): a stage's name as a column heads
 * it, and a step as a sentence names it ("bars 5–8, left hand", "the whole piece"). With the
 * piece's `format` its bars are named as the piece's page names them, voltas and all; without it
 * (today's plan, the Pieces page) by the printed numbers the step keeps.
 */
export function createPlanWords(t: Translate, locale: Locale, format?: PieceFormat) {
  const bars = (range: LoopRange): string => {
    if (format) return format.barSpan(range.from, range.to);
    return range.fromLabel === range.toLabel
      ? t('pieces.bar.label', { bar: range.fromLabel })
      : t('pieces.bar.span', { from: range.fromLabel, to: range.toLabel });
  };
  /** A step inside a sentence: "bars 5–8, left hand". */
  const step = (start: Named): string =>
    start.stage === 'whole' || !start.bars
      ? t('pieces.plan.step.whole')
      : t(`pieces.plan.step.${start.stage}`, { bars: bars(start.bars) });
  const capital = (text: string) => text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  return {
    step,
    /** A step where it starts a line: "Bars 5–8, left hand". */
    title: (start: Named) => capital(step(start)),
    /** A phrase where it heads its row: "Bars 5–8". */
    phrase: (range: LoopRange) => capital(bars(range)),
    /** A stage's name, as its column's heading. */
    stage: (stage: Stage): string =>
      stage === 'right' || stage === 'left'
        ? t(`pieces.hands.${stage}`)
        : t(`pieces.plan.stage.${stage}`),
  };
}

export function usePlanWords(format?: PieceFormat) {
  const { t, locale } = useI18n();
  return useMemo(() => createPlanWords(t, locale, format), [t, locale, format]);
}

export type PlanWords = ReturnType<typeof createPlanWords>;
