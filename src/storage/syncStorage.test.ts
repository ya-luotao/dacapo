import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { statsFromAttempts } from '../core/weakness.ts';
import { openDacapoDB, type DacapoDB } from './db.ts';
import {
  resetIndexedDB,
  sampleAttempt,
  sampleData,
  sampleHeader,
  samplePiece,
  sampleRun,
  sampleScaleSession,
  T0,
} from './fixtures.ts';
import { createIndexedDbRepository, type PracticeRepository } from './repository.ts';
import type { PulledRecords, SyncStorage } from './syncStorage.ts';

let db: DacapoDB;
let repo: PracticeRepository;
let sync: SyncStorage;

const account = { id: 'acc', email: 'pianist@example.com' };

beforeEach(async () => {
  resetIndexedDB();
  db = await openDacapoDB();
  repo = createIndexedDbRepository(db);
  sync = repo.sync!;
});

afterEach(() => db.close());

const outboxKeys = async () => (await db.getAll('outbox')).map((entry) => entry.key).sort();

const nothing: PulledRecords = {
  attempts: [],
  sessions: [],
  pieces: [],
  deletions: [],
  pieceSteps: [],
  scaleRuns: [],
};

describe('signing in and out', () => {
  it('fills nothing in the outbox while signed out', async () => {
    await repo.addAttempt(sampleAttempt(0));
    await repo.putPiece(samplePiece(1));
    expect(await sync.state()).toBeNull();
    expect(await outboxKeys()).toEqual([]);
  });

  it('puts every stored record and deletion in the outbox when signing in', async () => {
    const { sessions, attempts } = sampleData();
    await repo.merge({ sessions, attempts, pieces: [], pieceSteps: [], scaleRuns: [] });
    await repo.putPiece(samplePiece(1));
    await repo.putPiece(samplePiece(2));
    await repo.deletePiece('p2', { steps: true, at: T0 });
    const run = sampleRun('r1', 2, { pieceId: 'p1' });
    for (const step of run.steps) await repo.addPieceStep(step, null);
    const scales = sampleScaleSession('k1', 1);
    await repo.addScaleRun(scales.runs[0]!, scales.session);

    await sync.signIn(account, 'token-1');
    expect(await sync.state()).toEqual({ account, token: 'token-1', cursor: 0, lastSyncAt: null });
    expect(await outboxKeys()).toEqual(
      [
        ...attempts.map((a) => `attempts/${a.id}`),
        ...[...sessions, scales.session].map((s) => `sessions/${s.id}`),
        'pieces/p1',
        'pieces/p2',
        ...run.steps.map((s) => `pieceSteps/${s.id}`),
        ...scales.runs.map((r) => `scaleRuns/${r.id}`),
      ].sort(),
    );
    expect((await db.get('outbox', 'pieces/p2'))!.deletion).toEqual({
      deleted: true,
      at: T0,
      withSteps: true,
    });
  });

  it('forgets the account and the outbox when signing out; the records stay', async () => {
    await repo.addAttempt(sampleAttempt(0));
    await sync.signIn(account, 't');
    await sync.signOut();
    expect(await sync.state()).toBeNull();
    expect(await outboxKeys()).toEqual([]);
    expect((await repo.load()).attempts).toHaveLength(1);
    await repo.addAttempt(sampleAttempt(1));
    expect(await outboxKeys()).toEqual([]);
  });

  it('signs out for a token only while it is the stored one', async () => {
    await sync.signIn(account, 'old');
    await sync.signIn(account, 'new');
    expect(await sync.signOut('old')).toBe(false);
    expect((await sync.state())!.token).toBe('new');
    expect(await sync.signOut('new')).toBe(true);
    expect(await sync.state()).toBeNull();
  });

  it('saves progress only for the token it was started with', async () => {
    await sync.signIn(account, 'old');
    expect(await sync.saveProgress('old', { cursor: 7 })).toBe(true);
    expect((await sync.state())!.cursor).toBe(7);
    await sync.signIn(account, 'new');
    expect(await sync.saveProgress('old', { cursor: 9, lastSyncAt: T0 })).toBe(false);
    expect(await sync.state()).toMatchObject({ token: 'new', cursor: 0, lastSyncAt: null });
  });
});

describe('the outbox while signed in', () => {
  beforeEach(() => sync.signIn(account, 't'));

  it('gets every write, once', async () => {
    await repo.addAttempt(sampleAttempt(0));
    await repo.addAttempt(sampleAttempt(0)); // stored already
    const run = sampleRun('r1', 2, { pieceId: 'p1' });
    await repo.addPieceStep(run.steps[0]!, sampleHeader('r1', { pieceId: 'p1' }));
    await repo.addPieceStep(run.steps[1]!, null);
    await repo.finishPieceRun('r1', run.session);
    const scales = sampleScaleSession('k1', 2);
    for (const r of scales.runs) await repo.addScaleRun(r, scales.session);
    await repo.putPiece(samplePiece(1));
    await repo.finishOpenFreePlay('f1', null);
    expect(await outboxKeys()).toEqual(
      [
        `attempts/${sampleAttempt(0).id}`,
        ...run.steps.map((s) => `pieceSteps/${s.id}`),
        'sessions/r1',
        'sessions/k1',
        ...scales.runs.map((r) => `scaleRuns/${r.id}`),
        'pieces/p1',
      ].sort(),
    );
  });

  it('does not send a piece again when only its facts were filled in', async () => {
    await repo.putPiece(samplePiece(1));
    await sync.acknowledge((await sync.pending(10)).map((p) => p.entry));
    const facts = { checksum: 'abc', bars: { right: 1, left: 1, both: 1 } };
    await repo.putPiece({ ...samplePiece(1), facts });
    expect(await outboxKeys()).toEqual([]);
    await repo.putPiece({ ...samplePiece(1), facts, title: 'Renamed' });
    expect(await outboxKeys()).toEqual(['pieces/p1']);
  });

  it('sends a deletion as it is now, with step records a pulled deletion added', async () => {
    await repo.putPiece(samplePiece(1));
    await repo.deletePiece('p1', { steps: false, at: T0 });
    await sync.apply({
      ...nothing,
      deletions: [{ id: 'p1', deletion: { deleted: true, at: T0 + 1, withSteps: true } }],
    });
    const [pending] = await sync.pending(10);
    expect(pending!.record).toEqual({ deleted: true, at: T0, withSteps: true });
  });

  it('sends the copy here again when it wins over a different pulled one', async () => {
    const run = sampleRun('r1', 1);
    await repo.putSession(run.session);
    await repo.putPiece({ ...samplePiece(1), updatedAt: T0 + 50 });
    await repo.putPiece(samplePiece(2));
    await repo.deletePiece('p2', { steps: true, at: T0 });
    await sync.acknowledge((await sync.pending(10)).map((p) => p.entry));
    await sync.apply({
      ...nothing,
      sessions: [{ ...run.session, endedAt: run.session.endedAt - 1 }],
      pieces: [{ ...samplePiece(1), title: 'Older', updatedAt: T0 + 10 }, samplePiece(2)],
      deletions: [],
    });
    expect(await outboxKeys()).toEqual(['pieces/p1', 'pieces/p2', 'sessions/r1']);
    // The same copy pulled again is no reason to send anything.
    await sync.acknowledge((await sync.pending(10)).map((p) => p.entry));
    await sync.apply({ ...nothing, sessions: [run.session] });
    expect(await outboxKeys()).toEqual([]);
  });

  it('sends a deletion again when the pulled one lacks its step records', async () => {
    await repo.putPiece(samplePiece(1));
    await repo.deletePiece('p1', { steps: true, at: T0 });
    await sync.acknowledge((await sync.pending(10)).map((p) => p.entry));
    await sync.apply({
      ...nothing,
      deletions: [{ id: 'p1', deletion: { deleted: true, at: T0, withSteps: false } }],
    });
    const [pending] = await sync.pending(10);
    expect(pending!.record).toEqual({ deleted: true, at: T0, withSteps: true });
  });

  it('sends a deletion in place of a deleted piece', async () => {
    await repo.putPiece(samplePiece(1));
    await repo.deletePiece('p1', { steps: false, at: T0 });
    const [pending] = await sync.pending(10);
    expect(pending!.entry.key).toBe('pieces/p1');
    expect(pending!.record).toEqual({ deleted: true, at: T0, withSteps: false });
  });

  it('hands out records as stored now, null when gone', async () => {
    await repo.addAttempt(sampleAttempt(0));
    await repo.putPiece(samplePiece(1));
    await db.delete('pieces', 'p1'); // as if removed without a deletion record
    const pending = await sync.pending(10);
    expect(pending.map((p) => [p.entry.key, p.record])).toEqual([
      [`attempts/${sampleAttempt(0).id}`, sampleAttempt(0)],
      ['pieces/p1', null],
    ]);
    expect(await sync.pending(1)).toHaveLength(1);
  });

  it('keeps an entry whose record was written again while it was being sent', async () => {
    await repo.putPiece(samplePiece(1));
    await repo.addAttempt(sampleAttempt(0));
    const sent = (await sync.pending(10)).map((p) => p.entry);
    await repo.putPiece({ ...samplePiece(1), title: 'Renamed', updatedAt: T0 + 1 });
    await sync.acknowledge(sent);
    expect(await outboxKeys()).toEqual(['pieces/p1']);
  });

  it('adds what an import adds', async () => {
    const { sessions, attempts } = sampleData();
    await repo.merge({
      sessions,
      attempts: attempts.slice(0, 2),
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
    });
    expect(await outboxKeys()).toEqual(
      [
        ...attempts.slice(0, 2).map((a) => `attempts/${a.id}`),
        ...sessions.map((s) => `sessions/${s.id}`),
      ].sort(),
    );
  });
});

describe('applying pulled records', () => {
  it('adds new records, keeps stored ones and rebuilds the stats from all attempts', async () => {
    const { attempts } = sampleData();
    for (const attempt of attempts.slice(0, 5)) await repo.addAttempt(attempt);
    const counts = await sync.apply({
      ...nothing,
      attempts: [...attempts.slice(3), attempts[6]!],
    });
    expect(counts.attempts).toBe(attempts.length - 5);
    const data = await repo.load();
    expect(data.attempts).toEqual(attempts);
    expect(data.stats).toEqual(statsFromAttempts(attempts));
  });

  it('leaves the stats alone when no attempt was added', async () => {
    await repo.addAttempt(sampleAttempt(0));
    const before = (await repo.load()).stats;
    await db.put('noteStats', { ...Object.values(before)[0]!, attempts: 99 });
    await sync.apply({ ...nothing, attempts: [sampleAttempt(0)] });
    expect(Object.values((await repo.load()).stats)[0]!.attempts).toBe(99);
  });

  it('keeps the later copy of a session: more runs, or else ended later', async () => {
    const shorter = sampleScaleSession('k1', 1).session;
    const longer = sampleScaleSession('k1', 3).session;
    const run = sampleRun('r1', 1);
    await repo.putSession(longer);
    await repo.putSession(run.session);
    const later = { ...run.session, endedAt: run.session.endedAt + 1 };
    const counts = await sync.apply({ ...nothing, sessions: [shorter, later] });
    expect(counts.sessions).toBe(1);
    expect((await repo.load()).sessions).toEqual(expect.arrayContaining([longer, later]));
    await repo.putSession(shorter);
    expect((await sync.apply({ ...nothing, sessions: [longer] })).sessions).toBe(1);
    expect((await repo.load()).sessions).toContainEqual(longer);
  });

  it('picks the same copy of two that tie, on every device', async () => {
    const run = sampleRun('r1', 1);
    const a = { ...run.session, title: 'A' };
    const b = { ...run.session, title: 'B' };
    await repo.putSession(a);
    expect((await sync.apply({ ...nothing, sessions: [b] })).sessions).toBe(1);
    await repo.putSession(b);
    expect((await sync.apply({ ...nothing, sessions: [a] })).sessions).toBe(0);
  });

  it('keeps the later copy of a piece, with the facts filled in here', async () => {
    const facts = { checksum: 'abc', bars: { right: 1, left: 1, both: 1 } };
    await repo.putPiece({ ...samplePiece(1), updatedAt: T0 + 10, facts });
    await repo.putPiece({ ...samplePiece(2), updatedAt: T0 + 10 });
    const counts = await sync.apply({
      ...nothing,
      pieces: [
        { ...samplePiece(1), title: 'Newer', updatedAt: T0 + 20 },
        { ...samplePiece(2), title: 'Older', updatedAt: T0 + 5 },
        samplePiece(3),
      ],
    });
    expect(counts.pieces).toBe(2);
    const pieces = new Map((await repo.load()).pieces.map((p) => [p.id, p]));
    expect(pieces.get('p1')).toMatchObject({ title: 'Newer', facts });
    expect(pieces.get('p2')!.title).toBe(samplePiece(2).title);
    expect(pieces.get('p3')).toEqual(samplePiece(3));
  });

  it('deletes a piece deleted elsewhere, with its step records if deleted with them, for good', async () => {
    await repo.putPiece(samplePiece(1));
    await repo.putPiece(samplePiece(2));
    const one = sampleRun('r1', 2, { pieceId: 'p1' });
    const two = sampleRun('r2', 2, { pieceId: 'p2' });
    for (const step of [...one.steps, ...two.steps]) await repo.addPieceStep(step, null);

    const counts = await sync.apply({
      ...nothing,
      deletions: [
        { id: 'p1', deletion: { deleted: true, at: T0, withSteps: true } },
        { id: 'p2', deletion: { deleted: true, at: T0, withSteps: false } },
      ],
    });
    expect(counts.deleted).toBe(2);
    expect((await repo.load()).pieces).toEqual([]);
    expect(await repo.pieceSteps({ pieceId: 'p1' })).toEqual([]);
    expect(await repo.pieceSteps({ pieceId: 'p2' })).toEqual(two.steps);

    // Copies that arrive later, from a device that practised offline, are dropped.
    const late = sampleRun('r3', 1, { pieceId: 'p1' }).steps;
    const again = await sync.apply({
      ...nothing,
      pieces: [{ ...samplePiece(1), updatedAt: T0 + 99 }],
      pieceSteps: [...late, ...sampleRun('r4', 1, { pieceId: 'p2' }).steps],
    });
    expect(again).toMatchObject({ pieces: 0, pieceSteps: 1 });
    expect((await repo.load()).pieces).toEqual([]);
    expect(await repo.pieceSteps({ pieceId: 'p1' })).toEqual([]);
  });

  it('drops a piece and its steps that arrive in the same page as their deletion', async () => {
    const steps = sampleRun('r1', 2, { pieceId: 'p1' }).steps;
    const counts = await sync.apply({
      ...nothing,
      pieces: [samplePiece(1)],
      pieceSteps: steps,
      deletions: [{ id: 'p1', deletion: { deleted: true, at: T0, withSteps: true } }],
    });
    expect(counts).toEqual({
      attempts: 0,
      sessions: 0,
      pieces: 0,
      deleted: 0,
      pieceSteps: 0,
      scaleRuns: 0,
    });
    expect(await db.get('meta', 'deleted:piece:p1')).toMatchObject({ withSteps: true });
  });

  it('never puts pulled records in the outbox', async () => {
    await sync.signIn(account, 't');
    await sync.apply({ ...nothing, attempts: [sampleAttempt(0)], pieces: [samplePiece(1)] });
    expect(await outboxKeys()).toEqual([]);
  });

  it('adds scale runs and step records once', async () => {
    const scales = sampleScaleSession('k1', 2);
    const run = sampleRun('r1', 2);
    await repo.addPieceStep(run.steps[0]!, null);
    const counts = await sync.apply({
      ...nothing,
      scaleRuns: [...scales.runs, scales.runs[0]!],
      pieceSteps: run.steps,
    });
    expect(counts).toMatchObject({ scaleRuns: 2, pieceSteps: 1 });
    expect(await repo.allScaleRuns()).toEqual(scales.runs);
  });
});
