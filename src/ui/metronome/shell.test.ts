// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputSystem } from '../../input/index.ts';
import { InputContext } from '../input/context.ts';
import { MetronomeProvider } from './MetronomeProvider.tsx';
import { createAppMetronome } from './prefs.ts';

// The metronome inside the Apple app: the screen stays on while it runs, and it stops when the app
// goes to the background. In a browser a hidden tab keeps ticking.

const postMessage = vi.fn();
let root: Root | null = null;
let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  postMessage.mockClear();
  Object.defineProperty(globalThis, 'webkit', {
    value: { messageHandlers: { dacapoApp: { postMessage } } },
    configurable: true,
  });
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true });
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  visibility = 'visible';
  delete document.documentElement.dataset.shell;
  delete (globalThis as { webkit?: unknown }).webkit;
  localStorage.clear();
});

function hide() {
  visibility = 'hidden';
  act(() => void document.dispatchEvent(new Event('visibilitychange')));
}

function mount() {
  const handle = createAppMetronome();
  const input = { hub: { onEvent: () => () => undefined } } as unknown as InputSystem;
  root = createRoot(document.createElement('div'));
  act(() =>
    root!.render(
      createElement(
        InputContext,
        { value: input },
        createElement(MetronomeProvider, { handle, children: null }),
      ),
    ),
  );
  return handle.metronome;
}

const awake = () => postMessage.mock.calls.map(([m]) => (m as { on: boolean }).on);

describe('the metronome in the Apple app', () => {
  it('keeps the screen on while it runs', () => {
    document.documentElement.dataset.shell = 'apple';
    const metronome = mount();
    expect(awake()).toEqual([]);
    act(() => metronome.start());
    expect(awake()).toEqual([true]);
    act(() => metronome.stop());
    expect(awake()).toEqual([true, false]);
  });

  it('stops, and lets the screen sleep, when the app goes to the background', () => {
    document.documentElement.dataset.shell = 'apple';
    const metronome = mount();
    act(() => metronome.start());
    hide();
    expect(metronome.getSnapshot().status).toBe('stopped');
    expect(awake()).toEqual([true, false]);
  });
});

describe('the metronome in a browser', () => {
  it('keeps ticking in a hidden tab, and asks nothing of an app', () => {
    const metronome = mount();
    act(() => metronome.start());
    hide();
    expect(metronome.getSnapshot().status).toBe('running');
    expect(postMessage).not.toHaveBeenCalled();
    act(() => metronome.stop());
  });
});
