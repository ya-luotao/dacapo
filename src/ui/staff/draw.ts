import {
  Accidental,
  Formatter,
  GhostNote,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  VexFlow,
  Voice,
} from 'vexflow/core';
import { midiOf } from '../../core/musicxml.ts';
import { MIDDLE_C, pitchToMidi, type Clef, type Pitch } from '../../core/note.ts';
import type { SpelledPitch } from '../../core/score.ts';
import { MUSIC_FONT } from './font.ts';
import { clefIn, melodySystem, positionOn, staffReach, type MelodySystem } from './melodyLayout.ts';

VexFlow.setFonts(MUSIC_FONT);

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
 * An empty braced grand staff in `host`, replacing whatever was there, drawn in `currentColor`;
 * with `keySpec` (VexFlow's name of a key), its signature on both staves.
 */
function grandStaff(host: HTMLElement, keySpec?: string) {
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
    if (keySpec) stave.addKeySignature(keySpec);
    // VexFlow's default ledger lines are a fixed grey; follow the notation colour instead.
    stave.setDefaultLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 1.6 });
    stave.setContext(context).draw();
  }
  for (const type of ['brace', 'singleLeft', 'singleRight'] as const) {
    new StaveConnector(treble, bass).setType(type).setContext(context).draw();
  }
  return { context, treble, bass };
}

/** The drawn SVG, scaled by CSS and hidden from assistive technology (the host labels it). */
function finish(host: HTMLElement, width = STAFF_WIDTH, height = STAFF_HEIGHT): SVGSVGElement {
  const svg = host.querySelector('svg')!;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

/**
 * Draws a braced grand staff with one whole note into `host`, replacing whatever was there.
 * Everything is drawn in `currentColor`, so CSS decides the colours; the note is in its own
 * `g.vf-stavenote` group.
 */
export function drawGrandStaff(host: HTMLElement, pitch: Pitch, clef: Clef): SVGSVGElement {
  const { context, treble, bass } = grandStaff(host);
  const note = new StaveNote({ keys: [vexKey(pitch)], duration: 'w', clef, alignCenter: true });
  if (pitch.accidental !== 0)
    note.addModifier(new Accidental(ACCIDENTAL_CODE[pitch.accidental]), 0);
  const stave = clef === 'treble' ? treble : bass;
  const voice = new Voice({ numBeats: 4, beatValue: 4 }).addTickables([note]);
  new Formatter().joinVoices([voice]).formatToStave([voice], stave);
  voice.draw(context, stave);
  return finish(host);
}

/** The staff a pitch is written on when a chord is split over the grand staff. */
export const clefOf = (pitch: Pitch): Clef => (pitchToMidi(pitch) >= MIDDLE_C ? 'treble' : 'bass');

/**
 * Draws a braced grand staff with whole notes into `host`: one column per entry of `columns`,
 * each a chord of the pitches sounding together (a melodic interval is two columns, a chord
 * one). Middle C and above go on the treble staff, the rest on the bass staff, so a chord may
 * be split over both. Drawn in `currentColor`, like `drawGrandStaff`.
 */
export function drawGrandStaffNotes(
  host: HTMLElement,
  columns: readonly (readonly Pitch[])[],
): SVGSVGElement {
  const { context, treble, bass } = grandStaff(host);
  const staves = [
    { clef: 'treble' as const, stave: treble },
    { clef: 'bass' as const, stave: bass },
  ];
  const single = columns.length === 1;
  const voices = staves.map(({ clef }) => {
    const notes = columns.map((column) => {
      const pitches = column
        .filter((p) => clefOf(p) === clef)
        .sort((a, b) => pitchToMidi(a) - pitchToMidi(b));
      if (pitches.length === 0) return new GhostNote({ duration: 'w' });
      const note = new StaveNote({
        keys: pitches.map(vexKey),
        duration: 'w',
        clef,
        alignCenter: single,
      });
      pitches.forEach((p, i) => {
        if (p.accidental !== 0) note.addModifier(new Accidental(ACCIDENTAL_CODE[p.accidental]), i);
      });
      return note;
    });
    return new Voice({ numBeats: 4 * columns.length, beatValue: 4 }).addTickables(notes);
  });
  // One formatter for both staves, so the columns line up across them.
  const formatter = new Formatter();
  for (const voice of voices) formatter.joinVoices([voice]);
  formatter.format(voices, treble.getNoteEndX() - treble.getNoteStartX() - 16);
  voices.forEach((voice, i) => voice.draw(context, staves[i]!.stave));
  return finish(host);
}

// --- A melody -----------------------------------------------------------------------------------

/** A note of a melody drawn after it was played back. */
export interface MelodyNote {
  pitch: SpelledPitch;
  /** The accidental printed before it (0 a natural), or null for none. */
  accidental: number | null;
  /** Played right: tinted as right. */
  right: boolean;
}

export interface MelodyDrawing {
  /** The key signature: sharps (+) or flats (−). */
  fifths: number;
  notes: readonly MelodyNote[];
  /** The wrong key, drawn over the melody at its note, tinted as wrong. */
  wrong: { index: number; pitch: SpelledPitch; accidental: number | null } | null;
}

/** VexFlow's name of each key signature, by its sharps (+) or flats (−). */
const KEY_SPECS: Readonly<Record<number, string>> = {
  [-7]: 'Cb',
  [-6]: 'Gb',
  [-5]: 'Db',
  [-4]: 'Ab',
  [-3]: 'Eb',
  [-2]: 'Bb',
  [-1]: 'F',
  0: 'C',
  1: 'G',
  2: 'D',
  3: 'A',
  4: 'E',
  5: 'B',
  6: 'F#',
  7: 'C#',
};

const SIGN_CODE: Readonly<Record<number, string>> = {
  [-2]: 'bb',
  [-1]: 'b',
  0: 'n',
  1: '#',
  2: '##',
};

/** VexFlow key string of a written note, e.g. `f#/4`: the letter and its sign, as written. */
const spelledKey = (p: SpelledPitch) =>
  `${p.step.toLowerCase()}${p.alter === 0 ? '' : (SIGN_CODE[p.alter] ?? '')}/${p.octave}`;

/** Room around the drawing, and between the staves of a grand staff (as the cards have). */
const PAD = 12;
const STAFF_SPAN = 40;
const STAVE_GAP = 60;
const POSITION = 5;
/** Room across for each quarter, and for what stands before it. */
const QUARTER_SPACE = 34;
const SIGN_SPACE = 12;

/**
 * Draws a line of quarter notes in a key into `host`, replacing whatever was there: on the one
 * staff that suits the notes (the wrong key among them), or on the braced grand staff. Notes
 * played right are in `g.vf-stavenote.is-right` and the wrong key's head in `.is-wrong` (its whole
 * note when it stands on the other staff), so CSS colours them; the rest is `currentColor`.
 * Returns the size, which depends on the notes: the SVG scales to its box by its viewBox.
 */
export function drawMelody(
  host: HTMLElement,
  drawing: MelodyDrawing,
): { width: number; height: number } {
  host.replaceChildren();
  const { notes, wrong } = drawing;
  const system: MelodySystem = melodySystem(
    notes.map((n) => n.pitch),
    wrong?.pitch ?? null,
  );
  const clefs: Clef[] = system === 'grand' ? ['treble', 'bass'] : [system];
  const onStaff = (pitch: SpelledPitch, clef: Clef) => clefIn(system, pitch) === clef;

  // Vertical room: how far each staff's notes reach past it.
  const reach = clefs.map((clef) =>
    staffReach(
      notes.map((note, i) => {
        const heads = [note, ...(wrong?.index === i ? [wrong] : [])].filter((n) =>
          onStaff(n.pitch, clef),
        );
        return {
          positions: heads.map((n) => positionOn(n.pitch, clef)),
          accidental: heads.some((n) => n.accidental !== null),
        };
      }),
    ),
  );
  const tops: number[] = [];
  let y = PAD + reach[0]!.above * POSITION;
  reach.forEach((r, i) => {
    if (i > 0) {
      const gap = (reach[i - 1]!.below + r.above) * POSITION + PAD;
      y += STAFF_SPAN + Math.max(STAVE_GAP, gap);
    }
    tops.push(y);
  });
  const height = Math.ceil(tops.at(-1)! + STAFF_SPAN + reach.at(-1)!.below * POSITION + PAD);

  // Across: the clef and key signature, then room for each quarter and its signs.
  const left = system === 'grand' ? 26 : 6;
  const staves = clefs.map((clef, i) =>
    new Stave(left, tops[i]!, 1000, { spaceAboveStaffLn: 0 })
      .addClef(clef)
      .addKeySignature(KEY_SPECS[drawing.fifths] ?? 'C'),
  );
  const start = Math.max(...staves.map((stave) => stave.getNoteStartX()));
  const room =
    notes.length * QUARTER_SPACE +
    notes.filter((n) => n.accidental !== null).length * SIGN_SPACE +
    (wrong ? QUARTER_SPACE / 2 + (wrong.accidental !== null ? SIGN_SPACE : 0) : 0);
  const width = Math.ceil(start + room + 12);
  for (const stave of staves) stave.setWidth(width - left - 1).setNoteStartX(start);

  const renderer = new Renderer(host as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();
  context.setFillStyle('currentColor');
  context.setStrokeStyle('currentColor');
  for (const stave of staves) {
    stave.setDefaultLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 1.6 });
    stave.setContext(context).draw();
  }
  if (staves.length === 2) {
    for (const type of ['brace', 'singleLeft', 'singleRight'] as const) {
      new StaveConnector(staves[0]!, staves[1]!).setType(type).setContext(context).draw();
    }
  }

  // One voice per staff: the melody's notes where they are written, silent columns elsewhere.
  // The wrong key joins its note as a chord on the same staff, or stands alone on the other.
  const marks: { note: StaveNote; head: number | null; className: string }[] = [];
  const voices = clefs.map((clef) => {
    const tickables = notes.map((note, i) => {
      const heads = [
        { ...note, wrong: false },
        ...(wrong?.index === i ? [{ ...wrong, right: false, wrong: true }] : []),
      ]
        .filter((n) => onStaff(n.pitch, clef))
        // Low to high, so a head's index is the same for VexFlow and for its accidental.
        .sort((a, b) => positionOn(a.pitch, clef) - positionOn(b.pitch, clef));
      if (heads.length === 0) return new GhostNote({ duration: 'q' });
      const staveNote = new StaveNote({
        keys: heads.map((n) => spelledKey(n.pitch)),
        duration: 'q',
        clef,
        autoStem: true,
      });
      heads.forEach((n, index) => {
        if (n.accidental !== null) {
          staveNote.addModifier(new Accidental(SIGN_CODE[n.accidental] ?? 'n'), index);
        }
        if (n.wrong) {
          // Alone on its staff, the whole note is the wrong one.
          marks.push({
            note: staveNote,
            head: heads.length > 1 ? index : null,
            className: 'is-wrong',
          });
        }
      });
      if (heads.some((n) => !n.wrong && n.right)) {
        marks.push({ note: staveNote, head: null, className: 'is-right' });
      }
      return staveNote;
    });
    return new Voice({ numBeats: notes.length, beatValue: 4 }).addTickables(tickables);
  });
  const formatter = new Formatter();
  for (const voice of voices) formatter.joinVoices([voice]);
  formatter.format(voices, room);
  voices.forEach((voice, i) => voice.draw(context, staves[i]));

  // Tints by class, found by the ids VexFlow gives its groups.
  for (const { note, head, className } of marks) {
    const element = head === null ? note : note.noteHeads[head];
    const id = element?.getAttributes().id;
    if (id) host.querySelector(`[id="vf-${id}"]`)?.classList.add(className);
  }

  const svg = host.querySelector('svg')!;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('style');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return { width, height };
}

// --- Theory cards on Read -----------------------------------------------------------------------

// An interval or a chord is written on one staff, treble or bass, in a box of its own that every
// such card shares: room for two ledger lines above and below and a sign on the outermost note.
export const ONE_STAFF_WIDTH = 250;
export const ONE_STAFF_HEIGHT = 130;
/** The staff's top line is this far down the box (VexFlow puts it 4 spaces below a stave's y). */
const ONE_STAFF_TOP = 50;
const ONE_STAFF_LEFT = 6;

/** What a theory card writes: notes on one staff, or a key signature on the grand staff. */
export type TheoryDrawing =
  | {
      kind: 'notes';
      clef: Clef;
      /** One column of whole notes per entry, left to right: two for a melodic interval. */
      columns: readonly (readonly SpelledPitch[])[];
    }
  | { kind: 'signature'; fifths: number };

/** The box a theory card is drawn in, in VexFlow units. */
export function theoryBox(kind: TheoryDrawing['kind']): [width: number, height: number] {
  return kind === 'notes' ? [ONE_STAFF_WIDTH, ONE_STAFF_HEIGHT] : [STAFF_WIDTH, STAFF_HEIGHT];
}

/**
 * Draws a theory card into `host`, replacing whatever was there: whole notes on one staff with
 * their signs as written (double sharps and flats too), or a key signature alone on the cards'
 * braced grand staff. The notes are in `g.vf-stavenote` groups, all of it in `currentColor`, like
 * `drawGrandStaff`. Returns the centre of each note column across the box (0–1), for the letter
 * names under the notes.
 */
export function drawTheoryCard(host: HTMLElement, drawing: TheoryDrawing): number[] {
  if (drawing.kind === 'signature') {
    grandStaff(host, KEY_SPECS[drawing.fifths] ?? 'C');
    finish(host);
    return [];
  }
  host.replaceChildren();
  const renderer = new Renderer(host as HTMLDivElement, Renderer.Backends.SVG);
  renderer.resize(ONE_STAFF_WIDTH, ONE_STAFF_HEIGHT);
  const context = renderer.getContext();
  context.setFillStyle('currentColor');
  context.setStrokeStyle('currentColor');
  const { clef, columns } = drawing;
  const stave = new Stave(
    ONE_STAFF_LEFT,
    ONE_STAFF_TOP - 40,
    ONE_STAFF_WIDTH - 2 * ONE_STAFF_LEFT,
  ).addClef(clef);
  stave.setDefaultLedgerLineStyle({ strokeStyle: 'currentColor', lineWidth: 1.6 });
  stave.setContext(context).draw();

  const notes = columns.map((column) => {
    // Low to high, so a head's index is the same for VexFlow and for its sign.
    const pitches = [...column].sort((a, b) => midiOf(a) - midiOf(b));
    const note = new StaveNote({
      keys: pitches.map(spelledKey),
      duration: 'w',
      clef,
      alignCenter: columns.length === 1,
    });
    pitches.forEach((p, i) => {
      if (p.alter !== 0) note.addModifier(new Accidental(SIGN_CODE[p.alter] ?? 'n'), i);
    });
    return note;
  });
  const voice = new Voice({ numBeats: 4 * columns.length, beatValue: 4 }).addTickables(notes);
  const formatter = new Formatter().joinVoices([voice]);
  if (columns.length === 1) {
    formatter.formatToStave([voice], stave);
  } else {
    formatter.format([voice], stave.getNoteEndX() - stave.getNoteStartX() - 40);
  }
  voice.draw(context, stave);
  finish(host, ONE_STAFF_WIDTH, ONE_STAFF_HEIGHT);
  // The heads' centre, the signs before them aside.
  return notes.map(
    (note) => (note.getNoteHeadBeginX() + note.getNoteHeadEndX()) / 2 / ONE_STAFF_WIDTH,
  );
}
