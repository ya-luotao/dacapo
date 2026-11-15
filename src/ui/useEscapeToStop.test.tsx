// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEscapeToStop } from './useEscapeToStop.ts';

let root: Root | null = null;
let host: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.append(host);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  host.remove();
});

function render(node: ReactNode) {
  if (!root) root = createRoot(host);
  act(() => {
    root!.render(node);
  });
}

function Harness({
  onStop,
  enabled,
  children,
}: {
  onStop: () => void;
  enabled?: boolean;
  children?: ReactNode;
}) {
  useEscapeToStop(onStop, enabled);
  return <div>{children}</div>;
}

function dispatchEscape(target: EventTarget = window, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key: 'Escape',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

describe('useEscapeToStop', () => {
  it('fires onStop once and prevents default when enabled', () => {
    const onStop = vi.fn();
    render(
      <Harness onStop={onStop}>
        <button type="button">Stop</button>
      </Harness>,
    );

    const winEvent = dispatchEscape(window);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(winEvent.defaultPrevented).toBe(true);

    const button = host.querySelector('button')!;
    const btnEvent = dispatchEscape(button);
    expect(onStop).toHaveBeenCalledTimes(2);
    expect(btnEvent.defaultPrevented).toBe(true);
  });

  it('respects the enabled flag across toggles and unmount', () => {
    const onStop = vi.fn();
    render(<Harness onStop={onStop} enabled={false} />);

    const disabledEvent = dispatchEscape();
    expect(onStop).not.toHaveBeenCalled();
    expect(disabledEvent.defaultPrevented).toBe(false);

    render(<Harness onStop={onStop} enabled />);
    dispatchEscape();
    expect(onStop).toHaveBeenCalledTimes(1);

    render(<Harness onStop={onStop} enabled={false} />);
    dispatchEscape();
    expect(onStop).toHaveBeenCalledTimes(1);

    render(<Harness onStop={onStop} enabled />);
    act(() => {
      root?.unmount();
    });
    root = null;
    dispatchEscape();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('keeps one listener across renders while invoking the latest callback', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const first = vi.fn();
    const second = vi.fn();

    render(<Harness onStop={first} />);
    const keydownRegistrations = addSpy.mock.calls.filter(([type]) => type === 'keydown').length;

    render(<Harness onStop={second} />);
    expect(addSpy.mock.calls.filter(([type]) => type === 'keydown').length).toBe(
      keydownRegistrations,
    );

    dispatchEscape();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    addSpy.mockRestore();
  });

  it('ignores non-Escape keys, modifier keys, IME composition, and defaultPrevented events', () => {
    const onStop = vi.fn();
    render(<Harness onStop={onStop} />);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', cancelable: true }));
    dispatchEscape(window, { metaKey: true });
    dispatchEscape(window, { ctrlKey: true });
    dispatchEscape(window, { altKey: true });
    dispatchEscape(window, { isComposing: true });

    const prevented = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    prevented.preventDefault();
    window.dispatchEvent(prevented);

    expect(onStop).not.toHaveBeenCalled();
  });

  it('ignores Escape while a modal dialog is open', () => {
    const onStop = vi.fn();
    render(
      <Harness onStop={onStop}>
        <div role="dialog">Dialog</div>
      </Harness>,
    );

    const dialogEvent = dispatchEscape();
    expect(onStop).not.toHaveBeenCalled();
    expect(dialogEvent.defaultPrevented).toBe(false);

    render(
      <Harness onStop={onStop}>
        <div aria-modal="true">Modal</div>
      </Harness>,
    );
    dispatchEscape();
    expect(onStop).not.toHaveBeenCalled();

    render(<Harness onStop={onStop} />);
    dispatchEscape();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape inside open <details> but fires for closed <details>', () => {
    const onStop = vi.fn();
    render(
      <Harness onStop={onStop}>
        <details open>
          <summary>Options</summary>
          <button type="button">Inside</button>
        </details>
      </Harness>,
    );

    const insideBtn = host.querySelector('button')!;
    const summary = host.querySelector('summary')!;
    expect(dispatchEscape(insideBtn).defaultPrevented).toBe(false);
    expect(dispatchEscape(summary).defaultPrevented).toBe(false);
    expect(onStop).not.toHaveBeenCalled();

    render(
      <Harness onStop={onStop}>
        <details>
          <summary>Options</summary>
        </details>
      </Harness>,
    );
    const closedSummary = host.querySelector('summary')!;
    expect(dispatchEscape(closedSummary).defaultPrevented).toBe(true);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('ignores text-entry/select/contenteditable targets while allowing non-text inputs', () => {
    const onStop = vi.fn();
    render(
      <Harness onStop={onStop}>
        <input type="text" data-testid="text" />
        <input data-testid="default-input" />
        <input type="search" data-testid="search" />
        <textarea data-testid="textarea" />
        <select data-testid="select">
          <option value="1">One</option>
        </select>
        <div contentEditable="true" suppressContentEditableWarning data-testid="editable">
          <span>Editable</span>
        </div>
        <input type="checkbox" data-testid="checkbox" />
        <input type="radio" data-testid="radio" />
        <input type="button" value="Btn" data-testid="button-input" />
        <input type="range" data-testid="range" />
        <input type="submit" data-testid="submit" />
        <input type="reset" data-testid="reset" />
      </Harness>,
    );

    for (const id of ['text', 'default-input', 'search', 'textarea', 'select', 'editable']) {
      const el = host.querySelector(`[data-testid="${id}"]`)!;
      expect(dispatchEscape(el).defaultPrevented, id).toBe(false);
    }
    expect(
      dispatchEscape(host.querySelector('[data-testid="editable"] span')!).defaultPrevented,
    ).toBe(false);
    expect(onStop).not.toHaveBeenCalled();

    const nonText = ['checkbox', 'radio', 'button-input', 'range', 'submit', 'reset'] as const;
    for (const id of nonText) {
      const el = host.querySelector(`[data-testid="${id}"]`)!;
      expect(dispatchEscape(el).defaultPrevented, id).toBe(true);
    }
    expect(onStop).toHaveBeenCalledTimes(nonText.length);
  });
});
