import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProfileDocument, ProfileSettings } from '../core/profile.ts';
import { nextPieceVersion, type StoredPiece } from '../core/storedPiece.ts';
import { openDacapoDB, type DacapoDB } from '../storage/db.ts';
import {
  sampleAttempt,
  sampleData,
  sampleEarSession,
  sampleEchoAnswer,
  samplePiece,
  sampleRun,
  sampleScaleSession,
  sampleTake,
  sampleTheoryAnswers,
  sampleTheorySession,
  sampleRhythmSession,
  T0,
} from '../storage/fixtures.ts';
import { createIndexedDbRepository } from '../storage/repository.ts';
import { createPracticeStore, type PracticeStore } from '../ui/practice/store.ts';
import { ApiError, type SyncApi } from './api.ts';
import { CHANGE_DELAY_MS, createSyncClient, START_DELAY_MS, type SyncClient } from './client.ts';
import { SYNC_STATE_KEY, type SyncState } from '../storage/syncTypes.ts';
import { sha256Hex, SYNC_SCHEMA } from './records.ts';

/**
 * The service's protocol in memory, with its rules (docs/SYNC.md): one row per record, a `seq`
 * per write, a device's own writes left out of its pulls, unseen records never overwritten.
 */
function fakeService({ pageSize = 1000 } = {}) {
  const rows = new Map<
    string,
    { collection: string; id: string; body: string; seq: number; writer: string }
  >();
  const files = new Map<string, string>();
  const tokens = new Set<string>();
  // The profile (docs/PROFILE.md): the settings and the published document.
  const profile = {
    username: null as string | null,
    settings: { visibility: 'off', titles: false } as ProfileSettings,
    document: null as ProfileDocument | null,
    puts: 0,
  };
  let seq = 0;
  let issued = 0;
  let failNext: ApiError | null = null;

  const auth = (token: string) => {
    if (failNext) {
      const error = failNext;
      failNext = null;
      throw error;
    }
    if (!tokens.has(token)) throw new ApiError('unauthorized', 401);
  };

  const api: SyncApi = {
    requestCode: () => Promise.resolve(),
    verify(email) {
      const token = `token-${++issued}`;
      tokens.add(token);
      return Promise.resolve({ token, account: { id: 'acc', email } });
    },
    account(token) {
      auth(token);
      return Promise.resolve({
        id: 'acc',
        email: 'pianist@example.com',
        username: profile.username,
        profile: { ...profile.settings },
      });
    },
    setUsername(token, username) {
      auth(token);
      if (username === 'taken') throw new ApiError('username-unavailable', 409);
      profile.username = username;
      return Promise.resolve(username);
    },
    removeUsername(token) {
      auth(token);
      profile.username = null;
      profile.settings = { visibility: 'off', titles: false };
      profile.document = null;
      return Promise.resolve();
    },
    setProfileSettings(token, settings) {
      auth(token);
      if (settings.visibility !== 'off' && !profile.username) {
        throw new ApiError('no-username', 409);
      }
      const changed =
        settings.visibility !== profile.settings.visibility ||
        settings.titles !== profile.settings.titles;
      profile.settings = { ...settings };
      if (changed || settings.visibility === 'off') profile.document = null;
      return Promise.resolve({ ...settings });
    },
    putProfile(token, document) {
      auth(token);
      if (
        profile.settings.visibility === 'off' ||
        document.visibility !== profile.settings.visibility ||
        document.titles !== profile.settings.titles
      ) {
        throw new ApiError('profile-changed', 409);
      }
      // As the service: every number in a document is a non-negative integer.
      const numbers = (value: unknown): number[] =>
        typeof value === 'number'
          ? [value]
          : typeof value === 'object' && value !== null
            ? Object.values(value).flatMap(numbers)
            : [];
      if (!numbers(document).every((n) => Number.isSafeInteger(n) && n >= 0)) {
        throw new ApiError('invalid-request', 400);
      }
      profile.document = document;
      profile.puts++;
      return Promise.resolve();
    },
    signOut(token) {
      tokens.delete(token);
      return Promise.resolve();
    },
    deleteAccount(token) {
      auth(token);
      tokens.clear();
      rows.clear();
      files.clear();
      return Promise.resolve();
    },
    sync(token, cursor, changes) {
      auth(token);
      const rejected: { collection: string; id: string }[] = [];
      for (const { collection, id, body } of changes) {
        const key = `${collection}/${id}`;
        const text = JSON.stringify(body);
        const stored = rows.get(key);
        if (stored?.body === text) continue;
        if (stored && stored.writer !== token && stored.seq > cursor) {
          rejected.push({ collection, id });
          continue;
        }
        rows.set(key, { collection, id, body: text, seq: ++seq, writer: token });
      }
      const after = [...rows.values()].filter((r) => r.seq > cursor).sort((a, b) => a.seq - b.seq);
      const page = after.slice(0, pageSize);
      return Promise.resolve({
        rejected,
        cursor: page.at(-1)?.seq ?? cursor,
        more: after.length > pageSize,
        changes: page
          .filter((r) => r.writer !== token)
          .map((r) => ({
            collection: r.collection,
            id: r.id,
            body: JSON.parse(r.body) as unknown,
          })),
      });
    },
    hasFile(token, hash) {
      auth(token);
      return Promise.resolve(files.has(hash));
    },
    putFile(token, hash, text) {
      auth(token);
      files.set(hash, text);
      return Promise.resolve();
    },
    getFile(token, hash) {
      auth(token);
      return Promise.resolve(files.get(hash) ?? null);
    },
  };
  return {
    api,
    rows,
    files,
    tokens,
    profile,
    body: (collection: string, id: string) => {
      const row = rows.get(`${collection}/${id}`);
      return row ? (JSON.parse(row.body) as unknown) : undefined;
    },
    failOnce: (error: ApiError) => void (failNext = error),
  };
}

type Service = ReturnType<typeof fakeService>;

interface Device {
  db: DacapoDB;
  store: PracticeStore;
  client: SyncClient;
  busy: { value: boolean };
  idle: () => void;
}

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** A device with its own IndexedDB and practice store. */
async function device(service: Service, api: SyncApi = service.api): Promise<Device> {
  const factory = new IDBFactory();
  const previous = globalThis.indexedDB;
  globalThis.indexedDB = factory;
  const db = await openDacapoDB();
  globalThis.indexedDB = previous;
  const store = createPracticeStore({
    open: () => Promise.resolve({ repository: createIndexedDbRepository(db), failure: null }),
  });
  cleanups.push(store.start());
  await vi.waitFor(() => expect(store.getStatus().loaded).toBe(true));
  const busy = { value: false };
  const idleListeners = new Set<() => void>();
  const client = createSyncClient({
    api,
    host: store,
    now: () => T0 + 1_000_000,
    isBusy: () => busy.value,
    onIdle: (listener) => {
      idleListeners.add(listener);
      return () => void idleListeners.delete(listener);
    },
    lock: (task) => task(),
    broadcast: () => null,
    profileSource: () => ({ ...store.getSnapshot(), firstDay: 1 }),
    document: null,
  });
  return { db, store, client, busy, idle: () => idleListeners.forEach((l) => l()) };
}

async function signIn(d: Device) {
  await d.client.signIn('pianist@example.com', '123456', 'Test');
  await d.client.syncNow();
}

const pieceIds = (d: Device) =>
  d.store
    .getSnapshot()
    .pieces.map((p) => p.id)
    .sort();

describe('two devices', () => {
  it('bring each other their records, pieces with their MusicXML', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);

    const run = sampleRun('r1', 3, { pieceId: 'p1' });
    ipad.store.recordAttempt(sampleAttempt(0));
    ipad.store.savePiece(samplePiece(1));
    for (const step of run.steps) ipad.store.recordPieceStep(step, null);
    ipad.store.finishPieceRun('r1', run.session);
    await ipad.store.settled();
    // Records from before signing in are sent too.
    await signIn(ipad);
    expect(ipad.client.getStatus()).toMatchObject({ phase: 'idle', error: null });
    expect(service.files.size).toBe(1);
    expect(service.body('pieces', 'p1')).not.toHaveProperty('xml');

    await signIn(mac);
    const snapshot = mac.store.getSnapshot();
    expect(snapshot.attempts).toEqual([sampleAttempt(0)]);
    expect(snapshot.stats).toEqual(ipad.store.getSnapshot().stats);
    // With the session of the flashcard answer, which the Mac rebuilt (it arrived without one).
    expect(snapshot.sessions).toContainEqual(run.session);
    expect(snapshot.pieces).toEqual([samplePiece(1)]);
    mac.store.loadPieceSteps('p1');
    await vi.waitFor(() => expect(mac.store.getPieceSteps('p1')).toEqual(run.steps));

    // And back: what the Mac records reaches the iPad.
    const scales = sampleScaleSession('k1', 2);
    for (const r of scales.runs) mac.store.recordScaleRun(r, scales.session);
    await mac.client.syncNow();
    await ipad.client.syncNow();
    expect(ipad.store.getSnapshot().sessions).toContainEqual(scales.session);
    expect(mac.client.getStatus().lastSyncAt).toBe(T0 + 1_000_000);
  });

  it('send nothing back and forth once they agree', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    ipad.store.recordAttempt(sampleAttempt(0));
    mac.store.recordAttempt(sampleAttempt(0));
    await ipad.store.settled();
    await mac.store.settled();
    await signIn(ipad);
    await signIn(mac);
    const seq = Math.max(...[...service.rows.values()].map((r) => r.seq));
    await ipad.client.syncNow();
    await mac.client.syncNow();
    expect(Math.max(...[...service.rows.values()].map((r) => r.seq))).toBe(seq);
    expect(await mac.db.count('outbox')).toBe(0);
  });

  it('delete a piece everywhere, with its step records when asked', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    ipad.store.savePiece(samplePiece(1));
    ipad.store.savePiece(samplePiece(2));
    for (const step of sampleRun('r1', 2, { pieceId: 'p1' }).steps) {
      ipad.store.recordPieceStep(step, null);
    }
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);
    expect(pieceIds(mac)).toEqual(['p1', 'p2']);

    mac.store.deletePiece('p1', { steps: true });
    await mac.store.settled();
    await mac.client.syncNow();
    await ipad.client.syncNow();
    expect(pieceIds(ipad)).toEqual(['p2']);
    ipad.store.loadPieceSteps('p1');
    await vi.waitFor(() => expect(ipad.store.getPieceSteps('p1')).toEqual([]));
    expect(service.body('pieces', 'p1')).toMatchObject({ deleted: true, withSteps: true });
  });

  it('keep a deletion over a rename made before it was pulled', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    ipad.store.savePiece(samplePiece(1));
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);

    mac.store.deletePiece('p1');
    await mac.store.settled();
    await mac.client.syncNow();
    // The iPad renames it without having pulled the deletion.
    ipad.store.savePiece({ ...samplePiece(1), title: 'Renamed', updatedAt: T0 + 50 });
    await ipad.store.settled();
    await ipad.client.syncNow();

    expect(pieceIds(ipad)).toEqual([]);
    expect(service.body('pieces', 'p1')).toMatchObject({ deleted: true });
    expect(await ipad.db.count('outbox')).toBe(0);
    const phone = await device(service);
    await signIn(phone);
    expect(pieceIds(phone)).toEqual([]);
  });

  it('keep the later rename, whichever device syncs first', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    ipad.store.savePiece(samplePiece(1));
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);

    const early = { ...samplePiece(1), title: 'Early', updatedAt: T0 + 10 };
    const late = { ...samplePiece(1), title: 'Late', updatedAt: T0 + 20 };
    mac.store.savePiece(early);
    ipad.store.savePiece(late);
    await mac.store.settled();
    await ipad.store.settled();
    // The older rename reaches the service first; the newer one is refused, then sent again.
    await mac.client.syncNow();
    await ipad.client.syncNow();
    await mac.client.syncNow();

    const title = (d: Device) => d.store.getSnapshot().pieces.map((p: StoredPiece) => p.title);
    expect(title(ipad)).toEqual(['Late']);
    expect(title(mac)).toEqual(['Late']);
    expect(service.body('pieces', 'p1')).toMatchObject({ title: 'Late' });
  });

  it('agree on a deletion with its step records, whichever deleted first', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    ipad.store.savePiece(samplePiece(1));
    for (const step of sampleRun('r1', 2, { pieceId: 'p1' }).steps) {
      ipad.store.recordPieceStep(step, null);
    }
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);

    // Both delete it before syncing: the Mac keeps the step records, the iPad does not.
    mac.store.deletePiece('p1', { steps: false });
    ipad.store.deletePiece('p1', { steps: true });
    await mac.store.settled();
    await ipad.store.settled();
    await mac.client.syncNow();
    await ipad.client.syncNow();
    await mac.client.syncNow();

    expect(service.body('pieces', 'p1')).toMatchObject({ deleted: true, withSteps: true });
    mac.store.loadPieceSteps('p1');
    await vi.waitFor(() => expect(mac.store.getPieceSteps('p1')).toEqual([]));
  });

  it('keep a rename made on a device whose clock is behind', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    ipad.store.savePiece(samplePiece(1));
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);

    ipad.store.savePiece({ ...samplePiece(1), title: 'A', updatedAt: T0 + 100 });
    await ipad.store.settled();
    await ipad.client.syncNow();
    await mac.client.syncNow();
    // The Mac's clock says T0 + 50, but its change comes after the one it has seen.
    const seen = mac.store.getSnapshot().pieces[0]!;
    mac.store.savePiece({ ...seen, title: 'B', updatedAt: nextPieceVersion(seen, T0 + 50) });
    await mac.store.settled();
    await mac.client.syncNow();
    await ipad.client.syncNow();

    const title = (d: Device) => d.store.getSnapshot().pieces[0]!.title;
    expect([title(ipad), title(mac)]).toEqual(['B', 'B']);
    expect(service.body('pieces', 'p1')).toMatchObject({ title: 'B' });
  });

  it('end with the finished session, not one another device rebuilt from its first answers', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    await signIn(ipad);
    await signIn(mac);
    const { sessions, attempts } = sampleData();
    const session = sessions.find((s) => s.id === 's1')!;
    const answers = attempts.filter((a) => a.sessionId === 's1');

    // The iPad sends the first answers of s1 before the session ends.
    for (const attempt of answers.slice(0, 2)) ipad.store.recordAttempt(attempt);
    await ipad.store.settled();
    await ipad.client.syncNow();
    await mac.client.syncNow();
    // A reload after the pull rebuilds nothing.
    expect(mac.store.getSnapshot().sessions).toEqual([]);
    // The Mac starts again: at startup it rebuilds a session for answers without one, and sends it.
    const restarted = createPracticeStore({
      open: () => Promise.resolve({ repository: createIndexedDbRepository(mac.db), failure: null }),
    });
    cleanups.push(restarted.start());
    await vi.waitFor(() => expect(restarted.getSnapshot().sessions).toHaveLength(1));
    await restarted.settled();
    const macClient = createSyncClient({
      api: service.api,
      host: restarted,
      lock: (task) => task(),
      broadcast: () => null,
      document: null,
    });
    await macClient.syncNow();
    expect(service.body('sessions', 's1')).toMatchObject({ endedAt: answers[1]!.at });

    // The iPad finishes s1.
    for (const attempt of answers.slice(2)) ipad.store.recordAttempt(attempt);
    ipad.store.recordSession(session);
    await ipad.store.settled();
    await ipad.client.syncNow();
    await macClient.syncNow();

    expect(ipad.store.getSnapshot().sessions).toEqual([session]);
    expect(restarted.getSnapshot().sessions).toEqual([session]);
    expect(service.body('sessions', 's1')).toEqual(JSON.parse(JSON.stringify(session)));
  });
});

describe('ear training', () => {
  it('brings answers and ear sessions to the other device', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const ear = sampleEarSession('e1', 4);
    for (const answer of ear.answers) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(ear.session);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('answers', ear.answers[0]!.id)).toEqual(ear.answers[0]);
    await signIn(mac);
    expect(mac.store.getSnapshot().answers).toEqual(ear.answers);
    expect(mac.store.getSnapshot().sessions).toEqual([ear.session]);
  });

  it('pulls everything again once after an update that understands more, and applies it once', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const ear = sampleEarSession('e1', 3);
    ipad.store.recordAttempt(sampleAttempt(0));
    ipad.store.savePiece(samplePiece(1));
    for (const answer of ear.answers) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(ear.session);
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);
    expect((await mac.store.withSync((sync) => sync.state()))!.schema).toBe(SYNC_SCHEMA);

    // The Mac as an older build left it: the answers and the ear session skipped, the cursor
    // past them, and no schema in its state.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('answers');
    await mac.db.delete('sessions', ear.session.id);
    await mac.db.put('meta', { ...state, schema: undefined }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    expect(mac.store.getSnapshot().answers).toEqual([]);
    const before = mac.store.getSnapshot();

    const sync = vi.spyOn(service.api, 'sync');
    const getFile = vi.spyOn(service.api, 'getFile');
    await mac.client.syncNow();
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    // The piece is stored here already: its file is not downloaded again.
    expect(getFile).not.toHaveBeenCalled();
    const after = mac.store.getSnapshot();
    expect(after.answers).toEqual(ear.answers);
    expect(after.sessions).toEqual([ear.session]);
    expect(after.attempts).toEqual(before.attempts);
    expect(after.stats).toEqual(before.stats);
    expect(after.pieces).toEqual(before.pieces);
    expect(await mac.db.count('outbox')).toBe(0);
    const saved = (await mac.store.withSync((s) => s.state()))!;
    expect(saved).toMatchObject({ schema: SYNC_SCHEMA, cursor: state.cursor });

    // From then on it goes on from its cursor.
    sync.mockClear();
    await mac.client.syncNow();
    expect(sync.mock.calls.map((call) => call[1])).toEqual([state.cursor]);
  });

  it('pulls again the melodies a build that knew only intervals and chords skipped', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const echo = [sampleEchoAnswer(0), sampleEchoAnswer(1)];
    for (const answer of echo) ipad.store.recordAnswer(answer);
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);
    expect(mac.store.getSnapshot().answers).toEqual(echo);

    // As schema 2 left it: the echo answers skipped, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('answers');
    await mac.db.put('meta', { ...state, schema: 2 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(3);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().answers).toEqual(echo);
  });

  it('syncs the theory cards of Read, and pulls them again after a build that skipped them', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const theory = sampleTheorySession('t1', 3);
    const cards = [...theory.answers, ...sampleTheoryAnswers(4, 't1').slice(1)];
    for (const answer of cards) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(theory.session);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('answers', cards[3]!.id)).toEqual(cards[3]);
    await signIn(mac);
    expect(mac.store.getSnapshot().answers).toEqual(cards);
    expect(mac.store.getSnapshot().sessions).toEqual([theory.session]);

    // As schema 5 left it: the theory answers and session skipped, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('answers');
    await mac.db.delete('sessions', theory.session.id);
    await mac.db.put('meta', { ...state, schema: 5 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(6);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().answers).toEqual(cards);
    expect(mac.store.getSnapshot().sessions).toEqual([theory.session]);
  });
});

describe('rhythm on Read', () => {
  it('syncs its answers and sessions, and pulls them again after a build that skipped them', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const rhythm = sampleRhythmSession('r1', 3);
    for (const answer of rhythm.answers) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(rhythm.session);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('answers', rhythm.answers[5]!.id)).toEqual(rhythm.answers[5]);
    await signIn(mac);
    expect(mac.store.getSnapshot().answers).toEqual(rhythm.answers);
    expect(mac.store.getSnapshot().sessions).toEqual([rhythm.session]);

    // As schema 6 left it: the rhythm answers and session skipped, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('answers');
    await mac.db.delete('sessions', rhythm.session.id);
    await mac.db.put('meta', { ...state, schema: 6 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBe(7);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().answers).toEqual(rhythm.answers);
    expect(mac.store.getSnapshot().sessions).toEqual([rhythm.session]);
  });
});

describe('takes', () => {
  it('brings takes to the other device, and pulls again those a build before takes skipped', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const takes = [sampleTake('r1', 0), sampleTake('r1', 1)];
    for (const chunk of takes) ipad.store.recordTake(chunk);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('takes', takes[0]!.id)).toEqual(takes[0]);
    await signIn(mac);
    expect(await mac.store.takes({ sessionId: 'r1' })).toEqual(takes);

    // As schema 4 left it: the takes skipped, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('takes');
    await mac.db.put('meta', { ...state, schema: 4 }, SYNC_STATE_KEY);
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(5);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(await mac.store.takes({ sessionId: 'r1' })).toEqual(takes);
    expect(await mac.db.count('outbox')).toBe(0);
  });
});

describe('a round', () => {
  it('pulls page after page', async () => {
    const service = fakeService({ pageSize: 3 });
    const ipad = await device(service);
    for (let i = 0; i < 10; i++) ipad.store.recordAttempt(sampleAttempt(i));
    await ipad.store.settled();
    await signIn(ipad);
    const mac = await device(service);
    await signIn(mac);
    expect(mac.store.getSnapshot().attempts).toHaveLength(10);
    // Ten answers, and the session the iPad rebuilt for them.
    expect((await mac.store.withSync((s) => s.state()))!.cursor).toBe(service.rows.size);
  });

  it('waits while something is being practised, and runs when it stops', async () => {
    const service = fakeService();
    const ipad = await device(service);
    await signIn(ipad);
    cleanups.push(ipad.client.start());
    ipad.busy.value = true;
    ipad.store.recordAttempt(sampleAttempt(0));
    await ipad.store.settled();
    await ipad.client.syncNow();
    expect(service.rows.size).toBe(0);
    ipad.busy.value = false;
    ipad.idle();
    await vi.waitFor(() => expect(service.rows.size).toBe(1));
  });

  it('runs a round a while after a change made here, once for many', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    try {
      const service = fakeService();
      const ipad = await device(service);
      const changes = new Set<() => void>();
      const client = createSyncClient({
        api: service.api,
        host: ipad.store,
        onChange: (listener) => {
          changes.add(listener);
          return () => void changes.delete(listener);
        },
        lock: (task) => task(),
        broadcast: () => null,
        document: null,
      });
      await client.signIn('pianist@example.com', '123456', 'Test');
      await client.syncNow();
      cleanups.push(client.start());
      // The round at start.
      await vi.advanceTimersByTimeAsync(START_DELAY_MS);
      await client.syncNow();
      const sync = vi.spyOn(service.api, 'sync');
      for (let i = 0; i < 5; i++) {
        ipad.store.recordAttempt(sampleAttempt(i));
        for (const listener of changes) listener();
      }
      await ipad.store.settled();
      await vi.advanceTimersByTimeAsync(CHANGE_DELAY_MS - 1_000);
      expect(sync).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(service.rows.size).toBe(5));
      expect(sync).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps everything for the next round when the network fails', async () => {
    const service = fakeService();
    const ipad = await device(service);
    await signIn(ipad);
    ipad.store.recordAttempt(sampleAttempt(0));
    await ipad.store.settled();
    service.failOnce(new ApiError('network', 0));
    await ipad.client.syncNow();
    expect(ipad.client.getStatus()).toMatchObject({ phase: 'offline', error: 'network' });
    expect(await ipad.db.count('outbox')).toBe(1);
    await ipad.client.syncNow();
    expect(ipad.client.getStatus()).toMatchObject({ phase: 'idle', error: null });
    expect(await ipad.db.count('outbox')).toBe(0);
  });

  it('signs the device out when the service no longer knows its token', async () => {
    const service = fakeService();
    const ipad = await device(service);
    await signIn(ipad);
    ipad.store.recordAttempt(sampleAttempt(0));
    await ipad.store.settled();
    service.tokens.clear();
    await ipad.client.syncNow();
    expect(ipad.client.getStatus()).toMatchObject({ phase: 'signedOut', account: null });
    expect(await ipad.db.count('outbox')).toBe(0);
    expect(ipad.store.getSnapshot().attempts).toHaveLength(1);
  });

  it('skips a piece whose MusicXML is missing, and the rest still arrives', async () => {
    const service = fakeService();
    const ipad = await device(service);
    ipad.store.savePiece(samplePiece(1));
    ipad.store.recordAttempt(sampleAttempt(0));
    await ipad.store.settled();
    await signIn(ipad);
    service.files.clear();
    const mac = await device(service);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await signIn(mac);
    expect(warn).toHaveBeenCalled();
    expect(pieceIds(mac)).toEqual([]);
    expect(mac.store.getSnapshot().attempts).toHaveLength(1);
  });

  it('refuses MusicXML that does not match its hash', async () => {
    const service = fakeService();
    const ipad = await device(service);
    ipad.store.savePiece(samplePiece(1));
    await ipad.store.settled();
    await signIn(ipad);
    const [hash] = [...service.files.keys()];
    expect(hash).toBe(await sha256Hex(samplePiece(1).xml));
    service.files.set(hash!, '<tampered/>');
    const mac = await device(service);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await signIn(mac);
    expect(pieceIds(mac)).toEqual([]);
  });

  it('skips pulled records that do not validate', async () => {
    const service = fakeService();
    const ipad = await device(service);
    await signIn(ipad);
    service.rows.set('attempts/bad', {
      collection: 'attempts',
      id: 'bad',
      body: JSON.stringify({ id: 'bad', note: 'not a note' }),
      seq: 1,
      writer: 'other',
    });
    service.rows.set('unknown/x', {
      collection: 'unknown',
      id: 'x',
      body: '{}',
      seq: 2,
      writer: 'other',
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await ipad.client.syncNow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skipped 2'));
    expect(ipad.store.getSnapshot().attempts).toEqual([]);
    expect((await ipad.store.withSync((s) => s.state()))!.cursor).toBe(2);
  });
});

describe('the account', () => {
  it('signs out here, keeping the records', async () => {
    const service = fakeService();
    const ipad = await device(service);
    ipad.store.recordAttempt(sampleAttempt(0));
    await signIn(ipad);
    await ipad.client.signOut();
    expect(ipad.client.getStatus()).toMatchObject({ phase: 'signedOut', account: null });
    expect(service.tokens.size).toBe(0);
    expect(ipad.store.getSnapshot().attempts).toHaveLength(1);
  });

  it('is deleted on the service, then signed out here', async () => {
    const service = fakeService();
    const ipad = await device(service);
    ipad.store.recordAttempt(sampleAttempt(0));
    await signIn(ipad);
    await ipad.client.deleteAccount();
    expect(service.rows.size).toBe(0);
    expect(ipad.client.getStatus().phase).toBe('signedOut');
    expect(ipad.store.getSnapshot().attempts).toHaveLength(1);
  });

  it('takes a deletion that was already done as done', async () => {
    const service = fakeService();
    const ipad = await device(service);
    await signIn(ipad);
    service.tokens.clear();
    await ipad.client.deleteAccount();
    expect(ipad.client.getStatus().phase).toBe('signedOut');
  });

  it('reports a code that is wrong, and stays signed out', async () => {
    const service = fakeService();
    const api: SyncApi = {
      ...service.api,
      verify: () => Promise.reject(new ApiError('invalid-code', 401)),
    };
    const ipad = await device(service, api);
    await expect(ipad.client.signIn('a@example.com', '000000', 'Test')).rejects.toMatchObject({
      code: 'invalid-code',
    });
    expect(await ipad.store.withSync((s) => s.state())).toBeNull();
  });
});

describe('the public profile', () => {
  async function withProfile(service: Service) {
    const ipad = await device(service);
    for (const session of sampleData().sessions) ipad.store.recordSession(session);
    await ipad.store.settled();
    await signIn(ipad);
    return ipad;
  }

  it('is not published until it is turned on', async () => {
    const service = fakeService();
    const ipad = await withProfile(service);
    await ipad.client.setUsername('clara');
    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(0);
    expect(ipad.client.getStatus().profile).toEqual({
      username: 'clara',
      settings: { visibility: 'off', titles: false },
    });
  });

  it('is published when turned on, and again only when it changes', async () => {
    const service = fakeService();
    const ipad = await withProfile(service);
    await ipad.client.setUsername('clara');
    await ipad.client.setProfileSettings({ visibility: 'public', titles: false });
    expect(service.profile.puts).toBe(1);
    const document = service.profile.document!;
    expect(document).toMatchObject({ v: 1, visibility: 'public', titles: false });
    expect(Object.keys(document.activity!)).toEqual(Object.keys(document.days));

    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(1);

    ipad.store.recordSession({
      kind: 'free',
      id: 'f2',
      startedAt: T0 + 7_200_000,
      endedAt: T0 + 7_500_000,
      activeMs: 300_000,
      notes: 100,
    });
    await ipad.store.settled();
    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(2);
    expect(service.profile.document!.totals.ms).toBe(document.totals.ms + 300_000);
  });

  it('has only the grid when private', async () => {
    const service = fakeService();
    const ipad = await withProfile(service);
    await ipad.client.setUsername('clara');
    await ipad.client.setProfileSettings({ visibility: 'private', titles: true });
    expect(service.profile.settings).toEqual({ visibility: 'private', titles: false });
    expect(service.profile.document).toMatchObject({ visibility: 'private', titles: false });
    expect(service.profile.document).not.toHaveProperty('activity');
  });

  it('follows settings changed on another device', async () => {
    const service = fakeService();
    const ipad = await withProfile(service);
    await ipad.client.setUsername('clara');
    await ipad.client.setProfileSettings({ visibility: 'public', titles: true });

    const mac = await device(service);
    await signIn(mac);
    await mac.client.loadProfile();
    await mac.client.setProfileSettings({ visibility: 'private', titles: false });
    expect(service.profile.document).toMatchObject({ visibility: 'private' });

    // The iPad still thinks it is public: the service refuses, and it publishes under the new ones.
    ipad.store.recordSession({
      kind: 'free',
      id: 'f2',
      startedAt: T0 + 7_200_000,
      endedAt: T0 + 7_500_000,
      activeMs: 300_000,
      notes: 100,
    });
    await ipad.store.settled();
    await ipad.client.syncNow();
    expect(ipad.client.getStatus().profile?.settings).toEqual({
      visibility: 'private',
      titles: false,
    });
    expect(service.profile.document).toMatchObject({ visibility: 'private', titles: false });
    expect(service.profile.document).not.toHaveProperty('activity');

    // Turned off elsewhere: nothing is published any more.
    await mac.client.setProfileSettings({ visibility: 'off', titles: false });
    const puts = service.profile.puts;
    ipad.store.recordSession({
      kind: 'free',
      id: 'f3',
      startedAt: T0 + 9_000_000,
      endedAt: T0 + 9_300_000,
      activeMs: 300_000,
      notes: 100,
    });
    await ipad.store.settled();
    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(puts);
    expect(service.profile.document).toBeNull();
    expect(ipad.client.getStatus().profile?.settings.visibility).toBe('off');
  });

  it('shows why publishing failed, and clears it once it works', async () => {
    const service = fakeService();
    let failures = 1;
    const api: SyncApi = {
      ...service.api,
      putProfile(token, document) {
        if (failures-- > 0) return Promise.reject(new ApiError('unavailable', 503));
        return service.api.putProfile(token, document);
      },
    };
    const ipad = await device(service, api);
    for (const session of sampleData().sessions) ipad.store.recordSession(session);
    await ipad.store.settled();
    await signIn(ipad);
    await ipad.client.setUsername('clara');
    await ipad.client.setProfileSettings({ visibility: 'private', titles: false });
    expect(service.profile.puts).toBe(0);
    expect(ipad.client.getStatus().profileError).toBe('unavailable');

    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(1);
    expect(ipad.client.getStatus().profileError).toBeNull();
  });

  it('publishes again after the settings are set, even to the same ones', async () => {
    const service = fakeService();
    const ipad = await withProfile(service);
    await ipad.client.setUsername('clara');
    await ipad.client.setProfileSettings({ visibility: 'private', titles: false });
    await ipad.client.setProfileSettings({ visibility: 'private', titles: false });
    expect(service.profile.puts).toBe(2);
  });

  it('is published by a device that never opened Settings', async () => {
    const service = fakeService();
    const ipad = await withProfile(service);
    await ipad.client.setUsername('clara');
    await ipad.client.setProfileSettings({ visibility: 'private', titles: false });
    const published = service.profile.document!;

    // The Mac reads the settings once after it starts, and publishes what it practises.
    const mac = await device(service);
    await signIn(mac);
    expect(mac.client.getStatus().profile?.settings.visibility).toBe('private');
    mac.store.recordSession({
      kind: 'free',
      id: 'm1',
      startedAt: T0 + 7_200_000,
      endedAt: T0 + 7_500_000,
      activeMs: 300_000,
      notes: 100,
    });
    await mac.store.settled();
    await mac.client.syncNow();
    expect(service.profile.document!.totals.ms).toBe(published.totals.ms + 300_000);
  });

  it('waits while something is being practised', async () => {
    const service = fakeService();
    const ipad = await withProfile(service);
    await ipad.client.setUsername('clara');
    ipad.busy.value = true;
    await ipad.client.setProfileSettings({ visibility: 'private', titles: false });
    expect(service.profile.puts).toBe(0);
    ipad.busy.value = false;
    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(1);
  });

  it('passes on the service’s answers, and is forgotten on signing out', async () => {
    const service = fakeService();
    const ipad = await withProfile(service);
    await expect(
      ipad.client.setProfileSettings({ visibility: 'public', titles: false }),
    ).rejects.toMatchObject({ code: 'no-username' });
    await expect(ipad.client.setUsername('taken')).rejects.toMatchObject({
      code: 'username-unavailable',
    });
    await ipad.client.setUsername('clara');
    await ipad.client.setProfileSettings({ visibility: 'public', titles: false });
    await ipad.client.removeUsername();
    expect(ipad.client.getStatus().profile).toEqual({
      username: null,
      settings: { visibility: 'off', titles: false },
    });
    await ipad.client.signOut();
    expect(ipad.client.getStatus().profile).toBeNull();
    await expect(ipad.client.loadProfile()).rejects.toMatchObject({ code: 'unauthorized' });
  });
});
