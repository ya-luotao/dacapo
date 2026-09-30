import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recoverEarSummary } from '../core/earSession.ts';
import type { SessionRecord } from '../core/log.ts';
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
import {
  resetIndexedDB,
  sampleAnswer,
  sampleData,
  sampleEarSession,
  sampleEchoAnswer,
  sampleHeadline,
  sampleNamedAnswer,
  samplePiece,
  sampleRhythmRun,
  sampleRun,
  sampleScaleSession,
  T0,
} from './fixtures.ts';
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
  const data = await repo.load();
  const [pieceSteps, scaleRuns] = await Promise.all([repo.allPieceSteps(), repo.allScaleRuns()]);
  return buildExport({ ...data, pieceSteps, scaleRuns }, PREFS, { now, appVersion: '0.0.0' });
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
    await repo.merge({
      sessions,
      attempts,
      pieces: [],
      pieceSteps: [],
      scaleRuns: [],
      answers: [],
    });
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
    const runs = [
      sampleRun('r1', 6),
      sampleRun('r2', 4, { pieceId: 'p1', hands: 'both' }),
      sampleRhythmRun('r3', 5),
    ];
    for (const { steps, session } of runs) {
      for (const step of steps) await source.addPieceStep(step, null);
      await source.putSession({
        ...session,
        loop: { from: 2, to: 3, fromLabel: '3', toLabel: '4' },
      });
    }
    const scales = [
      sampleScaleSession('k1', 3),
      sampleScaleSession('k2', 2, { exercise: 'harmonicMinor:G#:2:left', startedAt: T0 - 90_000 }),
    ];
    for (const { runs, session } of scales) {
      for (const run of runs) await source.addScaleRun(run, session);
    }
    const exported = await exportOf(source);
    expect(exported.pieces.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(exported.pieceSteps).toHaveLength(15);
    expect(exported.pieceSteps.filter((s) => s.mode === 'rhythm')).toHaveLength(5);
    expect(exported.sessions.filter((s) => s.kind === 'piece')).toHaveLength(3);
    expect(exported.sessions.filter((s) => s.kind === 'scale')).toHaveLength(2);
    expect(exported.scaleRuns.map((r) => r.id)).toEqual(['k2:0', 'k2:1', 'k1:0', 'k1:1', 'k1:2']);

    const target = await freshRepository();
    const file = parsed(JSON.stringify(exported));
    expect(file.invalid).toEqual([]);
    expect(file.preferences).toEqual(PREFS);
    expect(await target.merge(file)).toEqual({
      sessions: 8,
      attempts: attempts.length,
      pieces: 2,
      pieceSteps: 15,
      scaleRuns: 5,
      answers: 0,
    });
    expect(await exportOf(target)).toEqual(exported);
    expect(await target.load()).toEqual(await source.load());
    expect(await target.allPieceSteps()).toEqual(await source.allPieceSteps());
    expect(await target.allScaleRuns()).toEqual(await source.allScaleRuns());
  });

  it('importing the same file twice changes nothing', async () => {
    const repo = await freshRepository();
    const text = fileWith({});
    const file = parsed(text);
    await repo.merge(file);
    const once = await repo.load();
    expect(await repo.merge(file)).toEqual({
      sessions: 0,
      attempts: 0,
      pieces: 0,
      pieceSteps: 0,
      scaleRuns: 0,
      answers: 0,
    });
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

  it.each(['en', 'zh-CN', 'zh-TW', 'ja', 'ko'])(
    'accepts the %s locale in preferences',
    (locale) => {
      const file = parsed(fileWith({ preferences: { locale, theme: 'light' } }));
      expect(file.preferences).toEqual({ locale, theme: 'light' });
      expect(file.invalid).toEqual([]);
    },
  );

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
      pieceStepIds: new Set(),
      scaleRunIds: new Set(),
      answerIds: new Set(),
    });
    expect(plan).toEqual({
      sessions: { new: sessions.length - 1, present: 1, invalid: 0 },
      attempts: { new: attempts.length - 4, present: 4, invalid: 1 },
      pieces: { new: 0, present: 0, invalid: 0 },
      pieceSteps: { new: 0, present: 0, invalid: 0 },
      scaleRuns: { new: 0, present: 0, invalid: 0 },
      answers: { new: 0, present: 0, invalid: 0 },
    });
  });

  it('counts step records too', () => {
    const { steps } = sampleRun('r1', 4);
    const file = parsed(fileWith({ version: 3, pieces: [], pieceSteps: steps }));
    const plan = planImport(file, {
      sessionIds: new Set(),
      attemptIds: new Set(),
      pieceIds: new Set(),
      pieceStepIds: new Set([steps[0]!.id]),
      scaleRunIds: new Set(),
      answerIds: new Set(),
    });
    expect(plan.pieceSteps).toEqual({ new: 3, present: 1, invalid: 0 });
  });

  it('counts scale runs too', () => {
    const { runs, session } = sampleScaleSession('k1', 3);
    const file = parsed(
      fileWith({
        version: 5,
        pieces: [],
        pieceSteps: [],
        sessions: [session],
        scaleRuns: [...runs, { ...runs[0]!, id: 'bad', keys: [] }],
        answers: [],
      }),
    );
    const plan = planImport(file, {
      sessionIds: new Set(),
      attemptIds: new Set(),
      pieceIds: new Set(),
      pieceStepIds: new Set(),
      scaleRunIds: new Set([runs[2]!.id]),
      answerIds: new Set(),
    });
    expect(plan.sessions).toEqual({ new: 1, present: 0, invalid: 0 });
    expect(plan.scaleRuns).toEqual({ new: 2, present: 1, invalid: 1 });
  });

  it('counts pieces too', () => {
    const file = parsed(
      fileWith({ version: 2, pieces: [samplePiece(1), samplePiece(2), { id: 'bad' }] }),
    );
    const plan = planImport(file, {
      sessionIds: new Set(),
      attemptIds: new Set(),
      pieceIds: new Set(['p2']),
      pieceStepIds: new Set(),
      scaleRunIds: new Set(),
      answerIds: new Set(),
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

  it('imports a version 2 file, which has no step records', () => {
    const file = parsed(fileWith({ version: 2, pieces: [samplePiece(1)], pieceSteps: 'x' }));
    expect(file).toMatchObject({ version: 2, pieceSteps: [], invalid: [] });
    expect(file.pieces).toEqual([samplePiece(1)]);
  });

  it('refuses a version 3 file without a list of step records', () => {
    expect(parseImport(fileWith({ version: 3, pieces: [] }))).toEqual({
      ok: false,
      error: { kind: 'wrong-format' },
    });
  });

  it('imports piece sessions and step records of a version 3 file and reports bad ones', () => {
    const { steps, session } = sampleRun('r1', 3);
    const file = parsed(
      fileWith({
        version: 3,
        pieces: [],
        sessions: [
          session,
          { ...session, id: 'x1', hands: 'feet' },
          { ...session, id: 'x2', loop: { from: 3, to: 1, fromLabel: '4', toLabel: '2' } },
          { ...session, id: 'x3', endedAt: session.startedAt - 1 },
        ],
        pieceSteps: [
          ...steps,
          { ...steps[0]!, id: 'y1', checksum: 'nothex!!' },
          { ...steps[0]!, id: 'y2', pass: 0 },
          { ...steps[0]!, id: 'y3', ms: Number.NaN },
          steps[1],
          { ...steps[2]!, id: 'y4', extra: 1 },
        ],
      }),
    );
    expect(file.sessions).toEqual([session]);
    expect(file.pieceSteps).toEqual([...steps, { ...steps[2]!, id: 'y4' }]);
    expect(file.invalid).toEqual([
      { collection: 'sessions', index: 1, field: 'hands', problem: 'invalid' },
      { collection: 'sessions', index: 2, field: 'loop', problem: 'invalid' },
      { collection: 'sessions', index: 3, field: 'endedAt', problem: 'invalid' },
      { collection: 'pieceSteps', index: 3, field: 'checksum', problem: 'invalid' },
      { collection: 'pieceSteps', index: 4, field: 'pass', problem: 'invalid' },
      { collection: 'pieceSteps', index: 5, field: 'ms', problem: 'invalid' },
      { collection: 'pieceSteps', index: 6, field: 'id', problem: 'duplicate' },
    ]);
  });

  it('imports a version 3 file: its steps and sessions are wait mode’s', () => {
    const { steps, session } = sampleRun('r1', 3);
    const file = parsed(
      fileWith({ version: 3, pieces: [], sessions: [session], pieceSteps: steps }),
    );
    expect(file.invalid).toEqual([]);
    expect(file.pieceSteps).toEqual(steps);
    expect(file.pieceSteps.every((s) => s.mode === undefined && s.notes === undefined)).toBe(true);
    expect(file.sessions).toEqual([session]);
  });

  it('imports rhythm steps and sessions of a version 4 file and reports bad ones', () => {
    const { steps, session } = sampleRhythmRun('r1', 3);
    const file = parsed(
      fileWith({
        version: 4,
        pieces: [],
        sessions: [
          session,
          { ...session, id: 'x1', rhythm: undefined },
          { ...session, id: 'x2', rhythm: { notes: 2, hits: 3, inTime: 1 } },
          { ...session, id: 'x3', mode: 'swing' },
          { ...sampleRun('w1', 1).session, id: 'x4', rhythm: { notes: 1, hits: 1, inTime: 1 } },
        ],
        pieceSteps: [
          ...steps,
          { ...steps[0]!, id: 'y1', notes: undefined },
          { ...steps[0]!, id: 'y2', notes: [] },
          { ...steps[0]!, id: 'y3', notes: [{ midi: 200, deviation: 3 }] },
          { ...steps[0]!, id: 'y4', notes: [{ midi: 60, deviation: 5000 }] },
          { ...steps[0]!, id: 'y5', mode: undefined },
          { ...steps[0]!, id: 'y6', notes: [{ midi: 60, deviation: null, extra: 1 }] },
        ],
      }),
    );
    expect(file.sessions).toEqual([session]);
    expect(file.pieceSteps).toEqual([
      ...steps,
      { ...steps[0]!, id: 'y6', notes: [{ midi: 60, deviation: null }] },
    ]);
    expect(file.invalid).toEqual([
      { collection: 'sessions', index: 1, field: 'rhythm', problem: 'invalid' },
      { collection: 'sessions', index: 2, field: 'rhythm', problem: 'invalid' },
      { collection: 'sessions', index: 3, field: 'mode', problem: 'invalid' },
      { collection: 'sessions', index: 4, field: 'rhythm', problem: 'invalid' },
      { collection: 'pieceSteps', index: 3, field: 'notes', problem: 'invalid' },
      { collection: 'pieceSteps', index: 4, field: 'notes', problem: 'invalid' },
      { collection: 'pieceSteps', index: 5, field: 'notes', problem: 'invalid' },
      { collection: 'pieceSteps', index: 6, field: 'notes', problem: 'invalid' },
      { collection: 'pieceSteps', index: 7, field: 'notes', problem: 'invalid' },
    ]);
  });

  it('imports a version 4 file, which has no scale runs', () => {
    const { steps, session } = sampleRhythmRun('r1', 3);
    const file = parsed(
      fileWith({
        version: 4,
        pieces: [],
        sessions: [session],
        pieceSteps: steps,
        scaleRuns: 'x',
      }),
    );
    expect(file).toMatchObject({ version: 4, scaleRuns: [], invalid: [] });
    expect(file.sessions).toEqual([session]);
    expect(file.pieceSteps).toEqual(steps);
  });

  it('refuses a version 5 file without a list of scale runs', () => {
    expect(parseImport(fileWith({ version: 5, pieces: [], pieceSteps: [] }))).toEqual({
      ok: false,
      error: { kind: 'wrong-format' },
    });
  });

  it('imports scale sessions and runs of a version 5 file and reports bad ones', () => {
    const { runs, session } = sampleScaleSession('k1', 2);
    const [run] = runs;
    const summary = session.runs[0]!;
    const withSummary = (id: string, patch: Record<string, unknown>) => ({
      ...session,
      id,
      runs: [{ ...summary, ...patch }],
    });
    const key = run!.keys[0]!;
    const file = parsed(
      fileWith({
        version: 5,
        pieces: [],
        pieceSteps: [],
        sessions: [
          { ...session, extra: 1, runs: session.runs.map((r) => ({ ...r, extra: 1 })) },
          { ...session, id: 'x1', runs: [] },
          { ...session, id: 'x2', endedAt: session.startedAt - 1 },
          withSummary('x3', { exercise: 'major:H:1:right' }),
          withSummary('x4', { headline: sampleHeadline({ version: 0 }) }),
          withSummary('x5', { headline: { ...sampleHeadline(), counts: { matched: 3 } } }),
          withSummary('x6', { endedAt: summary.startedAt - 1 }),
          withSummary('x7', {
            headline: sampleHeadline({
              hands: [{ ...sampleHeadline().hands[0]!, spread: '2' as unknown as number }],
            }),
          }),
          withSummary('x8', {
            headline: sampleHeadline({
              hands: [{ ...sampleHeadline().hands[0]!, spread: null, medianInterval: null }],
            }),
          }),
        ],
        scaleRuns: [
          { ...run, secret: true },
          runs[1],
          { ...run, id: 'y1', exercise: 'major:C:5:right' },
          { ...run, id: 'y2', keys: [{ ...key, midi: 128 }] },
          { ...run, id: 'y3', keys: [{ ...key, velocity: 128 }] },
          { ...run, id: 'y4', keys: [{ ...key, on: -1 }] },
          { ...run, id: 'y5', keys: [{ ...key, on: 100, off: 99 }] },
          { ...run, id: 'y6', end: 'crashed' },
          { ...run, id: 'y7', pedal: [{ down: 'yes', time: 1 }] },
          { ...run, id: 'y8', inputs: [5] },
          { ...run, id: 'y9', startedAt: Number.NaN },
          { ...run, id: 'y10', keys: [{ ...key, extra: 1 }], pedal: [{ down: true, time: -0.5 }] },
          runs[1],
        ],
      }),
    );
    const x8 = withSummary('x8', {
      headline: sampleHeadline({
        hands: [{ ...sampleHeadline().hands[0]!, spread: null, medianInterval: null }],
      }),
    });
    expect(file.sessions).toEqual([session, x8]);
    expect(file.scaleRuns).toEqual([
      run,
      runs[1],
      { ...run, id: 'y10', keys: [key], pedal: [{ down: true, time: -0.5 }] },
    ]);
    expect(file.invalid).toEqual([
      { collection: 'sessions', index: 1, field: 'runs', problem: 'invalid' },
      { collection: 'sessions', index: 2, field: 'endedAt', problem: 'invalid' },
      { collection: 'sessions', index: 3, field: 'runs', problem: 'invalid' },
      { collection: 'sessions', index: 4, field: 'runs', problem: 'invalid' },
      { collection: 'sessions', index: 5, field: 'runs', problem: 'invalid' },
      { collection: 'sessions', index: 6, field: 'runs', problem: 'invalid' },
      { collection: 'sessions', index: 7, field: 'runs', problem: 'invalid' },
      { collection: 'scaleRuns', index: 2, field: 'exercise', problem: 'invalid' },
      { collection: 'scaleRuns', index: 3, field: 'keys', problem: 'invalid' },
      { collection: 'scaleRuns', index: 4, field: 'keys', problem: 'invalid' },
      { collection: 'scaleRuns', index: 5, field: 'keys', problem: 'invalid' },
      { collection: 'scaleRuns', index: 6, field: 'keys', problem: 'invalid' },
      { collection: 'scaleRuns', index: 7, field: 'end', problem: 'invalid' },
      { collection: 'scaleRuns', index: 8, field: 'pedal', problem: 'invalid' },
      { collection: 'scaleRuns', index: 9, field: 'inputs', problem: 'invalid' },
      { collection: 'scaleRuns', index: 10, field: 'startedAt', problem: 'invalid' },
      { collection: 'scaleRuns', index: 12, field: 'id', problem: 'duplicate' },
    ]);
  });

  it('writes version 6 with pieces, piece sessions, step records, scale runs and answers', async () => {
    const repo = await freshRepository();
    await repo.putPiece(samplePiece(1));
    const { steps, session } = sampleRun('r1', 2);
    for (const step of steps) await repo.addPieceStep(step, null);
    await repo.putSession(session);
    const scales = sampleScaleSession('k1', 2);
    for (const run of scales.runs) await repo.addScaleRun(run, scales.session);
    const ear = sampleEarSession('e1', 5);
    for (const answer of [...ear.answers].reverse()) await repo.addAnswer(answer);
    await repo.putSession(ear.session);
    const file = await exportOf(repo);
    expect(EXPORT_VERSION).toBe(6);
    expect(file.version).toBe(6);
    expect(file.pieces).toEqual([samplePiece(1)]);
    expect(file.pieceSteps).toEqual(steps);
    expect(file.scaleRuns).toEqual(scales.runs);
    expect(file.answers).toEqual(ear.answers);
    const back = parsed(JSON.stringify(file));
    expect(back.invalid).toEqual([]);
    expect(back.pieces).toEqual([samplePiece(1)]);
    expect(back.pieceSteps).toEqual(steps);
    expect(back.scaleRuns).toEqual(scales.runs);
    expect(back.answers).toEqual(ear.answers);
    expect(back.sessions).toEqual([scales.session, session, ear.session]);
  });

  it('imports a version 5 file, which has no answers', () => {
    const file = parsed(
      fileWith({ version: 5, pieces: [], pieceSteps: [], scaleRuns: [], answers: 'x' }),
    );
    expect(file).toMatchObject({ version: 5, answers: [], invalid: [] });
  });

  it('refuses a version 6 file without a list of answers', () => {
    expect(
      parseImport(fileWith({ version: 6, pieces: [], pieceSteps: [], scaleRuns: [] })),
    ).toEqual({ ok: false, error: { kind: 'wrong-format' } });
  });

  it('imports ear answers and sessions of a version 6 file and reports bad ones', () => {
    const { answers, session } = sampleEarSession('e1', 2);
    const good = answers[0]!;
    const named = sampleNamedAnswer(1);
    const chord = sampleAnswer(9, 'e1', {
      family: 'chord',
      level: 'C3',
      item: 'chord:maj:1st',
      prompt: [64, 67, 72],
      answer: [52, 60, 67],
      correct: true,
    });
    const file = parsed(
      fileWith({
        version: 6,
        pieces: [],
        pieceSteps: [],
        scaleRuns: [],
        sessions: [
          { ...session, extra: 1, missed: session.missed.map((m) => ({ ...m, extra: 1 })) },
          { ...session, id: 'x1', level: 'C1' },
          { ...session, id: 'x2', missed: [{ item: 'int:A4:up', answer: 'P5', prompt: [60] }] },
          { ...session, id: 'x3', accuracy: null },
          { ...session, id: 'x4', kind: 'hearing' },
        ],
        answers: [
          { ...good, extra: 1 },
          named,
          chord,
          { ...good, id: 'y1', level: 'C1' },
          { ...good, id: 'y2', item: 'int:P4:up', prompt: [60, 65], answer: [65] },
          { ...good, id: 'y3', prompt: [60, 66] },
          { ...good, id: 'y4', answer: [good.prompt[0]!] },
          { ...good, id: 'y5', correct: !good.correct },
          { ...named, id: 'y6', answer: 'aug:root' },
          { ...chord, id: 'y7', answer: [60, 64, 67] },
          { ...chord, id: 'y8', answer: [64, 60, 67] },
          { ...chord, id: 'y9', answer: [60, 64] },
          { ...good, id: 'y10', by: 'hum' },
          { ...good, id: 'y11', replays: -1 },
          { ...good, id: 'y12', family: 'chord' },
          answers[1],
          answers[1],
        ],
      }),
    );
    expect(file.sessions).toEqual([session]);
    expect(file.answers).toEqual([good, named, chord, answers[1]]);
    expect(file.invalid).toEqual([
      { collection: 'sessions', index: 1, field: 'level', problem: 'invalid' },
      { collection: 'sessions', index: 2, field: 'missed', problem: 'invalid' },
      { collection: 'sessions', index: 3, field: 'accuracy', problem: 'invalid' },
      { collection: 'sessions', index: 4, field: 'kind', problem: 'invalid' },
      { collection: 'answers', index: 3, field: 'level', problem: 'invalid' },
      { collection: 'answers', index: 4, field: 'item', problem: 'invalid' },
      { collection: 'answers', index: 5, field: 'prompt', problem: 'invalid' },
      { collection: 'answers', index: 6, field: 'answer', problem: 'invalid' },
      { collection: 'answers', index: 7, field: 'correct', problem: 'invalid' },
      { collection: 'answers', index: 8, field: 'answer', problem: 'invalid' },
      { collection: 'answers', index: 9, field: 'correct', problem: 'invalid' },
      { collection: 'answers', index: 10, field: 'answer', problem: 'invalid' },
      { collection: 'answers', index: 11, field: 'answer', problem: 'invalid' },
      { collection: 'answers', index: 12, field: 'by', problem: 'invalid' },
      { collection: 'answers', index: 13, field: 'replays', problem: 'invalid' },
      { collection: 'answers', index: 14, field: 'level', problem: 'invalid' },
      { collection: 'answers', index: 16, field: 'id', problem: 'duplicate' },
    ]);
  });

  it('imports melodies played back, judging each again', () => {
    const right = sampleEchoAnswer(0);
    const wrong = sampleEchoAnswer(1);
    const session: SessionRecord = { kind: 'ear', ...recoverEarSummary([right, wrong])! };
    const file = parsed(
      fileWith({
        version: 6,
        pieces: [],
        pieceSteps: [],
        scaleRuns: [],
        sessions: [
          session,
          { ...session, id: 'x1', level: 'I1' },
          { ...session, id: 'x2', missed: [{ ...session.missed[0]!, prompt: Array(9).fill(60) }] },
          { ...session, id: 'x3', missed: [{ ...session.missed[0]!, key: undefined }] },
        ],
        answers: [
          right,
          wrong,
          // Too many notes for EC2, a key twice in a row, another family's level.
          { ...right, id: 'y1', prompt: [64, 67, 65, 62, 60], answer: [64, 67, 65, 62, 60] },
          { ...right, id: 'y2', prompt: [64, 64, 65, 60], answer: [64, 64, 65, 60] },
          { ...right, id: 'y3', level: 'I1' },
          // Named, unfinished, a wrong key before the last, and judged wrongly.
          { ...right, id: 'y4', by: 'name', answer: 'P5' },
          { ...right, id: 'y5', answer: [64, 67] },
          { ...wrong, id: 'y6', answer: [64, 66, 65] },
          { ...wrong, id: 'y7', correct: true },
          { ...right, id: 'y8', correct: false },
          // Its key: missing, not one of the level's, a minor scale for a major key, or on an
          // interval.
          { ...right, id: 'y9', key: undefined },
          { ...right, id: 'y10', key: { tonic: 'D', scale: 'major' } },
          { ...right, id: 'y11', key: { tonic: 'C', scale: 'harmonicMinor' } },
          { ...right, id: 'y12', key: { tonic: 'C', scale: 'major', mode: 'major' } },
          sampleAnswer(0, 'e9', { key: { tonic: 'C', scale: 'major' } }),
        ],
      }),
    );
    expect(file.sessions).toEqual([session]);
    expect(file.answers).toEqual([right, wrong]);
    expect(file.invalid).toEqual([
      { collection: 'sessions', index: 1, field: 'level', problem: 'invalid' },
      { collection: 'sessions', index: 2, field: 'missed', problem: 'invalid' },
      { collection: 'sessions', index: 3, field: 'missed', problem: 'invalid' },
      { collection: 'answers', index: 2, field: 'prompt', problem: 'invalid' },
      { collection: 'answers', index: 3, field: 'prompt', problem: 'invalid' },
      { collection: 'answers', index: 4, field: 'level', problem: 'invalid' },
      { collection: 'answers', index: 5, field: 'answer', problem: 'invalid' },
      { collection: 'answers', index: 6, field: 'answer', problem: 'invalid' },
      { collection: 'answers', index: 7, field: 'answer', problem: 'invalid' },
      { collection: 'answers', index: 8, field: 'correct', problem: 'invalid' },
      { collection: 'answers', index: 9, field: 'correct', problem: 'invalid' },
      { collection: 'answers', index: 10, field: 'key', problem: 'invalid' },
      { collection: 'answers', index: 11, field: 'key', problem: 'invalid' },
      { collection: 'answers', index: 12, field: 'key', problem: 'invalid' },
      { collection: 'answers', index: 13, field: 'key', problem: 'invalid' },
      { collection: 'answers', index: 14, field: 'key', problem: 'invalid' },
    ]);
    expect(file.answers[0]!.key).toEqual({ tonic: 'C', scale: 'major' });
    expect(file.sessions[0]).toMatchObject({ missed: [{ key: { tonic: 'C', scale: 'major' } }] });
  });

  it('keeps the facts of a piece and refuses broken ones', () => {
    const facts = { checksum: '0123abcd', bars: { right: 3, left: 2, both: 3 } };
    const file = parsed(
      fileWith({
        version: 2,
        pieces: [
          samplePiece(1, { facts }),
          { ...samplePiece(2), facts: { checksum: 'x', bars: facts.bars } },
        ],
      }),
    );
    expect(file.pieces).toEqual([samplePiece(1, { facts })]);
    expect(file.invalid).toEqual([
      { collection: 'pieces', index: 1, field: 'facts', problem: 'invalid' },
    ]);
  });
});
