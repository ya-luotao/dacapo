import { useId, useState } from 'react';
import { SIGHT_LEVELS, type SightLevel, type SightLevelId } from '../../core/sightLevels.ts';
import {
  LOOK_SECONDS,
  READ_AHEADS,
  SIGHT_MASTERY_FRAGMENTS,
  SIGHT_MASTERY_SHARE,
  SIGHT_MAX_BPM,
  SIGHT_MIN_BPM,
  SIGHT_PLAYS,
  SIGHT_SESSION_LENGTHS,
  type SightLevelProgress,
} from '../../core/sightRead.ts';
import { IN_TIME_MS } from '../../core/rhythmRun.ts';
import { useI18n } from '../../i18n/index.ts';
import type { Latency } from '../pieces/rhythmPrefs.ts';
import { Segmented } from '../Segmented.tsx';
import { useReadFormat } from './format.ts';
import { useSightFormat } from './sightFormat.ts';
import { sightTempoOf, type SightPrefs } from './sightPrefs.ts';

interface SightSetupProps {
  level: SightLevelId;
  prefs: SightPrefs;
  progress: ReadonlyMap<SightLevelId, SightLevelProgress>;
  suggested: SightLevelId;
  latency: Latency | null;
  onLevel: (level: SightLevelId) => void;
  onTempo: (bpm: number) => void;
  onPrefs: (patch: Partial<SightPrefs>) => void;
  onCalibrate: () => void;
  onStart: () => void;
}

/** The sight-reading levels and the session's settings, laid out as Read's. */
export function SightSetup(props: SightSetupProps) {
  const { t } = useI18n();
  const format = useSightFormat();
  const read = useReadFormat();
  const id = useId();
  const bpm = sightTempoOf(props.prefs, props.level);
  // The tempo as typed: taken when it is a tempo, put right when the field is left.
  const [typed, setTyped] = useState<string | null>(null);
  const inTime = props.prefs.play === 'time';

  return (
    <form
      className="read-setup rhythm-setup sight-setup"
      onSubmit={(e) => {
        e.preventDefault();
        props.onStart();
      }}
    >
      <fieldset className="field" aria-describedby={`${id}-rule`}>
        <legend>{t('read.level')}</legend>
        <div className="levels">
          {SIGHT_LEVELS.map((l) => (
            <LevelOption
              key={l.id}
              name={`${id}-level`}
              level={l}
              checked={props.level === l.id}
              suggested={props.suggested === l.id}
              progress={props.progress.get(l.id)}
              onChange={() => props.onLevel(l.id)}
            />
          ))}
        </div>
        <p id={`${id}-rule`} className="help">
          {t('sight.level.rule', {
            n: SIGHT_MASTERY_FRAGMENTS,
            percent: read.percent(SIGHT_MASTERY_SHARE),
            ms: IN_TIME_MS,
          })}
        </p>
      </fieldset>

      {/* The session: beside the levels on a wide screen, as a card to start from. */}
      <div className="read-options">
        <p className="read-options-level" aria-hidden="true">
          <span className="level-id">{props.level}</span>
          <span>{format.levelName(props.level)}</span>
        </p>
        <Segmented
          legend={t('sight.play')}
          name={`${id}-play`}
          options={SIGHT_PLAYS.map((play) => ({ value: play, label: t(`sight.play.${play}`) }))}
          value={props.prefs.play}
          onChange={(play) => props.onPrefs({ play })}
          help={t(`sight.play.${props.prefs.play}.help`)}
        />
        {inTime && (
          <Segmented
            legend={t('sight.readAhead')}
            name={`${id}-ahead`}
            options={READ_AHEADS.map((ahead) => ({
              value: ahead,
              label: t(`sight.readAhead.${ahead}`),
            }))}
            value={props.prefs.readAhead}
            onChange={(readAhead) => props.onPrefs({ readAhead })}
            help={t('sight.readAhead.help')}
          />
        )}
        <Segmented
          legend={t('sight.look')}
          name={`${id}-look`}
          options={LOOK_SECONDS.map((n) => ({ value: n, label: String(n) }))}
          value={props.prefs.look}
          onChange={(look) => props.onPrefs({ look })}
          help={t('sight.look.help')}
        />
        <div className="field">
          <label htmlFor={`${id}-bpm`}>{t('rhythm.tempo')}</label>
          <span className="scale-tempo-input">
            <span aria-hidden="true">♩ =</span>
            <input
              id={`${id}-bpm`}
              type="number"
              inputMode="numeric"
              min={SIGHT_MIN_BPM}
              max={SIGHT_MAX_BPM}
              step={1}
              value={typed ?? String(bpm)}
              aria-describedby={`${id}-bpm-help`}
              onChange={(e) => {
                setTyped(e.target.value);
                const next = Number(e.target.value);
                if (
                  e.target.value !== '' &&
                  Number.isInteger(next) &&
                  next >= SIGHT_MIN_BPM &&
                  next <= SIGHT_MAX_BPM
                )
                  props.onTempo(next);
              }}
              onBlur={() => setTyped(null)}
            />
          </span>
          <p id={`${id}-bpm-help`} className="help">
            {t('sight.tempo.help')}
          </p>
        </div>
        <Segmented
          legend={t('sight.length')}
          name={`${id}-length`}
          options={SIGHT_SESSION_LENGTHS.map((length) => ({
            value: length,
            label: String(length),
          }))}
          value={props.prefs.length}
          onChange={(length) => props.onPrefs({ length })}
        />
        {inTime && (
          <div className="field">
            <label className="check">
              <input
                type="checkbox"
                checked={props.prefs.countInOnly}
                onChange={(e) => props.onPrefs({ countInOnly: e.target.checked })}
                aria-describedby={`${id}-count-in`}
              />
              <span>{t('rhythm.countInOnly')}</span>
            </label>
            <p id={`${id}-count-in`} className="help">
              {t('rhythm.countInOnly.help')}
            </p>
          </div>
        )}
        {inTime && (
          <p className="rhythm-latency">
            <span>
              {props.latency
                ? t('pieces.latency', { ms: props.latency.offset })
                : t('pieces.latency.none')}
            </span>
            <button type="button" className="button is-compact" onClick={props.onCalibrate}>
              {t('pieces.latency.calibrate')}
            </button>
          </p>
        )}

        <button type="submit" className="button button-primary read-start">
          {t('read.start')}
        </button>
      </div>
    </form>
  );
}

interface LevelOptionProps {
  name: string;
  level: SightLevel;
  checked: boolean;
  suggested: boolean;
  progress: SightLevelProgress | undefined;
  onChange: () => void;
}

function LevelOption({ name, level, checked, suggested, progress, onChange }: LevelOptionProps) {
  const { t } = useI18n();
  const format = useSightFormat();

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
          {progress && progress.total > 0 ? format.stats(progress) : t('read.level.new')}
        </span>
      </span>
    </label>
  );
}
