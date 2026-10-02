import { describe, expect, it } from 'vitest';
import {
  addDays,
  currentStreak,
  dailyTotals,
  dayHistory,
  dayKey,
  dayOfWeek,
  longestStreak,
  monthStarts,
  monthTotals,
  practiceLevel,
  practiceLog,
  STREAK_GOAL_MS,
  weekday,
  weekStart,
  yearGrid,
  type DayKey,
} from './streak.ts';

const MIN = 60_000;
const NEW_YORK = 'America/New_York';
const SHANGHAI = 'Asia/Shanghai';

const totals = (entries: Record<DayKey, number>) => new Map(Object.entries(entries));

describe('dayKey', () => {
  it('uses the calendar date of the given time zone', () => {
    const instant = Date.UTC(2026, 8, 24, 20, 0); // 20:00 UTC
    expect(dayKey(instant, 'UTC')).toBe('2026-09-24');
    expect(dayKey(instant, SHANGHAI)).toBe('2026-09-25'); // 04:00 the next morning
    expect(dayKey(instant, NEW_YORK)).toBe('2026-09-24'); // 16:00
  });

  it('puts the last millisecond before local midnight on the old day', () => {
    // Midnight in Shanghai (UTC+8) is 16:00 UTC the day before.
    const midnight = Date.UTC(2026, 8, 24, 16, 0);
    expect(dayKey(midnight - 1, SHANGHAI)).toBe('2026-09-24');
    expect(dayKey(midnight, SHANGHAI)).toBe('2026-09-25');
  });

  it('handles the daylight-saving change days in New York', () => {
    // 2026-03-08: clocks jump from 02:00 to 03:00 EST→EDT; the day has 23 hours.
    expect(dayKey(Date.UTC(2026, 2, 8, 4, 59), NEW_YORK)).toBe('2026-03-07'); // 23:59 EST
    expect(dayKey(Date.UTC(2026, 2, 8, 5, 0), NEW_YORK)).toBe('2026-03-08'); // 00:00 EST
    expect(dayKey(Date.UTC(2026, 2, 9, 3, 59), NEW_YORK)).toBe('2026-03-08'); // 23:59 EDT
    expect(dayKey(Date.UTC(2026, 2, 9, 4, 0), NEW_YORK)).toBe('2026-03-09'); // 00:00 EDT
    // 2026-11-01: clocks fall back from 02:00 to 01:00; the day has 25 hours.
    expect(dayKey(Date.UTC(2026, 10, 1, 4, 0), NEW_YORK)).toBe('2026-11-01'); // 00:00 EDT
    expect(dayKey(Date.UTC(2026, 10, 2, 4, 59), NEW_YORK)).toBe('2026-11-01'); // 23:59 EST
    expect(dayKey(Date.UTC(2026, 10, 2, 5, 0), NEW_YORK)).toBe('2026-11-02'); // 00:00 EST
  });
});

describe('addDays', () => {
  it('moves by calendar days across months, years and leap days', () => {
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-03-08', -1)).toBe('2026-03-07');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-09-25', -29)).toBe('2026-08-27');
  });
});

describe('dailyTotals', () => {
  it('adds up sessions by the local date on which they started', () => {
    const sessions = [
      { startedAt: Date.UTC(2026, 8, 24, 15, 50), activeMs: 20 * MIN }, // 23:50 in Shanghai
      { startedAt: Date.UTC(2026, 8, 24, 16, 5), activeMs: 3 * MIN }, // 00:05 the next day
      { startedAt: Date.UTC(2026, 8, 24, 1, 0), activeMs: 2 * MIN },
    ];
    expect(Object.fromEntries(dailyTotals(sessions, SHANGHAI))).toEqual({
      '2026-09-24': 22 * MIN,
      '2026-09-25': 3 * MIN,
    });
  });

  it('keeps a session that runs past midnight on the day it started', () => {
    const start = Date.UTC(2026, 8, 24, 15, 58); // 23:58 in Shanghai, 10 minutes long
    const map = dailyTotals([{ startedAt: start, activeMs: 10 * MIN }], SHANGHAI);
    expect(map.get('2026-09-24')).toBe(10 * MIN);
    expect(map.has('2026-09-25')).toBe(false);
  });
});

describe('currentStreak', () => {
  const run = totals({
    '2026-09-21': 5 * MIN,
    '2026-09-22': 12 * MIN,
    '2026-09-23': 6 * MIN,
    '2026-09-24': 5 * MIN,
  });

  it('counts consecutive days that reach the goal, ending today', () => {
    const withToday = new Map(run).set('2026-09-25', 7 * MIN);
    expect(currentStreak(withToday, '2026-09-25')).toBe(5);
  });

  it('does not break when today has not reached the goal yet', () => {
    expect(currentStreak(run, '2026-09-25')).toBe(4);
    expect(currentStreak(new Map(run).set('2026-09-25', 4 * MIN), '2026-09-25')).toBe(4);
  });

  it('is broken by a day that did not reach the goal', () => {
    const gap = new Map(run).set('2026-09-22', 5 * MIN - 1);
    expect(currentStreak(gap, '2026-09-25')).toBe(2);
    expect(currentStreak(run, '2026-09-26')).toBe(0);
  });

  it('needs exactly the goal, not less', () => {
    expect(currentStreak(totals({ '2026-09-25': STREAK_GOAL_MS }), '2026-09-25')).toBe(1);
    expect(currentStreak(totals({ '2026-09-25': STREAK_GOAL_MS - 1 }), '2026-09-25')).toBe(0);
  });

  it('is 0 without any practice', () => {
    expect(currentStreak(new Map(), '2026-09-25')).toBe(0);
  });
});

describe('longestStreak', () => {
  it('finds the longest run anywhere in the history', () => {
    const map = totals({
      '2026-08-30': 6 * MIN,
      '2026-08-31': 6 * MIN,
      '2026-09-01': 6 * MIN,
      '2026-09-02': 1 * MIN,
      '2026-09-03': 6 * MIN,
      '2026-12-31': 9 * MIN,
      '2027-01-01': 9 * MIN,
    });
    expect(longestStreak(map)).toBe(3);
  });

  it('counts a run across a daylight-saving change as consecutive days', () => {
    const sessions = ['2026-03-07', '2026-03-08', '2026-03-09'].map((day, i) => ({
      // 00:30 local each day; EDT starts at 02:00 on the 8th.
      startedAt: Date.parse(`${day}T00:30:00${i < 2 ? '-05:00' : '-04:00'}`),
      activeMs: 5 * MIN,
    }));
    const map = dailyTotals(sessions, NEW_YORK);
    expect([...map.keys()]).toEqual(['2026-03-07', '2026-03-08', '2026-03-09']);
    expect(longestStreak(map)).toBe(3);
    expect(currentStreak(map, '2026-03-09')).toBe(3);
  });

  it('is 0 without any day reaching the goal', () => {
    expect(longestStreak(totals({ '2026-09-25': MIN }))).toBe(0);
  });
});

describe('dayHistory', () => {
  it('lists the last 30 days oldest first, with empty days as 0', () => {
    const history = dayHistory(totals({ '2026-09-25': 3 * MIN, '2026-08-27': MIN }), '2026-09-25');
    expect(history).toHaveLength(30);
    expect(history[0]).toEqual({ day: '2026-08-27', ms: MIN });
    expect(history[29]).toEqual({ day: '2026-09-25', ms: 3 * MIN });
    expect(history[15]!.ms).toBe(0);
  });

  it('covers the 23-hour day in March like any other', () => {
    const history = dayHistory(new Map(), '2026-03-10', 4);
    expect(history.map((d) => d.day)).toEqual([
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
    ]);
  });
});

describe('weekday', () => {
  it('numbers Monday 1 to Sunday 7', () => {
    expect(weekday('2026-09-28')).toBe(1);
    expect(weekday('2026-10-03')).toBe(6);
    expect(weekday('2026-10-04')).toBe(7);
    expect(weekday('2024-02-29')).toBe(4);
  });
});

describe('the week', () => {
  it('places a day in its week, whichever day the week starts on', () => {
    // Friday 2 October 2026.
    expect(dayOfWeek('2026-10-02', 7)).toBe(5);
    expect(dayOfWeek('2026-10-02', 1)).toBe(4);
    expect(dayOfWeek('2026-09-27', 7)).toBe(0); // a Sunday
    expect(dayOfWeek('2026-09-27', 1)).toBe(6);
    expect(dayOfWeek('2026-09-28', 1)).toBe(0); // a Monday
  });

  it('begins on the owner’s first day', () => {
    expect(weekStart('2026-10-02', 7)).toBe('2026-09-27');
    expect(weekStart('2026-10-02', 1)).toBe('2026-09-28');
    expect(weekStart('2026-09-27', 7)).toBe('2026-09-27');
    expect(weekStart('2026-09-27', 1)).toBe('2026-09-21');
    expect(weekStart('2027-01-01', 7)).toBe('2026-12-27');
  });
});

describe('practiceLevel', () => {
  it('breaks between some practice and the goal where the streak does', () => {
    expect(practiceLevel(0)).toBe(0);
    expect(practiceLevel(1)).toBe(1);
    expect(practiceLevel(STREAK_GOAL_MS - 1)).toBe(1);
    expect(practiceLevel(STREAK_GOAL_MS)).toBe(2);
    expect(practiceLevel(3 * STREAK_GOAL_MS - 1)).toBe(2);
    expect(practiceLevel(3 * STREAK_GOAL_MS)).toBe(3);
    expect(practiceLevel(6 * STREAK_GOAL_MS)).toBe(4);
    expect(practiceLevel(5 * 60 * MIN)).toBe(4);
  });
});

describe('yearGrid', () => {
  it('ends with the week under way, days after today empty', () => {
    // Wednesday 30 September 2026, weeks from Sunday.
    const grid = yearGrid(totals({ '2026-09-30': 7 * MIN, '2026-09-27': MIN }), '2026-09-30', {
      weeks: 2,
    });
    expect(grid).toHaveLength(2);
    expect(grid[0]!.map((d) => d?.day)).toEqual([
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
    ]);
    expect(grid[1]!.slice(0, 4)).toEqual([
      { day: '2026-09-27', ms: MIN },
      { day: '2026-09-28', ms: 0 },
      { day: '2026-09-29', ms: 0 },
      { day: '2026-09-30', ms: 7 * MIN },
    ]);
    expect(grid[1]!.slice(4)).toEqual([null, null, null]);
  });

  it('starts weeks on Monday when asked', () => {
    const grid = yearGrid(new Map(), '2026-09-27', { weeks: 1, firstDay: 1 });
    expect(grid[0]![0]!.day).toBe('2026-09-21');
    expect(grid[0]![6]!.day).toBe('2026-09-27');
  });

  it('fills a whole column when today ends the week', () => {
    const grid = yearGrid(new Map(), '2026-10-03', { weeks: 1 });
    expect(grid[0]!.every((d) => d !== null)).toBe(true);
  });

  it('spans a year of whole weeks by default, across both daylight-saving changes', () => {
    const grid = yearGrid(new Map(), '2026-09-30');
    expect(grid).toHaveLength(53);
    const days = grid.flat().filter((d) => d !== null);
    expect(days[0]!.day).toBe('2025-09-28');
    expect(days.at(-1)!.day).toBe('2026-09-30');
    expect(new Set(days.map((d) => d.day)).size).toBe(days.length);
    expect(days.every((d, i) => i === 0 || addDays(days[i - 1]!.day, 1) === d.day)).toBe(true);
  });
});

describe('monthStarts', () => {
  it('labels each month where its first week begins, the partial first one only with room', () => {
    const labels = monthStarts(yearGrid(new Map(), '2026-09-30'));
    // The grid opens on 28 September 2025; October begins in the next column.
    expect(labels.has(0)).toBe(false);
    expect([...labels.values()].map((day) => day.slice(0, 7))).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
  });

  it('keeps the month under way even in the last column', () => {
    const labels = monthStarts(yearGrid(new Map(), '2026-10-08'));
    expect(labels.get(52)).toBe('2026-10-04');
    expect([...labels.values()].at(-2)!.slice(0, 7)).toBe('2026-09');
  });
});

describe('monthTotals', () => {
  it('sums days by calendar month', () => {
    expect(
      monthTotals([
        { day: '2026-08-30', ms: 0 },
        { day: '2026-08-31', ms: 2 * MIN },
        { day: '2026-09-01', ms: 6 * MIN },
        { day: '2026-09-02', ms: 5 * MIN },
        { day: '2026-09-03', ms: 0 },
      ]),
    ).toEqual([
      { month: '2026-08', practised: 1, reached: 0, ms: 2 * MIN },
      { month: '2026-09', practised: 2, reached: 2, ms: 11 * MIN },
    ]);
  });
});

describe('practiceLog', () => {
  it('puts it together with an injected clock and time zone', () => {
    const now = Date.UTC(2026, 8, 25, 2, 0); // 10:00 in Shanghai
    const at = (day: number, hourUtc: number) => Date.UTC(2026, 8, day, hourUtc);
    const log = practiceLog(
      [
        { startedAt: at(23, 1), activeMs: 6 * MIN },
        { startedAt: at(24, 1), activeMs: 2 * MIN },
        { startedAt: at(24, 3), activeMs: 4 * MIN },
        { startedAt: at(25, 1), activeMs: 90_000 },
      ],
      { now, timeZone: SHANGHAI },
    );
    expect(log).toMatchObject({
      today: '2026-09-25',
      todayMs: 90_000,
      currentStreak: 2,
      longestStreak: 2,
    });
    expect(log.history.at(-1)).toEqual({ day: '2026-09-25', ms: 90_000 });
    expect(log.history.at(-2)).toEqual({ day: '2026-09-24', ms: 6 * MIN });
  });

  it('moves "today" at local midnight, not UTC midnight', () => {
    const sessions = [{ startedAt: Date.UTC(2026, 8, 24, 12), activeMs: 6 * MIN }];
    // 23:59:59 and 00:00:00 in Shanghai on the night of the 24th.
    const before = practiceLog(sessions, {
      now: Date.UTC(2026, 8, 24, 15, 59, 59),
      timeZone: SHANGHAI,
    });
    const after = practiceLog(sessions, { now: Date.UTC(2026, 8, 24, 16), timeZone: SHANGHAI });
    expect(before).toMatchObject({ today: '2026-09-24', todayMs: 6 * MIN, currentStreak: 1 });
    expect(after).toMatchObject({ today: '2026-09-25', todayMs: 0, currentStreak: 1 });
  });
});
