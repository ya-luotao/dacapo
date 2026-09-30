import { useMemo } from 'react';
import type {
  BalanceVerdict,
  DynamicsJudgement,
  DynamicsProblem,
  Verdict,
} from '../../core/expression.ts';
import type { Hand } from '../../core/score.ts';
import { useT, type Translate } from '../../i18n/index.ts';
import type { PieceFormat } from './format.ts';

// Every judged marking in words (docs/EXPRESSION.md, "UI": colour is never the only sign): what
// the marking is, and whether it was played right, too little, too much, the wrong way round or
// missed. The arrow says which way the marking asks to go.

/** The glyph of a bar's balance, beside its words in the legend and the table. */
export const BALANCE_GLYPH: Record<BalanceVerdict, string> = {
  balanced: '▲',
  equal: '=',
  under: '▼',
};

/** How a verdict is shown: its words and the class that colours it (also in words). */
export interface VerdictLabel {
  text: string;
  tone: 'ok' | 'warn' | 'bad';
}

export function createExpressionWords(t: Translate, format: PieceFormat) {
  const hand = (h: Hand) => t(`pieces.expression.hand.${h}`);

  const marking = (j: DynamicsJudgement): string => {
    switch (j.kind) {
      case 'level':
        return t('pieces.expression.level', { from: j.from, to: j.to });
      case 'hairpin':
        return t(`pieces.expression.${j.hairpin}`, { hand: hand(j.hand) });
      case 'accent':
        return j.mark === 'accent' || j.mark === 'strong-accent'
          ? t(`pieces.expression.${j.mark}`, { hand: hand(j.hand) })
          : t('pieces.expression.accentMark', { mark: j.mark, hand: hand(j.hand) });
    }
  };

  /** The way the marking asks to go: louder or softer. */
  const louder = (j: DynamicsJudgement) =>
    j.kind === 'level' ? j.levels > 0 : j.kind === 'hairpin' ? j.hairpin === 'crescendo' : true;

  const verdict = (j: DynamicsJudgement): VerdictLabel => {
    const way = louder(j) ? 'louder' : 'softer';
    const v: Verdict = j.verdict;
    switch (v) {
      case 'right':
        return { text: t('pieces.expression.verdict.right'), tone: 'ok' };
      case 'too-little':
        return { text: t(`pieces.expression.verdict.tooLittle.${way}`), tone: 'warn' };
      case 'too-much':
        return { text: t(`pieces.expression.verdict.tooMuch.${way}`), tone: 'warn' };
      case 'wrong-way':
        return {
          text: t(
            j.kind === 'accent'
              ? 'pieces.expression.verdict.notAccented'
              : `pieces.expression.verdict.wrongWay.${way}`,
          ),
          tone: 'bad',
        };
      case 'missed':
        return { text: t('pieces.expression.verdict.missed'), tone: 'bad' };
    }
  };

  /** Where a marking is: its bars, the beat when it starts inside a bar, a repeat's pass. */
  const bars = (j: Pick<DynamicsJudgement, 'bars' | 'beat' | 'pass'>) => {
    let where = format.barSpan(j.bars.from, j.bars.to);
    if (j.bars.from === j.bars.to && Math.abs(j.beat - 1) > 1e-6)
      where = t('pieces.expression.atBeat', { bar: where, beat: format.beat(j.beat) });
    return j.pass > 1 ? t('pieces.status.barRepeat', { bar: where }) : where;
  };

  const balance = (v: BalanceVerdict) => t(`pieces.expression.balance.${v}`);

  const problem = (p: DynamicsProblem) =>
    p.kind === 'marking'
      ? t('pieces.expression.problem', {
          marking: marking(p.judgement),
          where: bars(p.judgement),
          verdict: verdict(p.judgement).text,
        })
      : t('pieces.expression.problem.balance', { verdict: balance(p.bar.verdict) });

  return { hand, marking, verdict, bars, balance, problem };
}

export type ExpressionWords = ReturnType<typeof createExpressionWords>;

export function useExpressionWords(format: PieceFormat): ExpressionWords {
  const t = useT();
  return useMemo(() => createExpressionWords(t, format), [t, format]);
}
