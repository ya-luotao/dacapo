import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import { audioContext } from '../../output/audio.ts';
import { isBuiltin, type OutputChoice } from '../../output/output.ts';
import { readPianoVolume, writePianoVolume } from '../../output/piano.ts';
import { DeviceHelp } from '../play/DeviceStatus.tsx';
import { useInput, useMidiStatus } from '../input/context.ts';
import { useMonitorSettings, useOutputState, useSampleStatus } from '../output/context.ts';
import {
  ACCOMPANIMENT_LEVEL_NAMES,
  readAccompanimentLevel,
  writeAccompanimentLevel,
  type AccompanimentLevel,
} from '../output/prefs.ts';
import { Calibration } from '../pieces/Calibration.tsx';
import { readClickVolume, writeClickVolume } from '../pieces/rhythmPrefs.ts';
import { sharedClickTrack } from '../pieces/useRhythmPlayer.ts';

const AUTO = 'auto';
const BUILTIN = 'builtin';
const NONE = 'none';
/** The built-in piano's test: a C major chord, held this long. */
const CHORD = [60, 64, 67];
const CHORD_MS = 1200;

function choiceValue(choice: OutputChoice): string {
  return choice.kind === 'port' ? `port:${choice.name}` : choice.kind;
}

/**
 * Where demos and the other hand are played (a MIDI output or the built-in piano, tested with one
 * note), the built-in piano's volume and the keys it sounds, and rhythm mode's click.
 */
export function SoundSection() {
  const t = useT();
  const id = useId();
  const { output, piano, samples, monitor } = useInput();
  const { ports, choice, selected } = useOutputState();
  const status = useSampleStatus();
  const monitored = useMonitorSettings();
  const [level, setLevel] = useState<AccompanimentLevel>(readAccompanimentLevel);
  const [volume, setVolume] = useState(readClickVolume);
  const [pianoVolume, setPianoVolume] = useState(readPianoVolume);
  /** Stops what the chord test started: its release, or its wait for the samples. */
  const chord = useRef<(() => void) | null>(null);
  useEffect(() => () => chord.current?.(), []);

  function playChord() {
    for (const midi of CHORD) piano.keys.noteOn(midi, 72);
    const release = () => {
      clearTimeout(timer);
      for (const midi of CHORD) piano.keys.noteOff(midi);
      chord.current = null;
    };
    const timer = setTimeout(release, CHORD_MS);
    chord.current = release;
  }

  function testChord() {
    chord.current?.();
    // Made here, in the click, so that it may start.
    audioContext();
    if (samples.getStatus() === 'ready') {
      playChord();
      return;
    }
    // Asked for before the samples were loaded: it plays once they are.
    samples.load();
    const off = samples.subscribe(() => {
      if (samples.getStatus() === 'loading') return;
      off();
      chord.current = null;
      if (samples.getStatus() === 'ready') playChord();
    });
    chord.current = off;
  }

  function testClick() {
    const track = sharedClickTrack();
    if (!track) return;
    track.setVolume(volume / 100);
    const at = performance.now() + 150;
    const clicks = [0, 1, 2, 3].map((i) => ({ time: at + i * 500, accent: i === 0 }));
    track.start((from, to) => clicks.filter((c) => c.time >= from && c.time < to));
  }
  const midi = useMidiStatus().state;
  // Without access to MIDI at all, the input's explanation (with its retry) says why.
  const blocked = midi === 'no-permission' || midi === 'unsupported';
  const noPorts = !blocked && midi !== 'pending' && ports.length === 0;

  const chosenMissing = choice.kind === 'port' && !ports.some((p) => p.name === choice.name);
  const builtin = isBuiltin(selected);
  const autoName =
    choice.kind !== 'auto' || !selected
      ? undefined
      : builtin
        ? t('settings.output.builtin')
        : selected.name || t('midi.unnamedDevice');
  const pianoLoading = status === 'loading';

  function onChoose(value: string) {
    if (value === AUTO) output.choose({ kind: 'auto' });
    else if (value === BUILTIN) output.choose({ kind: 'builtin' });
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
            aria-describedby={`${id}-output-auto${noPorts ? ` ${id}-output-help` : ''}`}
          >
            <option value={AUTO}>
              {autoName
                ? t('settings.output.auto', { name: autoName })
                : t('settings.output.autoNone')}
            </option>
            <option value={BUILTIN}>{t('settings.output.builtin')}</option>
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
          <button
            type="button"
            className="button"
            disabled={!selected || (builtin && status !== 'ready')}
            onClick={() => {
              if (builtin) audioContext();
              output.testNote();
            }}
          >
            {t('settings.output.test')}
          </button>
        </div>
        <p id={`${id}-output-auto`} className="help">
          {t('settings.output.help')}
        </p>
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

      <div className="field sound-piano">
        <label htmlFor={`${id}-piano`}>{t('settings.piano')}</label>
        <p className="help">{t('settings.piano.help')}</p>
        <div className="sound-row">
          <input
            id={`${id}-piano`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={pianoVolume}
            aria-label={t('settings.piano.volume')}
            onChange={(e) => {
              const next = Number(e.target.value);
              setPianoVolume(next);
              writePianoVolume(next);
              piano.setVolume(next / 100);
            }}
          />
          <button type="button" className="button" disabled={pianoLoading} onClick={testChord}>
            {t('settings.piano.test')}
          </button>
        </div>
        {pianoLoading && (
          <p className="help" role="status">
            {t('settings.piano.loading')}
          </p>
        )}
        {status === 'failed' && (
          <p className="help sound-failed" role="alert">
            {t('settings.piano.failed')}{' '}
            <button type="button" className="button button-link" onClick={samples.load}>
              {t('settings.piano.retry')}
            </button>
          </p>
        )}
      </div>

      <fieldset className="field sound-keys" aria-describedby={`${id}-keys-help`}>
        <legend>{t('settings.piano.keys')}</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={monitored.keys}
            onChange={(e) => monitor.set({ ...monitored, keys: e.target.checked })}
          />
          <span>{t('settings.piano.keys.computer')}</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={monitored.midi}
            onChange={(e) => monitor.set({ ...monitored, midi: e.target.checked })}
          />
          <span>{t('settings.piano.keys.midi')}</span>
        </label>
        <p id={`${id}-keys-help`} className="help">
          {t('settings.piano.keys.help')}
        </p>
      </fieldset>

      <div className="field sound-click">
        <label htmlFor={`${id}-click`}>{t('settings.click')}</label>
        <p className="help">{t('settings.click.help')}</p>
        <div className="sound-row">
          <input
            id={`${id}-click`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            aria-label={t('settings.click.volume')}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              writeClickVolume(Number(e.target.value));
            }}
          />
          <button type="button" className="button" onClick={testClick}>
            {t('settings.click.test')}
          </button>
        </div>
      </div>

      <Calibration />
    </section>
  );
}
