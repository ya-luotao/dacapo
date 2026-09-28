import { describe, expect, it } from 'vitest';
import { ApiError } from '../../sync/api.ts';
import type { SyncStatus } from '../../sync/client.ts';
import { accountError, codeDigits, isEmail, statusKey } from './account.ts';

const status = (patch: Partial<SyncStatus>): SyncStatus => ({
  available: true,
  phase: 'idle',
  account: { id: 'a', email: 'a@example.com' },
  lastSyncAt: null,
  error: null,
  ...patch,
});

describe('the account section', () => {
  it('checks the address the way the service does', () => {
    expect(isEmail(' pianist@example.com ')).toBe(true);
    expect(isEmail('pianist@example')).toBe(false);
    expect(isEmail('two words@example.com')).toBe(false);
  });

  it('keeps the digits of a pasted code', () => {
    expect(codeDigits(' 123 456 ')).toBe('123456');
    expect(codeDigits('Your code: 1234567')).toBe('123456');
  });

  it('explains a failed request', () => {
    expect(accountError(new ApiError('invalid-request', 400), 'email').key).toBe(
      'settings.account.error.email',
    );
    expect(accountError(new ApiError('invalid-request', 400), 'code').key).toBe(
      'settings.account.error.code',
    );
    expect(accountError(new ApiError('invalid-code', 401), 'code').key).toBe(
      'settings.account.error.code',
    );
    expect(accountError(new ApiError('rate-limited', 429, 40), 'email')).toEqual({
      key: 'settings.account.error.rateLimited',
      wait: 40,
    });
    expect(accountError(new ApiError('network', 0), 'account').key).toBe(
      'settings.account.error.network',
    );
    expect(accountError(new Error('storage'), 'code').key).toBe(
      'settings.account.error.unavailable',
    );
  });

  it('says how syncing is going', () => {
    expect(statusKey(status({}))).toBe('settings.account.status.never');
    expect(statusKey(status({ lastSyncAt: 1 }))).toBe('settings.account.status.synced');
    expect(statusKey(status({ phase: 'syncing' }))).toBe('settings.account.status.syncing');
    expect(statusKey(status({ phase: 'offline', lastSyncAt: 1 }))).toBe(
      'settings.account.status.offline',
    );
    expect(statusKey(status({ phase: 'error' }))).toBe('settings.account.status.error');
  });
});
