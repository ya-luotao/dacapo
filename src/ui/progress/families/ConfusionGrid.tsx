import { useId } from 'react';
import {
  cellCount,
  CONFUSION_MIN_ASKED,
  OTHER,
  SHARE_EDGES,
  shareBucket,
  type AnswerFamily,
  type ConfusionMatrix,
  type TopConfusion,
} from '../../../core/answerProgress.ts';
import { useT } from '../../../i18n/index.ts';
import { useReadFormat } from '../../read/format.ts';
import { heatColor } from '../heatmap/format.ts';
import { useFamilyFormat } from './format.tsx';

/** The confusions listed in words under "Show as a table". */
export const TOP_CONFUSIONS = 10;

const BUCKETS = Array.from({ length: SHARE_EDGES.length + 1 }, (_, i) => i);

/**
 * A family's confusion table as a heat grid: a row for each thing asked, a column for each
 * answer, the count in each cell. Right answers (the diagonal) are marked apart; a wrong one is
 * coloured by its share of the row on the note heatmap's scale; a row with fewer than
 * `CONFUSION_MIN_ASKED` answers is not enough data to colour.
 */
export function ConfusionGrid({
  family,
  matrix,
  top,
}: {
  family: AnswerFamily;
  matrix: ConfusionMatrix;
  top: readonly TopConfusion[];
}) {
  const t = useT();
  const read = useReadFormat();
  const format = useFamilyFormat();
  const id = useId();
  const echo = family === 'echo';
  const otherKind = echo
    ? 'echo'
    : family === 'chordSymbol'
      ? 'chordSymbol'
      : family === 'chord' || family === 'readChord'
        ? 'chord'
        : 'interval';

  /** What a cell counts, in words. */
  const sentence = (asked: string, answered: string, count: number, total: number) =>
    t(
      asked === answered
        ? 'families.confusion.cell.right'
        : echo
          ? 'families.confusion.cell.echo'
          : 'families.confusion.cell',
      {
        asked: format.long(family, asked),
        answered: format.long(family, answered),
        count,
        total,
      },
    );

  return (
    <div className="cm" aria-labelledby={`${id}-title`} role="group">
      <h4 id={`${id}-title`} className="families-subhead">
        {t('families.confusion')}
      </h4>
      <p className="help cm-help">
        {t(echo ? 'families.confusion.help.echo' : 'families.confusion.help')}
        {matrix.columns.includes(OTHER) && <> {t(`families.confusion.other.${otherKind}`)}</>}
      </p>
      <ConfusionLegend />
      <div
        className="cm-scroll"
        role="region"
        aria-label={t('families.confusion.label', { family: t(`families.family.${family}`) })}
        tabIndex={0}
      >
        <table className="cm-table">
          <thead>
            <tr>
              <th scope="col" className="cm-corner">
                <span className="cm-axis-cols">
                  {t(echo ? 'families.confusion.played' : 'families.confusion.answered')} →
                </span>
                <span className="cm-axis-rows">{t('families.confusion.asked')} ↓</span>
              </th>
              {matrix.columns.map((column) => (
                <th key={column} scope="col" className="cm-col" title={format.long(family, column)}>
                  <span aria-hidden="true">{format.short(family, column)}</span>
                  <span className="visually-hidden">{format.long(family, column)}</span>
                </th>
              ))}
              <th scope="col" className="cm-col cm-total">
                {t('families.confusion.total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((asked) => {
              const total = matrix.totals.get(asked) ?? 0;
              const few = total < CONFUSION_MIN_ASKED;
              return (
                <tr key={asked} className={few ? 'is-few' : undefined}>
                  <th scope="row" className="cm-row" title={format.long(family, asked)}>
                    <span aria-hidden="true">{format.short(family, asked)}</span>
                    <span className="visually-hidden">{format.long(family, asked)}</span>
                  </th>
                  {matrix.columns.map((answered) => {
                    const count = cellCount(matrix, asked, answered);
                    if (count === 0) {
                      return (
                        <td
                          key={answered}
                          className={
                            answered === asked ? 'cm-cell is-zero is-diagonal' : 'cm-cell is-zero'
                          }
                        >
                          <span className="visually-hidden">0</span>
                        </td>
                      );
                    }
                    const right = answered === asked;
                    const bucket = shareBucket(count / total);
                    const className = [
                      'cm-cell',
                      right ? 'is-right' : `is-heat heat-on-${bucket}`,
                      few && 'is-few',
                    ]
                      .filter(Boolean)
                      .join(' ');
                    return (
                      <td
                        key={answered}
                        className={className}
                        style={right || few ? undefined : { background: heatColor(bucket) }}
                        title={sentence(asked, answered, count, total)}
                      >
                        {count}
                      </td>
                    );
                  })}
                  <td className="cm-cell cm-total">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="history-details cm-list">
        <summary>{t('heatmap.table')}</summary>
        {top.length === 0 ? (
          <p className="muted">{t('families.confusion.none')}</p>
        ) : (
          <>
            <div className="hm-table-scroll">
              <table className="history-table cm-list-table">
                <thead>
                  <tr>
                    <th scope="col">{t('families.confusion.asked')}</th>
                    <th scope="col">
                      {t(echo ? 'families.confusion.playedAs' : 'families.confusion.answeredAs')}
                    </th>
                    <th scope="col">{t('families.confusion.times.head')}</th>
                  </tr>
                </thead>
                <tbody>
                  {top.slice(0, TOP_CONFUSIONS).map((cell) => (
                    <tr key={`${cell.asked} ${cell.answered}`}>
                      <th scope="row">{format.long(family, cell.asked)}</th>
                      <td>{format.long(family, cell.answered)}</td>
                      <td>
                        {t('families.confusion.times', {
                          count: cell.count,
                          total: cell.total,
                          percent: read.percent(cell.count / cell.total),
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {top.length > TOP_CONFUSIONS && (
              <p className="muted cm-more">
                {t('families.confusion.more', { shown: TOP_CONFUSIONS, total: top.length })}
              </p>
            )}
          </>
        )}
      </details>
    </div>
  );
}

/** The share scale, the right answers' mark and the "not enough data" mark. */
function ConfusionLegend() {
  const t = useT();
  const read = useReadFormat();
  const percent = (i: number) => `${((i + 1) / BUCKETS.length) * 100}%`;
  /** The range of a bucket: `under 5%`, `5%–10%`, `50% or more`. */
  const band = (bucket: number) => {
    if (bucket === 0) return t('heatmap.bucket.below', { max: read.percent(SHARE_EDGES[0]!) });
    if (bucket === SHARE_EDGES.length) {
      return t('heatmap.bucket.above', { min: read.percent(SHARE_EDGES.at(-1)!) });
    }
    return t('heatmap.bucket.between', {
      min: read.percent(SHARE_EDGES[bucket - 1]!),
      max: read.percent(SHARE_EDGES[bucket]!),
    });
  };
  return (
    <div className="hm-legend cm-legend">
      <figure className="hm-scale">
        <figcaption>{t('families.legend.share')}</figcaption>
        <div className="hm-scale-bar" aria-hidden="true">
          {BUCKETS.map((bucket) => (
            <span key={bucket} style={{ background: heatColor(bucket) }} />
          ))}
        </div>
        <div className="hm-scale-ticks" aria-hidden="true">
          {SHARE_EDGES.map((edge, i) => (
            <span key={edge} style={{ left: percent(i) }}>
              {read.percent(edge)}
            </span>
          ))}
        </div>
        <ul className="visually-hidden">
          {BUCKETS.map((bucket) => (
            <li key={bucket}>{band(bucket)}</li>
          ))}
        </ul>
      </figure>
      <ul className="hm-keys">
        <li>
          <span className="cm-swatch is-right" aria-hidden="true" />
          {t('families.legend.right')}
        </li>
        <li>
          <span className="hm-swatch is-none" aria-hidden="true" />
          {t('families.legend.few', { n: CONFUSION_MIN_ASKED })}
        </li>
      </ul>
    </div>
  );
}
