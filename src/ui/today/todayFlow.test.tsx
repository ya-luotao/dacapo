// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../notation/verovio.ts', () => ({
  prefetchVerovio: () => undefined,
}));

vi.mock('../notation/ScoreView.tsx', () => ({
  ScoreView: () => null,
}));

import { Router } from 'wouter';
import { analyzeRun } from '../../core/evenness.ts';
import type { ReadSessionRecord } from '../../core/log.ts';
import type { ScaleSession, StoredScaleRun } from '../../core/scaleRecords.ts';
import { scaleNotes } from '../../core/scales.ts';
import { dayKey } from '../../core/streak.ts';
import type { TodayPlan as Plan } from '../../core/todayRecords.ts';
import { I18nContext, type I18nContextValue } from '../../i18n/context.ts';
import type { InputSystem } from '../../input/index.ts';
import { createMemoryRepository, type OpenResult } from '../../storage/repository.ts';
import { InputContext } from '../input/context.ts';
import { LessonPage } from '../learn/LessonPage.tsx';
import { readLegacyLessons } from '../learn/progress.ts';
import { createOfferStore, MetronomeContext, type MetronomeHandle } from '../metronome/context.ts';
import { PracticeProvider } from '../practice/PracticeProvider.tsx';
import { createPracticeStore, type PracticeStore } from '../practice/store.ts';
import { SummaryEnd } from '../SummaryEnd.tsx';
import { useHashRoute } from '../hashRoute.ts';
import { ScalesPage } from '../scales/ScalesPage.tsx';
import { ScaleSummary } from '../scales/ScaleSummary.tsx';
import { levelStartPath, scaleStartPath, withTodayOrigin } from '../startParams.ts';
import { writeKeptPlan } from './prefs.ts';
import { TodayFlowSlot } from './TodayFlowSlot.tsx';
import TodayNextBar from './TodayNextBar.tsx';
import { TodayPlan } from './TodayPlan.tsx';

const TODAY = dayKey(Date.now());
const SCALE_EXERCISE = 'major:C:1:right';
const LESSON_SLUG = 'staff';
const READ_LEVEL = 'L1';

let root: Root | null = null;
let host: HTMLElement;
let stop: (() => void) | null = null;
let messages: Record<string, string> = {};

beforeAll(async () => {
  const mod = await import('../../i18n/en.ts');
  messages = mod.en;
});

function formatMessage(key: string, vars?: Record<string, string | number>): string {
  const template = messages[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

function makePlan(day: string = TODAY): Plan {
  return {
    day,
    minutes: 20,
    lessonsDone: ['keyboard'],
    steps: [
      {
        kind: 'task',
        id: 'warmup-1',
        part: 'warmup',
        why: { kind: 'nextScale' },
        task: { kind: 'scale', id: 'warmup-1', exercise: SCALE_EXERCISE, click: null, runs: 1 },
      },
      {
        kind: 'task',
        id: 'new-lesson',
        part: 'new',
        why: { kind: 'lesson', n: 2, of: 15 },
        task: { kind: 'lesson', id: 'new-lesson', slug: LESSON_SLUG },
      },
      {
        kind: 'task',
        id: 'new-1',
        part: 'new',
        why: { kind: 'level', days: null },
        task: { kind: 'level', id: 'new-1', family: 'notes', level: READ_LEVEL, goal: 1 },
      },
    ],
  };
}

function makeScaleRun(
  exercise: string,
  startedAt: number,
): {
  run: StoredScaleRun;
  session: ScaleSession;
} {
  const endedAt = startedAt + 5_000;
  const run: StoredScaleRun = {
    id: 'scale-run-1',
    sessionId: 'scale-session-1',
    exercise,
    startedAt,
    end: 'finished',
    keys: [],
    pedal: [],
    pedalAtStart: false,
    velocityMeasured: false,
    inputs: [],
  };
  const session: ScaleSession = {
    kind: 'scale',
    id: 'scale-session-1',
    startedAt,
    endedAt,
    activeMs: 5_000,
    runs: [
      {
        id: 'scale-run-1',
        exercise,
        startedAt,
        endedAt,
        headline: {
          version: 1,
          quality: 'ok',
          counts: { expected: 15, matched: 15, wrong: 0, missed: 0, extra: 0 },
          velocityMeasured: false,
          hands: [
            {
              hand: 'right',
              spread: 12,
              spreadShare: 0.06,
              rough: false,
              hesitations: 0,
              medianInterval: 200,
            },
          ],
        },
      },
    ],
  };
  return { run, session };
}

function makeReadSession(startedAt: number): ReadSessionRecord {
  return {
    kind: 'read',
    id: 'read-session-1',
    level: READ_LEVEL,
    startedAt,
    endedAt: startedAt + 10_000,
    activeMs: 10_000,
    length: 10,
    cards: 10,
    correct: 10,
    accuracy: 1,
    medianMs: 900,
    slowest: [],
    missed: [],
  };
}

function startStore(): PracticeStore {
  const repository = createMemoryRepository();
  const store = createPracticeStore({
    open: (): Promise<OpenResult> => Promise.resolve({ repository, failure: null }),
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

function mount(store: PracticeStore, children: ReactNode, hashPath: string) {
  window.location.hash = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;
  const translate: I18nContextValue['t'] = (key, vars) => formatMessage(key, vars);
  const i18n: I18nContextValue = {
    locale: 'en',
    override: null,
    setOverride: () => undefined,
    noteNaming: 'letters',
    setNoteNaming: () => undefined,
    t: translate,
    translate: () => translate,
  };
  const idle = { held: new Map(), sustained: new Set(), sustain: false };
  const midiStatus = { state: 'unsupported' } as const;
  const input = {
    hub: {
      subscribe: () => () => undefined,
      getState: () => idle,
      onEvent: () => () => undefined,
    },
    midi: {
      subscribeStatus: () => () => undefined,
      getStatus: () => midiStatus,
    },
    keyboard: {
      subscribeOctave: () => () => undefined,
      getOctave: () => 4,
    },
    output: {
      scheduler: undefined,
      onInterrupt: () => () => undefined,
    },
    onMidiKey: () => () => undefined,
    pointer: {},
  } as unknown as InputSystem;
  const metronomeSnap = {
    status: 'stopped',
    pausedBy: null,
    blockedBy: null,
    settings: { bpm: 90 },
    bpm: 90,
    target: 90,
    bar: null,
  };
  const metronomeHandle = {
    offers: createOfferStore(),
    metronome: {
      subscribe: () => () => undefined,
      getSnapshot: () => metronomeSnap,
      block: () => () => undefined,
    },
  } as unknown as MetronomeHandle;
  Element.prototype.scrollTo = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
  root = createRoot(host);
  act(() => {
    root!.render(
      <I18nContext value={i18n}>
        <InputContext value={input}>
          <MetronomeContext value={metronomeHandle}>
            <PracticeProvider store={store}>
              <Router hook={useHashRoute}>{children}</Router>
            </PracticeProvider>
          </MetronomeContext>
        </InputContext>
      </I18nContext>,
    );
  });
}

const hashHref = (path: string) => `#${path}`;

const waitFor = (fn: () => void) =>
  vi.waitFor(async () => {
    await act(async () => {});
    fn();
  });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
  window.scrollTo = () => undefined;
  if (!('IntersectionObserver' in globalThis)) {
    globalThis.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  }
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  window.matchMedia = () =>
    ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  stop?.();
  stop = null;
  host.remove();
  window.location.hash = '';
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('TodayFlowSlot and TodayNextBar', () => {
  it('TodayFlowSlot renders nothing when ?from=today is absent', async () => {
    writeKeptPlan(makePlan());
    const store = startStore();
    await loaded(store);

    mount(store, <TodayFlowSlot />, '/learn/staff');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(host.querySelector('.today-flow')).toBeNull();

    act(() => root?.unmount());
    root = null;
    mount(store, <TodayFlowSlot />, '/learn/staff?from=other');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(host.querySelector('.today-flow')).toBeNull();
  });

  it('TodayFlowSlot loads TodayNextBar when ?from=today is present and suggests the next step', async () => {
    writeKeptPlan(makePlan());
    const store = startStore();
    await loaded(store);
    const { run, session } = makeScaleRun(SCALE_EXERCISE, Date.now());
    act(() => store.recordScaleRun(run, session));

    const scaleUrl = withTodayOrigin(scaleStartPath({ exercise: SCALE_EXERCISE, click: null }));
    mount(store, <TodayFlowSlot />, scaleUrl);

    await waitFor(() => {
      expect(host.querySelector('.today-flow')).not.toBeNull();
    });

    expect(host.querySelector('.today-flow-progress')?.textContent).toBe('Today · 1 of 3');
    const pips = [...host.querySelectorAll('.today-flow-pip')];
    expect(pips).toHaveLength(3);
    expect(pips[0]?.className).toContain('is-done');
    expect(pips[0]?.className).toContain('is-current');
    expect(pips[1]?.className).not.toContain('is-done');

    const nextLink = host.querySelector(
      '.today-flow-actions a.button-primary',
    ) as HTMLAnchorElement;
    expect(nextLink).not.toBeNull();
    expect(nextLink.textContent).toMatch(/^Next: /);
    expect(nextLink.getAttribute('href')).toBe(hashHref(withTodayOrigin(`/learn/${LESSON_SLUG}`)));

    const backLink = host.querySelector('.today-flow-home') as HTMLAnchorElement;
    expect(backLink).not.toBeNull();
    expect(backLink.textContent).toBe('Back to Today');
    expect(backLink.getAttribute('href')).toBe(hashHref('/'));
  });

  it('TodayNextBar searches forward first and wraps around to earlier incomplete steps', async () => {
    writeKeptPlan(makePlan());
    const store = startStore();
    await loaded(store);
    act(() => store.markLesson(LESSON_SLUG));

    const levelUrl = withTodayOrigin(
      levelStartPath('read', { family: 'notes', level: READ_LEVEL }),
    );
    mount(store, <TodayNextBar />, levelUrl);

    await waitFor(() => {
      expect(host.querySelector('.today-flow')).not.toBeNull();
    });

    const nextLink = host.querySelector(
      '.today-flow-actions a.button-primary',
    ) as HTMLAnchorElement;
    expect(nextLink).not.toBeNull();
    expect(nextLink.getAttribute('href')).toBe(
      hashHref(withTodayOrigin(scaleStartPath({ exercise: SCALE_EXERCISE, click: null }))),
    );
  });

  it('TodayNextBar never suggests the current incomplete step when all other steps are done', async () => {
    writeKeptPlan(makePlan());
    const store = startStore();
    await loaded(store);
    const now = Date.now();
    const { run, session } = makeScaleRun(SCALE_EXERCISE, now);
    act(() => {
      store.recordScaleRun(run, session);
      store.recordSession(makeReadSession(now));
    });

    mount(store, <TodayNextBar />, `/learn/${LESSON_SLUG}?from=today`);

    await waitFor(() => {
      expect(host.querySelector('.today-flow')).not.toBeNull();
    });

    expect(host.querySelector('.today-flow-progress')?.textContent).toBe('Today · 2 of 3');
    const backButton = host.querySelector(
      '.today-flow-actions a.button-primary',
    ) as HTMLAnchorElement;
    expect(backButton.textContent).toBe('Back to Today');
    expect(backButton.getAttribute('href')).toBe(hashHref('/'));
  });

  it('TodayNextBar shows allDone copy and primary Back to Today link when every step is done', async () => {
    writeKeptPlan(makePlan());
    const store = startStore();
    await loaded(store);
    const now = Date.now();
    const { run, session } = makeScaleRun(SCALE_EXERCISE, now);
    act(() => {
      store.recordScaleRun(run, session);
      store.markLesson(LESSON_SLUG);
      store.recordSession(makeReadSession(now));
    });

    mount(store, <TodayNextBar />, `/learn/${LESSON_SLUG}?from=today`);

    await waitFor(() => {
      expect(host.querySelector('.today-flow')).not.toBeNull();
    });

    expect(host.querySelector('.today-flow-progress')?.textContent).toBe('Today · 3 of 3');
    expect(host.querySelector('.today-flow-done')?.textContent).toBe('Today’s plan is done.');
    const backButton = host.querySelector(
      '.today-flow-actions a.button-primary',
    ) as HTMLAnchorElement;
    expect(backButton.textContent).toBe('Back to Today');
    expect(backButton.getAttribute('href')).toBe(hashHref('/'));
    expect(host.querySelector('.today-flow-home')).toBeNull();
  });

  it('TodayNextBar returns null when no valid kept plan exists for today', async () => {
    writeKeptPlan(makePlan('2020-01-01'));
    const store = startStore();
    await loaded(store);

    mount(store, <TodayNextBar />, `/learn/${LESSON_SLUG}?from=today`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(host.querySelector('.today-flow')).toBeNull();
  });

  it('TodayPlan adds ?from=today to step links and primary CTA hrefs', async () => {
    writeKeptPlan(makePlan());
    const store = startStore();
    await loaded(store);
    let latestNext: { href: string; name: string } | null = null;

    mount(
      store,
      <TodayPlan
        today={TODAY}
        minutes={20}
        waiting={null}
        week={false}
        onSteps={() => undefined}
        onNext={(next) => {
          latestNext = next;
        }}
      />,
      '/',
    );

    await waitFor(() => {
      expect(host.querySelectorAll('.today-step-name').length).toBeGreaterThan(0);
    });

    const stepLinks = [...host.querySelectorAll('a.today-step-name')] as HTMLAnchorElement[];
    expect(stepLinks).toHaveLength(3);
    for (const link of stepLinks) {
      expect(link.getAttribute('href')).toContain('from=today');
    }
    expect(latestNext).not.toBeNull();
    expect(latestNext!.href).toContain('from=today');
  });

  it('SummaryEnd, LessonPage, ScalesPage, and ScaleSummary wire Today flow UI when ?from=today is present', async () => {
    writeKeptPlan(makePlan());
    const store = startStore();
    await loaded(store);

    mount(
      store,
      <SummaryEnd
        family="notes"
        level={READ_LEVEL}
        mastery={{ mastered: false, text: 'Keep going' }}
        percent="80%"
        onAgain={() => undefined}
        onNextLevel={null}
        onChooseLevel={() => undefined}
      />,
      withTodayOrigin(levelStartPath('read', { family: 'notes', level: READ_LEVEL })),
    );

    await waitFor(() => {
      expect(host.querySelector('.summary-end .today-flow')).not.toBeNull();
    });

    act(() => root?.unmount());
    root = null;
    mount(store, <LessonPage slug={LESSON_SLUG} />, `/learn/${LESSON_SLUG}?from=today`);

    await waitFor(() => {
      expect(host.querySelector('.lesson-end .today-flow')).not.toBeNull();
    });
    const lessonReturn = host.querySelector('.lesson-rail .today-return') as HTMLAnchorElement;
    expect(lessonReturn).not.toBeNull();
    expect(lessonReturn.getAttribute('href')).toBe(hashHref('/'));

    act(() => root?.unmount());
    root = null;
    const expected = scaleNotes({ type: 'major', tonic: 'C', octaves: 1, hands: 'right' }).right;
    const played = expected.map((note, i) => ({
      midi: note.midi,
      on: i * 200,
      off: i * 200 + 150,
      velocity: 0,
    }));
    const analysis = analyzeRun({ expected, played, velocityMeasured: false });

    mount(
      store,
      <ScaleSummary
        analysis={analysis}
        names={{ right: expected.map(() => 'C'), left: [] }}
        end="finished"
        pedal={false}
      />,
      withTodayOrigin(scaleStartPath({ exercise: SCALE_EXERCISE, click: null })),
    );

    await waitFor(() => {
      expect(host.querySelector('.scale-summary .today-flow')).not.toBeNull();
    });

    act(() => root?.unmount());
    root = null;
    mount(
      store,
      <ScalesPage />,
      withTodayOrigin(scaleStartPath({ exercise: SCALE_EXERCISE, click: null })),
    );
    await waitFor(() => {
      expect(host.querySelector('.scales')).not.toBeNull();
    });
    const scalesReturn = host.querySelector('.scales .today-return') as HTMLAnchorElement;
    expect(scalesReturn).not.toBeNull();
    expect(scalesReturn.getAttribute('href')).toBe(hashHref('/'));

    act(() => root?.unmount());
    root = null;
    mount(store, <LessonPage slug={LESSON_SLUG} />, `/learn/${LESSON_SLUG}`);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(host.querySelector('.lesson-rail .today-return')).toBeNull();
    expect(host.querySelector('.lesson-end .today-flow')).toBeNull();

    act(() => root?.unmount());
    root = null;
    mount(store, <ScalesPage />, scaleStartPath({ exercise: SCALE_EXERCISE, click: null }));
    await waitFor(() => {
      expect(host.querySelector('.scales')).not.toBeNull();
    });
    expect(host.querySelector('.scales .today-return')).toBeNull();
  });

  it('TodayNextBar resolves custom pieces stored in PracticeProvider', async () => {
    const customId = 'custom etude';
    const plan: Plan = {
      day: TODAY,
      minutes: 20,
      lessonsDone: ['keyboard'],
      steps: [
        {
          kind: 'task',
          id: 'new-lesson',
          part: 'new',
          why: { kind: 'lesson', n: 2, of: 15 },
          task: { kind: 'lesson', id: 'new-lesson', slug: LESSON_SLUG },
        },
        {
          kind: 'piece',
          id: 'work-1',
          part: 'work',
          why: { kind: 'newPiece' },
          piece: customId,
          goal: 'through',
        },
      ],
    };
    writeKeptPlan(plan);
    const store = startStore();
    await loaded(store);
    act(() => {
      store.savePiece({
        id: customId,
        title: 'My Etude',
        composer: 'Anon',
        fileName: 'etude.xml',
        xml: '<score-partwise/>',
        importedAt: Date.now(),
        hands: null,
        warnings: [],
      });
    });

    mount(store, <TodayNextBar />, `/learn/${LESSON_SLUG}?from=today`);

    await waitFor(() => {
      expect(host.querySelector('.today-flow')).not.toBeNull();
    });

    const nextLink = host.querySelector(
      '.today-flow-actions a.button-primary',
    ) as HTMLAnchorElement;
    expect(nextLink.textContent).toBe('Next: My Etude');
    expect(nextLink.getAttribute('href')).toBe(
      hashHref(withTodayOrigin(`/pieces/${encodeURIComponent(customId)}`)),
    );
  });
});
