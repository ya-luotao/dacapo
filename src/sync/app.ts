import { currentShell, isPractising, onPracticeEnd } from '../lib/shell.ts';
import { createSyncApi } from './api.ts';
import { createSyncClient, type SyncClient, type SyncHost } from './client.ts';
import { deviceName } from './device.ts';

/** The app's sync client; null when the build has no sync service (VITE_SYNC_ENDPOINT unset). */
export function createAppSync(
  host: SyncHost & { subscribe: (listener: () => void) => () => void },
  endpoint = import.meta.env.VITE_SYNC_ENDPOINT,
) {
  if (!endpoint) return null;
  return createSyncClient({
    api: createSyncApi(endpoint),
    host,
    isBusy: isPractising,
    onIdle: onPracticeEnd,
    onChange: host.subscribe,
  });
}

export function thisDevice(): string {
  return deviceName(navigator.userAgent, currentShell(), navigator.maxTouchPoints);
}

export type { SyncClient };
