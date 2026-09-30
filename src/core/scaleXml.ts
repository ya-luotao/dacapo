// A scale exercise as MusicXML, for Verovio to draw and parseMusicXml to read back: one piano part,
// on a grand staff for hands together and on one staff for one hand, with the key signature, a
// hidden time signature, the fingering above the right hand and below the left. See
// docs/SCALES.md ("Playing a scale" and the Clarifications).
//
// Verovio draws what the file says and infers nothing, so the file spells out the accidentals,
// the beams, the clef changes and the octave signs.

import { isArpeggio, keyAlters, keySignature, scaleNotes } from './scales.ts';
import type { ScaleExercise, ScaleNote } from './scaleTypes.ts';
import { staffKey, type Hand, type StaffHands } from './score.ts';

export interface ScaleXmlOptions {
  /** 2: eighths, 3: triplet eighths, 4: sixteenths (default). */
  notesPerBeat?: 2 | 3 | 4;
  /**
   * Only these notes of each hand's run (indexes, inclusive), between repeat signs: a focus loop
   * (docs/SCALES.md, "After a run"). The notes keep their ids (`r5` is the right hand's note 5).
   */
  loop?: { from: number; to: number };
}

/** Beats to the bar (the time signature is not shown; bars only break the lines). */
const BEATS_PER_BAR = 4;
/** The clefs change at C4 (see clefs()). */
const MIDDLE_C = 60;
/**
 * Octave signs, each over two or more beat groups in a row lying wholly beyond its threshold: 8va
 * from C6, 15ma from C7, 8vb from C2 down. The value is how many octaves the notes are written
 * below their sound (−1: above).
 */
const OCTAVE_SIGNS: readonly { shift: Shift; applies: (midi: number) => boolean }[] = [
  { shift: 2, applies: (midi) => midi >= 96 },
  { shift: 1, applies: (midi) => midi >= 84 },
  { shift: -1, applies: (midi) => midi <= 36 },
];
type Shift = -1 | 0 | 1 | 2;

const ACCIDENTALS: Record<number, string> = {
  [-2]: 'flat-flat',
  [-1]: 'flat',
  0: 'natural',
  1: 'sharp',
  2: 'double-sharp',
};

interface Placed {
  note: ScaleNote;
  /** In divisions (one division per run note: divisions per quarter = notes per beat). */
  onset: number;
  duration: number;
  /** Beat group: the notes of one beat. */
  group: number;
  type: '16th' | 'eighth' | 'quarter';
  triplet: boolean;
}

/**
 * Places a hand's notes in time. Every note but the last takes one division; the last takes a
 * beat when the run ends on a beat, and otherwise the rest of the beat it starts in (an eighth
 * after two sixteenths, a triplet eighth or quarter in triplets), so every bar holds whole beats
 * and a click on the beat stays on the beat.
 */
function place(notes: readonly ScaleNote[], perBeat: number): Placed[] {
  const unit = perBeat === 4 ? '16th' : 'eighth';
  const last = notes.length - 1;
  const rest = last % perBeat;
  return notes.map((note, i) => {
    const duration = i < last ? 1 : rest === 0 ? perBeat : perBeat - rest;
    const triplet = perBeat === 3 && !(i === last && rest === 0);
    const type =
      i < last
        ? unit
        : rest === 0
          ? 'quarter'
          : perBeat === 4 || duration === 1
            ? 'eighth'
            : 'quarter';
    return { note, onset: i, duration, group: Math.floor(i / perBeat), type, triplet };
  });
}

/** Divisions from the first note to the end of the last (whole beats, see place()). */
function runLength(notes: number, perBeat: number): number {
  return Math.ceil((notes - 1) / perBeat) * perBeat + ((notes - 1) % perBeat === 0 ? perBeat : 0);
}

function groupsOf(placed: readonly Placed[]): Placed[][] {
  const groups: Placed[][] = [];
  for (const p of placed) (groups[p.group] ??= []).push(p);
  return groups;
}

/**
 * The clef of each beat group. The left hand goes to the treble clef for a group lying wholly at
 * or above C4; the right hand, which starts in octave 3 on the longer scales, goes to the
 * bass clef for a group lying wholly below it.
 */
export function clefs(groups: readonly (readonly { midi: number }[])[], hand: Hand): ('G' | 'F')[] {
  const out = groups.map((g) =>
    hand === 'left'
      ? g.every((n) => n.midi >= MIDDLE_C)
        ? 'G'
        : 'F'
      : g.every((n) => n.midi < MIDDLE_C)
        ? 'F'
        : 'G',
  );
  // The last note alone (a run ending on the beat) keeps the clef it follows.
  if (out.length > 1 && groups.at(-1)!.length === 1) out[out.length - 1] = out.at(-2)!;
  return out;
}

/** Keeps the runs of two or more `true`s in a row. */
function stretches(flags: readonly boolean[]): boolean[] {
  return flags.map((f, i) => f && (flags[i - 1] === true || flags[i + 1] === true));
}

/**
 * The octave sign over each beat group. A 15ma inside an 8va's stretch takes over from it for its
 * own groups (the sign switches 8va, 15ma, 8va, which Verovio draws cleanly); what is left of the
 * 8va beside it, if less than two groups, goes under the 15ma too rather than get a sign of its
 * own (its notes, from C6, are then written from C4 up).
 */
export function octaveShifts(groups: readonly (readonly { midi: number }[])[]): Shift[] {
  const out: Shift[] = groups.map(() => 0);
  for (const sign of OCTAVE_SIGNS) {
    const under = stretches(groups.map((g) => g.every((n) => sign.applies(n.midi))));
    under.forEach((u, i) => {
      if (u && out[i] === 0) out[i] = sign.shift;
    });
  }
  for (let i = 0; i < out.length;) {
    let j = i;
    while (j + 1 < out.length && out[j + 1] === out[i]) j++;
    if (out[i] === 1 && j === i && (out[i - 1] === 2 || out[i + 1] === 2)) out[i] = 2;
    i = j + 1;
  }
  return out;
}

function octaveShiftXml(shift: Shift, staff: number, type: 'start' | 'stop'): string {
  const size = Math.abs(shift) === 2 ? 15 : 8;
  const kind = type === 'stop' ? 'stop' : shift > 0 ? 'down' : 'up';
  // Above the staff for 8va and 15ma, below for 8vb. (Verovio stacks the sign clear of the
  // fingering when drawn as "8va"/"15ma", its option octaveAlternativeSymbols; its plain "8"
  // can touch the finger of the note before.)
  const placement = shift > 0 ? 'above' : 'below';
  return (
    `<direction placement="${placement}"><direction-type>` +
    `<octave-shift type="${kind}" size="${size}" number="1"/>` +
    `</direction-type><staff>${staff}</staff></direction>`
  );
}

function beamsOf(group: readonly Placed[]): string[][] {
  // Level 1 joins every note shorter than a quarter; level 2 the sixteenths among them.
  const out = group.map(() => [] as string[]);
  const level = (n: number, ok: (p: Placed) => boolean) => {
    const idx = group.map((p, i) => (ok(p) ? i : -1)).filter((i) => i >= 0);
    // Only consecutive notes of the group share a beam.
    if (idx.length < 2 || idx.at(-1)! - idx[0]! !== idx.length - 1) return;
    idx.forEach((i, k) => {
      const value = k === 0 ? 'begin' : k === idx.length - 1 ? 'end' : 'continue';
      out[i]!.push(`<beam number="${n}">${value}</beam>`);
    });
  };
  level(1, (p) => p.type !== 'quarter');
  level(2, (p) => p.type === '16th');
  return out;
}

interface Staff {
  hand: Hand;
  /** Staff number within the part: 1 and 2 on the grand staff, 1 alone for one hand. */
  number: 1 | 2;
  /** Per bar, the staff's elements in order. */
  bars: string[][];
  firstClef: 'G' | 'F';
}

function staffXml(
  notes: readonly ScaleNote[],
  hand: Hand,
  number: 1 | 2,
  perBeat: number,
  barLength: number,
  fifths: number,
): Staff {
  const placed = place(notes, perBeat);
  const groups = groupsOf(placed);
  const midis = groups.map((g) => g.map((p) => p.note));
  const clef = clefs(midis, hand);
  const shifted = octaveShifts(midis);
  const inKey = keyAlters(fifths);
  const bars: string[][] = [];
  let currentClef = clef[0] ?? (hand === 'right' ? 'G' : 'F');
  const firstClef = currentClef;
  // Alterations in force in the bar, by letter and written octave; and those of the bar before,
  // for courtesy accidentals.
  let inForce = new Map<string, number>();
  let before = new Map<string, number>();
  let bar = -1;

  groups.forEach((group, g) => {
    const beams = beamsOf(group);
    const numbered = group[0]!.onset % barLength === 0 || beams[0]!.length === 0;
    group.forEach((p, k) => {
      const barIndex = Math.floor(p.onset / barLength);
      if (barIndex !== bar) {
        before = inForce;
        inForce = new Map();
        bar = barIndex;
      }
      const out = (bars[barIndex] ??= []);
      if (k === 0) {
        if (clef[g] !== currentClef) {
          currentClef = clef[g]!;
          // A change on the barline goes at the end of the bar before, where it is drawn anyway
          // (Verovio misplaces one at the start of a bar of triplets).
          const atBarline = p.onset % barLength === 0 && barIndex > 0;
          (atBarline ? bars[barIndex - 1]! : out).push(
            `<attributes><clef number="${number}">${clefSign(currentClef)}</clef></attributes>`,
          );
        }
        if (shifted[g] !== 0 && shifted[g - 1] !== shifted[g])
          out.push(octaveShiftXml(shifted[g]!, number, 'start'));
      }
      const { pitch } = p.note;
      const written = pitch.octave - shifted[g]!;
      const place = `${pitch.step}${written}`;
      const expected = inForce.get(place) ?? inKey[pitch.step];
      const previousBar = before.get(place);
      const courtesy =
        previousBar !== undefined && previousBar !== pitch.alter && !inForce.has(place);
      const accidental =
        pitch.alter !== expected || courtesy
          ? `<accidental>${ACCIDENTALS[pitch.alter]}</accidental>`
          : '';
      inForce.set(place, pitch.alter);
      out.push(noteXml(p, number, accidental, beams[k]!, k, group.length, numbered));
      if (k === group.length - 1 && shifted[g] !== 0 && shifted[g + 1] !== shifted[g])
        out.push(octaveShiftXml(shifted[g]!, number, 'stop'));
    });
  });
  return { hand, number, bars, firstClef };
}

function clefSign(clef: 'G' | 'F'): string {
  return clef === 'G' ? '<sign>G</sign><line>2</line>' : '<sign>F</sign><line>4</line>';
}

function noteXml(
  p: Placed,
  staff: 1 | 2,
  accidental: string,
  beams: readonly string[],
  inGroup: number,
  groupSize: number,
  numbered: boolean,
): string {
  const { note } = p;
  const alter = note.pitch.alter !== 0 ? `<alter>${note.pitch.alter}</alter>` : '';
  const timeMod = p.triplet
    ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes><normal-type>eighth</normal-type></time-modification>'
    : '';
  const notations: string[] = [];
  const right = note.hand === 'right';
  if (p.triplet && inGroup === 0) {
    // A bracket only where the beam does not show the group; the 3 away from the fingering, and
    // only on the first group of a bar and on an unbeamed one (the rest go without saying).
    const bracket = beams.length > 0 ? 'no' : 'yes';
    const side = right ? 'below' : 'above';
    const show = numbered ? 'actual' : 'none';
    notations.push(
      `<tuplet type="start" bracket="${bracket}" show-number="${show}" placement="${side}"/>`,
    );
  }
  if (p.triplet && inGroup === groupSize - 1) notations.push('<tuplet type="stop"/>');
  if (note.finger !== null)
    notations.push(
      `<technical><fingering placement="${right ? 'above' : 'below'}">${note.finger}</fingering></technical>`,
    );
  return (
    `<note id="${right ? 'r' : 'l'}${note.index}">` +
    `<pitch><step>${note.pitch.step}</step>${alter}<octave>${note.pitch.octave}</octave></pitch>` +
    `<duration>${p.duration}</duration><voice>${staff}</voice><type>${p.type}</type>` +
    accidental +
    timeMod +
    `<stem>${right ? 'up' : 'down'}</stem><staff>${staff}</staff>` +
    beams.join('') +
    (notations.length > 0 ? `<notations>${notations.join('')}</notations>` : '') +
    '</note>'
  );
}

/**
 * Which hand each staff of the exercise's score is, for `parseMusicXml`'s `hands`: one hand is one
 * staff, both hands a grand staff. Given explicitly, so the scale never depends on how an imported
 * piece's hands are guessed.
 */
export function scaleHands(e: Pick<ScaleExercise, 'hands'>): StaffHands {
  return e.hands === 'both' || e.hands === 'contrary'
    ? { [staffKey(0, 1)]: 'right', [staffKey(0, 2)]: 'left' }
    : { [staffKey(0, 1)]: e.hands };
}

/**
 * Notes to the beat when the tempo is free: sixteenths for a scale, triplets for an arpeggio, so
 * each beat is one octave of the triad from its root (the click sets its own).
 */
export function freePerBeat(type: ScaleExercise['type']): 3 | 4 {
  return isArpeggio(type) ? 3 : 4;
}

/**
 * MusicXML 4.0 (partwise) for the exercise. One hand is drawn on one staff (treble for the right
 * hand, bass for the left), which the page can draw larger; both hands, in parallel or contrary
 * motion, on a grand staff. The part is named after the hand so that parseMusicXml (hands.ts)
 * gives its notes to that hand.
 */
export function scaleMusicXml(e: ScaleExercise, options: ScaleXmlOptions = {}): string {
  const perBeat = options.notesPerBeat ?? freePerBeat(e.type);
  const whole = scaleNotes(e);
  const { loop } = options;
  const cut = (notes: ScaleNote[]) => (loop ? notes.slice(loop.from, loop.to + 1) : notes);
  const right = cut(whole.right);
  const left = cut(whole.left);
  const key = keySignature(e.type, e.tonic);
  const barLength = BEATS_PER_BAR * perBeat;
  const played = right.length > 0 ? right : left;
  // Every note but the last is one division; the last ends on a beat (see place()).
  const length = runLength(played.length, perBeat);
  const barCount = Math.ceil(length / barLength);
  const staves: Staff[] = [];
  if (right.length > 0) staves.push(staffXml(right, 'right', 1, perBeat, barLength, key.fifths));
  if (left.length > 0)
    staves.push(
      staffXml(left, 'left', staves.length === 0 ? 1 : 2, perBeat, barLength, key.fifths),
    );
  const measures: string[] = [];
  for (let m = 0; m < barCount; m++) {
    const duration = Math.min(barLength, length - m * barLength);
    const beats = duration / perBeat;
    let attributes = '';
    if (m === 0) {
      attributes =
        `<attributes><divisions>${perBeat}</divisions>` +
        `<key><fifths>${key.fifths}</fifths><mode>${key.mode}</mode></key>` +
        `<time print-object="no"><beats>${beats}</beats><beat-type>4</beat-type></time>` +
        (staves.length === 2 ? '<staves>2</staves>' : '') +
        staves.map((s) => `<clef number="${s.number}">${clefSign(s.firstClef)}</clef>`).join('') +
        '</attributes>';
    } else if (beats !== BEATS_PER_BAR) {
      attributes = `<attributes><time print-object="no"><beats>${beats}</beats><beat-type>4</beat-type></time></attributes>`;
    }
    const content = staves
      .map((s) => s.bars[m]!.join(''))
      .join(`<backup><duration>${duration}</duration></backup>`);
    // A loop is played round and round: repeat signs around it.
    const forward =
      loop && m === 0 ? '<barline location="left"><repeat direction="forward"/></barline>' : '';
    const backward =
      loop && m === barCount - 1
        ? '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>'
        : '';
    measures.push(
      `<measure number="${m + 1}">${forward}${attributes}${content}${backward}</measure>`,
    );
  }
  const name = staves.length === 2 ? 'Piano' : `Piano, ${staves[0]!.hand} hand`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<score-partwise version="4.0">' +
    `<part-list><score-part id="P1"><part-name print-object="no">${name}</part-name></score-part></part-list>` +
    `<part id="P1">${measures.join('\n')}</part>` +
    '</score-partwise>\n'
  );
}
