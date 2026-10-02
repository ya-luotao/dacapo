import { describe, expect, it } from 'vitest';
import { FIRST_DAY, LOCALES } from '../i18n/locale.ts';
import { BUILT_IN } from '../pieces/library/index.ts';
import {
  sampleAttempt,
  sampleEarSession,
  sampleHeadline,
  sampleTheorySession,
  sampleTuneSession,
} from '../storage/fixtures.ts';
import type { Answer } from './answers.ts';
import { CURRICULUM_LESSONS } from './curriculum.ts';
import { LEVEL_IDS, type LevelId } from './levels.ts';
import type { PieceSessionRecord, ReadSessionRecord, SessionRecord } from './log.ts';
import { MASTERY_WINDOW } from './mastery.ts';
import {
  lastWeek,
  lastWeekRecap,
  RECAP_KINDS,
  RECAP_LINES,
  weekRecaps,
  weekSoFar,
  type LessonTick,
  type RecapLine,
  type RecapOptions,
  type WeekRecap,
} from './recap.ts';
import { withRun, type ScaleSession } from './scaleRecords.ts';
import type { HandSelection } from './score.ts';
import { recoverSummary, type Attempt } from './session.ts';
import type { TodayPiece, TodayRecords } from './today.ts';

const TZ = 'UTC';
const MIN = 60_000;
const DAY = 86_400_000;
/** Friday 2 October 2026. With weeks from Sunday: this week began on 27 September. */
const TODAY = '2026-10-02';
/** An instant `days` days from today (negative: before it), at `hour` o'clock. */
const at = (days: number, hour = 17) => Date.UTC(2026, 9, 2, hour) + days * DAY;
/** Days from today in the week that ended (20–26 September) and in the one before it. */
const LAST = { first: -12, mid: -9, end: -6 };
const BEFORE = { first: -19, mid: -16, end: -13 };

const LIBRARY: TodayPiece[] = BUILT_IN.map((p) => ({
  id: p.id,
  grade: p.level,
  leadSheet: p.leadSheet === true,
  facts: p.facts,
  out: false,
}));
const ODE = 'beethoven-ode-to-joy';
const MINUET = 'petzold-minuet-in-g';
const MARCH = 'schumann-soldiers-march';

const EMPTY: TodayRecords = { sessions: [], attempts: [], answers: [], pieces: LIBRARY };
const options = (patch: Partial<RecapOptions> = {}): RecapOptions => ({
  today: TODAY,
  firstDay: 7,
  lessons: [],
  timeZone: TZ,
  ...patch,
});
const withSessions = (...sessions: SessionRecord[]): TodayRecords => ({ ...EMPTY, sessions });
/** The week that ended, which these records must have. */
const ended = (records: TodayRecords, patch: Partial<RecapOptions> = {}): WeekRecap => {
  const { last } = weekRecaps(records, options(patch));
  expect(last).not.toBeNull();
  return last!;
};
const kinds = (recap: WeekRecap) => recap.lines.map((line) => line.kind);
const line = <K extends RecapLine['kind']>(recap: WeekRecap, kind: K) =>
  recap.lines.find((l): l is Extract<RecapLine, { kind: K }> => l.kind === kind);

/** Free play on day `day`, `minutes` long. */
const free = (id: string, day: number, minutes: number, hour?: number): SessionRecord => ({
  kind: 'free',
  id,
  startedAt: at(day, hour),
  endedAt: at(day, hour) + minutes * MIN,
  activeMs: minutes * MIN,
  notes: 10,
});

/** A rhythm run's counts that the review grades better (clean and in time), and worse. */
const CLEAN = { notes: 100, hits: 100, inTime: 90 };
const POOR = { notes: 100, hits: 80, inTime: 60 };

/** A run of a piece on day `day`: to its end unless said, in wait mode unless it has `rhythm`. */
function run(
  id: string,
  pieceId: string,
  day: number,
  o: {
    whole?: boolean;
    minutes?: number;
    hands?: HandSelection;
    hour?: number;
    tempo?: number;
    rhythm?: typeof CLEAN;
  } = {},
): PieceSessionRecord {
  const startedAt = at(day, o.hour);
  const activeMs = (o.minutes ?? 2) * MIN;
  return {
    kind: 'piece',
    id,
    pieceId,
    title: pieceId,
    hands: o.hands ?? 'both',
    loop: null,
    repeats: 'play',
    tempo: o.tempo ?? 100,
    startedAt,
    endedAt: startedAt + activeMs,
    activeMs,
    steps: 40,
    wrong: 0,
    completed: o.whole ?? true,
    ...(o.rhythm && { mode: 'rhythm' as const, rhythm: o.rhythm }),
  };
}

/** A run of a scale exercise on day `day`. */
function scale(id: string, exercise: string, day: number, hour?: number): ScaleSession {
  const startedAt = at(day, hour);
  return withRun(null, id, {
    id: `${id}:0`,
    exercise,
    startedAt,
    endedAt: startedAt + 10_000,
    headline: sampleHeadline(),
  });
}

/** A Read session at `level` on day `day`: `cards` cards, all right and quick. */
function read(
  id: string,
  day: number,
  o: { level?: LevelId; cards?: number } = {},
): { session: ReadSessionRecord; attempts: Attempt[] } {
  const cards = o.cards ?? 10;
  const attempts = Array.from({ length: cards }, (_, i) =>
    sampleAttempt(i, id, {
      id: `${id}:${i}`,
      level: o.level ?? 'L1',
      at: at(day) + i * 3000,
      correct: true,
      hinted: false,
      ms: 900,
    }),
  );
  return { attempts, session: { kind: 'read', ...recoverSummary(attempts)!, length: cards } };
}

/** A session of another family, moved to day `day`. */
const on = <T extends SessionRecord>(session: T, day: number): T => ({
  ...session,
  startedAt: at(day),
});
const tick = (slug: string, day: number, hour?: number): LessonTick => ({
  slug,
  doneAt: at(day, hour),
});

describe('the week', () => {
  it('is the owner’s week: from Sunday, or from Monday in Simplified Chinese', () => {
    // Friday 2 October 2026.
    expect(lastWeek(TODAY, 7)).toEqual({ start: '2026-09-20', end: '2026-09-26', days: 7 });
    expect(weekSoFar(TODAY, 7)).toEqual({ start: '2026-09-27', end: TODAY, days: 6 });
    expect(lastWeek(TODAY, 1)).toEqual({ start: '2026-09-21', end: '2026-09-27', days: 7 });
    expect(weekSoFar(TODAY, 1)).toEqual({ start: '2026-09-28', end: TODAY, days: 5 });
    for (const locale of LOCALES) {
      const first = FIRST_DAY[locale];
      const monday = locale === 'zh-CN';
      expect(first, locale).toBe(monday ? 1 : 7);
      expect(lastWeek(TODAY, first).start, locale).toBe(monday ? '2026-09-21' : '2026-09-20');
      expect(weekSoFar(TODAY, first).start, locale).toBe(monday ? '2026-09-28' : '2026-09-27');
    }
  });

  it('has one day so far on its first day, and seven on its last', () => {
    expect(weekSoFar('2026-09-27', 7)).toEqual({ start: '2026-09-27', end: '2026-09-27', days: 1 });
    expect(lastWeek('2026-09-27', 7)).toEqual({ start: '2026-09-20', end: '2026-09-26', days: 7 });
    expect(weekSoFar('2026-10-03', 7)).toEqual({ start: '2026-09-27', end: '2026-10-03', days: 7 });
    // A Sunday ends the week that begins on Monday.
    expect(weekSoFar('2026-09-27', 1)).toEqual({ start: '2026-09-21', end: '2026-09-27', days: 7 });
    expect(lastWeek('2026-09-27', 1)).toEqual({ start: '2026-09-14', end: '2026-09-20', days: 7 });
    // Across a year's end.
    expect(lastWeek('2027-01-01', 7)).toEqual({ start: '2026-12-20', end: '2026-12-26', days: 7 });
  });

  it('is cut at the player’s midnight, across a daylight-saving change', () => {
    // New York, Tuesday 3 November 2026. Sunday 1 November has 25 hours: the clocks go back.
    const zone = { today: '2026-11-03', timeZone: 'America/New_York' };
    const sessions: SessionRecord[] = [
      { ...free('a', 0, 6), startedAt: Date.parse('2026-11-01T03:30:00Z') }, // 31 Oct, 23:30 EDT
      { ...free('b', 0, 7), startedAt: Date.parse('2026-11-01T04:30:00Z') }, // 1 Nov, 00:30 EDT
      { ...free('c', 0, 8), startedAt: Date.parse('2026-11-02T04:30:00Z') }, // 1 Nov, 23:30 EST
    ];
    const lessons = [
      { slug: 'keyboard', doneAt: Date.parse('2026-11-01T03:59:59Z') }, // the last second of October
      { slug: 'staff', doneAt: Date.parse('2026-11-01T04:00:00Z') }, // midnight
    ];
    const sunday = weekRecaps(withSessions(...sessions), options({ ...zone, lessons }));
    expect(sunday.last).toMatchObject({ start: '2026-10-25', end: '2026-10-31' });
    expect(sunday.last).toMatchObject({ practised: 1, ms: 6 * MIN });
    expect(line(sunday.last!, 'lessons')).toEqual({ kind: 'lessons', lessons: ['keyboard'] });
    expect(sunday.current).toMatchObject({ start: '2026-11-01', end: '2026-11-03', days: 3 });
    expect(sunday.current).toMatchObject({ practised: 1, ms: 15 * MIN });
    expect(line(sunday.current, 'lessons')).toEqual({ kind: 'lessons', lessons: ['staff'] });
    // From Monday, the week that ended has all three, on two days.
    const monday = weekRecaps(
      withSessions(...sessions),
      options({ ...zone, firstDay: 1, lessons }),
    );
    expect(monday.last).toMatchObject({ start: '2026-10-26', end: '2026-11-01' });
    expect(monday.last).toMatchObject({ practised: 2, ms: 21 * MIN });
    expect(line(monday.last!, 'lessons')!.lessons).toEqual(['keyboard', 'staff']);
    expect(monday.current).toMatchObject({ start: '2026-11-02', days: 2, practised: 0, ms: 0 });

    // Sunday 8 March 2026 has 23 hours: the week still turns at midnight.
    const spring = weekRecaps(
      withSessions(
        { ...free('d', 0, 6), startedAt: Date.parse('2026-03-08T04:59:00Z') }, // 7 Mar, 23:59 EST
        { ...free('e', 0, 7), startedAt: Date.parse('2026-03-08T05:00:00Z') }, // 8 Mar, 00:00 EST
      ),
      options({ today: '2026-03-10', timeZone: 'America/New_York' }),
    );
    expect(spring.last).toMatchObject({ start: '2026-03-01', end: '2026-03-07', ms: 6 * MIN });
    expect(spring.current).toMatchObject({ start: '2026-03-08', days: 3, ms: 7 * MIN });
  });

  it('is the week of the player’s time zone', () => {
    // 00:30 on Sunday 27 September in Shanghai is still Saturday in UTC.
    const session = { ...free('a', 0, 9), startedAt: Date.UTC(2026, 8, 26, 16, 30) };
    const shanghai = weekRecaps(withSessions(session), options({ timeZone: 'Asia/Shanghai' }));
    expect(shanghai.current).toMatchObject({ practised: 1, ms: 9 * MIN });
    expect(shanghai.last).toBeNull();
    const utc = weekRecaps(withSessions(session), options());
    expect(utc.last).toMatchObject({ practised: 1, ms: 9 * MIN });
    expect(utc.current).toMatchObject({ practised: 0, ms: 0 });
  });
});

describe('days and time', () => {
  it('counts the days practised of seven and the time, against the week before', () => {
    const recap = ended(
      withSessions(
        free('a', LAST.first, 10),
        free('b', LAST.first, 5, 20),
        free('c', LAST.mid, 30),
        free('d', LAST.end, 55),
        free('e', BEFORE.first, 20),
        free('f', BEFORE.end, 4),
        // Neither week: the day after, and three weeks back.
        free('g', -5, 60),
        free('h', -20, 60),
      ),
    );
    expect(recap).toMatchObject({
      start: '2026-09-20',
      end: '2026-09-26',
      days: 7,
      practised: 3,
      ms: 100 * MIN,
      before: { practised: 2, ms: 24 * MIN },
    });
  });

  it('counts a day with any practice, however short, and a session for the day it began', () => {
    const recap = ended(
      withSessions(
        free('a', LAST.mid, 1),
        // Begun at 23:50 on the week's last day, twenty minutes long.
        { ...free('b', LAST.end, 20), startedAt: at(LAST.end, 23) + 50 * MIN },
      ),
    );
    expect(recap).toMatchObject({ practised: 2, ms: 21 * MIN });
    expect(weekRecaps(withSessions(free('a', LAST.mid, 1)), options()).current.ms).toBe(0);
  });

  it('has no week before to set a first week against', () => {
    const recap = ended(withSessions(free('a', LAST.mid, 12)));
    expect(recap).toMatchObject({ practised: 1, ms: 12 * MIN, before: null });
  });

  it('sets a week against a week before without practice, once anything was practised earlier', () => {
    const recap = ended(withSessions(free('a', LAST.mid, 12), free('old', -40, 5)));
    expect(recap.before).toEqual({ practised: 0, ms: 0 });
  });

  it('says of an empty week that it was empty', () => {
    const recap = ended(withSessions(free('a', BEFORE.mid, 12), free('b', -1, 9)));
    expect(recap).toMatchObject({ practised: 0, ms: 0, lines: [] });
    expect(recap.before).toEqual({ practised: 1, ms: 12 * MIN });
  });

  it('has no last week when nothing was practised before this one', () => {
    expect(weekRecaps(EMPTY, options()).last).toBeNull();
    expect(weekRecaps(withSessions(free('a', -1, 9)), options()).last).toBeNull();
    expect(lastWeekRecap(withSessions(free('a', -1, 9)), options())).toBeNull();
    // A lesson ticked with no time is from before anything else, and is not a week's event.
    const legacy = [{ slug: 'keyboard', doneAt: 0 }];
    expect(weekRecaps(EMPTY, options({ lessons: legacy })).last).toBeNull();
    // A lesson finished last week is something to speak of, without a minute of practice.
    const lessons = [tick('keyboard', LAST.mid)];
    expect(ended(EMPTY, { lessons })).toMatchObject({
      practised: 0,
      ms: 0,
      before: null,
      lines: [{ kind: 'lessons', lessons: ['keyboard'] }],
    });
  });
});

describe('this week so far', () => {
  const records = withSessions(
    free('a', -5, 10),
    free('b', -2, 15),
    free('c', 0, 20, 9),
    free('d', LAST.mid, 30),
  );

  it('counts the days so far, and is set against no week', () => {
    const { current } = weekRecaps(records, options());
    expect(current).toMatchObject({
      start: '2026-09-27',
      end: TODAY,
      days: 6,
      practised: 3,
      ms: 45 * MIN,
      before: null,
    });
  });

  it('is one day long on the week’s first day', () => {
    const { current, last } = weekRecaps(records, options({ today: '2026-09-27' }));
    expect(current).toMatchObject({ days: 1, practised: 1, ms: 10 * MIN });
    expect(last).toMatchObject({ practised: 1, ms: 30 * MIN });
  });

  it('has what happened so far, up to now', () => {
    const l1 = read('r1', 0, { level: 'L1', cards: MASTERY_WINDOW });
    const { current, last } = weekRecaps(
      {
        ...EMPTY,
        sessions: [free('old', LAST.mid, 5), l1.session, run('p1', ODE, -1)],
        attempts: l1.attempts,
      },
      options({ lessons: [tick('keyboard', -3)] }),
    );
    expect(kinds(current)).toEqual(['lessons', 'levels', 'reviewIn', 'most']);
    expect(line(current, 'levels')!.levels).toEqual([{ family: 'notes', level: 'L1' }]);
    // The week that ended had free play alone: Read's notes, always open, had none of it.
    expect(last!.lines).toEqual([{ kind: 'none', practice: 'notes' }]);
  });

  it('does not say which open practice had no time: the week is not over', () => {
    const lessons = [{ slug: 'landmarks', doneAt: 0 }];
    const sessions = [read('r1', -1).session, read('r0', LAST.mid).session];
    const { current, last } = weekRecaps(withSessions(...sessions), options({ lessons }));
    expect(kinds(current)).not.toContain('none');
    expect(kinds(last!)).toContain('none');
  });
});

describe('what happened', () => {
  it('counts a lesson for the week its tick falls in, in the lessons’ order', () => {
    const lessons: LessonTick[] = [
      tick('landmarks', LAST.end, 23),
      tick('keyboard', LAST.first, 0),
      tick('staff', LAST.mid),
      // The week before, and this week.
      tick('rhythm', BEFORE.end, 23),
      tick('sharps-and-flats', -5, 0),
      // No time is known for it: it never counts.
      { slug: 'major-scale', doneAt: 0 },
      // A page beside the lessons is not one of the fifteen.
      tick('inside', LAST.mid),
    ];
    expect(CURRICULUM_LESSONS).not.toContain('inside');
    const { last, current } = weekRecaps(EMPTY, options({ lessons }));
    expect(last!.lines).toEqual([{ kind: 'lessons', lessons: ['keyboard', 'staff', 'landmarks'] }]);
    expect(current.lines).toEqual([{ kind: 'lessons', lessons: ['sharps-and-flats'] }]);
  });

  it('names the levels mastered at the week’s end that were not at its start', () => {
    const before = read('r0', BEFORE.mid, { level: 'L2', cards: MASTERY_WINDOW });
    const l1 = read('r1', LAST.mid, { level: 'L1', cards: MASTERY_WINDOW });
    const l3 = read('r3', LAST.end, { level: 'L3', cards: MASTERY_WINDOW });
    // Half the cards a level's mastery is taken over: not mastered yet.
    const l4 = read('r4', LAST.end, { level: 'L4', cards: MASTERY_WINDOW / 2 });
    const records: TodayRecords = {
      ...EMPTY,
      sessions: [before, l1, l3, l4].map((r) => r.session),
      attempts: [before, l1, l3, l4].flatMap((r) => r.attempts),
    };
    const recap = ended(records);
    expect(line(recap, 'levels')).toEqual({
      kind: 'levels',
      levels: [
        { family: 'notes', level: 'L1' },
        { family: 'notes', level: 'L3' },
      ],
    });
    // The level mastered the week before is that week's.
    const earlier = ended(records, { today: '2026-09-25' });
    expect(line(earlier, 'levels')!.levels).toEqual([{ family: 'notes', level: 'L2' }]);
    expect(weekRecaps(records, options()).current.lines).toEqual([]);
  });

  it('says a tune learnt as a tune learnt, on a line of its own', () => {
    const tune = sampleTuneSession('tu1', 0);
    const answers: Answer[] = tune.answers.map((a, i) => ({
      ...a,
      correct: true,
      answer: [...a.prompt],
      replays: 0,
      at: at(LAST.mid) + i * 20_000,
    }));
    const recap = ended({
      ...EMPTY,
      sessions: [on(tune.session, LAST.mid)],
      answers,
    });
    expect(kinds(recap)).toEqual(['tunes', 'none']);
    expect(line(recap, 'tunes')).toEqual({ kind: 'tunes', tunes: ['trad-amazing-grace'] });
  });

  it('names the pieces that came into review: first played to their end in the week', () => {
    const recap = ended(
      withSessions(
        run('a', ODE, LAST.mid),
        // Not to its end: it is in hand, not in review.
        run('b', MINUET, LAST.mid, { whole: false }),
        // In review since the week before.
        run('c', MARCH, BEFORE.mid),
        run('d', MARCH, LAST.first),
      ),
    );
    expect(line(recap, 'reviewIn')).toEqual({ kind: 'reviewIn', pieces: [ODE] });
    expect(kinds(recap)).not.toContain('reviewUp');
    expect(kinds(recap)).not.toContain('reviewBack');
  });

  it('names the pieces that moved up or fell back in review, with their interval now', () => {
    const recap = ended(
      withSessions(
        // Into review the week before; reviewed on its day, clean and in time: a step up.
        run('a1', ODE, BEFORE.mid),
        run('a2', ODE, LAST.first, { rhythm: CLEAN }),
        // Up a step three weeks ago; reviewed with too many wrong notes: back a step.
        run('b1', MINUET, -30),
        run('b2', MINUET, -25, { rhythm: CLEAN }),
        run('b3', MINUET, LAST.mid, { rhythm: POOR }),
        // Reviewed and kept where it was.
        run('c1', MARCH, BEFORE.mid),
        run('c2', MARCH, LAST.mid),
      ),
    );
    expect(line(recap, 'reviewUp')).toEqual({
      kind: 'reviewUp',
      pieces: [{ id: ODE, interval: 2 }],
    });
    expect(line(recap, 'reviewBack')).toEqual({
      kind: 'reviewBack',
      pieces: [{ id: MINUET, interval: 1 }],
    });
    expect(kinds(recap)).not.toContain('reviewIn');
  });

  it('leaves a piece taken out of review out of the review’s lines', () => {
    const pieces = LIBRARY.map((p) => (p.id === ODE ? { ...p, out: true } : p));
    const recap = ended({ ...EMPTY, pieces, sessions: [run('a', ODE, LAST.mid)] });
    expect(kinds(recap)).not.toContain('reviewIn');
  });

  it('names a piece brought to a higher tempo, clean and in time', () => {
    const recap = ended(
      withSessions(
        // 60% the week before, 70% and then 80% in the week: 80% is where it got to.
        run('a1', ODE, BEFORE.mid, { tempo: 60, rhythm: CLEAN }),
        run('a2', ODE, LAST.first, { tempo: 70, rhythm: CLEAN }),
        run('a3', ODE, LAST.mid, { tempo: 80, rhythm: CLEAN }),
        // Clean at 90% before; the week's run at 70% reaches nothing new.
        run('b1', MINUET, BEFORE.mid, { tempo: 90, rhythm: CLEAN }),
        run('b2', MINUET, LAST.mid, { tempo: 70, rhythm: CLEAN }),
        // Not clean, and not to the end: no tempo reached.
        run('c1', MARCH, LAST.mid, { tempo: 60, rhythm: POOR }),
        run('c2', MARCH, LAST.mid, { tempo: 60, rhythm: CLEAN, whole: false, hour: 18 }),
      ),
    );
    expect(line(recap, 'tempo')).toEqual({
      kind: 'tempo',
      pieces: [{ id: ODE, hands: 'both', tempo: 80 }],
    });
  });

  it('names a piece once: with both hands, or else with the hand that got further', () => {
    const recap = ended(
      withSessions(
        run('a1', ODE, LAST.mid, { tempo: 90, rhythm: CLEAN, hands: 'right' }),
        run('a2', ODE, LAST.mid, { tempo: 60, rhythm: CLEAN, hour: 18 }),
        run('b1', MINUET, LAST.mid, { tempo: 60, rhythm: CLEAN, hands: 'right' }),
        run('b2', MINUET, LAST.mid, { tempo: 80, rhythm: CLEAN, hands: 'left', hour: 18 }),
      ),
    );
    expect(line(recap, 'tempo')!.pieces).toEqual([
      { id: ODE, hands: 'both', tempo: 60 },
      { id: MINUET, hands: 'left', tempo: 80 },
    ]);
  });

  it('names the scales played for the first time, in the order first played', () => {
    const recap = ended(
      withSessions(
        scale('a', 'major:C:1:right', BEFORE.mid),
        scale('b', 'major:C:1:right', LAST.first),
        scale('c', 'major:G:1:right', LAST.mid),
        scale('d', 'majorArpeggio:C:2:both', LAST.first, 18),
        scale('e', 'major:G:1:right', LAST.end),
        // Technique is left out, as the scales' trend leaves it out.
        scale('f', 'majorFiveFinger:C:1:right', LAST.mid),
        // This week's first is this week's.
        scale('g', 'major:F:1:right', -1),
      ),
    );
    expect(line(recap, 'scales')).toEqual({
      kind: 'scales',
      exercises: ['majorArpeggio:C:2:both', 'major:G:1:right'],
    });
  });

  it('counts a scale run for the week of its own first key', () => {
    // A session begun before the week's first midnight, with a new scale after it.
    let session = scale('a', 'major:C:1:right', BEFORE.end, 23);
    const startedAt = at(LAST.first, 0) + MIN;
    session = withRun(session, 'a', {
      id: 'a:1',
      exercise: 'major:D:1:right',
      startedAt,
      endedAt: startedAt + 10_000,
      headline: sampleHeadline(),
    });
    const { last } = weekRecaps(withSessions(session), options());
    expect(line(last!, 'scales')!.exercises).toEqual(['major:D:1:right']);
  });

  it('names the practice that had most of the time, when there were two or more', () => {
    const notes = read('r1', LAST.mid);
    const one = ended(withSessions(run('a', ODE, LAST.mid, { minutes: 30, whole: false })));
    expect(kinds(one)).not.toContain('most');
    const two = ended(
      withSessions(
        run('a', ODE, LAST.mid, { minutes: 30, whole: false }),
        run('b', MINUET, LAST.end, { minutes: 15, whole: false }),
        scale('c', 'major:C:1:right', LAST.mid),
        free('d', LAST.first, 40),
        { ...notes.session, activeMs: 20 * MIN },
      ),
    );
    expect(line(two, 'most')).toEqual({ kind: 'most', practice: 'pieces', ms: 45 * MIN });
    // Free play is never proposed, but time is time.
    const playing = ended(
      withSessions(free('d', LAST.first, 40), run('a', ODE, LAST.mid, { whole: false })),
    );
    expect(line(playing, 'most')).toEqual({ kind: 'most', practice: 'free', ms: 40 * MIN });
    // Equal times: the order of the contents decides.
    const equal = ended(
      withSessions(run('a', ODE, LAST.mid, { minutes: 10, whole: false }), {
        ...notes.session,
        activeMs: 10 * MIN,
      }),
    );
    expect(line(equal, 'most')!.practice).toBe('notes');
  });

  describe('the open practice that had none of the time', () => {
    /** Lesson 3 ticked: intervals on the staff, intervals by ear and Pieces are open. */
    const lessons = [{ slug: 'landmarks', doneAt: 0 }];
    const notes = () => read('r1', LAST.mid).session;

    it('is the one never practised, in the order of the contents', () => {
      const recap = ended(withSessions(notes()), { lessons });
      expect(line(recap, 'none')).toEqual({ kind: 'none', practice: 'readInterval' });
    });

    it('is the one left alone longest, once each was practised', () => {
      const sessions = [
        notes(),
        on(sampleTheorySession('t1', 4).session, -30),
        on(sampleEarSession('e1', 4).session, -40),
        run('p1', ODE, -20, { whole: false }),
      ];
      const recap = ended(withSessions(...sessions), { lessons });
      expect(line(recap, 'none')).toEqual({ kind: 'none', practice: 'interval' });
      // One never practised comes before all of them: Scales, once its lesson is ticked.
      const more = [...lessons, { slug: 'major-scale', doneAt: 0 }];
      const withScales = ended(withSessions(...sessions), { lessons: more });
      expect(line(withScales, 'none')!.practice).toBe('keySignature');
    });

    it('is not one that had time in the week, nor one that is not open', () => {
      const recap = ended(
        withSessions(notes(), on(sampleTheorySession('t1', 4).session, LAST.end)),
        { lessons },
      );
      expect(line(recap, 'none')!.practice).toBe('interval');
      // Without the lesson, only what was gone to is open: Read's notes, which had the time.
      expect(kinds(ended(withSessions(notes())))).not.toContain('none');
    });

    it('opens with a lesson ticked by the week’s end, not after it', () => {
      const later = [tick('landmarks', -1)];
      expect(kinds(ended(withSessions(notes()), { lessons: later }))).not.toContain('none');
    });

    it('passes over a family mastered throughout: nothing is left to propose there', () => {
      const piece = run('a', ODE, LAST.mid, { whole: false });
      const mastered = (levels: readonly LevelId[]): TodayRecords => {
        const read40 = levels.map((level, i) =>
          read(`m${i}`, -40, { level, cards: MASTERY_WINDOW }),
        );
        return {
          ...EMPTY,
          sessions: [...read40.map((r) => r.session), piece],
          attempts: read40.flatMap((r) => r.attempts),
        };
      };
      expect(line(ended(mastered(LEVEL_IDS.slice(0, -1))), 'none')!.practice).toBe('notes');
      expect(kinds(ended(mastered(LEVEL_IDS)))).not.toContain('none');
    });

    it('is not said of a week without practice', () => {
      const recap = ended(withSessions(free('old', BEFORE.mid, 9)), { lessons });
      expect(recap.lines).toEqual([]);
    });
  });
});

describe('the lines of a week', () => {
  /** A week with every kind of line but a tune learnt and a piece that fell back. */
  function fullWeek(): { records: TodayRecords; lessons: LessonTick[] } {
    const l1 = read('r1', LAST.mid, { level: 'L1', cards: MASTERY_WINDOW });
    return {
      lessons: [{ slug: 'landmarks', doneAt: 0 }, tick('keyboard', LAST.first)],
      records: {
        ...EMPTY,
        sessions: [
          l1.session,
          // Into review.
          run('a', MARCH, LAST.mid),
          // Up a step, and to a higher tempo.
          run('b1', ODE, BEFORE.mid, { tempo: 60, rhythm: CLEAN }),
          run('b2', ODE, LAST.first, { tempo: 70, rhythm: CLEAN, minutes: 20 }),
          scale('c', 'major:C:1:right', LAST.end),
        ],
        attempts: l1.attempts,
      },
    };
  }

  it('come in a fixed order of kinds, the most telling first', () => {
    expect(RECAP_KINDS).toEqual([
      'lessons',
      'levels',
      'tunes',
      'reviewIn',
      'reviewUp',
      'reviewBack',
      'tempo',
      'scales',
      'most',
      'none',
    ]);
    const { records, lessons } = fullWeek();
    const recap = ended(records, { lessons });
    const order = kinds(recap).map((kind) => RECAP_KINDS.indexOf(kind));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('are six at most: the first six of the order', () => {
    expect(RECAP_LINES).toBe(6);
    const { records, lessons } = fullWeek();
    // Eight kinds apply: the two about where the time went give way.
    expect(kinds(ended(records, { lessons }))).toEqual([
      'lessons',
      'levels',
      'reviewIn',
      'reviewUp',
      'tempo',
      'scales',
    ]);
    // With fewer, the time's lines are there.
    const fewer = { ...records, sessions: records.sessions.filter((s) => s.kind !== 'scale') };
    expect(kinds(ended(fewer, { lessons }))).toEqual([
      'lessons',
      'levels',
      'reviewIn',
      'reviewUp',
      'tempo',
      'most',
    ]);
    const few = { ...records, sessions: records.sessions.filter((s) => s.kind !== 'piece') };
    expect(kinds(ended(few, { lessons }))).toEqual(['lessons', 'levels', 'scales', 'most', 'none']);
  });

  it('are the same for the home page’s line as for Progress', () => {
    const { records, lessons } = fullWeek();
    expect(lastWeekRecap(records, options({ lessons }))).toEqual(ended(records, { lessons }));
  });

  it('do not change with the records of the days after the week', () => {
    const { records, lessons } = fullWeek();
    const before = ended(records, { lessons });
    const l2 = read('r2', -1, { level: 'L2', cards: MASTERY_WINDOW });
    const later: TodayRecords = {
      ...records,
      sessions: [...records.sessions, l2.session, run('z', MINUET, -2), free('y', 0, 50)],
      attempts: [...records.attempts, ...l2.attempts],
    };
    expect(ended(later, { lessons: [...lessons, tick('staff', -1)] })).toEqual(before);
  });
});
