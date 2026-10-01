// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nContext, type I18nContextValue } from '../i18n/context.ts';
import {
  createMemoryRepository,
  type OpenResult,
  type StorageFailure,
} from '../storage/repository.ts';
import { PracticeProvider } from './practice/PracticeProvider.tsx';
import { createPracticeStore } from './practice/store.ts';
import { StorageNotice } from './StorageNotice.tsx';

// What the page says when progress is not being saved. A database made by a later version of
// dacapo (docs/LEARN.md, "Clarifications (decided during G3)") is not a browser that refuses to
// store: it gets the notice an outdated tab gets, with Reload, and never "a private window?".

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

/** The notice over a store whose storage opened with `failure`, once it has loaded. */
async function notice(failure: StorageFailure | null) {
  const store = createPracticeStore({
    open: (): Promise<OpenResult> =>
      Promise.resolve(
        failure
          ? { repository: createMemoryRepository(), failure }
          : { repository: createMemoryRepository(), failure: null },
      ),
  });
  stop = store.start();
  const i18n = {
    locale: 'en',
    override: null,
    setOverride: () => undefined,
    t: (key: string) => key,
  };
  root = createRoot(host);
  act(() =>
    root!.render(
      createElement(
        I18nContext,
        { value: i18n as unknown as I18nContextValue },
        createElement(PracticeProvider, { store, children: createElement(StorageNotice) }),
      ),
    ),
  );
  await act(async () => {
    await vi.waitFor(() => expect(store.getStatus().loaded).toBe(true));
  });
  return {
    state: store.getStatus().state,
    words: host.querySelector('.storage-notice p')?.textContent ?? null,
    button: host.querySelector('.storage-notice button'),
  };
}

describe('the storage notice', () => {
  it('says nothing while progress is saved', async () => {
    expect(await notice(null)).toEqual({ state: 'saved', words: null, button: null });
  });

  it('says the browser is not letting dacapo save, where storage cannot be used', async () => {
    for (const failure of ['unsupported', 'error'] as const) {
      const shown = await notice(failure);
      expect(shown.state).toBe('unavailable');
      expect(shown.words).toBe('storage.unavailable');
      expect(shown.button?.textContent).toBe('storage.dismiss');
      act(() => root?.unmount());
      root = null;
      stop?.();
    }
  });

  it('says to reload, with the button, over a database of a later version', async () => {
    const shown = await notice('newer');
    expect(shown.state).toBe('newer');
    expect(shown.words).toBe('storage.outdated');
    expect(shown.button?.textContent).toBe('storage.reload');
    // It cannot be dismissed: the one button reloads.
    expect(host.querySelectorAll('.storage-notice button')).toHaveLength(1);
  });
});
