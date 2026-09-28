import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SyncClient, SyncStatus } from '../../sync/client.ts';

/** The sync client; null in a build without a sync service. */
export const SyncContext = createContext<SyncClient | null>(null);

export const useSyncClient = (): SyncClient | null => useContext(SyncContext);

const NONE = () => () => {};
const NO_STATUS = () => null;

/** The client's status; null in a build without a sync service. */
export function useSyncStatus(): SyncStatus | null {
  const client = useSyncClient();
  return useSyncExternalStore(client?.subscribe ?? NONE, client?.getStatus ?? NO_STATUS);
}
