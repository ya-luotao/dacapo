// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { en } from '../../i18n/en.ts';
import { I18nProvider } from '../../i18n/index.ts';
import type { InputSystem, MidiStatus, PointerInput } from '../../input/index.ts';
import { InputContext } from '../input/context.ts';
import { Piano } from './Piano.tsx';

let root: Root | null = null;
let host: HTMLElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  Element.prototype.scrollTo = () => undefined;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  localStorage.clear();
});

const POINTER: PointerInput = {
  press: () => undefined,
  release: () => undefined,
  isDown: () => false,
} as unknown as PointerInput;

function makeInput(state: MidiStatus['state'], octave = 4): InputSystem {
  const status = { state } as MidiStatus;
  return {
    midi: {
      subscribeStatus: () => () => undefined,
      getStatus: () => status,
    },
    keyboard: {
      subscribeOctave: () => () => undefined,
      getOctave: () => octave,
    },
  } as unknown as InputSystem;
}

function renderPiano(
  props: Partial<Parameters<typeof Piano>[0]> = {},
  input: InputSystem | null = null,
) {
  if (root) act(() => root!.unmount());
  root = createRoot(host);
  const el = createElement(Piano, {
    held: new Map<number, number>(),
    sustained: new Set<number>(),
    pointer: POINTER,
    range: [48, 72] as const,
    ...props,
  });
  act(() =>
    root!.render(
      createElement(I18nProvider, {
        initial: { locale: 'en', dictionary: en },
        children: input ? createElement(InputContext, { value: input, children: el }) : el,
      }),
    ),
  );
}

describe('Piano keyboard keycaps', () => {
  it('shows A–K keycaps for the active computer-keyboard octave when no MIDI device is connected', () => {
    renderPiano({}, makeInput('no-device', 4));
    expect(host.querySelector('[data-midi="60"] .key-shortcut')?.textContent).toBe('A');
    expect(host.querySelector('[data-midi="61"] .key-shortcut')?.textContent).toBe('W');
    expect(host.querySelector('[data-midi="72"] .key-shortcut')?.textContent).toBe('K');
    expect(host.querySelector('[data-midi="59"] .key-shortcut')).toBeNull();
    expect(
      host.querySelector('[data-midi="60"] .key-shortcut')?.classList.contains('is-raised'),
    ).toBe(true);
  });

  it('hides keycaps when a MIDI keyboard is connected, in still mode, or when keyNames are given', () => {
    renderPiano({}, makeInput('connected', 4));
    expect(host.querySelector('.key-shortcut')).toBeNull();

    renderPiano({ still: true }, makeInput('no-device', 4));
    expect(host.querySelector('.key-shortcut')).toBeNull();

    renderPiano({ keyNames: new Map([[60, 'C']]) }, makeInput('no-device', 4));
    expect(host.querySelector('.key-shortcut')).toBeNull();
  });

  it('renders cleanly without InputContext', () => {
    renderPiano({}, null);
    expect(host.querySelector('.key-shortcut')).toBeNull();
    expect(host.querySelector('[data-midi="60"]')).not.toBeNull();
  });
});
