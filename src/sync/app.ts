import type { SessionRecord } from '../core/log.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import { FIRST_DAY, preferredLocale } from '../i18n/locale.ts';
import { currentShell, isPractising, onPracticeEnd } from '../lib/shell.ts';
import { createSyncApi } from './api.ts';
import { createSyncClient, type SyncClient, type SyncHost } from './client.ts';
import { deviceName } from './device.ts';

/** The app's sync client; null when the build has no sync service (VITE_SYNC_ENDPOINT unset). */
export function createAppSync(
  host: SyncHost & {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => { sessions: readonly SessionRecord[]; pieces: readonly StoredPiece[] };
    getStatus: () => { loaded: boolean };
  },
  endpoint = import.meta.env.VITE_SYNC_ENDPOINT,
) {
  if (!endpoint) return null;
  return createSyncClient({
    api: createSyncApi(endpoint),
    host,
    isBusy: isPractising,
    onIdle: onPracticeEnd,
    onChange: host.subscribe,
    // The week starts where the Progress page's grid starts it, in the language in use.
    // Not before the stored records are loaded: an empty grid would replace the published one.
    profileSource: () => {
      if (!host.getStatus().loaded) return null;
      const { sessions, pieces } = host.getSnapshot();
      return { sessions, pieces, firstDay: FIRST_DAY[preferredLocale()] };
    },
  });
}

export function thisDevice(): string {
  return deviceName(navigator.userAgent, currentShell(), navigator.maxTouchPoints);
}

export type { SyncClient };
