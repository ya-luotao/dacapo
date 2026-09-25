import { useEffect, useId, useRef, useState } from 'react';
import {
  calibrate,
  calibrationClicks,
  CALIBRATION_CLICKS,
  CALIBRATION_INTERVAL_MS,
  type Calibration as Result,
} from '../../core/calibration.ts';
import { useI18n } from '../../i18n/index.ts';
import { useInput } from '../input/context.ts';
import { readClickVolume, readLatency, writeLatency, type Latency } from './rhythmPrefs.ts';
import { sharedClickTrack } from './useRhythmPlayer.ts';

/** Time before the first click, so it is not scheduled late. */
const LEAD_MS = 600;
/** Taps are still taken this long after the last click. */
const TAIL_MS = CALIBRATION_INTERVAL_MS;

type State =
  | { kind: 'idle' }
  | { kind: 'running'; clicks: number[]; heard: number }
  | { kind: 'result'; result: Result };

/**
 * Tap along with 16 clicks; the offset is stored for rhythm mode. `onChange` hears of a new
 * offset; `onRunning` of a calibration starting and stopping (keys must not play meanwhile).
 */
export function Calibration({
  tips = true,
  title = true,
  onChange,
  onRunning,
}: {
  tips?: boolean;
  /** Off where a heading already names it. */
  title?: boolean;
  onChange?: (latency: Latency) => void;
  onRunning?: (running: boolean) => void;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const { hub } = useInput();
  const [latency, setLatency] = useState(readLatency);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [noAudio, setNoAudio] = useState(false);
  const taps = useRef<number[]>([]);
  const running = state.kind === 'running';
  const clicks = running ? state.clicks : null;

  useEffect(() => {
    if (!clicks) return;
    onRunning?.(true);
    const off = hub.onEvent((event) => {
      if (event.type === 'on') taps.current.push(event.time);
    });
    const timer = setInterval(() => {
      const now = performance.now();
      const heard = clicks.filter((c) => c <= now).length;
      if (now < clicks.at(-1)! + TAIL_MS) {
        setState((s) => (s.kind === 'running' && s.heard !== heard ? { ...s, heard } : s));
        return;
      }
      const result = calibrate(clicks, taps.current);
      if (result.ok) {
        const next = { offset: Math.round(result.offset), at: Date.now() };
        writeLatency(next);
        setLatency(next);
        onChange?.(next);
      }
      setState({ kind: 'result', result });
    }, 50);
    return () => {
      off();
      clearInterval(timer);
      sharedClickTrack()?.stop();
      onRunning?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per calibration
  }, [clicks, hub]);

  function start() {
    const track = sharedClickTrack();
    if (!track) {
      setNoAudio(true);
      return;
    }
    const first = performance.now() + LEAD_MS;
    const times = calibrationClicks(first);
    taps.current = [];
    track.setVolume(readClickVolume() / 100);
    track.start((from, to) =>
      times.flatMap((time, i) =>
        time >= from && time < to ? [{ time, accent: i % 4 === 0 }] : [],
      ),
    );
    setState({ kind: 'running', clicks: times, heard: 0 });
  }

  const ms = (value: number) => Math.round(Math.abs(value));
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <div
      className="calibration"
      role="group"
      aria-labelledby={title ? `${id}-title` : undefined}
      aria-label={title ? undefined : t('calibration.title')}
    >
      {title && (
        <p id={`${id}-title`} className="eyebrow calibration-title">
          {t('calibration.title')}
        </p>
      )}
      <p className="help">{t('calibration.help')}</p>
      {tips && (
        <ul className="calibration-tips help">
          <li>{t('calibration.lineIn')}</li>
          <li>{t('calibration.bluetooth')}</li>
        </ul>
      )}
      <div className="calibration-row" aria-live="polite">
        {state.kind === 'running' ? (
          <>
            <p className="calibration-progress">
              {t('calibration.listening', {
                n: Math.max(1, state.heard),
                total: CALIBRATION_CLICKS,
              })}
            </p>
            <button
              type="button"
              className="button is-compact"
              onClick={() => setState({ kind: 'idle' })}
            >
              {t('calibration.cancel')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="button is-compact" onClick={start}>
              {latency || state.kind === 'result' ? t('calibration.again') : t('calibration.start')}
            </button>
            <p className="calibration-status">
              {noAudio ? (
                t('calibration.noAudio')
              ) : state.kind === 'result' ? (
                state.result.ok ? (
                  <>
                    {t(state.result.offset >= 0 ? 'calibration.late' : 'calibration.early', {
                      ms: ms(state.result.offset),
                    })}{' '}
                    {t('calibration.saved')}
                  </>
                ) : state.result.reason === 'few' ? (
                  t('calibration.few', { n: state.result.taps })
                ) : (
                  t('calibration.uneven', { ms: ms(state.result.spread) })
                )
              ) : latency ? (
                t('calibration.current', { ms: latency.offset, date: date.format(latency.at) })
              ) : (
                t('calibration.none')
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
