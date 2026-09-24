import bravuraUrl from '@vexflow-fonts/bravura/bravura.woff2?url';

// VexFlow 5 draws every glyph as text in the music font and measures it on a canvas, so nothing
// may be drawn before Bravura has loaded. The font file is part of our build (never the CDN
// VexFlow falls back to), which keeps the app working offline. This module does what VexFlow's
// `Font.load` does without importing VexFlow, so pages that only need the glyphs (the heatmap)
// do not download it.

/** CSS font family of the music font, for SVG text as well as VexFlow. */
export const MUSIC_FONT = 'Bravura';

export type FontState = 'loading' | 'ready' | 'failed';

let state: FontState = 'loading';
let started = false;
const listeners = new Set<() => void>();

/** Starts downloading the music font; later calls do nothing. */
export function loadMusicFont(): void {
  if (started) return;
  started = true;
  if (typeof FontFace === 'undefined') {
    settle('failed');
    return;
  }
  const face = new FontFace(MUSIC_FONT, `url(${bravuraUrl})`, { display: 'block' });
  document.fonts.add(face);
  face.load().then(
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
