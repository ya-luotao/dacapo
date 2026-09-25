import { useId, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import type { OutputChoice } from '../../output/output.ts';
import { DeviceHelp } from '../play/DeviceStatus.tsx';
import { useInput, useMidiStatus } from '../input/context.ts';
import { useOutputState } from '../output/context.ts';
import {
  ACCOMPANIMENT_LEVEL_NAMES,
  readAccompanimentLevel,
  writeAccompanimentLevel,
  type AccompanimentLevel,
} from '../output/prefs.ts';

const AUTO = 'auto';
const NONE = 'none';

function choiceValue(choice: OutputChoice): string {
  return choice.kind === 'port' ? `port:${choice.name}` : choice.kind;
}

/** Where demos and the other hand are played: a MIDI output, tested with one note. */
export function SoundSection() {
  const t = useT();
  const id = useId();
  const { output } = useInput();
  const { ports, choice, selected } = useOutputState();
  const [level, setLevel] = useState<AccompanimentLevel>(readAccompanimentLevel);
  const midi = useMidiStatus().state;
  // Without access to MIDI at all, the input's explanation (with its retry) says why.
  const blocked = midi === 'no-permission' || midi === 'unsupported';
  const noPorts = !blocked && midi !== 'pending' && ports.length === 0;

  const chosenMissing = choice.kind === 'port' && !ports.some((p) => p.name === choice.name);
  const autoName = choice.kind === 'auto' ? selected?.name : undefined;

  function onChoose(value: string) {
    if (value === AUTO) output.choose({ kind: 'auto' });
    else if (value === NONE) output.choose({ kind: 'none' });
    else output.choose({ kind: 'port', name: value.slice(5) });
  }

  return (
    <section className="field data sound" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('settings.sound')}</h2>
      <p className="help">{t('settings.sound.help')}</p>

      <div className="field sound-output">
        <label htmlFor={`${id}-output`}>{t('settings.output')}</label>
        <div className="sound-row">
          <select
            id={`${id}-output`}
            value={choiceValue(choice)}
            onChange={(e) => onChoose(e.target.value)}
            aria-describedby={noPorts ? `${id}-output-help` : undefined}
          >
            <option value={AUTO}>
              {autoName
                ? t('settings.output.auto', { name: autoName })
                : t('settings.output.autoNone')}
            </option>
            {ports.map((port) => (
              <option key={port.id} value={`port:${port.name}`}>
                {port.name || t('midi.unnamedDevice')}
              </option>
            ))}
            {chosenMissing && (
              <option value={choiceValue(choice)}>
                {t('settings.output.missing', { name: choice.name })}
              </option>
            )}
            <option value={NONE}>{t('settings.output.none')}</option>
          </select>
          <button type="button" className="button" disabled={!selected} onClick={output.testNote}>
            {t('settings.output.test')}
          </button>
        </div>
        {noPorts && (
          <p id={`${id}-output-help`} className="help">
            {t('settings.output.noPorts')}
          </p>
        )}
        {blocked && <DeviceHelp />}
      </div>

      <fieldset className="field" aria-describedby={`${id}-level-help`}>
        <legend>{t('settings.accompaniment')}</legend>
        <div className="segmented">
          {ACCOMPANIMENT_LEVEL_NAMES.map((name) => (
            <label key={name}>
              <input
                type="radio"
                name={`${id}-level`}
                value={name}
                checked={level === name}
                onChange={() => {
                  setLevel(name);
                  writeAccompanimentLevel(name);
                }}
              />
              <span>{t(`settings.accompaniment.${name}`)}</span>
            </label>
          ))}
        </div>
        <p id={`${id}-level-help`} className="help">
          {t('settings.accompaniment.help')}
        </p>
      </fieldset>
    </section>
  );
}
