import { useCallback, useEffect, useId, useMemo, useRef, type CSSProperties } from 'react';
import {
  BAR_BUCKETS,
  byBarWeakness,
  metricScale,
  MIN_RUNS,
  MIN_STEPS,
  WINDOW_RUNS,
  type BarCell,
  type BarMetric,
} from '../../core/barHeatmap.ts';
import { useT } from '../../i18n/index.ts';
import type { BarBox, BarBoxes } from '../notation/ScoreView.tsx';
import { useCellNavigation } from '../progress/heatmap/navigation.ts';
import { Tooltip } from '../progress/heatmap/Details.tsx';
import { heatColor } from '../progress/heatmap/format.ts';
import { Swatch } from '../progress/heatmap/Legend.tsx';
import type { BarFormat } from './barFormat.ts';

// The measure heatmap on the practice view: a tint behind each bar and a strip above it in the
// heatmap's colour for the time per step (or, for timing, the distance from the beat), a mark
// for wrong (missed and extra) notes, details on hover, focus or tap, and the same figures as a
// table.

/** Space around the staff lines that the tint covers, and the strip above it. */
const PAD = 8;
const STRIP = 4;
const STRIP_GAP = 3;

const BUCKETS = Array.from({ length: BAR_BUCKETS }, (_, i) => i);

const wash = (bucket: number) =>
  `color-mix(in oklab, var(--heat-${bucket}) var(--bar-wash), var(--surface))`;

function place(box: BarBox): CSSProperties {
  return { left: box.left, top: box.top - PAD, width: box.width, height: box.height + 2 * PAD };
}

/** Behind the notes: the tints, strips and wrong-note marks. */
export function BarTints({
  cells,
  boxes,
  format,
}: {
  cells: readonly BarCell[];
  boxes: BarBoxes;
  format: BarFormat;
}) {
  return cells.map((cell) => {
    const box = boxes.get(cell.measure);
    if (!box) return null;
    const top = box.top - PAD - STRIP_GAP - STRIP;
    const marked = cell.bucket !== null && cell.wrong > 0;
    return (
      <div key={cell.measure} className="bar-heat">
        {cell.bucket !== null && (
          <div className="bar-tint" style={{ ...place(box), background: wash(cell.bucket) }} />
        )}
        <div
          className={cell.bucket === null ? 'bar-strip is-none' : 'bar-strip'}
          style={{
            left: box.left + 2,
            top,
            width: Math.max(4, box.width - 4 - (marked ? 34 : 0)),
            background: cell.bucket === null ? undefined : heatColor(cell.bucket),
          }}
        />
        {marked && (
          <span className="bar-wrong" style={{ left: box.left + box.width - 36, top: top - 5 }}>
            {format.rate(cell)}
          </span>
        )}
      </div>
    );
  });
}

/** Over the notes: one focusable target per bar (one tab stop), with its details. */
export function BarTargets({
  cells,
  boxes,
  format,
}: {
  cells: readonly BarCell[];
  boxes: BarBoxes;
  format: BarFormat;
}) {
  const t = useT();
  const layer = useRef<HTMLDivElement>(null);
  const placed = cells.filter((c) => boxes.has(c.measure));
  const ids = useMemo(() => placed.map((c) => String(c.measure)), [placed]);
  const { shown, onKeyDown, cellProps, element } = useCellNavigation(ids);
  const shownCell = placed.find((c) => String(c.measure) === shown) ?? null;
  const anchor = useCallback(() => (shown ? element(shown) : null), [shown, element]);
  const anchorKey = shownCell ? JSON.stringify(boxes.get(shownCell.measure)) : '';
  const frameBounds = useCallback(
    () => layer.current?.closest('.score-frame')?.getBoundingClientRect() ?? null,
    [],
  );

  return (
    <div
      className="bar-targets"
      ref={layer}
      role="group"
      aria-label={t(format.metric === 'timing' ? 'pieces.weak.group.timing' : 'pieces.weak.group')}
      onKeyDown={onKeyDown}
    >
      {placed.map((cell) => (
        <button
          key={cell.measure}
          type="button"
          className="bar-target"
          style={place(boxes.get(cell.measure)!)}
          aria-label={format.aria(cell)}
          {...cellProps(String(cell.measure))}
        />
      ))}
      {shownCell && (
        <Tooltip
          container={layer}
          anchor={anchor}
          anchorKey={anchorKey}
          bounds={frameBounds}
          floating
        >
          <BarDetails cell={shownCell} format={format} />
        </Tooltip>
      )}
    </div>
  );
}

function BarDetails({ cell, format }: { cell: BarCell; format: BarFormat }) {
  const t = useT();
  const timing = format.metric === 'timing';
  return (
    <>
      <p className="hm-tooltip-title">{format.bar(cell)}</p>
      {cell.bucket === null ? (
        <p className="hm-tooltip-nodata">
          <Swatch bucket={null} />
          {t(timing ? 'pieces.weak.noData.timing' : 'pieces.weak.noData.details', {
            runs: MIN_RUNS,
            steps: MIN_STEPS,
          })}
        </p>
      ) : (
        <p className="hm-tooltip-speed">
          <Swatch bucket={cell.bucket} />
          <strong>{format.median(cell)}</strong>
          <span>
            {t(timing ? 'pieces.weak.perNote' : 'pieces.weak.perStep')} · {format.band(cell.bucket)}
          </span>
        </p>
      )}
      <dl className="hm-tooltip-figures">
        <div>
          <dt>{t('pieces.weak.runs', { n: WINDOW_RUNS })}</dt>
          <dd>{cell.runs}</dd>
        </div>
        <div>
          <dt>{t(timing ? 'pieces.weak.notes' : 'pieces.weak.steps')}</dt>
          <dd>{cell.steps}</dd>
        </div>
        <div>
          <dt>{t(timing ? 'pieces.weak.missed' : 'pieces.weak.wrong')}</dt>
          <dd>
            <WrongValue cell={cell} format={format} />
          </dd>
        </div>
      </dl>
      {cell.passes > 1 && <p className="hm-tooltip-note">{t('pieces.weak.passes')}</p>}
      {cell.steady && (
        <p className="hm-tooltip-note">
          {t(timing ? 'pieces.weak.steady.timing' : 'pieces.weak.steady')}
        </p>
      )}
    </>
  );
}

/** Wrong notes (timing: missed and extra) with their rate, or a dash. */
function WrongValue({ cell, format }: { cell: BarCell; format: BarFormat }) {
  const t = useT();
  if (cell.steps === 0) return t('read.none');
  if (cell.wrong === 0) return 0;
  return t(format.metric === 'timing' ? 'pieces.weak.missed.value' : 'pieces.weak.wrong.value', {
    n: cell.wrong,
    rate: format.rate(cell),
  });
}

/** The scale, the other marks, a note on older runs and the two actions. */
export function WeakBarsBar({
  format,
  loading,
  staleRuns,
  loopLabel,
  onLoop,
  onTable,
  onMetric,
}: {
  format: BarFormat;
  loading: boolean;
  staleRuns: number;
  /** The bars "Loop the weakest bars" would loop, or null when there is nothing to loop. */
  loopLabel: string | null;
  onLoop: () => void;
  onTable: () => void;
  onMetric: (metric: BarMetric) => void;
}) {
  const t = useT();
  const id = useId();
  const timing = format.metric === 'timing';
  const { edges } = metricScale(format.metric);
  const percent = (i: number) => `${((i + 1) / BAR_BUCKETS) * 100}%`;
  return (
    <div className="weak-bars" role="region" aria-label={t('pieces.weak')}>
      <fieldset className="piece-control weak-metric">
        <legend className="visually-hidden">{t('pieces.weak.metric')}</legend>
        <div className="segmented is-compact">
          {(['hesitation', 'timing'] as const).map((metric) => (
            <label key={metric}>
              <input
                type="radio"
                name={`${id}-metric`}
                value={metric}
                checked={format.metric === metric}
                onChange={() => onMetric(metric)}
                aria-describedby={`${id}-metric-${metric}`}
              />
              <span>{t(`pieces.weak.metric.${metric}`)}</span>
            </label>
          ))}
        </div>
        <span id={`${id}-metric-hesitation`} className="visually-hidden">
          {t('pieces.weak.help')}
        </span>
        <span id={`${id}-metric-timing`} className="visually-hidden">
          {t('pieces.weak.help.timing')}
        </span>
      </fieldset>
      <figure className="weak-scale">
        <figcaption>{t(timing ? 'pieces.weak.legend.timing' : 'pieces.weak.legend')}</figcaption>
        <div>
          <div className="hm-scale-bar" aria-hidden="true">
            {BUCKETS.map((bucket) => (
              <span key={bucket} style={{ background: heatColor(bucket) }} />
            ))}
          </div>
          <div className="hm-scale-ticks" aria-hidden="true">
            {edges.map((ms, i) => (
              <span key={ms} style={{ left: percent(i) }}>
                {format.edge(ms)}
              </span>
            ))}
          </div>
        </div>
        <ul className="visually-hidden">
          {BUCKETS.map((bucket) => (
            <li key={bucket}>{format.band(bucket)}</li>
          ))}
        </ul>
      </figure>
      <ul className="weak-keys">
        <li>
          <Swatch bucket={null} />
          {t('pieces.weak.noData')}
        </li>
        <li>
          <span className="bar-wrong is-key" aria-hidden="true">
            ×0.5
          </span>
          {t(timing ? 'pieces.weak.wrongKey.timing' : 'pieces.weak.wrongKey')}
        </li>
      </ul>
      <div className="weak-actions">
        <button type="button" className="button is-compact" onClick={onTable}>
          {t('pieces.weak.table')}
        </button>
        <button
          type="button"
          className="button is-compact"
          disabled={!loopLabel}
          aria-describedby={loopLabel ? undefined : `${id}-loop`}
          onClick={onLoop}
        >
          {loopLabel ? t('pieces.weak.loop.bars', { bars: loopLabel }) : t('pieces.weak.loop')}
        </button>
        {!loopLabel && (
          <span id={`${id}-loop`} className="visually-hidden">
            {t(timing ? 'pieces.weak.loop.none.timing' : 'pieces.weak.loop.none')}
          </span>
        )}
      </div>
      {(loading || staleRuns > 0) && (
        <p className="muted weak-note">
          {loading
            ? t('pieces.weak.loading')
            : staleRuns === 1
              ? t('pieces.weak.stale.one')
              : t('pieces.weak.stale.other', { n: staleRuns })}
        </p>
      )}
    </div>
  );
}

/** The table alternative, laid over the score: weakest first. */
export function WeakBarsTable({
  cells,
  format,
  onClose,
}: {
  cells: readonly BarCell[];
  format: BarFormat;
  onClose: () => void;
}) {
  const t = useT();
  const timing = format.metric === 'timing';
  const heading = useRef<HTMLHeadingElement>(null);
  const rows = useMemo(() => [...cells].sort(byBarWeakness), [cells]);
  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  return (
    <section
      className="piece-summary weak-table"
      aria-labelledby="weak-table-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="weak-table-head">
        <h2 id="weak-table-title" ref={heading} tabIndex={-1}>
          {t(timing ? 'pieces.weak.table.title.timing' : 'pieces.weak.table.title')}
        </h2>
        <button type="button" className="button is-compact" onClick={onClose}>
          {t('pieces.weak.table.close')}
        </button>
      </div>
      <div className="hm-table-scroll">
        <table className="history-table hm-table">
          <thead>
            <tr>
              <th scope="col">{t('pieces.weak.table.bar')}</th>
              <th scope="col">
                {t(timing ? 'pieces.weak.table.band.timing' : 'pieces.weak.table.band')}
              </th>
              <th scope="col">{t('pieces.weak.table.median')}</th>
              <th scope="col">
                {t(timing ? 'pieces.weak.table.wrong.timing' : 'pieces.weak.table.wrong')}
              </th>
              <th scope="col">{t('pieces.weak.table.runs')}</th>
              <th scope="col">{t('pieces.weak.table.steady')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cell) => (
              <tr key={cell.measure}>
                <th scope="row">{format.bar(cell)}</th>
                <td>
                  <span className="hm-band">
                    <Swatch bucket={cell.bucket} />
                    {cell.bucket === null ? t('pieces.weak.noData') : format.band(cell.bucket)}
                  </span>
                </td>
                <td>{format.median(cell)}</td>
                <td>
                  <WrongValue cell={cell} format={format} />
                </td>
                <td>{cell.runs}</td>
                <td>{cell.steady ? t('pieces.weak.table.yes') : t('read.none')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="help">
        {t(timing ? 'pieces.weak.table.help.timing' : 'pieces.weak.table.help', { n: WINDOW_RUNS })}
      </p>
    </section>
  );
}
