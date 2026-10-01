// Transposes a MusicXML document in place (docs/HARMONY.md, "Transposing (H4)"): every key
// signature, every pitch (grace notes too), the signs printed with the notes and the ornaments,
// and the chord symbols' roots and basses. The one document is then drawn by Verovio and read by
// parseMusicXml, so what is drawn, played, judged and named above the staff is the same music.
//
// Each key signature is moved to the key with fewer signs (transpose.ts), and the notes under it
// by the interval between the two keys, so a note keeps its place in its key: what was the
// leading note is the leading note, and a sign printed in the written key is the same sign's
// counterpart in the new one. That is why no sign has to be added or taken away: a note needs a
// sign in the new key exactly where it needed one before.

import { LETTERS, type Letter } from './note.ts';
import { ACCIDENTALS } from './progressionXml.ts';
import type { SpelledPitch } from './score.ts';
import {
  respelled,
  transposedFifths,
  transposeInterval,
  transposePitch,
  transposeRoot,
  type Interval,
} from './transpose.ts';

function child(el: Element, name: string): Element | null {
  for (const c of el.children) if (c.localName === name) return c;
  return null;
}

function childrenNamed(el: Element, name: string): Element[] {
  return [...el.children].filter((c) => c.localName === name);
}

const textOf = (el: Element | null) => el?.textContent?.trim() ?? '';

function numberOf(el: Element | null, fallback: number): number {
  const value = Number(textOf(el));
  return el && textOf(el) !== '' && Number.isFinite(value) ? value : fallback;
}

function make(doc: Document, name: string, text: string): Element {
  const ns = doc.documentElement.namespaceURI;
  const el = ns ? doc.createElementNS(ns, name) : doc.createElement(name);
  el.textContent = text;
  return el;
}

/** The alteration each `<accidental>` and `<accidental-mark>` this file rewrites stands for. */
const SIGNS: Readonly<Record<string, number>> = {
  sharp: 1,
  natural: 0,
  flat: -1,
  'double-sharp': 2,
  'sharp-sharp': 2,
  'flat-flat': -2,
  'natural-sharp': 1,
  'natural-flat': -1,
};

/** Children of `<note>` that come after its `<accidental>`. */
const AFTER_ACCIDENTAL = [
  'time-modification',
  'stem',
  'notehead',
  'notehead-text',
  'staff',
  'beam',
  'notations',
  'lyric',
  'play',
  'listen',
];

/** Sets (or removes, for 0) the optional alteration that follows `stepName` in `parent`. */
function setAlter(
  doc: Document,
  parent: Element,
  stepName: string,
  alterName: string,
  alter: number,
) {
  const existing = child(parent, alterName);
  if (alter === 0) {
    if (existing) parent.removeChild(existing);
    return;
  }
  if (existing) existing.textContent = String(alter);
  else
    parent.insertBefore(make(doc, alterName, String(alter)), child(parent, stepName)!.nextSibling);
}

function readPitch(el: Element): SpelledPitch | null {
  const step = textOf(child(el, 'step')).toUpperCase() as Letter;
  if (!LETTERS.includes(step)) return null;
  const alter = numberOf(child(el, 'alter'), 0);
  // A quarter-tone is left where it is.
  if (!Number.isInteger(alter)) return null;
  return { step, alter, octave: numberOf(child(el, 'octave'), 4) };
}

/** A neighbouring letter of the note: the upper or lower note of an ornament, as written. */
function neighbour(pitch: SpelledPitch, direction: 1 | -1, alter: number): SpelledPitch {
  const position = pitch.octave * 7 + LETTERS.indexOf(pitch.step) + direction;
  return { step: LETTERS[((position % 7) + 7) % 7]!, alter, octave: Math.floor(position / 7) };
}

/**
 * The signs printed with a note's ornaments (the upper or lower note's): each is the sign of that
 * note in the new key. Which note a sign belongs to is read as the parser reads it: `above` the
 * upper, `below` the lower; without a placement the upper one, except under a mordent, and a
 * second sign the other one.
 */
function transposeOrnamentSigns(note: Element, written: SpelledPitch, interval: Interval) {
  for (const notations of childrenNamed(note, 'notations'))
    for (const ornaments of childrenNamed(notations, 'ornaments')) {
      const first = [...ornaments.children].find((c) => c.localName !== 'accidental-mark');
      let upperSet = false;
      let lowerSet = false;
      for (const mark of childrenNamed(ornaments, 'accidental-mark')) {
        const alter = SIGNS[textOf(mark)];
        if (alter === undefined) continue;
        const placement = mark.getAttribute('placement');
        const unplacedBelow = first?.localName === 'mordent' ? !lowerSet : upperSet;
        const below = placement === 'below' || (placement !== 'above' && unplacedBelow);
        if (below) lowerSet = true;
        else upperSet = true;
        const moved = transposePitch(neighbour(written, below ? -1 : 1, alter), interval);
        const sign = ACCIDENTALS[moved.alter];
        if (sign !== undefined) mark.textContent = sign;
      }
    }
}

function transposeNote(doc: Document, note: Element, interval: Interval) {
  const pitchEl = child(note, 'pitch');
  if (!pitchEl) return;
  const written = readPitch(pitchEl);
  if (!written) return;
  const exact = transposePitch(written, interval);
  // More than a double sign cannot be written: the same key on the next letter, its sign shown.
  const moved = respelled(exact);
  child(pitchEl, 'step')!.textContent = moved.step;
  const octave = child(pitchEl, 'octave');
  if (octave) octave.textContent = String(moved.octave);
  else pitchEl.appendChild(make(doc, 'octave', String(moved.octave)));
  setAlter(doc, pitchEl, 'step', 'alter', moved.alter);

  const sign = ACCIDENTALS[moved.alter]!;
  const accidental = child(note, 'accidental');
  if (accidental) {
    if (textOf(accidental) in SIGNS) accidental.textContent = sign;
  } else if (moved !== exact) {
    const before = [...note.children].find((c) => AFTER_ACCIDENTAL.includes(c.localName)) ?? null;
    note.insertBefore(make(doc, 'accidental', sign), before);
  }
  // A stem drawn up or down for the written pitch is left to the engraver again.
  for (const stem of childrenNamed(note, 'stem'))
    if (textOf(stem) === 'up' || textOf(stem) === 'down') note.removeChild(stem);
  transposeOrnamentSigns(note, written, interval);
}

function transposeHarmony(doc: Document, harmony: Element, interval: Interval) {
  for (const name of ['root', 'bass']) {
    const el = child(harmony, name);
    if (!el) continue;
    const step = textOf(child(el, `${name}-step`)).toUpperCase() as Letter;
    const alter = numberOf(child(el, `${name}-alter`), 0);
    if (!LETTERS.includes(step) || !Number.isInteger(alter)) continue;
    const moved = transposeRoot({ step, alter }, interval);
    child(el, `${name}-step`)!.textContent = moved.step;
    setAlter(doc, el, `${name}-step`, `${name}-alter`, moved.alter);
  }
}

/**
 * Moves the whole document by `semitones` (−6 … 6). Each part keeps the interval of the key
 * signature in force on each staff, so a piece that changes key is moved section by section, each
 * to the simpler of its two possible signatures. Nothing is done for 0: the written piece is the
 * file as it is.
 */
export function transposeDocument(doc: Document, semitones: number): void {
  if (semitones === 0) return;
  for (const part of childrenNamed(doc.documentElement, 'part')) {
    // The written signature in force per staff; 0: every staff without its own.
    let fifths = new Map<number, number>([[0, 0]]);
    const intervalOn = (staff: number) =>
      transposeInterval(fifths.get(staff) ?? fifths.get(0) ?? 0, semitones);
    let staves = 1;
    const staffOf = (el: Element) => Math.min(numberOf(child(el, 'staff'), 1), Math.max(1, staves));
    for (const measure of childrenNamed(part, 'measure')) {
      for (const el of measure.children) {
        switch (el.localName) {
          case 'attributes':
            staves = numberOf(child(el, 'staves'), staves);
            for (const key of childrenNamed(el, 'key')) {
              const fifthsEl = child(key, 'fifths');
              if (!fifthsEl) continue;
              const written = numberOf(fifthsEl, 0);
              const staff = Number(key.getAttribute('number'));
              if (Number.isInteger(staff) && staff > 0) fifths.set(staff, written);
              else fifths = new Map([[0, written]]);
              fifthsEl.textContent = String(transposedFifths(written, semitones));
              // The naturals that cancel the old signature are the engraver's to draw.
              for (const cancel of childrenNamed(key, 'cancel')) key.removeChild(cancel);
            }
            break;
          case 'note':
            transposeNote(doc, el, intervalOn(staffOf(el)));
            break;
          case 'harmony':
            transposeHarmony(doc, el, intervalOn(staffOf(el)));
            break;
          default:
            break;
        }
      }
    }
  }
}
