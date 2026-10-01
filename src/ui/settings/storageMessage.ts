import type { MessageKey } from '../../i18n/index.ts';
import type { StorageStatus } from '../practice/store.ts';

/** Progress lives in this tab alone: storage cannot be used, or holds a later version's data. */
export const inMemory = (status: StorageStatus): boolean =>
  status.state === 'unavailable' || status.state === 'newer';

/** What Settings says of where the progress is kept. */
export function storageMessage(status: StorageStatus): MessageKey {
  if (!status.loaded) return 'settings.storage.loading';
  // A database made by a later version of dacapo: not a browser that refuses to store.
  if (status.state === 'newer') return 'settings.storage.newer';
  if (status.state === 'unavailable') return 'settings.storage.memory';
  if (status.persisted === true) return 'settings.storage.persisted';
  if (status.persisted === false) return 'settings.storage.notPersisted';
  return 'settings.storage.unknown';
}
