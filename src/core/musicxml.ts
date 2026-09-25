// MusicXML (partwise, plain or compressed .mxl) to the score model. The parser takes a DOM
// `Document`, so the browser's `DOMParser` does the XML and nothing here needs an XML library.

import { unzipSync } from 'fflate';
import { applyHands, detectHands } from './hands.ts';
import { LETTERS, type Letter } from './note.ts';
import {
  staffKey,
  TICKS_PER_QUARTER,
  type Measure,
  type PartInfo,
  type Score,
  type ScoreNote,
  type ScoreWarning,
  type SpelledPitch,
  type StaffHands,
  type TempoMark,
} from './score.ts';

export interface ParseOptions {
  /** The piece's own choice of hands per staff, over the detected one. */
  hands?: StaffHands | null;
}

export type ScoreErrorKind =
  'not-xml' | 'timewise' | 'not-musicxml' | 'no-parts' | 'damaged-zip' | 'no-score-in-zip';

export class ScoreError extends Error {
  readonly kind: ScoreErrorKind;
  constructor(kind: ScoreErrorKind) {
    super(`MusicXML: ${kind}`);
    this.kind = kind;
  }
}

const STEP_SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function child(el: Element, name: string): Element | null {
  for (const c of el.children) if (c.localName === name) return c;
  return null;
}

function childrenNamed(el: Element, name: string): Element[] {
  return [...el.children].filter((c) => c.localName === name);
}

function text(el: Element | null): string {
  return el?.textContent?.trim() ?? '';
}

function num(el: Element | null, fallback: number): number {
  const value = Number(text(el));
  return el && text(el) !== '' && Number.isFinite(value) ? value : fallback;
}

function parseEndingNumbers(value: string): number[] {
  // "1", "1, 2", "1 2" and "1-3" all occur in the wild.
  const out: number[] = [];
  for (const part of value.split(/[,\s]+/).filter(Boolean)) {
    const range = /^(\d+)-(\d+)$/.exec(part);
    if (range) for (let n = Number(range[1]); n <= Number(range[2]); n++) out.push(n);
    else if (/^\d+$/.test(part)) out.push(Number(part));
  }
  return out;
}

export function midiOf(pitch: SpelledPitch): number {
  return (pitch.octave + 1) * 12 + STEP_SEMITONES[pitch.step] + Math.round(pitch.alter);
}

function readParts(root: Element, parts: Element[]): PartInfo[] {
  const list = child(root, 'part-list');
  const declared = new Map<string, Element>();
  for (const scorePart of list ? childrenNamed(list, 'score-part') : [])
    declared.set(scorePart.getAttribute('id') ?? '', scorePart);
  return parts.map((part, index) => {
    const id = part.getAttribute('id') ?? '';
    const decl = declared.get(id);
    const instrument = decl ? child(decl, 'score-instrument') : null;
    const midi = decl ? child(decl, 'midi-instrument') : null;
    let staves = 1;
    for (const m of childrenNamed(part, 'measure'))
      for (const attrs of childrenNamed(m, 'attributes'))
        staves = Math.max(staves, num(child(attrs, 'staves'), 1));
    const program = midi ? num(child(midi, 'midi-program'), NaN) : NaN;
    return {
      index,
      id,
      name: decl ? text(child(decl, 'part-name')) : '',
      instrument: instrument ? text(child(instrument, 'instrument-name')) : '',
      program: Number.isFinite(program) ? program : null,
      staves,
    };
  });
}

interface PartState {
  divisions: number;
  staves: number;
  transpose: number;
}

/** Parses `score-partwise` MusicXML. Throws `ScoreError` if the document is not usable. */
export function parseMusicXml(doc: Document, options: ParseOptions = {}): Score {
  const root = doc.documentElement;
  if (!root || root.localName === 'parsererror' || doc.getElementsByTagName('parsererror')[0])
    throw new ScoreError('not-xml');
  if (root.localName === 'score-timewise') throw new ScoreError('timewise');
  if (root.localName !== 'score-partwise') throw new ScoreError('not-musicxml');

  const warnings = new Set<ScoreWarning>();
  const parts = childrenNamed(root, 'part');
  if (parts.length === 0) throw new ScoreError('no-parts');

  // A movement title names the piece; the work title may be the collection it comes from.
  const title =
    text(child(root, 'movement-title')) || text(child(child(root, 'work') ?? root, 'work-title'));
  const composer =
    [...(child(root, 'identification')?.children ?? [])]
      .filter((c) => c.localName === 'creator' && c.getAttribute('type') === 'composer')
      .map(text)[0] ?? '';

  const partInfo = readParts(root, parts);
  const detected = detectHands(partInfo);
  if (detected.guessed && !options.hands) warnings.add('hands-guessed');
  const hands = applyHands(detected.hands, options.hands ?? null);

  const measureCount = Math.max(...parts.map((p) => childrenNamed(p, 'measure').length));
  // Measure lengths are the longest any part fills, so a short part cannot shift the others.
  const lengths = new Array<number>(measureCount).fill(0);
  const measures: Measure[] = [];
  const notes: ScoreNote[] = [];
  const tempos: TempoMark[] = [];

  // The measure frame (numbers, time signatures, repeats) comes from the first part, since every
  // part shares it; lengths come from all parts below.
  const timeSigs: { beats: number; beatType: number }[] = [];
  {
    let beats = 4;
    let beatType = 4;
    for (const m of childrenNamed(parts[0]!, 'measure')) {
      for (const attrs of childrenNamed(m, 'attributes')) {
        const time = child(attrs, 'time');
        if (time && child(time, 'beats')) {
          // Compound signatures like "3+2" add up.
          beats = text(child(time, 'beats'))
            .split('+')
            .reduce((s, x) => s + (Number(x) || 0), 0);
          beatType = num(child(time, 'beat-type'), 4);
        }
      }
      timeSigs.push({ beats, beatType });
    }
  }

  // Notes and tempo marks are collected per written measure and anchored on the shared frame
  // afterwards, so a part whose measures are too short or too long cannot shift the others.
  const pending: { measure: number; within: number; note: Omit<ScoreNote, 'onset'> }[] = [];
  const pendingTempos: { measure: number; within: number; bpm: number }[] = [];

  parts.forEach((part, partIndex) => {
    const state: PartState = { divisions: 1, staves: 1, transpose: 0 };
    // Open ties per (staff, voice, midi) so a tie-stop is matched to its start.
    const openTies = new Set<string>();
    childrenNamed(part, 'measure').forEach((m, measureIndex) => {
      let cursor = 0;
      let furthest = 0;
      let previousOnset = 0;
      let noteOrder = 0;
      const ticks = (divs: number) => {
        const exact = (divs * TICKS_PER_QUARTER) / state.divisions;
        if (!Number.isInteger(exact)) warnings.add('finer-than-ticks');
        return Math.round(exact);
      };
      for (const el of m.children) {
        switch (el.localName) {
          case 'attributes': {
            state.divisions = num(child(el, 'divisions'), state.divisions);
            state.staves = num(child(el, 'staves'), state.staves);
            const transpose = child(el, 'transpose');
            if (transpose)
              state.transpose =
                num(child(transpose, 'chromatic'), 0) +
                12 * num(child(transpose, 'octave-change'), 0);
            break;
          }
          case 'backup':
            cursor = Math.max(0, cursor - ticks(num(child(el, 'duration'), 0)));
            break;
          case 'forward':
            cursor += ticks(num(child(el, 'duration'), 0));
            furthest = Math.max(furthest, cursor);
            break;
          case 'direction':
          case 'sound': {
            const sound = el.localName === 'sound' ? el : child(el, 'sound');
            const tempo = sound ? Number(sound.getAttribute('tempo')) : NaN;
            if (partIndex === 0 && Number.isFinite(tempo) && tempo > 0) {
              const offset = el.localName === 'direction' ? ticks(num(child(el, 'offset'), 0)) : 0;
              pendingTempos.push({ measure: measureIndex, within: cursor + offset, bpm: tempo });
            }
            break;
          }
          case 'note': {
            const order = noteOrder++;
            const isChord = child(el, 'chord') !== null;
            if (child(el, 'grace')) {
              warnings.add('grace-notes');
              break;
            }
            const onset = isChord ? previousOnset : cursor;
            const duration = ticks(num(child(el, 'duration'), 0));
            if (!isChord) {
              previousOnset = cursor;
              cursor += duration;
              furthest = Math.max(furthest, cursor);
            }
            if (child(el, 'cue')) break;
            const pitchEl = child(el, 'pitch');
            if (!pitchEl) break; // rest or unpitched percussion
            const step = text(child(pitchEl, 'step')).toUpperCase() as Letter;
            if (!LETTERS.includes(step)) {
              warnings.add('unknown-step');
              break;
            }
            const pitch: SpelledPitch = {
              step,
              alter: num(child(pitchEl, 'alter'), 0),
              octave: num(child(pitchEl, 'octave'), 4),
            };
            if (!Number.isInteger(pitch.alter)) warnings.add('microtones');
            const midi = midiOf(pitch) + state.transpose;
            const staff = Math.min(num(child(el, 'staff'), 1), Math.max(1, state.staves));
            const voice = text(child(el, 'voice')) || '1';
            // `<tie>` is the sound, `<notations><tied>` the drawing; exporters differ in which
            // they write, so either counts.
            const notations = child(el, 'notations');
            const tieTypes = [
              ...childrenNamed(el, 'tie'),
              ...(notations ? childrenNamed(notations, 'tied') : []),
            ].map((t) => t.getAttribute('type'));
            const tieKey = `${staff}|${voice}|${midi}`;
            const tieStop = tieTypes.includes('stop') && openTies.has(tieKey);
            const tieStart = tieTypes.includes('start');
            if (tieStop) openTies.delete(tieKey);
            else if (tieTypes.includes('stop')) warnings.add('tie-mismatch');
            if (tieStart) openTies.add(tieKey);
            if (notations && child(notations, 'ornaments')) warnings.add('ornaments');
            pending.push({
              measure: measureIndex,
              within: onset,
              note: {
                id: `n${partIndex}.${measureIndex}.${order}`,
                part: partIndex,
                measure: measureIndex,
                duration,
                midi,
                pitch,
                staff,
                hand: hands[staffKey(partIndex, staff)] ?? null,
                voice,
                tieStart,
                tieStop,
              },
            });
            break;
          }
          default:
            break;
        }
      }
      lengths[measureIndex] = Math.max(lengths[measureIndex] ?? 0, furthest);
    });
  });

  let start = 0;
  let ending: number[] = [];
  const partZero = childrenNamed(parts[0]!, 'measure');
  for (let i = 0; i < measureCount; i++) {
    const m = partZero[i];
    const sig = timeSigs[i] ?? timeSigs[timeSigs.length - 1] ?? { beats: 4, beatType: 4 };
    const nominal = (sig.beats * 4 * TICKS_PER_QUARTER) / sig.beatType;
    // A measure no part fills (all silent without rests) still takes its nominal length.
    const duration = lengths[i] || nominal;
    const bars = m ? readBarlines(m) : null;
    // A volta starts in one measure and may span several until its stop or discontinue.
    if (bars?.endingStart) ending = bars.endingStart;
    measures.push({
      index: i,
      number: m?.getAttribute('number') ?? String(i + 1),
      start,
      duration,
      beats: sig.beats,
      beatType: sig.beatType,
      repeat: {
        forward: bars?.forward ?? false,
        backwardTimes: bars?.backwardTimes ?? null,
        ending,
      },
      jumps: m ? readJumps(m) : [],
    });
    if (bars?.endingEnd) ending = [];
    start += duration;
  }

  for (const { measure, within, note } of pending)
    notes.push({ ...note, onset: measures[measure]!.start + within });
  for (const { measure, within, bpm } of pendingTempos)
    tempos.push({ tick: measures[measure]!.start + within, bpm });

  notes.sort(
    (a, b) => a.onset - b.onset || a.staff - b.staff || a.part - b.part || a.midi - b.midi,
  );
  tempos.sort((a, b) => a.tick - b.tick);
  if (measures.some((m) => m.jumps.length > 0)) warnings.add('jumps');
  return {
    title,
    composer,
    parts: partInfo,
    hands,
    measures,
    notes,
    tempos,
    warnings: [...warnings],
  };
}

interface Barlines {
  forward: boolean;
  backwardTimes: number | null;
  endingStart: number[] | null;
  endingEnd: boolean;
}

function readBarlines(m: Element): Barlines {
  const bars: Barlines = {
    forward: false,
    backwardTimes: null,
    endingStart: null,
    endingEnd: false,
  };
  for (const barline of childrenNamed(m, 'barline')) {
    const repeat = child(barline, 'repeat');
    if (repeat?.getAttribute('direction') === 'forward') bars.forward = true;
    if (repeat?.getAttribute('direction') === 'backward')
      bars.backwardTimes = Number(repeat.getAttribute('times')) || 2;
    const ending = child(barline, 'ending');
    const type = ending?.getAttribute('type');
    if (type === 'start')
      bars.endingStart = parseEndingNumbers(ending!.getAttribute('number') ?? '');
    if (type === 'stop' || type === 'discontinue') bars.endingEnd = true;
  }
  return bars;
}

function readJumps(m: Element): string[] {
  const jumps: string[] = [];
  for (const sound of m.getElementsByTagName('sound'))
    for (const attr of ['dacapo', 'dalsegno', 'fine', 'tocoda', 'coda', 'segno'])
      if (sound.hasAttribute(attr)) jumps.push(attr);
  return jumps;
}

/** Decodes MusicXML bytes: UTF-16 with a byte-order mark (Finale, Sibelius) or UTF-8. */
export function decodeXml(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * The MusicXML text of a `.musicxml`/`.xml` file or a compressed `.mxl` (a ZIP whose
 * `META-INF/container.xml` names the score). Throws `ScoreError` if there is none.
 */
export function musicXmlFromBytes(bytes: Uint8Array, parseXml: (xml: string) => Document): string {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  if (!isZip) return decodeXml(bytes);
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ScoreError('damaged-zip');
  }
  const container = files['META-INF/container.xml'];
  let path: string | null = null;
  if (container) {
    const rootfile = parseXml(decodeXml(container)).getElementsByTagName('rootfile')[0];
    path = rootfile?.getAttribute('full-path') ?? null;
  }
  // Without a container, take the first score-like file that is not metadata.
  path ??=
    Object.keys(files).find(
      (name) => !name.startsWith('META-INF/') && /\.(musicxml|xml)$/i.test(name),
    ) ?? null;
  const file = path ? files[path] : undefined;
  if (!file) throw new ScoreError('no-score-in-zip');
  return decodeXml(file);
}
