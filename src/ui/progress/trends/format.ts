import { useMemo } from 'react';
import type { FamilyLevelId } from '../../../core/answerProgress.ts';
import { isLevelId } from '../../../core/levels.ts';
import { isSightLevelId } from '../../../core/sightLevels.ts';
import type { TrendPractice, TrendRule } from '../../../core/trends.ts';
import { useI18n } from '../../../i18n/index.ts';
import { useFamilyFormat } from '../families/format.tsx';
import { useReadFormat } from '../../read/format.ts';

/** The figures of the trends in the reader's language, each with its unit. */
export function useTrendFormat() {
  const { t, locale } = useI18n();
  const read = useReadFormat();
  const family = useFamilyFormat();
  return useMemo(() => {
    const tenth = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1 });
    const whole = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
    const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });

    /** A week's or a period's figure: `1.4 s`, `86%`, `18 ms`, `6.2%`. */
    const value = (practice: TrendPractice, v: number): string => {
      switch (practice) {
        case 'reading':
          return read.seconds(v);
        case 'inTime':
          return t('scales.result.ms', { ms: Math.round(v) });
        case 'scales':
          // A spread share is in % already; a tenth shows a change of 5 % of it.
          return tenth.format(v / 100);
        default:
          return read.percent(v);
      }
    };

    /** `64 answers`, `1 run`, `320 notes`. */
    const count = (rule: TrendRule, n: number): string => {
      switch (rule.unit) {
        case 'runs':
          return n === 1 ? t('progress.session.runs.one') : t('progress.session.runs.other', { n });
        case 'notes':
          return n === 1 ? t('trends.count.notes.one') : t('trends.count.notes.other', { n });
        default:
          return n === 1 ? t('trends.count.answers.one') : t('trends.count.answers.other', { n });
      }
    };

    const levelName = (id: string): string => {
      if (isLevelId(id)) return t(`read.level.${id}`);
      if (isSightLevelId(id)) return t(`sight.level.${id}`);
      return family.levelName(id as FamilyLevelId);
    };

    /** An axis tick: as `value`, a whole spread share without its tenth. */
    const tick = (practice: TrendPractice, v: number): string =>
      practice === 'scales' && Number.isInteger(v) ? whole.format(v / 100) : value(practice, v);

    return {
      value,
      tick,
      count,
      levelName,
      list: (items: readonly string[]) => list.format(items),
    };
  }, [t, locale, read, family]);
}

export type TrendFormat = ReturnType<typeof useTrendFormat>;
