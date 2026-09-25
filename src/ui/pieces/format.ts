import { useMemo } from 'react';
import type { Measure } from '../../core/score.ts';
import { useI18n, type Locale, type Translate } from '../../i18n/index.ts';
import type { PieceLevel } from '../../pieces/library/index.ts';

type BarFacts = Pick<Measure, 'number' | 'repeat'>;

/**
 * Labels and figures for the Pieces routes. A bar label is one template per language, so each
 * language puts its word for "bar" and the volta or position note in its own order.
 */
export function createPieceFormat(t: Translate, locale: Locale, measures: readonly BarFacts[]) {
  // Printed numbers can repeat (a second movement starting at 1); then the position tells.
  const count = new Map<string, number>();
  for (const m of measures) count.set(m.number, (count.get(m.number) ?? 0) + 1);
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  const facts = (index: number) => {
    const m = measures[index];
    if (!m) return { bar: String(index + 1), nth: false, ending: '' };
    return {
      bar: m.number,
      nth: (count.get(m.number) ?? 0) > 1,
      ending: m.repeat.ending.join(t('app.listSeparator')),
    };
  };

  /** The printed bar number, made unique: for the bar pickers. */
  const barNumber = (index: number) => {
    const { bar, nth } = facts(index);
    return nth ? t('pieces.bar.number.nth', { bar, n: index + 1 }) : bar;
  };

  /** The number with its volta: for table cells under a "Bar" header and for ranges. */
  const barShort = (index: number) => {
    const { bar, nth, ending } = facts(index);
    const n = index + 1;
    if (ending && nth) return t('pieces.bar.number.nthEnding', { bar, n, ending });
    if (ending) return t('pieces.bar.number.ending', { bar, ending });
    return nth ? t('pieces.bar.number.nth', { bar, n }) : bar;
  };

  /** The bar with its word, volta and position, as it reads inside a sentence ("bar 12"). */
  const barLabel = (index: number) => {
    const { bar, nth, ending } = facts(index);
    const n = index + 1;
    if (ending && nth) return t('pieces.bar.label.nthEnding', { bar, n, ending });
    if (ending) return t('pieces.bar.label.ending', { bar, ending });
    return nth ? t('pieces.bar.label.nth', { bar, n }) : t('pieces.bar.label', { bar });
  };

  /** The bar label at the start of a line or a title ("Bar 12"). */
  const barTitle = (index: number) => {
    const label = barLabel(index);
    return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
  };

  return {
    barNumber,
    barShort,
    barLabel,
    barTitle,
    /** The status line's bar, marked on a repeat's later passes unless its volta already says so. */
    barStatus: (index: number, pass: number) =>
      pass > 1 && !facts(index).ending
        ? t('pieces.status.barRepeat', { bar: barTitle(index) })
        : barTitle(index),
    /**
     * Bars `from`–`to` inside a sentence: "bars 8–12", or bar label to bar label when either end
     * has a volta or a position, so each keeps its note in the language's order.
     */
    barSpan: (from: number, to: number) => {
      if (from === to) return barLabel(from);
      const a = facts(from);
      const b = facts(to);
      return a.ending || a.nth || b.ending || b.nth
        ? t('pieces.bar.span.labels', { from: barLabel(from), to: barLabel(to) })
        : t('pieces.bar.span', { from: a.bar, to: b.bar });
    },
    /** Written bars `from`–`to`, by their printed numbers: for the weak-bar loop button. */
    barRange: (from: number, to: number) =>
      from === to
        ? barNumber(from)
        : t('pieces.bar.range', { from: barNumber(from), to: barNumber(to) }),
    level: (level: PieceLevel) =>
      level === 0 ? t('pieces.level.0') : t('pieces.level.n', { n: level }),
    beat: (beat: number) => decimal.format(beat),
    seconds: (ms: number) => t('read.seconds', { value: decimal.format(ms / 1000) }),
    date: (epochMs: number) => date.format(epochMs),
  };
}

/** Locale-aware labels and figures for the Pieces routes. */
export function usePieceFormat(measures: readonly Measure[] = []) {
  const { t, locale } = useI18n();
  return useMemo(() => createPieceFormat(t, locale, measures), [t, locale, measures]);
}

export type PieceFormat = ReturnType<typeof createPieceFormat>;
