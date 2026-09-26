import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { meterBeats } from '../../core/metronomeSettings.ts';
import { useT } from '../../i18n/index.ts';
import { BeatDots } from './BeatDots.tsx';
import { paintDots } from './paint.ts';
import { useMetronome, useMetronomeState, useTempoOffer } from './context.ts';
import { TempoMark } from './NoteValue.tsx';
import { useBeatFrame } from './useBeatFrame.ts';

/** Pages where you practise: the chip is always there. Elsewhere only while it runs or waits. */
const PRACTICE = /^\/($|read|pieces)/;
/** More beats than this are one dot in the header. */
const MAX_DOTS = 8;

/** The metronome in the header: start and stop at a tap, the tempo and a tap tempo a click away. */
export function MetronomeChip() {
  const t = useT();
  const [location] = useLocation();
  const metronome = useMetronome();
  const state = useMetronomeState();
  const offer = useTempoOffer();
  const dots = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDetailsElement>(null);
  const running = state.status === 'running';
  const hidden = location.startsWith('/metronome');
  // On the metronome's own page the chip is not shown, so it does not draw either.
  useBeatFrame(running && !hidden, (position) => {
    if (dots.current) paintDots(dots.current, position);
  });

  // The panel closes on a click elsewhere, as the practice options do.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = more.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  if (hidden) return null;
  if (!PRACTICE.test(location) && state.status === 'stopped') return null;

  const { settings } = state;
  const { beats, unit } = meterBeats(settings.meter);
  const blocked = state.blockedBy !== null;
  const why = state.blockedBy
    ? t(`metronome.blocked.${state.blockedBy}`)
    : state.pausedBy
      ? t(`metronome.paused.${state.pausedBy}`)
      : null;
  const label = running ? t('metronome.chip.stop') : t('metronome.chip.start');
  const offerUnit = offer?.meter ? meterBeats(offer.meter).unit : 1;

  return (
    <div className="met-chip" data-status={state.status}>
      <button
        type="button"
        className="met-chip-toggle"
        aria-pressed={running}
        aria-label={why ? `${label}. ${why}` : label}
        title={why ?? label}
        disabled={blocked}
        onClick={metronome.toggle}
      >
        <svg className="met-chip-icon" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5.8 1.5h4.4l3.3 13h-11z" />
          <path d="M8 12.5 12.2 2.5" />
          <path d="M9.2 6.6l2 .8-.5 1.3-2-.8z" className="met-chip-weight" />
        </svg>
        <BeatDots
          ref={dots}
          className="met-chip-dots"
          accents={beats > MAX_DOTS ? ['normal'] : settings.accents.slice(0, beats)}
          subdivision={1}
        />
        <span className="met-chip-bpm">{state.bpm}</span>
        {state.pausedBy && <span className="met-chip-note">{t('metronome.chip.paused')}</span>}
      </button>
      <details
        className="met-chip-more"
        ref={more}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && more.current?.open) {
            more.current.open = false;
            more.current.querySelector('summary')?.focus();
          }
        }}
      >
        <summary className="met-chip-summary" aria-label={t('metronome.chip.more')}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </summary>
        <div className="met-chip-panel">
          {why && <p className="met-chip-why">{why}</p>}
          <div className="met-chip-tempo">
            <button
              type="button"
              className="button is-compact met-step"
              aria-label={t('metronome.slower')}
              onClick={() => metronome.nudge(-1)}
            >
              −
            </button>
            <TempoMark unit={unit} bpm={state.target} className="tempo-mark met-chip-mark" />
            <button
              type="button"
              className="button is-compact met-step"
              aria-label={t('metronome.faster')}
              onClick={() => metronome.nudge(1)}
            >
              +
            </button>
            <button
              type="button"
              className="button is-compact"
              onClick={(e) => metronome.tap(e.timeStamp)}
            >
              {t('metronome.tap')}
            </button>
          </div>
          {offer && (
            <button
              type="button"
              className="button is-compact met-chip-offer"
              onClick={() =>
                metronome.update({ bpm: offer.bpm, ...(offer.meter && { meter: offer.meter }) })
              }
            >
              <span>{t('metronome.chip.offer')}</span>
              <TempoMark unit={offerUnit} bpm={offer.bpm} />
              {offer.meter && (
                <span className="met-chip-meter">
                  {offer.meter.numerator}/{offer.meter.denominator}
                </span>
              )}
            </button>
          )}
          <Link
            href="/metronome"
            className="met-chip-link"
            onClick={() => {
              if (more.current) more.current.open = false;
            }}
          >
            {t('metronome.chip.open')}
          </Link>
        </div>
      </details>
    </div>
  );
}
