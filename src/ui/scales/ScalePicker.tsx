import { useId, useState } from 'react';
import { CLICK_MAX_BPM, CLICK_MIN_BPM, NOTES_PER_BEAT } from '../../core/scaleClick.ts';
import { handsAllowed, SCALE_HANDS, tonicsOf } from '../../core/scales.ts';
import { SCALE_OCTAVES, SCALE_TYPES, type ScaleExercise } from '../../core/scaleTypes.ts';
import { useT } from '../../i18n/index.ts';
import { tonicName } from './format.ts';
import { clampTempo, type ClickPrefs } from './prefs.ts';

/**
 * The choice of scale — type, key, octaves, hands — and of tempo: free, or with the click at a
 * tempo and a number of notes to the beat. Quiet controls in one row that wraps.
 */
export function ScalePicker({
  id: pickerId,
  hidden,
  exercise,
  onChange,
  click,
  onClick,
  onChosen,
  disabled,
}: {
  id: string;
  hidden: boolean;
  exercise: ScaleExercise;
  onChange: (next: ScaleExercise) => void;
  click: ClickPrefs;
  onClick: (next: ClickPrefs) => void;
  /** A choice was made in a select or a field: the keys should play notes again. */
  onChosen: () => void;
  /** While a clicked run is on, its settings stay as they are. */
  disabled: boolean;
}) {
  const t = useT();
  const id = useId();
  // The tempo as typed: taken when it is a tempo, put right when the field is left.
  const [typed, setTyped] = useState<string | null>(null);

  function setType(type: ScaleExercise['type']) {
    // The same tonic if the new type has it, else the one at the same place in the circle.
    const before = tonicsOf(exercise.type);
    const after = tonicsOf(type);
    const tonic = after.includes(exercise.tonic)
      ? exercise.tonic
      : (after[Math.max(0, before.indexOf(exercise.tonic))] ?? after[0]!);
    // Contrary motion where the new type has it, else both hands in parallel.
    const hands = handsAllowed({ ...exercise, type }, exercise.hands) ? exercise.hands : 'both';
    onChange({ ...exercise, type, tonic, hands });
  }

  /** Contrary motion goes up to three octaves: choosing it from four takes three. */
  function setHands(hands: ScaleExercise['hands']) {
    const octaves = handsAllowed(exercise, hands) ? exercise.octaves : 3;
    onChange({ ...exercise, hands, octaves });
  }

  return (
    <div className="scale-picker" id={pickerId} hidden={hidden}>
      <div className="field">
        <label htmlFor={`${id}-type`}>{t('scales.pick.type')}</label>
        <select
          id={`${id}-type`}
          value={exercise.type}
          disabled={disabled}
          onChange={(e) => {
            setType(e.target.value as ScaleExercise['type']);
            onChosen();
          }}
        >
          {SCALE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`scales.type.${type}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-tonic`}>{t('scales.pick.tonic')}</label>
        <select
          id={`${id}-tonic`}
          value={exercise.tonic}
          disabled={disabled}
          onChange={(e) => {
            onChange({ ...exercise, tonic: e.target.value });
            onChosen();
          }}
        >
          {tonicsOf(exercise.type).map((tonic) => (
            <option key={tonic} value={tonic}>
              {tonicName(tonic)}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="field" disabled={disabled}>
        <legend>{t('scales.pick.octaves')}</legend>
        <div className="segmented">
          {SCALE_OCTAVES.map((octaves) => (
            <label key={octaves}>
              <input
                type="radio"
                name={`${id}-octaves`}
                checked={exercise.octaves === octaves}
                disabled={!handsAllowed({ ...exercise, octaves }, exercise.hands)}
                onChange={() => onChange({ ...exercise, octaves })}
              />
              <span>{octaves}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field" disabled={disabled}>
        <legend>{t('scales.pick.hand')}</legend>
        <div className="segmented">
          {SCALE_HANDS.map((hand) => (
            <label key={hand}>
              <input
                type="radio"
                name={`${id}-hand`}
                checked={exercise.hands === hand}
                // Contrary motion is offered for the majors, harmonic minors and chromatic.
                disabled={!handsAllowed({ ...exercise, octaves: 1 }, hand)}
                onChange={() => setHands(hand)}
              />
              <span>{t(`scales.hand.${hand}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field" disabled={disabled}>
        <legend>{t('scales.pick.mode')}</legend>
        <div className="segmented">
          {([false, true] as const).map((on) => (
            <label key={String(on)}>
              <input
                type="radio"
                name={`${id}-mode`}
                checked={click.on === on}
                onChange={() => onClick({ ...click, on })}
              />
              <span>{t(on ? 'scales.mode.click' : 'scales.mode.free')}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {click.on && (
        <>
          <div className="field scale-tempo">
            <label htmlFor={`${id}-bpm`}>{t('scales.pick.tempo')}</label>
            <span className="scale-tempo-input">
              <span aria-hidden="true">♩ =</span>
              <input
                id={`${id}-bpm`}
                type="number"
                inputMode="numeric"
                min={CLICK_MIN_BPM}
                max={CLICK_MAX_BPM}
                step={1}
                disabled={disabled}
                value={typed ?? String(click.bpm)}
                onChange={(e) => {
                  setTyped(e.target.value);
                  const bpm = Number(e.target.value);
                  if (e.target.value !== '' && bpm >= CLICK_MIN_BPM && bpm <= CLICK_MAX_BPM)
                    onClick({ ...click, bpm: clampTempo(bpm) });
                }}
                onBlur={() => setTyped(null)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  setTyped(null);
                  onChosen();
                }}
              />
            </span>
          </div>
          <fieldset className="field" disabled={disabled}>
            <legend>{t('scales.pick.perBeat')}</legend>
            <div className="segmented">
              {NOTES_PER_BEAT.map((perBeat) => (
                <label key={perBeat}>
                  <input
                    type="radio"
                    name={`${id}-per-beat`}
                    checked={click.perBeat === perBeat}
                    onChange={() => onClick({ ...click, perBeat })}
                  />
                  <span>{perBeat}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
}
