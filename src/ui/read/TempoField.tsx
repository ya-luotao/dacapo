import { useId, useState } from 'react';
import { RHYTHM_MAX_BPM, RHYTHM_MIN_BPM, type RhythmLevel } from '../../core/rhythmCells.ts';
import { useI18n } from '../../i18n/index.ts';

/**
 * A level's tempo, typed: taken when it is a tempo (40–160), put right when the field is left.
 * Shared with rhythm dictation on the Ear page, which plays each level at the same tempo.
 */
export function TempoField({
  level,
  bpm,
  onTempo,
  help,
}: {
  level: RhythmLevel;
  bpm: number;
  onTempo: (bpm: number) => void;
  help: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);
  return (
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
              onTempo(next);
          }}
          onBlur={() => setTyped(null)}
        />
      </span>
      <p id={`${id}-bpm-help`} className="help">
        {help}
      </p>
    </div>
  );
}
