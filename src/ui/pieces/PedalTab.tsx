import { useMemo } from 'react';
import {
  CHANGE_MAX_MS,
  pedalToLookAt,
  RELEASE_MAX_MS,
  type ExpressionAnalysis,
} from '../../core/expression.ts';
import { useI18n } from '../../i18n/index.ts';
import { JudgedList, LookAtList } from './ExpressionParts.tsx';
import type { ExpressionWords } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';
import { PedalChart } from './PedalChart.tsx';

/**
 * The Pedal tab: the sustain pedal as played against the score's pedal marks (docs/EXPRESSION.md,
 * X3), una corda and sostenuto against their words, the bars to look at and a table.
 */
export function PedalTab({
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
  const { t, locale } = useI18n();
  const { pedal, rounds } = analysis;
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const places = useMemo(() => pedalToLookAt(pedal), [pedal]);
  const drawn = pedal.used || pedal.lines.sostenuto !== null || pedal.lines.unaCorda !== null;
  if (!drawn) return <p className="expression-note">{t('pieces.expression.pedal.unused')}</p>;

  const { judgements, corde } = pedal;
  const all = [...judgements, ...corde].sort((a, b) => a.round - b.round || a.tick - b.tick);
  const clean = judgements.filter((j) => j.verdict === 'clean').length;
  const count = (verdict: 'gap' | 'blur') => judgements.filter((j) => j.verdict === verdict).length;

  return (
    <>
      <dl className="figures expression-figures">
        {judgements.length > 0 && (
          <div>
            <dt>{t('pieces.expression.pedal.clean')}</dt>
            <dd>{t('pieces.expression.ofTotal', { n: clean, total: judgements.length })}</dd>
          </div>
        )}
        {judgements.length > 0 && (
          <div>
            <dt>{t('pieces.expression.pedal.gaps')}</dt>
            <dd>{count('gap')}</dd>
          </div>
        )}
        {judgements.length > 0 && (
          <div>
            <dt>{t('pieces.expression.pedal.blurs')}</dt>
            <dd>{count('blur')}</dd>
          </div>
        )}
        {pedal.down !== null && (
          <div>
            <dt>{t('pieces.expression.pedal.down')}</dt>
            <dd>{percent.format(pedal.down)}</dd>
          </div>
        )}
      </dl>

      <PedalChart
        slots={analysis.slots}
        pedal={pedal}
        rounds={rounds}
        format={format}
        words={words}
      />

      {!pedal.used && <p className="expression-note">{t('pieces.expression.pedal.unused')}</p>}

      <div className="expression-section">
        <h4>{t('pieces.expression.pedal.marks')}</h4>
        {!pedal.marked && corde.length === 0 ? (
          <p className="expression-note">{t('pieces.expression.pedal.unmarked')}</p>
        ) : all.length === 0 ? (
          pedal.used && <p className="expression-note">{t('pieces.expression.pedal.noneJudged')}</p>
        ) : (
          <JudgedList
            items={all}
            right={(j) => j.verdict === 'clean' || j.verdict === 'held'}
            what={(j) => words.pedalMark(j)}
            where={(j) => words.bars(j)}
            verdict={(j) => words.pedalVerdict(j)}
            folded={(n) =>
              t(
                n === 1
                  ? 'pieces.expression.pedal.folded.one'
                  : 'pieces.expression.pedal.folded.other',
                { n },
              )
            }
          />
        )}
        {pedal.marked && (
          <p className="help">
            {t('pieces.expression.pedal.help', { change: CHANGE_MAX_MS, release: RELEASE_MAX_MS })}
          </p>
        )}
      </div>

      {all.length > 0 && (
        <LookAtList
          places={places}
          format={format}
          describe={(p) => words.pedalProblem(p)}
          none={t('pieces.expression.pedal.allClean')}
          onLoopBars={onLoopBars}
        />
      )}

      <details className="history-details">
        <summary>{t('pieces.rhythm.table')}</summary>
        {all.length > 0 && (
          <div className="hm-table-scroll">
            <table className="history-table expression-table">
              <caption>{t('pieces.expression.pedal.marks')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('pieces.expression.table.marking')}</th>
                  <th scope="col">{t('pieces.rhythm.table.bar')}</th>
                  <th scope="col">{t('pieces.expression.table.result')}</th>
                </tr>
              </thead>
              <tbody>
                {all.map((j, i) => (
                  <tr key={i}>
                    <th scope="row">{words.pedalMark(j)}</th>
                    <td>{words.bars(j)}</td>
                    <td>{words.pedalVerdict(j).text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="hm-table-scroll">
          <table className="history-table expression-table">
            <caption>{t('pieces.expression.table.bars')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('pieces.rhythm.table.bar')}</th>
                <th scope="col">{t('pieces.expression.pedal.down')}</th>
                <th scope="col">{t('pieces.expression.pedal.clean')}</th>
                <th scope="col">{t('pieces.expression.pedal.gaps')}</th>
                <th scope="col">{t('pieces.expression.pedal.blurs')}</th>
                <th scope="col">{t('pieces.expression.pedal.missed')}</th>
              </tr>
            </thead>
            <tbody>
              {pedal.bars.map((bar) => (
                <tr key={`${bar.round}:${bar.played}`}>
                  <th scope="row">{words.barRow(bar, rounds)}</th>
                  <td>{bar.down === null ? '–' : percent.format(bar.down)}</td>
                  <td>
                    {bar.judged === 0
                      ? '–'
                      : t('pieces.expression.ofTotal', { n: bar.clean, total: bar.judged })}
                  </td>
                  <td>{bar.problems.gap || '–'}</td>
                  <td>{bar.problems.blur || '–'}</td>
                  <td>{bar.problems.missed || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
