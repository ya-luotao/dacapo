import type { MessageKey } from '../../i18n/index.ts';
import { ApiError } from '../../sync/api.ts';
import type { SyncStatus } from '../../sync/client.ts';

// The account section's wording, apart from React so it can be tested.

export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** What the code field keeps of what was typed or pasted: its digits, at most six. */
export const codeDigits = (value: string): string => value.replace(/\D/g, '').slice(0, 6);

export interface AccountMessage {
  key: MessageKey;
  /** Seconds to wait, for `settings.account.error.rateLimited`. */
  wait?: number;
}

/** The message for a failed request; `step` tells a bad address from a bad code. */
export function accountError(error: unknown, step: 'email' | 'code' | 'account'): AccountMessage {
  if (!(error instanceof ApiError)) return { key: 'settings.account.error.unavailable' };
  switch (error.code) {
    case 'invalid-request':
      return {
        key: step === 'email' ? 'settings.account.error.email' : 'settings.account.error.code',
      };
    case 'invalid-code':
      return { key: 'settings.account.error.code' };
    case 'rate-limited':
      return { key: 'settings.account.error.rateLimited', wait: error.retryAfter ?? 60 };
    case 'network':
      return { key: 'settings.account.error.network' };
    default:
      return { key: 'settings.account.error.unavailable' };
  }
}

/** The line under the signed-in address. */
export function statusKey(status: SyncStatus): MessageKey {
  switch (status.phase) {
    case 'syncing':
      return 'settings.account.status.syncing';
    case 'offline':
      return 'settings.account.status.offline';
    case 'error':
      return 'settings.account.status.error';
    default:
      return status.lastSyncAt === null
        ? 'settings.account.status.never'
        : 'settings.account.status.synced';
  }
}
