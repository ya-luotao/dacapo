// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import type { StoredPiece } from '../core/storedPiece.ts';
import { I18nContext, type I18nContextValue } from '../i18n/context.ts';
import { loadLocale, type Translate } from '../i18n/index.ts';
import type { HubEvent, InputSystem, MidiStatus } from '../input/index.ts';
import { BUILTIN_OUTPUT, type OutputState } from '../output/output.ts';
import { App } from './App.tsx';
import { InputContext } from './input/context.ts';
import { InstrumentChip } from './input/InstrumentChip.tsx';
import { MetronomeProvider } from './metronome/MetronomeProvider.tsx';
import { createAppMetronome } from './metronome/prefs.ts';
import { PracticeContext } from './practice/context.ts';
import type { PracticeData, PracticeStore, StorageStatus } from './practice/store.ts';
import { QuickJump } from './QuickJump.tsx';
import { buildJumpEntries, filterJumpEntries } from './QuickJumpData.ts';
import { Sidebar } from './Sidebar.tsx';
import { SyncProvider } from './sync/SyncProvider.tsx';

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let enDictionary: Record<string, string> = {};

beforeAll(async () => {
  const loaded = await loadLocale('en');
  enDictionary = loaded.dictionary;
});

function createTranslate(): Translate {
  return (key, vars) => {
    let text: string = enDictionary[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replaceAll(`{${k}}`, String(v));
      }
    }
    return text;
  };
}

function createI18nValue(t = createTranslate()): I18nContextValue {
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

interface MockInputControl {
  system: InputSystem;
  emitNoteOn: (midi: number) => void;
  setMidiStatus: (next: MidiStatus) => void;
  retry: ReturnType<typeof vi.fn>;
}

function createMockInput({
  status = { state: 'no-device' },
  outputState = {
    ports: [BUILTIN_OUTPUT],
    choice: { kind: 'auto' },
    selected: BUILTIN_OUTPUT,
  },
}: {
  status?: MidiStatus;
  outputState?: OutputState;
} = {}): MockInputControl {
  let currentStatus = status;
  const statusListeners = new Set<() => void>();
  const eventListeners = new Set<(event: HubEvent) => void>();
  const retry = vi.fn();

  const hubState = { held: new Set<number>(), sustained: new Set<number>(), pedal: false };
  const monitorSettings = { mode: 'all', level: 1 };

  const system = {
    hub: {
      onEvent(listener: (event: HubEvent) => void) {
        eventListeners.add(listener);
        return () => eventListeners.delete(listener);
      },
      subscribe: () => () => undefined,
      getState: () => hubState,
    },
    midi: {
      subscribeStatus(listener: () => void) {
        statusListeners.add(listener);
        return () => statusListeners.delete(listener);
      },
      getStatus: () => currentStatus,
      retry,
    },
    output: {
      subscribe: () => () => undefined,
      getState: () => outputState,
    },
    samples: {
      subscribe: () => () => undefined,
      getStatus: () => 'ready',
    },
    monitor: {
      subscribe: () => () => undefined,
      getSettings: () => monitorSettings,
    },
    keyboard: {
      subscribeOctave: () => () => undefined,
      getOctave: () => 4,
    },
  } as unknown as InputSystem;

  return {
    system,
    retry,
    emitNoteOn(midi: number) {
      const event: HubEvent = { type: 'on', midi, velocity: 90, time: 0 };
      for (const listener of eventListeners) listener(event);
    },
    setMidiStatus(next: MidiStatus) {
      currentStatus = next;
      for (const listener of statusListeners) listener();
    },
  };
}

function createMockPracticeStore(pieces: readonly StoredPiece[] = []): PracticeStore {
  const snapshot: PracticeData = {
    attempts: [],
    stats: {},
    sessions: [],
    pieces,
    answers: [],
    reviewOff: [],
    assignments: [],
    lessons: [],
  };
  const status: StorageStatus = {
    state: 'saved',
    loaded: true,
    read: true,
    persisted: null,
  };
  const emptySteps: readonly never[] = [];
  return {
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    subscribeStatus: () => () => undefined,
    getStatus: () => status,
    subscribePieceSteps: () => () => undefined,
    getPieceSteps: () => emptySteps,
    loadPieceSteps: () => undefined,
    subscribeScaleRuns: () => () => undefined,
    getScaleRuns: () => emptySteps,
    loadScaleRuns: () => undefined,
  } as unknown as PracticeStore;
}

function mount(node: ReactNode): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(node);
  });
  return container;
}

function typeInput(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function dispatchPointerDown(target: EventTarget): void {
  const EventCtor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  act(() => {
    target.dispatchEvent(new EventCtor('pointerdown', { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.location.hash = '';
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  vi.unstubAllGlobals();
  localStorage.clear();
  window.location.hash = '';
});

describe('InstrumentChip', () => {
  it('shows idle status and flashes played note for 1,200 ms', () => {
    vi.useFakeTimers();
    const mock = createMockInput({ status: { state: 'no-device' } });
    const loc = memoryLocation({ path: '/' });

    const el = mount(
      createElement(
        I18nContext,
        { value: createI18nValue() },
        createElement(
          InputContext,
          { value: mock.system },
          createElement(Router, {
            hook: loc.hook,
            children: createElement(InstrumentChip),
          }),
        ),
      ),
    );

    const toggle = el.querySelector<HTMLButtonElement>('.instrument-chip-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Instrument and sound');
    expect(el.querySelector('.instrument-dot.is-idle')).not.toBeNull();
    expect(el.querySelector('.instrument-chip-label')?.textContent).toBe('A–K');

    act(() => mock.emitNoteOn(60));
    const noteLabel = el.querySelector('.instrument-chip-label');
    expect(noteLabel?.textContent).toBe('C4');
    expect(noteLabel?.classList.contains('is-note')).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1199);
    });
    expect(el.querySelector('.instrument-chip-label')?.textContent).toBe('C4');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(el.querySelector('.instrument-chip-label')?.textContent).toBe('A–K');
    expect(el.querySelector('.instrument-chip-label')?.classList.contains('is-note')).toBe(false);

    // Popover retains the last tested note even after the chip flash fades.
    act(() => toggle.click());
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Last note: C4');
    expect(dialog.textContent).toContain('Sound: Built-in piano');
  });

  it('opens popover, supports Escape and outside pointerdown, and exposes retry when denied', () => {
    const mock = createMockInput({
      status: { state: 'no-permission' },
      outputState: { ports: [], choice: { kind: 'none' }, selected: null },
    });
    const loc = memoryLocation({ path: '/', record: true });

    const el = mount(
      createElement(
        I18nContext,
        { value: createI18nValue() },
        createElement(
          InputContext,
          { value: mock.system },
          createElement(Router, {
            hook: loc.hook,
            children: createElement(InstrumentChip),
          }),
        ),
      ),
    );

    expect(el.querySelector('.instrument-dot.is-denied')).not.toBeNull();
    const toggle = el.querySelector<HTMLButtonElement>('.instrument-chip-toggle')!;
    act(() => toggle.click());

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('MIDI access is blocked');
    expect(dialog.textContent).toContain('Play any key to test');
    expect(dialog.textContent).toContain('Sound: Off');

    const retryButton = el.querySelector<HTMLButtonElement>('.instrument-retry')!;
    expect(retryButton.textContent).toBe('Try MIDI again');
    act(() => retryButton.click());
    expect(mock.retry).toHaveBeenCalledTimes(1);

    // Clicking outside closes the popover.
    dispatchPointerDown(document.body);
    expect(el.querySelector('[role="dialog"]')).toBeNull();

    // Reopen, then press Escape -> closes and returns focus to toggle.
    act(() => toggle.click());
    expect(el.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(toggle);

    // Navigating via footer link closes popover and navigates to /settings.
    act(() => toggle.click());
    const settingsLink = el.querySelector<HTMLAnchorElement>('a[href="/settings"]')!;
    act(() => settingsLink.click());
    expect(loc.history).toContain('/settings');
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('displays connected MIDI device name and external sound output', () => {
    const mock = createMockInput({
      status: { state: 'connected', names: ['Keystep 37'] },
      outputState: {
        ports: [{ id: 'out-1', name: 'Roland FP-30X' }],
        choice: { kind: 'port', name: 'Roland FP-30X' },
        selected: { id: 'out-1', name: 'Roland FP-30X' },
      },
    });
    const loc = memoryLocation({ path: '/' });

    const el = mount(
      createElement(
        I18nContext,
        { value: createI18nValue() },
        createElement(
          InputContext,
          { value: mock.system },
          createElement(Router, {
            hook: loc.hook,
            children: createElement(InstrumentChip),
          }),
        ),
      ),
    );

    expect(el.querySelector('.instrument-dot.is-connected')).not.toBeNull();
    expect(el.querySelector('.instrument-chip-label')?.textContent).toBe('Keystep 37');

    act(() => el.querySelector<HTMLButtonElement>('.instrument-chip-toggle')!.click());
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Connected: Keystep 37');
    expect(dialog.textContent).toContain('Sound: Roland FP-30X');
  });
});

describe('QuickJumpData & QuickJump', () => {
  it('builds entries for pages, practices, built-in/custom pieces, lessons, and /learn/terms/:slug', () => {
    const customPiece: StoredPiece = {
      id: 'user:my-waltz',
      title: 'My Custom Waltz',
      composer: 'Alice',
      fileName: 'waltz.musicxml',
      addedAt: 1000,
    } as unknown as StoredPiece;

    const entries = buildJumpEntries({
      t: createTranslate(),
      locale: 'en',
      customPieces: [customPiece],
    });

    expect(entries.some((e) => e.group === 'pages' && e.href === '/learn/terms')).toBe(true);
    expect(entries.some((e) => e.group === 'practices' && e.href === '/read?family=notes')).toBe(
      true,
    );
    expect(entries.some((e) => e.group === 'practices' && e.href === '/ear?family=interval')).toBe(
      true,
    );
    expect(
      entries.some((e) => e.group === 'practices' && e.href === '/harmony?practice=chords'),
    ).toBe(true);
    expect(
      entries.some((e) => e.group === 'pieces' && e.href === '/pieces/turk-aller-anfang'),
    ).toBe(true);
    expect(entries.some((e) => e.group === 'pieces' && e.href === '/pieces/user%3Amy-waltz')).toBe(
      true,
    );
    expect(entries.some((e) => e.group === 'lessons' && e.href.startsWith('/learn/'))).toBe(true);
    expect(entries.some((e) => e.group === 'terms' && e.href === '/learn/terms/crescendo')).toBe(
      true,
    );

    const matched = filterJumpEntries(entries, 'cresc.');
    expect(matched.some((e) => e.href === '/learn/terms/crescendo')).toBe(true);
  });

  it('filters results, supports ArrowDown/ArrowUp/Enter navigation, and restores focus on Escape', () => {
    const mock = createMockInput();
    const store = createMockPracticeStore();
    const loc = memoryLocation({ path: '/', record: true });

    function Harness() {
      const [open, setOpen] = useState(false);
      return createElement(
        'div',
        null,
        createElement(Sidebar, { onOpenJump: () => setOpen(true) }),
        createElement(QuickJump, { open, onClose: () => setOpen(false) }),
      );
    }

    const el = mount(
      createElement(
        I18nContext,
        { value: createI18nValue() },
        createElement(
          InputContext,
          { value: mock.system },
          createElement(
            PracticeContext,
            { value: store },
            createElement(MetronomeProvider, {
              handle: createAppMetronome(),
              children: createElement(Router, {
                hook: loc.hook,
                children: createElement(Harness),
              }),
            }),
          ),
        ),
      ),
    );

    // Quick jump trigger stays outside <nav aria-label="Main">.
    const mainNav = el.querySelector('nav[aria-label="Main"]')!;
    const trigger = el.querySelector<HTMLButtonElement>('.jump-trigger')!;
    expect(mainNav.contains(trigger)).toBe(false);
    expect(el.querySelector('.side-end .instrument-chip')).not.toBeNull();

    // Open via trigger and check auto-focus + Escape focus restoration.
    act(() => trigger.focus());
    act(() => trigger.click());

    const input = el.querySelector<HTMLInputElement>('.jump-input')!;
    expect(document.activeElement).toBe(input);

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(el.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    // Reopen, test empty state, then filter & navigate with ArrowDown + Enter.
    act(() => trigger.click());
    const search = el.querySelector<HTMLInputElement>('.jump-input')!;
    typeInput(search, 'xyzzy-nope');
    expect(el.querySelector('.jump-empty')?.textContent).toBe('Nothing matches “xyzzy-nope”.');

    typeInput(search, 'crescendo');
    const options = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');

    // Move ArrowDown to options[1] ("Crescendo (cresc.)"), verify ArrowUp, then ArrowDown + Enter.
    act(() => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');
    act(() => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(options[0]!.getAttribute('aria-selected')).toBe('true');
    act(() => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(options[1]!.getAttribute('aria-selected')).toBe('true');

    act(() => {
      search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(loc.history).toContain('/learn/terms/crescendo');
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('App Cmd/Ctrl+K integration', () => {
  it('lazily mounts QuickJump when Cmd+K or Ctrl+K is pressed', async () => {
    const mock = createMockInput();
    const store = createMockPracticeStore();

    const el = mount(
      createElement(
        I18nContext,
        { value: createI18nValue() },
        createElement(
          InputContext,
          { value: mock.system },
          createElement(
            PracticeContext,
            { value: store },
            createElement(SyncProvider, {
              client: null,
              children: createElement(MetronomeProvider, {
                handle: createAppMetronome(),
                children: createElement(App),
              }),
            }),
          ),
        ),
      ),
    );

    expect(el.querySelector('.jump-dialog')).toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    expect(el.querySelector('.jump-dialog')).not.toBeNull();

    // Pressing Meta+K toggles it closed.
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(el.querySelector('.jump-dialog')).toBeNull();
  });
});
