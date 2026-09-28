import type { ReactNode } from 'react';
import type { SyncClient } from '../../sync/client.ts';
import { SyncContext } from './context.ts';

/** Provides the sync client, created and started once outside React; null without a service. */
export function SyncProvider({
  client,
  children,
}: {
  client: SyncClient | null;
  children: ReactNode;
}) {
  return <SyncContext value={client}>{children}</SyncContext>;
}
