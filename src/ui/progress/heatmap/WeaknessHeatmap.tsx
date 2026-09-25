import { Fragment, useId, useMemo, useState } from 'react';
import { MIN_ATTEMPTS, noteCells, weakestNotes, type LevelFilter } from '../../../core/heatmap.ts';
import { isLevelId, LEVEL_IDS } from '../../../core/levels.ts';
import type { StatsByKey } from '../../../core/weakness.ts';
import { useT } from '../../../i18n/index.ts';
import { EmptyState } from '../../EmptyState.tsx';
import { useReadFormat } from '../../read/format.ts';
import { HeatTable } from './HeatTable.tsx';
import { KeyboardView } from './KeyboardView.tsx';
import { Legend, Swatch } from './Legend.tsx';
import { StaffView } from './StaffView.tsx';

type View = 'staff' | 'keyboard';
const VIEWS: readonly View[] = ['staff', 'keyboard'];

/** F3: every practised note, coloured by reaction speed, on the grand staff or the keyboard. */
export function WeaknessHeatmap({ stats }: { stats: StatsByKey }) {
  const t = useT();
  const read = useReadFormat();
  const id = useId();
  const [filter, setFilter] = useState<LevelFilter>('all');
  const [view, setView] = useState<View>('staff');
  const practised = useMemo(() => noteCells(stats).length > 0, [stats]);
  const cells = useMemo(() => noteCells(stats, filter), [stats, filter]);
  const weakest = useMemo(() => weakestNotes(cells), [cells]);

  return (
    <section className="heatmap" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('heatmap.title')}</h2>
      {!practised ? (
        <EmptyState action={{ href: '/read', label: t('progress.empty.action') }}>
          {t('heatmap.empty')}
        </EmptyState>
      ) : (
        <>
          <p className="help hm-intro">{t('heatmap.intro')}</p>
          <div className="hm-controls">
            <div className="hm-control">
              <label htmlFor={`${id}-level`}>{t('heatmap.level')}</label>
              <select
                id={`${id}-level`}
                value={filter}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilter(isLevelId(value) ? value : 'all');
                }}
              >
                <option value="all">{t('heatmap.level.all')}</option>
                {LEVEL_IDS.map((level) => (
                  <option key={level} value={level}>
                    {read.level(level)}
                  </option>
                ))}
              </select>
            </div>
            <fieldset className="hm-control">
              <legend>{t('heatmap.view')}</legend>
              <div className="segmented">
                {VIEWS.map((v) => (
                  <label key={v}>
                    <input
                      type="radio"
                      name={`${id}-view`}
                      value={v}
                      checked={view === v}
                      onChange={() => setView(v)}
                    />
                    <span>{t(`heatmap.view.${v}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {cells.length === 0 ? (
            <p className="muted">{t('heatmap.emptyLevel')}</p>
          ) : (
            <>
              <p className="hm-weakest">
                <strong>{t('heatmap.weakest')}</strong>{' '}
                {weakest.length === 0
                  ? t('heatmap.weakest.none', { n: MIN_ATTEMPTS })
                  : weakest.map((cell, i) => (
                      <Fragment key={cell.key}>
                        {i > 0 && t('app.listSeparator')}
                        <span className="hm-weak-note">
                          <Swatch bucket={cell.bucket} />
                          {read.note(cell.key)}
                        </span>
                      </Fragment>
                    ))}
              </p>
              <Legend />
              {view === 'staff' ? <StaffView cells={cells} /> : <KeyboardView cells={cells} />}
              <p className="help">{t('heatmap.hint')}</p>
              <HeatTable cells={cells} />
            </>
          )}
        </>
      )}
    </section>
  );
}
