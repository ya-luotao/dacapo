import { describe, expect, it } from 'vitest';
import type { StorageState, StorageStatus } from '../practice/store.ts';
import { inMemory, storageMessage } from './storageMessage.ts';

const status = (state: StorageState, patch: Partial<StorageStatus> = {}): StorageStatus => ({
  state,
  loaded: true,
  read: state === 'saved',
  persisted: null,
  ...patch,
});

describe('what Settings says of where the progress is kept', () => {
  it('says it is loading until the stored data is in', () => {
    for (const state of ['loading', 'blocked', 'newer', 'unavailable'] as const) {
      expect(storageMessage(status(state, { loaded: false }))).toBe('settings.storage.loading');
    }
  });

  it('says whether the browser keeps it, once it is saved', () => {
    expect(storageMessage(status('saved', { persisted: true }))).toBe('settings.storage.persisted');
    expect(storageMessage(status('saved', { persisted: false }))).toBe(
      'settings.storage.notPersisted',
    );
    expect(storageMessage(status('saved'))).toBe('settings.storage.unknown');
  });

  it('says it is not saved where storage cannot be used, as a warning', () => {
    expect(storageMessage(status('unavailable'))).toBe('settings.storage.memory');
    expect(inMemory(status('unavailable'))).toBe(true);
  });

  it('says the page is older than the data over a database of a later version, not that the browser refuses', () => {
    // Whatever the browser would say of keeping it: nothing of this tab is stored.
    for (const persisted of [null, true, false]) {
      expect(storageMessage(status('newer', { persisted }))).toBe('settings.storage.newer');
    }
    expect(inMemory(status('newer'))).toBe(true);
  });

  it('is no warning in any other state', () => {
    for (const state of ['loading', 'blocked', 'saved', 'failed', 'outdated'] as const) {
      expect(inMemory(status(state))).toBe(false);
    }
  });
});
