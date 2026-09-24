import { useState } from 'react';
import { useT, type MessageKey } from '../i18n/index.ts';
import { useStorageStatus } from './practice/context.ts';
import type { StorageState } from './practice/store.ts';

const MESSAGES: Partial<Record<StorageState, MessageKey>> = {
  blocked: 'storage.blocked',
  unavailable: 'storage.unavailable',
  failed: 'storage.failed',
  outdated: 'storage.outdated',
};

/** A non-blocking notice when progress is not being saved. */
export function StorageNotice() {
  const t = useT();
  const { state } = useStorageStatus();
  const [dismissed, setDismissed] = useState<StorageState | null>(null);
  const message = MESSAGES[state];
  if (!message || dismissed === state) return null;

  return (
    <div className="storage-notice" role="status">
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.75l6.5 12H1.5z" />
        <path d="M8 6.25v3.5M8 11.75v.01" />
      </svg>
      <p>{t(message)}</p>
      {state === 'outdated' ? (
        <button type="button" className="button" onClick={() => window.location.reload()}>
          {t('storage.reload')}
        </button>
      ) : (
        <button type="button" className="button" onClick={() => setDismissed(state)}>
          {t('storage.dismiss')}
        </button>
      )}
    </div>
  );
}
