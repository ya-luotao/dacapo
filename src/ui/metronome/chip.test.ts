// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import type { InputSystem } from '../../input/index.ts';
import { I18nContext, type I18nContextValue } from '../../i18n/context.ts';
import { InputContext } from '../input/context.ts';
import { MetronomeChip } from './MetronomeChip.tsx';
import { MetronomeProvider } from './MetronomeProvider.tsx';
import { createAppMetronome } from './prefs.ts';

let root: Root | null = null;
const frames = vi.fn<(callback: FrameRequestCallback) => number>(() => 1);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  frames.mockClear();
  vi.stubGlobal('requestAnimationFrame', frames);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  vi.unstubAllGlobals();
  localStorage.clear();
});

function mount(path: string) {
  const handle = createAppMetronome();
  const input = { hub: { onEvent: () => () => undefined } } as unknown as InputSystem;
  const i18n = {
    locale: 'en',
    override: null,
    setOverride: () => undefined,
    t: (key: string) => key,
  };
  root = createRoot(document.createElement('div'));
  act(() =>
    root!.render(
      createElement(
        I18nContext,
        { value: i18n as unknown as I18nContextValue },
        createElement(
          InputContext,
          { value: input },
          createElement(MetronomeProvider, {
            handle,
            children: createElement(Router, {
              hook: memoryLocation({ path }).hook,
              children: createElement(MetronomeChip),
            }),
          }),
        ),
      ),
    ),
  );
  return handle.metronome;
}

describe('the metronome chip', () => {
  it('draws the beat while the metronome runs', () => {
    const metronome = mount('/');
    act(() => metronome.start());
    expect(frames).toHaveBeenCalled();
    act(() => metronome.stop());
  });

  it('draws nothing on the metronome’s own page, where it is not shown', () => {
    const metronome = mount('/metronome');
    act(() => metronome.start());
    expect(frames).not.toHaveBeenCalled();
    act(() => metronome.stop());
  });
});
