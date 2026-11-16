// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Router } from 'wouter';

vi.mock('../notation/verovio.ts', () => ({
  prefetchVerovio: () => undefined,
}));

vi.mock('../notation/ScoreView.tsx', () => ({
  ScoreView: () => null,
}));

import type { Assignment, StoredAssignment } from '../../core/assignmentRecords.ts';
import { DEFAULT_SETTINGS } from '../../core/metronomeSettings.ts';
import { dayKey, addDays } from '../../core/streak.ts';
import type { TodayPlan } from '../../core/todayRecords.ts';
import type { Dictionary, MessageKey } from '../../i18n/en.ts';
import { I18nContext, type I18nContextValue, type Translate } from '../../i18n/context.ts';
import { formatMessage, loadLocale } from '../../i18n/locale.ts';
import { createInputSystem } from '../../input/index.ts';
import { createMetronome } from '../../output/metronome.ts';
import { createMemoryRepository } from '../../storage/repository.ts';
import { ProgressionPage } from '../harmony/ProgressionPage.tsx';
import { useHashRoute } from '../hashRoute.ts';
import { InputContext } from '../input/context.ts';
import { MetronomeContext, createOfferStore } from '../metronome/context.ts';
import { PiecePage } from '../pieces/PiecePage.tsx';
import { PracticeProvider } from '../practice/PracticeProvider.tsx';
import { createPracticeStore } from '../practice/store.ts';
import { TodayFlowSlot } from '../today/TodayFlowSlot.tsx';
import { writeKeptPlan } from '../today/prefs.ts';
import { AssignmentPage } from './AssignmentPage.tsx';
import { HomeAssignment } from './HomeAssignment.tsx';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => undefined;
}

function createI18n(dictionary: Dictionary): I18nContextValue {
  const translate: Translate = (key: MessageKey, vars?: Record<string, string | number>) =>
    formatMessage(dictionary[key], vars);
  return {
    locale: 'en',
    override: null,
    setOverride: () => undefined,
    noteNaming: 'letters',
    setNoteNaming: () => undefined,
    t: translate,
    translate: () => translate,
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  const today = dayKey(Date.now());
  return {
    id: overrides.id ?? 'assign-1',
    title: overrides.title ?? 'Week 1 practice',
    note: overrides.note ?? '',
    teacher: overrides.teacher ?? 'Ms. Chen',
    start: overrides.start ?? today,
    due: overrides.due ?? addDays(today, 7),
    tasks: overrides.tasks ?? [
      { kind: 'scale', id: 't1', exercise: 'major:C:1:right', click: null, runs: 1 },
      { kind: 'lesson', id: 't2', slug: 'staff' },
      { kind: 'lesson', id: 't3', slug: 'keyboard' },
    ],
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
  };
}

function makeStored(assignment: Assignment, following = true): Omit<StoredAssignment, 'updatedAt'> {
  return {
    id: assignment.id,
    type: 'assignment',
    assignment,
    made: false,
    following,
    addedAt: assignment.createdAt,
  };
}

async function waitFor(predicate: () => boolean, limitMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > limitMs) {
      throw new Error('Timed out waiting for condition');
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

describe('Continuous Assignment Flow (?assignment=<id>)', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      cleanups.pop()!();
    }
    localStorage.clear();
    window.location.hash = '';
  });

  async function mount(hash: string, element: ReactNode) {
    window.location.hash = hash;
    const { dictionary } = await loadLocale('en');
    const i18nValue = createI18n(dictionary);
    const repository = createMemoryRepository();
    const store = createPracticeStore({
      open: () => Promise.resolve({ repository, failure: null }),
      legacyLessons: () => [],
    });
    const stopStore = store.start();
    await waitFor(() => store.getStatus().loaded);
    const input = createInputSystem();
    const metronome = createMetronome({
      clock: { now: () => performance.now(), every: () => () => undefined },
      context: () => null,
      settings: DEFAULT_SETTINGS,
      page: null,
    });
    const offers = createOfferStore();

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root: Root = createRoot(host);

    const cleanup = () => {
      metronome.dispose();
      act(() => {
        root.unmount();
      });
      stopStore();
      host.remove();
    };
    cleanups.push(cleanup);

    const render = (node: ReactNode) => {
      root.render(
        <I18nContext.Provider value={i18nValue}>
          <InputContext.Provider value={input}>
            <MetronomeContext.Provider value={{ metronome, offers }}>
              <PracticeProvider store={store}>
                <Router hook={useHashRoute}>{node}</Router>
              </PracticeProvider>
            </MetronomeContext.Provider>
          </InputContext.Provider>
        </I18nContext.Provider>,
      );
    };

    act(() => {
      render(element);
    });

    return { store, host, render, cleanup: () => undefined };
  }

  it('tags open task links on HomeAssignment with ?assignment=<id>', async () => {
    const { store, host } = await mount('#/', <HomeAssignment />);
    const assignment = makeAssignment({ id: 'home-a1' });

    act(() => {
      store.saveAssignment(makeStored(assignment));
    });

    await waitFor(() => host.querySelectorAll('.home-tasks a').length > 0);
    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.home-tasks a'));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('assignment=home-a1');
    }
  });

  it('renders Start next task and tagged task links on AssignmentPage, hiding CTA when complete or unstartable', async () => {
    const assignment = makeAssignment({
      id: 'page-a1',
      tasks: [
        { kind: 'minutes', id: 'm1', minutes: 10, days: 1 },
        { kind: 'lesson', id: 'l1', slug: 'staff' },
      ],
    });
    const { store, host } = await mount('#/assignments/page-a1', <AssignmentPage id="page-a1" />);

    act(() => {
      store.saveAssignment(makeStored(assignment));
    });

    await waitFor(() => host.querySelector('.assignment-checklist-actions a') !== null);
    const startNext = host.querySelector<HTMLAnchorElement>('.assignment-checklist-actions a');
    expect(startNext?.textContent).toBe('Start next task');
    expect(startNext?.getAttribute('href')).toBe('#/learn/staff?assignment=page-a1');

    const taskLinks = Array.from(host.querySelectorAll<HTMLAnchorElement>('.tasks a.task-start'));
    expect(taskLinks.map((a) => a.getAttribute('href'))).toEqual([
      '#/learn/staff?assignment=page-a1',
    ]);

    // Completing the only startable task leaves only unstartable `minutes` open -> no CTA.
    act(() => {
      store.markLesson('staff');
    });
    await waitFor(() => host.querySelector('.assignment-checklist-actions') === null);

    // A fully completed assignment also hides "Start next task".
    const complete = makeAssignment({
      id: 'page-a2',
      tasks: [{ kind: 'lesson', id: 'l2', slug: 'staff' }],
    });
    act(() => {
      store.saveAssignment(makeStored(complete));
    });
    const mountedDone = await mount('#/assignments/page-a2', <AssignmentPage id="page-a2" />);
    act(() => {
      mountedDone.store.saveAssignment(makeStored(complete));
      mountedDone.store.markLesson('staff');
    });
    await waitFor(() => mountedDone.host.querySelector('.tasks') !== null);
    expect(mountedDone.host.querySelector('.assignment-checklist-actions')).toBeNull();
    mountedDone.cleanup();
  });

  it('renders AssignmentNextBar via TodayFlowSlot for ?assignment=<id>, advances to open tasks, and handles last/all-done states', async () => {
    const assignment = makeAssignment({
      id: 'flow-a1',
      tasks: [
        { kind: 'scale', id: 't1', exercise: 'major:C:1:right', click: null, runs: 1 },
        { kind: 'lesson', id: 't2', slug: 'staff' },
        { kind: 'lesson', id: 't3', slug: 'keyboard' },
      ],
    });
    const { store, host } = await mount(
      '#/scales?exercise=major%3AC%3A1%3Aright&click=off&assignment=flow-a1',
      <TodayFlowSlot />,
    );

    act(() => {
      store.saveAssignment(makeStored(assignment));
      store.markLesson('staff');
    });

    await waitFor(() => host.querySelector('.assignment-next-bar') !== null);
    const bar = host.querySelector<HTMLElement>('.assignment-next-bar');
    expect(bar?.getAttribute('aria-label')).toBe('Assignment progress');
    expect(bar?.querySelector('.today-flow-progress')?.textContent).toBe('Assignment · 1 of 3');

    const pips = Array.from(host.querySelectorAll('.assignment-next-bar .today-flow-pip'));
    expect(pips).toHaveLength(3);
    expect(pips[0]?.classList.contains('is-current')).toBe(true);
    expect(pips[1]?.classList.contains('is-done')).toBe(true);
    expect(pips[2]?.classList.contains('is-done')).toBe(false);

    const backLink = host.querySelector<HTMLAnchorElement>('.assignment-next-bar .today-flow-home');
    expect(backLink?.textContent).toBe('Assignment');
    expect(backLink?.getAttribute('href')).toBe('#/assignments/flow-a1');

    const nextCta = host.querySelector<HTMLAnchorElement>('.assignment-next-bar a.button-primary');
    expect(nextCta?.textContent).toContain('Next:');
    expect(nextCta?.getAttribute('href')).toBe('#/learn/keyboard?assignment=flow-a1');

    // Navigating to the last open task (`keyboard`) wraps around to the earlier open `scale` task.
    act(() => {
      window.location.hash = '#/learn/keyboard?assignment=flow-a1';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(
      () =>
        host
          .querySelectorAll('.assignment-next-bar .today-flow-pip')[2]
          ?.classList.contains('is-current') === true,
    );
    const wrappedCta = host.querySelector<HTMLAnchorElement>(
      '.assignment-next-bar a.button-primary',
    );
    expect(wrappedCta?.getAttribute('href')).toBe(
      '#/scales?exercise=major%3AC%3A1%3Aright&click=off&assignment=flow-a1',
    );

    // Completing `keyboard` makes `scale` (current page when navigated back) the ONLY open task:
    // show primary "Back to assignment" WITHOUT falsely saying "All tasks done."
    act(() => {
      store.markLesson('keyboard');
      window.location.hash = '#/scales?exercise=major%3AC%3A1%3Aright&click=off&assignment=flow-a1';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(
      () =>
        host.querySelector('.assignment-next-bar .today-flow-progress')?.textContent ===
        'Assignment · 2 of 3',
    );
    expect(host.querySelector('.assignment-next-bar .today-flow-done')).toBeNull();
    const finishOnlyCurrent = host.querySelector<HTMLAnchorElement>(
      '.assignment-next-bar a.button-primary',
    );
    expect(finishOnlyCurrent?.textContent).toBe('Back to assignment');
    expect(finishOnlyCurrent?.getAttribute('href')).toBe('#/assignments/flow-a1');

    // When every task in the assignment is done, render "All tasks done." + "Back to assignment".
    const doneAssignment = makeAssignment({
      id: 'flow-done',
      tasks: [
        { kind: 'lesson', id: 'd1', slug: 'staff' },
        { kind: 'lesson', id: 'd2', slug: 'keyboard' },
      ],
    });
    act(() => {
      store.saveAssignment(makeStored(doneAssignment));
      window.location.hash = '#/learn/staff?assignment=flow-done';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(
      () =>
        host.querySelector('.assignment-next-bar .today-flow-done')?.textContent ===
        'All tasks done.',
    );
    const allDoneCta = host.querySelector<HTMLAnchorElement>(
      '.assignment-next-bar a.button-primary',
    );
    expect(allDoneCta?.textContent).toBe('Back to assignment');
    expect(allDoneCta?.getAttribute('href')).toBe('#/assignments/flow-done');

    // Unknown assignment ID renders nothing.
    act(() => {
      window.location.hash = '#/learn/staff?assignment=does-not-exist';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => host.querySelector('.today-flow') === null);
  });

  it('keeps TodayNextBar working for ?from=today and renders null without origin params', async () => {
    const plan: TodayPlan = {
      day: dayKey(Date.now()),
      minutes: 20,
      lessonsDone: [],
      steps: [
        {
          kind: 'task',
          id: 'warmup-1',
          part: 'warmup',
          why: { kind: 'nextScale' },
          task: {
            kind: 'scale',
            id: 'warmup-1',
            exercise: 'major:C:1:right',
            click: null,
            runs: 1,
          },
        },
        {
          kind: 'task',
          id: 'new-lesson',
          part: 'new',
          why: { kind: 'lesson', n: 1, of: 15 },
          task: { kind: 'lesson', id: 'new-lesson', slug: 'staff' },
        },
      ],
    };
    writeKeptPlan(plan);

    const { host, cleanup } = await mount('#/scales', <TodayFlowSlot />);
    expect(host.querySelector('.today-flow')).toBeNull();

    act(() => {
      window.location.hash = '#/scales?exercise=major%3AC%3A1%3Aright&click=off&from=today';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => host.querySelector('.today-flow:not(.assignment-next-bar)') !== null);
    expect(host.querySelector('.assignment-next-bar')).toBeNull();
    cleanup();
  });

  it('falls back to Assignment back link in PieceSession and ProgressionPage when ?assignment=<id> is set', async () => {
    const prog = await mount(
      '#/harmony/I-IV-V-I/C/block?assignment=piece-a1',
      <ProgressionPage progression="I-IV-V-I" keyName="C" pattern="block" />,
    );
    await waitFor(() => prog.host.querySelector('.piece-back-link') !== null);
    const progBack = prog.host.querySelector<HTMLAnchorElement>('.piece-back-link');
    expect(progBack?.textContent).toBe('Assignment');
    expect(progBack?.getAttribute('href')).toBe('#/assignments/piece-a1');

    act(() => {
      window.location.hash = '#/harmony/I-IV-V-I/C/block';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(
      () => prog.host.querySelector('.piece-back-link')?.getAttribute('href') === '#/harmony',
    );
    prog.cleanup();

    const piece = await mount(
      '#/pieces/trad-twinkle-twinkle?assignment=piece-a2',
      <PiecePage id="trad-twinkle-twinkle" />,
    );
    await waitFor(() => piece.host.querySelector('.piece-back-link') !== null);
    const pieceBack = piece.host.querySelector<HTMLAnchorElement>('.piece-back-link');
    expect(pieceBack?.textContent).toBe('Assignment');
    expect(pieceBack?.getAttribute('href')).toBe('#/assignments/piece-a2');

    act(() => {
      window.location.hash = '#/pieces/trad-twinkle-twinkle';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(
      () => piece.host.querySelector('.piece-back-link')?.getAttribute('href') === '#/pieces',
    );
    piece.cleanup();
  });
});
