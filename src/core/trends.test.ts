import { describe, expect, it } from 'vitest';
import type { Answer } from './answers.ts';
import type { EarAnswer } from './earSession.ts';
import type { ChordSymbolAnswer } from './harmonySession.ts';
import type { SessionRecord } from './log.ts';
import type { PieceStep } from './pieceRecords.ts';
import type { RhythmEarChoiceAnswer, RhythmEarTapAnswer } from './rhythmEar.ts';
import type { RhythmAnswer } from './rhythmRead.ts';
import type { ScaleSession } from './scaleRecords.ts';
import type { Attempt } from './session.ts';
import type { SightSessionSummary, TimeRunFigures } from './sightRead.ts';
import { addDays, type DayKey } from './streak.ts';
import type { TheoryAnswer } from './theorySession.ts';
import {
  chordObservations,
  COMPARE_WEEKS,
  createDayOf,
  earliestInstant,
  earObservations,
  pieceStepObservations,
  readingObservations,
  rhythmEarObservations,
  rhythmLineObservations,
  scaleObservations,
  sightObservations,
  theoryObservations,
  trendOf,
  trends,
  trendWeekStarts,
  TREND_RULES,
  TREND_WEEKS,
  verdictOf,
  weekStart,
  type Observation,
  type TrendOptions,
} from './trends.ts';

const TODAY = '2026-10-01'; // a Thursday
const UTC: TrendOptions = { today: TODAY, firstDay: 7, dayOf: createDayOf('UTC') };

const noon = (day: DayKey, hour = 12) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d, hour);
};

/** The `i`th week shown (0 the oldest, 25 the week under way), on its Monday. */
const weekDay = (i: number) => addDays(trendWeekStarts(TODAY, 7)[i]!, 1);

/** `n` observations in week `i`, all of `value` (and `level`, `run` when given). */
function week(
  i: number,
  n: number,
  value: number | ((k: number) => number),
  extra: Partial<Observation> = {},
): Observation[] {
  return Array.from({ length: n }, (_, k) => ({
    at: noon(weekDay(i)) + k * 60_000,
    value: typeof value === 'number' ? value : value(k),
    ...extra,
  }));
}

describe('weeks', () => {
  it('start on the owner’s first day, as the year grid has them', () => {
    expect(weekStart(TODAY, 7)).toBe('2026-09-27'); // Sunday
    expect(weekStart(TODAY, 1)).toBe('2026-09-28'); // Monday
    expect(weekStart('2026-09-27', 1)).toBe('2026-09-21');
    const starts = trendWeekStarts(TODAY, 7);
    expect(starts).toHaveLength(TREND_WEEKS);
    expect(starts.at(-1)).toBe('2026-09-27');
    expect(starts[0]).toBe(addDays('2026-09-27', -7 * 25));
  });

  it('put a Sunday in the week it starts or in the one it ends, as the owner’s week goes', () => {
    const sunday = [{ at: noon('2026-09-27'), value: 1 }];
    const sundayFirst = trendOf('reading', sunday, UTC).weeks;
    const mondayFirst = trendOf('reading', sunday, { ...UTC, firstDay: 1 }).weeks;
    expect(sundayFirst.findIndex((w) => w.count > 0)).toBe(25);
    expect(mondayFirst.findIndex((w) => w.count > 0)).toBe(24);
  });

  it('take the local date of each record', () => {
    // 20:00 UTC on Saturday is Sunday morning in Shanghai: the next week there.
    const late = [{ at: noon('2026-09-26', 20), value: 1 }];
    const utc = trendOf('reading', late, UTC).weeks;
    const shanghai = trendOf('reading', late, { ...UTC, dayOf: createDayOf('Asia/Shanghai') });
    expect(utc.findIndex((w) => w.count > 0)).toBe(24);
    expect(shanghai.weeks.findIndex((w) => w.count > 0)).toBe(25);
  });

  it('leave out records before the first week and after today', () => {
    const first = trendWeekStarts(TODAY, 7)[0]!;
    const observations = [
      { at: noon(addDays(first, -1)), value: 1 },
      { at: noon(first), value: 1 },
      { at: noon(addDays(TODAY, 1)), value: 1 },
    ];
    const trend = trendOf('reading', observations, UTC);
    expect(trend.weeks.reduce((sum, w) => sum + w.count, 0)).toBe(1);
    expect(trend.weeks[0]!.count).toBe(1);
  });

  it('remember the date per quarter hour, in every zone', () => {
    const dayOf = createDayOf('Asia/Kathmandu'); // UTC+5:45
    // 18:14 UTC is 23:59 there; 18:15 is midnight.
    expect(dayOf(Date.UTC(2026, 8, 30, 18, 14))).toBe('2026-09-30');
    expect(dayOf(Date.UTC(2026, 8, 30, 18, 15))).toBe('2026-10-01');
    expect(dayOf(Date.UTC(2026, 8, 30, 18, 14, 59))).toBe('2026-09-30');
  });

  it('never start after any instant of the first day', () => {
    const first = '2026-04-05';
    // Midnight on the first day at UTC+14 (Kiribati) is still within the window.
    expect(earliestInstant(first)).toBeLessThanOrEqual(Date.UTC(2026, 3, 4, 10));
  });
});

describe('counting a week', () => {
  it('needs 20 answers for reading, theory, ear and chord symbols', () => {
    const trend = trendOf('theory', [...week(10, 19, 1), ...week(11, 20, 1)], UTC);
    expect(trend.weeks[10]).toMatchObject({ count: 19, counted: false, value: 1 });
    expect(trend.weeks[11]).toMatchObject({ count: 20, counted: true });
    for (const p of ['reading', 'theory', 'ear', 'chords'] as const) {
      expect(TREND_RULES[p].minimum).toBe(20);
    }
  });

  it('needs 50 timed notes for in time', () => {
    const trend = trendOf('inTime', [...week(3, 49, 20), ...week(4, 50, 20)], UTC);
    expect(trend.weeks.slice(3, 5).map((w) => w.counted)).toEqual([false, true]);
  });

  it('counts runs, not steps, for pieces and scales', () => {
    // Two runs of 100 steps are 2 runs: not a week; three runs of 2 steps are.
    const two = [...week(5, 100, 1, { run: 'a' }), ...week(5, 100, 1, { run: 'b' })];
    const three = ['c', 'd', 'e'].flatMap((run) => week(6, 2, 1, { run }));
    const trend = trendOf('pieces', [...two, ...three], UTC);
    expect(trend.weeks[5]).toMatchObject({ count: 2, counted: false });
    expect(trend.weeks[6]).toMatchObject({ count: 3, counted: true });
  });

  it('shows a chart from 3 counted weeks, and says how far this week is', () => {
    const two = trendOf('ear', [...week(1, 20, 1), ...week(2, 20, 1), ...week(25, 7, 1)], UTC);
    expect(two).toMatchObject({ counted: 2, shown: false, thisWeek: 7, any: true });
    expect(two.comparison).toBeNull();
    const three = trendOf('ear', [...week(1, 20, 1), ...week(2, 20, 1), ...week(25, 20, 1)], UTC);
    expect(three).toMatchObject({ counted: 3, shown: true, thisWeek: 20 });
    expect(trendOf('ear', [], UTC)).toMatchObject({ any: false, shown: false, counted: 0 });
  });
});

describe('the week’s figure', () => {
  it('is the median for times, distances and spreads', () => {
    const trend = trendOf(
      'reading',
      week(8, 21, (k) => 1000 + k * 100),
      UTC,
    );
    expect(trend.weeks[8]!.value).toBe(2000);
  });

  it('is the share of 1s for shares', () => {
    const trend = trendOf(
      'ear',
      week(8, 20, (k) => (k < 15 ? 1 : 0)),
      UTC,
    );
    expect(trend.weeks[8]!.value).toBe(0.75);
  });

  it('lists the levels of each week, most first, and their share over the counted weeks', () => {
    const observations = [
      ...week(20, 15, 1000, { level: 'L2' }),
      ...week(20, 5, 1000, { level: 'L1' }),
      ...week(21, 20, 1000, { level: 'L3' }),
      // Not counted: left out of the shares.
      ...week(22, 10, 1000, { level: 'L4' }),
    ];
    const trend = trendOf('reading', observations, UTC);
    expect(trend.weeks[20]!.levels).toEqual([
      { level: 'L2', count: 15 },
      { level: 'L1', count: 5 },
    ]);
    expect(trend.levels).toEqual([
      { level: 'L3', share: 0.5 },
      { level: 'L2', share: 0.375 },
      { level: 'L1', share: 0.125 },
    ]);
    expect(trendOf('pieces', week(20, 3, 1, { run: 'a' }), UTC).levels).toBeNull();
  });
});

describe('the comparison', () => {
  const RECENT = 26 - COMPARE_WEEKS; // weeks 22–25
  const EARLIER = 26 - 2 * COMPARE_WEEKS; // weeks 18–21

  it('pools each period over its records and says which is better', () => {
    const observations = [
      ...week(10, 40, 2000, { level: 'L1' }),
      ...week(EARLIER, 40, 1700, { level: 'L1' }),
      ...week(RECENT + 1, 20, 1400, { level: 'L1' }),
    ];
    const trend = trendOf('reading', observations, UTC);
    expect(trend.comparison).toEqual({
      verdict: 'better',
      recent: 1400,
      earlier: 1700,
      levels: ['L1'],
      leftOut: [],
    });
  });

  it('includes the week under way in the last four', () => {
    const observations = [...week(10, 50, 30), ...week(EARLIER + 3, 60, 30), ...week(25, 60, 40)];
    const trend = trendOf('inTime', observations, UTC);
    expect(trend.comparison).toMatchObject({ verdict: 'worse', recent: 40, earlier: 30 });
  });

  it('calls a time or a spread about the same within 5 % of the earlier one', () => {
    const time = TREND_RULES.reading;
    expect(verdictOf(time, 1050, 1000)).toBe('same');
    expect(verdictOf(time, 950, 1000)).toBe('same');
    expect(verdictOf(time, 1051, 1000)).toBe('worse');
    expect(verdictOf(time, 949, 1000)).toBe('better');
    const spread = TREND_RULES.scales;
    expect(verdictOf(spread, 8.4, 8)).toBe('same');
    expect(verdictOf(spread, 7.5, 8)).toBe('better');
    expect(verdictOf(TREND_RULES.inTime, 0, 0)).toBe('same');
  });

  it('calls a share about the same within 2 percentage points', () => {
    // 87 % → 91 % is 4 points: a real change near 90 %, though under 5 % of the figure.
    for (const practice of ['theory', 'sight', 'ear', 'rhythmEar', 'chords', 'pieces'] as const) {
      const share = TREND_RULES[practice];
      expect(verdictOf(share, 0.91, 0.87), practice).toBe('better');
      expect(verdictOf(share, 0.83, 0.87), practice).toBe('worse');
      expect(verdictOf(share, 0.89, 0.87), practice).toBe('same');
      expect(verdictOf(share, 0.85, 0.87), practice).toBe('same');
    }
    expect(verdictOf(TREND_RULES.ear, 0.3, 0.27)).toBe('better');
    expect(verdictOf(TREND_RULES.ear, 0, 0)).toBe('same');
  });

  it('needs a counted week in each period', () => {
    const observations = [
      ...week(2, 20, 1),
      ...week(3, 20, 1),
      ...week(EARLIER, 19, 1),
      ...week(RECENT, 20, 1),
    ];
    const trend = trendOf('theory', observations, UTC);
    expect(trend.shown).toBe(true);
    expect(trend.comparison).toBeNull();
    expect(trend.noComparison).toBe('few');
  });

  it('compares within the levels both periods have, so a harder level is not a slower reader', () => {
    // L1 at 1 s and L3 at 2 s throughout; the player moved from mostly L1 to mostly L3. Pooled,
    // the median went from 1 s to 2 s; level for level nothing changed.
    const observations = [
      ...week(2, 20, 1000, { level: 'L1' }),
      ...week(EARLIER, 36, 1000, { level: 'L1' }),
      ...week(EARLIER, 6, 2000, { level: 'L3' }),
      ...week(RECENT, 6, 1000, { level: 'L1' }),
      ...week(RECENT, 36, 2000, { level: 'L3' }),
    ];
    const trend = trendOf('reading', observations, UTC);
    expect(trend.comparison).toMatchObject({ verdict: 'same', levels: ['L1', 'L3'], leftOut: [] });
    expect(trend.comparison!.recent).toBeCloseTo(trend.comparison!.earlier);
    // The two levels weigh by their answers in both periods: 42 each.
    expect(trend.comparison!.recent).toBeCloseTo(1500);
  });

  it('leaves out a level one period has too little of, and says so', () => {
    const observations = [
      ...week(2, 20, 0.5, { level: 'I1' }),
      ...week(EARLIER, 30, (k) => (k < 21 ? 1 : 0), { level: 'I1' }),
      ...week(EARLIER, 4, 0, { level: 'I2' }),
      ...week(RECENT, 30, (k) => (k < 27 ? 1 : 0), { level: 'I1' }),
      ...week(RECENT, 30, 0, { level: 'I2' }),
      ...week(RECENT, 8, 1, { level: 'I3' }),
    ];
    const trend = trendOf('ear', observations, UTC);
    expect(trend.comparison).toMatchObject({
      verdict: 'better',
      levels: ['I1'],
      leftOut: ['I2', 'I3'],
    });
    expect(trend.comparison!.recent).toBeCloseTo(0.9);
    expect(trend.comparison!.earlier).toBeCloseTo(0.7);
  });

  it('has none when no level is shared enough', () => {
    const observations = [
      ...week(2, 20, 1, { level: 'KS1' }),
      ...week(EARLIER, 30, 1, { level: 'KS1' }),
      ...week(RECENT, 30, 1, { level: 'KS2' }),
      ...week(RECENT, 4, 1, { level: 'KS1' }),
    ];
    const trend = trendOf('theory', observations, UTC);
    expect(trend.comparison).toBeNull();
    expect(trend.noComparison).toBe('levels');
  });

  it('counts levels in runs for sight-reading: two fragments of a level in each period', () => {
    const runs = (i: number, ids: string[], level: string, inTime: number) =>
      ids.flatMap((run) => week(i, 10, (k) => (k < inTime ? 1 : 0), { level, run }));
    const observations = [
      ...runs(2, ['a', 'b', 'c'], 'F2', 7),
      ...runs(EARLIER, ['d', 'e', 'k'], 'F2', 7),
      ...runs(EARLIER, ['f'], 'F3', 5),
      ...runs(RECENT, ['g', 'h', 'l'], 'F2', 9),
      ...runs(RECENT, ['i', 'j'], 'F3', 6),
    ];
    const trend = trendOf('sight', observations, UTC);
    // F3 has one fragment before: left out, however many notes it had. F2's three runs
    // in each period are a week's worth.
    expect(trend.comparison).toMatchObject({ verdict: 'better', levels: ['F2'], leftOut: ['F3'] });
    expect(trend.comparison!.recent).toBeCloseTo(0.9);
    expect(trend.weeks[RECENT]!.levels).toEqual([
      { level: 'F2', count: 3 },
      { level: 'F3', count: 2 },
    ]);
  });

  it('needs a week’s worth of answers within the shared levels', () => {
    const observations = [
      ...week(2, 20, 1, { level: 'RI1' }),
      ...week(EARLIER, 25, 1, { level: 'RI1' }),
      ...week(RECENT, 12, 1, { level: 'RI1' }),
      ...week(RECENT, 20, 1, { level: 'RI2' }),
    ];
    expect(trendOf('theory', observations, UTC).noComparison).toBe('levels');
  });
});

// --- The records ---------------------------------------------------------------------------

const attempt = (i: number, patch: Partial<Attempt>): Attempt => ({
  id: `a${i}`,
  sessionId: 's',
  level: 'L1',
  note: 'C4@treble',
  target: 60,
  played: 60,
  correct: true,
  ms: 1000,
  hinted: false,
  timedOut: false,
  at: noon(weekDay(25)) + i,
  ...patch,
});

describe('observations from the records', () => {
  it('reading: the times of right, un-hinted, timely answers, with their level', () => {
    const attempts = [
      attempt(1, { ms: 900, level: 'L3' }),
      attempt(2, { correct: false, played: 61 }),
      attempt(3, { hinted: true }),
      attempt(4, { ms: 31_000, timedOut: true }),
    ];
    expect(readingObservations(attempts)).toEqual([
      { at: attempts[0]!.at, value: 900, level: 'L3' },
    ]);
  });

  const base = { sessionId: 's', at: 1000, ms: 2000 };
  const ear = (correct: boolean, replays: number): EarAnswer => ({
    ...base,
    id: `e${correct}${replays}`,
    family: 'interval',
    level: 'I2',
    item: 'int:P5:up',
    by: 'name',
    prompt: [60, 67],
    answer: 'P5',
    correct,
    replays,
  });
  const theory: TheoryAnswer = {
    ...base,
    id: 't',
    family: 'keySignature',
    level: 'KS1',
    item: 'ks:1s:major',
    by: 'play',
    prompt: '1s',
    answer: [67],
    correct: true,
    hinted: true,
  };
  const symbol: ChordSymbolAnswer = {
    ...base,
    id: 'c',
    family: 'chordSymbol',
    level: 'H1',
    item: 'sym:C',
    by: 'play',
    prompt: 'C',
    answer: [60, 64, 67],
    correct: false,
    hinted: false,
  };
  const rhythm: RhythmAnswer = {
    id: 'r',
    sessionId: 's',
    family: 'rhythm',
    level: 'R1',
    item: 'rhythm:q:4/4',
    prompt: [[0, 1]],
    answer: { deviations: [[-12, null], [30]], extras: 0 },
    correct: false,
    bpm: 80,
    exercise: 0,
    run: 0,
    at: 5000,
  };
  const tapped: RhythmEarTapAnswer = {
    id: 'd1',
    sessionId: 'd',
    family: 'rhythmEar',
    level: 'R3',
    item: 'rhythmEar:ee:4/4',
    by: 'play',
    bpm: 72,
    question: 0,
    replays: 0,
    prompt: [0, 0.5],
    answer: { deviations: [-20, null], extras: [] },
    correct: false,
    at: 6000,
  };
  const chosen: RhythmEarChoiceAnswer = {
    id: 'd2',
    sessionId: 'd',
    family: 'rhythmEar',
    level: 'R2',
    item: 'rhythmEar:ee:4/4',
    by: 'name',
    bpm: 72,
    question: 1,
    replays: 1,
    prompt: ['q', 'ee', 'h'],
    answer: ['q', 'ee', 'h'],
    correct: true,
    ms: 1500,
    at: 7000,
  };
  const answers: Answer[] = [
    ear(true, 0),
    ear(true, 1),
    ear(false, 0),
    theory,
    symbol,
    rhythm,
    tapped,
    chosen,
  ];

  it('ear: right only without a replay; theory and chord symbols: right, hint or not', () => {
    expect(earObservations(answers).map((o) => o.value)).toEqual([1, 0, 0]);
    expect(earObservations(answers)[0]).toMatchObject({ level: 'I2', at: 1000 });
    expect(theoryObservations(answers)).toEqual([{ at: 1000, value: 1, level: 'KS1' }]);
    expect(chordObservations(answers)).toEqual([{ at: 1000, value: 0, level: 'H1' }]);
  });

  it('rhythm lines and dictation tapped back: how far each onset was from the beat', () => {
    // Missed onsets say nothing; a bar chosen has no timing.
    expect(rhythmLineObservations(answers)).toEqual([
      { at: 5000, value: 12 },
      { at: 5000, value: 30 },
      { at: 6000, value: 20 },
    ]);
  });

  it('rhythm dictation: right without a replay, tapped or chosen, by level', () => {
    expect(rhythmEarObservations(answers)).toEqual([
      { at: 6000, value: 0, level: 'R3' },
      { at: 7000, value: 0, level: 'R2' },
    ]);
    // Never taken for Ear's own answers.
    expect(earObservations(answers)).toHaveLength(3);
  });

  it('sight-reading: the notes of each fragment’s first run in time, by run and level', () => {
    const time = (startedAt: number, notes: number, inTime: number): TimeRunFigures => ({
      mode: 'time',
      bpm: 72,
      readAhead: 'off',
      startedAt,
      endedAt: startedAt + 20_000,
      notes,
      inTime,
      early: 0,
      late: 0,
      wrong: notes - inTime,
      missed: 0,
      extras: 0,
      medianDeviation: 20,
      tendency: 0,
    });
    const session: SightSessionSummary & { kind: 'sight' } = {
      kind: 'sight',
      id: 'sr',
      level: 'F3',
      startedAt: 0,
      endedAt: 400,
      activeMs: 400,
      length: 4,
      fragments: [
        // A look in wait mode first, then the first run in time, then a second run in time.
        {
          seed: 1,
          version: 1,
          runs: [
            { mode: 'wait', startedAt: 10, endedAt: 20, notes: 4, wrong: 0 },
            time(100, 4, 3),
            time(200, 4, 4),
          ],
        },
        // Only in wait mode: nothing.
        {
          seed: 2,
          version: 1,
          runs: [{ mode: 'wait', startedAt: 300, endedAt: 320, notes: 4, wrong: 1 }],
        },
      ],
    };
    const observations = sightObservations([session]);
    expect(observations.map((o) => o.value)).toEqual([1, 1, 1, 0]);
    expect(observations[0]).toEqual({ at: 100, value: 1, level: 'F3', run: 'sr:0' });
  });

  it('pieces: wait-mode steps right on the first try by run, rhythm-mode notes by distance', () => {
    const step = (n: number, patch: Partial<PieceStep>): PieceStep => ({
      id: `p:${n}`,
      sessionId: 'p',
      pieceId: 'minuet',
      checksum: 'x',
      hands: 'both',
      measure: 0,
      pass: 0,
      ms: 800,
      wrong: 0,
      at: n,
      ...patch,
    });
    const steps = [
      step(1, {}),
      step(2, { wrong: 2 }),
      step(3, {
        sessionId: 'q',
        mode: 'rhythm',
        notes: [
          { midi: 60, deviation: -8.5 },
          { midi: 64, deviation: null },
        ],
      }),
      // Memory mode counts for neither figure: its wrong keys are prompts, not misreadings.
      step(4, { sessionId: 'm', mode: 'memory', wrong: 1, prompts: 1, stage: 'alternate' }),
    ];
    expect(pieceStepObservations(steps)).toEqual({
      wait: [
        { at: 1, value: 1, run: 'p' },
        { at: 2, value: 0, run: 'p' },
      ],
      timed: [{ at: 3, value: 8.5 }],
    });
  });

  it('scales: each run’s spread share from its session, of the current analysis only', () => {
    const hand = (spreadShare: number | null) => ({
      hand: 'right' as const,
      spread: spreadShare === null ? null : spreadShare * 2.5,
      spreadShare,
      rough: false,
      hesitations: 0,
      medianInterval: 250,
    });
    const run = (id: string, version: number, shares: (number | null)[]) => ({
      id,
      exercise: 'major:C:2:both',
      startedAt: 100,
      endedAt: 200,
      headline: {
        version,
        quality: 'ok' as const,
        counts: { expected: 30, matched: 30, wrong: 0, missed: 0, extra: 0 },
        velocityMeasured: true,
        hands: shares.map(hand),
      },
    });
    const session: ScaleSession = {
      kind: 'scale',
      id: 'sc',
      startedAt: 100,
      endedAt: 200,
      activeMs: 100,
      // Hands together: the hand with the larger spread.
      runs: [
        run('sc:0', 1, [4, 6]),
        run('sc:1', 0, [3]),
        run('sc:2', 1, [null]),
        // Technique is left out: a scale's evenness only compares with a scale's.
        { ...run('sc:3', 1, [2]), exercise: 'hanon:C:2:both:1' },
        { ...run('sc:4', 1, [2]), exercise: 'majorBrokenChords:C:2:both' },
        { ...run('sc:5', 1, [5]), exercise: 'majorArpeggio:C:2:right' },
      ],
    };
    expect(scaleObservations([session as SessionRecord])).toEqual([
      { at: 100, value: 6, run: 'sc:0' },
      { at: 100, value: 5, run: 'sc:5' },
    ]);
  });
});

describe('every practice at once', () => {
  it('waits for the records loaded on demand, and skips what is older than the weeks shown', () => {
    const old = attempt(0, { at: noon(addDays(trendWeekStarts(TODAY, 7)[0]!, -1)) });
    const attempts = [old, ...Array.from({ length: 20 }, (_, i) => attempt(i + 1, {}))];
    const pending = trends({ attempts, answers: [], sessions: [], loaded: null }, UTC);
    expect(pending.inTime).toBeNull();
    expect(pending.pieces).toBeNull();
    expect(pending.reading!.weeks.reduce((sum, w) => sum + w.count, 0)).toBe(20);
    expect(pending.reading!.thisWeek).toBe(20);
    expect(pending.scales).toMatchObject({ any: false });

    const loaded = trends(
      {
        attempts,
        answers: [],
        sessions: [],
        loaded: { pieceWait: week(25, 3, 1, { run: 'r' }), timed: week(25, 50, 15) },
      },
      UTC,
    );
    expect(loaded.inTime).toMatchObject({ thisWeek: 50 });
    expect(loaded.pieces).toMatchObject({ thisWeek: 1 });
  });
});
