import { useId, useState } from 'react';
import { CLICK_MAX_BPM, CLICK_MIN_BPM, NOTES_PER_BEAT } from '../../core/scaleClick.ts';
import { handsAllowed, octavesOf, SCALE_HANDS, tonicsFor, tonicsOf } from '../../core/scales.ts';
import {
  SCALE_OCTAVES,
  SCALE_TYPES,
  TECHNIQUE_TYPES,
  type ExerciseType,
  type ScaleExercise,
} from '../../core/scaleTypes.ts';
import { takesPerBeat } from '../../core/scaleXml.ts';
import {
  HANON_TRILL,
  isTechnique,
  techniqueRules,
  TRILL_BARS,
  TRILL_PAIRS,
  trillForm,
} from '../../core/technique.ts';
import { useT } from '../../i18n/index.ts';
import { tonicName, useVariantName } from './format.ts';
import { useBeyondKeyboard } from './keys.ts';
import { clampTempo, type ClickPrefs } from './prefs.ts';

/**
 * The choice of scale — type, key, octaves, hands, and for Hanon the exercise's number — and of
 * tempo: free, or with the click at a tempo and a number of notes to the beat. Quiet controls in
 * one row that wraps.
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
  const variantName = useVariantName();
  const variants = isTechnique(exercise.type) ? techniqueRules(exercise.type).variants : [];
  const octaves = octavesOf(exercise.type);
  const tonics = tonicsFor(exercise.type, exercise.variant);
  const trill = exercise.type === 'trill' ? trillForm(exercise.variant) : null;
  // The octaves and hands that run beyond the player's keyboard are marked, and can be chosen
  // all the same (docs/PERSONAL.md, "The instrument's keys").
  const beyond = useBeyondKeyboard();
  const withOctaves = (length: ScaleExercise['octaves']): ScaleExercise => ({
    ...exercise,
    octaves: length,
  });
  const withHands = (hands: ScaleExercise['hands']): ScaleExercise => ({
    ...exercise,
    hands,
    octaves: handsAllowed(exercise, hands) ? exercise.octaves : 3,
  });
  const octaveBeyond = (length: ScaleExercise['octaves']) =>
    octaves.includes(length) &&
    handsAllowed(withOctaves(length), exercise.hands) &&
    beyond(withOctaves(length));
  const handBeyond = (hands: ScaleExercise['hands']) =>
    handsAllowed(withHands(hands), hands) && beyond(withHands(hands));
  const anyBeyond = SCALE_OCTAVES.some(octaveBeyond) || SCALE_HANDS.some(handBeyond);
  /** A marked option's name for a screen reader: "4, beyond your keyboard". */
  const marked = (name: string | number) => `${name}${t('app.listSeparator')}${t('scales.beyond')}`;

  /** A form of the exercise, and a key it is offered in (Hanon's trill is in C). */
  function setVariant(variant: string) {
    const keys = tonicsFor(exercise.type, variant);
    onChange({
      ...exercise,
      variant,
      tonic: keys.includes(exercise.tonic) ? exercise.tonic : keys[0]!,
    });
  }

  function setType(type: ExerciseType) {
    // The same tonic if the new type has it, else the one at the same place in the circle.
    const before = tonicsOf(exercise.type);
    const after = tonicsOf(type);
    const tonic = after.includes(exercise.tonic)
      ? exercise.tonic
      : (after[Math.max(0, before.indexOf(exercise.tonic))] ?? after[0]!);
    // The same octaves where the new type has them, else the nearest it has.
    const lengths = octavesOf(type);
    const length = lengths.includes(exercise.octaves)
      ? exercise.octaves
      : lengths.reduce((a, o) =>
          Math.abs(o - exercise.octaves) < Math.abs(a - exercise.octaves) ? o : a,
        );
    // Contrary motion where the new type has it, else both hands in parallel.
    const hands = handsAllowed({ type, octaves: length }, exercise.hands) ? exercise.hands : 'both';
    const forms = isTechnique(type) ? techniqueRules(type).variants : [];
    const next: ScaleExercise = { type, tonic, octaves: length, hands };
    if (forms.length > 0) {
      next.variant =
        exercise.variant !== undefined && forms.includes(exercise.variant)
          ? exercise.variant
          : forms[0]!;
      const keys = tonicsFor(type, next.variant);
      if (!keys.includes(next.tonic)) next.tonic = keys[0]!;
    }
    onChange(next);
  }

  /** Contrary motion goes up to three octaves: choosing it from four takes three. */
  function setHands(hands: ScaleExercise['hands']) {
    const length = handsAllowed(exercise, hands) ? exercise.octaves : 3;
    onChange({ ...exercise, hands, octaves: length });
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
            setType(e.target.value as ExerciseType);
            onChosen();
          }}
        >
          <optgroup label={t('scales.pick.group.scales')}>
            {SCALE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`scales.type.${type}`)}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('scales.pick.group.technique')}>
            {TECHNIQUE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`scales.type.${type}`)}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      {trill ? (
        <>
          {/* A trill: Hanon's No. 46, or a pair of fingers held for a number of bars. */}
          <div className="field">
            <label htmlFor={`${id}-fingers`}>{t('scales.pick.fingers')}</label>
            <select
              id={`${id}-fingers`}
              value={trill.hanon ? HANON_TRILL : `${trill.lower}${trill.upper}`}
              disabled={disabled}
              onChange={(e) => {
                const value = e.target.value;
                setVariant(
                  value === HANON_TRILL ? HANON_TRILL : `${value}-${trill.hanon ? 8 : trill.bars}`,
                );
                onChosen();
              }}
            >
              <option value={HANON_TRILL}>{t('scales.pick.trillHanon')}</option>
              {TRILL_PAIRS.map((pair) => (
                <option key={pair} value={pair}>
                  {`${pair[0]}–${pair[1]}`}
                </option>
              ))}
            </select>
          </div>
          {!trill.hanon && (
            <fieldset className="field" disabled={disabled}>
              <legend>{t('scales.pick.bars')}</legend>
              <div className="segmented">
                {TRILL_BARS.map((bars) => (
                  <label key={bars}>
                    <input
                      type="radio"
                      name={`${id}-bars`}
                      checked={trill.bars === bars}
                      onChange={() => setVariant(`${trill.lower}${trill.upper}-${bars}`)}
                    />
                    <span>{bars}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      ) : (
        variants.length > 0 && (
          <div className="field">
            <label htmlFor={`${id}-variant`}>
              {t(exercise.type === 'thirds' ? 'scales.pick.form' : 'scales.pick.number')}
            </label>
            <select
              id={`${id}-variant`}
              value={exercise.variant}
              disabled={disabled}
              onChange={(e) => {
                setVariant(e.target.value);
                onChosen();
              }}
            >
              {variants.map((variant) => (
                <option key={variant} value={variant}>
                  {variantName(exercise.type, variant)}
                </option>
              ))}
            </select>
          </div>
        )
      )}
      <div className="field">
        <label htmlFor={`${id}-tonic`}>{t('scales.pick.tonic')}</label>
        <select
          id={`${id}-tonic`}
          value={exercise.tonic}
          // Hanon's Part I is in C only.
          disabled={disabled || tonics.length < 2}
          onChange={(e) => {
            onChange({ ...exercise, tonic: e.target.value });
            onChosen();
          }}
        >
          {tonics.map((tonic) => (
            <option key={tonic} value={tonic}>
              {tonicName(tonic)}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="field" disabled={disabled}>
        <legend>{t('scales.pick.octaves')}</legend>
        <div className="segmented">
          {SCALE_OCTAVES.map((length) => (
            <label key={length} title={octaveBeyond(length) ? t('scales.beyond') : undefined}>
              <input
                type="radio"
                name={`${id}-octaves`}
                checked={exercise.octaves === length}
                // A technique exercise has its own lengths (Hanon's two octaves, as printed).
                disabled={
                  !octaves.includes(length) ||
                  !handsAllowed({ ...exercise, octaves: length }, exercise.hands)
                }
                aria-label={octaveBeyond(length) ? marked(length) : undefined}
                onChange={() => onChange({ ...exercise, octaves: length })}
              />
              <span>
                {length}
                {octaveBeyond(length) && '*'}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field" disabled={disabled}>
        <legend>{t('scales.pick.hand')}</legend>
        <div className="segmented">
          {SCALE_HANDS.map((hand) => (
            <label key={hand} title={handBeyond(hand) ? t('scales.beyond') : undefined}>
              <input
                type="radio"
                name={`${id}-hand`}
                checked={exercise.hands === hand}
                // Contrary motion is offered for the majors, harmonic minors and chromatic.
                disabled={
                  !handsAllowed(
                    { ...exercise, octaves: isTechnique(exercise.type) ? exercise.octaves : 1 },
                    hand,
                  )
                }
                aria-label={handBeyond(hand) ? marked(t(`scales.hand.${hand}`)) : undefined}
                onChange={() => setHands(hand)}
              />
              <span>
                {t(`scales.hand.${hand}`)}
                {handBeyond(hand) && '*'}
              </span>
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
          {/* An exercise with a rhythm of its own (Hanon's, a chord to the beat) keeps it. */}
          {takesPerBeat(exercise.type) && (
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
          )}
        </>
      )}
      {anyBeyond && (
        <p className="help scale-beyond-note" aria-hidden="true">
          {t('scales.beyond.note')}
        </p>
      )}
    </div>
  );
}
