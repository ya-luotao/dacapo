import { useId } from 'react';
import {
  CHORD_STYLES,
  DIRECTION_SETTINGS,
  EAR_FAMILIES,
  levelsOf,
  type EarLevel,
  type EarLevelId,
} from '../../core/earItems.ts';
import {
  ANSWER_MODES,
  ECHO_SESSION_LENGTHS,
  type EarLevelProgress,
} from '../../core/earSession.ts';
import { SESSION_LENGTHS } from '../../core/session.ts';
import { useT } from '../../i18n/index.ts';
import { useReadFormat } from '../read/format.ts';
import { Segmented } from '../Segmented.tsx';
import { useEarFormat } from './format.ts';
import type { EarPrefs } from './prefs.ts';

interface EarSetupProps {
  prefs: EarPrefs;
  level: EarLevelId;
  progress: ReadonlyMap<EarLevelId, EarLevelProgress>;
  suggested: EarLevelId;
  onPrefs: (prefs: Partial<EarPrefs>) => void;
  onLevel: (level: EarLevelId) => void;
  onStart: () => void;
  /** No sound to play the prompts with. */
  startDisabled?: boolean;
}

export function EarSetup({
  prefs,
  level,
  progress,
  suggested,
  onPrefs,
  onLevel,
  onStart,
  startDisabled = false,
}: EarSetupProps) {
  const t = useT();
  const format = useEarFormat();
  const id = useId();
  const echo = prefs.family === 'echo';

  return (
    <form
      className="read-setup ear-setup"
      onSubmit={(e) => {
        e.preventDefault();
        onStart();
      }}
    >
      <div className="ear-choose">
        <Segmented
          legend={t('ear.family')}
          name={`${id}-family`}
          className="ear-family"
          options={EAR_FAMILIES.map((family) => ({
            value: family,
            label: t(`ear.family.${family}`),
          }))}
          value={prefs.family}
          onChange={(family) => onPrefs({ family })}
        />

        <fieldset className="field" aria-describedby={`${id}-rule`}>
          <legend>{t('ear.level')}</legend>
          <div className="levels">
            {levelsOf(prefs.family).map((l) => (
              <LevelOption
                key={l.id}
                name={`${id}-level`}
                level={l}
                checked={level === l.id}
                suggested={suggested === l.id}
                progress={progress.get(l.id)}
                onChange={() => onLevel(l.id)}
              />
            ))}
          </div>
          <p id={`${id}-rule`} className="help">
            {t(echo ? 'ear.level.rule.echo' : 'ear.level.rule')}
          </p>
        </fieldset>
      </div>

      {/* The session: beside the levels on a wide screen, as a card to start from. */}
      <div className="read-options">
        <p className="read-options-level" aria-hidden="true">
          <span className="level-id">{level}</span>
          <span>{format.levelName(level)}</span>
        </p>
        {/* A melody is only ever played back: no choice of how to answer. */}
        {echo ? (
          <p className="help ear-echo-help">{t('ear.echo.help')}</p>
        ) : (
          <Segmented
            legend={t('ear.by')}
            name={`${id}-by`}
            options={ANSWER_MODES.map((by) => ({ value: by, label: t(`ear.by.${by}`) }))}
            value={prefs.by}
            onChange={(by) => onPrefs({ by })}
            help={t(`ear.by.${prefs.by}.help`)}
          />
        )}
        {prefs.family === 'interval' && (
          <Segmented
            legend={t('ear.direction')}
            name={`${id}-direction`}
            options={DIRECTION_SETTINGS.map((direction) => ({
              value: direction,
              label: t(`ear.direction.${direction}`),
            }))}
            value={prefs.direction}
            onChange={(direction) => onPrefs({ direction })}
          />
        )}
        {prefs.family === 'chord' && (
          <Segmented
            legend={t('ear.chordStyle')}
            name={`${id}-style`}
            options={CHORD_STYLES.map((style) => ({
              value: style,
              label: t(`ear.chordStyle.${style}`),
            }))}
            value={prefs.chordStyle}
            onChange={(chordStyle) => onPrefs({ chordStyle })}
          />
        )}
        {echo ? (
          <Segmented
            legend={t('ear.echoLength')}
            name={`${id}-length`}
            options={ECHO_SESSION_LENGTHS.map((length) => ({
              value: length,
              label: String(length),
            }))}
            value={prefs.echoLength}
            onChange={(echoLength) => onPrefs({ echoLength })}
          />
        ) : (
          <Segmented
            legend={t('ear.length')}
            name={`${id}-length`}
            options={SESSION_LENGTHS.map((length) => ({ value: length, label: String(length) }))}
            value={prefs.length}
            onChange={(length) => onPrefs({ length })}
          />
        )}

        <button type="submit" className="button button-primary read-start" disabled={startDisabled}>
          {t('read.start')}
        </button>
      </div>
    </form>
  );
}

interface LevelOptionProps {
  name: string;
  level: EarLevel;
  checked: boolean;
  suggested: boolean;
  progress: EarLevelProgress | undefined;
  onChange: () => void;
}

function LevelOption({ name, level, checked, suggested, progress, onChange }: LevelOptionProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useEarFormat();

  return (
    <label className={checked ? 'level is-checked' : 'level'}>
      <input type="radio" name={name} value={level.id} checked={checked} onChange={onChange} />
      <span className="level-id">{level.id}</span>
      <span className="level-body">
        <span className="level-name">{format.levelName(level.id)}</span>
        <span className="level-range">{format.levelSize(level.id)}</span>
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
            ? format.levelStats(
                progress,
                read.percent(progress.accuracy),
                read.seconds(progress.medianMs),
              )
            : t('read.level.new')}
        </span>
      </span>
    </label>
  );
}
