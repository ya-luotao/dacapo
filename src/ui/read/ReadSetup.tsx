import { useId } from 'react';
import { LEVELS, type Level, type LevelId } from '../../core/levels.ts';
import { MASTERY_WINDOW, type LevelProgress } from '../../core/mastery.ts';
import { formatPitch } from '../../core/note.ts';
import { SESSION_LENGTHS, type SessionLength } from '../../core/session.ts';
import { useT } from '../../i18n/index.ts';
import { useReadFormat } from './format.ts';

interface ReadSetupProps {
  level: LevelId;
  length: SessionLength;
  hint: boolean;
  progress: ReadonlyMap<LevelId, LevelProgress>;
  suggested: LevelId;
  onLevel: (level: LevelId) => void;
  onLength: (length: SessionLength) => void;
  onHint: (hint: boolean) => void;
  onStart: () => void;
}

export function ReadSetup(props: ReadSetupProps) {
  const t = useT();
  const id = useId();

  return (
    <form
      className="read-setup"
      onSubmit={(e) => {
        e.preventDefault();
        props.onStart();
      }}
    >
      <fieldset className="field" aria-describedby={`${id}-rule`}>
        <legend>{t('read.level')}</legend>
        <div className="levels">
          {LEVELS.map((level) => (
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
          {t('read.level.rule')}
        </p>
      </fieldset>

      <fieldset className="field">
        <legend>{t('read.length')}</legend>
        <div className="segmented">
          {SESSION_LENGTHS.map((length) => (
            <label key={length}>
              <input
                type="radio"
                name={`${id}-length`}
                value={length}
                checked={props.length === length}
                onChange={() => props.onLength(length)}
              />
              <span>{length}</span>
            </label>
          ))}
        </div>
      </fieldset>

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
          {t('read.hint.help')}
        </p>
      </div>

      <button type="submit" className="button button-primary read-start">
        {t('read.start')}
      </button>
    </form>
  );
}

interface LevelOptionProps {
  name: string;
  level: Level;
  checked: boolean;
  suggested: boolean;
  progress: LevelProgress | undefined;
  onChange: () => void;
}

function LevelOption({ name, level, checked, suggested, progress, onChange }: LevelOptionProps) {
  const t = useT();
  const format = useReadFormat();
  const staves =
    level.clefs.length === 2 ? t('read.level.both') : t(`read.level.${level.clefs[0]!}`);

  return (
    <label className={checked ? 'level is-checked' : 'level'}>
      <input type="radio" name={name} value={level.id} checked={checked} onChange={onChange} />
      <span className="level-body">
        <span className="level-head">
          <span className="level-id">{level.id}</span>
          <span className="level-name">{t(`read.level.${level.id}`)}</span>
        </span>
        <span className="level-range">
          {t('read.level.range', { low: formatPitch(level.low), high: formatPitch(level.high) })} ·{' '}
          {staves}
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
                  window: MASTERY_WINDOW,
                  accuracy: format.percent(progress.accuracy),
                  median: format.seconds(progress.medianMs),
                })
              : t('read.level.new')}
          </span>
        </span>
      </span>
    </label>
  );
}
