import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  dynamicsToLookAt,
  MELODIES,
  type ExpressionAnalysis,
  type Melody,
} from '../../core/expression.ts';
import type { HandSelection } from '../../core/score.ts';
import { useI18n } from '../../i18n/index.ts';
import { ArticulationTab } from './ArticulationTab.tsx';
import { DynamicsChart } from './DynamicsChart.tsx';
import { JudgedList, LookAtList } from './ExpressionParts.tsx';
import type { ExpressionAspect } from './expressionPrefs.ts';
import { BALANCE_GLYPH, useExpressionWords, type ExpressionWords } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';
import { OrnamentsTab } from './OrnamentsTab.tsx';
import { PedalTab } from './PedalTab.tsx';

// The Expression panel of a run (docs/EXPRESSION.md, "UI"): a tab per aspect measured, each with
// its chart under the bar numbers, its figures, every judged marking in words, the bars to look
// at (each loopable) and a table view. Shown in the summary of a run and for a past run.

export type { ExpressionAspect } from './expressionPrefs.ts';

interface ExpressionPanelProps {
  analysis: ExpressionAnalysis;
  format: PieceFormat;
  hands: HandSelection;
  melody: Melody;
  /** The aspects judged (a per-browser choice); at least one. */
  aspects: readonly ExpressionAspect[];
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
  aspects,
  onMelody,
  onLoopBars,
  footer,
}: ExpressionPanelProps) {
  const { t } = useI18n();
  const id = useId();
  // Ornaments have a tab only when the score has some for the hands played.
  const shown = aspects.filter((a) => a !== 'ornaments' || analysis.ornaments.inScore);
  // Without measured velocity there is nothing to see under Dynamics: open on the next aspect.
  const [chosen, setAspect] = useState<ExpressionAspect>(
    () =>
      shown.find((a) => a !== 'dynamics' || analysis.dynamics.velocityMeasured) ??
      shown[0] ??
      'dynamics',
  );
  const aspect = shown.includes(chosen) ? chosen : shown[0];
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabList = useRef<HTMLDivElement>(null);
  // On a phone the tabs scroll sideways in one row: keep the chosen one in view, without moving
  // the page (as scrollIntoView would).
  const index = aspect ? shown.indexOf(aspect) : -1;
  useEffect(() => {
    const list = tabList.current;
    const tab = tabs.current[index];
    if (!list || !tab) return;
    const start = tab.offsetLeft;
    const end = start + tab.offsetWidth;
    if (start < list.scrollLeft) list.scrollLeft = start;
    else if (end > list.scrollLeft + list.clientWidth) list.scrollLeft = end - list.clientWidth;
  }, [index]);
  const words = useExpressionWords(format);

  // Arrow keys move between the tabs (and wrap), Home and End go to the first and the last.
  function onTabKey(e: KeyboardEvent, index: number) {
    const last = shown.length - 1;
    const to =
      e.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : e.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (to === null) return;
    e.preventDefault();
    setAspect(shown[to]!);
    tabs.current[to]?.focus();
  }

  if (!aspect) return null;
  return (
    <section className="expression" aria-labelledby={`${id}-title`}>
      <div className="expression-head">
        <h3 id={`${id}-title`}>{t('pieces.expression')}</h3>
        <div
          ref={tabList}
          className="expression-tabs"
          role="tablist"
          aria-labelledby={`${id}-title`}
        >
          {shown.map((a, i) => (
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
        {aspect === 'dynamics' ? (
          <DynamicsTab
            analysis={analysis}
            format={format}
            words={words}
            hands={hands}
            melody={melody}
            onMelody={onMelody}
            onLoopBars={onLoopBars}
          />
        ) : aspect === 'articulation' ? (
          <ArticulationTab
            analysis={analysis}
            format={format}
            words={words}
            onLoopBars={onLoopBars}
          />
        ) : aspect === 'pedal' ? (
          <PedalTab analysis={analysis} format={format} words={words} onLoopBars={onLoopBars} />
        ) : (
          <OrnamentsTab analysis={analysis} format={format} words={words} onLoopBars={onLoopBars} />
        )}
      </div>
      {footer}
    </section>
  );
}

function DynamicsTab({
  analysis,
  format,
  words,
  hands,
  melody,
  onMelody,
  onLoopBars,
}: {
  analysis: ExpressionAnalysis;
  format: PieceFormat;
  words: ExpressionWords;
  hands: HandSelection;
  melody: Melody;
  onMelody?: (melody: Melody) => void;
  onLoopBars?: (from: number, to: number) => void;
}) {
  const { t, locale } = useI18n();
  const { dynamics, rounds } = analysis;
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

      <DynamicsChart slots={analysis.slots} dynamics={dynamics} format={format} words={words} />

      <div className="expression-section">
        <h4>{t('pieces.expression.markings')}</h4>
        {!dynamics.marked ? (
          <p className="expression-note">{t('pieces.expression.unmarked')}</p>
        ) : judgements.length === 0 ? (
          <p className="expression-note">
            {t(dynamics.changes ? 'pieces.expression.noneJudged' : 'pieces.expression.noChange')}
          </p>
        ) : (
          <JudgedList
            items={judgements}
            right={(j) => j.verdict === 'right'}
            what={(j) => words.marking(j)}
            where={(j) => words.bars(j)}
            verdict={(j) => words.verdict(j)}
            folded={(n) =>
              t(n === 1 ? 'pieces.expression.folded.one' : 'pieces.expression.folded.other', { n })
            }
          />
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
                    <th scope="row">{words.barRow(bar, rounds)}</th>
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
        <p className="help">{t('pieces.expression.table.help')}</p>
      </details>
    </>
  );
}

const signed = (v: number) => (Math.round(v) > 0 ? `+${Math.round(v)}` : String(Math.round(v)));
