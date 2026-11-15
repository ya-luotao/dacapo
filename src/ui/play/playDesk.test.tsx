// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, loadLocale } from '../../i18n/index.ts';
import type { LoadedLocale } from '../../i18n/locale.ts';
import type { HubEvent, InputSystem } from '../../input/index.ts';
import { DEMO_LEAD_MS } from '../../output/demo.ts';
import { BUILTIN_OUTPUT } from '../../output/output.ts';
import { createScheduler } from '../../output/scheduler.ts';
import { FakePort } from '../../output/testing.ts';
import { InputContext } from '../input/context.ts';
import { PlayPage } from '../pages/PlayPage.tsx';
import { PracticeContext } from '../practice/context.ts';
import { createPracticeStore } from '../practice/store.ts';
import { PlayDesk } from './PlayDesk.tsx';

vi.mock('../staff/font.ts', () => ({
  MUSIC_FONT: 'Bravura',
  loadMusicFont: () => undefined,
  subscribeFont: () => () => undefined,
  getFontState: () => 'ready',
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let locale: LoadedLocale;
let host: HTMLDivElement;
let root: Root;

interface TestHarness {
  input: InputSystem;
  port: FakePort;
  emit: (event: HubEvent) => void;
}

function createHarness(): TestHarness {
  const port = new FakePort();
  const scheduler = createScheduler();
  scheduler.setPort(port);

  const eventListeners = new Set<(event: HubEvent) => void>();
  const interruptListeners = new Set<(reason: 'disconnect') => void>();
  const hubState = {
    held: new Map<number, number>(),
    sustained: new Set<number>(),
    sustain: false,
    lastChord: [] as number[],
  };
  const outputState = {
    ports: [BUILTIN_OUTPUT],
    choice: { kind: 'auto' as const },
    selected: BUILTIN_OUTPUT,
  };

  const midiStatus = { state: 'no-device' as const };
  const monitorSettings = { mode: 'all' as const, level: 1 };

  const input = {
    hub: {
      onEvent(listener: (event: HubEvent) => void) {
        eventListeners.add(listener);
        return () => eventListeners.delete(listener);
      },
      subscribe: () => () => undefined,
      getState: () => hubState,
    },
    midi: {
      subscribeStatus: () => () => undefined,
      getStatus: () => midiStatus,
      retry: vi.fn(),
    },
    output: {
      scheduler,
      onInterrupt(listener: (reason: 'disconnect') => void) {
        interruptListeners.add(listener);
        return () => interruptListeners.delete(listener);
      },
      subscribe: () => () => undefined,
      getState: () => outputState,
    },
    samples: {
      subscribe: () => () => undefined,
      getStatus: () => 'ready' as const,
    },
    monitor: {
      subscribe: () => () => undefined,
      getSettings: () => monitorSettings,
    },
    keyboard: {
      subscribeOctave: () => () => undefined,
      getOctave: () => 4,
    },
    pointer: {
      down: () => undefined,
      up: () => undefined,
      cancel: () => undefined,
      start: () => () => undefined,
    } as unknown as InputSystem['pointer'],
  } as unknown as InputSystem;

  return {
    input,
    port,
    emit(event) {
      for (const listener of [...eventListeners]) listener(event);
    },
  };
}

function renderDesk(
  harness: TestHarness,
  props: {
    held?: ReadonlySet<number>;
    lastChord?: ReadonlySet<number>;
    onMarkedKeys?: (keys: ReadonlySet<number>) => void;
  } = {},
) {
  const held = props.held ?? new Set<number>();
  const lastChord = props.lastChord ?? new Set<number>();
  const onMarkedKeys = props.onMarkedKeys ?? vi.fn();

  const wrap = (node: ReactNode) => (
    <I18nProvider initial={locale} chosen="en">
      <InputContext.Provider value={harness.input}>{node}</InputContext.Provider>
    </I18nProvider>
  );

  act(() => {
    root.render(wrap(<PlayDesk held={held} lastChord={lastChord} onMarkedKeys={onMarkedKeys} />));
  });

  return {
    rerender(next: {
      held?: ReadonlySet<number>;
      lastChord?: ReadonlySet<number>;
      onMarkedKeys?: (keys: ReadonlySet<number>) => void;
    }) {
      act(() => {
        root.render(
          wrap(
            <PlayDesk
              held={next.held ?? held}
              lastChord={next.lastChord ?? lastChord}
              onMarkedKeys={next.onMarkedKeys ?? onMarkedKeys}
            />,
          ),
        );
      });
    },
  };
}

function buttonByText(label: string): HTMLButtonElement {
  const buttons = [...host.querySelectorAll('button')];
  const match = buttons.find((b) => b.textContent?.trim() === label);
  if (!match) throw new Error(`Button "${label}" not found`);
  return match;
}

function checkboxByLabel(label: string): HTMLInputElement {
  const inputs = [...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const match = inputs.find((input) => input.closest('label')?.textContent?.includes(label));
  if (!match) throw new Error(`Checkbox "${label}" not found`);
  return match;
}

beforeAll(async () => {
  if (!('scrollTo' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollTo', {
      value: () => undefined,
      configurable: true,
    });
  }
  HTMLCanvasElement.prototype.getContext = (() => ({
    measureText: () => ({ width: 8 }),
  })) as unknown as HTMLCanvasElement['getContext'];
  locale = await loadLocale('en');
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  localStorage.clear();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('PlayDesk', () => {
  it('defaults Show staff off, persists toggle in localStorage, and displays held or lastChord notes', () => {
    const harness = createHarness();
    const view = renderDesk(harness, {
      held: new Set([60, 64]),
      lastChord: new Set([67]),
    });

    const toggle = checkboxByLabel('Show staff');
    expect(toggle.checked).toBe(false);
    expect(host.querySelector('.play-staff')).toBeNull();

    act(() => {
      toggle.click();
    });

    expect(toggle.checked).toBe(true);
    expect(localStorage.getItem('dacapo.play.showStaff')).toBe('1');
    const staff = host.querySelector<HTMLElement>('.play-staff');
    expect(staff).not.toBeNull();
    expect(staff?.getAttribute('aria-label')).toContain('C4 E4');

    // Falls back to lastChord when held becomes empty.
    view.rerender({ held: new Set(), lastChord: new Set([67]) });
    expect(host.querySelector('.play-staff')?.getAttribute('aria-label')).toContain('G4');

    // Remount preserves persisted Show staff state.
    act(() => root.unmount());
    root = createRoot(host);
    renderDesk(harness, { held: new Set(), lastChord: new Set() });
    expect(checkboxByLabel('Show staff').checked).toBe(true);
    expect(host.querySelector('.play-staff')?.getAttribute('aria-label')).toBe(
      'Notes on the staff',
    );

    act(() => {
      checkboxByLabel('Show staff').click();
    });
    expect(localStorage.getItem('dacapo.play.showStaff')).toBeNull();
    expect(host.querySelector('.play-staff')).toBeNull();
  });

  it('records a phrase, updates duration ticker, plays/pauses, loops, clears marked keys, and stops on unmount', () => {
    const harness = createHarness();
    const markedLog: ReadonlySet<number>[] = [];
    const onMarkedKeys = vi.fn((keys: ReadonlySet<number>) => {
      markedLog.push(new Set(keys));
    });

    renderDesk(harness, { onMarkedKeys });

    expect(host.textContent).toContain('Record a short phrase to hear it back');
    expect(buttonByText('Play').disabled).toBe(true);
    expect(buttonByText('Clear').disabled).toBe(true);

    // Start recording.
    act(() => {
      buttonByText('Record').click();
    });
    expect(buttonByText('Stop').getAttribute('aria-pressed')).toBe('true');

    // Emit C4 for 300ms, then E4 at 1050ms -> off at 1300ms.
    act(() => {
      harness.emit({ type: 'on', midi: 60, velocity: 88, time: performance.now() });
    });
    expect(host.textContent).toContain('Recording · 0:00');

    act(() => {
      vi.advanceTimersByTime(300);
      harness.emit({ type: 'off', midi: 60, velocity: 0, time: performance.now() });
      vi.advanceTimersByTime(750);
      harness.emit({ type: 'on', midi: 64, velocity: 90, time: performance.now() });
      vi.advanceTimersByTime(250);
      harness.emit({ type: 'off', midi: 64, velocity: 0, time: performance.now() });
    });
    expect(host.textContent).toContain('Recording · 0:01');

    act(() => {
      buttonByText('Stop').click();
    });

    expect(host.textContent).toContain('Phrase · 0:01');
    expect(buttonByText('Play').disabled).toBe(false);
    expect(buttonByText('Clear').disabled).toBe(false);

    // Play recorded phrase and verify marked key highlighting.
    act(() => {
      buttonByText('Play').click();
    });
    expect(buttonByText('Pause').getAttribute('aria-pressed')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(DEMO_LEAD_MS + 40);
    });
    expect(onMarkedKeys.mock.calls.some(([keys]) => keys.has(60))).toBe(true);

    // Toggle loop during playback without stopping.
    const loopBox = checkboxByLabel('Loop');
    act(() => {
      loopBox.click();
    });
    expect(loopBox.checked).toBe(true);
    expect(buttonByText('Pause').getAttribute('aria-pressed')).toBe('true');

    // Pause clears marked keys.
    act(() => {
      buttonByText('Pause').click();
    });
    expect([...(markedLog.at(-1) ?? [])]).toEqual([]);
    expect(buttonByText('Play')).toBeTruthy();

    // Resume then Clear resets state and marked keys.
    act(() => {
      buttonByText('Play').click();
      vi.advanceTimersByTime(DEMO_LEAD_MS + 40);
      buttonByText('Clear').click();
    });
    expect(host.textContent).toContain('Record a short phrase to hear it back');
    expect(buttonByText('Play').disabled).toBe(true);
    expect([...(markedLog.at(-1) ?? [])]).toEqual([]);

    // Verify unmount stops active playback cleanly.
    act(() => {
      buttonByText('Record').click();
    });
    act(() => {
      harness.emit({ type: 'on', midi: 67, velocity: 80, time: performance.now() });
      vi.advanceTimersByTime(200);
      harness.emit({ type: 'off', midi: 67, velocity: 0, time: performance.now() });
      buttonByText('Stop').click();
    });
    act(() => {
      buttonByText('Play').click();
    });
    act(() => {
      vi.advanceTimersByTime(DEMO_LEAD_MS + 40);
    });
    act(() => root.unmount());
    root = createRoot(host);
    expect([...(markedLog.at(-1) ?? [])]).toEqual([]);
  });

  it('handles R and Space shortcuts while respecting interactive controls, text inputs, and dialogs', () => {
    const harness = createHarness();
    renderDesk(harness);

    // Space does nothing before a phrase exists.
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }),
      );
    });
    expect(buttonByText('Record')).toBeTruthy();

    // R starts and stops recording.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true }));
    });
    expect(buttonByText('Stop')).toBeTruthy();

    act(() => {
      harness.emit({ type: 'on', midi: 60, velocity: 80, time: performance.now() });
      vi.advanceTimersByTime(200);
      harness.emit({ type: 'off', midi: 60, velocity: 0, time: performance.now() });
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true }));
    });
    expect(buttonByText('Play').disabled).toBe(false);

    // Modifier chords are ignored.
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', ctrlKey: true, bubbles: true }),
      );
    });
    expect(buttonByText('Record')).toBeTruthy();

    // Space from non-interactive element toggles playback.
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }),
      );
    });
    expect(buttonByText('Pause')).toBeTruthy();

    // Space dispatched with target inside a button is ignored by the global shortcut.
    const clearBtn = buttonByText('Clear');
    act(() => {
      clearBtn.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }),
      );
    });
    expect(buttonByText('Pause')).toBeTruthy();

    // Text input target ignores both R and Space.
    const textInput = document.createElement('input');
    textInput.type = 'text';
    host.append(textInput);
    act(() => {
      textInput.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }),
      );
      textInput.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true }),
      );
    });
    expect(buttonByText('Pause')).toBeTruthy();

    // Open dialog blocks R and Space.
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    host.append(dialog);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }),
      );
    });
    expect(buttonByText('Pause')).toBeTruthy();

    dialog.remove();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }),
      );
    });
    expect(buttonByText('Play')).toBeTruthy();
  });

  it('lazy-loads PlayDesk inside PlayPage and highlights marked keys on Piano during playback', async () => {
    const harness = createHarness();
    const practice = createPracticeStore();

    act(() => {
      root.render(
        <I18nProvider initial={locale} chosen="en">
          <PracticeContext.Provider value={practice}>
            <InputContext.Provider value={harness.input}>
              <PlayPage />
            </InputContext.Provider>
          </PracticeContext.Provider>
        </I18nProvider>,
      );
    });

    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(buttonByText('Record')).toBeTruthy();

    // Enable Show staff and record C4.
    act(() => {
      checkboxByLabel('Show staff').click();
      buttonByText('Record').click();
    });
    act(() => {
      harness.emit({ type: 'on', midi: 60, velocity: 88, time: performance.now() });
      vi.advanceTimersByTime(300);
      harness.emit({ type: 'off', midi: 60, velocity: 0, time: performance.now() });
      buttonByText('Stop').click();
    });

    // Play back and verify Piano key 60 receives .is-marked and staff displays C4.
    act(() => {
      buttonByText('Play').click();
    });
    act(() => {
      vi.advanceTimersByTime(DEMO_LEAD_MS + 30);
    });

    const key60 = host.querySelector('[data-midi="60"]');
    expect(key60?.classList.contains('is-marked')).toBe(true);
    expect(host.querySelector('.play-staff')?.getAttribute('aria-label')).toContain('C4');

    act(() => {
      buttonByText('Pause').click();
    });
    expect(host.querySelector('[data-midi="60"]')?.classList.contains('is-marked')).toBe(false);
  });
});
