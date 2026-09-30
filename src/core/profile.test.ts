import { describe, expect, it } from 'vitest';
import { canonicalText } from '../lib/canonical.ts';
import type { SessionRecord } from './log.ts';
import type { PieceSession } from './pieceRecords.ts';
import {
  buildProfile,
  clip,
  MAX_PROFILE_BYTES,
  normalizeUsername,
  usernameProblem,
  type ProfileInput,
} from './profile.ts';
import type { ScaleSession } from './scaleRecords.ts';
import type { StoredPiece } from './storedPiece.ts';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
/** 2026-09-29, 10:00 UTC. */
const NOW = Date.UTC(2026, 8, 29, 10);

const free = (id: string, startedAt: number, activeMs: number): SessionRecord => ({
  kind: 'free',
  id,
  startedAt,
  endedAt: startedAt + activeMs,
  activeMs,
  notes: 10,
});

const piece = (
  id: string,
  pieceId: string,
  startedAt: number,
  activeMs: number,
  title = `Title of ${pieceId}`,
): PieceSession => ({
  kind: 'piece',
  id,
  pieceId,
  title,
  hands: 'right',
  loop: null,
  repeats: 'play',
  tempo: 100,
  startedAt,
  endedAt: startedAt + activeMs,
  activeMs,
  steps: 10,
  wrong: 1,
  completed: true,
});

const scale = (id: string, startedAt: number, runs: [string, number][]): ScaleSession => {
  let at = startedAt;
  const summaries = runs.map(([exercise, ms], n) => {
    const run = {
      id: `${id}:${n}`,
      exercise,
      startedAt: at,
      endedAt: at + ms,
      headline: {} as ScaleSession['runs'][number]['headline'],
    };
    at += ms + 1000;
    return run;
  });
  return {
    kind: 'scale',
    id,
    startedAt,
    endedAt: at,
    activeMs: at - startedAt,
    runs: summaries,
  };
};

const stored = (id: string, title: string, fileName = `${id}.musicxml`) =>
  ({ id, title, fileName }) as StoredPiece;
/** The stored pieces of `sessions`, titled as when practised. */
const storedFor = (sessions: readonly SessionRecord[]) =>
  sessions.flatMap((s) => (s.kind === 'piece' ? [stored(s.pieceId, s.title)] : []));

function build(patch: Partial<ProfileInput>) {
  return buildProfile({
    sessions: [],
    pieces: [],
    settings: { visibility: 'private', titles: false },
    now: NOW,
    firstDay: 1,
    timeZone: 'UTC',
    ...patch,
  });
}

describe('buildProfile', () => {
  it('publishes nothing when the profile is off', () => {
    expect(build({ settings: { visibility: 'off', titles: true } })).toBeNull();
  });

  it('keeps the grid, streaks and totals, and no activity, when private', () => {
    const sessions = [
      free('a', NOW - 2 * DAY, 6 * MIN),
      free('b', NOW - DAY, 5 * MIN),
      free('c', NOW, 2 * MIN),
      // Before the grid: counted in the totals and the longest streak only.
      free('old', NOW - 400 * DAY, 30 * MIN),
    ];
    const document = build({
      sessions,
      settings: { visibility: 'private', titles: true },
    })!;
    expect(document).toEqual({
      v: 1,
      visibility: 'private',
      titles: false,
      today: '2026-09-29',
      firstDay: 1,
      days: { '2026-09-27': 6 * MIN, '2026-09-28': 5 * MIN, '2026-09-29': 2 * MIN },
      streak: { current: 2, longest: 2 },
      totals: { days: 4, ms: 43 * MIN },
    });
    expect(document).not.toHaveProperty('activity');
  });

  it('counts ear training as reading, the only day kind the service knows for it', () => {
    const ear = {
      kind: 'ear',
      id: 'e',
      family: 'interval',
      level: 'I1',
      by: 'play',
      startedAt: NOW,
      endedAt: NOW + 4 * MIN,
      activeMs: 4 * MIN,
      length: 10,
      items: 10,
      correct: 9,
      accuracy: 0.9,
      medianMs: 1200,
      replays: 0,
      missed: [],
    } satisfies SessionRecord;
    const read = {
      ...free('r', NOW + 10 * MIN, 2 * MIN),
      kind: 'read',
    } as unknown as SessionRecord;
    const theory = {
      kind: 'theory',
      id: 't',
      family: 'keySignature',
      level: 'KS1',
      by: 'play',
      startedAt: NOW + 20 * MIN,
      endedAt: NOW + 23 * MIN,
      activeMs: 3 * MIN,
      length: 10,
      cards: 10,
      correct: 10,
      accuracy: 1,
      medianMs: 1500,
      slowest: [],
      missed: [],
    } satisfies SessionRecord;
    const rhythm = {
      kind: 'rhythm',
      id: 'rh',
      level: 'R2',
      bpm: 72,
      startedAt: NOW + 30 * MIN,
      endedAt: NOW + 34 * MIN,
      activeMs: 4 * MIN,
      length: 8,
      exercises: 8,
      runs: 9,
      cells: 90,
      correct: 80,
      accuracy: 80 / 90,
      medianDeviation: 21,
      tendency: -6,
      missed: [{ item: 'rhythm:er-e:3/4', count: 4 }],
    } satisfies SessionRecord;
    const document = build({
      sessions: [ear, read, theory, rhythm],
      settings: { visibility: 'public', titles: false },
    })!;
    // The theory cards and the rhythm lines on Read are reading too.
    expect(document.activity!['2026-09-29']!.kinds).toEqual({ read: 13 * MIN });
    expect(document.days['2026-09-29']).toBe(13 * MIN);
  });

  it('starts the grid on the first day of its first week', () => {
    // 2026-09-29 is a Tuesday: with weeks from Monday, the grid starts on Monday 2025-09-29.
    const first = Date.UTC(2025, 8, 29, 10);
    const sessions = [free('in', first, MIN), free('out', first - DAY, MIN)];
    expect(Object.keys(build({ sessions })!.days)).toEqual(['2025-09-29']);
    // From Sunday, on Sunday 2025-09-28.
    expect(Object.keys(build({ sessions, firstDay: 7 })!.days)).toEqual([
      '2025-09-28',
      '2025-09-29',
    ]);
  });

  it('lists what was practised each day when public', () => {
    const sessions: SessionRecord[] = [
      free('f', NOW, 3 * MIN),
      piece('p1', 'minuet', NOW + MIN, 4 * MIN),
      piece('p2', 'minuet', NOW + 10 * MIN, 2 * MIN),
      piece('p3', 'gone', NOW + 20 * MIN, MIN, 'Deleted piece'),
      scale('s', NOW + 30 * MIN, [
        ['major:D:2:both', 20_000],
        ['major:D:1:right', 10_000],
        ['naturalMinor:A:1:left', 15_000],
      ]),
    ];
    const pieces = [stored('minuet', 'Minuet in G')];
    const withTitles = build({
      sessions,
      pieces,
      settings: { visibility: 'public', titles: true },
    })!;
    const scaleMs = sessions[4]!.activeMs;
    expect(withTitles.activity).toEqual({
      '2026-09-29': {
        kinds: { free: 3 * MIN, piece: 7 * MIN, scale: scaleMs },
        // A deleted piece is "a piece": its title is no longer the owner's to publish.
        pieces: [{ title: 'Minuet in G', ms: 6 * MIN }, { ms: MIN }],
        scales: [
          { type: 'major', tonic: 'D', ms: 30_000 },
          { type: 'naturalMinor', tonic: 'A', ms: 15_000 },
        ],
      },
    });

    const withoutTitles = build({
      sessions,
      pieces,
      settings: { visibility: 'public', titles: false },
    })!;
    expect(withoutTitles.titles).toBe(false);
    expect(withoutTitles.activity!['2026-09-29']!.pieces).toEqual([{ ms: 6 * MIN }, { ms: MIN }]);
  });

  it('publishes whole milliseconds, though scale runs are timed to fractions of one', () => {
    const sessions: SessionRecord[] = [
      scale('s', NOW + 0.5, [
        ['major:D:2:both', 20_000.3],
        ['major:G:1:right', 10_000.4],
      ]),
      free('f', NOW - DAY, MIN),
    ];
    for (const visibility of ['private', 'public'] as const) {
      const document = build({ sessions, settings: { visibility, titles: false } })!;
      const numbers = (value: unknown): number[] =>
        typeof value === 'number'
          ? [value]
          : typeof value === 'object' && value !== null
            ? Object.values(value).flatMap(numbers)
            : [];
      expect(numbers(document).every(Number.isSafeInteger)).toBe(true);
    }
  });

  it('never publishes a title made from the file name', () => {
    const sessions = [piece('r1', 'p1', NOW, 2 * MIN), piece('r2', 'p2', NOW + MIN, MIN)];
    const pieces = [
      stored('p1', 'Anna lesson 3', 'Anna_lesson_3.musicxml'),
      stored('p2', 'Gymnopédie No. 1', 'Anna_lesson_4.mxl'),
    ];
    const day = build({ sessions, pieces, settings: { visibility: 'public', titles: true } })!
      .activity!['2026-09-29']!;
    expect(day.pieces).toEqual([{ ms: 2 * MIN }, { title: 'Gymnopédie No. 1', ms: MIN }]);
  });

  it('lists the five longest pieces and counts the rest', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      piece(`r${i}`, `p${i}`, NOW + i * 10 * MIN, (i + 1) * MIN),
    );
    const day = build({
      sessions,
      pieces: storedFor(sessions),
      settings: { visibility: 'public', titles: true },
    })!.activity!['2026-09-29']!;
    expect(day.pieces!.map((p) => p.title)).toEqual([
      'Title of p6',
      'Title of p5',
      'Title of p4',
      'Title of p3',
      'Title of p2',
    ]);
    expect(day.morePieces).toBe(2);
  });

  it('cuts long titles and leaves out empty ones', () => {
    const long = 'é'.repeat(100);
    const sessions = [piece('r1', 'p1', NOW, MIN, long), piece('r2', 'p2', NOW + MIN, MIN, '  ')];
    const day = build({
      sessions,
      pieces: storedFor(sessions),
      settings: { visibility: 'public', titles: true },
    })!.activity!['2026-09-29']!;
    expect(day.pieces![0]).toEqual({ title: `${'é'.repeat(79)}…`, ms: MIN });
    expect(day.pieces![1]).toEqual({ ms: MIN });
    expect(clip('short')).toBe('short');
    expect(Array.from(clip('😀'.repeat(81)))).toHaveLength(80);
  });

  it('serializes the same whatever the order of the records', () => {
    const sessions = [free('a', NOW - DAY, MIN), piece('p', 'x', NOW, MIN)];
    const settings = { visibility: 'public', titles: true } as const;
    expect(canonicalText(build({ sessions, settings }))).toBe(
      JSON.stringify(build({ sessions: [...sessions].reverse(), settings })),
    );
  });

  it('leaves out the oldest days’ activity when the document is too large', () => {
    // Long titles, three bytes a character, every day for a year: over the limit with all of them.
    const sessions = Array.from({ length: 360 }, (_, d) =>
      Array.from({ length: 6 }, (_, i) =>
        piece(
          `r${d}-${i}`,
          `p${d}-${i}`,
          NOW - d * DAY + i * MIN,
          MIN,
          `${d}-${i} ${'音'.repeat(120)}`,
        ),
      ),
    ).flat();
    const document = build({
      sessions,
      pieces: storedFor(sessions),
      settings: { visibility: 'public', titles: true },
    })!;
    expect(new TextEncoder().encode(JSON.stringify(document)).byteLength).toBeLessThanOrEqual(
      MAX_PROFILE_BYTES,
    );
    const dates = Object.keys(document.activity!);
    expect(dates.length).toBeLessThan(Object.keys(document.days).length);
    expect(dates.length).toBeGreaterThan(0);
    // The newest days keep theirs.
    expect(dates).toContain('2026-09-29');
    expect(Object.keys(document.days)[0]! < dates[0]!).toBe(true);
  });
});

describe('usernames', () => {
  it('are stored trimmed and lower-cased', () => {
    expect(normalizeUsername('  Clara-Schumann ')).toBe('clara-schumann');
  });

  it('follow the rules', () => {
    expect(usernameProblem('clara')).toBeNull();
    expect(usernameProblem('c-3po')).toBeNull();
    expect(usernameProblem('abc')).toBeNull();
    expect(usernameProblem('a'.repeat(30))).toBeNull();
    expect(usernameProblem('ab')).toBe('length');
    expect(usernameProblem('a'.repeat(31))).toBe('length');
    expect(usernameProblem('clara_s')).toBe('characters');
    expect(usernameProblem('Clara')).toBe('characters');
    expect(usernameProblem('-clara')).toBe('edges');
    expect(usernameProblem('clara-')).toBe('edges');
    expect(usernameProblem('clara--s')).toBe('hyphens');
    expect(usernameProblem('privacy')).toBe('unavailable');
    expect(usernameProblem('playdacapo')).toBe('unavailable');
  });
});
