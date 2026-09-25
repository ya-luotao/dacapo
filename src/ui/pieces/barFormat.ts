import { useMemo } from 'react';
import { BAR_BUCKETS, BAR_EDGES_MS, type BarCell } from '../../core/barHeatmap.ts';
import { useI18n } from '../../i18n/index.ts';
import type { PieceFormat } from './format.ts';

/** Locale-aware wording of the bar figures. */
export function useBarFormat(format: PieceFormat) {
  const { t, locale } = useI18n();
  return useMemo(() => {
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const oneDecimal = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    const edge = (ms: number) => number.format(ms / 1000);
    const seconds = (ms: number) => t('heatmap.seconds', { value: edge(ms) });
    const band = (bucket: number) => {
      if (bucket === 0) return t('heatmap.bucket.below', { max: seconds(BAR_EDGES_MS[0]!) });
      if (bucket === BAR_BUCKETS - 1)
        return t('heatmap.bucket.above', { min: seconds(BAR_EDGES_MS.at(-1)!) });
      return t('heatmap.bucket.between', {
        min: edge(BAR_EDGES_MS[bucket - 1]!),
        max: seconds(BAR_EDGES_MS[bucket]!),
      });
    };
    /** Wrong notes per step, as marked on the bar: `×0.4`. */
    const rate = (cell: BarCell) => `×${oneDecimal.format(cell.wrongPerStep)}`;
    const bar = (cell: BarCell) => t('pieces.status.bar', { bar: format.bar(cell.measure) });
    return {
      edge,
      band,
      rate,
      bar,
      median: (cell: BarCell) =>
        cell.medianMs === null ? t('read.none') : format.seconds(cell.medianMs),
      aria: (cell: BarCell) =>
        cell.bucket === null
          ? t('pieces.weak.aria.noData', { bar: bar(cell), runs: cell.runs })
          : t('pieces.weak.aria', {
              bar: bar(cell),
              time: format.seconds(cell.medianMs!),
              band: band(cell.bucket),
              wrong: cell.wrong,
              steps: cell.steps,
              runs: cell.runs,
            }),
    };
  }, [t, locale, format]);
}

export type BarFormat = ReturnType<typeof useBarFormat>;
