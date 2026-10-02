import { useEffect, useRef, type CSSProperties } from 'react';
import { STEADY_RUNS } from '../../core/barHeatmap.ts';
import type { PiecePlan, PlanStage } from '../../core/piecePlan.ts';
import { useT } from '../../i18n/index.ts';
import type { PieceFormat } from './format.ts';
import { usePlanWords, type PlanWords } from './planWords.ts';

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

function Tick() {
  return (
    <svg className="plan-tick" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

/**
 * A piece's plan (docs/PIECES.md, "A piece's plan"): one line saying what comes next, with the
 * button that starts it, and the phrases as rows with their stages as columns. Each cell is a
 * button that sets the loop, the hands, the mode and the tempo and starts the run, with a tick
 * once its stage is done; the stages are in the order they are worked, and any can be started.
 */
export function PlanPanel({
  plan,
  format,
  onStart,
}: {
  /** Null while the piece's records are being read. */
  plan: PiecePlan | null;
  format: PieceFormat;
  onStart: (stage: PlanStage) => void;
}) {
  const t = useT();
  const words = usePlanWords(format);
  const next = plan?.next ?? null;

  // The next step's row is brought into the panel's own view when it changes: a long piece has
  // more phrases than the panel shows at once. The page itself is not scrolled.
  const scroller = useRef<HTMLDivElement>(null);
  const at = next ? `${next.phrase ?? 'whole'}` : null;
  useEffect(() => {
    const frame = scroller.current;
    const row = frame?.querySelector<HTMLElement>('tr.is-next');
    if (!frame || !row) return;
    const head = frame.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const top = row.offsetTop - head;
    const bottom = row.offsetTop + row.offsetHeight;
    if (top < frame.scrollTop) frame.scrollTop = top;
    else if (bottom > frame.scrollTop + frame.clientHeight)
      frame.scrollTop = bottom - frame.clientHeight;
  }, [at]);

  return (
    <div className="piece-plan" role="region" aria-label={t('pieces.plan')}>
      <div className="piece-plan-lead">
        <p className="piece-plan-next" aria-live="polite">
          {plan === null ? (
            <span className="muted">{t('pieces.weak.loading')}</span>
          ) : next ? (
            <>
              <span>{t('pieces.plan.next', { step: words.step(next) })}</span>
              <button type="button" className="button is-compact" onClick={() => onStart(next)}>
                {t('pieces.plan.start')}
              </button>
            </>
          ) : (
            <span>{t('pieces.plan.done')}</span>
          )}
        </p>
        <p className="muted piece-plan-how">{t('pieces.plan.how', { n: STEADY_RUNS })}</p>
      </div>
      {plan && (
        <div className="piece-plan-scroll" ref={scroller}>
          {/* The roles say again what the elements are: on a phone the rows are laid out as
              grids, and a table that is not displayed as one may lose its meaning. */}
          <table
            role="table"
            className="piece-plan-grid"
            style={{ '--stages': plan.stages.length } as CSSProperties}
          >
            <caption className="visually-hidden">{t('pieces.plan.table')}</caption>
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">
                  {t('pieces.plan.phrase')}
                </th>
                {plan.stages.map((stage) => (
                  <th key={stage} role="columnheader" scope="col">
                    {words.stage(stage)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody role="rowgroup">
              {plan.rows.map((row, index) => (
                <tr
                  key={row.phrase.from}
                  role="row"
                  className={next?.phrase === index ? 'is-next' : undefined}
                >
                  <th role="rowheader" scope="row">
                    {words.phrase(row.phrase)}
                  </th>
                  {row.stages.map((stage, column) => (
                    <td key={plan.stages[column]} role="cell">
                      {stage && (
                        <Cell stage={stage} next={stage === next} words={words} onStart={onStart} />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr role="row" className={next === plan.whole ? 'is-next is-whole' : 'is-whole'}>
                <th role="rowheader" scope="row">
                  {words.stage('whole')}
                </th>
                <td role="cell" colSpan={plan.stages.length}>
                  <span className="plan-whole">
                    <Cell
                      stage={plan.whole}
                      next={next === plan.whole}
                      words={words}
                      onStart={onStart}
                    />
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** A stage as a button that starts it: a tick once it is done, the arrow before. */
function Cell({
  stage,
  next,
  words,
  onStart,
}: {
  stage: PlanStage;
  /** The plan's next step. */
  next: boolean;
  words: PlanWords;
  onStart: (stage: PlanStage) => void;
}) {
  const t = useT();
  const label = t(stage.done ? 'pieces.plan.cell.done' : 'pieces.plan.cell.start', {
    step: words.step(stage),
  });
  const state = stage.done ? ' is-done' : next ? ' is-next' : '';
  return (
    <button
      type="button"
      className={`plan-cell${state}`}
      aria-label={label}
      aria-current={next ? 'step' : undefined}
      title={label}
      onClick={() => onStart(stage)}
    >
      {stage.done ? <Tick /> : <Arrow />}
    </button>
  );
}
