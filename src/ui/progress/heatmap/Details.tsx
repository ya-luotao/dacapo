import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { MIN_ATTEMPTS, type Figures } from '../../../core/heatmap.ts';
import { useT } from '../../../i18n/index.ts';
import { useReadFormat } from '../../read/format.ts';
import { useHeatFormat } from './format.ts';
import { Swatch } from './Legend.tsx';

const GAP = 8;

interface TooltipProps {
  /** The positioned element the tooltip is placed in. */
  container: RefObject<HTMLElement | null>;
  /** Finds the element to point at; called after rendering. Keep it stable (`useCallback`). */
  anchor: () => Element | null;
  /** Changes whenever the anchor may have moved without `anchor` changing, e.g. on resize. */
  anchorKey: string;
  /** The visible area when the container scrolls inside it (default: the window). */
  bounds?: () => DOMRect | null;
  children: ReactNode;
}

/** Floats above the anchor (below it when there is no room), inside the container's width. */
export function Tooltip({ container, anchor, anchorKey, bounds, children }: TooltipProps) {
  const tip = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    function place() {
      const box = container.current;
      const target = anchor();
      const el = tip.current;
      if (!box || !target || !el) return;
      const b = box.getBoundingClientRect();
      const a = target.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.min(
        Math.max(0, a.left + a.width / 2 - b.left - w / 2),
        Math.max(0, b.width - w),
      );
      const visible = bounds?.();
      const top0 = visible?.top ?? 0;
      const bottom0 = visible?.bottom ?? window.innerHeight;
      // Above if it fits, else below if that fits, else kept inside the visible area.
      let y = a.top - h - GAP >= top0 ? a.top - h - GAP : a.bottom + GAP;
      if (visible && y + h > bottom0) y = Math.max(top0, bottom0 - h);
      const top = y - b.top;
      setPosition((p) => (p && p.left === left && p.top === top ? p : { left, top }));
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [container, anchor, anchorKey, bounds]);

  return (
    <div
      ref={tip}
      className="hm-tooltip"
      // Screen readers get the same details from the cell's own label.
      aria-hidden="true"
      style={position ? { left: position.left, top: position.top } : { visibility: 'hidden' }}
    >
      {children}
    </div>
  );
}

interface CellDetailsProps {
  title: string;
  figures: Figures;
  /** Extra line, e.g. which written notes a key combines. */
  note?: string;
}

/** The figures of one note or key: the value first, the label after it. */
export function CellDetails({ title, figures, note }: CellDetailsProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useHeatFormat();
  return (
    <>
      <p className="hm-tooltip-title">{title}</p>
      {figures.bucket === null ? (
        <p className="hm-tooltip-nodata">
          <Swatch bucket={null} />
          {t('heatmap.details.noData', { n: MIN_ATTEMPTS })}
        </p>
      ) : (
        <p className="hm-tooltip-speed">
          <Swatch bucket={figures.bucket} />
          <strong>{read.seconds(figures.ewmaMs)}</strong>
          <span>
            {t('heatmap.details.typical')} · {format.band(figures.bucket)}
          </span>
        </p>
      )}
      <dl className="hm-tooltip-figures">
        <div>
          <dt>{t('heatmap.details.recent')}</dt>
          <dd>{format.ratio(figures.recentCorrect, figures.recentCount)}</dd>
        </div>
        <div>
          <dt>{t('heatmap.details.overall')}</dt>
          <dd>{format.ratio(figures.correct, figures.attempts)}</dd>
        </div>
        <div>
          <dt>{t('heatmap.details.attempts')}</dt>
          <dd>{figures.attempts}</dd>
        </div>
      </dl>
      {note && <p className="hm-tooltip-note">{note}</p>}
    </>
  );
}
