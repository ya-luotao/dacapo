import { useMemo } from 'react';
import type {
  ArticulationSlip,
  ArticulationVerdict,
  BalanceVerdict,
  CordaJudgement,
  DynamicsJudgement,
  DynamicsProblem,
  OrnamentJudgement,
  PedalJudgement,
  PedalProblem,
  Touch,
  Verdict,
} from '../../core/expression.ts';
import { formatPitch, midiName } from '../../core/note.ts';
import type { Hand } from '../../core/score.ts';
import { useI18n, type Translate } from '../../i18n/index.ts';
import type { PieceFormat } from './format.ts';

// Every judged marking in words (docs/EXPRESSION.md, "UI": colour is never the only sign): what
// the marking is, and whether it was played right, too little, too much, the wrong way round or
// missed. The arrow says which way the marking asks to go. And how each note was held against its
// touch: legato joined, broken or smudged, staccato short or held too long, tenuto held or not, a
// plain note held or cut short.

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

/** A note as written, or by its key when the spelling has no symbol here (a double sharp). */
function spelled({ midi, pitch }: Pick<OrnamentJudgement, 'midi' | 'pitch'>): string {
  const accidental = pitch.alter;
  return accidental === -1 || accidental === 0 || accidental === 1
    ? formatPitch({ letter: pitch.step, accidental, octave: pitch.octave })
    : midiName(midi);
}

/** Keys named in the spelling of the note they decorate: flats beside a flat. */
export function keyNames(keys: readonly number[], j: Pick<OrnamentJudgement, 'pitch'>): string {
  return keys.map((k) => midiName(k, j.pitch.alter < 0 ? 'flat' : 'sharp')).join(' ');
}

export function createExpressionWords(t: Translate, format: PieceFormat, locale: string) {
  const hand = (h: Hand) => t(`pieces.expression.hand.${h}`);
  const percentFormat = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  const percent = (share: number) => percentFormat.format(share);

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

  /** A bar played, for a table row: with its round when a loop went round. */
  const barRow = (bar: { measure: number; round: number }, rounds: number) =>
    rounds > 1
      ? t('pieces.rhythm.table.round', { bar: format.barShort(bar.measure), n: bar.round + 1 })
      : format.barShort(bar.measure);

  const touch = (x: Touch) => t(`pieces.expression.touch.${x}`);

  const held = (v: ArticulationVerdict): VerdictLabel =>
    v === 'right'
      ? { text: t('pieces.expression.verdict.right'), tone: 'ok' }
      : { text: t(`pieces.expression.held.${v}`), tone: 'warn' };

  const slip = (x: ArticulationSlip) =>
    t(x.count === 1 ? 'pieces.expression.slip.one' : 'pieces.expression.slip.other', {
      touch: touch(x.touch),
      verdict: held(x.verdict).text,
      n: x.count,
    });

  /** A pedal mark: down, a change, up, a lift inside a span, una corda or sostenuto. */
  const pedalMark = (j: PedalJudgement | CordaJudgement) =>
    'pedal' in j
      ? t(`pieces.expression.pedal.mark.${j.pedal}`)
      : t(`pieces.expression.pedal.mark.${j.mark}`);

  const pedalVerdict = (j: PedalJudgement | CordaJudgement): VerdictLabel => {
    if ('pedal' in j)
      return j.verdict === 'held'
        ? { text: t('pieces.expression.pedal.verdict.held'), tone: 'ok' }
        : j.verdict === 'partly'
          ? {
              text: t('pieces.expression.pedal.verdict.partly', { percent: percent(j.share) }),
              tone: 'warn',
            }
          : { text: t('pieces.expression.pedal.verdict.missed'), tone: 'bad' };
    const ms = Math.round(j.ms ?? 0);
    switch (j.verdict) {
      case 'clean':
        return { text: t('pieces.expression.pedal.verdict.clean'), tone: 'ok' };
      case 'gap':
        return { text: t('pieces.expression.pedal.verdict.gap', { ms }), tone: 'warn' };
      case 'blur':
        return { text: t('pieces.expression.pedal.verdict.blur', { ms }), tone: 'warn' };
      case 'missed':
        return { text: t('pieces.expression.pedal.verdict.missed'), tone: 'bad' };
    }
  };

  /** An ornament on its note, spelled as written: "Mordent on B♭4". */
  const ornament = (j: OrnamentJudgement) =>
    t('pieces.expression.ornaments.on', {
      kind: t(`pieces.expression.ornaments.kind.${j.kind}`),
      note: spelled(j),
    });

  const ornamentVerdict = (j: OrnamentJudgement): VerdictLabel =>
    j.verdict === 'played'
      ? { text: t('pieces.expression.ornaments.verdict.played'), tone: 'ok' }
      : j.verdict === 'incomplete'
        ? {
            text: t('pieces.expression.ornaments.verdict.incomplete', {
              n: j.heard.length,
              total: j.keys.length,
            }),
            tone: 'warn',
          }
        : { text: t('pieces.expression.ornaments.verdict.left-out'), tone: 'bad' };

  const ornamentProblem = (j: OrnamentJudgement) =>
    t('pieces.expression.problem', {
      marking: ornament(j),
      where: bars(j),
      verdict: ornamentVerdict(j).text,
    });

  const pedalProblem = (p: PedalProblem) =>
    t('pieces.expression.problem', {
      marking: pedalMark(p.judgement),
      where: bars(p.judgement),
      verdict: pedalVerdict(p.judgement).text,
    });

  return {
    hand,
    marking,
    verdict,
    bars,
    balance,
    problem,
    barRow,
    touch,
    held,
    slip,
    pedalMark,
    pedalVerdict,
    pedalProblem,
    ornament,
    ornamentVerdict,
    ornamentProblem,
  };
}

export type ExpressionWords = ReturnType<typeof createExpressionWords>;

export function useExpressionWords(format: PieceFormat): ExpressionWords {
  const { t, locale } = useI18n();
  return useMemo(() => createExpressionWords(t, format, locale), [t, format, locale]);
}
