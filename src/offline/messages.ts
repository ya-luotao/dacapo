// What the page and the offline worker say to each other (client.ts, worker.ts). The worker in
// charge may be another build's than the page's, so this stays small and is checked on arrival.

import { OFFLINE_GROUPS, type OfflineGroup } from './files.ts';

export type OfflineRequest =
  /** What is stored. Answered with an `OfflineStatus`. */
  | { type: 'status' }
  /** Store this file of the list (its address below the scope). Answered with a `StoreReply`. */
  | { type: 'store'; file: string };

export interface MissingFile {
  file: string;
  group: OfflineGroup;
}

export interface OfflineStatus {
  version: string;
  /** The app's files: how many there are, and those not in the store. */
  app: { total: number; missing: string[] };
  /** The rest of the list: how many files and bytes, and those not in the store. */
  rest: { total: number; bytes: number; missing: MissingFile[] };
}

export interface StoreReply {
  /** False when the file could not be fetched or the store would not take it (no space left). */
  ok: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function isOfflineRequest(value: unknown): value is OfflineRequest {
  if (!isRecord(value)) return false;
  if (value.type === 'status') return true;
  return value.type === 'store' && typeof value.file === 'string';
}

export function isOfflineStatus(value: unknown): value is OfflineStatus {
  if (!isRecord(value) || typeof value.version !== 'string') return false;
  const { app, rest } = value;
  if (!isRecord(app) || !isCount(app.total) || !Array.isArray(app.missing)) return false;
  if (!app.missing.every((file) => typeof file === 'string')) return false;
  if (!isRecord(rest) || !isCount(rest.total) || !isCount(rest.bytes)) return false;
  return (
    Array.isArray(rest.missing) &&
    rest.missing.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.file === 'string' &&
        (OFFLINE_GROUPS as readonly unknown[]).includes(entry.group),
    )
  );
}

export function isStoreReply(value: unknown): value is StoreReply {
  return isRecord(value) && typeof value.ok === 'boolean';
}
