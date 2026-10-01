// MusicXML (partwise, plain or compressed .mxl) to the score model. The parser takes a DOM
// `Document`, so the browser's `DOMParser` does the XML and nothing here needs an XML library.

import { unzipSync } from 'fflate';
import { formatSymbol, symbolFromMusicXml, type MusicXmlDegree } from './chordSymbols.ts';
import { applyHands, detectHands } from './hands.ts';
import type { GraceNote, HarmonyMark, Ornament, OrnamentKind } from './markings.ts';
import { createMarkingReader, type SlurEnd } from './musicxmlMarkings.ts';
import { LETTERS, type Letter } from './note.ts';
import {
  staffKey,
  TICKS_PER_QUARTER,
  type KeySignature,
  type Measure,
  type PartInfo,
  type Score,
  type ScoreNote,
  type ScoreWarning,
  type SpelledPitch,
  type StaffHands,
  type TempoMark,
} from './score.ts';
import type { Root } from './theoryItems.ts';

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
  /** Key signature per staff; 0: every staff without its own. */
  fifths: Map<number, number>;
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

  // Notes, tempo marks and markings are collected per written measure and anchored on the shared
  // frame afterwards, so a part whose measures are too short or too long cannot shift the others.
  const pending: { measure: number; within: number; note: Omit<ScoreNote, 'onset'> }[] = [];
  const pendingTempos: { measure: number; within: number; bpm: number }[] = [];
  const pendingHarmonies: { measure: number; within: number; mark: Omit<HarmonyMark, 'tick'> }[] =
    [];
  /** Each part's key signatures, where they change. */
  const partKeys: KeySignature[][] = parts.map(() => []);
  const marks = createMarkingReader();

  parts.forEach((part, partIndex) => {
    const state: PartState = { divisions: 1, staves: 1, transpose: 0, fifths: new Map() };
    // Open ties per (staff, voice, midi) so a tie-stop is matched to its start.
    const openTies = new Set<string>();
    // Grace notes waiting for the next note of their voice, with the ends of slurs on them.
    const waiting = new Map<string, { grace: GraceNote; slur: SlurEnd }[]>();
    childrenNamed(part, 'measure').forEach((m, measureIndex) => {
      let cursor = 0;
      let furthest = 0;
      let previousOnset = 0;
      let noteOrder = 0;
      // Every pitch of the bar where it sounds, for the accidentals in force at an ornament.
      const sounded: { staff: number; pitch: SpelledPitch; within: number }[] = [];
      const ornamented: { note: Omit<ScoreNote, 'onset'>; within: number; els: Element[] }[] = [];
      const ticks = (divs: number) => {
        const exact = (divs * TICKS_PER_QUARTER) / state.divisions;
        if (!Number.isInteger(exact)) warnings.add('finer-than-ticks');
        return Math.round(exact);
      };
      const staffOf = (el: Element) =>
        Math.min(num(child(el, 'staff'), 1), Math.max(1, state.staves));
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
            for (const key of childrenNamed(el, 'key')) {
              if (!child(key, 'fifths')) continue;
              const staff = Number(key.getAttribute('number'));
              const fifths = num(child(key, 'fifths'), 0);
              if (Number.isInteger(staff) && staff > 0) state.fifths.set(staff, fifths);
              else state.fifths = new Map([[0, fifths]]);
              // The part's key is the one of all its staves, or of its first.
              if (!(staff > 1)) {
                const named = text(child(key, 'mode')).toLowerCase();
                const mode = named === 'major' || named === 'minor' ? named : null;
                const before = partKeys[partIndex]!.at(-1);
                if (before?.fifths !== fifths || before.mode !== mode)
                  partKeys[partIndex]!.push({ measure: measureIndex, fifths, mode });
              }
            }
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
            const offset = el.localName === 'direction' ? ticks(num(child(el, 'offset'), 0)) : 0;
            if (partIndex === 0 && Number.isFinite(tempo) && tempo > 0) {
              pendingTempos.push({ measure: measureIndex, within: cursor + offset, bpm: tempo });
            }
            if (el.localName === 'direction') {
              marks.direction(el, {
                part: partIndex,
                staff: staffOf(el),
                measure: measureIndex,
                within: Math.max(0, cursor + offset),
              });
            }
            break;
          }
          case 'harmony': {
            const read = readHarmony(el);
            if (!read) break;
            const offset = ticks(num(child(el, 'offset'), 0));
            pendingHarmonies.push({
              measure: measureIndex,
              within: Math.max(0, cursor + offset),
              mark: { part: partIndex, staff: staffOf(el), measure: measureIndex, ...read },
            });
            break;
          }
          case 'note': {
            const order = noteOrder++;
            const isChord = child(el, 'chord') !== null;
            const graceEl = child(el, 'grace');
            if (graceEl) {
              if (child(el, 'cue')) break;
              const grace = readGrace(el, graceEl, `g${partIndex}.${measureIndex}.${order}`);
              if (grace === 'unknown-step') warnings.add('unknown-step');
              if (!grace || grace === 'unknown-step') break;
              grace.midi += state.transpose;
              const voice = text(child(el, 'voice')) || '1';
              const slur: SlurEnd = { id: null };
              const place = {
                part: partIndex,
                staff: staffOf(el),
                measure: measureIndex,
                within: cursor,
              };
              marks.notations(el, place, { voice, end: slur });
              sounded.push({ staff: place.staff, pitch: grace.pitch, within: cursor });
              waiting.set(voice, [...(waiting.get(voice) ?? []), { grace, slur }]);
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
            const staff = staffOf(el);
            const voice = text(child(el, 'voice')) || '1';
            const place = { part: partIndex, staff, measure: measureIndex, within: onset };
            const pitchEl = child(el, 'pitch');
            if (!pitchEl) {
              // A rest (or unpitched percussion): only its fermata counts.
              marks.notations(el, place, null);
              break;
            }
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
            // `<tie>` is the sound, `<notations><tied>` the drawing; exporters differ in which
            // they write, so either counts.
            const notations = childrenNamed(el, 'notations');
            const tieTypes = [
              ...childrenNamed(el, 'tie'),
              ...notations.flatMap((n) => childrenNamed(n, 'tied')),
            ].map((t) => t.getAttribute('type'));
            const tieKey = `${staff}|${voice}|${midi}`;
            const tieStop = tieTypes.includes('stop') && openTies.has(tieKey);
            const tieStart = tieTypes.includes('start');
            if (tieStop) openTies.delete(tieKey);
            else if (tieTypes.includes('stop')) warnings.add('tie-mismatch');
            if (tieStart) openTies.add(tieKey);
            const id = `n${partIndex}.${measureIndex}.${order}`;
            const articulations = marks.notations(el, place, { voice, end: { id } });
            const note: Omit<ScoreNote, 'onset'> = {
              id,
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
              finger: readFinger(el),
            };
            if (articulations.length > 0) note.articulations = articulations;
            // Grace notes lead to the next note of their voice (the first of a chord).
            const graces = isChord ? undefined : waiting.get(voice);
            if (graces) {
              waiting.delete(voice);
              note.graces = graces.map((g) => g.grace);
              for (const g of graces) g.slur.id = id;
            }
            const ornaments = notations.flatMap((n) => childrenNamed(n, 'ornaments'));
            if (ornaments.length > 0) ornamented.push({ note, within: onset, els: ornaments });
            sounded.push({ staff, pitch, within: onset });
            pending.push({ measure: measureIndex, within: onset, note });
            break;
          }
          default:
            break;
        }
      }
      for (const { note, within, els } of ornamented) {
        const inForce = (letter: Letter, octave: number): number => {
          let alter: number | null = null;
          let at = -1;
          for (const s of sounded) {
            if (s.staff !== note.staff || s.within >= within || s.within < at) continue;
            if (s.pitch.step !== letter || s.pitch.octave !== octave) continue;
            alter = s.pitch.alter;
            at = s.within;
          }
          return (
            alter ?? keyAlter(state.fifths.get(note.staff) ?? state.fifths.get(0) ?? 0, letter)
          );
        };
        const found = readOrnaments(els, note.pitch, inForce, state.transpose);
        if (found.length > 0) note.ornaments = found;
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
      ...(bars?.doubleRight && { doubleBar: true as const }),
    });
    // A double bar drawn at the start of a measure ends the one before.
    if (bars?.doubleLeft && i > 0) measures[i - 1]!.doubleBar = true;
    const rehearsal = m ? readRehearsal(m) : null;
    if (rehearsal) measures[i]!.rehearsal = rehearsal;
    if (bars?.endingEnd) ending = [];
    start += duration;
  }

  for (const { measure, within, note } of pending)
    notes.push({ ...note, onset: measures[measure]!.start + within });
  for (const { measure, within, bpm } of pendingTempos)
    tempos.push({ tick: measures[measure]!.start + within, bpm });
  const harmonies: HarmonyMark[] = pendingHarmonies
    .map(({ measure, within, mark }) => ({ ...mark, tick: measures[measure]!.start + within }))
    .sort((a, b) => a.tick - b.tick || a.part - b.part || a.staff - b.staff);

  notes.sort(
    (a, b) => a.onset - b.onset || a.staff - b.staff || a.part - b.part || a.midi - b.midi,
  );
  tempos.sort((a, b) => a.tick - b.tick);
  if (measures.some((m) => m.jumps.length > 0)) warnings.add('jumps');
  const practised = partInfo.find((p) =>
    Array.from({ length: p.staves }, (_, s) => hands[staffKey(p.index, s + 1)]).some(Boolean),
  );
  const keys = partKeys[practised?.index ?? 0] ?? [];
  return {
    title,
    composer,
    parts: partInfo,
    hands,
    measures,
    notes,
    tempos,
    ...(keys.length > 0 && { keys }),
    markings: marks.finish(measures),
    ...(harmonies.length > 0 && { harmonies }),
    warnings: [...warnings],
  };
}

const DEGREE_TYPES: readonly string[] = ['add', 'alter', 'subtract'];

/** A root or bass as printed: `B♭`, `F♯`, `E𝄫` written as two flats. */
const noteName = ({ step, alter }: Root) =>
  `${step}${(alter > 0 ? '♯' : '♭').repeat(Math.abs(alter))}`;

function readRoot(el: Element | null, prefix: 'root' | 'bass'): Root | null {
  if (!el) return null;
  const step = text(child(el, `${prefix}-step`)).toUpperCase() as Letter;
  if (!LETTERS.includes(step)) return null;
  const alter = num(child(el, `${prefix}-alter`), 0);
  return Number.isInteger(alter) ? { step, alter } : null;
}

/**
 * A chord symbol: its root, `<kind>`, bass and degrees, the text the score prints and the app's
 * symbol for it. Null for a `<harmony>` without a root (a roman numeral or a function alone).
 */
function readHarmony(el: Element): Omit<HarmonyMark, 'part' | 'staff' | 'measure' | 'tick'> | null {
  const root = readRoot(child(el, 'root'), 'root');
  if (!root) return null;
  const kindEl = child(el, 'kind');
  const kind = text(kindEl) || 'none';
  const bass = readRoot(child(el, 'bass'), 'bass');
  const degrees: MusicXmlDegree[] = childrenNamed(el, 'degree').flatMap((d) => {
    const value = num(child(d, 'degree-value'), NaN);
    const type = text(child(d, 'degree-type'));
    if (!Number.isInteger(value) || !DEGREE_TYPES.includes(type)) return [];
    return [
      { value, alter: num(child(d, 'degree-alter'), 0), type: type as MusicXmlDegree['type'] },
    ];
  });
  const symbol = symbolFromMusicXml(root, kind, bass, degrees);
  const kindText = kindEl?.getAttribute('text');
  const over = bass ? `/${noteName(bass)}` : '';
  const printed =
    kindText !== null && kindText !== undefined
      ? `${noteName(root)}${kindText}${over}`
      : symbol
        ? formatSymbol(symbol)
        : `${noteName(root)}${kind === 'major' ? '' : ` ${kind}`}${over}`;
  return {
    root,
    kind,
    bass,
    ...(degrees.length > 0 && { degrees }),
    text: printed,
    symbol,
  };
}

interface Barlines {
  forward: boolean;
  backwardTimes: number | null;
  endingStart: number[] | null;
  endingEnd: boolean;
  /** A double (or final) barline at the measure's end, or at its start. */
  doubleRight: boolean;
  doubleLeft: boolean;
}

/** Bar styles that close a section: a double bar, a final bar, and their heavy forms. */
const DOUBLE_BARS = new Set(['light-light', 'light-heavy', 'heavy-light', 'heavy-heavy']);

/** The measure's rehearsal mark ("A", "12"), if it has one. */
function readRehearsal(m: Element): string | null {
  for (const mark of m.getElementsByTagName('rehearsal')) {
    const text = mark.textContent?.trim();
    if (text) return text;
  }
  return null;
}

function readBarlines(m: Element): Barlines {
  const bars: Barlines = {
    forward: false,
    backwardTimes: null,
    endingStart: null,
    endingEnd: false,
    doubleRight: false,
    doubleLeft: false,
  };
  for (const barline of childrenNamed(m, 'barline')) {
    const style = child(barline, 'bar-style')?.textContent?.trim() ?? '';
    if (DOUBLE_BARS.has(style)) {
      if (barline.getAttribute('location') === 'left') bars.doubleLeft = true;
      else bars.doubleRight = true;
    }
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

/**
 * The finger to start the note with: the first `<fingering>` that is not an alternative or a
 * substitution, in any of the note's `<notations>`. A change of finger on the key ("3-1", "32")
 * starts with its first digit.
 */
function readFinger(note: Element): number | null {
  for (const notations of childrenNamed(note, 'notations'))
    for (const technical of childrenNamed(notations, 'technical'))
      for (const fingering of childrenNamed(technical, 'fingering')) {
        if (fingering.getAttribute('alternate') === 'yes') continue;
        if (fingering.getAttribute('substitution') === 'yes') continue;
        const digit = /[1-5]/.exec(text(fingering));
        if (digit) return Number(digit[0]);
      }
  return null;
}

/** A grace note (without its transposition); null for a rest, `unknown-step` for a bad pitch. */
function readGrace(el: Element, grace: Element, id: string): GraceNote | 'unknown-step' | null {
  const pitchEl = child(el, 'pitch');
  if (!pitchEl) return null;
  const step = text(child(pitchEl, 'step')).toUpperCase() as Letter;
  if (!LETTERS.includes(step)) return 'unknown-step';
  const pitch: SpelledPitch = {
    step,
    alter: num(child(pitchEl, 'alter'), 0),
    octave: num(child(pitchEl, 'octave'), 4),
  };
  return {
    id,
    midi: midiOf(pitch),
    pitch,
    slash: grace.getAttribute('slash') === 'yes',
    chord: child(el, 'chord') !== null,
  };
}

const SHARPS = 'FCGDAEB';

/** The alteration a key signature (in fifths) gives a letter. */
export function keyAlter(fifths: number, letter: Letter): number {
  if (fifths > 0) return SHARPS.indexOf(letter) < fifths ? 1 : 0;
  if (fifths < 0) return [...SHARPS].reverse().indexOf(letter) < -fifths ? -1 : 0;
  return 0;
}

const ACCIDENTAL_MARKS: Readonly<Record<string, number>> = {
  sharp: 1,
  natural: 0,
  flat: -1,
  'double-sharp': 2,
  'sharp-sharp': 2,
  'flat-flat': -2,
  'natural-sharp': 1,
  'natural-flat': -1,
};

const ORNAMENT_ELEMENTS: Readonly<Record<string, OrnamentKind>> = {
  'trill-mark': 'trill',
  mordent: 'mordent',
  'inverted-mordent': 'inverted-mordent',
  turn: 'turn',
  'inverted-turn': 'inverted-turn',
  'delayed-turn': 'delayed-turn',
  'delayed-inverted-turn': 'delayed-inverted-turn',
};

/**
 * The ornaments of a note from its `<ornaments>` elements, with their neighbouring keys: the next
 * letter up and down, altered as `inForce` says (the bar's accidentals, else the key), or as an
 * `<accidental-mark>` in the same element says (above: the upper note, below: the lower; without a
 * placement, the upper one, except under a mordent, and a second mark is the other one).
 */
function readOrnaments(
  els: readonly Element[],
  pitch: SpelledPitch,
  inForce: (letter: Letter, octave: number) => number,
  transpose: number,
): Ornament[] {
  const index = LETTERS.indexOf(pitch.step);
  const neighbour = (direction: 1 | -1, alter: number | undefined): number => {
    const i = index + direction;
    const octave = pitch.octave + (i > 6 ? 1 : i < 0 ? -1 : 0);
    const letter = LETTERS[(i + 7) % 7]!;
    return midiOf({ step: letter, alter: alter ?? inForce(letter, octave), octave }) + transpose;
  };
  const out: Ornament[] = [];
  for (const el of els) {
    const found = [...el.children].flatMap((c) => {
      const kind = ORNAMENT_ELEMENTS[c.localName];
      return kind ? [{ kind, el: c }] : [];
    });
    if (found.length === 0) continue;
    let upper: number | undefined;
    let lower: number | undefined;
    for (const mark of childrenNamed(el, 'accidental-mark')) {
      const alter = ACCIDENTAL_MARKS[text(mark)];
      if (alter === undefined) continue;
      const placement = mark.getAttribute('placement');
      const unplacedBelow =
        found[0]!.kind === 'mordent' ? lower === undefined : upper !== undefined;
      if (placement === 'below' || (placement !== 'above' && unplacedBelow)) lower = alter;
      else upper = alter;
    }
    const wavyLine = childrenNamed(el, 'wavy-line').some((w) => w.getAttribute('type') === 'start');
    for (const { kind, el: mark } of found) {
      const ornament: Ornament = { kind, upper: neighbour(1, upper), lower: neighbour(-1, lower) };
      if (kind === 'trill' && wavyLine) ornament.wavyLine = true;
      const mordent = kind === 'mordent' || kind === 'inverted-mordent';
      if (mordent && mark.getAttribute('long') === 'yes') ornament.long = true;
      out.push(ornament);
    }
  }
  return out;
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
