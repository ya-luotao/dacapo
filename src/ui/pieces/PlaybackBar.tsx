import { useEffect, useId, useRef } from 'react';
import { midiName } from '../../core/note.ts';
import type { CompareBy, PlaybackPart, TakePlayback } from '../../core/takePlayback.ts';
import { useT } from '../../i18n/index.ts';
import type { DemoState } from '../../output/demo.ts';
import type { PieceFormat } from './format.ts';

export type CompareChoice = 'off' | CompareBy;
const COMPARE_CHOICES: readonly CompareChoice[] = ['off', 'bar', 'whole'];

/**
 * Below the score while a run is played back (docs/PIECES.md, "Play back your run"): what plays
 * and where, the wrong key that fell there, and play or pause, from a bar, Compare and Close.
 */
export function PlaybackBar({
  playback,
  compare,
  state,
  title,
  part,
  bar,
  wrong,
  format,
  onToggle,
  onFrom,
  onCompare,
  onClose,
}: {
  playback: TakePlayback;
  compare: CompareChoice;
  state: DemoState;
  /** Which run: "Your run of 1 Oct, 14:02", or "This run". */
  title: string;
  /** In Compare: the score as written, or the run. */
  part: PlaybackPart | null;
  /** The bar the cursor is in, as the status line says it; empty when none. */
  bar: string;
  /** Wrong keys sounding now. */
  wrong: readonly number[];
  format: PieceFormat;
  onToggle: () => void;
  onFrom: (measure: number) => void;
  onCompare: (choice: CompareChoice) => void;
  onClose: () => void;
}) {
  const t = useT();
  const id = useId();
  const play = useRef<HTMLButtonElement>(null);
  useEffect(() => play.current?.focus({ preventScroll: true }), []);

  const what = part
    ? part.kind === 'written'
      ? t('pieces.playback.written')
      : t('pieces.playback.yours')
    : title;
  const parts = [what];
  if (state === 'paused') parts.push(t('pieces.playback.paused'));
  if (bar) parts.push(bar);

  return (
    <div
      className="playback"
      role="group"
      aria-label={t('pieces.playback.region', { title })}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        onClose();
      }}
    >
      <p className="piece-status-main playback-status">
        <span>{parts.join(' · ')}</span>
        {wrong.length > 0 && (
          <strong className="playback-wrong">
            {t('pieces.playback.wrong', { notes: wrong.map((m) => midiName(m)).join(' ') })}
          </strong>
        )}
      </p>
      <div className="playback-controls">
        <button
          ref={play}
          type="button"
          className="button button-primary is-compact piece-go piece-listen"
          onClick={onToggle}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {state === 'playing' ? (
              <path d="M5 3.5v9M11 3.5v9" />
            ) : (
              <path d="M5 3l8 5-8 5z" className="is-filled" />
            )}
          </svg>
          <span>
            {state === 'playing'
              ? t('pieces.demo.pause')
              : state === 'paused'
                ? t('pieces.demo.resume')
                : t('pieces.playback.play')}
          </span>
        </button>
        {playback.bars.length > 1 && (
          <label className="piece-control">
            <span className="piece-control-label">{t('pieces.playback.from')}</span>
            <select
              className="is-compact"
              aria-label={t('pieces.playback.from.label')}
              value=""
              onChange={(e) => {
                if (e.target.value !== '') onFrom(Number(e.target.value));
              }}
            >
              <option value="" disabled>
                –
              </option>
              {playback.bars.map((b) => (
                <option key={b.measure} value={b.measure}>
                  {format.barNumber(b.measure)}
                </option>
              ))}
            </select>
          </label>
        )}
        <fieldset className="piece-control" aria-describedby={`${id}-compare`}>
          <legend className="visually-hidden">{t('pieces.playback.compare')}</legend>
          <span className="piece-control-label" aria-hidden="true">
            {t('pieces.playback.compare')}
          </span>
          <div className="segmented is-compact">
            {COMPARE_CHOICES.map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name={`${id}-compare`}
                  value={choice}
                  checked={compare === choice}
                  onChange={() => onCompare(choice)}
                />
                <span>{t(`pieces.playback.compare.${choice}`)}</span>
              </label>
            ))}
          </div>
          <span id={`${id}-compare`} className="visually-hidden">
            {t('pieces.playback.compare.help')}
          </span>
        </fieldset>
        <button type="button" className="button is-compact playback-close" onClick={onClose}>
          {t('pieces.playback.close')}
        </button>
      </div>
    </div>
  );
}
