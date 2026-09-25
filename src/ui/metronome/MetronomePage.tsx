import { useEffect, useId, useRef, useState } from 'react';
import {
  CLICK_SOUNDS,
  meterBeats,
  meterText,
  METERS,
  nextAccent,
  parseMeter,
  TRAINER_KINDS,
  TRAINER_LIMITS,
  type TrainerSettings,
} from '../../core/metronomeSettings.ts';
import { MAX_BPM, MIN_BPM, SUBDIVISIONS } from '../../core/pulse.ts';
import { TEMPO_NAMES, tempoName, tempoRange, tempoWord } from '../../core/tempoNames.ts';
import { useT } from '../../i18n/index.ts';
import { useInput } from '../input/context.ts';
import { BeatDots } from './BeatDots.tsx';
import { paintDots, paintPendulum } from './paint.ts';
import { useMetronome, useMetronomeState } from './context.ts';
import { NoteValue } from './NoteValue.tsx';
import { Pendulum } from './Pendulum.tsx';
import { shortcutFor } from './shortcuts.ts';
import { useBeatFrame, useReducedMotion } from './useBeatFrame.ts';

export function MetronomePage() {
  const t = useT();
  const id = useId();
  const metronome = useMetronome();
  const state = useMetronomeState();
  const { keyboard } = useInput();
  const reduced = useReducedMotion();
  const pendulum = useRef<SVGSVGElement>(null);
  const dots = useRef<HTMLDivElement>(null);
  const tapButton = useRef<HTMLButtonElement>(null);
  const { settings } = state;
  const { beats, unit } = meterBeats(settings.meter);
  const running = state.status === 'running';
  const blocked = state.blockedBy !== null;

  // This page has no piano: the letter keys are its own (see shortcuts.ts).
  useEffect(() => keyboard.suspend(), [keyboard]);

  useBeatFrame(running, (position) => {
    if (pendulum.current) paintPendulum(pendulum.current, position, reduced);
    if (dots.current) paintDots(dots.current, position);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = shortcutFor(e);
      if (!action) return;
      e.preventDefault();
      if (action.kind === 'toggle') metronome.toggle();
      else if (action.kind === 'nudge') metronome.nudge(action.delta);
      else tap(e.timeStamp);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function tap(time: number) {
    metronome.tap(time);
    // The key taps too: the button answers either way.
    tapButton.current?.animate?.(
      [{ boxShadow: '0 0 0 3px var(--accent)' }, { boxShadow: '0 0 0 3px transparent' }],
      { duration: 240, easing: 'ease-out' },
    );
  }

  const meters = METERS.includes(meterText(settings.meter))
    ? METERS
    : [...METERS, meterText(settings.meter)];
  const status = state.blockedBy
    ? t(`metronome.blocked.${state.blockedBy}`)
    : state.pausedBy
      ? t(`metronome.paused.${state.pausedBy}`)
      : !state.audio
        ? t('metronome.noAudio')
        : running && state.silentBar
          ? t('metronome.status.silent')
          : running && settings.trainer.kind === 'ramp'
            ? t('metronome.status.ramp', { bpm: state.bpm, to: settings.trainer.to })
            : '';

  return (
    <section className="metronome" aria-labelledby={`${id}-title`}>
      <div className="metronome-head">
        <h1 id={`${id}-title`}>{t('metronome.title')}</h1>
        <p className="metronome-status" aria-live="polite">
          {status}
        </p>
      </div>

      <div className="metronome-stage">
        <div className="metronome-instrument">
          <Pendulum bpm={state.target} ref={pendulum} />
          <BeatDots
            ref={dots}
            accents={settings.accents.slice(0, beats)}
            subdivision={settings.subdivision}
            help={t('metronome.beats.help')}
            onCycle={(beat) =>
              metronome.update({
                accents: settings.accents.map((a, i) => (i === beat ? nextAccent(a) : a)),
              })
            }
          />
        </div>

        <div className="metronome-panel">
          <TempoName bpm={state.target} />
          <div className="metronome-bpm">
            <button
              type="button"
              className="button met-step"
              aria-label={t('metronome.slower')}
              onClick={() => metronome.nudge(-1)}
            >
              −
            </button>
            <p className="metronome-figure">
              <NoteValue unit={unit} className="note-value metronome-unit" />
              <span className="metronome-eq" aria-hidden="true">
                =
              </span>
              <output htmlFor={`${id}-tempo`} className="metronome-number">
                {state.target}
              </output>
              <span className="visually-hidden">{t('metronome.bpm')}</span>
            </p>
            <button
              type="button"
              className="button met-step"
              aria-label={t('metronome.faster')}
              onClick={() => metronome.nudge(1)}
            >
              +
            </button>
          </div>
          <input
            id={`${id}-tempo`}
            type="range"
            className="metronome-slider"
            min={MIN_BPM}
            max={MAX_BPM}
            step={1}
            value={state.target}
            aria-label={t('metronome.tempo')}
            onChange={(e) => metronome.setBpm(Number(e.target.value))}
          />
          <div className="metronome-actions">
            <button
              type="button"
              ref={tapButton}
              className="button metronome-tap"
              aria-describedby={`${id}-tap`}
              onClick={(e) => tap(e.timeStamp)}
            >
              {t('metronome.tap')}
            </button>
            <span id={`${id}-tap`} className="visually-hidden">
              {t('metronome.tap.help')}
            </span>
            <button
              type="button"
              className={running ? 'button metronome-go' : 'button button-primary metronome-go'}
              disabled={blocked}
              onClick={metronome.toggle}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                {running ? (
                  <rect x="4" y="4" width="8" height="8" rx="1" />
                ) : (
                  <path d="M5 3l8 5-8 5z" />
                )}
              </svg>
              <span>{running ? t('metronome.stop') : t('metronome.start')}</span>
            </button>
          </div>

          <div className="metronome-settings">
            <label className="metronome-setting">
              <span className="metronome-label">{t('metronome.meter')}</span>
              <select
                className="is-compact"
                value={meterText(settings.meter)}
                onChange={(e) => {
                  const meter = parseMeter(e.target.value);
                  if (meter) metronome.update({ meter });
                }}
              >
                {meters.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="metronome-setting">
              <legend className="visually-hidden">{t('metronome.subdivision')}</legend>
              <span className="metronome-label" aria-hidden="true">
                {t('metronome.subdivision')}
              </span>
              <div className="segmented is-compact">
                {SUBDIVISIONS.map((n) => (
                  <label key={n}>
                    <input
                      type="radio"
                      name={`${id}-sub`}
                      checked={settings.subdivision === n}
                      aria-label={n === 1 ? undefined : t('metronome.subdivision.n', { n })}
                      onChange={() => metronome.update({ subdivision: n })}
                    />
                    <span>{n === 1 ? t('metronome.subdivision.none') : n}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="metronome-setting">
              <legend className="visually-hidden">{t('metronome.sound')}</legend>
              <span className="metronome-label" aria-hidden="true">
                {t('metronome.sound')}
              </span>
              <div className="segmented is-compact">
                {CLICK_SOUNDS.map((sound) => (
                  <label key={sound}>
                    <input
                      type="radio"
                      name={`${id}-sound`}
                      checked={settings.sound === sound}
                      onChange={() => metronome.update({ sound })}
                    />
                    <span>{t(`metronome.sound.${sound}`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="metronome-setting">
              <span className="metronome-label">{t('metronome.volume')}</span>
              <input
                type="range"
                className="metronome-volume"
                min={0}
                max={100}
                step={5}
                value={settings.volume}
                disabled={settings.silent}
                onChange={(e) => metronome.update({ volume: Number(e.target.value) })}
              />
            </label>
            <label className="check metronome-silent">
              <input
                type="checkbox"
                checked={settings.silent}
                aria-describedby={`${id}-silent`}
                onChange={(e) => metronome.update({ silent: e.target.checked })}
              />
              <span>{t('metronome.silent')}</span>
            </label>
            <span id={`${id}-silent`} className="visually-hidden">
              {t('metronome.silent.help')}
            </span>
          </div>

          <Trainer
            trainer={settings.trainer}
            onChange={(patch) => metronome.update({ trainer: { ...settings.trainer, ...patch } })}
          />
        </div>

        <div className="metronome-notes help">
          <p className="metronome-keys">
            <kbd>{t('metronome.keys.space')}</kbd> {t('metronome.keys.start')} · <kbd>←</kbd>{' '}
            <kbd>→</kbd> {t('metronome.keys.tempo')} · <kbd>T</kbd> {t('metronome.keys.tap')}
          </p>
          <p>{t('metronome.source')}</p>
        </div>
      </div>
    </section>
  );
}

/** The Italian mark for the tempo, a gloss, and every mark's range on hover, focus or click. */
function TempoName({ bpm }: { bpm: number }) {
  const t = useT();
  const id = useId();
  const [open, setOpen] = useState(false);
  const name = tempoName(bpm);
  return (
    <div className="tempo-name" data-open={open || undefined}>
      <button
        type="button"
        className="tempo-name-button"
        aria-expanded={open}
        aria-controls={`${id}-scale`}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        <span className="tempo-name-word" lang="it">
          {tempoWord(name)}
        </span>
        <span className="tempo-name-gloss">{t(`tempo.${name}`)}</span>
      </button>
      <div className="tempo-scale" id={`${id}-scale`} role="note">
        <p className="eyebrow">{t('metronome.tempoNames')}</p>
        <dl>
          {TEMPO_NAMES.map((n) => {
            const range = tempoRange(n);
            return (
              <div key={n} className={n === name ? 'is-current' : undefined}>
                <dt lang="it">{tempoWord(n)}</dt>
                <dd>
                  {range.to === null
                    ? t('metronome.tempoRange.open', { from: range.from })
                    : t('metronome.tempoRange', { from: range.from, to: range.to })}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}

function Trainer({
  trainer,
  onChange,
}: {
  trainer: TrainerSettings;
  onChange: (patch: Partial<TrainerSettings>) => void;
}) {
  const t = useT();
  const id = useId();
  const L = TRAINER_LIMITS;
  return (
    <details className="metronome-trainer">
      <summary>
        <span>{t('metronome.trainer')}</span>
        <span className="metronome-trainer-state">{t(`metronome.trainer.${trainer.kind}`)}</span>
      </summary>
      <div className="metronome-trainer-body">
        <div className="segmented is-compact">
          {TRAINER_KINDS.map((kind) => (
            <label key={kind}>
              <input
                type="radio"
                name={`${id}-kind`}
                checked={trainer.kind === kind}
                onChange={() => onChange({ kind })}
              />
              <span>{t(`metronome.trainer.${kind}`)}</span>
            </label>
          ))}
        </div>
        {trainer.kind === 'ramp' && (
          <>
            <div className="metronome-fields">
              <NumberField
                label={t('metronome.trainer.from')}
                value={trainer.from}
                min={MIN_BPM}
                max={MAX_BPM}
                onChange={(from) => onChange({ from })}
              />
              <NumberField
                label={t('metronome.trainer.to')}
                value={trainer.to}
                min={MIN_BPM}
                max={MAX_BPM}
                onChange={(to) => onChange({ to })}
              />
              <NumberField
                label={t('metronome.trainer.step')}
                value={trainer.step}
                min={L.step[0]}
                max={L.step[1]}
                onChange={(step) => onChange({ step })}
              />
              <NumberField
                label={t('metronome.trainer.every')}
                value={trainer.every}
                min={L.every[0]}
                max={L.every[1]}
                onChange={(every) => onChange({ every })}
              />
            </div>
            <p className="help">{t('metronome.trainer.ramp.help')}</p>
          </>
        )}
        {trainer.kind === 'gap' && (
          <>
            <div className="metronome-fields">
              <NumberField
                label={t('metronome.trainer.play')}
                value={trainer.play}
                min={L.play[0]}
                max={L.play[1]}
                onChange={(play) => onChange({ play })}
              />
              <NumberField
                label={t('metronome.trainer.mute')}
                value={trainer.mute}
                min={L.mute[0]}
                max={L.mute[1]}
                onChange={(mute) => onChange({ mute })}
              />
            </div>
            <p className="help">{t('metronome.trainer.gap.help')}</p>
          </>
        )}
      </div>
    </details>
  );
}

/** A whole number within bounds; what is typed on the way there is kept until it is one. */
function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="metronome-field">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const next = Number(e.target.value);
          if (e.target.value !== '' && Number.isInteger(next) && next >= min && next <= max)
            onChange(next);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}
