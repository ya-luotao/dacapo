import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import type { NoteCell } from '../../../core/heatmap.ts';
import { useT } from '../../../i18n/index.ts';
import { useReadFormat } from '../../read/format.ts';
import { getFontState, subscribeFont, type FontState } from '../../staff/font.ts';
import { CellDetails, Tooltip } from './Details.tsx';
import { heatColor, useHeatFormat } from './format.ts';
import {
  FIRST_COLUMN,
  layoutSystems,
  LEDGER_HALF,
  STAFF_LEFT,
  staffGeometry,
  STRIP_HEIGHT,
  type Column,
  type StaffGeometry,
  type System,
} from './layout.ts';
import { useCellNavigation } from './navigation.ts';

// SMuFL code points in the Bravura font.
const G_CLEF = '';
const F_CLEF = '';
const BRACE = '';
const ACCIDENTAL_GLYPH = { [-1]: '', 1: '' } as const;
const ACCIDENTAL_TEXT = { [-1]: '♭', 1: '♯' } as const;

/** Pixels per staff space: larger where there is room. */
const spaceFor = (width: number) => (width < 560 ? 8 : 10);

function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/** The practised notes on a grand staff, coloured by speed, wrapped into systems. */
export function StaffView({ cells }: { cells: readonly NoteCell[] }) {
  const t = useT();
  const read = useReadFormat();
  const format = useHeatFormat();
  const font = useSyncExternalStore(subscribeFont, getFontState, getFontState);
  const box = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const width = useWidth(area);
  const space = spaceFor(width);

  const geometry = useMemo(() => staffGeometry(cells.map((c) => c.note)), [cells]);
  const systems = useMemo(
    () => (width > 0 ? layoutSystems(cells, width / space - 0.1, geometry) : []),
    [cells, width, space, geometry],
  );
  const ids = useMemo(() => cells.map((c) => c.key), [cells]);
  const nav = useCellNavigation(ids);
  const shown = cells.find((c) => c.key === nav.shown) ?? null;
  const { element } = nav;
  const anchor = useCallback(
    () => (shown ? (element(shown.key)?.querySelector('.hm-head') ?? null) : null),
    [element, shown],
  );

  return (
    <div className="hm-view" ref={box}>
      <div
        ref={area}
        className="hm-systems"
        role="group"
        aria-label={t('heatmap.staff.label', { n: cells.length })}
        onKeyDown={nav.onKeyDown}
      >
        {systems.map((system) => (
          <svg
            key={system.columns[0]!.item.key}
            className="hm-system"
            // A little slack on the right for the final barline's stroke.
            viewBox={`0 0 ${system.width + 0.1} ${geometry.height}`}
            width={(system.width + 0.1) * space}
            height={geometry.height * space}
            role="none"
          >
            <Staves system={system} geometry={geometry} font={font} />
            {system.columns.map((column) => (
              <g
                key={column.item.key}
                className={column.item.key === nav.shown ? 'hm-note is-active' : 'hm-note'}
                role="button"
                aria-label={format.aria(read.note(column.item.key), column.item)}
                {...nav.cellProps(column.item.key)}
              >
                <NoteColumn column={column} geometry={geometry} font={font} />
              </g>
            ))}
          </svg>
        ))}
      </div>
      {shown && (
        <Tooltip container={box} anchor={anchor} anchorKey={`${width}`}>
          <CellDetails title={read.note(shown.key)} figures={shown} />
        </Tooltip>
      )}
    </div>
  );
}

function Staves({
  system,
  geometry,
  font,
}: {
  system: System<NoteCell>;
  geometry: StaffGeometry;
  font: FontState;
}) {
  const { trebleTop, bassTop, stripBase } = geometry;
  const bottom = bassTop + 4;
  const right = system.width;
  const lines = [0, 1, 2, 3, 4].flatMap((i) => [trebleTop + i, bassTop + i]);
  const braceHeight = bottom - trebleTop;
  return (
    <g aria-hidden="true">
      {lines.map((y) => (
        <line key={y} className="hm-staff-line" x1={STAFF_LEFT} x2={right} y1={y} y2={y} />
      ))}
      <line className="hm-barline" x1={STAFF_LEFT} x2={STAFF_LEFT} y1={trebleTop} y2={bottom} />
      <line className="hm-barline" x1={right} x2={right} y1={trebleTop} y2={trebleTop + 4} />
      <line className="hm-barline" x1={right} x2={right} y1={bassTop} y2={bottom} />
      {font === 'ready' && (
        <>
          <text
            className="hm-glyph"
            transform={`translate(${STAFF_LEFT - 0.35} ${bottom}) scale(2.4 ${braceHeight / 4})`}
            textAnchor="end"
            fontSize={4}
          >
            {BRACE}
          </text>
          <text className="hm-glyph" x={STAFF_LEFT + 0.5} y={trebleTop + 3} fontSize={4}>
            {G_CLEF}
          </text>
          <text className="hm-glyph" x={STAFF_LEFT + 0.5} y={bassTop + 1} fontSize={4}>
            {F_CLEF}
          </text>
        </>
      )}
      <line
        className="hm-strip-base"
        x1={FIRST_COLUMN - 0.25}
        x2={right - 0.55}
        y1={stripBase}
        y2={stripBase}
      />
    </g>
  );
}

function NoteColumn({
  column,
  geometry,
  font,
}: {
  column: Column<NoteCell>;
  geometry: StaffGeometry;
  font: FontState;
}) {
  const { item: cell, x, y, accidental } = column;
  const errors = cell.errorRate * STRIP_HEIGHT;
  return (
    <>
      <rect
        className="hm-hit"
        x={column.left + 0.1}
        y={0.1}
        width={column.width - 0.2}
        height={geometry.height - 0.2}
        rx={0.5}
      />
      {column.ledgers.map((ly) => (
        <line
          key={ly}
          className="hm-ledger"
          x1={x - LEDGER_HALF}
          x2={x + LEDGER_HALF}
          y1={ly}
          y2={ly}
        />
      ))}
      {accidental !== 0 &&
        (font === 'ready' ? (
          <text className="hm-glyph" x={x - 1.05} y={y} fontSize={4} textAnchor="end">
            {ACCIDENTAL_GLYPH[accidental]}
          </text>
        ) : (
          <text
            className="hm-accidental-text"
            x={x - 1.0}
            y={y}
            fontSize={2}
            textAnchor="end"
            dominantBaseline="central"
          >
            {ACCIDENTAL_TEXT[accidental]}
          </text>
        ))}
      <ellipse
        className={cell.bucket === null ? 'hm-head is-none' : 'hm-head'}
        cx={x}
        cy={y}
        rx={0.72}
        ry={0.5}
        transform={`rotate(-20 ${x} ${y})`}
        style={cell.bucket === null ? undefined : { fill: heatColor(cell.bucket) }}
      />
      <rect
        className="hm-track"
        x={x - 0.45}
        y={geometry.stripBase - STRIP_HEIGHT}
        width={0.9}
        height={STRIP_HEIGHT}
      />
      {errors > 0 && (
        <rect
          className="hm-bar"
          x={x - 0.45}
          y={geometry.stripBase - errors}
          width={0.9}
          height={errors}
        />
      )}
    </>
  );
}
