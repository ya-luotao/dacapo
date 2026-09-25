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
 * Keeps the screen on while something is being practised (a Read session, a piece run, a demo).
 * Returns the function that lets go; the screen may sleep again once every hold is released.
 * Only the app can do this; in a browser it does nothing.
 */
export function holdKeepAwake(): () => void {
  holds++;
  if (holds === 1) appHandler()?.postMessage({ type: 'keepAwake', on: true });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds--;
    if (holds === 0) appHandler()?.postMessage({ type: 'keepAwake', on: false });
  };
}
