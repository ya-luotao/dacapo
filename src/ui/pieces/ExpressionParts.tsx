import type { LookAt } from '../../core/expression.ts';
import { useI18n } from '../../i18n/index.ts';
import type { VerdictLabel } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

// Parts the Expression panel's tabs share.

/** A verdict in words, coloured by its tone (the words say it too). */
export function Verdict({ label }: { label: VerdictLabel }) {
  return <span className={`expression-verdict is-${label.tone}`}>{label.text}</span>;
}

/** Up to this many marks played right are listed with the rest; more fold into one line. */
const FOLD_OVER = 3;

/**
 * Every judged mark in words: those that need attention first and in full, those played right
 * folded into one line that opens to list them (unless there are only a few). The table view
 * keeps them all.
 */
export function JudgedList<T>({
  items,
  right,
  what,
  where,
  verdict,
  folded,
}: {
  items: readonly T[];
  /** Played as marked: folded away when there are many. */
  right: (item: T) => boolean;
  what: (item: T) => string;
  where: (item: T) => string;
  verdict: (item: T) => VerdictLabel;
  /** The folded line, for `n` marks played right. */
  folded: (n: number) => string;
}) {
  const fine = items.filter(right);
  const fold = fine.length > FOLD_OVER;
  const shown = fold ? items.filter((item) => !right(item)) : items;
  const row = (item: T, i: number) => (
    <li key={i}>
      <span className="expression-what">
        <span className="expression-marking">{what(item)}</span>
        <span className="expression-where">{where(item)}</span>
      </span>
      <Verdict label={verdict(item)} />
    </li>
  );
  return (
    <>
      {shown.length > 0 && <ul className="expression-judgements">{shown.map(row)}</ul>}
      {fold && (
        <details className="history-details expression-fold">
          <summary>{folded(fine.length)}</summary>
          <ul className="expression-judgements">{fine.map(row)}</ul>
        </details>
      )}
    </>
  );
}

const capitalise = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** The worst three places, each with what went wrong there and a button to loop it. */
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
