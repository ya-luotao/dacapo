import type { LookAt } from '../../core/expression.ts';
import { useI18n } from '../../i18n/index.ts';
import type { VerdictLabel } from './expressionWords.ts';
import type { PieceFormat } from './format.ts';

// Parts the Expression panel's tabs share.

/** A verdict in words, coloured by its tone (the words say it too). */
export function Verdict({ label }: { label: VerdictLabel }) {
  return <span className={`expression-verdict is-${label.tone}`}>{label.text}</span>;
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
