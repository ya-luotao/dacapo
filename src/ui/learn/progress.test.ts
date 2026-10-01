// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import type { TaskProgress } from '../../core/assignmentRecords.ts';
import { dayKey } from '../../core/streak.ts';
import type { TodayPlan as Plan } from '../../core/todayRecords.ts';
import { I18nContext, type I18nContextValue } from '../../i18n/context.ts';
import { lessonBySlug } from '../../learn/lessons.ts';
import type { InputSystem } from '../../input/index.ts';
import { createMemoryRepository, type OpenResult } from '../../storage/repository.ts';
import { useChecklist } from '../assignments/useChecklist.ts';
import { HomePage } from '../home/HomePage.tsx';
import { InputContext } from '../input/context.ts';
import { PracticeProvider } from '../practice/PracticeProvider.tsx';
import { createPracticeStore, type PracticeStore } from '../practice/store.ts';
import { WeekRecap } from '../progress/WeekRecap.tsx';
import { WhereYouAre } from '../progress/WhereYouAre.tsx';
import { TodayPlan } from '../today/TodayPlan.tsx';
import { LearnPage } from './LearnPage.tsx';
import { LessonContext, useCompleteLesson } from './lesson.ts';
import { readLegacyLessons, useLessonsDone } from './progress.ts';

// The lessons' ticks are records of the practice store (docs/LEARN.md, "The tick is a record"):
// every page that asks whether a lesson is finished reads them there, and none reads the
// preference an earlier version kept them in.

const LEGACY = 'dacapo.learn.done';
const TODAY = dayKey(Date.now());

let root: Root | null = null;
let host: HTMLElement;
let stop: (() => void) | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  stop?.();
  stop = null;
  host.remove();
  localStorage.clear();
  vi.restoreAllMocks();
});

/** A store over a repository in memory; with `gate`, storage opens only once it resolves. */
function startStore(gate: Promise<void> = Promise.resolve()): PracticeStore {
  const repository = createMemoryRepository();
  const store = createPracticeStore({
    open: async (): Promise<OpenResult> => {
      await gate;
      return { repository, failure: null };
    },
    legacyLessons: readLegacyLessons,
  });
  stop = store.start();
  return store;
}

const loaded = (store: PracticeStore) =>
  act(async () => {
    await vi.waitFor(() => expect(store.getStatus().loaded).toBe(true));
    await store.settled();
  });

/** Renders `children` inside what the pages need: the words (as keys), the store, a router. */
function mount(store: PracticeStore, children: ReactNode) {
  const i18n = {
    locale: 'en',
    override: null,
    setOverride: () => undefined,
    t: (key: string, vars?: Record<string, string | number>) =>
      vars ? `${key} ${JSON.stringify(vars)}` : key,
  };
  // The first visit's specimen listens for keys held: none are.
  const idle = { held: new Map(), sustained: new Set() };
  const input = {
    hub: { subscribe: () => () => undefined, getState: () => idle },
  } as unknown as InputSystem;
  root = createRoot(host);
  act(() =>
    root!.render(
      createElement(
        I18nContext,
        { value: i18n as unknown as I18nContextValue },
        createElement(
          InputContext,
          { value: input },
          createElement(PracticeProvider, {
            store,
            children: createElement(Router, {
              hook: memoryLocation({ path: '/' }).hook,
              children,
            }),
          }),
        ),
      ),
    ),
  );
}

/** Lets the pages' lazy parts and the store's reads settle. */
const settle = (store: PracticeStore) =>
  act(async () => {
    await store.settled();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('the preference an earlier version kept', () => {
  it('is read as ticks without a time, and never written', async () => {
    localStorage.setItem(LEGACY, 'keyboard,staff');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    expect(readLegacyLessons()).toEqual([
      { slug: 'keyboard', doneAt: 0 },
      { slug: 'staff', doneAt: 0 },
    ]);
    const store = startStore();
    await loaded(store);
    // Moved into the store; a lesson finished now is a record, not a word in the preference.
    const now = vi.spyOn(Date, 'now').mockReturnValue(5000);
    store.markLesson('rhythm');
    now.mockRestore();
    await store.settled();
    expect(store.getSnapshot().lessons).toEqual([
      { slug: 'keyboard', doneAt: 0 },
      { slug: 'rhythm', doneAt: 5000 },
      { slug: 'staff', doneAt: 0 },
    ]);
    expect(localStorage.getItem(LEGACY)).toBe('keyboard,staff');
    expect(set.mock.calls.filter(([key]) => key === LEGACY)).toEqual([]);
    expect(remove.mock.calls.filter(([key]) => key === LEGACY)).toEqual([]);
  });

  it('is none where there is no preference', () => {
    expect(readLegacyLessons()).toEqual([]);
  });
});

describe('the pages read the ticks from the store', () => {
  it('useLessonsDone follows the store: empty until it is read, then every tick as it is earned', async () => {
    localStorage.setItem(LEGACY, 'keyboard');
    let release: () => void = () => {};
    const store = startStore(new Promise<void>((resolve) => (release = resolve)));
    const seen: string[][] = [];
    function Probe() {
      seen.push([...useLessonsDone()].sort());
      return null;
    }
    mount(store, createElement(Probe));
    expect(seen.at(-1)).toEqual([]);
    release();
    await loaded(store);
    expect(seen.at(-1)).toEqual(['keyboard']);
    act(() => store.markLesson('staff'));
    expect(seen.at(-1)).toEqual(['keyboard', 'staff']);
  });

  it('a lesson’s last exercise ticks it in the store, and makes its reader a returning player', async () => {
    const store = startStore();
    await loaded(store);
    let complete: () => void = () => undefined;
    function Exercise() {
      complete = useCompleteLesson();
      return null;
    }
    const lesson = { slug: 'staff', language: 'en' as const, active: null, setActive: () => {} };
    mount(store, createElement(LessonContext, { value: lesson }, createElement(Exercise)));
    const now = vi.spyOn(Date, 'now').mockReturnValue(7000);
    act(() => complete());
    expect(store.getSnapshot().lessons).toEqual([{ slug: 'staff', doneAt: 7000 }]);
    // Done again later: the first time stays.
    now.mockReturnValue(9000);
    act(() => complete());
    expect(store.getSnapshot().lessons).toEqual([{ slug: 'staff', doneAt: 7000 }]);
    expect(localStorage.getItem('dacapo.returning')).toBe('1');
    expect(localStorage.getItem(LEGACY)).toBeNull();
  });

  it('the Learn page ticks a lesson finished, once the records are read', async () => {
    let release: () => void = () => {};
    const store = startStore(new Promise<void>((resolve) => (release = resolve)));
    mount(store, createElement(LearnPage));
    const meta = () =>
      [...host.querySelectorAll('.contents-meta')].map((el) => el.textContent?.trim());
    // Until then a lesson says neither "done" nor how long it takes.
    expect(meta().slice(0, 2)).toEqual(['', '']);
    release();
    await loaded(store);
    expect(meta()[1]).toBe('learn.minutes {"n":15}');
    act(() => store.markLesson('staff'));
    expect(meta()[0]).toBe('learn.minutes {"n":10}');
    expect(meta()[1]).toBe('✓ learn.done');
  });

  it('the checklist’s lesson task ticks when the lesson is finished', async () => {
    const store = startStore();
    await loaded(store);
    const assignment = {
      start: TODAY,
      due: TODAY,
      tasks: [{ kind: 'lesson' as const, id: 't1', slug: 'staff' }],
    };
    let progress: TaskProgress[] | null = null;
    function Probe() {
      progress = useChecklist(assignment);
      return null;
    }
    mount(store, createElement(Probe));
    await settle(store);
    expect(progress).toEqual([{ kind: 'lesson', done: 0, target: 1, met: false }]);
    act(() => store.markLesson('staff'));
    expect(progress).toEqual([{ kind: 'lesson', done: 1, target: 1, met: true }]);
  });

  it('today’s lesson step ticks when the lesson is finished, and the plan stays as it was', async () => {
    const kept: Plan = {
      day: TODAY,
      minutes: 20,
      lessonsDone: ['keyboard'],
      steps: [
        {
          kind: 'task',
          id: 'new-lesson',
          part: 'new',
          why: { kind: 'lesson', n: 2, of: 15 },
          task: { kind: 'lesson', id: 'new-lesson', slug: 'staff' },
        },
      ],
    };
    localStorage.setItem('dacapo.today', JSON.stringify(kept));
    localStorage.setItem(LEGACY, 'keyboard');
    const store = startStore();
    await loaded(store);
    mount(
      store,
      createElement(TodayPlan, {
        today: TODAY,
        minutes: 20,
        waiting: null,
        week: false,
        onSteps: () => undefined,
      }),
    );
    await settle(store);
    const steps = () => [...host.querySelectorAll('.today-step')].map((el) => el.className);
    expect(steps()).toEqual(['today-step']);
    act(() => store.markLesson('staff'));
    expect(steps()).toEqual(['today-step is-done']);
    expect(JSON.parse(localStorage.getItem('dacapo.today')!)).toEqual(kept);
  });

  it('the plan is not made until the ticks are read: the lesson proposed is the first not ticked', async () => {
    localStorage.setItem(LEGACY, 'keyboard,staff');
    let release: () => void = () => {};
    const store = startStore(new Promise<void>((resolve) => (release = resolve)));
    mount(
      store,
      createElement(TodayPlan, {
        today: TODAY,
        minutes: 20,
        waiting: createElement('p', { className: 'waiting' }),
        week: false,
        onSteps: () => undefined,
      }),
    );
    // (The store's writes wait for storage to open: only the page is given a moment here.)
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(host.querySelector('.waiting')).not.toBeNull();
    expect(localStorage.getItem('dacapo.today')).toBeNull();
    release();
    await loaded(store);
    await settle(store);
    const plan = JSON.parse(localStorage.getItem('dacapo.today')!) as Plan;
    expect(plan.lessonsDone).toEqual(['keyboard', 'staff']);
    expect(
      plan.steps.find((step) => step.kind === 'task' && step.task.kind === 'lesson'),
    ).toMatchObject({ task: { slug: 'landmarks' } });
  });

  it('a plan made over records that are there and cannot be seen is shown, and not kept for the day', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const cases: [OpenResult, boolean][] = [
      // A database of a later version: a reload has the records, and makes the day's plan.
      [{ repository: createMemoryRepository(), failure: 'newer' }, false],
      // A read that failed.
      [
        {
          repository: {
            ...createMemoryRepository(),
            load: () => Promise.reject(new Error('broken')),
          },
          failure: null,
        },
        false,
      ],
      // No storage to use: this tab holds all there is, and the plan is kept as ever.
      [{ repository: createMemoryRepository(), failure: 'error' }, true],
      [{ repository: createMemoryRepository(), failure: null }, true],
    ];
    for (const [opened, kept] of cases) {
      const store = createPracticeStore({ open: () => Promise.resolve(opened) });
      stop = store.start();
      await loaded(store);
      mount(
        store,
        createElement(TodayPlan, {
          today: TODAY,
          minutes: 20,
          waiting: null,
          week: false,
          onSteps: () => undefined,
        }),
      );
      await settle(store);
      expect(host.querySelectorAll('.today-step').length).toBeGreaterThan(0);
      expect(localStorage.getItem('dacapo.today') !== null).toBe(kept);
      act(() => root?.unmount());
      root = null;
      stop();
      stop = null;
      localStorage.clear();
    }
  });

  it('the week’s recap names a lesson finished in the week, and never a tick moved without a time', async () => {
    const title = (slug: string) => lessonBySlug(slug)!.title.en;
    /** Each week shown: its heading, and its "lessons finished" row with the lessons it names. */
    const weeks = () =>
      [...host.querySelectorAll('.recap-week')].map((week) => {
        const row = [...week.querySelectorAll('.recap-rows li')].find((li) =>
          li.querySelector('.recap-what')?.textContent?.startsWith('progress.week.lessons'),
        );
        return {
          week: week.querySelector('h2')?.textContent,
          lessons: row
            ? {
                says: row.querySelector('.recap-what')?.textContent,
                names: [...row.querySelectorAll('.recap-names span')].map((el) => el.textContent),
              }
            : null,
        };
      });

    // Only a tick an earlier version kept, moved into the store without a time: ticked from
    // before anything else, and no week's lesson.
    localStorage.setItem(LEGACY, 'keyboard');
    const moved = startStore();
    await loaded(moved);
    expect(moved.getSnapshot().lessons).toEqual([{ slug: 'keyboard', doneAt: 0 }]);
    mount(moved, createElement(WeekRecap, { today: TODAY }));
    await settle(moved);
    expect(weeks()).toEqual([{ week: 'progress.week.current', lessons: null }]);
    // A lesson finished now is this week's, at once.
    act(() => moved.markLesson('staff'));
    await settle(moved);
    expect(weeks()).toEqual([
      {
        week: 'progress.week.current',
        lessons: { says: 'progress.week.lessons.one', names: [title('staff')] },
      },
    ]);
    act(() => root?.unmount());
    root = null;
    stop?.();

    // Stored ticks with their times, as another device or an import left them: each lesson in
    // the week it was finished in, the one without a time in neither.
    const repository = createMemoryRepository();
    await repository.markLessons([
      { slug: 'keyboard', doneAt: 0 },
      { slug: 'staff', doneAt: Date.now() - 7 * 86_400_000 },
      { slug: 'landmarks', doneAt: Date.now() },
      { slug: 'rhythm', doneAt: Date.now() },
    ]);
    const store = createPracticeStore({
      open: () => Promise.resolve({ repository, failure: null }),
    });
    stop = store.start();
    await loaded(store);
    mount(store, createElement(WeekRecap, { today: TODAY }));
    await settle(store);
    expect(weeks()).toEqual([
      {
        week: 'progress.week.last',
        lessons: { says: 'progress.week.lessons.one', names: [title('staff')] },
      },
      {
        week: 'progress.week.current',
        lessons: {
          says: 'progress.week.lessons.other {"n":2}',
          names: [title('landmarks'), title('rhythm')],
        },
      },
    ]);
    expect(host.textContent).not.toContain(title('keyboard'));
  });

  it('Where you are counts the lessons ticked in the store', async () => {
    localStorage.setItem(LEGACY, 'keyboard');
    const store = startStore();
    await loaded(store);
    mount(store, createElement(WhereYouAre, { today: TODAY }));
    await settle(store);
    expect(host.textContent).toContain('where.lessons {"done":1,"of":15}');
    act(() => store.markLesson('staff'));
    expect(host.textContent).toContain('where.lessons {"done":2,"of":15}');
    // The next lesson is the first not ticked.
    expect(host.querySelector('a[href="/learn/landmarks"]')).not.toBeNull();
  });
});

describe('the home page', () => {
  const page = () => (host.querySelector('.today') ? 'today' : 'first visit');

  it('opens on Today at once for someone whose only record is a tick of an earlier version', async () => {
    localStorage.setItem(LEGACY, 'keyboard');
    let release: () => void = () => {};
    const store = startStore(new Promise<void>((resolve) => (release = resolve)));
    mount(store, createElement(HomePage));
    // Before the records are read, and with no flag kept yet: never the first visit's page.
    expect(store.getStatus().loaded).toBe(false);
    expect(localStorage.getItem('dacapo.returning')).toBeNull();
    expect(page()).toBe('today');
    release();
    await loaded(store);
    await settle(store);
    expect(page()).toBe('today');
    expect(localStorage.getItem('dacapo.returning')).toBe('1');
  });

  it('opens on Today at once for someone whose only record is a tick in the store', async () => {
    // As the last visit left it: the flag is kept once a tick or a session exists.
    localStorage.setItem('dacapo.returning', '1');
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const repository = createMemoryRepository();
    await repository.markLessons([{ slug: 'staff', doneAt: 5000 }]);
    const store = createPracticeStore({
      open: async () => {
        await gate;
        return { repository, failure: null };
      },
    });
    stop = store.start();
    mount(store, createElement(HomePage));
    expect(page()).toBe('today');
    release();
    await loaded(store);
    await settle(store);
    expect(page()).toBe('today');
    expect(localStorage.getItem('dacapo.returning')).toBe('1');
  });

  it('opens on Today at once for someone whose only record is a session', async () => {
    localStorage.setItem('dacapo.returning', '1');
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const repository = createMemoryRepository();
    await repository.putSession({
      kind: 'free',
      id: 'f1',
      startedAt: 1000,
      endedAt: 61_000,
      activeMs: 60_000,
      notes: 80,
    });
    const store = createPracticeStore({
      open: async () => {
        await gate;
        return { repository, failure: null };
      },
    });
    stop = store.start();
    mount(store, createElement(HomePage));
    expect(page()).toBe('today');
    release();
    await loaded(store);
    await settle(store);
    expect(page()).toBe('today');
  });

  it('opens on Today at once for someone who only said on the start page where they start from', async () => {
    // The answer is a preference, read at once: no flag and no record are needed.
    localStorage.setItem('dacapo.start', JSON.stringify({ from: 'player', reads: 'both' }));
    let release: () => void = () => {};
    const store = startStore(new Promise<void>((resolve) => (release = resolve)));
    mount(store, createElement(HomePage));
    expect(store.getStatus().loaded).toBe(false);
    expect(page()).toBe('today');
    release();
    await loaded(store);
    await settle(store);
    expect(page()).toBe('today');
    expect(localStorage.getItem('dacapo.returning')).toBe('1');
  });

  it('is the first visit’s page for someone with no record, and forgets a flag nothing bears out', async () => {
    localStorage.setItem('dacapo.returning', '1');
    const store = startStore();
    mount(store, createElement(HomePage));
    await loaded(store);
    await settle(store);
    expect(page()).toBe('first visit');
    expect(localStorage.getItem('dacapo.returning')).toBeNull();
    // A lesson finished: Today from then on.
    act(() => store.markLesson('keyboard'));
    expect(page()).toBe('today');
    expect(localStorage.getItem('dacapo.returning')).toBe('1');
  });

  /** A store whose storage opens as `opened` says. */
  function storeOver(opened: OpenResult): PracticeStore {
    const store = createPracticeStore({ open: () => Promise.resolve(opened) });
    stop = store.start();
    return store;
  }

  it('does not forget a returning player when the records could not be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unreadable: OpenResult[] = [
      // No storage to use (a private window, site data blocked), or it cannot be opened.
      { repository: createMemoryRepository(), failure: 'unsupported' },
      { repository: createMemoryRepository(), failure: 'error' },
      // A database made by a later version of dacapo.
      { repository: createMemoryRepository(), failure: 'newer' },
      // Storage that opens, and a read that fails.
      {
        repository: {
          ...createMemoryRepository(),
          load: () => Promise.reject(new Error('broken')),
        },
        failure: null,
      },
    ];
    for (const opened of unreadable) {
      localStorage.setItem('dacapo.returning', '1');
      const store = storeOver(opened);
      mount(store, createElement(HomePage));
      expect(page()).toBe('today');
      await loaded(store);
      await settle(store);
      // Nothing was read, so nothing says "a first visit": Today, and the flag as it was.
      expect(store.getStatus()).toMatchObject({ loaded: true, read: false });
      expect(store.getSnapshot().sessions).toEqual([]);
      expect(page()).toBe('today');
      expect(localStorage.getItem('dacapo.returning')).toBe('1');
      act(() => root?.unmount());
      root = null;
      stop?.();
      stop = null;
    }
  });

  it('is the first visit’s page where nothing can be read and nothing was known, until something is practised', async () => {
    const store = storeOver({ repository: createMemoryRepository(), failure: 'error' });
    mount(store, createElement(HomePage));
    await loaded(store);
    await settle(store);
    expect(page()).toBe('first visit');
    expect(localStorage.getItem('dacapo.returning')).toBeNull();
    // What this tab holds counts, and is remembered for the next visit.
    act(() => store.markLesson('keyboard'));
    expect(page()).toBe('today');
    expect(localStorage.getItem('dacapo.returning')).toBe('1');
  });
});
