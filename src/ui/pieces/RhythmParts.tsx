import { useEffect, useRef, useState } from 'react';
import { useT } from '../../i18n/index.ts';
import type { ClickMode } from '../../output/rhythm.ts';
import { Calibration } from './Calibration.tsx';
import type { LastNote } from './rhythm.ts';
import type { Latency } from './rhythmPrefs.ts';
import { useTimingWords } from './timingWords.ts';
import type { RhythmSnapshot } from './useRhythmPlayer.ts';

// Rhythm mode's parts of the practice view: the calibration sheet, the status line and the
// quiet mark for the last note's timing.

/** Before a rhythm run: an offer to calibrate first, or the calibration itself. */
export function CalibrationSheet({
  offer,
  onCalibrate,
  onStart,
  onRunning,
  onChange,
  onClose,
}: {
  offer: boolean;
  onCalibrate: () => void;
  onStart: () => void;
  onRunning: (running: boolean) => void;
  onChange: (latency: Latency) => void;
  onClose: () => void;
}) {
  const t = useT();
  const heading = useRef<HTMLHeadingElement>(null);
  const [calibrated, setCalibrated] = useState(false);
  useEffect(() => heading.current?.focus({ preventScroll: true }), [offer]);
  return (
    <section
      className="piece-summary calibration-sheet"
      aria-labelledby="calibration-sheet-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <h2 id="calibration-sheet-title" ref={heading} tabIndex={-1}>
        {offer ? t('pieces.calibrate.title') : t('calibration.title')}
      </h2>
      {offer ? (
        <>
          <p>{t('pieces.calibrate.text')}</p>
          <div className="actions">
            <button type="button" className="button button-primary" onClick={onCalibrate}>
              {t('pieces.calibrate.now')}
            </button>
            <button type="button" className="button" onClick={onStart}>
              {t('pieces.calibrate.skip')}
            </button>
          </div>
        </>
      ) : (
        <>
          <Calibration
            title={false}
            onRunning={onRunning}
            onChange={(latency) => {
              setCalibrated(true);
              onChange(latency);
            }}
          />
          <div className="actions">
            <button
              type="button"
              className={calibrated ? 'button button-primary' : 'button'}
              onClick={onStart}
            >
              {t('pieces.calibrate.start')}
            </button>
            <button type="button" className="button" onClick={onClose}>
              {t('pieces.weak.table.close')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/** Rhythm mode's status: ready, the count-in, or where the music is and how the last note was. */
export function RhythmStatus({
  beat,
  ended,
  last,
  nothing,
  click,
  bpm,
  step,
  bar,
  beatLabel,
}: {
  beat: RhythmSnapshot;
  /** Stopped before any note was due. */
  ended: boolean;
  last: LastNote | null;
  nothing: boolean;
  click: ClickMode;
  bpm: number;
  step: { pass: number } | null;
  bar: string;
  beatLabel: string;
}) {
  const t = useT();
  if (nothing) return <p className="piece-status-main">{t('pieces.nothing')}</p>;
  const tempo = t('pieces.tempo.bpm', { bpm });
  if (beat.state === 'stopped') {
    return (
      <p className="piece-status-main">
        <span>
          {ended
            ? t('pieces.rhythm.nothing')
            : click === 'off'
              ? t('pieces.rhythm.readyQuiet')
              : t('pieces.rhythm.ready')}
        </span>
        <span className="muted">{tempo}</span>
      </p>
    );
  }
  if (beat.state === 'counting') {
    return (
      <p className="piece-status-main">
        <strong className="piece-count">
          {beat.count === null ? '' : t('pieces.status.countIn', { beat: beat.count })}
        </strong>
        <span className="muted">{tempo}</span>
      </p>
    );
  }
  const parts = [
    `${t('pieces.status.bar', { bar })}${step && step.pass > 1 ? ` (${t('pieces.status.repeat')})` : ''}`,
    t('pieces.status.beat', { beat: beatLabel }),
    tempo,
  ];
  return (
    <p className="piece-status-main">
      <span>{parts.join(' · ')}</span>
      <TimingMark last={last} />
    </p>
  );
}

/** The last note's timing: a short scale with a tick, and the words. Static: nothing flashes. */
function TimingMark({ last }: { last: LastNote | null }) {
  const t = useT();
  const timing = useTimingWords();
  if (!last) return null;
  const words = last.kind === 'extra' ? t('pieces.timing.extra') : timing(last.deviation);
  const x =
    last.kind === 'hit' ? 30 + (Math.max(-150, Math.min(150, last.deviation)) / 150) * 26 : null;
  return (
    <span className="timing-mark">
      <span className="visually-hidden">{t('pieces.timing.label')}: </span>
      <svg viewBox="0 0 60 12" aria-hidden="true">
        <line className="timing-track" x1="4" x2="56" y1="6" y2="6" />
        <line className="timing-zero" x1="30" x2="30" y1="1" y2="11" />
        {x !== null && <line className="timing-tick" x1={x} x2={x} y1="2" y2="10" />}
      </svg>
      <span className={last.kind === 'extra' ? 'timing-words is-extra' : 'timing-words'}>
        {words}
      </span>
    </span>
  );
}
