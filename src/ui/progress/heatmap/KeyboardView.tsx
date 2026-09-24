import { useCallback, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import { keyCells, type NoteCell } from '../../../core/heatmap.ts';
import { MIDDLE_C, midiName, pitchClass } from '../../../core/note.ts';
import { useT } from '../../../i18n/index.ts';
import { useReadFormat } from '../../read/format.ts';
import { BLACK_LENGTH, pianoLayout } from '../../piano/layout.ts';
import { CellDetails, Tooltip } from './Details.tsx';
import { heatColor, useHeatFormat } from './format.ts';
import { keyboardRange } from './layout.ts';
import { useCellNavigation } from './navigation.ts';

/**
 * The practised keys on the M2 piano's geometry, both staves together. Unlike the Play piano,
 * the keys do not sound: they show their figures.
 */
export function KeyboardView({ cells }: { cells: readonly NoteCell[] }) {
  const t = useT();
  const read = useReadFormat();
  const format = useHeatFormat();
  const box = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const keys = useMemo(() => keyCells(cells), [cells]);
  const byMidi = useMemo(() => new Map(keys.map((k) => [k.midi, k])), [keys]);
  const range = keyboardRange(keys.map((k) => k.midi));
  const low = range?.low ?? null;
  const high = range?.high ?? null;
  const layout = useMemo(
    () => (low === null || high === null ? null : pianoLayout(low, high)),
    [low, high],
  );
  const ids = useMemo(() => keys.map((k) => String(k.midi)), [keys]);
  const nav = useCellNavigation(ids);
  const shown = nav.shown === null ? null : (byMidi.get(Number(nav.shown)) ?? null);
  const { element } = nav;
  const anchor = useCallback(
    () => (shown ? (element(String(shown.midi))?.querySelector('.hm-key-swatch') ?? null) : null),
    [element, shown],
  );

  // Where the keyboard is wider than its box, start around middle C, like the Play piano.
  useLayoutEffect(() => {
    const el = scroller.current;
    const middle = layout?.keys.find((k) => k.midi === MIDDLE_C);
    if (!el || !layout || !middle || el.scrollWidth <= el.clientWidth) return;
    const x = ((middle.left + 0.5) / layout.width) * el.scrollWidth;
    el.scrollLeft = x - el.clientWidth / 2;
  }, [layout]);

  if (!layout) return null;
  const percent = (units: number) => `${(units / layout.width) * 100}%`;

  return (
    <div className="hm-view" ref={box}>
      <div className="piano-scroller hm-scroller" ref={scroller}>
        <div className="hm-keyboard" style={{ '--whites': layout.width } as CSSProperties}>
          <div
            className="piano hm-piano"
            role="group"
            aria-label={t('heatmap.keyboard.label', { n: keys.length })}
            onKeyDown={nav.onKeyDown}
          >
            {layout.keys.map(({ midi, black, left, width }) => {
              const cell = byMidi.get(midi);
              const style: CSSProperties = {
                left: percent(left),
                width: percent(width),
                height: black ? `${BLACK_LENGTH * 100}%` : undefined,
              };
              const className = `key ${black ? 'key-black' : 'key-white'}`;
              const label = !black && pitchClass(midi) === 0 && (
                <span className="hm-key-label" aria-hidden="true">
                  {midiName(midi)}
                </span>
              );
              if (!cell) {
                return (
                  <div key={midi} className={className} style={style} aria-hidden="true">
                    {label}
                  </div>
                );
              }
              return (
                <div
                  key={midi}
                  className={`${className} is-practised${nav.shown === String(midi) ? ' is-active' : ''}`}
                  style={style}
                  role="button"
                  aria-label={format.aria(format.keyName(midi), cell)}
                  {...nav.cellProps(String(midi))}
                >
                  {label}
                  <span
                    className={cell.bucket === null ? 'hm-key-swatch is-none' : 'hm-key-swatch'}
                    style={
                      cell.bucket === null ? undefined : { background: heatColor(cell.bucket) }
                    }
                  />
                </div>
              );
            })}
          </div>
          <div className="hm-key-strip" aria-hidden="true">
            {layout.keys.map(({ midi, left, width }) => {
              const cell = byMidi.get(midi);
              if (!cell) return null;
              const centre = left + width / 2;
              return (
                <span
                  key={midi}
                  className="hm-key-errors"
                  style={{ left: percent(centre - 0.16), width: percent(0.32) }}
                >
                  <span className="hm-key-bar" style={{ height: `${cell.errorRate * 100}%` }} />
                </span>
              );
            })}
          </div>
        </div>
      </div>
      {shown && (
        <Tooltip container={box} anchor={anchor} anchorKey={String(shown.midi)}>
          <CellDetails
            title={format.keyName(shown.midi)}
            figures={shown}
            note={
              shown.notes.length > 1
                ? t('heatmap.details.combined', {
                    notes: shown.notes
                      .map((n) => read.note(n.key))
                      .join(t('heatmap.listSeparator')),
                  })
                : read.note(shown.notes[0]!.key)
            }
          />
        </Tooltip>
      )}
    </div>
  );
}
