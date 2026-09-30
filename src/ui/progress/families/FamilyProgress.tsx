import { useId, useMemo, useState } from 'react';
import type { Answer } from '../../../core/answers.ts';
import {
  ANSWER_FAMILIES,
  confusionMatrix,
  familyAnswers,
  familyLevels,
  filterAnswers,
  isFamilyLevel,
  itemFigures,
  MIN_ITEM_ANSWERS,
  topConfusions,
  weakestItems,
  type AnswerFamily,
  type AnswerFilter,
  type FamilyLevel,
  type ItemFigures,
} from '../../../core/answerProgress.ts';
import { ANSWER_MODES, type AnswerMode } from '../../../core/earSession.ts';
import { useT } from '../../../i18n/index.ts';
import { EmptyState } from '../../EmptyState.tsx';
import { useReadFormat } from '../../read/format.ts';
import { Segmented } from '../../Segmented.tsx';
import { useHeatFormat } from '../heatmap/format.ts';
import { ConfusionGrid } from './ConfusionGrid.tsx';
import { useFamilyFormat } from './format.tsx';
import { chooseSection, isSectionOpen, readSectionChoices, writeSectionChoices } from './prefs.ts';

const isEar = (family: AnswerFamily) =>
  family === 'interval' || family === 'chord' || family === 'echo';

/**
 * E4: a section for each family of the answers store (Ear's intervals, chords and melodies,
 * Read's intervals, key signatures and chords): its levels, its weakest items, and what is
 * answered instead. Only the family practised last is open at first; a section opened or folded
 * by hand stays so, remembered per browser.
 */
export function FamilyProgress({ answers }: { answers: readonly Answer[] }) {
  const t = useT();
  const id = useId();
  const [choices, setChoices] = useState(readSectionChoices);
  const families = useMemo(
    () => ANSWER_FAMILIES.filter((family) => answers.some((a) => a.family === family)),
    [answers],
  );
  // The family of the latest answer (the store keeps them in the order they happened).
  const latest = useMemo(() => {
    let last: Answer | null = null;
    for (const answer of answers) if (!last || answer.at >= last.at) last = answer;
    return last?.family ?? null;
  }, [answers]);

  function toggle(family: AnswerFamily, open: boolean) {
    // The toggle event also follows a change of `open` from here: only a change by hand counts.
    if (open === isSectionOpen(family, choices, latest)) return;
    const next = chooseSection(choices, family, open);
    setChoices(next);
    writeSectionChoices(next);
  }

  return (
    <section className="families" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('families.title')}</h2>
      {families.length === 0 ? (
        <EmptyState action={{ href: '/ear', label: t('families.empty.action') }}>
          {t('families.empty')}
        </EmptyState>
      ) : (
        <>
          <p className="help families-intro">{t('families.intro')}</p>
          {families.map((family) => (
            <FamilySection
              key={family}
              family={family}
              answers={answers}
              open={isSectionOpen(family, choices, latest)}
              onToggle={(open) => toggle(family, open)}
            />
          ))}
        </>
      )}
    </section>
  );
}

interface FamilySectionProps {
  family: AnswerFamily;
  answers: readonly Answer[];
  open: boolean;
  onToggle: (open: boolean) => void;
}

function FamilySection({ family, answers, open, onToggle }: FamilySectionProps) {
  const t = useT();
  const format = useFamilyFormat();
  const id = useId();
  const own = useMemo(() => familyAnswers(family, answers), [family, answers]);
  const levels = useMemo(() => familyLevels(family, own), [family, own]);
  const [filter, setFilter] = useState<AnswerFilter>({ level: 'all', by: 'all' });

  const answeredLevels = levels.filter((l) => l.total > 0).map((l) => l.level);
  const modes = ANSWER_MODES.filter((mode) => own.some((a) => a.by === mode));
  // A filter left over from answers that are gone (an import replaced them) falls back to all.
  const level =
    filter.level !== 'all' && answeredLevels.includes(filter.level) ? filter.level : 'all';
  const by =
    modes.length > 1 && filter.by !== 'all' && modes.includes(filter.by) ? filter.by : 'all';

  const shown = useMemo(() => filterAnswers(own, { level, by }), [own, level, by]);
  const items = useMemo(() => itemFigures(family, shown), [family, shown]);
  const matrix = useMemo(() => confusionMatrix(family, shown), [family, shown]);
  const top = useMemo(() => topConfusions(family, matrix), [family, matrix]);
  const mastered = levels.filter((l) => l.mastered).length;

  return (
    <details
      className="family"
      open={open}
      onToggle={(e) => onToggle(e.currentTarget.open)}
      aria-labelledby={`${id}-title`}
    >
      <summary>
        <h3 id={`${id}-title`}>{t(`families.family.${family}`)}</h3>
        <span className="family-meta">
          {t('families.summary', {
            answers:
              own.length === 1
                ? t('families.answers.one')
                : t('families.answers.other', { n: own.length }),
            mastered,
            levels: levels.length,
          })}
        </span>
      </summary>

      <div className="family-body">
        <LevelRow levels={levels} />

        <div className="hm-controls family-controls">
          <div className="hm-control">
            <label htmlFor={`${id}-level`}>{t('families.filter.level')}</label>
            <select
              id={`${id}-level`}
              value={level}
              onChange={(e) => {
                const value = e.target.value;
                setFilter({ ...filter, level: isFamilyLevel(family, value) ? value : 'all' });
              }}
            >
              <option value="all">{t('families.filter.level.all')}</option>
              {answeredLevels.map((l) => (
                <option key={l} value={l}>
                  {format.level(l)}
                </option>
              ))}
            </select>
          </div>
          {modes.length > 1 && (
            <Segmented<AnswerMode | 'all'>
              legend={t('families.filter.by')}
              name={`${id}-by`}
              className="hm-control family-by"
              options={[
                { value: 'all', label: t('families.filter.by.all') },
                ...modes.map((mode) => ({ value: mode, label: t(`families.filter.by.${mode}`) })),
              ]}
              value={by}
              onChange={(value) => setFilter({ ...filter, by: value })}
            />
          )}
        </div>

        {shown.length === 0 ? (
          <p className="muted">{t('families.emptyFilter')}</p>
        ) : (
          <>
            <Weakest family={family} items={items} />
            <ConfusionGrid family={family} matrix={matrix} top={top} />
            <ItemTable family={family} items={items} />
          </>
        )}
      </div>
    </details>
  );
}

/** Every level of the family in one row: mastered, its figures so far, or new. */
function LevelRow({ levels }: { levels: readonly FamilyLevel[] }) {
  const t = useT();
  const read = useReadFormat();
  const format = useFamilyFormat();

  return (
    <div className="family-levels-block">
      <h4 className="families-subhead">{t('families.levels')}</h4>
      <ol className="family-levels">
        {levels.map((l) => {
          const status = l.mastered
            ? t('read.level.mastered')
            : l.total === 0
              ? t('read.level.new')
              : t('families.level.figures', {
                  accuracy: read.percent(l.accuracy),
                  counted: l.counted,
                  window: l.window,
                });
          const state = l.mastered ? 'is-mastered' : l.total === 0 ? 'is-new' : 'is-started';
          return (
            <li key={l.level} className={`family-level ${state}`} title={format.levelName(l.level)}>
              <span className="family-level-id">
                {l.level}
                <span className="visually-hidden"> · {format.levelName(l.level)}:</span>
              </span>
              <span className="family-level-status">
                {l.mastered && (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                )}
                {status}
              </span>
              <span className="family-level-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(1, l.counted / l.window) * 100}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The three weakest items, with their figures. */
function Weakest({ family, items }: { family: AnswerFamily; items: readonly ItemFigures[] }) {
  const t = useT();
  const format = useFamilyFormat();
  const weakest = useMemo(() => weakestItems(items), [items]);

  return (
    <div className="family-weakest">
      <h4 className="families-subhead">{t('families.weakest')}</h4>
      {weakest.length === 0 ? (
        <p className="muted">{t('families.weakest.none', { n: MIN_ITEM_ANSWERS })}</p>
      ) : (
        <ol>
          {weakest.map((item) => (
            <li key={item.item}>
              <span className="family-item-name">{format.item(family, item.item)}</span>
              <span className="family-item-figures">
                {format.figures(family, item).map((part, i) => (
                  <span key={part}>
                    {i > 0 && ' · '}
                    <span className="family-item-figure">{part}</span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Every item's figures as a table, the weakest first, then those not ranked yet. */
function ItemTable({ family, items }: { family: AnswerFamily; items: readonly ItemFigures[] }) {
  const t = useT();
  const read = useReadFormat();
  const heat = useHeatFormat();
  const format = useFamilyFormat();
  const rows = useMemo(
    () => [
      ...weakestItems(items, items.length),
      ...items.filter((item) => item.answers < MIN_ITEM_ANSWERS),
    ],
    [items],
  );

  return (
    <details className="history-details family-items">
      <summary>{t('families.items')}</summary>
      <p className="help">{t('families.items.help')}</p>
      <div className="hm-table-scroll">
        <table className="history-table">
          <thead>
            <tr>
              <th scope="col">{t('families.items.item')}</th>
              <th scope="col">{t('heatmap.table.recent')}</th>
              <th scope="col">{t('families.items.median')}</th>
              <th scope="col">
                {t(isEar(family) ? 'families.items.replays' : 'families.items.hints')}
              </th>
              <th scope="col">{t('heatmap.table.attempts')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.item}>
                <th scope="row">{format.item(family, item.item)}</th>
                <td>{heat.shortRatio(item.recentCorrect, item.recentCount)}</td>
                <td>{read.seconds(item.medianMs)}</td>
                <td>{item.aids}</td>
                <td>{item.answers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
