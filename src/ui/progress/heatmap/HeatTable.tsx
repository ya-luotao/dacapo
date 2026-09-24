import { useId, useMemo, useState } from 'react';
import { SORT_COLUMNS, sortCells, type NoteCell, type SortColumn } from '../../../core/heatmap.ts';
import { useT } from '../../../i18n/index.ts';
import { useReadFormat } from '../../read/format.ts';
import { useHeatFormat } from './format.ts';
import { Swatch } from './Legend.tsx';

const isSortColumn = (value: string): value is SortColumn =>
  (SORT_COLUMNS as readonly string[]).includes(value);

/** The heatmap's figures as a table, weakest first unless another order is chosen. */
export function HeatTable({ cells }: { cells: readonly NoteCell[] }) {
  const t = useT();
  const read = useReadFormat();
  const format = useHeatFormat();
  const id = useId();
  const [order, setOrder] = useState<SortColumn>('weakness');
  const rows = useMemo(() => sortCells(cells, order), [cells, order]);

  return (
    <details className="history-details hm-table-details">
      <summary>{t('heatmap.table')}</summary>
      <div className="hm-table-order">
        <label htmlFor={`${id}-order`}>{t('heatmap.sort')}</label>
        <select
          id={`${id}-order`}
          value={order}
          onChange={(e) => isSortColumn(e.target.value) && setOrder(e.target.value)}
        >
          {SORT_COLUMNS.map((column) => (
            <option key={column} value={column}>
              {t(`heatmap.sort.${column}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="hm-table-scroll">
        <table className="history-table hm-table">
          <thead>
            <tr>
              <th scope="col">{t('heatmap.table.note')}</th>
              <th scope="col">{t('heatmap.table.band')}</th>
              <th scope="col">{t('heatmap.table.typical')}</th>
              <th scope="col">{t('heatmap.table.recent')}</th>
              <th scope="col">{t('heatmap.table.overall')}</th>
              <th scope="col">{t('heatmap.table.attempts')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cell) => (
              <tr key={cell.key}>
                <th scope="row">{read.note(cell.key)}</th>
                <td>
                  <span className="hm-band">
                    <Swatch bucket={cell.bucket} />
                    {format.bandOf(cell)}
                  </span>
                </td>
                <td>{read.seconds(cell.ewmaMs)}</td>
                <td>{format.shortRatio(cell.recentCorrect, cell.recentCount)}</td>
                <td>{format.shortRatio(cell.correct, cell.attempts)}</td>
                <td>{cell.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
