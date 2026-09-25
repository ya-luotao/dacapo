// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentShell, holdKeepAwake } from './shell.ts';

const postMessage = vi.fn();

beforeEach(() => {
  postMessage.mockClear();
  Object.defineProperty(globalThis, 'webkit', {
    value: { messageHandlers: { dacapoApp: { postMessage } } },
    configurable: true,
  });
});

afterEach(() => {
  delete document.documentElement.dataset.shell;
  delete (globalThis as { webkit?: unknown }).webkit;
});

describe('currentShell', () => {
  it('is the Apple app only when the document is marked', () => {
    expect(currentShell()).toBe('web');
    document.documentElement.dataset.shell = 'apple';
    expect(currentShell()).toBe('apple');
    document.documentElement.dataset.shell = 'something else';
    expect(currentShell()).toBe('web');
    expect(currentShell(null)).toBe('web');
  });
});

describe('holdKeepAwake', () => {
  it('asks the app once for any number of holds, and lets go after the last', () => {
    document.documentElement.dataset.shell = 'apple';
    const a = holdKeepAwake();
    const b = holdKeepAwake();
    expect(postMessage.mock.calls).toEqual([[{ type: 'keepAwake', on: true }]]);
    a();
    a(); // releasing twice counts once
    expect(postMessage).toHaveBeenCalledTimes(1);
    b();
    expect(postMessage.mock.calls.at(-1)).toEqual([{ type: 'keepAwake', on: false }]);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it('does nothing in a browser, even one with the handler', () => {
    const release = holdKeepAwake();
    release();
    expect(postMessage).not.toHaveBeenCalled();
  });
});
