// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { en } from '../../i18n/en.ts';
import { I18nProvider } from '../../i18n/index.ts';
import type { HubState, InputSystem } from '../../input/index.ts';
import { InputContext } from '../input/context.ts';
import { Specimen } from './Specimen.tsx';

let root: Root | null = null;
let host: HTMLElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
});

function makeInput() {
  let state: HubState = { held: new Map(), sustained: new Set(), sustain: false, lastChord: [] };
  let down = false;
  const listeners = new Set<() => void>();
  const press = vi.fn((_pointerId: number, midi: number) => {
    down = true;
    state = { ...state, held: new Map([[midi, 96]]) };
    for (const fn of listeners) fn();
  });
  const release = vi.fn(() => {
    down = false;
    state = { ...state, held: new Map() };
    for (const fn of listeners) fn();
  });
  const system = {
    hub: {
      subscribe: (fn: () => void) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      getState: () => state,
    },
    pointer: {
      press,
      release,
      isDown: () => down,
    },
  } as unknown as InputSystem;
  return { system, press, release };
}

describe('Home Specimen keyboard interaction', () => {
  it('plays and highlights a clicked key on the specimen keyboard', () => {
    const { system, press, release } = makeInput();
    root = createRoot(host);
    act(() =>
      root!.render(
        createElement(I18nProvider, {
          initial: { locale: 'en', dictionary: en },
          children: createElement(InputContext, {
            value: system,
            children: createElement(Specimen),
          }),
        }),
      ),
    );

    const key = host.querySelector('.specimen-keys rect[data-midi="67"]')!;
    expect(key).not.toBeNull();

    act(() => {
      key.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    });

    expect(press).toHaveBeenCalledTimes(1);
    expect(press.mock.calls[0]![1]).toBe(67);
    expect(host.querySelector('.specimen')?.getAttribute('data-played')).toBe('true');
    expect(host.querySelector('.specimen-name')?.textContent).toBe('G4');
    expect(key.classList.contains('is-lit')).toBe(true);

    act(() => {
      key.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    });
    expect(release).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.specimen')?.getAttribute('data-played')).toBeNull();
  });
});
