import { describe, expect, it } from 'vitest';
import { ApiError, createSyncApi } from './api.ts';
import { canonical } from '../lib/canonical.ts';

function recorder(respond: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request.clone());
    return respond(request);
  }) as typeof fetch;
  return { requests, fetcher };
}

const json = (value: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

describe('the HTTP protocol', () => {
  it('sends the token and JSON, under the endpoint', async () => {
    const { requests, fetcher } = recorder(() =>
      json({ rejected: [], cursor: 3, more: false, changes: [] }),
    );
    const api = createSyncApi('https://api.playdacapo.com/', fetcher);
    const page = await api.sync('tok', 2, [{ collection: 'attempts', id: 'a1', body: { ms: 1 } }]);
    expect(page).toEqual({ rejected: [], cursor: 3, more: false, changes: [] });
    const [request] = requests;
    expect(request!.url).toBe('https://api.playdacapo.com/v1/sync');
    expect(request!.method).toBe('POST');
    expect(request!.headers.get('Authorization')).toBe('Bearer tok');
    expect(await request!.json()).toEqual({
      cursor: 2,
      changes: [{ collection: 'attempts', id: 'a1', body: { ms: 1 } }],
    });
  });

  it('turns error answers into their codes, with Retry-After', async () => {
    const { fetcher } = recorder(() =>
      json({ error: 'rate-limited' }, 429, { 'Retry-After': '40' }),
    );
    const error = await createSyncApi('https://x', fetcher)
      .requestCode('a@example.com', 'en')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'rate-limited', status: 429, retryAfter: 40 });
  });

  it('takes an answer that is not the service’s by its status', async () => {
    const { fetcher } = recorder(() => new Response('Bad gateway', { status: 502 }));
    await expect(createSyncApi('https://x', fetcher).account('t')).rejects.toMatchObject({
      code: 'unavailable',
      status: 502,
    });
    const unauthorized = recorder(() => new Response('', { status: 401 }));
    await expect(
      createSyncApi('https://x', unauthorized.fetcher).account('t'),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('reports no answer at all as a network error', async () => {
    const fetcher = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    await expect(createSyncApi('https://x', fetcher).account('t')).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('treats a missing file as an answer', async () => {
    const { fetcher, requests } = recorder((request) =>
      request.method === 'PUT'
        ? new Response(null, { status: 204 })
        : json({ error: 'not-found' }, 404),
    );
    const api = createSyncApi('https://x', fetcher);
    expect(await api.hasFile('t', 'abc')).toBe(false);
    expect(await api.getFile('t', 'abc')).toBeNull();
    await api.putFile('t', 'abc', '<score>é</score>');
    expect(await requests[2]!.text()).toBe('<score>é</score>');
  });
});

describe('canonical bodies', () => {
  it('orders keys at every depth, so two copies of a record serialize the same', () => {
    const a = { b: 1, a: { d: [{ y: 1, x: 2 }], c: null } };
    const b = { a: { c: null, d: [{ x: 2, y: 1 }] }, b: 1 };
    expect(JSON.stringify(canonical(a))).toBe(JSON.stringify(canonical(b)));
    expect(JSON.stringify(canonical(a))).toBe('{"a":{"c":null,"d":[{"x":2,"y":1}]},"b":1}');
  });
});
