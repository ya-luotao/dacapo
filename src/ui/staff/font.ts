import bravuraUrl from '@vexflow-fonts/bravura/bravura.woff2?url';
import { Font, VexFlow } from 'vexflow/core';

// VexFlow 5 draws every glyph as text in the music font and measures it on a canvas, so nothing
// may be drawn before Bravura has loaded. The font file is part of our build (never the CDN
// VexFlow falls back to when `Font.load` gets no URL), which keeps the app working offline.

export type FontState = 'loading' | 'ready' | 'failed';

let state: FontState = 'loading';
let started = false;
const listeners = new Set<() => void>();

/** Starts downloading the music font; later calls do nothing. */
export function loadMusicFont(): void {
  if (started) return;
  started = true;
  VexFlow.setFonts('Bravura');
  Font.load('Bravura', bravuraUrl, { display: 'block' }).then(
    () => settle('ready'),
    () => settle('failed'),
  );
}

function settle(next: FontState) {
  state = next;
  for (const listener of [...listeners]) listener();
}

/** For `useSyncExternalStore`; subscribing starts the download. */
export function subscribeFont(onChange: () => void): () => void {
  loadMusicFont();
  listeners.add(onChange);
  return () => void listeners.delete(onChange);
}

export function getFontState(): FontState {
  return state;
}
