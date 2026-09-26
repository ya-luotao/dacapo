// One AudioContext for the page, made on the first user gesture that needs it (browsers keep a
// context made earlier suspended) and resumed on each such gesture.

let context: AudioContext | null = null;

/** Call from a click or key handler. Null when the browser has no Web Audio. */
export function audioContext(): AudioContext | null {
  if (!context) {
    const Constructor = globalThis.AudioContext as typeof AudioContext | undefined;
    if (!Constructor) return null;
    try {
      context = new Constructor({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
  }
  if (context.state === 'suspended') void context.resume().catch(() => {});
  return context;
}

/**
 * While `wanted()`, every click, tap or key press makes (or resumes) the context: sound that is not
 * started from a gesture of its own (a note the scheduler sends from a timer, a key on a MIDI
 * keyboard) needs one to have happened. Returns a function that stops listening.
 */
export function unlockOnGesture(target: EventTarget, wanted: () => boolean): () => void {
  const unlock = () => {
    if (wanted()) audioContext();
  };
  const events = ['pointerdown', 'keydown', 'touchend'];
  for (const type of events) target.addEventListener(type, unlock, { capture: true });
  return () => {
    for (const type of events) target.removeEventListener(type, unlock, { capture: true });
  };
}
