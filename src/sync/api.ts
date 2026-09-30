import type { ProfileDocument, ProfileSettings, ProfileVisibility } from '../core/profile.ts';
import type { SyncAccount } from '../storage/syncTypes.ts';
import type { Change } from './records.ts';

// The sync service's HTTP protocol (docs/SYNC.md and docs/PROFILE.md, "Protocol"), and nothing
// else.

/** Why a request failed: the service's error code, or `network` when there was no answer. */
export type ApiErrorCode =
  | 'invalid-request'
  | 'unauthorized'
  | 'invalid-code'
  | 'not-found'
  | 'too-large'
  | 'rate-limited'
  | 'unavailable'
  | 'invalid-username'
  | 'username-unavailable'
  | 'no-username'
  | 'profile-changed'
  | 'network';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Seconds, from `Retry-After`. */
  readonly retryAfter: number | null;

  constructor(code: ApiErrorCode, status: number, retryAfter: number | null = null) {
    super(`sync service: ${code} (${status})`);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export interface PulledPage {
  rejected: { collection: string; id: string }[];
  cursor: number;
  more: boolean;
  /** As sent by the service; each is validated before it is used. */
  changes: unknown[];
}

/** `GET /v1/account`: the account with its username and profile settings. */
export interface AccountDetails extends SyncAccount {
  username: string | null;
  profile: ProfileSettings;
  /**
   * What the service takes in a profile document (docs/PROFILE.md, "Version 2"); 1 from a
   * service that does not say.
   */
  profileVersion: number;
}

export interface SyncApi {
  requestCode: (email: string, locale: string) => Promise<void>;
  verify: (
    email: string,
    code: string,
    device: string,
  ) => Promise<{ token: string; account: SyncAccount }>;
  account: (token: string) => Promise<AccountDetails>;
  /** The username as stored. Rejects with `invalid-username` or `username-unavailable`. */
  setUsername: (token: string, username: string) => Promise<string>;
  /** Removes the username; the profile is off. */
  removeUsername: (token: string) => Promise<void>;
  /** The settings as stored. Rejects with `no-username` unless `off`. */
  setProfileSettings: (token: string, settings: ProfileSettings) => Promise<ProfileSettings>;
  /** Publishes the profile. Rejects with `profile-changed` when the settings are not the service's. */
  putProfile: (token: string, document: ProfileDocument) => Promise<void>;
  signOut: (token: string) => Promise<void>;
  deleteAccount: (token: string) => Promise<void>;
  sync: (token: string, cursor: number, changes: readonly Change[]) => Promise<PulledPage>;
  hasFile: (token: string, hash: string) => Promise<boolean>;
  putFile: (token: string, hash: string, text: string) => Promise<void>;
  /** The file's text; null when the service has no such file. */
  getFile: (token: string, hash: string) => Promise<string | null>;
}

const ERROR_CODES: readonly ApiErrorCode[] = [
  'invalid-request',
  'unauthorized',
  'invalid-code',
  'not-found',
  'too-large',
  'rate-limited',
  'unavailable',
  'invalid-username',
  'username-unavailable',
  'no-username',
  'profile-changed',
];

const VISIBILITIES: readonly ProfileVisibility[] = ['off', 'private', 'public'];

/** The settings in an answer; a service without profiles has them off. */
function profileSettings(value: unknown): ProfileSettings {
  const { visibility, titles } = (value ?? {}) as Partial<Record<string, unknown>>;
  return VISIBILITIES.includes(visibility as ProfileVisibility)
    ? { visibility: visibility as ProfileVisibility, titles: titles === true }
    : { visibility: 'off', titles: false };
}

async function failure(response: Response): Promise<ApiError> {
  let code: ApiErrorCode = response.status === 401 ? 'unauthorized' : 'unavailable';
  try {
    const body = (await response.json()) as { error?: unknown };
    if (ERROR_CODES.includes(body.error as ApiErrorCode)) code = body.error as ApiErrorCode;
  } catch {
    // Not our JSON (a proxy, a gateway error): the status decides.
  }
  const retryAfter = Number(response.headers.get('Retry-After'));
  return new ApiError(code, response.status, Number.isFinite(retryAfter) ? retryAfter : null);
}

export function createSyncApi(endpoint: string, fetcher: typeof fetch = fetch): SyncApi {
  const base = endpoint.replace(/\/+$/, '');

  async function call(
    method: string,
    path: string,
    { token, json, text }: { token?: string; json?: unknown; text?: string } = {},
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json !== undefined) headers['Content-Type'] = 'application/json';
    if (text !== undefined) headers['Content-Type'] = 'application/octet-stream';
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        method,
        headers,
        body: json !== undefined ? JSON.stringify(json) : text,
      });
    } catch {
      throw new ApiError('network', 0);
    }
    // A missing file is an answer, not a failure.
    const missingFile =
      response.status === 404 && path.startsWith('/v1/blobs/') && method !== 'PUT';
    if (!response.ok && !missingFile) throw await failure(response);
    return response;
  }

  return {
    async requestCode(email, locale) {
      await call('POST', '/v1/auth/code', { json: { email, locale } });
    },
    async verify(email, code, device) {
      const response = await call('POST', '/v1/auth/verify', { json: { email, code, device } });
      const body = (await response.json()) as { token: string; account: SyncAccount };
      return { token: body.token, account: { id: body.account.id, email: body.account.email } };
    },
    async account(token) {
      const body = (await (await call('GET', '/v1/account', { token })).json()) as SyncAccount & {
        username?: unknown;
        profile?: unknown;
        profileVersion?: unknown;
      };
      return {
        id: body.id,
        email: body.email,
        username: typeof body.username === 'string' ? body.username : null,
        profile: profileSettings(body.profile),
        profileVersion:
          Number.isSafeInteger(body.profileVersion) && (body.profileVersion as number) >= 1
            ? (body.profileVersion as number)
            : 1,
      };
    },
    async setUsername(token, username) {
      const response = await call('PUT', '/v1/account/username', { token, json: { username } });
      return ((await response.json()) as { username: string }).username;
    },
    async removeUsername(token) {
      await call('DELETE', '/v1/account/username', { token });
    },
    async setProfileSettings(token, settings) {
      const response = await call('PUT', '/v1/account/profile', { token, json: settings });
      return profileSettings(await response.json());
    },
    async putProfile(token, document) {
      await call('PUT', '/v1/profile', { token, json: { document } });
    },
    async signOut(token) {
      await call('POST', '/v1/auth/signout', { token });
    },
    async deleteAccount(token) {
      await call('DELETE', '/v1/account', { token });
    },
    async sync(token, cursor, changes) {
      const response = await call('POST', '/v1/sync', { token, json: { cursor, changes } });
      return (await response.json()) as PulledPage;
    },
    async hasFile(token, hash) {
      return (await call('HEAD', `/v1/blobs/${hash}`, { token })).ok;
    },
    async putFile(token, hash, text) {
      await call('PUT', `/v1/blobs/${hash}`, { token, text });
    },
    async getFile(token, hash) {
      const response = await call('GET', `/v1/blobs/${hash}`, { token });
      return response.status === 404 ? null : response.text();
    },
  };
}
