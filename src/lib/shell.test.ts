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

describe('holdKeepAwake in a browser with the Screen Wake Lock API', () => {
  const release = vi.fn(() => Promise.resolve());
  const request = vi.fn(() => Promise.resolve({ released: false, release }));

  beforeEach(() => {
    release.mockClear();
    request.mockClear();
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  });

  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock;
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('takes one lock for any number of holds, and lets it go after the last', async () => {
    const a = holdKeepAwake();
    const b = holdKeepAwake();
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');
    a();
    expect(release).not.toHaveBeenCalled();
    b();
    expect(release).toHaveBeenCalledTimes(1);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('lets go of a lock that arrives after the last hold ended', async () => {
    holdKeepAwake()();
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('takes the lock again when the page comes back, while a hold is on', async () => {
    const lock = { released: false, release };
    request.mockImplementation(() => Promise.resolve(lock));
    const end = holdKeepAwake();
    await settle();
    // The browser released it while the page was hidden.
    lock.released = true;
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    end();
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('leaves it to the app inside the app', async () => {
    document.documentElement.dataset.shell = 'apple';
    holdKeepAwake()();
    await settle();
    expect(request).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledTimes(2);
  });
});
