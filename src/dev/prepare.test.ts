// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDacapoDB } from '../storage/db.ts';
import { resetIndexedDB, sampleAttempt, T0 } from '../storage/fixtures.ts';
import { createIndexedDbRepository } from '../storage/repository.ts';
import { prepareScenario } from './prepare.ts';

beforeEach(() => {
  resetIndexedDB();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function load() {
  const repository = createIndexedDbRepository(await openDacapoDB());
  try {
    return await repository.load();
  } finally {
    repository.close();
  }
}

describe('disposable dev scenarios', () => {
  it('recreates recent progress, including note statistics, rather than accumulating edits', async () => {
    localStorage.setItem('unrelated', 'keep');
    expect(await prepareScenario('progress', T0, vi.fn())).toBe('#/progress');
    const first = await load();
    expect(first.sessions).toHaveLength(10);
    expect(first.attempts).toHaveLength(100);
    expect(first.attempts.filter((attempt) => attempt.correct)).toHaveLength(75);
    expect(Object.keys(first.stats)).toHaveLength(5);
    expect(first.attempts.every((attempt) => attempt.at < T0)).toBe(true);
    expect(Math.min(...first.attempts.map((attempt) => attempt.at))).toBeGreaterThan(
      T0 - 7 * 86_400_000,
    );

    const repository = createIndexedDbRepository(await openDacapoDB());
    await repository.addAttempt(sampleAttempt(999));
    repository.close();
    localStorage.setItem('dacapo.learn.done', '["keyboard"]');
    localStorage.setItem('dacapo.locale', 'ja');
    await prepareScenario('progress', T0, vi.fn());
    expect(await load()).toEqual(first);
    expect(localStorage.getItem('dacapo.learn.done')).toBeNull();
    expect(localStorage.getItem('dacapo.locale')).toBe('en');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });

  it.each([
    ['empty', '#/start'],
    ['piece', '#/pieces/beethoven-ode-to-joy?mode=wait&hands=right&bars=1-4'],
  ])('resets %s without carrying over progress or onboarding answers', async (name, hash) => {
    await prepareScenario('progress', T0, vi.fn());
    expect(await prepareScenario(name, T0, vi.fn())).toBe(hash);
    const data = await load();
    expect(data.attempts).toEqual([]);
    expect(data.sessions).toEqual([]);
    expect(data.stats).toEqual({});
    expect(localStorage.getItem('dacapo.start')).toBe(
      name === 'empty' ? null : '{"from":"player","reads":"both"}',
    );
  });

  it.each(['unknown', 'toString'])(
    'rejects unknown scenario %s without touching storage',
    async (name) => {
      await expect(prepareScenario(name, T0, vi.fn())).rejects.toThrow('Unknown dev scenario');
      expect(await indexedDB.databases()).toEqual([]);
      expect(localStorage.length).toBe(0);
    },
  );

  it('refuses an existing database even without any preferences', async () => {
    const repository = createIndexedDbRepository(await openDacapoDB());
    await repository.addAttempt(sampleAttempt(3));
    const before = await repository.load();
    repository.close();

    await expect(prepareScenario('empty', T0, vi.fn())).rejects.toThrow('Existing data');
    expect(await load()).toEqual(before);
    expect(localStorage.length).toBe(0);
  });

  it.each(['dacapo.start', 'dacapo.dev.scenario'])(
    'refuses unowned preference %s without creating a database',
    async (key) => {
      localStorage.setItem(key, 'keep');
      await expect(prepareScenario('progress', T0, vi.fn())).rejects.toThrow('Existing data');
      expect(await indexedDB.databases()).toEqual([]);
      expect(Object.entries(localStorage)).toEqual([[key, 'keep']]);
    },
  );

  it('stops when storage cannot be claimed instead of falling back to memory', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    await expect(prepareScenario('progress', T0, vi.fn())).rejects.toThrow('Blocked');
    expect(await indexedDB.databases()).toEqual([]);
  });

  it('refuses a service-worker-controlled origin without changing its data', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { controller: {} } });
    await expect(prepareScenario('empty', T0, vi.fn())).rejects.toThrow('service worker');
    expect(await indexedDB.databases()).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
});
