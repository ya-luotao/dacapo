import { useMemo } from 'react';
import type { Measure } from '../../core/score.ts';
import { useI18n } from '../../i18n/index.ts';
import type { PieceLevel } from '../../pieces/library/index.ts';

/** Locale-aware labels and figures for the Pieces routes. */
export function usePieceFormat(measures: readonly Measure[] = []) {
  const { t, locale } = useI18n();
  return useMemo(() => {
    // Printed numbers can repeat (a second movement starting at 1); then the position tells.
    const count = new Map<string, number>();
    for (const m of measures) count.set(m.number, (count.get(m.number) ?? 0) + 1);
    const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
    const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
    /** The printed bar number, made unique: short, for the bar pickers. */
    const barNumber = (index: number) => {
      const m = measures[index];
      if (!m) return String(index + 1);
      return (count.get(m.number) ?? 0) > 1
        ? t('pieces.bar.nth', { bar: m.number, n: index + 1 })
        : m.number;
    };
    return {
      barNumber,
      /** The bar number with its volta, for the status line and summaries. */
      bar: (index: number) => {
        const m = measures[index];
        const bar = barNumber(index);
        return m && m.repeat.ending.length > 0
          ? t('pieces.bar.ending', { bar, n: m.repeat.ending.join(', ') })
          : bar;
      },
      level: (level: PieceLevel) =>
        level === 0 ? t('pieces.level.0') : t('pieces.level.n', { n: level }),
      beat: (beat: number) => decimal.format(beat),
      seconds: (ms: number) => t('read.seconds', { value: decimal.format(ms / 1000) }),
      date: (epochMs: number) => date.format(epochMs),
    };
  }, [t, locale, measures]);
}
