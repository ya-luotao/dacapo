import { useId } from 'react';
import { HARMONY_LEVEL_IDS, type HarmonyLevelId } from '../../core/chordSymbols.ts';
import {
  HARMONY_MASTERY_MEDIAN_MS,
  HARMONY_MASTERY_WINDOW,
  type HarmonyLevelProgress,
} from '../../core/harmonySession.ts';
import { SESSION_LENGTHS, type SessionLength } from '../../core/session.ts';
import { useI18n } from '../../i18n/index.ts';
import { useReadFormat } from '../read/format.ts';
import { Segmented } from '../Segmented.tsx';
import { useHarmonyFormat } from './format.ts';

interface ChordsSetupProps {
  level: HarmonyLevelId;
  length: SessionLength;
  hint: boolean;
  progress: ReadonlyMap<HarmonyLevelId, HarmonyLevelProgress>;
  suggested: HarmonyLevelId;
  onLevel: (level: HarmonyLevelId) => void;
  onLength: (length: SessionLength) => void;
  onHint: (hint: boolean) => void;
  onStart: () => void;
}

/** The levels of Chords and the session's settings, laid out as Read's. */
export function ChordsSetup(props: ChordsSetupProps) {
  const { t, locale } = useI18n();
  const format = useHarmonyFormat();
  const id = useId();
  const seconds = new Intl.NumberFormat(locale).format(HARMONY_MASTERY_MEDIAN_MS / 1000);

  return (
    <form
      className="read-setup harmony-setup"
      onSubmit={(e) => {
        e.preventDefault();
        props.onStart();
      }}
    >
      <fieldset className="field" aria-describedby={`${id}-rule`}>
        <legend>{t('read.level')}</legend>
        <div className="levels">
          {HARMONY_LEVEL_IDS.map((level) => (
            <LevelOption
              key={level}
              name={`${id}-level`}
              level={level}
              checked={props.level === level}
              suggested={props.suggested === level}
              progress={props.progress.get(level)}
              onChange={() => props.onLevel(level)}
            />
          ))}
        </div>
        <p id={`${id}-rule`} className="help">
          {t('theory.level.rule', { seconds, window: HARMONY_MASTERY_WINDOW })}
        </p>
      </fieldset>

      {/* The session: beside the levels on a wide screen, as a card to start from. */}
      <div className="read-options">
        <p className="read-options-level" aria-hidden="true">
          <span className="level-id">{props.level}</span>
          <span>{format.levelName(props.level)}</span>
        </p>
        <Segmented
          legend={t('read.length')}
          name={`${id}-length`}
          options={SESSION_LENGTHS.map((length) => ({ value: length, label: String(length) }))}
          value={props.length}
          onChange={props.onLength}
        />

        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={props.hint}
              onChange={(e) => props.onHint(e.target.checked)}
              aria-describedby={`${id}-hint`}
            />
            <span>{t('harmony.hint')}</span>
          </label>
          <p id={`${id}-hint`} className="help">
            {t('harmony.hint.help')}
          </p>
        </div>

        <button type="submit" className="button button-primary read-start">
          {t('read.start')}
        </button>
      </div>
    </form>
  );
}

interface LevelOptionProps {
  name: string;
  level: HarmonyLevelId;
  checked: boolean;
  suggested: boolean;
  progress: HarmonyLevelProgress | undefined;
  onChange: () => void;
}

function LevelOption({ name, level, checked, suggested, progress, onChange }: LevelOptionProps) {
  const { t } = useI18n();
  const read = useReadFormat();
  const format = useHarmonyFormat();

  return (
    <label className={checked ? 'level is-checked' : 'level'}>
      <input type="radio" name={name} value={level} checked={checked} onChange={onChange} />
      <span className="level-id">{level}</span>
      <span className="level-body">
        <span className="level-name">{format.levelName(level)}</span>
        <span className="level-range">{format.levelDetail(level)}</span>
      </span>
      <span className="level-status">
        {progress?.mastered ? (
          <span className="badge is-mastered">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
            {t('read.level.mastered')}
          </span>
        ) : suggested ? (
          <span className="badge is-suggested">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5l4.5 4.5L6 12.5" />
            </svg>
            {t('read.level.suggested')}
          </span>
        ) : null}
        <span className="level-stats">
          {progress && progress.total > 0
            ? t('read.level.stats', {
                cards: progress.cards,
                window: HARMONY_MASTERY_WINDOW,
                accuracy: read.percent(progress.accuracy),
                median: read.seconds(progress.medianMs),
              })
            : t('read.level.new')}
        </span>
      </span>
    </label>
  );
}
