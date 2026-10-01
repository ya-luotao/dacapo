// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CURRICULUM_LESSONS } from '../../core/curriculum.ts';
import type { StartingPoint } from '../../core/startingPoint.ts';
import {
  createMemoryRepository,
  type OpenResult,
  type PracticeRepository,
} from '../../storage/repository.ts';
import { PracticeProvider } from '../practice/PracticeProvider.tsx';
import { createPracticeStore, type PracticeStore } from '../practice/store.ts';
import { beginPath, useBeginPath } from './begin.ts';

// Where the start page's Begin goes (docs/START.md; docs/LEARN.md, "Clarifications (decided
// during G3)"): worked out when it is pressed, and never lesson 1 for someone whose ticks are not
// known yet.

const NEW: StartingPoint = { from: 'new' };
const PLAYER: StartingPoint = { from: 'player', reads: 'both' };
const [FIRST, SECOND, THIRD] = CURRICULUM_LESSONS as readonly [string, string, string];

describe('beginPath', () => {
  it('sends someone who plays to Today, whatever is ticked or known', () => {
    for (const reads of ['unknown', 'treble', 'both'] as const) {
      expect(beginPath({ from: 'player', reads }, null)).toBe('/');
      expect(beginPath({ from: 'player', reads }, new Set())).toBe('/');
      expect(beginPath({ from: 'player', reads }, new Set([FIRST]))).toBe('/');
    }
  });

  it('sends someone new to the first lesson not ticked', () => {
    expect(beginPath(NEW, new Set())).toBe(`/learn/${FIRST}`);
    expect(beginPath(NEW, new Set([FIRST]))).toBe(`/learn/${SECOND}`);
    expect(beginPath(NEW, new Set([FIRST, SECOND]))).toBe(`/learn/${THIRD}`);
    // The first gap, not the one after the last tick.
    expect(beginPath(NEW, new Set([SECOND, THIRD]))).toBe(`/learn/${FIRST}`);
    // Every lesson ticked: the first again.
    expect(beginPath(NEW, new Set(CURRICULUM_LESSONS))).toBe(`/learn/${FIRST}`);
  });

  it('sends someone new to the Learn page while the ticks are not known', () => {
    expect(beginPath(NEW, null)).toBe('/learn');
  });
});

describe('useBeginPath', () => {
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
    vi.restoreAllMocks();
  });

  /** The page's `begin`, over a store whose storage opens as `opened` says once `gate` resolves. */
  function begin(opened: () => OpenResult, gate: Promise<void> = Promise.resolve()) {
    const store = createPracticeStore({
      open: async () => {
        await gate;
        return opened();
      },
      legacyLessons: () => [{ slug: FIRST, doneAt: 0 }],
    });
    stop = store.start();
    let path: (start: StartingPoint) => string = () => 'not mounted';
    function Probe() {
      path = useBeginPath();
      return null;
    }
    root = createRoot(host);
    act(() =>
      root!.render(createElement(PracticeProvider, { store, children: createElement(Probe) })),
    );
    return { store, path: (start: StartingPoint) => path(start) };
  }

  const loaded = (store: PracticeStore) =>
    act(async () => {
      await vi.waitFor(() => expect(store.getStatus().loaded).toBe(true));
      await store.settled();
    });

  const stored = async () => {
    const repository = createMemoryRepository();
    await repository.markLessons([{ slug: SECOND, doneAt: 5000 }]);
    return repository;
  };

  it('goes to the Learn page while the records are not read, then to the next lesson', async () => {
    const repository = await stored();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { store, path } = begin(() => ({ repository, failure: null }), gate);
    // Pressed before the records are read: someone with two ticks is not sent to lesson 1.
    expect(store.getStatus().loaded).toBe(false);
    expect(path(NEW)).toBe('/learn');
    expect(path(PLAYER)).toBe('/');
    release();
    await loaded(store);
    // The same function, asked again once they are: the store as it is now, not as it was.
    expect(path(NEW)).toBe(`/learn/${THIRD}`);
    act(() => store.markLesson(THIRD));
    expect(path(NEW)).toBe(`/learn/${CURRICULUM_LESSONS[3]!}`);
    expect(path(PLAYER)).toBe('/');
  });

  it('goes to the next lesson where there is no storage to read: this tab holds all there is', async () => {
    for (const failure of ['unsupported', 'error'] as const) {
      const { store, path } = begin(() => ({ repository: createMemoryRepository(), failure }));
      await loaded(store);
      expect(store.getStatus()).toMatchObject({ state: 'unavailable', read: false });
      // The preference's tick is known; the next lesson is the one after it.
      expect(path(NEW)).toBe(`/learn/${SECOND}`);
      act(() => root?.unmount());
      root = null;
      stop?.();
    }
  });

  it('goes to the Learn page over a database of a later version, whose ticks it cannot see', async () => {
    const { store, path } = begin(() => ({
      repository: createMemoryRepository(),
      failure: 'newer',
    }));
    await loaded(store);
    expect(store.getStatus()).toMatchObject({ state: 'newer', read: false });
    expect(path(NEW)).toBe('/learn');
    expect(path(PLAYER)).toBe('/');
  });

  it('goes to the Learn page when the stored records could not be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const repository: PracticeRepository = {
      ...(await stored()),
      load: () => Promise.reject(new Error('broken')),
    };
    const { store, path } = begin(() => ({ repository, failure: null }));
    await loaded(store);
    expect(store.getStatus()).toMatchObject({ state: 'failed', read: false });
    expect(path(NEW)).toBe('/learn');
  });
});
