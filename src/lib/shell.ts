// Where dacapo runs: in a browser, or inside the Apple app (apple/ in this repository). The app
// marks the document with <html data-shell="apple"> before any of our code runs
// (apple/Dacapo/Web/app-shell.js), and listens to a few messages through `dacapoApp`
// (apple/Dacapo/Web/AppMessages.swift).

export type Shell = 'web' | 'apple';

export function currentShell(
  root: HTMLElement | null = globalThis.document?.documentElement ?? null,
): Shell {
  return root?.dataset.shell === 'apple' ? 'apple' : 'web';
}

interface AppMessageHandler {
  postMessage: (message: unknown) => void;
}

function appHandler(): AppMessageHandler | null {
  if (currentShell() !== 'apple') return null;
  const handlers = (
    globalThis as { webkit?: { messageHandlers?: Record<string, AppMessageHandler> } }
  ).webkit?.messageHandlers;
  return handlers?.dacapoApp ?? null;
}

let holds = 0;

/**
 * In a browser, the Screen Wake Lock API. The browser lets go of the lock whenever the page is
 * hidden, so it is taken again when the page comes back while a hold is still on.
 */
const browserLock = (() => {
  let sentinel: WakeLockSentinel | null = null;
  let pending = false;

  function acquire() {
    const wakeLock = globalThis.navigator?.wakeLock;
    if (!wakeLock || pending || (sentinel && !sentinel.released)) return;
    if (document.visibilityState !== 'visible') return;
    pending = true;
    wakeLock.request('screen').then(
      (lock) => {
        pending = false;
        // Every hold ended while the request was on its way.
        if (holds === 0) void lock.release().catch(() => {});
        else sentinel = lock;
      },
      // Refused (a policy, low battery): the screen sleeps as usual.
      () => (pending = false),
    );
  }

  const onVisibility = () => {
    if (holds > 0 && document.visibilityState === 'visible') acquire();
  };

  return {
    on() {
      if (!globalThis.navigator?.wakeLock) return;
      document.addEventListener('visibilitychange', onVisibility);
      acquire();
    },
    off() {
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
      sentinel = null;
    },
  };
})();

/**
 * Keeps the screen on while something is being practised (a Read session, a piece run, a demo).
 * Returns the function that lets go; the screen may sleep again once every hold is released.
 * The app does this natively; a browser through the Screen Wake Lock API where it has one.
 */
export function holdKeepAwake(): () => void {
  holds++;
  if (holds === 1) {
    const app = appHandler();
    if (app) app.postMessage({ type: 'keepAwake', on: true });
    else if (currentShell() === 'web') browserLock.on();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds > 0) return;
    const app = appHandler();
    if (app) app.postMessage({ type: 'keepAwake', on: false });
    else browserLock.off();
  };
}
