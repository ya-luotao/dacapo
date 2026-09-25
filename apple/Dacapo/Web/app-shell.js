// Injected by the Apple app (Web/AppMessages.swift) at document start, before dacapo's code runs.
// It marks the document as running in the app, so the page can use app wording instead of
// browser wording and send the few messages the app understands (src/lib/shell.ts).
(() => {
  'use strict';
  if (!globalThis.webkit?.messageHandlers?.dacapoApp) return;
  document.documentElement.dataset.shell = 'apple';
  // Web Audio (the rhythm click) plays like media: audible with the silent switch on.
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = 'playback';
    } catch {
      // Older WebKit: the app's AVAudioSession category applies.
    }
  }
})();
