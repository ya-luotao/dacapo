import { useMemo } from 'react';
import { SPEED_BUCKETS, SPEED_EDGES_MS, type Figures } from '../../../core/heatmap.ts';
import { isBlack, midiName } from '../../../core/note.ts';
import { useI18n } from '../../../i18n/index.ts';
import { useReadFormat } from '../../read/format.ts';

/** CSS colour of a speed bucket (tokens in styles.css). */
export const heatColor = (bucket: number) => `var(--heat-${bucket})`;

/** Locale-aware wording of the heatmap's figures. */
export function useHeatFormat() {
  const { t, locale } = useI18n();
  const read = useReadFormat();
  return useMemo(() => {
    const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    const edge = (ms: number) => number.format(ms / 1000);
    const seconds = (ms: number) => t('heatmap.seconds', { value: edge(ms) });

    /** The range of a speed bucket, e.g. `1–1.5 s`. */
    const band = (bucket: number) => {
      if (bucket === 0) return t('heatmap.bucket.below', { max: seconds(SPEED_EDGES_MS[0]!) });
      if (bucket === SPEED_BUCKETS - 1)
        return t('heatmap.bucket.above', { min: seconds(SPEED_EDGES_MS.at(-1)!) });
      return t('heatmap.bucket.between', {
        min: edge(SPEED_EDGES_MS[bucket - 1]!),
        max: seconds(SPEED_EDGES_MS[bucket]!),
      });
    };

    const ratioWith =
      (key: 'heatmap.details.ratio' | 'heatmap.table.ratio') => (part: number, whole: number) =>
        whole === 0
          ? t('read.none')
          : t(key, { percent: read.percent(part / whole), correct: part, count: whole });
    const ratio = ratioWith('heatmap.details.ratio');

    return {
      edge,
      band,
      ratio,
      /** `ratio` for table cells: `75% (3/4)`. */
      shortRatio: ratioWith('heatmap.table.ratio'),
      /** `band` for coloured cells, "not enough data" otherwise. */
      bandOf: (figures: Figures) =>
        figures.bucket === null ? t('heatmap.legend.noData') : band(figures.bucket),
      /** `C♯4 / D♭4 key` */
      keyName: (midi: number) =>
        t('heatmap.key.name', {
          name: isBlack(midi) ? `${midiName(midi)} / ${midiName(midi, 'flat')}` : midiName(midi),
        }),
      /** Everything about a cell in one sentence, for screen readers. */
      aria: (name: string, figures: Figures) => {
        const vars = {
          note: name,
          recent: figures.recentCorrect,
          count: figures.recentCount,
          attempts: figures.attempts,
        };
        return figures.bucket === null
          ? t('heatmap.aria.noData', vars)
          : t('heatmap.aria.timed', {
              ...vars,
              time: read.seconds(figures.ewmaMs),
              band: band(figures.bucket),
            });
      },
    };
  }, [t, locale, read]);
}

export type HeatFormat = ReturnType<typeof useHeatFormat>;
