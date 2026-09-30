import { useId } from 'react';
import { ANSWER_MODES, type AnswerMode } from '../../core/earSession.ts';
import { SESSION_LENGTHS, type SessionLength } from '../../core/session.ts';
import {
  theoryLevelsOf,
  type TheoryFamily,
  type TheoryLevel,
  type TheoryLevelId,
} from '../../core/theoryItems.ts';
import {
  THEORY_MASTERY_WINDOW,
  theoryMasteryMedianMs,
  type TheoryLevelProgress,
} from '../../core/theorySession.ts';
import { useI18n } from '../../i18n/index.ts';
import { Segmented } from '../Segmented.tsx';
import { useReadFormat } from './format.ts';
import { useTheoryFormat } from './theoryFormat.ts';

interface TheorySetupProps {
  family: TheoryFamily;
  level: TheoryLevelId;
  length: SessionLength;
  hint: boolean;
  chordBy: AnswerMode;
  progress: ReadonlyMap<TheoryLevelId, TheoryLevelProgress>;
  suggested: TheoryLevelId;
  onLevel: (level: TheoryLevelId) => void;
  onLength: (length: SessionLength) => void;
  onHint: (hint: boolean) => void;
  onChordBy: (by: AnswerMode) => void;
  onStart: () => void;
}

/** The levels of one kind of theory card and the session's settings, laid out as Read's. */
export function TheorySetup(props: TheorySetupProps) {
  const { t, locale } = useI18n();
  const format = useTheoryFormat();
  const id = useId();
  const seconds = new Intl.NumberFormat(locale).format(theoryMasteryMedianMs(props.family) / 1000);

  return (
    <form
      className="read-setup theory-setup"
      onSubmit={(e) => {
        e.preventDefault();
        props.onStart();
      }}
    >
      <fieldset className="field" aria-describedby={`${id}-rule`}>
        <legend>{t('read.level')}</legend>
        <div className="levels">
          {theoryLevelsOf(props.family).map((level) => (
            <LevelOption
              key={level.id}
              name={`${id}-level`}
              level={level}
              checked={props.level === level.id}
              suggested={props.suggested === level.id}
              progress={props.progress.get(level.id)}
              onChange={() => props.onLevel(level.id)}
            />
          ))}
        </div>
        <p id={`${id}-rule`} className="help">
          {t('theory.level.rule', { seconds, window: THEORY_MASTERY_WINDOW })}
        </p>
      </fieldset>

      {/* The session: beside the levels on a wide screen, as a card to start from. */}
      <div className="read-options">
        <p className="read-options-level" aria-hidden="true">
          <span className="level-id">{props.level}</span>
          <span>{format.levelName(props.level)}</span>
        </p>
        {props.family === 'readChord' && (
          <Segmented
            legend={t('ear.by')}
            name={`${id}-by`}
            options={ANSWER_MODES.map((by) => ({ value: by, label: t(`ear.by.${by}`) }))}
            value={props.chordBy}
            onChange={props.onChordBy}
            help={t(`theory.by.${props.chordBy}.help`)}
          />
        )}
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
            <span>{t('read.hint')}</span>
          </label>
          <p id={`${id}-hint`} className="help">
            {t(
              props.family === 'keySignature'
                ? 'theory.hint.help.keySignature'
                : 'theory.hint.help',
            )}
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
  level: TheoryLevel;
  checked: boolean;
  suggested: boolean;
  progress: TheoryLevelProgress | undefined;
  onChange: () => void;
}

function LevelOption({ name, level, checked, suggested, progress, onChange }: LevelOptionProps) {
  const { t } = useI18n();
  const read = useReadFormat();
  const format = useTheoryFormat();

  return (
    <label className={checked ? 'level is-checked' : 'level'}>
      <input type="radio" name={name} value={level.id} checked={checked} onChange={onChange} />
      <span className="level-id">{level.id}</span>
      <span className="level-body">
        <span className="level-name">{format.levelName(level.id)}</span>
        <span className="level-range">{format.levelDetail(level.id)}</span>
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
                window: THEORY_MASTERY_WINDOW,
                accuracy: read.percent(progress.accuracy),
                median: read.seconds(progress.medianMs),
              })
            : t('read.level.new')}
        </span>
      </span>
    </label>
  );
}
