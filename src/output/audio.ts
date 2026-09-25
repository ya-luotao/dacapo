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
