import { useId } from 'react';
import { useT } from '../../i18n/index.ts';

/**
 * "Save as MIDI": a run's take as a Standard MIDI File (docs/PIECES.md, "A take as a MIDI
 * file"), beside "Play back" and in its manner.
 */
export function SaveMidiButton({
  onClick,
  compact = false,
  help,
}: {
  onClick: () => void;
  compact?: boolean;
  /** What is saved, for a screen reader; a piece's run when absent. */
  help?: string;
}) {
  const t = useT();
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={compact ? 'button is-compact play-back save-midi' : 'button play-back save-midi'}
        aria-describedby={id}
        onClick={onClick}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 2.5v7.5M4.75 7L8 10.25 11.25 7M3 13.25h10" />
        </svg>
        <span>{t('pieces.saveMidi')}</span>
      </button>
      <span id={id} className="visually-hidden">
        {help ?? t('pieces.saveMidi.help')}
      </span>
    </>
  );
}
