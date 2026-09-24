import { SPEED_BUCKETS, SPEED_EDGES_MS } from '../../../core/heatmap.ts';
import { TARGET_MS } from '../../../core/weakness.ts';
import { useT } from '../../../i18n/index.ts';
import { heatColor, useHeatFormat } from './format.ts';

const BUCKETS = Array.from({ length: SPEED_BUCKETS }, (_, i) => i);
const TARGET_EDGE = SPEED_EDGES_MS.indexOf(TARGET_MS);

/** A small sample of a bucket's colour, or the hollow "not enough data" mark. */
export function Swatch({ bucket }: { bucket: number | null }) {
  return (
    <span
      className={bucket === null ? 'hm-swatch is-none' : 'hm-swatch'}
      style={bucket === null ? undefined : { background: heatColor(bucket) }}
      aria-hidden="true"
    />
  );
}

/** The colour scale with its edges in seconds, the "not enough data" mark and the error bar. */
export function Legend() {
  const t = useT();
  const format = useHeatFormat();
  const percent = (i: number) => `${((i + 1) / SPEED_BUCKETS) * 100}%`;

  return (
    <div className="hm-legend">
      <figure className="hm-scale">
        <figcaption>{t('heatmap.legend')}</figcaption>
        <div className="hm-scale-bar" aria-hidden="true">
          {BUCKETS.map((bucket) => (
            <span key={bucket} style={{ background: heatColor(bucket) }} />
          ))}
          {TARGET_EDGE >= 0 && (
            <span className="hm-scale-target" style={{ left: percent(TARGET_EDGE) }} />
          )}
        </div>
        <div className="hm-scale-ticks" aria-hidden="true">
          {SPEED_EDGES_MS.map((ms, i) => (
            <span key={ms} style={{ left: percent(i) }}>
              {format.edge(ms)}
            </span>
          ))}
        </div>
        <div className="hm-scale-ends" aria-hidden="true">
          <span>← {t('heatmap.legend.faster')}</span>
          {TARGET_EDGE >= 0 && (
            <span className="hm-scale-target-label" style={{ left: percent(TARGET_EDGE) }}>
              {t('heatmap.legend.target')}
            </span>
          )}
          <span>{t('heatmap.legend.slower')} →</span>
        </div>
        <ul className="visually-hidden">
          {BUCKETS.map((bucket) => (
            <li key={bucket}>{format.band(bucket)}</li>
          ))}
        </ul>
      </figure>
      <ul className="hm-keys">
        <li>
          <Swatch bucket={null} />
          {t('heatmap.legend.noData')}
        </li>
        <li>
          <svg className="hm-errors-icon" viewBox="0 0 16 16" aria-hidden="true">
            <rect className="hm-track" x="5" y="1" width="6" height="14" />
            <rect className="hm-bar" x="5" y="9" width="6" height="6" />
          </svg>
          {t('heatmap.legend.errors')}
        </li>
      </ul>
    </div>
  );
}
