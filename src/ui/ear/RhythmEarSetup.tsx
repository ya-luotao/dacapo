import { useId } from 'react';
import { getRhythmLevel } from '../../core/rhythmCells.ts';
import {
  RHYTHM_EAR_LEVEL_IDS,
  RHYTHM_EAR_MODES,
  RHYTHM_EAR_SESSION_LENGTHS,
  type RhythmEarLevelId,
  type RhythmEarLevelProgress,
} from '../../core/rhythmEar.ts';
import { useT } from '../../i18n/index.ts';
import { TempoField } from '../read/TempoField.tsx';
import { useRhythmFormat } from '../read/rhythmFormat.ts';
import { Segmented } from '../Segmented.tsx';
import type { EarPrefs } from './prefs.ts';
import { useRhythmEarFormat } from './rhythmEarFormat.ts';

/** The Ear page's rhythm: what the setup needs of it. */
export interface RhythmEarSetupProps {
  level: RhythmEarLevelId;
  progress: ReadonlyMap<RhythmEarLevelId, RhythmEarLevelProgress>;
  suggested: RhythmEarLevelId;
  onLevel: (level: RhythmEarLevelId) => void;
  /** The level's tempo, Read's (shared per level). */
  bpm: number;
  onTempo: (bpm: number) => void;
}

/** Rhythm's levels on the Ear page: Rhythm's R1–R8, with this family's mastery. */
export function RhythmEarLevels({
  level,
  progress,
  suggested,
  onLevel,
}: Pick<RhythmEarSetupProps, 'level' | 'progress' | 'suggested' | 'onLevel'>) {
  const t = useT();
  const id = useId();
  const rhythm = useRhythmFormat();
  const format = useRhythmEarFormat();
  return (
    <fieldset className="field" aria-describedby={`${id}-rule`}>
      <legend>{t('ear.level')}</legend>
      <div className="levels rhythm-ear-levels">
        {RHYTHM_EAR_LEVEL_IDS.map((l) => {
          const p = progress.get(l);
          const checked = level === l;
          return (
            <label key={l} className={checked ? 'level is-checked' : 'level'}>
              <input
                type="radio"
                name={`${id}-level`}
                value={l}
                checked={checked}
                onChange={() => onLevel(l)}
              />
              <span className="level-id">{l}</span>
              <span className="level-body">
                <span className="level-name">{rhythm.levelName(l)}</span>
                <span className="level-range">{rhythm.levelDetail(l)}</span>
              </span>
              <span className="level-status">
                {p?.mastered ? (
                  <span className="badge is-mastered">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                    {t('read.level.mastered')}
                  </span>
                ) : suggested === l ? (
                  <span className="badge is-suggested">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5l4.5 4.5L6 12.5" />
                    </svg>
                    {t('read.level.suggested')}
                  </span>
                ) : null}
                <span className="level-stats">
                  {p && p.total > 0 ? format.levelStats(p) : t('read.level.new')}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p id={`${id}-rule`} className="help">
        {t('ear.rhythm.level.rule')}
      </p>
    </fieldset>
  );
}

/** How a bar is answered, its tempo, and the bars in a session. */
export function RhythmEarOptions({
  prefs,
  onPrefs,
  level,
  bpm,
  onTempo,
}: {
  prefs: EarPrefs;
  onPrefs: (patch: Partial<EarPrefs>) => void;
} & Pick<RhythmEarSetupProps, 'level' | 'bpm' | 'onTempo'>) {
  const t = useT();
  const id = useId();
  const rhythmLevel = getRhythmLevel(level);
  const compound = rhythmLevel.meters.includes('6/8');
  return (
    <>
      <Segmented
        legend={t('ear.by')}
        name={`${id}-by`}
        options={RHYTHM_EAR_MODES.map((by) => ({ value: by, label: t(`ear.rhythm.by.${by}`) }))}
        value={prefs.rhythmBy}
        onChange={(rhythmBy) => onPrefs({ rhythmBy })}
        help={t(`ear.rhythm.by.${prefs.rhythmBy}.help`)}
      />
      <TempoField
        level={rhythmLevel}
        bpm={bpm}
        onTempo={onTempo}
        help={t(compound ? 'ear.rhythm.tempo.help.compound' : 'ear.rhythm.tempo.help')}
      />
      <Segmented
        legend={t('ear.rhythm.length')}
        name={`${id}-length`}
        options={RHYTHM_EAR_SESSION_LENGTHS.map((length) => ({
          value: length,
          label: String(length),
        }))}
        value={prefs.rhythmLength}
        onChange={(rhythmLength) => onPrefs({ rhythmLength })}
      />
    </>
  );
}
