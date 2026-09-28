import type { SyncAccount } from '../storage/syncTypes.ts';
import type { Change } from './records.ts';

// The sync service's HTTP protocol (docs/SYNC.md, "Protocol"), and nothing else.

/** Why a request failed: the service's error code, or `network` when there was no answer. */
export type ApiErrorCode =
  | 'invalid-request'
  | 'unauthorized'
  | 'invalid-code'
  | 'not-found'
  | 'too-large'
  | 'rate-limited'
  | 'unavailable'
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

export interface SyncApi {
  requestCode: (email: string, locale: string) => Promise<void>;
  verify: (
    email: string,
    code: string,
    device: string,
  ) => Promise<{ token: string; account: SyncAccount }>;
  account: (token: string) => Promise<SyncAccount>;
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
];

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
      const body = (await (await call('GET', '/v1/account', { token })).json()) as SyncAccount;
      return { id: body.id, email: body.email };
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
