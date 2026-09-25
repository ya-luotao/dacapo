import { useMemo } from 'react';
import { BAR_BUCKETS, metricScale, type BarCell, type BarMetric } from '../../core/barHeatmap.ts';
import { useI18n } from '../../i18n/index.ts';
import type { PieceFormat } from './format.ts';

/** Locale-aware wording of the bar figures, in seconds (hesitation) or milliseconds (timing). */
export function useBarFormat(format: PieceFormat, metric: BarMetric = 'hesitation') {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const { edges } = metricScale(metric);
    const timing = metric === 'timing';
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const oneDecimal = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    /** An edge of the scale, as a bare number in the legend's unit. */
    const edge = (ms: number) => (timing ? whole.format(ms) : number.format(ms / 1000));
    const unit = (ms: number) =>
      timing ? t('pieces.ms', { value: edge(ms) }) : t('heatmap.seconds', { value: edge(ms) });
    const band = (bucket: number) => {
      if (bucket === 0) return t('heatmap.bucket.below', { max: unit(edges[0]!) });
      if (bucket === BAR_BUCKETS - 1)
        return t('heatmap.bucket.above', { min: unit(edges.at(-1)!) });
      return t('heatmap.bucket.between', {
        min: edge(edges[bucket - 1]!),
        max: unit(edges[bucket]!),
      });
    };
    /** Wrong (timing: missed and extra) notes per step or note, as marked on the bar: `×0.4`. */
    const rate = (cell: BarCell) => `×${oneDecimal.format(cell.wrongPerStep)}`;
    /** The bar as a title, for the tooltip and the accessible name. */
    const bar = (cell: BarCell) => format.barTitle(cell.measure);
    /** The bar's number with its volta, for the table under a "Bar" header. */
    const short = (cell: BarCell) => format.barShort(cell.measure);
    /** The bar's median: time per step, or distance from the beat. */
    const value = (ms: number) =>
      timing ? t('pieces.ms', { value: whole.format(ms) }) : format.seconds(ms);
    const median = (cell: BarCell) =>
      cell.medianMs !== null
        ? value(cell.medianMs)
        : timing && cell.steps > 0
          ? t('pieces.weak.allMissed')
          : t('read.none');
    return {
      metric,
      edge,
      band,
      rate,
      bar,
      short,
      value,
      median,
      aria: (cell: BarCell) =>
        cell.bucket === null
          ? t('pieces.weak.aria.noData', { bar: bar(cell), runs: cell.runs })
          : t(timing ? 'pieces.weak.aria.timing' : 'pieces.weak.aria', {
              bar: bar(cell),
              time: median(cell),
              band: band(cell.bucket),
              wrong: cell.wrong,
              steps: cell.steps,
              runs: cell.runs,
            }),
    };
  }, [t, locale, format, metric]);
}

export type BarFormat = ReturnType<typeof useBarFormat>;
