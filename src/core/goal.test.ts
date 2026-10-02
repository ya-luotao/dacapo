import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOAL_MINUTES,
  GOAL_MINUTES,
  goalMsOn,
  goalOn,
  isGoalMinutes,
  parseGoalHistory,
  readGoalHistory,
  withGoal,
  type GoalHistory,
} from './goal.ts';
import {
  currentStreak,
  dayHistory,
  goalSteps,
  levelOn,
  longestStreak,
  monthTotals,
  practiceLog,
  STREAK_GOAL_MS,
  yearGrid,
  type DayKey,
} from './streak.ts';

const MIN = 60_000;
const totals = (entries: Record<DayKey, number>) => new Map(Object.entries(entries));

describe('the goals to choose from', () => {
  it('are 5, 10, 15, 20, 30 and 45 minutes, five unless chosen', () => {
    expect(GOAL_MINUTES).toEqual([5, 10, 15, 20, 30, 45]);
    expect(DEFAULT_GOAL_MINUTES).toBe(5);
    // The goal before a choice is the streak's own.
    expect(DEFAULT_GOAL_MINUTES * MIN).toBe(STREAK_GOAL_MS);
    expect(GOAL_MINUTES.every(isGoalMinutes)).toBe(true);
    for (const other of [0, 7, 25, 60, '20', null, undefined, 20.5]) {
      expect(isGoalMinutes(other), String(other)).toBe(false);
    }
  });
});

describe('goalOn', () => {
  const history: GoalHistory = [
    ['2026-09-10', 20],
    ['2026-09-24', 10],
  ];

  it('is five minutes before the first change, and with none', () => {
    expect(goalOn([], '2026-09-24')).toBe(5);
    expect(goalOn(history, '2026-09-09')).toBe(5);
    expect(goalOn(history, '2020-01-01')).toBe(5);
  });

  it('takes a change from its own day on', () => {
    expect(goalOn(history, '2026-09-10')).toBe(20);
    expect(goalOn(history, '2026-09-23')).toBe(20);
    expect(goalOn(history, '2026-09-24')).toBe(10);
    expect(goalOn(history, '2027-01-01')).toBe(10);
  });

  it('gives each day’s goal in ms, for the streak’s rules', () => {
    const goal = goalMsOn(history);
    expect(goal('2026-09-09')).toBe(5 * MIN);
    expect(goal('2026-09-10')).toBe(20 * MIN);
    expect(goal('2026-09-30')).toBe(10 * MIN);
    expect(goalMsOn([])('2026-09-30')).toBe(STREAK_GOAL_MS);
  });
});

describe('the history read back', () => {
  it('is read field by field: a day of the calendar and one of the goals', () => {
    expect(
      readGoalHistory([
        ['2026-09-10', 20],
        ['2026-09-24', 45],
      ]),
    ).toEqual([
      ['2026-09-10', 20],
      ['2026-09-24', 45],
    ]);
    expect(readGoalHistory([])).toEqual([]);
  });

  it('comes back in order, the last of a day’s changes kept', () => {
    expect(
      readGoalHistory([
        ['2026-09-24', 30],
        ['2026-09-10', 20],
        ['2026-09-24', 10],
      ]),
    ).toEqual([
      ['2026-09-10', 20],
      ['2026-09-24', 10],
    ]);
  });

  it.each([
    ['nothing kept', null],
    ['not a list', { day: '2026-09-10', minutes: 20 }],
    ['a number', 20],
    ['a change that is not a pair', [['2026-09-10']]],
    ['a change with more than its two fields', [['2026-09-10', 20, 30]]],
    ['a change as an object', [{ day: '2026-09-10', minutes: 20 }]],
    ['a goal that is not one of the six', [['2026-09-10', 25]]],
    ['a goal as text', [['2026-09-10', '20']]],
    ['a day that is no date', [['yesterday', 20]]],
    ['a day the calendar does not have', [['2026-02-30', 20]]],
    ['a day as a number', [[20260910, 20]]],
    [
      'one damaged change among good ones',
      [
        ['2026-09-10', 20],
        ['2026-09-11', 0],
      ],
    ],
    [
      'more changes than a preference holds',
      Array.from({ length: 2001 }, () => ['2026-09-10', 20]),
    ],
  ])('a damaged preference (%s) means five minutes for every day', (_, value) => {
    expect(readGoalHistory(value)).toEqual([]);
    expect(goalOn(readGoalHistory(value), '2026-09-24')).toBe(5);
    // An export file is stricter: what cannot be read is named, not taken for no history.
    expect(parseGoalHistory(value)).toBeNull();
  });
});

describe('withGoal', () => {
  it('keeps each change with its day, so the days before keep their goal', () => {
    const first = withGoal([], '2026-09-10', 20);
    expect(first).toEqual([['2026-09-10', 20]]);
    const second = withGoal(first, '2026-09-24', 10);
    expect(second).toEqual([
      ['2026-09-10', 20],
      ['2026-09-24', 10],
    ]);
    expect(goalOn(second, '2026-09-09')).toBe(5);
    expect(goalOn(second, '2026-09-23')).toBe(20);
    expect(goalOn(second, '2026-09-24')).toBe(10);
    // What it was given is left as it was.
    expect(first).toEqual([['2026-09-10', 20]]);
  });

  it('keeps the last of the changes made on one day', () => {
    let history = withGoal([], '2026-09-10', 20);
    history = withGoal(history, '2026-09-10', 45);
    history = withGoal(history, '2026-09-10', 15);
    expect(history).toEqual([['2026-09-10', 15]]);
  });

  it('leaves no change when the goal is put back on the same day', () => {
    expect(withGoal(withGoal([], '2026-09-10', 20), '2026-09-10', 5)).toEqual([]);
    const history: GoalHistory = [['2026-09-10', 20]];
    expect(withGoal(withGoal(history, '2026-09-24', 30), '2026-09-24', 20)).toEqual(history);
    // Choosing the goal already in force changes nothing.
    expect(withGoal(history, '2026-09-24', 20)).toEqual(history);
    expect(withGoal([], '2026-09-24', 5)).toEqual([]);
  });

  it('drops changes dated after the day: the choice counts from today', () => {
    const ahead: GoalHistory = [
      ['2026-09-10', 20],
      ['2026-09-26', 45],
    ];
    const history = withGoal(ahead, '2026-09-24', 10);
    expect(history).toEqual([
      ['2026-09-10', 20],
      ['2026-09-24', 10],
    ]);
    expect(goalOn(history, '2026-09-27')).toBe(10);
  });

  it('writes what it reads back', () => {
    const history = withGoal(withGoal([], '2026-09-10', 20), '2026-09-24', 10);
    expect(readGoalHistory(JSON.parse(JSON.stringify(history)))).toEqual(history);
  });
});

describe('the streak across a change of the goal', () => {
  // Five days at six or seven minutes, then the goal becomes twenty on the 25th.
  const earned = {
    '2026-09-20': 6 * MIN,
    '2026-09-21': 7 * MIN,
    '2026-09-22': 6 * MIN,
    '2026-09-23': 12 * MIN,
    '2026-09-24': 6 * MIN,
  };
  const goal = goalMsOn([['2026-09-25', 20]]);

  it('keeps a streak earned at five minutes when the goal becomes twenty', () => {
    expect(currentStreak(totals(earned), '2026-09-25', goal)).toBe(5);
    expect(longestStreak(totals(earned), goal)).toBe(5);
    // Judged by twenty minutes throughout, none of those days would count.
    expect(currentStreak(totals(earned), '2026-09-25', 20 * MIN)).toBe(0);
    expect(longestStreak(totals(earned), 20 * MIN)).toBe(0);
  });

  it('goes on with a day that reaches the new goal', () => {
    const map = totals({ ...earned, '2026-09-25': 20 * MIN });
    expect(currentStreak(map, '2026-09-25', goal)).toBe(6);
    expect(longestStreak(map, goal)).toBe(6);
  });

  it('is not broken by today while today is under the new goal', () => {
    const map = totals({ ...earned, '2026-09-25': 8 * MIN });
    expect(currentStreak(map, '2026-09-25', goal)).toBe(5);
  });

  it('is broken by a day after the change that reached five minutes but not twenty', () => {
    const map = totals({ ...earned, '2026-09-25': 8 * MIN, '2026-09-26': 25 * MIN });
    expect(currentStreak(map, '2026-09-26', goal)).toBe(1);
    expect(currentStreak(map, '2026-09-27', goal)).toBe(1);
    // The streak earned before the change is still the longest.
    expect(longestStreak(map, goal)).toBe(5);
    // With the goal left at five, the same days run on.
    expect(currentStreak(map, '2026-09-26')).toBe(7);
  });

  it('counts a day that would not reach a goal lowered since', () => {
    // Twenty minutes until the 23rd, then ten: the 22nd (12 min) missed its goal, the 24th did not.
    const lowered = goalMsOn([
      ['2026-09-01', 20],
      ['2026-09-23', 10],
    ]);
    const map = totals({
      '2026-09-21': 25 * MIN,
      '2026-09-22': 12 * MIN,
      '2026-09-23': 12 * MIN,
      '2026-09-24': 12 * MIN,
    });
    expect(currentStreak(map, '2026-09-24', lowered)).toBe(2);
    expect(longestStreak(map, lowered)).toBe(2);
  });

  it('is what the practice log shows, with today’s goal', () => {
    const sessions = Object.entries({ ...earned, '2026-09-25': 8 * MIN }).map(([day, ms]) => ({
      startedAt: Date.parse(`${day}T10:00:00Z`),
      activeMs: ms,
    }));
    const now = Date.parse('2026-09-25T20:00:00Z');
    const log = practiceLog(sessions, { now, timeZone: 'UTC', goal });
    expect(log).toMatchObject({
      today: '2026-09-25',
      todayMs: 8 * MIN,
      goalMs: 20 * MIN,
      currentStreak: 5,
      longestStreak: 5,
    });
    // Without a goal of one's own, five minutes: today counts too.
    expect(practiceLog(sessions, { now, timeZone: 'UTC' })).toMatchObject({
      goalMs: STREAK_GOAL_MS,
      currentStreak: 6,
      longestStreak: 6,
    });
  });
});

describe('the goal line of the 30-day chart', () => {
  const history = dayHistory(new Map(), '2026-09-25');

  it('is one level stretch when the goal never changed', () => {
    expect(goalSteps(history, STREAK_GOAL_MS)).toEqual([{ start: 0, days: 30, goalMs: 5 * MIN }]);
    expect(goalSteps(history, goalMsOn([]))).toEqual([{ start: 0, days: 30, goalMs: 5 * MIN }]);
    // A change before the chart's first day is the goal of every day on it.
    expect(goalSteps(history, goalMsOn([['2026-01-01', 15]]))).toEqual([
      { start: 0, days: 30, goalMs: 15 * MIN },
    ]);
  });

  it('steps on the day the goal was changed', () => {
    // The chart runs from 27 August to 25 September: the 10th is its 15th day.
    expect(history[14]!.day).toBe('2026-09-10');
    expect(
      goalSteps(
        history,
        goalMsOn([
          ['2026-09-10', 20],
          ['2026-09-25', 10],
        ]),
      ),
    ).toEqual([
      { start: 0, days: 14, goalMs: 5 * MIN },
      { start: 14, days: 15, goalMs: 20 * MIN },
      { start: 29, days: 1, goalMs: 10 * MIN },
    ]);
  });

  it('joins two stretches that have the same goal', () => {
    // Changed and put back another day: three stretches, the outer two at five minutes.
    const steps = goalSteps(
      history,
      goalMsOn([
        ['2026-09-10', 20],
        ['2026-09-12', 5],
      ]),
    );
    expect(steps.map((s) => [s.start, s.days, s.goalMs / MIN])).toEqual([
      [0, 14, 5],
      [14, 2, 20],
      [16, 14, 5],
    ]);
    expect(steps.reduce((days, s) => days + s.days, 0)).toBe(30);
  });

  it('has no stretch without days', () => {
    expect(goalSteps([], STREAK_GOAL_MS)).toEqual([]);
  });
});

describe('the year grid’s shades', () => {
  const goal = goalMsOn([['2026-09-25', 20]]);

  it('are 1×, 3× and 6× the goal of each day', () => {
    // Before the change, against five minutes.
    expect(levelOn({ day: '2026-09-24', ms: 4 * MIN }, goal)).toBe(1);
    expect(levelOn({ day: '2026-09-24', ms: 5 * MIN }, goal)).toBe(2);
    expect(levelOn({ day: '2026-09-24', ms: 15 * MIN }, goal)).toBe(3);
    expect(levelOn({ day: '2026-09-24', ms: 30 * MIN }, goal)).toBe(4);
    // From the change on, against twenty.
    expect(levelOn({ day: '2026-09-25', ms: 0 }, goal)).toBe(0);
    expect(levelOn({ day: '2026-09-25', ms: 15 * MIN }, goal)).toBe(1);
    expect(levelOn({ day: '2026-09-25', ms: 20 * MIN }, goal)).toBe(2);
    expect(levelOn({ day: '2026-09-25', ms: 59 * MIN }, goal)).toBe(2);
    expect(levelOn({ day: '2026-09-25', ms: 60 * MIN }, goal)).toBe(3);
    expect(levelOn({ day: '2026-09-25', ms: 120 * MIN }, goal)).toBe(4);
  });

  it('leave the past as it was shaded when the goal changes', () => {
    const map = totals({
      '2026-09-21': 6 * MIN,
      '2026-09-23': 16 * MIN,
      '2026-09-24': 31 * MIN,
      '2026-09-25': 16 * MIN,
      '2026-09-26': 31 * MIN,
    });
    const days = yearGrid(map, '2026-09-26', { weeks: 1 })
      .flat()
      .filter((d) => d !== null);
    expect(days.map((d) => d.day.slice(8))).toEqual(['20', '21', '22', '23', '24', '25', '26']);
    const before = days.map((d) => levelOn(d));
    const after = days.map((d) => levelOn(d, goal));
    expect(before).toEqual([0, 2, 0, 3, 4, 3, 4]);
    // The same shades up to the day of the change; the days from it on are against twenty.
    expect(after).toEqual([0, 2, 0, 3, 4, 1, 2]);
  });

  it('count a month’s days at goal each by its own goal', () => {
    const days = [
      { day: '2026-09-23', ms: 6 * MIN },
      { day: '2026-09-24', ms: 0 },
      { day: '2026-09-25', ms: 6 * MIN },
      { day: '2026-09-26', ms: 21 * MIN },
    ];
    expect(monthTotals(days, goal)).toEqual([
      { month: '2026-09', practised: 3, reached: 2, ms: 33 * MIN },
    ]);
    expect(monthTotals(days)[0]!.reached).toBe(3);
  });
});
