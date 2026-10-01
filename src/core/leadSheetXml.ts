// Writes the left hand made from a score's chord symbols (leadSheet.ts) into its MusicXML, on the
// left hand's staff: the document is then drawn by Verovio and read by parseMusicXml like any
// score, so what is drawn is what is practised, heard and judged (docs/HARMONY.md, "Lead sheets
// (H3)"). The document is changed in place; nothing here needs more than a DOM `Document`.
//
// Verovio draws what the file says and infers nothing, so the notes are written with their note
// values, ties, accidentals and beams, as progressionXml.ts writes its own.

import {
  leftHandFromSymbols,
  type GeneratedBar,
  type GeneratedEvent,
  type Meter,
} from './leadSheet.ts';
import { accidentals, type Accidentals } from './progressionXml.ts';
import type { PatternId } from './progressions.ts';
import { keyAlters } from './scales.ts';
import { staffKey, TICKS_PER_QUARTER, type Score, type StaffHands } from './score.ts';

function child(el: Element, name: string): Element | null {
  for (const c of el.children) if (c.localName === name) return c;
  return null;
}

function childrenNamed(el: Element, name: string): Element[] {
  return [...el.children].filter((c) => c.localName === name);
}

const numberOf = (el: Element | null, fallback: number) => {
  const value = Number(el?.textContent?.trim());
  return el && Number.isFinite(value) ? value : fallback;
};

// --- Note values -----------------------------------------------------------------------------

interface NoteValue {
  type: string;
  dot: boolean;
  ticks: number;
  /** Flags (beams): 1 for an eighth, 2 for a sixteenth … 0 for a quarter or longer. */
  flags: number;
}

const VALUES: readonly NoteValue[] = (
  [
    ['whole', 4],
    ['half', 2],
    ['quarter', 1],
    ['eighth', 1 / 2],
    ['16th', 1 / 4],
    ['32nd', 1 / 8],
    ['64th', 1 / 16],
  ] as const
).flatMap(([type, quarters], flags) => {
  const ticks = quarters * TICKS_PER_QUARTER;
  const plain = { type, dot: false, ticks, flags: Math.max(0, flags - 2) };
  // A dotted 64th would need a 128th to follow it.
  return type === '64th' ? [plain] : [{ ...plain, dot: true, ticks: ticks * 1.5 }, plain];
});

const SHORTEST = VALUES.at(-1)!.ticks;

/**
 * The note values that fill `length` ticks from `position` (ticks from the 1 of the meter): the
 * longest first, never across a beat it does not start on, and in a compound meter whole beats
 * from a beat (a dotted quarter and a dotted eighth, not a half note across the dotted beat).
 * Less than a 64th is left over.
 */
export function noteValues(position: number, length: number, meter: Meter): NoteValue[] {
  const out: NoteValue[] = [];
  let at = position;
  let left = length;
  while (left >= SHORTEST) {
    const into = at % meter.beat;
    const room = into === 0 ? left : Math.min(left, meter.beat - into);
    const wholeBeats = meter.kind === 'compound' && into === 0 && room >= meter.beat;
    const value =
      VALUES.find((v) => v.ticks <= room && (!wholeBeats || v.ticks % meter.beat === 0)) ??
      VALUES.find((v) => v.ticks <= room);
    if (!value) break;
    out.push(value);
    at += value.ticks;
    left -= value.ticks;
  }
  return out;
}

// --- Where the left hand goes ----------------------------------------------------------------

/** The staff the generated left hand is written on. */
export interface LeftHandStaff {
  part: number;
  /** 1-based. */
  staff: number;
  /** The part has no such staff yet: it is added, with a bass clef. */
  added: boolean;
}

/**
 * The left hand's staff: the first one the score gives the left hand; failing that, the second
 * staff of the right hand's part (of the symbols' part when no staff is the right hand's), which
 * is added to a part of one staff.
 */
export function leftHandStaff(score: Pick<Score, 'parts' | 'hands' | 'harmonies'>): LeftHandStaff {
  for (const part of score.parts)
    for (let staff = 1; staff <= part.staves; staff++)
      if (score.hands[staffKey(part.index, staff)] === 'left')
        return { part: part.index, staff, added: false };
  const right = score.parts.find((p) => score.hands[staffKey(p.index, 1)] === 'right');
  const part = right ?? score.parts[score.harmonies?.[0]?.part ?? 0] ?? score.parts[0]!;
  return { part: part.index, staff: 2, added: part.staves < 2 };
}

// --- Writing ---------------------------------------------------------------------------------

function make(doc: Document, name: string, content: string | (Element | null)[] = []): Element {
  const ns = doc.documentElement.namespaceURI;
  const el = ns ? doc.createElementNS(ns, name) : doc.createElement(name);
  if (typeof content === 'string') el.textContent = content;
  else for (const c of content) if (c) el.appendChild(c);
  return el;
}

function withAttr(el: Element, name: string, value: string): Element {
  el.setAttribute(name, value);
  return el;
}

const staffOf = (note: Element) => numberOf(child(note, 'staff'), 1);

/** A written piece of an event: one note value of it, tied to the next where it goes on. */
interface Piece {
  event: GeneratedEvent | null;
  value: NoteValue;
  /** Ticks from the start of the bar. */
  onset: number;
  tieStop: boolean;
  tieStart: boolean;
}

/** The bar's events and the rests between them, in note values. */
function pieces(bar: GeneratedBar, duration: number): Piece[] {
  const out: Piece[] = [];
  const fill = (from: number, to: number, event: GeneratedEvent | null) => {
    let onset = from;
    const values = noteValues(bar.phase + from, to - from, bar.meter);
    values.forEach((value, k) => {
      out.push({
        event,
        value,
        onset,
        tieStop: event !== null && k > 0,
        tieStart: event !== null && k < values.length - 1,
      });
      onset += value.ticks;
    });
  };
  let at = 0;
  for (const event of bar.events) {
    if (event.onset > at) fill(at, event.onset, null);
    fill(event.onset, event.onset + event.duration, event);
    at = event.onset + event.duration;
  }
  if (at < duration) fill(at, duration, null);
  return out;
}

/**
 * Beams by the half bar in two and four, by the bar in three, by the beat in a compound meter:
 * for each piece, its `<beam>` values by level (1 for eighths, 2 for sixteenths …). Notes are
 * beamed with their neighbours only: a rest or a longer note ends the beam.
 */
function beams(list: readonly Piece[], bar: GeneratedBar): string[][] {
  const { meter, phase } = bar;
  const window =
    meter.kind === 'simple' ? (meter.beats === 3 ? meter.bar : 2 * meter.beat) : meter.beat;
  const group = (p: Piece) => Math.floor((phase + p.onset) / window);
  const out: string[][] = list.map(() => []);
  /** Runs of neighbouring indexes among `indexes` whose pieces have at least `level` flags. */
  const runs = (indexes: readonly number[], level: number): number[][] => {
    const found: number[][] = [];
    let run: number[] = [];
    for (const index of indexes) {
      const piece = list[index]!;
      const last = run.at(-1);
      const fits = piece.event !== null && piece.value.flags >= level;
      const joins = last !== undefined && last === index - 1 && group(list[last]!) === group(piece);
      if (run.length > 0 && !(fits && joins)) {
        found.push(run);
        run = [];
      }
      if (fits) run.push(index);
    }
    if (run.length > 0) found.push(run);
    return found;
  };
  const mark = (within: readonly number[], level: number) => {
    for (const run of runs(within, level)) {
      if (run.length === 1) {
        // Alone at this level: a flag of its own at level 1, a hook within a beam.
        if (level > 1)
          out[run[0]!]![level - 1] = run[0] === within[0] ? 'forward hook' : 'backward hook';
        continue;
      }
      run.forEach((index, k) => {
        out[index]![level - 1] = k === 0 ? 'begin' : k === run.length - 1 ? 'end' : 'continue';
      });
      if (level < 4) mark(run, level + 1);
    }
  };
  mark(
    list.map((_, index) => index),
    1,
  );
  return out;
}

/** The notes (and rests) of one bar of the generated left hand. */
function barNotes(
  doc: Document,
  bar: GeneratedBar,
  ticks: number,
  divisions: number,
  staff: number,
  voice: string,
  signs: Accidentals,
): Element[] {
  const divs = (t: number) => String(Math.round((t * divisions) / TICKS_PER_QUARTER));
  const tail = () => [make(doc, 'voice', voice)];
  if (bar.events.length === 0) {
    return [
      make(doc, 'note', [
        withAttr(make(doc, 'rest'), 'measure', 'yes'),
        make(doc, 'duration', divs(ticks)),
        ...tail(),
        make(doc, 'staff', String(staff)),
      ]),
    ];
  }
  const list = pieces(bar, ticks);
  const beamed = beams(list, bar);
  return list.flatMap((piece, index) => {
    const { value } = piece;
    const shape = () => [make(doc, 'type', value.type), value.dot ? make(doc, 'dot') : null];
    if (!piece.event) {
      return [
        make(doc, 'note', [
          make(doc, 'rest'),
          make(doc, 'duration', divs(value.ticks)),
          ...tail(),
          ...shape(),
          make(doc, 'staff', String(staff)),
        ]),
      ];
    }
    return piece.event.notes.map((note, k) => {
      const { step, alter, octave } = note.pitch;
      // A note tied from the one before carries no sign of its own.
      const sign = piece.tieStop ? null : signs.sign(note.pitch);
      const tied = [
        piece.tieStop ? withAttr(make(doc, 'tied'), 'type', 'stop') : null,
        piece.tieStart ? withAttr(make(doc, 'tied'), 'type', 'start') : null,
      ];
      return make(doc, 'note', [
        k > 0 ? make(doc, 'chord') : null,
        make(doc, 'pitch', [
          make(doc, 'step', step),
          alter ? make(doc, 'alter', String(alter)) : null,
          make(doc, 'octave', String(octave)),
        ]),
        make(doc, 'duration', divs(value.ticks)),
        piece.tieStop ? withAttr(make(doc, 'tie'), 'type', 'stop') : null,
        piece.tieStart ? withAttr(make(doc, 'tie'), 'type', 'start') : null,
        ...tail(),
        ...shape(),
        sign ? make(doc, 'accidental', sign) : null,
        make(doc, 'staff', String(staff)),
        ...(k === 0
          ? beamed[index]!.map((text, level) =>
              withAttr(make(doc, 'beam', text), 'number', String(level + 1)),
            )
          : []),
        tied.some(Boolean) ? make(doc, 'notations', tied) : null,
      ]);
    });
  });
}

/** Children of `<attributes>` that come before `<staves>`, and before a `<clef>`. */
const BEFORE_STAVES = ['footnote', 'level', 'divisions', 'key', 'time'];
const BEFORE_CLEF = [...BEFORE_STAVES, 'staves', 'part-symbol', 'instruments', 'clef'];

function insertAfter(parent: Element, el: Element, names: readonly string[]) {
  const last = [...parent.children].filter((c) => names.includes(c.localName)).at(-1);
  parent.insertBefore(el, last ? last.nextSibling : parent.firstChild);
}

/** Gives the part a second staff with a bass clef, or the left hand's staff its bass clef. */
function prepareStaff(doc: Document, measures: readonly Element[], staff: number, added: boolean) {
  const bass = () =>
    withAttr(
      make(doc, 'clef', [make(doc, 'sign', 'F'), make(doc, 'line', '4')]),
      'number',
      String(staff),
    );
  const isOwn = (clef: Element) => Number(clef.getAttribute('number') ?? '1') === staff;
  measures.forEach((measure, index) => {
    for (const attrs of childrenNamed(measure, 'attributes')) {
      for (const clef of childrenNamed(attrs, 'clef')) {
        if (added && !clef.hasAttribute('number')) clef.setAttribute('number', '1');
        // The patterns lie in the bass: the staff keeps a bass clef throughout.
        if (isOwn(clef)) attrs.removeChild(clef);
      }
      if (index > 0 && attrs.children.length === 0) measure.removeChild(attrs);
    }
  });
  const first = measures[0];
  if (!first) return;
  let attrs = child(first, 'attributes');
  if (!attrs) {
    attrs = make(doc, 'attributes');
    first.insertBefore(attrs, first.firstChild);
  }
  if (added) {
    const staves = child(attrs, 'staves');
    if (staves) staves.textContent = String(staff);
    else insertAfter(attrs, make(doc, 'staves', String(staff)), BEFORE_STAVES);
  }
  insertAfter(attrs, bass(), BEFORE_CLEF);
}

/**
 * Multiplies the part's divisions (and with them every duration and offset) so that every tick
 * count in `needed` is a whole number of divisions wherever it is written.
 */
function refineDivisions(part: Element, needed: readonly { measure: number; ticks: number }[]) {
  const measures = childrenNamed(part, 'measure');
  const inForce: number[] = [];
  let divisions = 1;
  for (const measure of measures) {
    for (const attrs of childrenNamed(measure, 'attributes'))
      divisions = numberOf(child(attrs, 'divisions'), divisions);
    inForce.push(divisions);
  }
  const whole = (factor: number) =>
    needed.every(({ measure, ticks }) =>
      Number.isInteger((ticks * (inForce[measure] ?? 1) * factor) / TICKS_PER_QUARTER),
    );
  let factor = 1;
  while (factor < 960 && !whole(factor)) factor++;
  if (factor > 1) {
    for (const name of ['divisions', 'duration', 'offset'])
      for (const el of part.getElementsByTagName(name)) {
        const value = Number(el.textContent?.trim());
        if (el.textContent?.trim() && Number.isFinite(value))
          el.textContent = String(value * factor);
      }
  }
  return inForce.map((d) => d * factor);
}

/**
 * Writes the left hand `pattern` makes from the symbols of `score` into `doc` (the document
 * `score` was parsed from): whatever the left hand's staff held is taken out, and each bar gets
 * the pattern in a voice of its own. Returns the hands to read the changed document with.
 */
export function writeLeftHand(doc: Document, score: Score, pattern: PatternId): StaffHands {
  const target = leftHandStaff(score);
  const hands: StaffHands = { ...score.hands, [staffKey(target.part, target.staff)]: 'left' };
  const part = childrenNamed(doc.documentElement, 'part')[target.part];
  if (!part) return hands;
  const bars = leftHandFromSymbols(score, pattern);
  const measures = childrenNamed(part, 'measure');

  const divisions = refineDivisions(
    part,
    bars.flatMap((bar, measure) => [
      { measure, ticks: score.measures[measure]?.duration ?? 0 },
      ...pieces(bar, score.measures[measure]?.duration ?? 0).flatMap((p) => [
        { measure, ticks: p.onset },
        { measure, ticks: p.value.ticks },
      ]),
    ]),
  );

  // What the staff held goes: its notes, rests and grace notes. Time is kept by `<forward>`.
  for (const measure of measures) {
    const notes = childrenNamed(measure, 'note');
    notes.forEach((note, k) => {
      if (staffOf(note) !== target.staff) return;
      const moves = !child(note, 'chord') && !child(note, 'grace');
      const next = notes[k + 1];
      const leads = next && child(next, 'chord') && staffOf(next) !== target.staff;
      if (moves && leads) {
        // A chord across the staves: its next key takes the removed one's place in time.
        next.removeChild(child(next, 'chord')!);
      } else if (moves) {
        const duration = child(note, 'duration')?.textContent?.trim() ?? '0';
        measure.insertBefore(make(doc, 'forward', [make(doc, 'duration', duration)]), note);
      }
      measure.removeChild(note);
    });
  }
  prepareStaff(doc, measures, target.staff, target.added);

  const used = new Set(
    [...part.getElementsByTagName('note')].map(
      (n) => child(n, 'voice')?.textContent?.trim() ?? '1',
    ),
  );
  let voiceNumber = 4 * (target.staff - 1) + 1;
  while (used.has(String(voiceNumber))) voiceNumber++;
  const voice = String(voiceNumber);

  let fifths = 0;
  let signs = accidentals(keyAlters(fifths));
  measures.forEach((measure, index) => {
    const bar = bars[index];
    const written = score.measures[index];
    if (!bar || !written) return;
    for (const attrs of childrenNamed(measure, 'attributes'))
      for (const key of childrenNamed(attrs, 'key')) {
        const number = key.getAttribute('number');
        if (!child(key, 'fifths') || (number !== null && Number(number) !== target.staff)) continue;
        const next = numberOf(child(key, 'fifths'), 0);
        if (next !== fifths) signs = accidentals(keyAlters((fifths = next)));
      }
    signs.newBar();

    // Moves after the last thing placed in time lead nowhere now: they go. Then the measure's
    // time is read again, so the left hand can go back to its 1.
    let trailing: Element[] = [];
    for (const el of measure.children) {
      if (el.localName === 'backup' || el.localName === 'forward') trailing.push(el);
      else if (el.localName !== 'barline') trailing = [];
    }
    for (const el of trailing) measure.removeChild(el);
    let cursor = 0;
    for (const el of measure.children) {
      const duration = numberOf(child(el, 'duration'), 0);
      if (el.localName === 'backup') cursor = Math.max(0, cursor - duration);
      else if (el.localName === 'forward') cursor += duration;
      else if (el.localName === 'note' && !child(el, 'chord') && !child(el, 'grace'))
        cursor += duration;
    }

    const own = barNotes(
      doc,
      bar,
      written.duration,
      divisions[index] ?? 1,
      target.staff,
      voice,
      signs,
    );
    const before =
      [...measure.children].find(
        (c) => c.localName === 'barline' && c.getAttribute('location') !== 'left',
      ) ?? null;
    const content: Element[] = [
      ...(cursor > 0 ? [make(doc, 'backup', [make(doc, 'duration', String(cursor))])] : []),
      ...own,
    ];
    for (const el of content) measure.insertBefore(el, before);
  });
  return hands;
}
