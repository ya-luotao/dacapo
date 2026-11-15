// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import { en } from '../../i18n/en.ts';
import { I18nProvider } from '../../i18n/index.ts';
import { BUILT_IN } from '../../pieces/library/index.ts';
import { PracticeContext } from '../practice/context.ts';
import type { PracticeData, PracticeStore } from '../practice/store.ts';
import { Library } from './Library.tsx';

let root: Root | null = null;
let host: HTMLElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  localStorage.clear();
});

const EMPTY_DATA: PracticeData = {
  attempts: [],
  stats: {},
  sessions: [],
  pieces: [],
  answers: [],
  reviewOff: [],
  assignments: [],
  lessons: [],
};

const STORE = {
  subscribe: () => () => undefined,
  getSnapshot: () => EMPTY_DATA,
  subscribeStatus: () => () => undefined,
  getStatus: () => ({ state: 'ready' }),
  subscribePieceSteps: () => () => undefined,
  getPieceSteps: () => [],
  loadPieceSteps: () => undefined,
} as unknown as PracticeStore;

function mountLibrary(finished: ReadonlySet<string> | null) {
  root = createRoot(host);
  act(() =>
    root!.render(
      createElement(I18nProvider, {
        initial: { locale: 'en', dictionary: en },
        children: createElement(PracticeContext, {
          value: STORE,
          children: createElement(Router, {
            hook: memoryLocation({ path: '/pieces' }).hook,
            children: createElement(Library, { finished }),
          }),
        }),
      }),
    ),
  );
}

function setSearch(value: string) {
  const input = host.querySelector<HTMLInputElement>('.library-search-input')!;
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;
  act(() => {
    descriptor.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('Library search and status filter', () => {
  it('filters pieces by query and lets the clear button restore all results', () => {
    mountLibrary(new Set(['bach-prelude-c']));
    const total = BUILT_IN.length;
    expect(host.querySelectorAll('.library-piece').length).toBe(total);

    setSearch('Bach');
    const bachMatches = host.querySelectorAll('.library-piece').length;
    expect(bachMatches).toBeGreaterThan(0);
    expect(bachMatches).toBeLessThan(total);

    const clear = host.querySelector<HTMLButtonElement>('.library-search-clear');
    expect(clear).not.toBeNull();
    act(() => clear!.click());
    expect(host.querySelectorAll('.library-piece').length).toBe(total);

    setSearch('zzzz-nonexistent-piece');
    expect(host.querySelectorAll('.library-piece').length).toBe(0);
    expect(host.querySelector('.library-empty')?.textContent).toBe(en['pieces.library.empty']);
  });

  it('filters by played status while keeping each grade’s full played total', () => {
    const firstGradePiece = BUILT_IN.find((p) => !p.leadSheet && p.level === 1)!;
    const grade1Count = BUILT_IN.filter((p) => !p.leadSheet && p.level === 1).length;
    mountLibrary(new Set([firstGradePiece.id]));

    const playedRadio = host.querySelector<HTMLInputElement>(
      '.library-filter input[value="played"]',
    )!;
    act(() => playedRadio.click());

    expect(host.querySelectorAll('.library-piece').length).toBe(1);
    expect(host.querySelector('.library-level-played')?.textContent).toBe(`1 of ${grade1Count}`);

    const unplayedRadio = host.querySelector<HTMLInputElement>(
      '.library-filter input[value="unplayed"]',
    )!;
    act(() => unplayedRadio.click());
    expect(host.querySelectorAll('.library-piece').length).toBe(BUILT_IN.length - 1);
  });
});
