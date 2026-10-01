// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPlan, type TodayPlan } from '../../core/today.ts';
import { PLAN_MINUTES, planRows } from '../../core/todayRecords.ts';
import {
  keptRoom,
  readKeptPlan,
  readPlanMinutes,
  readReturning,
  writeKeptPlan,
  writePlanMinutes,
  writeReturning,
} from './prefs.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

const TODAY = '2026-09-24';
const PLAN: TodayPlan = {
  day: TODAY,
  minutes: 20,
  lessonsDone: ['keyboard'],
  steps: [
    {
      kind: 'task',
      id: 'warmup-1',
      part: 'warmup',
      why: { kind: 'nextScale' },
      task: { kind: 'scale', id: 'warmup-1', exercise: 'major:C:1:right', click: null, runs: 1 },
    },
    {
      kind: 'task',
      id: 'new-lesson',
      part: 'new',
      why: { kind: 'lesson', n: 2, of: 15 },
      task: { kind: 'lesson', id: 'new-lesson', slug: 'staff' },
    },
    {
      kind: 'task',
      id: 'new-1',
      part: 'new',
      why: { kind: 'level', days: null },
      task: { kind: 'level', id: 'new-1', family: 'notes', level: 'L1', goal: 1 },
    },
  ],
};

describe('what today’s plan keeps in this browser', () => {
  it('remembers that someone has practised here, and forgets it when told', () => {
    expect(readReturning()).toBe(false);
    writeReturning(true);
    expect(readReturning()).toBe(true);
    expect(localStorage.getItem('dacapo.returning')).toBe('1');
    writeReturning(false);
    expect(readReturning()).toBe(false);
    expect(localStorage.getItem('dacapo.returning')).toBeNull();
  });

  it('keeps the length, 20 minutes unless one of the four was chosen', () => {
    expect(readPlanMinutes()).toBe(20);
    for (const minutes of PLAN_MINUTES) {
      writePlanMinutes(minutes);
      expect(readPlanMinutes()).toBe(minutes);
    }
    localStorage.setItem('dacapo.today.minutes', '25');
    expect(readPlanMinutes()).toBe(20);
  });

  it('keeps the plan of the day as it was made', () => {
    expect(readKeptPlan()).toBeNull();
    writeKeptPlan(PLAN);
    expect(readPlan(readKeptPlan())).toEqual(PLAN);
    localStorage.setItem('dacapo.today', '{"day": ');
    expect(readKeptPlan()).toBeNull();
  });

  it('keeps room for the rows of the plan that will be shown', () => {
    // Nothing kept: the most a plan of this length has, a part to each of the four.
    expect(keptRoom(TODAY, 20)).toEqual({ rows: 6, parts: 4 });
    expect(PLAN_MINUTES.map(planRows)).toEqual([4, 6, 7, 10]);
    writeKeptPlan(PLAN);
    expect(keptRoom(TODAY, 20)).toEqual({ rows: 3, parts: 2 });
    // Yesterday's plan of this length is the best guess at today's.
    expect(keptRoom('2026-09-25', 20)).toEqual({ rows: 3, parts: 2 });
    // Another length is made anew.
    expect(keptRoom(TODAY, 45)).toEqual({ rows: 10, parts: 4 });
    // An empty plan today is the plan; an old empty one says nothing of today's.
    writeKeptPlan({ ...PLAN, steps: [] });
    expect(keptRoom(TODAY, 20)).toEqual({ rows: 0, parts: 0 });
    expect(keptRoom('2026-09-25', 20)).toEqual({ rows: 6, parts: 4 });
    for (const stored of ['7', '{"minutes":20,"steps":"many"}', '{"minutes":20}']) {
      localStorage.setItem('dacapo.today', stored);
      expect(keptRoom(TODAY, 20), stored).toEqual({ rows: 6, parts: 4 });
    }
  });

  it('never breaks the home page when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    expect(() => {
      writeReturning(true);
      writePlanMinutes(30);
      writeKeptPlan(PLAN);
    }).not.toThrow();
    expect(readReturning()).toBe(false);
    expect(readPlanMinutes()).toBe(20);
    expect(readKeptPlan()).toBeNull();
    expect(keptRoom(TODAY, 20)).toEqual({ rows: 6, parts: 4 });
  });
});
