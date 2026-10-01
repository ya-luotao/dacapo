import { useId, useMemo } from 'react';
import { Link } from 'wouter';
import { BACKING_IDS, BACKINGS, backingNumerals, FEELS, IMPROV_TEMPOS } from '../../core/improv.ts';
import type { ImprovSession } from '../../core/improvFigures.ts';
import { useT } from '../../i18n/index.ts';
import { usePractice } from '../practice/context.ts';
import { useLogFormat } from '../progress/format.ts';
import { useReadFormat } from '../read/format.ts';
import { tonicName } from '../scales/format.ts';
import { Segmented } from '../Segmented.tsx';
import type { ImprovController, ImprovView } from './improvController.ts';
import { PlayBackButton } from './ImprovFeedback.tsx';
import { backingSymbols, scaleNotes, useImprovFormat } from './improvFormat.ts';
import type { BackingChoice, ImprovPrefs } from './improvPrefs.ts';
import { NumeralsText } from './NumeralsText.tsx';

interface ImprovSetupProps {
  prefs: ImprovPrefs;
  onPrefs: (patch: Partial<ImprovPrefs>) => void;
  onStart: () => void;
  /** Whether the backing can sound; 'waiting' just after start. */
  sound: 'ready' | 'none' | 'waiting';
  /** The output is a MIDI port, whose channel can be chosen. */
  port: boolean;
  view: ImprovView;
  controller: ImprovController;
  /** The accompaniment level and the backing's channel, for playing back. */
  playback: { level: number; channel: number };
}

/**
 * Improvise (docs/HARMONY.md, "Improvise (H6)"): a backing, its key, the scale to suggest, the
 * left hand and the feel; the tempo, the click and call and response beside them. Below, the
 * improvisations played lately, each to play back.
 */
export function ImprovSetup(props: ImprovSetupProps) {
  const { prefs, onPrefs } = props;
  const t = useT();
  const format = useImprovFormat();
  const id = useId();
  const backing = BACKINGS[prefs.backing];
  const choice = prefs.choices[prefs.backing];

  function choose(patch: Partial<BackingChoice>) {
    onPrefs({ choices: { ...prefs.choices, [prefs.backing]: { ...choice, ...patch } } });
  }

  return (
    <>
      {props.sound === 'none' && (
        <p className="ear-sound" role="status">
          <span>{t('harmony.improv.sound')}</span>{' '}
          <Link href="/settings">{t('harmony.improv.sound.link')}</Link>
        </p>
      )}
      <form
        className="read-setup improv-setup"
        onSubmit={(e) => {
          e.preventDefault();
          props.onStart();
        }}
      >
        <div className="progression-choose">
          <fieldset className="field">
            <legend>{t('harmony.improv.backing')}</legend>
            <div className="levels progressions">
              {BACKING_IDS.map((b) => {
                const checked = b === prefs.backing;
                const key = prefs.choices[b].key;
                return (
                  <label key={b} className={checked ? 'level is-checked' : 'level'}>
                    <input
                      type="radio"
                      name={`${id}-backing`}
                      value={b}
                      checked={checked}
                      onChange={() => onPrefs({ backing: b })}
                    />
                    <span className="level-id progression-numerals">
                      <NumeralsText chords={backingNumerals(b)} />
                    </span>
                    <span className="level-body">
                      <span className="level-name">{format.backing(b)}</span>
                      <span className="level-range">
                        {t('harmony.progression.inKey', {
                          key: format.key(b, key),
                          chords: backingSymbols(b, key),
                        })}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Segmented
            legend={t('harmony.key')}
            name={`${id}-key`}
            className="improv-keys"
            options={backing.keys.map((k) => ({
              value: k,
              label: tonicName(k),
            }))}
            value={choice.key}
            onChange={(key) => choose({ key })}
          />

          <fieldset className="field">
            <legend>{t('harmony.improv.scale')}</legend>
            <div className="levels patterns">
              {backing.scales.map((scale) => {
                const checked = scale === choice.scale;
                return (
                  <label key={scale} className={checked ? 'level is-checked' : 'level'}>
                    <input
                      type="radio"
                      name={`${id}-scale`}
                      value={scale}
                      checked={checked}
                      onChange={() => choose({ scale })}
                    />
                    <span className="level-body">
                      <span className="level-name">{format.scaleOf(choice.key, scale)}</span>
                      <span className="level-range">{scaleNotes(choice.key, scale)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="help">{t('harmony.improv.scale.help')}</p>
          </fieldset>

          <fieldset className="field">
            <legend>{t('harmony.pattern')}</legend>
            <div className="levels patterns">
              {backing.patterns.map((pattern) => {
                const checked = pattern === choice.pattern;
                return (
                  <label key={pattern} className={checked ? 'level is-checked' : 'level'}>
                    <input
                      type="radio"
                      name={`${id}-pattern`}
                      value={pattern}
                      checked={checked}
                      onChange={() => choose({ pattern })}
                    />
                    <span className="level-body">
                      <span className="level-name">{format.pattern(pattern)}</span>
                      <span className="level-range">{format.patternDetail(pattern)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="read-options">
          <p className="read-options-level progression-chosen" aria-hidden="true">
            <NumeralsText chords={backingNumerals(prefs.backing)} />
            <span className="progression-chosen-pattern">
              {t('harmony.improv.chosen', {
                key: format.key(prefs.backing, choice.key),
                scale: format.scale(choice.scale),
                feel: format.feel(choice.feel),
              })}
            </span>
          </p>
          <Segmented
            legend={t('harmony.improv.feel')}
            name={`${id}-feel`}
            options={FEELS.map((feel) => ({ value: feel, label: format.feel(feel) }))}
            value={choice.feel}
            onChange={(feel) => choose({ feel })}
            help={t('harmony.improv.feel.help')}
          />
          <Segmented
            legend={t('harmony.tempo')}
            name={`${id}-tempo`}
            className="progression-tempo improv-tempo"
            options={IMPROV_TEMPOS.map((bpm) => ({ value: bpm, label: String(bpm) }))}
            value={prefs.bpm}
            onChange={(bpm) => onPrefs({ bpm })}
            help={t('harmony.improv.tempo.help')}
          />
          <div className="field">
            <label className="check">
              <input
                type="checkbox"
                checked={prefs.call}
                onChange={(e) => onPrefs({ call: e.target.checked })}
                aria-describedby={`${id}-call`}
              />
              <span>{t('harmony.improv.call')}</span>
            </label>
            <p id={`${id}-call`} className="help">
              {t('harmony.improv.call.help')}
            </p>
          </div>
          <div className="field">
            <label className="check">
              <input
                type="checkbox"
                checked={prefs.click}
                onChange={(e) => onPrefs({ click: e.target.checked })}
                aria-describedby={`${id}-click`}
              />
              <span>{t('harmony.improv.click')}</span>
            </label>
            <p id={`${id}-click`} className="help">
              {t('harmony.improv.click.help')}
            </p>
          </div>
          {props.port && (
            <div className="field">
              <label className="improv-channel" htmlFor={`${id}-channel`}>
                {t('harmony.improv.channel')}
              </label>
              <select
                id={`${id}-channel`}
                value={prefs.channel}
                onChange={(e) => onPrefs({ channel: Number(e.target.value) })}
                aria-describedby={`${id}-channel-help`}
              >
                {Array.from({ length: 16 }, (_, n) => (
                  <option key={n} value={n}>
                    {n + 1}
                  </option>
                ))}
              </select>
              <p id={`${id}-channel-help`} className="help">
                {t('harmony.improv.channel.help')}
              </p>
            </div>
          )}
          <button type="submit" className="button button-primary read-start">
            {t('harmony.improv.start')}
          </button>
        </div>
      </form>
      <YourImprovisations
        view={props.view}
        controller={props.controller}
        playback={props.playback}
      />
    </>
  );
}

/** How many improvisations "Your improvisations" lists. */
const YOURS = 6;

/** The improvisations played, the latest first, each with a figure and Play back. */
function YourImprovisations({
  view,
  controller,
  playback,
}: {
  view: ImprovView;
  controller: ImprovController;
  playback: { level: number; channel: number };
}) {
  const t = useT();
  const id = useId();
  const format = useImprovFormat();
  const log = useLogFormat();
  const read = useReadFormat();
  const { sessions } = usePractice();
  const yours = useMemo(
    () =>
      sessions
        .filter((s): s is ImprovSession => s.kind === 'improv')
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, YOURS),
    [sessions],
  );

  return (
    <section className="progression-yours improv-yours" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('harmony.improv.yours')}</h3>
      {yours.length === 0 ? (
        <p className="muted">{t('harmony.improv.yours.empty')}</p>
      ) : (
        <ul className="improv-yours-list">
          {yours.map((s) => {
            const f = s.figures;
            return (
              <li key={s.id}>
                <span className="improv-yours-title">{format.title(s.backing, s.key)}</span>
                <span className="improv-yours-detail">
                  {t('harmony.improv.yours.detail', {
                    when: log.dateTime(s.startedAt),
                    time: log.duration(f.ms),
                    figure:
                      f.strong > 0
                        ? t('harmony.improv.yours.figure', {
                            percent: read.percent(f.strongChord / f.strong),
                          })
                        : t('harmony.improv.yours.noStrong'),
                  })}
                </span>
                <span className="improv-yours-action">
                  <PlayBackButton
                    session={s}
                    view={view}
                    controller={controller}
                    sound={playback}
                    className="button"
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
