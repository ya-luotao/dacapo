import type { UsernameProblem } from '../../core/profile.ts';
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

// The public profile (docs/PROFILE.md).

const USERNAME_MESSAGES: Record<UsernameProblem, MessageKey> = {
  length: 'settings.profile.error.length',
  characters: 'settings.profile.error.characters',
  edges: 'settings.profile.error.edges',
  hyphens: 'settings.profile.error.hyphens',
  unavailable: 'settings.profile.error.unavailable',
};

/** What to say about a username the rules refuse. */
export const usernameMessage = (problem: UsernameProblem): AccountMessage => ({
  key: USERNAME_MESSAGES[problem],
});

/** The message for a failed profile request. */
export function profileError(error: unknown): AccountMessage {
  if (error instanceof ApiError) {
    switch (error.code) {
      // The service's rules are the app's, so a name it calls invalid is simply not available.
      case 'invalid-username':
      case 'username-unavailable':
        return { key: 'settings.profile.error.unavailable' };
      case 'no-username':
        return { key: 'settings.profile.visibility.needsUsername' };
    }
  }
  return accountError(error, 'account');
}

/**
 * The public page of `username`: on the service's own domain (`api.` taken off), where the
 * service serves it; under the endpoint itself for a local service.
 */
export function profileUrl(endpoint: string, username: string): string {
  const url = new URL(endpoint);
  if (url.hostname.startsWith('api.')) url.hostname = url.hostname.slice(4);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${encodeURIComponent(username)}`;
  url.search = '';
  url.hash = '';
  return url.href;
}
