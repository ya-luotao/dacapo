import { useId, useMemo } from 'react';
import {
  MIN_RUNS,
  placesOverRuns,
  suggestedExercise,
  type ExerciseProgress,
  type IrregularPlace,
} from '../../core/scaleProgress.ts';
import { exerciseKey, parseExerciseKey, scaleNotes } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import { dayKey } from '../../core/streak.ts';
import { SENTENCE_GAP, useI18n } from '../../i18n/index.ts';
import { useScaleRuns } from '../practice/context.ts';
import { useLogFormat } from '../progress/format.ts';
import { spelledName, useExerciseName } from './format.ts';
import type { LoopPlace } from './loop.ts';
import { TrendChart } from './TrendChart.tsx';

/**
 * How this scale has gone so far: its runs, the latest and the best spread, the trend over the
 * last 30 days, and the places that are late or early every time over the last runs.
 */
export function ScaleProgress({
  exercise,
  progress,
  now,
  onLoop,
}: {
  exercise: ScaleExercise;
  /** Null: never recorded. */
  progress: ExerciseProgress | null;
  now: number;
  /** A focus loop round a place found over the runs. */
  onLoop?: (place: LoopPlace) => void;
}) {
  const { t, locale } = useI18n();
  const format = useLogFormat();
  const id = useId();
  const key = exerciseKey(exercise);
  const runs = useScaleRuns(key);
  const places = useMemo(() => (runs && runs.length > 0 ? placesOverRuns(runs) : null), [runs]);
  const names = useMemo(() => {
    const notes = scaleNotes(exercise);
    return {
      right: notes.right.map((n) => spelledName(n.pitch)),
      left: notes.left.map((n) => spelledName(n.pitch)),
    };
  }, [exercise]);
  const gap = SENTENCE_GAP[locale];
  const ms = (value: number | null | undefined) =>
    value === null || value === undefined ? '–' : t('scales.result.ms', { ms: Math.round(value) });

  if (!progress) {
    return (
      <section className="scale-progress" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`}>{t('scales.progress')}</h2>
        <p className="muted">{t('scales.progress.none')}</p>
      </section>
    );
  }

  const place = (p: IrregularPlace) => {
    const keys = p.indexes.map((i) => names[p.hand][i] ?? '').join(t('app.listSeparator'));
    const timing = t(p.irregularity > 0 ? 'scales.problem.late' : 'scales.problem.early', {
      ms: Math.round(Math.abs(p.irregularity)),
    });
    // Where there is no fingering the place is its notes, by degree.
    const text = p.crossing
      ? t(`scales.places.${p.crossing}.${p.direction}`, { keys, timing, runs: p.runs })
      : t(`scales.places.notes.${p.direction}`, { keys, timing, runs: p.runs });
    // Hands together, each hand has its own places: say which.
    return exercise.hands === 'both' || exercise.hands === 'contrary'
      ? t('scales.result.forHand', { hand: t(`scales.hand.${p.hand}`), text })
      : text;
  };

  /** Of a place's notes, the one furthest off over the runs: where its loop is centred. */
  const loopPlace = (p: IrregularPlace): LoopPlace => {
    let best = p.indexes[0]!;
    let most = -1;
    for (const index of p.indexes) {
      const figures = places?.places.find((f) => f.hand === p.hand && f.index === index);
      const off = figures ? Math.abs(figures.irregularity) : 0;
      if (off > most) {
        most = off;
        best = index;
      }
    }
    return { hand: p.hand, index: best };
  };

  let placesText: string | null;
  const named = places && places.runs >= MIN_RUNS ? places.irregular.slice(0, 2) : [];
  // While the runs are read there is nothing to say yet.
  if (runs === null) placesText = null;
  else if (!places || places.runs < MIN_RUNS)
    placesText = t('scales.places.notYet', { min: MIN_RUNS });
  else if (places.irregular.length === 0)
    placesText = t('scales.places.none', { runs: places.runs });
  else placesText = named.map(place).join(gap);

  return (
    <section className="scale-progress" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('scales.progress')}</h2>
      <dl className="figures">
        <div>
          <dt>{t('progress.session.runs')}</dt>
          <dd>{progress.runs}</dd>
        </div>
        <div>
          <dt>{t('scales.progress.latest')}</dt>
          <dd>{ms(progress.latest?.spread)}</dd>
        </div>
        <div>
          <dt>{t('scales.progress.best')}</dt>
          <dd>
            {ms(progress.best?.spread)}
            {progress.best?.rough && (
              <span className="scale-rough"> {t('scales.result.rough')}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>{t('scales.progress.last')}</dt>
          <dd className="scale-progress-when">{format.longDay(dayKey(progress.lastAt))}</dd>
        </div>
      </dl>
      {placesText && <p className="scale-verdict">{placesText}</p>}
      {onLoop && runs !== null && named.length > 0 && (
        <p className="scale-loop-offer">
          {named.map((p) => {
            const at = loopPlace(p);
            return (
              <button
                key={`${p.hand}:${p.direction}:${p.crossing ?? p.degree}`}
                type="button"
                className="button is-compact"
                onClick={() => onLoop(at)}
              >
                {t('scales.loop.around', { key: names[at.hand][at.index] ?? '' })}
              </button>
            );
          })}
        </p>
      )}
      {progress.days.length > 0 && <TrendChart days={progress.days} today={dayKey(now)} />}
    </section>
  );
}

/**
 * Every scale played, least even first (relative to its note length, over its last runs), with
 * the one to play next; choosing one sets it up.
 */
export function YourScales({
  list,
  now,
  current,
  onPick,
}: {
  list: readonly ExerciseProgress[];
  now: number;
  current: ScaleExercise;
  onPick: (exercise: ScaleExercise) => void;
}) {
  const { t, locale } = useI18n();
  const format = useLogFormat();
  const name = useExerciseName();
  const id = useId();
  const percent = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const suggestion = suggestedExercise(list, now);
  const suggested = suggestion ? parseExerciseKey(suggestion) : null;
  if (list.length === 0) return null;
  const currentKey = exerciseKey(current);

  const label = (e: ScaleExercise) =>
    t('progress.session.scaleOne', { scale: name(e), octaves: e.octaves }) +
    ` · ${t(`progress.session.hands.${e.hands}`)}`;

  return (
    <section className="scale-list" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('scales.list')}</h2>
      {suggested && exerciseKey(suggested) !== currentKey && (
        <p className="scale-suggestion">
          {t('scales.list.suggestion', { scale: label(suggested) })}{' '}
          <button type="button" className="button is-compact" onClick={() => onPick(suggested)}>
            {t('scales.list.play')}
          </button>
        </p>
      )}
      <div className="hm-table-scroll">
        <table className="history-table scale-list-table">
          <thead>
            <tr>
              <th scope="col">{t('scales.list.scale')}</th>
              <th scope="col">{t('progress.session.runs')}</th>
              <th scope="col">{t('scales.list.recent')}</th>
              <th scope="col">{t('scales.progress.best')}</th>
              <th scope="col">{t('scales.progress.last')}</th>
              <td />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const e = parseExerciseKey(p.exercise);
              if (!e) return null;
              const here = p.exercise === currentKey;
              return (
                <tr key={p.exercise} aria-current={here || undefined}>
                  <th scope="row">{label(e)}</th>
                  <td>{p.runs}</td>
                  <td>
                    {p.recentShare === null
                      ? '–'
                      : t('scales.result.percent', { percent: percent.format(p.recentShare) })}
                  </td>
                  <td>{p.best ? t('scales.result.ms', { ms: Math.round(p.best.spread) }) : '–'}</td>
                  <td>{format.longDay(dayKey(p.lastAt))}</td>
                  <td>
                    {!here && (
                      <button type="button" className="button is-compact" onClick={() => onPick(e)}>
                        {t('scales.list.play')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="help">{t('scales.list.help')}</p>
    </section>
  );
}
