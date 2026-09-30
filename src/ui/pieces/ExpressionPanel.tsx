import { useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import {
  dynamicsToLookAt,
  MELODIES,
  type DynamicsAnalysis,
  type ExpressionAnalysis,
  type LookAt,
  type Melody,
} from '../../core/expression.ts';
import type { HandSelection } from '../../core/score.ts';
import { useI18n } from '../../i18n/index.ts';
import { DynamicsChart } from './DynamicsChart.tsx';
import {
  BALANCE_GLYPH,
  useExpressionWords,
  type ExpressionWords,
  type VerdictLabel,
} from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

// The Expression panel of a run (docs/EXPRESSION.md, "UI"): a tab per aspect measured, each with
// its chart under the bar numbers, its figures, every judged marking in words, the bars to look
// at (each loopable) and a table view. Shown in the summary of a run and for a past run.

export type ExpressionAspect = 'dynamics';

interface ExpressionPanelProps {
  analysis: ExpressionAnalysis;
  format: PieceFormat;
  hands: HandSelection;
  melody: Melody;
  /** Changes the piece's melody (for the balance); absent: not offered. */
  onMelody?: (melody: Melody) => void;
  /** Loops written bars; absent: the bars are listed without a button. */
  onLoopBars?: (from: number, to: number) => void;
  /** Development only: what goes below the panel (the "Save this run" button). */
  footer?: ReactNode;
}

export function ExpressionPanel({
  analysis,
  format,
  hands,
  melody,
  onMelody,
  onLoopBars,
  footer,
}: ExpressionPanelProps) {
  const { t } = useI18n();
  const id = useId();
  const aspects: ExpressionAspect[] = ['dynamics'];
  const [aspect, setAspect] = useState<ExpressionAspect>('dynamics');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const words = useExpressionWords(format);

  function onTabKey(e: KeyboardEvent, index: number) {
    const move =
      e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -index : 0;
    const to =
      e.key === 'End' ? aspects.length - 1 : (index + move + aspects.length) % aspects.length;
    if (move === 0 && e.key !== 'End') return;
    e.preventDefault();
    setAspect(aspects[to]!);
    tabs.current[to]?.focus();
  }

  return (
    <section className="expression" aria-labelledby={`${id}-title`}>
      <div className="expression-head">
        <h3 id={`${id}-title`}>{t('pieces.expression')}</h3>
        <div className="expression-tabs" role="tablist" aria-labelledby={`${id}-title`}>
          {aspects.map((a, i) => (
            <button
              key={a}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${a}`}
              aria-selected={aspect === a}
              aria-controls={`${id}-panel-${a}`}
              tabIndex={aspect === a ? 0 : -1}
              className="expression-tab"
              onClick={() => setAspect(a)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t(`pieces.expression.${a}`)}
            </button>
          ))}
        </div>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-${aspect}`}
        aria-labelledby={`${id}-tab-${aspect}`}
        className="expression-panel"
      >
        <DynamicsTab
          dynamics={analysis.dynamics}
          rounds={analysis.rounds}
          format={format}
          words={words}
          hands={hands}
          melody={melody}
          onMelody={onMelody}
          onLoopBars={onLoopBars}
        />
      </div>
      {footer}
    </section>
  );
}

function Verdict({ label }: { label: VerdictLabel }) {
  return <span className={`expression-verdict is-${label.tone}`}>{label.text}</span>;
}

function DynamicsTab({
  dynamics,
  rounds,
  format,
  words,
  hands,
  melody,
  onMelody,
  onLoopBars,
}: {
  dynamics: DynamicsAnalysis;
  rounds: number;
  format: PieceFormat;
  words: ExpressionWords;
  hands: HandSelection;
  melody: Melody;
  onMelody?: (melody: Melody) => void;
  onLoopBars?: (from: number, to: number) => void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const places = useMemo(() => dynamicsToLookAt(dynamics), [dynamics]);

  if (!dynamics.velocityMeasured)
    return <p className="expression-note">{t('pieces.expression.noVelocity')}</p>;
  if (!dynamics.range) return <p className="expression-note">{t('pieces.expression.nothing')}</p>;

  const { judgements, balance } = dynamics;
  const right = judgements.filter((j) => j.verdict === 'right').length;

  return (
    <>
      <dl className="figures expression-figures">
        <div>
          <dt>{t('pieces.expression.range')}</dt>
          <dd>
            {t('pieces.expression.range.value', {
              low: Math.round(dynamics.range.low),
              high: Math.round(dynamics.range.high),
            })}
          </dd>
        </div>
        {judgements.length > 0 && (
          <div>
            <dt>{t('pieces.expression.markingsRight')}</dt>
            <dd>{t('pieces.expression.ofTotal', { n: right, total: judgements.length })}</dd>
          </div>
        )}
        {balance && (
          <div>
            <dt>{t('pieces.expression.melodyOnTop')}</dt>
            <dd>{percent.format(balance.balanced / balance.groups)}</dd>
          </div>
        )}
      </dl>

      <DynamicsChart dynamics={dynamics} format={format} words={words} />

      <div className="expression-section">
        <h4>{t('pieces.expression.markings')}</h4>
        {!dynamics.marked ? (
          <p className="expression-note">{t('pieces.expression.unmarked')}</p>
        ) : judgements.length === 0 ? (
          <p className="expression-note">
            {t(dynamics.changes ? 'pieces.expression.noneJudged' : 'pieces.expression.noChange')}
          </p>
        ) : (
          <ul className="expression-judgements">
            {judgements.map((j, i) => (
              <li key={i}>
                <span className="expression-what">
                  <span className="expression-marking">{words.marking(j)}</span>
                  <span className="expression-where">{words.bars(j)}</span>
                </span>
                <Verdict label={words.verdict(j)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="expression-section">
        <h4>{t('pieces.expression.balance')}</h4>
        {balance ? (
          <p className="expression-note">
            {t('pieces.expression.balance.summary', {
              n: balance.balanced,
              total: balance.groups,
            })}
          </p>
        ) : (
          <p className="expression-note">
            {t(
              hands === 'both'
                ? 'pieces.expression.balance.apart'
                : 'pieces.expression.balance.oneHand',
            )}
          </p>
        )}
        {onMelody && hands === 'both' && (
          <label className="expression-melody">
            <span>{t('pieces.expression.melody')}</span>
            <select
              className="is-compact"
              value={melody}
              onChange={(e) => onMelody(e.target.value as Melody)}
            >
              {MELODIES.map((m) => (
                <option key={m} value={m}>
                  {t(`pieces.expression.melody.${m}`)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <LookAtList
        places={places}
        format={format}
        describe={(p) => words.problem(p)}
        none={t('pieces.expression.lookAt.none')}
        onLoopBars={onLoopBars}
      />

      <details className="history-details">
        <summary>{t('pieces.rhythm.table')}</summary>
        {judgements.length > 0 && (
          <div className="hm-table-scroll">
            <table className="history-table expression-table">
              <caption>{t('pieces.expression.markings')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('pieces.expression.table.marking')}</th>
                  <th scope="col">{t('pieces.rhythm.table.bar')}</th>
                  <th scope="col">{t('pieces.expression.table.change')}</th>
                  <th scope="col">{t('pieces.expression.table.needed')}</th>
                  <th scope="col">{t('pieces.expression.table.result')}</th>
                </tr>
              </thead>
              <tbody>
                {judgements.map((j, i) => {
                  const change = j.kind === 'accent' ? j.margin : j.change;
                  return (
                    <tr key={i}>
                      <th scope="row">{words.marking(j)}</th>
                      <td>{format.barSpan(j.bars.from, j.bars.to)}</td>
                      <td>{change === null ? '–' : signed(change)}</td>
                      <td>{Math.round(j.needed)}</td>
                      <td>{words.verdict(j).text}</td>
                    </tr>
                  );
                })}
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
                <th scope="col">{words.hand('right')}</th>
                <th scope="col">{words.hand('left')}</th>
                {balance && <th scope="col">{t('pieces.expression.balance')}</th>}
              </tr>
            </thead>
            <tbody>
              {dynamics.bars.map((bar) => {
                const verdict = balance?.bars.find((b) => b.measure === bar.measure)?.verdict;
                return (
                  <tr key={`${bar.round}:${bar.played}`}>
                    <th scope="row">
                      {rounds > 1
                        ? t('pieces.rhythm.table.round', {
                            bar: format.barShort(bar.measure),
                            n: bar.round + 1,
                          })
                        : format.barShort(bar.measure)}
                    </th>
                    <td>{bar.right === null ? '–' : Math.round(bar.right)}</td>
                    <td>{bar.left === null ? '–' : Math.round(bar.left)}</td>
                    {balance && (
                      <td>
                        {verdict ? (
                          <>
                            <span aria-hidden="true">{BALANCE_GLYPH[verdict]}</span>{' '}
                            {words.balance(verdict)}
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="help" id={`${id}-units`}>
          {t('pieces.expression.table.help')}
        </p>
      </details>
    </>
  );
}

const signed = (v: number) => (Math.round(v) > 0 ? `+${Math.round(v)}` : String(Math.round(v)));

/** The worst three places, each with what went wrong and a button to loop it. */
export function LookAtList<T>({
  places,
  format,
  describe,
  none,
  onLoopBars,
}: {
  places: readonly LookAt<T>[];
  format: PieceFormat;
  describe: (problem: T) => string;
  none: string;
  onLoopBars?: (from: number, to: number) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="expression-section">
      <h4>{t('pieces.expression.lookAt')}</h4>
      {places.length === 0 ? (
        <p className="expression-note">{none}</p>
      ) : (
        <ol className="expression-look">
          {places.map((place) => (
            <li key={`${place.bars.from}-${place.bars.to}`}>
              <div>
                <strong>
                  {place.bars.from === place.bars.to
                    ? format.barTitle(place.bars.from)
                    : capitalise(format.barSpan(place.bars.from, place.bars.to))}
                </strong>
                <ul>
                  {place.problems.map((p, i) => (
                    <li key={i}>{describe(p)}</li>
                  ))}
                </ul>
              </div>
              {onLoopBars && (
                <button
                  type="button"
                  className="button is-compact"
                  onClick={() => onLoopBars(place.bars.from, place.bars.to)}
                >
                  {place.bars.from === place.bars.to
                    ? t('pieces.done.loopBar', { bar: format.barLabel(place.bars.from) })
                    : t('pieces.rhythm.loopBars', {
                        bars: format.barSpan(place.bars.from, place.bars.to),
                      })}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const capitalise = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);
