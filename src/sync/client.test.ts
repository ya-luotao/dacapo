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
  sampleChordSymbolAnswers,
  sampleCadenceSession,
  sampleTuneSession,
  sampleHarmonySession,
  sampleTheoryAnswers,
  sampleTheorySession,
  sampleRhythmSession,
  sampleSightSession,
  sampleImprovSession,
  sampleKeyboardRun,
  sampleRhythmEarSession,
  sampleStoredAssignment,
  sampleStoredReport,
  T0,
} from '../storage/fixtures.ts';
import { createIndexedDbRepository } from '../storage/repository.ts';
import { validatePieceSession21, validatePieceStep21 } from '../storage/validate21.ts';
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
    // What it says in `GET /v1/account` (docs/PROFILE.md, "Version 2"); undefined: an older one.
    version: 2 as number | undefined,
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
        profileVersion: profile.version ?? 1,
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

  it('syncs the chord symbols of Harmony, and pulls them again after a build that skipped them', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const harmony = sampleHarmonySession('h1', 3);
    const cards = [...harmony.answers, ...sampleChordSymbolAnswers(4, 'h1').slice(1)];
    for (const answer of cards) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(harmony.session);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('answers', cards[3]!.id)).toEqual(cards[3]);
    await signIn(mac);
    expect(mac.store.getSnapshot().answers).toEqual(cards);
    expect(mac.store.getSnapshot().sessions).toEqual([harmony.session]);

    // As schema 7 left it: the chord-symbol answers and session skipped, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('answers');
    await mac.db.delete('sessions', harmony.session.id);
    await mac.db.put('meta', { ...state, schema: 7 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(8);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().answers).toEqual(cards);
    expect(mac.store.getSnapshot().sessions).toEqual([harmony.session]);
  });

  it('syncs cadences by ear, and pulls them again after a build that skipped them', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const cadences = sampleCadenceSession('c1', 4);
    for (const answer of cadences.answers) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(cadences.session);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('answers', cadences.answers[1]!.id)).toEqual(cadences.answers[1]);
    await signIn(mac);
    expect(mac.store.getSnapshot().answers).toEqual(cadences.answers);
    expect(mac.store.getSnapshot().sessions).toEqual([cadences.session]);

    // As schema 10 left it: the cadence answers and session skipped, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('answers');
    await mac.db.delete('sessions', cadences.session.id);
    await mac.db.put('meta', { ...state, schema: 10 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(11);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().answers).toEqual(cadences.answers);
    expect(mac.store.getSnapshot().sessions).toEqual([cadences.session]);
  });

  it('syncs a tune played by ear, and pulls it again after a build that skipped it', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    // Amazing Grace in A major: its four phrases and the whole of it.
    const tune = sampleTuneSession('t1');
    for (const answer of tune.answers) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(tune.session);
    await ipad.store.settled();
    await signIn(ipad);
    // The whole tune's answer, the longest there is, goes as it is.
    expect(service.body('answers', tune.answers[4]!.id)).toEqual(tune.answers[4]);
    expect(service.body('sessions', tune.session.id)).toEqual(tune.session);
    await signIn(mac);
    expect(mac.store.getSnapshot().answers).toEqual(tune.answers);
    expect(mac.store.getSnapshot().sessions).toEqual([tune.session]);

    // As schema 19 left it: the tune's answers and session skipped, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('answers');
    await mac.db.delete('sessions', tune.session.id);
    await mac.db.put('meta', { ...state, schema: 19 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(20);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().answers).toEqual(tune.answers);
    expect(mac.store.getSnapshot().sessions).toEqual([tune.session]);
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
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(7);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().answers).toEqual(rhythm.answers);
    expect(mac.store.getSnapshot().sessions).toEqual([rhythm.session]);
  });
});

describe('sight-reading on Read', () => {
  it('syncs a session as it grows, and pulls it again after a build that skipped it', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    await signIn(ipad);
    await signIn(mac);
    // Stored again after every run: the copy with more runs is the later one.
    ipad.store.recordSession(sampleSightSession('s1', 1));
    await ipad.client.syncNow();
    const session = sampleSightSession('s1', 3);
    ipad.store.recordSession(session);
    await ipad.client.syncNow();
    expect(service.body('sessions', 's1')).toEqual(session);
    await mac.client.syncNow();
    expect(mac.store.getSnapshot().sessions).toEqual([session]);

    // As a build before schema 13 left it: the session skipped, the cursor past it.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.delete('sessions', session.id);
    await mac.db.put('meta', { ...state, schema: 12 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(13);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().sessions).toEqual([session]);
  });
});

describe('rhythm dictation', () => {
  it('syncs its answers and sessions, and pulls them again after a build that skipped them', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const tapped = sampleRhythmEarSession('rd1', 2, 'play');
    const chosen = sampleRhythmEarSession('rd2', 2, 'name');
    const answers = [...tapped.answers, ...chosen.answers];
    for (const answer of answers) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(tapped.session);
    ipad.store.recordSession(chosen.session);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('answers', answers[4]!.id)).toEqual(answers[4]);
    await signIn(mac);
    expect(mac.store.getSnapshot().answers).toEqual(answers);
    expect(mac.store.getSnapshot().sessions).toHaveLength(2);

    // As schema 13 left it: the dictation's answers and sessions skipped, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('answers');
    await mac.db.delete('sessions', tapped.session.id);
    await mac.db.delete('sessions', chosen.session.id);
    await mac.db.put('meta', { ...state, schema: 13 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(14);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().answers).toEqual(answers);
    expect(
      mac.store
        .getSnapshot()
        .sessions.map((s) => s.id)
        .sort(),
    ).toEqual(['rd1', 'rd2']);
  });
});

describe('improvising on Harmony', () => {
  it('syncs a session as it grows, with its take, and pulls it again after a build that skipped it', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    await signIn(ipad);
    await signIn(mac);
    // Stored again as it goes: the copy with more notes is the later one.
    const early = sampleImprovSession('im1', 4);
    const { session, takes } = sampleImprovSession('im1', 8);
    expect(session.figures.notes).toBeGreaterThan(early.session.figures.notes);
    ipad.store.recordSession(early.session);
    await ipad.client.syncNow();
    ipad.store.recordSession(session);
    for (const chunk of takes) ipad.store.recordTake(chunk);
    await ipad.client.syncNow();
    expect(service.body('sessions', 'im1')).toEqual(session);
    expect(service.body('takes', takes[0]!.id)).toEqual(takes[0]);
    await mac.client.syncNow();
    expect(mac.store.getSnapshot().sessions).toEqual([session]);
    expect(await mac.store.takes({ sessionId: 'im1' })).toEqual(takes);

    // As a build before schema 15 left it: the session skipped, the cursor past it.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.delete('sessions', session.id);
    await mac.db.put('meta', { ...state, schema: 14 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(15);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().sessions).toEqual([session]);
  });
});

describe('the review schedule', () => {
  it('syncs a piece taken out of review, and takes it back from a build that stripped it', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const out = samplePiece(1, { review: false, updatedAt: T0 + 100 });
    ipad.store.savePiece(out);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('pieces', 'p1')).toMatchObject({ review: false });
    await signIn(mac);
    expect(mac.store.getSnapshot().pieces).toEqual([out]);

    // As schema 10 left it: the piece kept without the field, the cursor past it.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    const stripped = { ...out };
    delete stripped.review;
    await mac.db.put('pieces', stripped);
    await mac.db.put('meta', { ...state, schema: 15 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(16);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().pieces).toEqual([out]);
  });
});

describe('the left hand from the symbols', () => {
  it('syncs with the run, and comes back to a build that stripped it', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const plain = sampleRun('l1', 2, { pieceId: 'p1' });
    const session = { ...plain.session, leftHand: 'stride' as const };
    for (const step of plain.steps) ipad.store.recordPieceStep(step, null);
    ipad.store.finishPieceRun('l1', session);
    await ipad.store.settled();
    await signIn(ipad);
    expect(service.body('sessions', 'l1')).toMatchObject({ leftHand: 'stride' });
    await signIn(mac);
    expect(mac.store.getSnapshot().sessions).toContainEqual(session);

    // As schema 17 left it: the session kept without the field, the cursor past it.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.put('sessions', plain.session);
    await mac.db.put('meta', { ...state, schema: 17 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    expect(mac.store.getSnapshot().sessions).toContainEqual(plain.session);
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(18);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().sessions).toContainEqual(session);
    expect(mac.store.getSnapshot().sessions).not.toContainEqual(plain.session);
  });
});

describe('a transposed run', () => {
  it('syncs its steps, session and take, and takes back what a build stripped', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const plain = sampleRun('t1', 2, { pieceId: 'p1' });
    const steps = plain.steps.map((s) => ({ ...s, transpose: 2 }));
    const session = { ...plain.session, transpose: 2 };
    const take = sampleTake('t1', 0, { pieceId: 'p1', transpose: 2 });
    for (const step of steps) ipad.store.recordPieceStep(step, null);
    ipad.store.recordTake(take);
    ipad.store.finishPieceRun('t1', session);
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);
    expect(mac.store.getSnapshot().sessions).toContainEqual(session);

    // As schema 17 left them: kept without the field, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.put('sessions', plain.session);
    for (const step of plain.steps) await mac.db.put('pieceSteps', step);
    const stripped = { ...take };
    delete stripped.transpose;
    await mac.db.put('takes', stripped);
    await mac.db.put('meta', { ...state, schema: 17 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(18);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().sessions).toContainEqual(session);
    mac.store.loadPieceSteps('p1');
    await vi.waitFor(() => expect(mac.store.getPieceSteps('p1')).toEqual(steps));
    expect(await mac.store.takes({ sessionId: 't1' })).toEqual([take]);
  });
});

describe('memory mode', () => {
  it('syncs its steps and sessions, and pulls them again after a build that refused them', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const plain = sampleRun('m1', 2, { pieceId: 'p1' });
    const steps = plain.steps.map((s) => ({
      ...s,
      mode: 'memory' as const,
      prompts: 1,
      stage: 'alternate' as const,
    }));
    const session = {
      ...plain.session,
      mode: 'memory' as const,
      memory: { stage: 'alternate' as const, prompts: 2 },
    };
    for (const step of steps) ipad.store.recordPieceStep(step, null);
    ipad.store.finishPieceRun('m1', session);
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);
    expect(mac.store.getSnapshot().sessions).toContainEqual(session);

    // As schema 16 left it: the memory records refused, the cursor past them.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('pieceSteps');
    await mac.db.delete('sessions', 'm1');
    await mac.db.put('meta', { ...state, schema: 16 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(17);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().sessions).toContainEqual(session);
    mac.store.loadPieceSteps('p1');
    await vi.waitFor(() => expect(mac.store.getPieceSteps('p1')).toEqual(steps));
  });
});

describe('assignments', () => {
  it('syncs an assignment, a change of it and its deletion: the later copy wins', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const assignment = sampleStoredAssignment(1);
    const report = sampleStoredReport(1);
    ipad.store.saveAssignment(assignment);
    ipad.store.saveAssignment(report);
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);
    const made = ipad.store.getSnapshot().assignments;
    expect(made.map((r) => r.id)).toEqual([assignment.id, report.id]);
    expect(service.body('assignments', assignment.id)).toEqual(made[0]);
    expect(mac.store.getSnapshot().assignments).toEqual(made);

    // Changed on the Mac: its copy is the later one everywhere.
    mac.store.saveAssignment({ ...assignment, following: true });
    await mac.store.settled();
    await mac.client.syncNow();
    await ipad.client.syncNow();
    expect(ipad.store.getSnapshot().assignments[0]).toMatchObject({ following: true });
    expect(ipad.store.getSnapshot().assignments).toEqual(mac.store.getSnapshot().assignments);

    // Deleted on the iPad: the record that says so replaces it on both, and on the service.
    ipad.store.deleteAssignment(assignment.id);
    await ipad.store.settled();
    await ipad.client.syncNow();
    await mac.client.syncNow();
    expect(service.body('assignments', assignment.id)).toMatchObject({ deleted: true });
    for (const d of [ipad, mac]) {
      const records = d.store.getSnapshot().assignments;
      expect(records[0]).toMatchObject({ id: assignment.id, type: 'assignment', deleted: true });
      expect(records[1]).toEqual(made[1]);
    }

    // Added again on the Mac (the same link, opened once more): later than its deletion.
    mac.store.saveAssignment({ ...assignment, made: false, following: true });
    await mac.store.settled();
    await mac.client.syncNow();
    await ipad.client.syncNow();
    expect(ipad.store.getSnapshot().assignments[0]).toMatchObject({ made: false, following: true });
    expect(await ipad.db.count('outbox')).toBe(0);
    expect(await mac.db.count('outbox')).toBe(0);
  });

  it('pulls them again after a build that skipped the collection, and skips what does not validate', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    ipad.store.saveAssignment(sampleStoredAssignment(1));
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);
    const stored = mac.store.getSnapshot().assignments;
    expect(stored).toHaveLength(1);

    // As schema 17 left it: the collection skipped, the cursor past it.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('assignments');
    await mac.db.put('meta', { ...state, schema: 17 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    // A record another build wrote that is no assignment: skipped, never stored.
    const token = (await ipad.store.withSync((sync) => sync.state()))!.token;
    await service.api.sync(token, 0, [
      {
        collection: 'assignments',
        id: 'assignment-bad',
        body: { id: 'assignment-bad', type: 'assignment' },
      },
    ]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(19);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(mac.store.getSnapshot().assignments).toEqual(stored);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await mac.db.count('outbox')).toBe(0);
  });
});

describe('lessons finished', () => {
  /** Ticks a lesson on a device at a given moment. */
  async function tick(d: Device, slug: string, at: number) {
    const now = vi.spyOn(Date, 'now').mockReturnValue(at);
    d.store.markLesson(slug);
    now.mockRestore();
    await d.store.settled();
  }
  const lessons = (d: Device) => d.store.getSnapshot().lessons;

  it('syncs a tick to the other device: one record per lesson, under its slug', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    await tick(ipad, 'staff', T0 + 100);
    await signIn(ipad);
    await signIn(mac);
    expect(service.body('lessons', 'staff')).toEqual({ slug: 'staff', doneAt: T0 + 100 });
    expect(lessons(mac)).toEqual([{ slug: 'staff', doneAt: T0 + 100 }]);

    // Ticked while signed in: sent with the next round, and the other device ticks it too.
    await tick(mac, 'keyboard', T0 + 200);
    await mac.client.syncNow();
    await ipad.client.syncNow();
    expect([...service.rows.keys()].sort()).toEqual(['lessons/keyboard', 'lessons/staff']);
    expect(lessons(ipad)).toEqual([
      { slug: 'keyboard', doneAt: T0 + 200 },
      { slug: 'staff', doneAt: T0 + 100 },
    ]);
    expect(lessons(ipad)).toEqual(lessons(mac));
    // Finished again: the tick is not moved, and nothing is sent.
    await tick(ipad, 'staff', T0 + 900);
    expect(await ipad.db.count('outbox')).toBe(0);
    expect(await mac.db.count('outbox')).toBe(0);
  });

  it('keeps the earlier time when two devices finished the same lesson, whichever syncs first', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    await signIn(ipad);
    await signIn(mac);

    // The iPad finished it first and syncs first: the Mac's later tick gives way.
    await tick(ipad, 'staff', T0 + 100);
    await tick(mac, 'staff', T0 + 900);
    await ipad.client.syncNow();
    await mac.client.syncNow();
    // The Mac finished it first, and syncs last: its earlier tick replaces the iPad's.
    await tick(ipad, 'rhythm', T0 + 900);
    await tick(mac, 'rhythm', T0 + 100);
    await ipad.client.syncNow();
    await mac.client.syncNow();
    await ipad.client.syncNow();
    // A tick from before ticks had a time (0) is before any other.
    await tick(ipad, 'keyboard', T0 + 100);
    await tick(mac, 'keyboard', 0);
    await mac.client.syncNow();
    await ipad.client.syncNow();
    await mac.client.syncNow();

    const merged = [
      { slug: 'keyboard', doneAt: 0 },
      { slug: 'rhythm', doneAt: T0 + 100 },
      { slug: 'staff', doneAt: T0 + 100 },
    ];
    for (const d of [ipad, mac]) {
      expect(lessons(d)).toEqual(merged);
      expect(await d.db.count('outbox')).toBe(0);
    }
    for (const record of merged) expect(service.body('lessons', record.slug)).toEqual(record);
    // Settled: another round each sends and brings nothing.
    const sync = vi.spyOn(service.api, 'sync');
    await ipad.client.syncNow();
    await mac.client.syncNow();
    expect(sync.mock.calls.map((call) => call[2])).toEqual([[], []]);
    expect(lessons(ipad)).toEqual(merged);
  });

  it('pulls them again after a build that skipped the collection, keeps a lesson this build does not have, and skips what does not validate', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    await tick(ipad, 'staff', T0 + 100);
    await signIn(ipad);
    await signIn(mac);
    expect(lessons(mac)).toHaveLength(1);

    // As schema 20 left it: the collection skipped, the cursor past it.
    const state = (await mac.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await mac.db.clear('lessons');
    await mac.db.put('meta', { ...state, schema: 20 }, SYNC_STATE_KEY);
    await mac.store.reloadAll();
    expect(lessons(mac)).toEqual([]);
    // What another build wrote: a lesson this one does not have (kept), a time that is not one
    // and a record under another lesson's slug (skipped, never stored).
    const token = (await ipad.store.withSync((sync) => sync.state()))!.token;
    await service.api.sync(token, 0, [
      {
        collection: 'lessons',
        id: 'lesson-of-a-later-build',
        body: { slug: 'lesson-of-a-later-build', doneAt: T0 + 5 },
      },
      { collection: 'lessons', id: 'rhythm', body: { slug: 'rhythm', doneAt: -1 } },
      { collection: 'lessons', id: 'pedals', body: { slug: 'chords', doneAt: T0 } },
    ]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(21);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    expect(lessons(mac)).toEqual([
      { slug: 'lesson-of-a-later-build', doneAt: T0 + 5 },
      { slug: 'staff', doneAt: T0 + 100 },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await mac.db.count('outbox')).toBe(0);
    // It goes on being synced as it came: a device that signs in afresh sends it unchanged.
    const phone = await device(service);
    await signIn(phone);
    expect(lessons(phone)).toEqual(lessons(mac));
    expect(service.body('lessons', 'lesson-of-a-later-build')).toEqual({
      slug: 'lesson-of-a-later-build',
      doneAt: T0 + 5,
    });
  });

  it('keeps the ticks here when the device signs out or the account is deleted', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    await tick(ipad, 'staff', T0 + 100);
    await signIn(ipad);
    await signIn(mac);
    await mac.client.signOut();
    expect(lessons(mac)).toEqual([{ slug: 'staff', doneAt: T0 + 100 }]);
    // Signed out: a new tick is stored, and not put aside to be sent.
    await tick(mac, 'rhythm', T0 + 200);
    expect(lessons(mac)).toHaveLength(2);
    expect(await mac.db.count('outbox')).toBe(0);

    await ipad.client.deleteAccount();
    expect(service.rows.size).toBe(0);
    expect(lessons(ipad)).toEqual([{ slug: 'staff', doneAt: T0 + 100 }]);
    // Signing in again sends every tick here to the new account.
    await signIn(mac);
    expect([...service.rows.keys()].sort()).toEqual(['lessons/rhythm', 'lessons/staff']);
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

  it('names each kind once the service says version 2, and publishes again', async () => {
    const service = fakeService();
    service.profile.version = undefined;
    const ipad = await device(service);
    const ear = sampleEarSession('e1', 4);
    for (const answer of ear.answers) ipad.store.recordAnswer(answer);
    ipad.store.recordSession(ear.session);
    for (const session of sampleData().sessions) ipad.store.recordSession(session);
    await ipad.store.settled();
    await signIn(ipad);
    await ipad.client.setUsername('clara');
    await ipad.client.setProfileSettings({ visibility: 'public', titles: false });
    expect(service.profile.puts).toBe(1);
    /** Every kind of every day published. */
    const kindsOf = () =>
      new Set(
        Object.values(service.profile.document!.activity!).flatMap((d) => Object.keys(d.kinds)),
      );
    // An older service: ear training counts as reading.
    expect(kindsOf().has('ear')).toBe(false);
    const legacy = service.profile.document!;

    // The service is deployed again: the device hears it the next time it reads the settings.
    service.profile.version = 2;
    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(1);
    await ipad.client.loadProfile();
    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(2);
    expect(kindsOf().has('ear')).toBe(true);
    expect(service.profile.document!).toMatchObject({ v: 1, days: legacy.days });
    // Once only: what it sent is remembered with the version.
    await ipad.client.syncNow();
    expect(service.profile.puts).toBe(2);
    // Settings changed keep the version.
    await ipad.client.setProfileSettings({ visibility: 'public', titles: true });
    expect(service.profile.puts).toBe(3);
    expect(kindsOf().has('ear')).toBe(true);
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

describe('a run on a keyboard with fewer keys (G6c)', () => {
  /** What a build before SYNC_SCHEMA 22 keeps of the service's records of a run: the steps it validates, the session without what it does not know. */
  async function asSchema21(d: Device, service: Service, sessionId: string, stepIds: string[]) {
    const state = (await d.db.get('meta', SYNC_STATE_KEY)) as SyncState;
    await d.db.clear('pieceSteps');
    for (const id of stepIds) {
      const kept = validatePieceStep21(service.body('pieceSteps', id));
      if (kept.ok) await d.db.put('pieceSteps', kept.value);
    }
    const session = validatePieceSession21(service.body('sessions', sessionId));
    if (!session.ok) throw new Error('the session should validate');
    await d.db.put('sessions', session.value);
    await d.db.put('meta', { ...state, schema: 21 }, SYNC_STATE_KEY);
    await d.store.reloadAll();
    return session.value;
  }

  it.each(['wait', 'rhythm', 'memory'] as const)(
    'syncs a %s run with its steps passed and the notes played for the player',
    async (mode) => {
      const service = fakeService();
      const ipad = await device(service);
      const mac = await device(service);
      const { steps, session } = sampleKeyboardRun('k1', mode, { pieceId: 'p1' });
      for (const step of steps) ipad.store.recordPieceStep(step, null);
      ipad.store.finishPieceRun('k1', session);
      await ipad.store.settled();
      await signIn(ipad);
      expect(service.body('sessions', 'k1')).toMatchObject({ given: 3, steps: 3, keys: [36, 84] });
      expect(service.body('pieceSteps', steps[2]!.id)).toMatchObject({ notes: [] });
      await signIn(mac);
      expect(mac.store.getSnapshot().sessions).toContainEqual(session);
      mac.store.loadPieceSteps('p1');
      await vi.waitFor(() => expect(mac.store.getPieceSteps('p1')).toEqual(steps));
    },
  );

  it('comes whole to a device once its build is updated, and nothing goes back and forth', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const { steps, session } = sampleKeyboardRun('k1', 'rhythm', { pieceId: 'p1' });
    for (const step of steps) ipad.store.recordPieceStep(step, null);
    ipad.store.finishPieceRun('k1', session);
    await ipad.store.settled();
    await signIn(ipad);
    await signIn(mac);

    // The Mac as its build before schema 22 left it: the step passed refused, the session kept
    // without the notes played for the player, the cursor past both.
    const kept = await asSchema21(
      mac,
      service,
      'k1',
      steps.map((s) => s.id),
    );
    expect(kept).not.toHaveProperty('given');
    expect(kept).not.toHaveProperty('keys');
    mac.store.loadPieceSteps('p1');
    await vi.waitFor(() =>
      expect(mac.store.getPieceSteps('p1')).toEqual([steps[0], steps[1], steps[3]]),
    );
    expect(mac.store.getSnapshot().sessions).toContainEqual(kept);

    // Updated: it pulls everything again, and takes back what it had left out.
    const sync = vi.spyOn(service.api, 'sync');
    await mac.client.syncNow();
    expect(SYNC_SCHEMA).toBeGreaterThanOrEqual(22);
    expect(sync.mock.calls.map((call) => call[1])).toEqual([0]);
    // It sent nothing of its own: its copies were the lesser ones.
    expect(sync.mock.calls.flatMap((call) => call[2])).toEqual([]);
    expect(mac.store.getSnapshot().sessions).toContainEqual(session);
    expect(mac.store.getSnapshot().sessions).not.toContainEqual(kept);
    mac.store.loadPieceSteps('p1');
    await vi.waitFor(() => expect(mac.store.getPieceSteps('p1')).toEqual(steps));

    // Both devices agree with the service, and further rounds change nothing on it.
    const before = [
      service.body('sessions', 'k1'),
      ...steps.map((s) => service.body('pieceSteps', s.id)),
    ];
    expect(before).toEqual([session, ...steps]);
    sync.mockClear();
    for (const d of [ipad, mac, ipad, mac]) await d.client.syncNow();
    expect(sync.mock.calls.flatMap((call) => call[2])).toEqual([]);
    expect([
      service.body('sessions', 'k1'),
      ...steps.map((s) => service.body('pieceSteps', s.id)),
    ]).toEqual(before);
    expect(ipad.store.getSnapshot().sessions).toEqual(mac.store.getSnapshot().sessions);
  });

  it('keeps the whole run when the device that made it meets a copy from an older build', async () => {
    const service = fakeService();
    const ipad = await device(service);
    const mac = await device(service);
    const { steps, session } = sampleKeyboardRun('k1', 'wait', { pieceId: 'p1' });
    // The service holds what an older build made of the run (it had it from a file, say): the
    // session without its count, the steps without the one passed.
    const stripped = { ...session };
    delete stripped.given;
    delete stripped.keys;
    for (const step of [steps[0]!, steps[1]!, steps[3]!]) mac.store.recordPieceStep(step, null);
    mac.store.finishPieceRun('k1', stripped);
    await mac.store.settled();
    await signIn(mac);
    expect(service.body('sessions', 'k1')).toEqual(stripped);

    // The iPad has the run whole: its copy of the session is the longer one, and wins everywhere.
    for (const step of steps) ipad.store.recordPieceStep(step, null);
    ipad.store.finishPieceRun('k1', session);
    await ipad.store.settled();
    await signIn(ipad);
    await ipad.client.syncNow();
    expect(service.body('sessions', 'k1')).toEqual(session);
    expect(service.body('pieceSteps', steps[2]!.id)).toEqual(steps[2]);
    await mac.client.syncNow();
    expect(mac.store.getSnapshot().sessions).toContainEqual(session);
    mac.store.loadPieceSteps('p1');
    await vi.waitFor(() => expect(mac.store.getPieceSteps('p1')).toEqual(steps));
    const sync = vi.spyOn(service.api, 'sync');
    for (const d of [ipad, mac, ipad]) await d.client.syncNow();
    expect(sync.mock.calls.flatMap((call) => call[2])).toEqual([]);
  });
});
