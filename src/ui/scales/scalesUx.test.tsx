// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../notation/verovio.ts', () => ({
  prefetchVerovio: () => undefined,
}));

vi.mock('../notation/ScoreView.tsx', () => ({
  ScoreView: () => null,
}));

import { Router } from 'wouter';
import { analyzeRun } from '../../core/evenness.ts';
import type { ExerciseProgress } from '../../core/scaleProgress.ts';
import { scaleNotes } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import { I18nContext, type I18nContextValue } from '../../i18n/context.ts';
import type { InputEvent, InputSystem } from '../../input/index.ts';
import { createScheduler } from '../../output/scheduler.ts';
import { createMemoryRepository, type OpenResult } from '../../storage/repository.ts';
import { useHashRoute } from '../hashRoute.ts';
import { InputContext } from '../input/context.ts';
import { readLegacyLessons } from '../learn/progress.ts';
import { createOfferStore, MetronomeContext, type MetronomeHandle } from '../metronome/context.ts';
import { PracticeProvider } from '../practice/PracticeProvider.tsx';
import { createPracticeStore, type PracticeStore } from '../practice/store.ts';
import { scaleStartPath, withAssignmentOrigin, withTodayOrigin } from '../startParams.ts';
import { ScalePicker } from './ScalePicker.tsx';
import { YourScales } from './ScaleProgress.tsx';
import { ScalesPage } from './ScalesPage.tsx';
import { ScaleSummary } from './ScaleSummary.tsx';

let root: Root | null = null;
let host: HTMLElement | null = null;
let stopStore: (() => void) | null = null;
let activeScheduler: ReturnType<typeof createScheduler> | null = null;
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

function makeI18n(): I18nContextValue {
  const t: I18nContextValue['t'] = (key, vars) => formatMessage(key, vars);
  return {
    locale: 'en',
    override: null,
    setOverride: () => undefined,
    noteNaming: 'letters',
    setNoteNaming: () => undefined,
    t,
    translate: () => t,
  };
}

function startStore(): PracticeStore {
  const repository = createMemoryRepository();
  const store = createPracticeStore({
    open: (): Promise<OpenResult> => Promise.resolve({ repository, failure: null }),
    legacyLessons: readLegacyLessons,
  });
  stopStore = store.start();
  return store;
}

const loaded = (store: PracticeStore) =>
  act(async () => {
    await vi.waitFor(() => expect(store.getStatus().loaded).toBe(true));
    await store.settled();
  });

function mountWithProviders(
  children: ReactNode,
  { store = startStore(), hashPath = '/scales' }: { store?: PracticeStore; hashPath?: string } = {},
) {
  host = document.createElement('div');
  document.body.appendChild(host);
  window.location.hash = hashPath.startsWith('#') ? hashPath : `#${hashPath}`;

  const listeners = new Set<(event: InputEvent) => void>();
  const idle = { held: new Map<number, number>(), sustained: new Set<number>(), sustain: false };
  const midiStatus = { state: 'unsupported' } as const;
  activeScheduler = createScheduler();
  const input = {
    hub: {
      subscribe: () => () => undefined,
      getState: () => idle,
      onEvent: (fn: (event: InputEvent) => void) => {
        listeners.add(fn);
        return () => void listeners.delete(fn);
      },
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
      scheduler: activeScheduler,
      onInterrupt: () => () => undefined,
    },
    onMidiKey: () => () => undefined,
    pointer: {},
  } as unknown as InputSystem;

  const metronomeSnap = {
    status: 'stopped',
    pausedBy: null,
    blockedBy: null,
    settings: { bpm: 90, sound: 'click', volume: 80 },
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
  root = createRoot(host);
  act(() => {
    root!.render(
      <I18nContext value={makeI18n()}>
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

  return {
    store,
    emitInput: (event: InputEvent) => {
      act(() => {
        for (const fn of [...listeners]) fn(event);
      });
    },
  };
}

function makeProgressRow(exercise: string, now: number): ExerciseProgress {
  return {
    exercise,
    runs: 3,
    lastAt: now,
    latest: null,
    best: { spread: 14, spreadShare: 0.08, at: now, rough: false },
    days: [],
    recentShare: 8,
  };
}

function setSearchInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  host?.remove();
  host = null;
  activeScheduler?.panic();
  activeScheduler = null;
  stopStore?.();
  stopStore = null;
  localStorage.clear();
  window.location.hash = '';
});

describe('ScaleSummary next exercise button', () => {
  it('renders Next button only when analysis.quality is ok and calls onSelect', async () => {
    const store = startStore();
    await loaded(store);

    const expected = scaleNotes({ type: 'major', tonic: 'C', octaves: 1, hands: 'right' }).right;
    const goodPlayed = expected.map((note, i) => ({
      midi: note.midi,
      on: i * 200,
      off: i * 200 + 150,
      velocity: 0,
    }));
    const goodAnalysis = analyzeRun({ expected, played: goodPlayed, velocityMeasured: false });
    expect(goodAnalysis.quality).toBe('ok');

    const onSelect = vi.fn();
    mountWithProviders(
      <ScaleSummary
        analysis={goodAnalysis}
        names={{ right: expected.map(() => 'C'), left: [] }}
        end="finished"
        pedal={false}
        nextExercise={{ label: 'G major', onSelect }}
      />,
      { store },
    );

    const nextButton = Array.from(host!.querySelectorAll('button')).find(
      (b) => b.textContent === 'Next: G major',
    );
    expect(nextButton).toBeDefined();
    act(() => {
      nextButton!.click();
    });
    expect(onSelect).toHaveBeenCalledTimes(1);

    act(() => {
      root?.unmount();
    });
    root = null;
    host?.remove();

    const shortAnalysis = analyzeRun({
      expected,
      played: goodPlayed.slice(0, 2),
      velocityMeasured: false,
    });
    expect(shortAnalysis.quality).not.toBe('ok');

    mountWithProviders(
      <ScaleSummary
        analysis={shortAnalysis}
        names={{ right: expected.map(() => 'C'), left: [] }}
        end="stopped"
        pedal={false}
        nextExercise={{ label: 'G major', onSelect }}
      />,
      { store },
    );

    const missingButton = Array.from(host!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Next:'),
    );
    expect(missingButton).toBeUndefined();
  });
});

describe('YourScales search and category filter', () => {
  it('hides filter bar with fewer than 4 exercises and filters when 4 or more exist', async () => {
    const now = Date.now();
    const store = startStore();
    await loaded(store);
    const current: ScaleExercise = { type: 'major', tonic: 'C', octaves: 1, hands: 'both' };

    const three = [
      makeProgressRow('major:C:1:both', now),
      makeProgressRow('naturalMinor:A:1:both', now - 1000),
      makeProgressRow('hanon:C:2:both:1', now - 2000),
    ];

    mountWithProviders(
      <YourScales list={three} now={now} current={current} onPick={() => undefined} />,
      { store },
    );
    expect(host!.querySelector('.scale-list input[type="search"]')).toBeNull();
    expect(host!.querySelectorAll('.scale-list .filter-pill')).toHaveLength(0);

    act(() => {
      root?.unmount();
    });
    root = null;
    host?.remove();

    const four = [...three, makeProgressRow('majorArpeggio:G:2:right', now - 3000)];
    mountWithProviders(
      <YourScales list={four} now={now} current={current} onPick={() => undefined} />,
      { store },
    );

    const search = host!.querySelector('.scale-list input[type="search"]') as HTMLInputElement;
    const pills = Array.from(host!.querySelectorAll('.scale-list .filter-pill'));
    expect(search).not.toBeNull();
    expect(search.placeholder).toBe('Filter practised scales…');
    expect(search.getAttribute('aria-label')).toBe('Filter practised scales');
    expect(pills.map((p) => p.textContent)).toEqual(['All', 'Scales & arpeggios', 'Technique']);
    expect(pills[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(host!.querySelectorAll('.scale-list-table tbody tr')).toHaveLength(4);

    act(() => {
      (pills[2] as HTMLButtonElement).click();
    });
    expect(pills[2]!.getAttribute('aria-pressed')).toBe('true');
    const techniqueRows = Array.from(host!.querySelectorAll('.scale-list-table tbody tr'));
    expect(techniqueRows).toHaveLength(1);
    expect(techniqueRows[0]!.textContent).toContain('Hanon No. 1');

    act(() => {
      (pills[1] as HTMLButtonElement).click();
    });
    expect(host!.querySelectorAll('.scale-list-table tbody tr')).toHaveLength(3);

    setSearchInputValue(search, 'arpeggio');
    const arpRows = Array.from(host!.querySelectorAll('.scale-list-table tbody tr'));
    expect(arpRows).toHaveLength(1);
    expect(arpRows[0]!.textContent).toContain('G major');

    setSearchInputValue(search, 'zzzz');
    expect(host!.querySelector('.scale-list-table')).toBeNull();
    expect(host!.querySelector('.library-empty')?.textContent).toBe(
      'No practised exercises match this filter.',
    );
  });
});

describe('ScalePicker steppers', () => {
  it('renders prev/next stepper buttons and updates tonic or variant, omitting octaves', async () => {
    const store = startStore();
    await loaded(store);
    const onChange = vi.fn();
    const onChosen = vi.fn();

    const majorC: ScaleExercise = { type: 'major', tonic: 'C', octaves: 1, hands: 'both' };
    mountWithProviders(
      <ScalePicker
        id="picker-1"
        hidden={false}
        exercise={majorC}
        onChange={onChange}
        click={{ on: false, bpm: 80, perBeat: 2 }}
        onClick={() => undefined}
        onChosen={onChosen}
        disabled={false}
      />,
      { store },
    );

    const prev = host!.querySelector(
      'button[aria-label="Previous key or exercise"]',
    ) as HTMLButtonElement;
    const next = host!.querySelector(
      'button[aria-label="Next key or exercise"]',
    ) as HTMLButtonElement;
    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();
    expect(prev.getAttribute('aria-keyshortcuts')).toBe('[');
    expect(next.getAttribute('aria-keyshortcuts')).toBe(']');

    act(() => {
      next.click();
    });
    expect(onChange).toHaveBeenCalledWith({ ...majorC, tonic: 'G' });
    expect(onChosen).toHaveBeenCalledTimes(1);

    act(() => {
      prev.click();
    });
    expect(onChange).toHaveBeenCalledWith({ ...majorC, tonic: 'F' });

    act(() => {
      root?.unmount();
    });
    root = null;
    host?.remove();

    const hanon1: ScaleExercise = {
      type: 'hanon',
      tonic: 'C',
      octaves: 1,
      hands: 'both',
      variant: '1',
    };
    onChange.mockClear();
    mountWithProviders(
      <ScalePicker
        id="picker-2"
        hidden={false}
        exercise={hanon1}
        onChange={onChange}
        click={{ on: false, bpm: 80, perBeat: 2 }}
        onClick={() => undefined}
        onChosen={onChosen}
        disabled={false}
      />,
      { store },
    );
    const hanonNext = host!.querySelector(
      'button[aria-label="Next key or exercise"]',
    ) as HTMLButtonElement;
    act(() => {
      hanonNext.click();
    });
    expect(onChange).toHaveBeenCalledWith({ ...hanon1, variant: '2', tonic: 'C' });

    act(() => {
      root?.unmount();
    });
    root = null;
    host?.remove();

    const octaves: ScaleExercise = { type: 'octaves', tonic: 'C', octaves: 1, hands: 'both' };
    mountWithProviders(
      <ScalePicker
        id="picker-3"
        hidden={false}
        exercise={octaves}
        onChange={onChange}
        click={{ on: false, bpm: 80, perBeat: 2 }}
        onClick={() => undefined}
        onChosen={onChosen}
        disabled={false}
      />,
      { store },
    );
    expect(host!.querySelector('button[aria-label="Previous key or exercise"]')).toBeNull();
    expect(host!.querySelector('button[aria-label="Next key or exercise"]')).toBeNull();
  });
});

describe('ScalesPage origin links and keyboard shortcuts', () => {
  it('renders assignment back link only when from=today is absent', async () => {
    const store = startStore();
    await loaded(store);

    const base = scaleStartPath({ exercise: 'major:C:1:right', click: null });
    mountWithProviders(<ScalesPage />, {
      store,
      hashPath: withAssignmentOrigin(base, 'a-42'),
    });

    await vi.waitFor(() => expect(host!.querySelector('.scales')).not.toBeNull());
    const assignmentBack = host!.querySelector('.scales .today-return') as HTMLAnchorElement;
    expect(assignmentBack).not.toBeNull();
    expect(assignmentBack.textContent).toBe('← Assignment');
    expect(assignmentBack.getAttribute('href')).toBe('#/assignments/a-42');

    act(() => {
      root?.unmount();
    });
    root = null;
    host?.remove();

    mountWithProviders(<ScalesPage />, {
      store,
      hashPath: withTodayOrigin(withAssignmentOrigin(base, 'a-42')),
    });
    await vi.waitFor(() => expect(host!.querySelector('.scales')).not.toBeNull());
    const todayBack = host!.querySelector('.scales .today-return') as HTMLAnchorElement;
    expect(todayBack).not.toBeNull();
    expect(todayBack.textContent).toBe('← Back to Today');
    expect(todayBack.getAttribute('href')).toBe('#/');
  });

  it('steps keys with [ and ], stops active free run with KeyR, and toggles Space safely', async () => {
    const store = startStore();
    await loaded(store);

    const freeStart = scaleStartPath({ exercise: 'major:C:1:right', click: null });
    const { emitInput } = mountWithProviders(<ScalesPage />, { store, hashPath: freeStart });
    await vi.waitFor(() => expect(host!.querySelector('.scale-title')).not.toBeNull());
    expect(host!.querySelector('.scale-title')!.textContent).toBe('C major');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', bubbles: true }));
    });
    expect(host!.querySelector('.scale-title')!.textContent).toBe('G major');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '[', bubbles: true }));
    });
    expect(host!.querySelector('.scale-title')!.textContent).toBe('C major');

    // Space does nothing in free-tempo mode.
    const freeSpace = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.body.dispatchEvent(freeSpace);
    });
    expect(freeSpace.defaultPrevented).toBe(false);

    // Bracket stepping is suppressed inside inputs and dialogs.
    const inputEl = document.createElement('input');
    document.body.appendChild(inputEl);
    act(() => {
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: ']', bubbles: true }));
    });
    expect(host!.querySelector('.scale-title')!.textContent).toBe('C major');
    inputEl.remove();

    const dialogEl = document.createElement('div');
    dialogEl.setAttribute('role', 'dialog');
    document.body.appendChild(dialogEl);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', bubbles: true }));
    });
    expect(host!.querySelector('.scale-title')!.textContent).toBe('C major');
    dialogEl.remove();

    // Start a free-tempo run by playing the first note (C4 = midi 60), verify [ ignored, then KeyR stops it.
    emitInput({ type: 'on', midi: 60, velocity: 80, time: performance.now() });
    await vi.waitFor(() => expect(host!.querySelector('.scale-session.is-playing')).not.toBeNull());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ']', bubbles: true }));
    });
    expect(host!.querySelector('.scale-title')!.textContent).toBe('C major');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'r', bubbles: true }));
    });
    await vi.waitFor(() => expect(host!.querySelector('.scale-session.is-playing')).toBeNull());

    // Switch to click mode and test Space start/stop plus button-focus guard.
    act(() => {
      root?.unmount();
    });
    root = null;
    host?.remove();

    const clickStart = scaleStartPath({
      exercise: 'major:C:1:right',
      click: { bpm: 96, perBeat: 2 },
    });
    mountWithProviders(<ScalesPage />, { store, hashPath: clickStart });
    await vi.waitFor(() => expect(host!.querySelector('.piece-go')).not.toBeNull());
    const startButton = host!.querySelector('.piece-go') as HTMLButtonElement;
    expect(startButton.textContent).toContain('Start');

    // Space on a focused <button> must NOT be intercepted by global transport shortcut.
    const buttonSpace = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      startButton.dispatchEvent(buttonSpace);
    });
    expect(buttonSpace.defaultPrevented).toBe(false);
    expect(host!.querySelector('.scale-session.is-playing')).toBeNull();

    // Space on the stage/page toggles the clicked run on, then off.
    const stageSpace = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.body.dispatchEvent(stageSpace);
    });
    expect(stageSpace.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(host!.querySelector('.scale-session.is-playing')).not.toBeNull());
    expect(host!.querySelector('.piece-go')!.textContent).toContain('Stop');

    const stopSpace = new KeyboardEvent('keydown', {
      code: 'Space',
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      document.body.dispatchEvent(stopSpace);
    });
    expect(stopSpace.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(host!.querySelector('.scale-session.is-playing')).toBeNull());
    expect(host!.querySelector('.piece-go')!.textContent).toContain('Start');
  });
});
