import { describe, expect, it } from 'vitest';
import { canonicalText } from '../lib/canonical.ts';
import type { SessionRecord } from './log.ts';
import type { PieceSession } from './pieceRecords.ts';
import {
  buildProfile,
  clip,
  MAX_PROFILE_BYTES,
  NAMED_PROFILE_VERSION,
  normalizeUsername,
  RESERVED_USERNAMES,
  usernameProblem,
  type ProfileInput,
} from './profile.ts';
import type { ScaleSession } from './scaleRecords.ts';
import { tonicsFor } from './scales.ts';
import { EXERCISE_TYPES } from './scaleTypes.ts';
import { isTechnique, techniqueRules } from './technique.ts';
import type { StoredPiece } from './storedPiece.ts';
import { goalMsOn } from './goal.ts';
import { practiceLog } from './streak.ts';

/** The module's own text: it must not come to read the device's daily goal. */
const PROFILE_SOURCE = Object.values(
  import.meta.glob<string>('./profile.ts', { query: '?raw', import: 'default', eager: true }),
)[0]!;

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

const ear = (startedAt: number): SessionRecord => ({
  kind: 'ear',
  id: `e${startedAt}`,
  family: 'interval',
  level: 'I1',
  by: 'play',
  startedAt,
  endedAt: startedAt + 4 * MIN,
  activeMs: 4 * MIN,
  length: 10,
  items: 10,
  correct: 9,
  accuracy: 0.9,
  medianMs: 1200,
  replays: 0,
  missed: [],
});

const read = (startedAt: number, activeMs: number): SessionRecord =>
  ({ ...free(`r${startedAt}`, startedAt, activeMs), kind: 'read' }) as unknown as SessionRecord;

const theory = (startedAt: number): SessionRecord => ({
  kind: 'theory',
  id: `t${startedAt}`,
  family: 'keySignature',
  level: 'KS1',
  by: 'play',
  startedAt,
  endedAt: startedAt + 3 * MIN,
  activeMs: 3 * MIN,
  length: 10,
  cards: 10,
  correct: 10,
  accuracy: 1,
  medianMs: 1500,
  slowest: [],
  missed: [],
});

const rhythm = (startedAt: number): SessionRecord => ({
  kind: 'rhythm',
  id: `rh${startedAt}`,
  level: 'R2',
  bpm: 72,
  startedAt,
  endedAt: startedAt + 4 * MIN,
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
});

const harmony = (startedAt: number): SessionRecord => ({
  kind: 'harmony',
  id: `h${startedAt}`,
  family: 'chordSymbol',
  level: 'H2',
  startedAt,
  endedAt: startedAt + 5 * MIN,
  activeMs: 5 * MIN,
  length: 20,
  cards: 20,
  correct: 18,
  accuracy: 0.9,
  medianMs: 2100,
  slowest: [],
  missed: [],
});

const sight = (startedAt: number): SessionRecord => ({
  kind: 'sight',
  id: `si${startedAt}`,
  level: 'F3',
  startedAt,
  endedAt: startedAt + 3 * MIN,
  activeMs: 3 * MIN,
  length: 4,
  fragments: [
    {
      seed: 7,
      version: 1,
      runs: [
        {
          mode: 'time',
          bpm: 72,
          readAhead: 'off',
          startedAt: startedAt + MIN,
          endedAt: startedAt + 3 * MIN,
          notes: 20,
          inTime: 18,
          early: 1,
          late: 0,
          wrong: 1,
          missed: 0,
          extras: 0,
          medianDeviation: 14,
          tendency: -5,
        },
      ],
    },
  ],
});

const improv = (startedAt: number): SessionRecord => ({
  kind: 'improv',
  id: `im${startedAt}`,
  startedAt,
  endedAt: startedAt + 6 * MIN,
  activeMs: 6 * MIN,
  backing: 'blues',
  key: 'F',
  scale: 'blues',
  pattern: 'shuffle',
  feel: 'swing',
  bpm: 96,
  click: false,
  call: false,
  seed: 1,
  figures: {
    ms: 6 * MIN,
    notes: 2,
    chord: 1,
    scale: 1,
    outside: 0,
    strong: 1,
    strongChord: 1,
    low: 65,
    high: 68,
    playerMs: 6 * MIN,
    soundMs: 1000,
    melody: 2,
    repeated: 0,
    calls: 0,
    answered: 0,
    byBar: [[1, 2], ...Array.from({ length: 11 }, (): [number, number] => [0, 0])],
  },
});

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

/**
 * Two days of everything: every session kind, a titled and a deleted piece, and scale runs of
 * the scales, the arpeggios and the technique (two of Hanon's numbers in C, a chord in two hands).
 */
function richSessions(): SessionRecord[] {
  return [
    free('f', NOW, 3 * MIN),
    read(NOW + 5 * MIN, 2 * MIN),
    ear(NOW + 10 * MIN),
    theory(NOW + 20 * MIN),
    rhythm(NOW + 30 * MIN),
    harmony(NOW + 40 * MIN),
    piece('p1', 'minuet', NOW + 50 * MIN, 4 * MIN),
    piece('p2', 'gone', NOW + 60 * MIN, MIN, 'Deleted piece'),
    scale('s', NOW + 70 * MIN, [
      ['major:D:2:both', 20_000.3],
      ['majorArpeggio:C:2:right', 10_000],
      ['majorChords:F:2:both', 12_000],
      ['majorChords:F:2:right', 5_000],
      ['hanon:C:2:both:5', 30_000],
      ['hanon:C:2:right:12', 8_000],
      ['trill:D:1:right:23-4', 7_000],
      ['minorArpeggio:A:1:left', 15_000],
      ['naturalMinor:A:1:left', 6_000],
      ['chromatic:C:1:right', 4_000],
    ]),
    free('y', NOW - DAY, 6 * MIN),
    scale('y2', NOW - DAY + 10 * MIN, [
      ['major:G:1:right', 10_000],
      ['majorFiveFinger:G:1:right', 9_000],
    ]),
  ];
}
const RICH_PIECES = [stored('minuet', 'Minuet in G')];

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

  // The daily goal is the device's own (docs/PERSONAL.md): the page keeps the service's shades
  // and the streak of five minutes a day, so what is published does not depend on it.
  it('publishes the streak of five minutes a day, whatever goal the device has', () => {
    const sessions = [
      free('a', NOW - 2 * DAY, 6 * MIN),
      free('b', NOW - DAY, 5 * MIN),
      free('c', NOW, 7 * MIN),
    ];
    const document = build({ sessions })!;
    expect(document.streak).toEqual({ current: 3, longest: 3 });
    expect(document.days).toEqual({
      '2026-09-27': 6 * MIN,
      '2026-09-28': 5 * MIN,
      '2026-09-29': 7 * MIN,
    });
    // On a device whose goal is twenty minutes, the same days are no streak in its own log…
    const goal = goalMsOn([['2026-01-01', 20]]);
    expect(practiceLog(sessions, { now: NOW, timeZone: 'UTC', goal })).toMatchObject({
      currentStreak: 0,
      longestStreak: 0,
    });
    // …and the document has nothing to be told the goal with: it is built without it.
    expect(Object.keys(document).sort()).toEqual([
      'days',
      'firstDay',
      'streak',
      'titles',
      'today',
      'totals',
      'v',
      'visibility',
    ]);
    expect(PROFILE_SOURCE).not.toMatch(/goal\.ts|goalOn|dacapo\.goal/);
  });

  it('counts ear training and the cards as reading for a service before version 2', () => {
    const sessions = [
      ear(NOW),
      read(NOW + 10 * MIN, 2 * MIN),
      theory(NOW + 20 * MIN),
      rhythm(NOW + 30 * MIN),
      harmony(NOW + 40 * MIN),
      sight(NOW + 50 * MIN),
    ];
    const document = build({ sessions, settings: { visibility: 'public', titles: false } })!;
    // The theory cards, the rhythm lines and the sight-reading on Read are reading too, and so are
    // the chord symbols of Harmony.
    expect(document.activity!['2026-09-29']!.kinds).toEqual({ read: 21 * MIN });
    expect(document.days['2026-09-29']).toBe(21 * MIN);
    // From version 2, sight-reading under its own name.
    const named = build({
      sessions: [sight(NOW)],
      settings: { visibility: 'public', titles: false },
      profileVersion: NAMED_PROFILE_VERSION,
    })!;
    expect(named.activity!['2026-09-29']!.kinds).toEqual({ sight: 3 * MIN });
  });

  it('counts an improvisation as free play for a service before version 2, by name from it', () => {
    const sessions = [improv(NOW), free('f', NOW + 10 * MIN, 2 * MIN)];
    const settings = { visibility: 'public', titles: false } as const;
    expect(build({ sessions, settings })!.activity!['2026-09-29']!.kinds).toEqual({
      free: 8 * MIN,
    });
    const named = build({ sessions, settings, profileVersion: NAMED_PROFILE_VERSION })!;
    expect(named.activity!['2026-09-29']!.kinds).toEqual({ improv: 6 * MIN, free: 2 * MIN });
    expect(named.days['2026-09-29']).toBe(8 * MIN);
  });

  it('is what it was before version 2 for a service that does not say one', () => {
    const input = {
      sessions: richSessions(),
      pieces: RICH_PIECES,
      settings: { visibility: 'public', titles: true },
    } as const;
    // Serialized as this build's predecessor sent it, byte for byte: an older service accepts it.
    const legacy =
      '{"activity":{"2026-09-28":{"kinds":{"free":360000,"scale":21000},"moreScales":1,"scales":[{"ms":10000,"tonic":"G","type":"major"}]},"2026-09-29":{"kinds":{"free":180000,"piece":300000,"read":1080000,"scale":127000},"moreScales":6,"pieces":[{"ms":240000,"title":"Minuet in G"},{"ms":60000}],"scales":[{"ms":20000,"tonic":"D","type":"major"},{"ms":6000,"tonic":"A","type":"naturalMinor"},{"ms":4000,"tonic":"C","type":"chromatic"}]}},"days":{"2026-09-28":381000,"2026-09-29":1687000},"firstDay":1,"streak":{"current":2,"longest":2},"titles":true,"today":"2026-09-29","totals":{"days":2,"ms":2068000},"v":1,"visibility":"public"}';
    expect(canonicalText(build(input))).toBe(legacy);
    expect(canonicalText(build({ ...input, profileVersion: 1 }))).toBe(legacy);
  });

  it('names every session kind and exercise for a service of version 2', () => {
    const document = build({
      sessions: richSessions(),
      pieces: RICH_PIECES,
      settings: { visibility: 'public', titles: true },
      profileVersion: NAMED_PROFILE_VERSION,
    })!;
    expect(document.v).toBe(1);
    expect(document.activity).toEqual({
      '2026-09-29': {
        kinds: {
          free: 3 * MIN,
          read: 2 * MIN,
          ear: 4 * MIN,
          theory: 3 * MIN,
          rhythm: 4 * MIN,
          harmony: 5 * MIN,
          piece: 5 * MIN,
          scale: 127_000,
        },
        pieces: [{ title: 'Minuet in G', ms: 4 * MIN }, { ms: MIN }],
        // By type and key, whatever the octaves, hands or form: Hanon's Nos. 5 and 12 in C are one.
        scales: [
          { type: 'hanon', tonic: 'C', ms: 38_000 },
          { type: 'major', tonic: 'D', ms: 20_000 },
          { type: 'majorChords', tonic: 'F', ms: 17_000 },
          { type: 'minorArpeggio', tonic: 'A', ms: 15_000 },
          { type: 'majorArpeggio', tonic: 'C', ms: 10_000 },
        ],
        moreScales: 3,
      },
      '2026-09-28': {
        kinds: { free: 6 * MIN, scale: 21_000 },
        scales: [
          { type: 'major', tonic: 'G', ms: 10_000 },
          { type: 'majorFiveFinger', tonic: 'G', ms: 9_000 },
        ],
      },
    });
    // The grid, the streaks and the totals do not depend on the version.
    const legacy = build({
      sessions: richSessions(),
      pieces: RICH_PIECES,
      settings: { visibility: 'public', titles: true },
    })!;
    expect({ ...document, activity: undefined }).toEqual({ ...legacy, activity: undefined });
    // A later service still names them.
    expect(
      build({
        sessions: richSessions(),
        pieces: RICH_PIECES,
        settings: { visibility: 'public', titles: true },
        profileVersion: 3,
      }),
    ).toEqual(document);
  });

  it('publishes only names the service of version 2 takes', () => {
    // The service's shapes (dacapo-cloud's src/profile.ts): a kind, a type, a tonic.
    const KIND = /^[a-z]{1,16}$/;
    const TYPE = /^[a-zA-Z]{1,32}$/;
    const TONIC = /^[A-G](?:#|b)?$/;
    // Every session kind: the compiler checks that the list is whole.
    const kinds = {
      read: true,
      free: true,
      piece: true,
      scale: true,
      ear: true,
      theory: true,
      rhythm: true,
      harmony: true,
      sight: true,
      improv: true,
    } satisfies Record<SessionRecord['kind'], true>;
    // At most 16 a day.
    expect(Object.keys(kinds).length).toBeLessThanOrEqual(16);
    for (const kind of Object.keys(kinds)) expect(kind).toMatch(KIND);
    for (const type of EXERCISE_TYPES) {
      expect(type).toMatch(TYPE);
      const variants = isTechnique(type) ? techniqueRules(type).variants : [];
      for (const variant of variants.length > 0 ? variants : [undefined]) {
        for (const tonic of tonicsFor(type, variant))
          expect(tonic, `${type} ${variant}`).toMatch(TONIC);
      }
    }
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

  it('counts arpeggios without naming them for a service before version 2', () => {
    const sessions: SessionRecord[] = [
      scale('s', NOW, [
        ['majorArpeggio:C:2:right', 20_000],
        ['major:G:1:right', 10_000],
        ['minorArpeggio:A:1:left', 15_000],
      ]),
    ];
    const day = build({ sessions, settings: { visibility: 'public', titles: false } })!.activity![
      '2026-09-29'
    ]!;
    expect(day.scales).toEqual([{ type: 'major', tonic: 'G', ms: 10_000 }]);
    expect(day.moreScales).toBe(2);
    const onlyArpeggios = build({
      sessions: [scale('a', NOW, [['majorArpeggio:C:2:right', 20_000]])],
      settings: { visibility: 'public', titles: false },
    })!.activity!['2026-09-29']!;
    expect(onlyArpeggios.scales).toBeUndefined();
    expect(onlyArpeggios.moreScales).toBe(1);
  });

  it('names only the scales for a service before version 2, and counts the other exercises', () => {
    const sessions: SessionRecord[] = [
      scale('s', NOW, [
        ['major:D:2:both', 20_000],
        ['majorArpeggio:C:2:right', 10_000],
        ['majorChords:F:2:both', 12_000],
        ['majorChords:F:2:right', 5_000],
      ]),
    ];
    const day = build({ sessions, settings: { visibility: 'public', titles: false } })!.activity![
      '2026-09-29'
    ]!;
    expect(day.kinds.scale).toBe(sessions[0]!.activeMs);
    expect(day.scales).toEqual([{ type: 'major', tonic: 'D', ms: 20_000 }]);
    // The arpeggio and the F major chords (one exercise whatever the hands).
    expect(day.moreScales).toBe(2);
    const only = build({
      sessions: [scale('t', NOW, [['majorFiveFinger:G:1:right', 9_000]])],
      settings: { visibility: 'public', titles: false },
    })!.activity!['2026-09-29']!;
    expect(only.scales).toBeUndefined();
    expect(only.moreScales).toBe(1);
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

  it('counts a progression of the Harmony page as a piece without a title', () => {
    const sessions = [piece('r1', 'prog:I-IV-V-I:C:alberti', NOW, 2 * MIN, 'I–IV–V–I in C major')];
    for (const profileVersion of [1, NAMED_PROFILE_VERSION]) {
      const day = build({
        sessions,
        settings: { visibility: 'public', titles: true },
        profileVersion,
      })!.activity!['2026-09-29']!;
      expect(day.kinds).toEqual({ piece: 2 * MIN });
      expect(day.pieces).toEqual([{ ms: 2 * MIN }]);
    }
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

  it('are never the site’s own addresses, nor the ones kept for later (docs/SITE.md)', () => {
    for (const name of ['learn', 'pieces', 'zh-cn', 'zh-tw', 'start', 'sitemap']) {
      expect(usernameProblem(name), name).toBe('unavailable');
    }
    // Too short to be a username at all, and kept all the same.
    expect(RESERVED_USERNAMES.has('en')).toBe(true);
    expect(usernameProblem('learner')).toBeNull();
    expect(usernameProblem('zh-cnn')).toBeNull();
  });
});
