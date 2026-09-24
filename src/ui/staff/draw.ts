import {
  Accidental,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  Voice,
} from 'vexflow/core';
import type { Clef, Pitch } from '../../core/note.ts';

// Fixed geometry in VexFlow units (10 per staff space), shared by every card so the staff never
// moves: room for two ledger lines above the treble staff (C6) and below the bass staff (C2),
// and six spaces between the staves for the ledger lines around middle C.
export const STAFF_WIDTH = 250;
export const STAFF_HEIGHT = 216;
const LEFT = 26;
const TREBLE_Y = 0;
const BASS_Y = 100;

const ACCIDENTAL_CODE = { [-1]: 'b', 0: '', 1: '#' } as const;

/** VexFlow key string, e.g. `c#/4`. VexFlow and `Pitch` both keep the octave with the letter. */
export function vexKey(pitch: Pitch): string {
  return `${pitch.letter.toLowerCase()}${ACCIDENTAL_CODE[pitch.accidental]}/${pitch.octave}`;
}

/**
 * Draws a braced grand staff with one whole note into `host`, replacing whatever was there.
 * Everything is drawn in `currentColor`, so CSS decides the colours; the note is in its own
 * `g.vf-stavenote` group.
 */
export function drawGrandStaff(host: HTMLElement, pitch: Pitch, clef: Clef): SVGSVGElement {
  host.replaceChildren();
  const renderer = new Renderer(host as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(STAFF_WIDTH, STAFF_HEIGHT);
  const context = renderer.getContext();
  context.setFillStyle('currentColor');
  context.setStrokeStyle('currentColor');

  const width = STAFF_WIDTH - LEFT - 1;
  const treble = new Stave(LEFT, TREBLE_Y, width).addClef('treble');
  const bass = new Stave(LEFT, BASS_Y, width).addClef('bass');
  for (const stave of [treble, bass]) {
    // VexFlow's default ledger lines are a fixed grey; follow the notation colour instead.
    stave.setDefaultLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 1.6 });
    stave.setContext(context).draw();
  }
  for (const type of ['brace', 'singleLeft', 'singleRight'] as const) {
    new StaveConnector(treble, bass).setType(type).setContext(context).draw();
  }

  const note = new StaveNote({ keys: [vexKey(pitch)], duration: 'w', clef, alignCenter: true });
  if (pitch.accidental !== 0)
    note.addModifier(new Accidental(ACCIDENTAL_CODE[pitch.accidental]), 0);
  const stave = clef === 'treble' ? treble : bass;
  const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note]);
  new Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(context, stave);

  const svg = host.querySelector('svg')!;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  svg.setAttribute('viewBox', `0 0 ${STAFF_WIDTH} ${STAFF_HEIGHT}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}
