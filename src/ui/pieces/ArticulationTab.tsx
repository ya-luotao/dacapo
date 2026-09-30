import { useMemo } from 'react';
import {
  ARTICULATION_PROBLEMS,
  articulationToLookAt,
  type ArticulationSlip,
  type ExpressionAnalysis,
} from '../../core/expression.ts';
import { useI18n } from '../../i18n/index.ts';
import { ArticulationChart } from './ArticulationChart.tsx';
import { LookAtList, Verdict } from './ExpressionParts.tsx';
import type { ExpressionWords } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

/**
 * The Articulation tab: how long each note was held against its touch (docs/EXPRESSION.md, X2),
 * the share per bar, what went wrong, the bars to look at and a table.
 */
export function ArticulationTab({
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
  const { articulation, rounds } = analysis;
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const places = useMemo(() => articulationToLookAt(articulation), [articulation]);
  // What went wrong over the run, by touch and how.
  const slips = useMemo(() => {
    const counts = new Map<string, ArticulationSlip>();
    for (const n of articulation.notes) {
      if (n.verdict === 'right') continue;
      const id = `${n.touch}:${n.verdict}`;
      const slip = counts.get(id) ?? { touch: n.touch, verdict: n.verdict, count: 0 };
      slip.count++;
      counts.set(id, slip);
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
  }, [articulation]);

  const pedalNote =
    articulation.pedalled > 0 &&
    t(
      articulation.pedalled === 1
        ? 'pieces.expression.articulation.pedalled.one'
        : 'pieces.expression.articulation.pedalled.other',
      { n: articulation.pedalled },
    );
  if (articulation.judged === 0)
    return (
      <p className="expression-note">
        {t('pieces.expression.articulation.none')}
        {pedalNote && ` ${pedalNote}`}
      </p>
    );

  return (
    <>
      <dl className="figures expression-figures">
        <div>
          <dt>{t('pieces.expression.articulation.asWritten')}</dt>
          <dd>{percent.format(articulation.right / articulation.judged)}</dd>
        </div>
        <div>
          <dt>{t('pieces.expression.articulation.judged')}</dt>
          <dd>{articulation.judged}</dd>
        </div>
        <div>
          <dt>{t('pieces.expression.articulation.pedal')}</dt>
          <dd>{articulation.pedalled}</dd>
        </div>
      </dl>

      <ArticulationChart
        slots={analysis.slots}
        articulation={articulation}
        rounds={rounds}
        format={format}
        words={words}
      />

      <div className="expression-section">
        <h4>{t('pieces.expression.articulation.wrong')}</h4>
        {slips.length === 0 ? (
          <p className="expression-note">{t('pieces.expression.articulation.allRight')}</p>
        ) : (
          <ul className="expression-judgements">
            {slips.map((s) => (
              <li key={`${s.touch}:${s.verdict}`}>
                <span className="expression-what">
                  <span className="expression-marking">{words.touch(s.touch)}</span>
                  <span className="expression-where">
                    {t(
                      s.count === 1
                        ? 'pieces.expression.articulation.notes.one'
                        : 'pieces.expression.articulation.notes.other',
                      { n: s.count },
                    )}
                  </span>
                </span>
                <Verdict label={words.held(s.verdict)} />
              </li>
            ))}
          </ul>
        )}
        <p className="help">
          {t(
            analysis.mode === 'rhythm'
              ? 'pieces.expression.articulation.help.rhythm'
              : 'pieces.expression.articulation.help.wait',
          )}
          {pedalNote && ` ${pedalNote}`}
        </p>
      </div>

      {places.length > 0 && (
        <LookAtList
          places={places}
          format={format}
          describe={(slip) => words.slip(slip)}
          none={t('pieces.expression.articulation.allRight')}
          onLoopBars={onLoopBars}
        />
      )}

      <details className="history-details">
        <summary>{t('pieces.rhythm.table')}</summary>
        <div className="hm-table-scroll">
          <table className="history-table expression-table">
            <thead>
              <tr>
                <th scope="col">{t('pieces.rhythm.table.bar')}</th>
                <th scope="col">{t('pieces.expression.articulation.judged')}</th>
                <th scope="col">{t('pieces.expression.articulation.asWritten')}</th>
                {ARTICULATION_PROBLEMS.map((p) => (
                  <th key={p} scope="col">
                    {t(`pieces.expression.held.${p}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {articulation.bars.map((bar) => (
                <tr key={`${bar.round}:${bar.played}`}>
                  <th scope="row">{words.barRow(bar, rounds)}</th>
                  <td>{bar.judged}</td>
                  <td>{bar.judged === 0 ? '–' : percent.format(bar.right / bar.judged)}</td>
                  {ARTICULATION_PROBLEMS.map((p) => (
                    <td key={p}>{bar.problems[p] || '–'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
