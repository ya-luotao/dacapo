import { useState } from 'react';
import { useT } from '../../i18n/index.ts';
import { useMidiStatus } from './context.ts';
import { noticeReason, noticeShown, noticeText, readDismissed, writeDismissed } from './notice.ts';

/**
 * What is playing, on a practice page (docs/START.md): while no MIDI keyboard is connected, one
 * line says so and what plays instead, until it is dismissed. Nothing while the browser is still
 * looking, and nothing with a keyboard connected. Play and Settings have the fuller help.
 */
export function InputNotice() {
  const t = useT();
  const { state } = useMidiStatus();
  // The reason dismissed on this device: another reason brings the line back.
  const [dismissed, setDismissed] = useState(readDismissed);
  const reason = noticeReason(state);
  if (!noticeShown(reason, dismissed)) return null;

  function dismiss() {
    setDismissed(reason);
    writeDismissed(reason);
  }
  return (
    <p className="input-notice" role="status">
      <span>{noticeText(state, t)}</span>
      <button
        type="button"
        className="button-icon"
        aria-label={t('storage.dismiss')}
        title={t('storage.dismiss')}
        onClick={dismiss}
      >
        <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </p>
  );
}
