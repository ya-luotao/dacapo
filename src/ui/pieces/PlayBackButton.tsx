import { useId } from 'react';
import { useT } from '../../i18n/index.ts';

/** "Play back": a run's take through the output, on the score (docs/PIECES.md, P5). */
export function PlayBackButton({
  onClick,
  compact = false,
}: {
  onClick: () => void;
  compact?: boolean;
}) {
  const t = useT();
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={compact ? 'button is-compact play-back' : 'button play-back'}
        aria-describedby={id}
        onClick={onClick}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M5 3l8 5-8 5z" className="is-filled" />
        </svg>
        <span>{t('pieces.playback')}</span>
      </button>
      <span id={id} className="visually-hidden">
        {t('pieces.playback.help')}
      </span>
    </>
  );
}
