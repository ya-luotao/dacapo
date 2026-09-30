import { useId, useState } from 'react';
import {
  RHYTHM_LEVELS,
  RHYTHM_MAX_BPM,
  RHYTHM_MIN_BPM,
  type RhythmLevel,
  type RhythmLevelId,
} from '../../core/rhythmCells.ts';
import {
  RHYTHM_MASTERY_ACCURACY,
  RHYTHM_MASTERY_WINDOW,
  RHYTHM_SESSION_LENGTHS,
  type RhythmLevelProgress,
} from '../../core/rhythmRead.ts';
import { IN_TIME_MS } from '../../core/rhythmRun.ts';
import { useI18n } from '../../i18n/index.ts';
import type { Latency } from '../pieces/rhythmPrefs.ts';
import { Segmented } from '../Segmented.tsx';
import { useReadFormat } from './format.ts';
import { tempoOf, type RhythmPrefs } from './rhythmPrefs.ts';
import { useRhythmFormat } from './rhythmFormat.ts';

interface RhythmSetupProps {
  level: RhythmLevelId;
  prefs: RhythmPrefs;
  progress: ReadonlyMap<RhythmLevelId, RhythmLevelProgress>;
  suggested: RhythmLevelId;
  latency: Latency | null;
  onLevel: (level: RhythmLevelId) => void;
  onTempo: (bpm: number) => void;
  onPrefs: (patch: Partial<RhythmPrefs>) => void;
  onCalibrate: () => void;
  onStart: () => void;
}

/** The rhythm levels and the session's settings, laid out as Read's. */
export function RhythmSetup(props: RhythmSetupProps) {
  const { t } = useI18n();
  const format = useRhythmFormat();
  const read = useReadFormat();
  const id = useId();
  const bpm = tempoOf(props.prefs, props.level);
  const level = RHYTHM_LEVELS.find((l) => l.id === props.level)!;
  // The tempo as typed: taken when it is a tempo, put right when the field is left.
  const [typed, setTyped] = useState<string | null>(null);

  return (
    <form
      className="read-setup rhythm-setup"
      onSubmit={(e) => {
        e.preventDefault();
        props.onStart();
      }}
    >
      <fieldset className="field" aria-describedby={`${id}-rule`}>
        <legend>{t('read.level')}</legend>
        <div className="levels">
          {RHYTHM_LEVELS.map((l) => (
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
          {t('rhythm.level.rule', {
            percent: read.percent(RHYTHM_MASTERY_ACCURACY),
            window: RHYTHM_MASTERY_WINDOW,
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
        <div className="field">
          <label htmlFor={`${id}-bpm`}>{t('rhythm.tempo')}</label>
          <span className="scale-tempo-input">
            <span aria-hidden="true">{level.meters.includes('6/8') ? '♩. =' : '♩ ='}</span>
            <input
              id={`${id}-bpm`}
              type="number"
              inputMode="numeric"
              min={RHYTHM_MIN_BPM}
              max={RHYTHM_MAX_BPM}
              step={1}
              value={typed ?? String(bpm)}
              aria-describedby={`${id}-bpm-help`}
              onChange={(e) => {
                setTyped(e.target.value);
                const next = Number(e.target.value);
                if (
                  e.target.value !== '' &&
                  Number.isInteger(next) &&
                  next >= RHYTHM_MIN_BPM &&
                  next <= RHYTHM_MAX_BPM
                )
                  props.onTempo(next);
              }}
              onBlur={() => setTyped(null)}
            />
          </span>
          <p id={`${id}-bpm-help`} className="help">
            {t(level.meters.includes('6/8') ? 'rhythm.tempo.help.compound' : 'rhythm.tempo.help')}
          </p>
        </div>
        <Segmented
          legend={t('rhythm.length')}
          name={`${id}-length`}
          options={RHYTHM_SESSION_LENGTHS.map((length) => ({
            value: length,
            label: String(length),
          }))}
          value={props.prefs.length}
          onChange={(length) => props.onPrefs({ length })}
        />
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
        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={props.prefs.counts}
              onChange={(e) => props.onPrefs({ counts: e.target.checked })}
              aria-describedby={`${id}-counts`}
            />
            <span>{t('rhythm.counts')}</span>
          </label>
          <p id={`${id}-counts`} className="help">
            {t('rhythm.counts.help')}
          </p>
        </div>
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

        <button type="submit" className="button button-primary read-start">
          {t('read.start')}
        </button>
      </div>
    </form>
  );
}

interface LevelOptionProps {
  name: string;
  level: RhythmLevel;
  checked: boolean;
  suggested: boolean;
  progress: RhythmLevelProgress | undefined;
  onChange: () => void;
}

function LevelOption({ name, level, checked, suggested, progress, onChange }: LevelOptionProps) {
  const { t } = useI18n();
  const format = useRhythmFormat();

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
