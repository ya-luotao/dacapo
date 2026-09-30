import { useMemo } from 'react';
import { ornamentsToLookAt, type ExpressionAnalysis } from '../../core/expression.ts';
import { useI18n } from '../../i18n/index.ts';
import { JudgedList, LookAtList } from './ExpressionParts.tsx';
import { keyNames, type ExpressionWords } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

/**
 * The Ornaments tab: each ornament and grace note on a note the run played, and whether its keys
 * were played (docs/EXPRESSION.md, X4), the bars to look at and a table.
 */
export function OrnamentsTab({
  analysis,
  format,
  words,
  onLoopBars,
}: {
  analysis: ExpressionAnalysis;
  format: PieceFormat;
  words: ExpressionWords;
  onLoopBars?: (from: number, to: number) => void;
}) {
  const { t } = useI18n();
  const { judgements } = analysis.ornaments;
  const places = useMemo(() => ornamentsToLookAt(analysis.ornaments), [analysis.ornaments]);
  if (judgements.length === 0)
    return <p className="expression-note">{t('pieces.expression.ornaments.none')}</p>;

  const count = (verdict: string) => judgements.filter((j) => j.verdict === verdict).length;
  const names = (keys: readonly number[], j: (typeof judgements)[number]) =>
    keys.length === 0 ? '–' : keyNames(keys, j);

  return (
    <>
      <dl className="figures expression-figures">
        <div>
          <dt>{t('pieces.expression.ornaments.played')}</dt>
          <dd>
            {t('pieces.expression.ofTotal', { n: count('played'), total: judgements.length })}
          </dd>
        </div>
        <div>
          <dt>{t('pieces.expression.ornaments.incomplete')}</dt>
          <dd>{count('incomplete')}</dd>
        </div>
        <div>
          <dt>{t('pieces.expression.ornaments.leftOut')}</dt>
          <dd>{count('left-out')}</dd>
        </div>
      </dl>

      <div className="expression-section">
        <h4>{t('pieces.expression.ornaments.list')}</h4>
        <JudgedList
          items={judgements}
          right={(j) => j.verdict === 'played'}
          what={(j) => words.ornament(j)}
          where={(j) => words.bars(j)}
          verdict={(j) => words.ornamentVerdict(j)}
          folded={(n) =>
            t(
              n === 1
                ? 'pieces.expression.ornaments.folded.one'
                : 'pieces.expression.ornaments.folded.other',
              { n },
            )
          }
        />
        <p className="help">
          {t(
            analysis.mode === 'rhythm'
              ? 'pieces.expression.ornaments.help.rhythm'
              : 'pieces.expression.ornaments.help.wait',
          )}
        </p>
      </div>

      {places.length > 0 && (
        <LookAtList
          places={places}
          format={format}
          describe={(j) => words.ornamentProblem(j)}
          none=""
          onLoopBars={onLoopBars}
        />
      )}

      <details className="history-details">
        <summary>{t('pieces.rhythm.table')}</summary>
        <div className="hm-table-scroll">
          <table className="history-table expression-table">
            <thead>
              <tr>
                <th scope="col">{t('pieces.expression.ornaments.table.ornament')}</th>
                <th scope="col">{t('pieces.rhythm.table.bar')}</th>
                <th scope="col">{t('pieces.expression.ornaments.table.keys')}</th>
                <th scope="col">{t('pieces.expression.ornaments.table.heard')}</th>
                <th scope="col">{t('pieces.expression.table.result')}</th>
              </tr>
            </thead>
            <tbody>
              {judgements.map((j, i) => (
                <tr key={i}>
                  <th scope="row">{words.ornament(j)}</th>
                  <td>{words.bars(j)}</td>
                  <td>{names(j.keys, j)}</td>
                  <td>{names(j.heard, j)}</td>
                  <td>{words.ornamentVerdict(j).text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
