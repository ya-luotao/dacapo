import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDacapoDB, type DacapoDB } from './db.ts';
import {
  buildExport,
  EXPORT_VERSION,
  exportFileName,
  parseImport,
  planImport,
  type ExportFile,
  type ParsedImport,
  type Preferences,
} from './exchange.ts';
import { resetIndexedDB, sampleData, samplePiece } from './fixtures.ts';
import { createIndexedDbRepository, type PracticeRepository } from './repository.ts';

const PREFS: Preferences = { locale: 'zh-CN', theme: 'dark' };
const NOW = Date.UTC(2026, 8, 25, 8, 30);

let dbs: DacapoDB[] = [];

async function freshRepository(): Promise<PracticeRepository> {
  resetIndexedDB();
  const db = await openDacapoDB();
  dbs.push(db);
  return createIndexedDbRepository(db);
}

async function exportOf(repo: PracticeRepository, now = NOW): Promise<ExportFile> {
  return buildExport(await repo.load(), PREFS, { now, appVersion: '0.0.0' });
}

function parsed(text: string): ParsedImport {
  const result = parseImport(text);
  if (!result.ok) throw new Error(`Import failed: ${result.error.kind}`);
  return result.value;
}

function fileWith(patch: Record<string, unknown>): string {
  const { sessions, attempts } = sampleData();
  return JSON.stringify({
    format: 'dacapo',
    version: 1,
    exportedAt: new Date(NOW).toISOString(),
    app: { version: '0.0.0' },
    preferences: PREFS,
    sessions,
    attempts,
    noteStats: [],
    ...patch,
  });
}

beforeEach(() => {
  dbs = [];
});

afterEach(() => {
  for (const db of dbs) db.close();
});

describe('export', () => {
  it('writes the versioned file with preferences and every record', async () => {
    const repo = await freshRepository();
    const { sessions, attempts } = sampleData();
    await repo.merge({ sessions, attempts, pieces: [] });
    const file = await exportOf(repo);
    expect(file).toMatchObject({
      format: 'dacapo',
      version: EXPORT_VERSION,
      exportedAt: '2026-09-25T08:30:00.000Z',
      app: { version: '0.0.0' },
      preferences: PREFS,
    });
    expect(file.sessions.map((s) => s.id)).toEqual(['s1', 's2', 'f1']);
    expect(file.attempts).toEqual(attempts);
    expect(file.pieces).toEqual([]);
    expect(file.noteStats.map((s) => s.key)).toEqual([
      'C4@treble',
      'D4@treble',
      'E4@treble',
      'F4@treble',
      'G4@treble',
    ]);
    expect(JSON.parse(JSON.stringify(file))).toEqual(file);
  });

  it('names the file after the local date', () => {
    const lateEvening = Date.UTC(2026, 8, 24, 23, 30);
    expect(exportFileName(lateEvening, 'UTC')).toBe('dacapo-2026-09-24.json');
    expect(exportFileName(lateEvening, 'Asia/Shanghai')).toBe('dacapo-2026-09-25.json');
  });
});

describe('export → import', () => {
  it('round-trips into an empty database exactly', async () => {
    const source = await freshRepository();
    const { sessions, attempts } = sampleData();
    for (const attempt of attempts) await source.addAttempt(attempt);
    for (const session of sessions) await source.putSession(session);
    await source.putPiece(samplePiece(2, { hands: { '0.1': 'left' }, warnings: ['ornaments'] }));
    await source.putPiece(samplePiece(1));
    const exported = await exportOf(source);
    expect(exported.pieces.map((p) => p.id)).toEqual(['p1', 'p2']);

    const target = await freshRepository();
    const file = parsed(JSON.stringify(exported));
    expect(file.invalid).toEqual([]);
    expect(file.preferences).toEqual(PREFS);
    expect(await target.merge(file)).toEqual({
      sessions: 3,
      attempts: attempts.length,
      pieces: 2,
    });
    expect(await exportOf(target)).toEqual(exported);
    expect(await target.load()).toEqual(await source.load());
  });

  it('importing the same file twice changes nothing', async () => {
    const repo = await freshRepository();
    const text = fileWith({});
    const file = parsed(text);
    await repo.merge(file);
    const once = await repo.load();
    expect(await repo.merge(file)).toEqual({ sessions: 0, attempts: 0, pieces: 0 });
    expect(await repo.load()).toEqual(once);
  });

  it('rebuilds note stats from the attempts instead of trusting the file', async () => {
    const repo = await freshRepository();
    const forged = [
      {
        key: 'C4@treble',
        attempts: 999,
        correct: 999,
        errors: 0,
        ewmaMs: 1,
        lastSeen: 0,
        recent: [],
      },
    ];
    const file = parsed(fileWith({ noteStats: forged }));
    await repo.merge(file);
    const { stats } = await repo.load();
    expect(stats['C4@treble']!.attempts).toBe(
      sampleData().attempts.filter((a) => a.note === 'C4@treble').length,
    );
  });
});

describe('parseImport', () => {
  it('refuses text that is not JSON', () => {
    expect(parseImport('{"format": "dacapo",')).toEqual({
      ok: false,
      error: { kind: 'malformed' },
    });
    expect(parseImport('')).toEqual({ ok: false, error: { kind: 'malformed' } });
  });

  it.each([
    ['an array', '[]'],
    ['another format', fileWith({ format: 'other-app' })],
    ['no format', fileWith({ format: undefined })],
    ['a version that is not a number', fileWith({ version: '1' })],
    ['version 0', fileWith({ version: 0 })],
    ['a fractional version', fileWith({ version: 1.5 })],
    ['no sessions', fileWith({ sessions: undefined })],
    ['attempts that are not a list', fileWith({ attempts: {} })],
  ])('refuses %s as the wrong format', (_name, text) => {
    expect(parseImport(text)).toEqual({ ok: false, error: { kind: 'wrong-format' } });
  });

  it('refuses a file from a newer version', () => {
    expect(parseImport(fileWith({ version: EXPORT_VERSION + 1 }))).toEqual({
      ok: false,
      error: { kind: 'future-version', version: EXPORT_VERSION + 1 },
    });
  });

  it('keeps the good records and reports every bad one with its position and field', () => {
    const { sessions, attempts } = sampleData();
    const text = fileWith({
      sessions: [
        sessions[0],
        { ...sessions[1], level: 'L9' },
        'not a session',
        { ...sessions[2], kind: 'jam' },
        { ...sessions[2], endedAt: sessions[2]!.startedAt - 1 },
        sessions[2],
        sessions[2],
      ],
      attempts: [
        attempts[0],
        { ...attempts[1], note: 'H4@treble' },
        { ...attempts[2], ms: -5 },
        { ...attempts[3], correct: !attempts[3]!.correct },
        { ...attempts[4], target: 61 },
        { ...attempts[5], id: '' },
        null,
        attempts[6],
      ],
    });
    const file = parsed(text);
    expect(file.sessions.map((s) => s.id)).toEqual(['s1', 'f1']);
    expect(file.attempts).toEqual([attempts[0], attempts[6]]);
    expect(file.invalid).toEqual([
      { collection: 'sessions', index: 1, field: 'level', problem: 'invalid' },
      { collection: 'sessions', index: 2, field: 'record', problem: 'invalid' },
      { collection: 'sessions', index: 3, field: 'kind', problem: 'invalid' },
      { collection: 'sessions', index: 4, field: 'endedAt', problem: 'invalid' },
      { collection: 'sessions', index: 6, field: 'id', problem: 'duplicate' },
      { collection: 'attempts', index: 1, field: 'note', problem: 'invalid' },
      { collection: 'attempts', index: 2, field: 'ms', problem: 'invalid' },
      { collection: 'attempts', index: 3, field: 'correct', problem: 'invalid' },
      { collection: 'attempts', index: 4, field: 'target', problem: 'invalid' },
      { collection: 'attempts', index: 5, field: 'id', problem: 'invalid' },
      { collection: 'attempts', index: 6, field: 'record', problem: 'invalid' },
    ]);
  });

  it('drops unknown fields from valid records', () => {
    const { attempts } = sampleData();
    const file = parsed(fileWith({ attempts: [{ ...attempts[0], secret: 'x' }] }));
    expect(file.attempts).toEqual([attempts[0]]);
  });

  it('reports invalid preferences and leaves them out', () => {
    const file = parsed(fileWith({ preferences: { locale: 'fr', theme: 'dark' } }));
    expect(file.preferences).toBeNull();
    expect(file.invalid).toEqual([
      { collection: 'preferences', index: 0, field: 'locale', problem: 'invalid' },
    ]);
    expect(
      parsed(fileWith({ preferences: { locale: null, theme: 'system' } })).preferences,
    ).toEqual({ locale: null, theme: 'system' });
    expect(parsed(fileWith({ preferences: undefined })).preferences).toBeNull();
  });

  it('reads the export date and app version when present', () => {
    const file = parsed(fileWith({ app: 'x', exportedAt: 5 }));
    expect(file).toMatchObject({ exportedAt: null, appVersion: null, version: 1 });
    expect(parsed(fileWith({}))).toMatchObject({
      exportedAt: '2026-09-25T08:30:00.000Z',
      appVersion: '0.0.0',
    });
  });
});

describe('planImport', () => {
  it('counts new, already present and invalid records', () => {
    const { sessions, attempts } = sampleData();
    const file = parsed(
      fileWith({ attempts: [...attempts, { ...attempts[0], id: 'zz', at: -1 }] }),
    );
    const plan = planImport(file, {
      sessionIds: new Set(['s1']),
      attemptIds: new Set(attempts.slice(0, 4).map((a) => a.id)),
      pieceIds: new Set(),
    });
    expect(plan).toEqual({
      sessions: { new: sessions.length - 1, present: 1, invalid: 0 },
      attempts: { new: attempts.length - 4, present: 4, invalid: 1 },
      pieces: { new: 0, present: 0, invalid: 0 },
    });
  });

  it('counts pieces too', () => {
    const file = parsed(
      fileWith({ version: 2, pieces: [samplePiece(1), samplePiece(2), { id: 'bad' }] }),
    );
    const plan = planImport(file, {
      sessionIds: new Set(),
      attemptIds: new Set(),
      pieceIds: new Set(['p2']),
    });
    expect(plan.pieces).toEqual({ new: 1, present: 1, invalid: 1 });
  });
});

describe('versions', () => {
  it('imports a version 1 file, which has no pieces', () => {
    const file = parsed(fileWith({}));
    expect(file).toMatchObject({ version: 1, pieces: [], invalid: [] });
    expect(file.sessions).toHaveLength(3);
  });

  it('reads no pieces from a version 1 file whose pieces field is not a list', () => {
    expect(parsed(fileWith({ pieces: 'x' })).pieces).toEqual([]);
  });

  it('imports the pieces of a version 2 file and reports bad ones', () => {
    const good = samplePiece(1, { hands: { '0.1': 'right', '1.1': null }, warnings: ['jumps'] });
    const file = parsed(
      fileWith({
        version: 2,
        pieces: [
          good,
          { ...samplePiece(2), xml: '' },
          { ...samplePiece(3), hands: { piano: 'right' } },
          { ...samplePiece(4), warnings: ['something new'] },
          { ...samplePiece(5), importedAt: -1 },
          { ...good, title: 'Same id' },
          { ...samplePiece(6), extra: true },
        ],
      }),
    );
    expect(file.pieces.map((p) => p.id)).toEqual(['p1', 'p6']);
    expect(file.pieces[0]).toEqual(good);
    expect(file.pieces[1]).toEqual(samplePiece(6));
    expect(file.invalid).toEqual([
      { collection: 'pieces', index: 1, field: 'xml', problem: 'invalid' },
      { collection: 'pieces', index: 2, field: 'hands', problem: 'invalid' },
      { collection: 'pieces', index: 3, field: 'warnings', problem: 'invalid' },
      { collection: 'pieces', index: 4, field: 'importedAt', problem: 'invalid' },
      { collection: 'pieces', index: 5, field: 'id', problem: 'duplicate' },
    ]);
  });

  it('refuses a version 2 file without a pieces list', () => {
    expect(parseImport(fileWith({ version: 2 }))).toEqual({
      ok: false,
      error: { kind: 'wrong-format' },
    });
  });

  it('writes version 2', async () => {
    const repo = await freshRepository();
    await repo.putPiece(samplePiece(1));
    const file = await exportOf(repo);
    expect(file.version).toBe(2);
    expect(file.pieces).toEqual([samplePiece(1)]);
    expect(parsed(JSON.stringify(file)).pieces).toEqual([samplePiece(1)]);
  });
});
