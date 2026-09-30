// A scale exercise as MusicXML, for Verovio to draw and parseMusicXml to read back: one piano part,
// on a grand staff for hands together and on one staff for one hand, with the key signature, a
// hidden time signature (Hanon's shown, as printed), the fingering above the right hand and below
// the left. See docs/SCALES.md ("Playing a scale", "Technique" and the Clarifications).
//
// Verovio draws what the file says and infers nothing, so the file spells out the accidentals,
// the beams, the clef changes and the octave signs.

import { isArpeggio, keyAlters, keySignature, scaleNotes } from './scales.ts';
import { stepsOf, type ExerciseType, type ScaleExercise, type ScaleNote } from './scaleTypes.ts';
import { LETTERS } from './note.ts';
import { staffKey, type Hand, type SpelledPitch, type StaffHands } from './score.ts';
import { hanonPartOne, isTechnique, plateOf, techniqueRules } from './technique.ts';
import { partDurations, partsOf } from './techniquePlates.ts';

export interface ScaleXmlOptions {
  /**
   * 2: eighths, 3: triplet eighths, 4: sixteenths (default). A technique exercise with a rhythm of
   * its own (Hanon's, a chord to the beat) keeps it whatever is asked (`layoutOf`).
   */
  notesPerBeat?: number;
  /**
   * Only these steps of each hand's run (indexes, inclusive), between repeat signs: a focus loop
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

type NoteType = '32nd' | '16th' | 'eighth' | 'quarter' | 'half' | 'whole';

/** One step of a hand as drawn: a note, or a chord's keys (lowest first), and its time. */
interface Placed {
  notes: readonly ScaleNote[];
  /** In divisions (divisions per quarter = `Layout.perBeat`). */
  onset: number;
  duration: number;
  /** Beat group: the steps starting in one beat. */
  group: number;
  type: NoteType;
  dots: number;
  triplet: boolean;
}

/**
 * How an exercise is written in time: `perBeat` divisions to the quarter (every step but the last
 * takes one), bars of `beatsPerBar` beats, the time signature shown or not, and how the last step
 * ends: at the end of its beat, or (`closeBar`) at the end of its bar.
 */
export interface Layout {
  perBeat: number;
  beatsPerBar: number;
  /** Show the time signature (Hanon's, as printed); the scales hide theirs. */
  showTime: boolean;
  closeBar: boolean;
  /**
   * The clef is chosen per bar, the one with the fewer ledger lines (`barClefs`), as Hanon's
   * plates change clef; the scales choose it per beat group (`clefs`).
   */
  clefByBar: boolean;
  /**
   * Each step's length in divisions, where the steps are not all one (Hanon's later plates: a bar
   * of repeated notes and its closing chord); the last step then lasts as long as it says.
   */
  durations?: readonly number[];
  /** Divisions of rest after the last step, as a plate prints it (No. 50's chromatic scale). */
  restAfter?: number;
}

/**
 * Notes to the beat when the tempo is free: sixteenths for a scale, triplets for an arpeggio, so
 * each beat is one octave of the triad from its root (the click sets its own); a technique
 * exercise's own.
 */
export function freePerBeat(type: ExerciseType): number {
  if (isTechnique(type)) return techniqueRules(type).perBeat;
  return isArpeggio(type) ? 3 : 4;
}

/**
 * Whether the notes to the beat chosen for the click apply: not to a technique exercise with a
 * rhythm of its own (Hanon's as printed, a broken chord's four notes, a chord to the beat).
 */
export function takesPerBeat(type: ExerciseType): boolean {
  return !isTechnique(type) || !techniqueRules(type).fixedRhythm;
}

/** How the exercise is written: its notes to the beat, bars and close (see `Layout`). */
export function layoutOf(
  e: Pick<ScaleExercise, 'type' | 'variant'> & { tonic?: string },
  notesPerBeat?: number,
): Layout {
  const perBeat =
    notesPerBeat !== undefined && takesPerBeat(e.type) ? notesPerBeat : freePerBeat(e.type);
  if (e.type === 'hanon')
    return {
      perBeat,
      beatsPerBar: hanonPartOne(e.variant).beats,
      showTime: true,
      closeBar: true,
      clefByBar: true,
    };
  // Hanon's later plates: his metre and his values, bar by bar.
  const plate = isTechnique(e.type) ? plateOf({ tonic: 'C', ...e }) : null;
  if (plate) {
    const parts = partsOf(plate.number, plate.part);
    const { perBeat: division, beatsPerBar, durations, restAfter } = partDurations(parts);
    return {
      perBeat: division,
      beatsPerBar,
      showTime: true,
      closeBar: false,
      clefByBar: true,
      durations,
      ...(restAfter > 0 && { restAfter }),
    };
  }
  const chords = e.type === 'majorChords' || e.type === 'minorChords';
  return {
    perBeat,
    beatsPerBar: BEATS_PER_BAR,
    showTime: false,
    closeBar: chords,
    clefByBar: isTechnique(e.type),
  };
}

/**
 * The written value of `duration` divisions at `perBeat` to the quarter: triplets where the beat
 * is divided in three (one division a triplet eighth, two a triplet quarter), else the plain or
 * dotted value.
 */
function noteType(duration: number, perBeat: number): Pick<Placed, 'type' | 'dots' | 'triplet'> {
  if (perBeat % 3 === 0 && duration % perBeat !== 0) {
    const unit = duration / (perBeat / 3);
    return { type: unit === 1 ? 'eighth' : 'quarter', dots: 0, triplet: true };
  }
  const quarters = duration / perBeat;
  const plain: [number, NoteType][] = [
    [4, 'whole'],
    [2, 'half'],
    [1, 'quarter'],
    [1 / 2, 'eighth'],
    [1 / 4, '16th'],
    [1 / 8, '32nd'],
  ];
  for (const [value, type] of plain) {
    if (quarters === value) return { type, dots: 0, triplet: false };
    if (quarters === value * 1.5) return { type, dots: 1, triplet: false };
  }
  throw new Error(`no note value for ${duration} divisions at ${perBeat} to the quarter`);
}

/** How long the last step lasts, starting at division `at` (see place()). */
function lastDuration(at: number, layout: Layout): number {
  const bar = layout.perBeat * layout.beatsPerBar;
  if (layout.closeBar) return bar - (at % bar);
  const rest = at % layout.perBeat;
  return rest === 0 ? layout.perBeat : layout.perBeat - rest;
}

/**
 * Places a hand's steps in time. Every step but the last takes one division; the last takes the
 * rest of its bar with `closeBar`, else a beat when the run ends on a beat and otherwise the rest
 * of the beat it starts in (an eighth after two sixteenths, a triplet eighth or quarter in
 * triplets), so every bar holds whole beats and a click on the beat stays on the beat.
 */
function place(steps: readonly (readonly ScaleNote[])[], layout: Layout): Placed[] {
  const last = steps.length - 1;
  let onset = 0;
  return steps.map((notes, i) => {
    const duration = layout.durations
      ? layout.durations[i]!
      : i < last
        ? 1
        : lastDuration(i, layout);
    const placed: Placed = {
      notes,
      onset,
      duration,
      group: Math.floor(onset / layout.perBeat),
      ...noteType(duration, layout.perBeat),
    };
    onset += duration;
    return placed;
  });
}

/** Divisions from the first step to the end of the last (see place()). */
function runLength(steps: number, layout: Layout): number {
  if (layout.durations) return layout.durations.slice(0, steps).reduce((a, d) => a + d, 0);
  return steps - 1 + lastDuration(steps - 1, layout);
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
export function clefs(
  groups: readonly (readonly { midi: number }[])[],
  hand: Hand,
  lastAlone = groups.at(-1)?.length === 1,
): ('G' | 'F')[] {
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
  if (out.length > 1 && lastAlone) out[out.length - 1] = out.at(-2)!;
  return out;
}

/** Ledger lines a written note needs on a staff: treble E4–F5, bass G2–A3. */
function ledgers(pitch: SpelledPitch, clef: 'G' | 'F'): number {
  // Staff positions from C4 (0), a step each: treble lines 2 to 10, bass −10 to −2.
  const at = 7 * (pitch.octave - 4) + LETTERS.indexOf(pitch.step);
  const [low, high] = clef === 'G' ? [2, 10] : [-10, -2];
  if (at < low) return Math.floor((low - at) / 2);
  if (at > high) return Math.floor((at - high) / 2);
  return 0;
}

/**
 * The clef of each bar, as an engraver of Hanon's plates chooses it: the one whose notes need the
 * fewer ledger lines, the clef before kept on a tie (the hand's own at the start: treble for the
 * right hand, bass for the left). Never inside a bar, so a group is read in one clef.
 */
export function barClefs(
  bars: readonly (readonly { pitch: SpelledPitch }[])[],
  hand: Hand,
): ('G' | 'F')[] {
  let current: 'G' | 'F' = hand === 'right' ? 'G' : 'F';
  return bars.map((notes) => {
    const cost = (clef: 'G' | 'F') => notes.reduce((a, n) => a + ledgers(n.pitch, clef), 0);
    const other = current === 'G' ? 'F' : 'G';
    if (cost(other) < cost(current)) current = other;
    return current;
  });
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
  // Level 1 joins every step shorter than a quarter; level 2 the sixteenths and shorter among
  // them; level 3 the thirty-seconds.
  const out = group.map(() => [] as string[]);
  const level = (n: number, ok: (p: Placed) => boolean) => {
    const idx = group.map((p, i) => (ok(p) ? i : -1)).filter((i) => i >= 0);
    // Only consecutive steps of the group share a beam.
    if (idx.length < 2 || idx.at(-1)! - idx[0]! !== idx.length - 1) return;
    idx.forEach((i, k) => {
      const value = k === 0 ? 'begin' : k === idx.length - 1 ? 'end' : 'continue';
      out[i]!.push(`<beam number="${n}">${value}</beam>`);
    });
  };
  level(1, (p) => p.type === 'eighth' || p.type === '16th' || p.type === '32nd');
  level(2, (p) => p.type === '16th' || p.type === '32nd');
  level(3, (p) => p.type === '32nd');
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
  steps: readonly (readonly ScaleNote[])[],
  hand: Hand,
  number: 1 | 2,
  layout: Layout,
  fifths: number,
): Staff {
  const barLength = layout.beatsPerBar * layout.perBeat;
  const placed = place(steps, layout);
  const groups = groupsOf(placed);
  const midis = groups.map((g) => g.flatMap((p) => p.notes));
  // A chord is one step: the last step alone keeps its clef, whatever its keys.
  const shifted = octaveShifts(midis);
  const clef = layout.clefByBar
    ? (() => {
        // One clef a bar, from the notes as written (under an octave sign, an octave lower).
        const byBar: { pitch: SpelledPitch }[][] = [];
        for (const p of placed)
          for (const n of p.notes)
            (byBar[Math.floor(p.onset / barLength)] ??= []).push({
              pitch: { ...n.pitch, octave: n.pitch.octave - shifted[p.group]! },
            });
        const perBar = barClefs(byBar, hand);
        return groups.map((g) => perBar[Math.floor(g[0]!.onset / barLength)]!);
      })()
    : clefs(midis, hand, groups.at(-1)!.length === 1);
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
      // A chord's keys each get their accidental against what is in force before the chord.
      const accidentals = p.notes.map(({ pitch }) => {
        const written = pitch.octave - shifted[g]!;
        const at = `${pitch.step}${written}`;
        const expected = inForce.get(at) ?? inKey[pitch.step];
        const previousBar = before.get(at);
        const courtesy =
          previousBar !== undefined && previousBar !== pitch.alter && !inForce.has(at);
        return pitch.alter !== expected || courtesy
          ? `<accidental>${ACCIDENTALS[pitch.alter]}</accidental>`
          : '';
      });
      for (const { pitch } of p.notes)
        inForce.set(`${pitch.step}${pitch.octave - shifted[g]!}`, pitch.alter);
      p.notes.forEach((note, v) =>
        out.push(
          noteXml(p, note, v, number, accidentals[v]!, beams[k]!, k, group.length, numbered),
        ),
      );
      if (k === group.length - 1 && shifted[g] !== 0 && shifted[g + 1] !== shifted[g])
        out.push(octaveShiftXml(shifted[g]!, number, 'stop'));
    });
  });
  // A closing rest, as the plate prints it, in the last step's bar.
  if (layout.restAfter) {
    const end = placed.at(-1)!;
    const { type, dots } = noteType(layout.restAfter, layout.perBeat);
    (bars[Math.floor((end.onset + end.duration) / barLength)] ??= []).push(
      `<note><rest/><duration>${layout.restAfter}</duration><voice>${number}</voice>` +
        `<type>${type}</type>${'<dot/>'.repeat(dots)}<staff>${number}</staff></note>`,
    );
  }
  return { hand, number, bars, firstClef };
}

function clefSign(clef: 'G' | 'F'): string {
  return clef === 'G' ? '<sign>G</sign><line>2</line>' : '<sign>F</sign><line>4</line>';
}

/**
 * One key of a step. The chord's first key carries the step's beams and tuplet; the others are
 * `<chord/>`s of it. Every key carries its own finger.
 */
function noteXml(
  p: Placed,
  note: ScaleNote,
  voice: number,
  staff: 1 | 2,
  accidental: string,
  beams: readonly string[],
  inGroup: number,
  groupSize: number,
  numbered: boolean,
): string {
  const alter = note.pitch.alter !== 0 ? `<alter>${note.pitch.alter}</alter>` : '';
  const timeMod = p.triplet
    ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes><normal-type>eighth</normal-type></time-modification>'
    : '';
  const notations: string[] = [];
  const right = note.hand === 'right';
  const first = voice === 0;
  if (first && p.triplet && inGroup === 0) {
    // A bracket only where the beam does not show the group; the 3 away from the fingering, and
    // only on the first group of a bar and on an unbeamed one (the rest go without saying).
    const bracket = beams.length > 0 ? 'no' : 'yes';
    const side = right ? 'below' : 'above';
    const show = numbered ? 'actual' : 'none';
    notations.push(
      `<tuplet type="start" bracket="${bracket}" show-number="${show}" placement="${side}"/>`,
    );
  }
  if (first && p.triplet && inGroup === groupSize - 1) notations.push('<tuplet type="stop"/>');
  if (note.finger !== null && !note.unmarked)
    notations.push(
      `<technical><fingering placement="${right ? 'above' : 'below'}">${note.finger}</fingering></technical>`,
    );
  const id = `${right ? 'r' : 'l'}${note.index}${first ? '' : `.${voice}`}`;
  return (
    `<note id="${id}">` +
    (first ? '' : '<chord/>') +
    `<pitch><step>${note.pitch.step}</step>${alter}<octave>${note.pitch.octave}</octave></pitch>` +
    `<duration>${p.duration}</duration><voice>${staff}</voice><type>${p.type}</type>` +
    '<dot/>'.repeat(p.dots) +
    accidental +
    timeMod +
    `<stem>${right ? 'up' : 'down'}</stem><staff>${staff}</staff>` +
    (first ? beams.join('') : '') +
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
 * MusicXML 4.0 (partwise) for the exercise. One hand is drawn on one staff (treble for the right
 * hand, bass for the left), which the page can draw larger; both hands, in parallel or contrary
 * motion, on a grand staff. The part is named after the hand so that parseMusicXml (hands.ts)
 * gives its notes to that hand.
 */
export function scaleMusicXml(e: ScaleExercise, options: ScaleXmlOptions = {}): string {
  const layout = layoutOf(e, options.notesPerBeat);
  const { perBeat, beatsPerBar } = layout;
  const whole = scaleNotes(e);
  const { loop } = options;
  const cut = (notes: ScaleNote[]) =>
    stepsOf(loop ? notes.filter((n) => n.index >= loop.from && n.index <= loop.to) : notes);
  const right = cut(whole.right);
  const left = cut(whole.left);
  const key = keySignature(e.type, e.tonic);
  // A loop's last step fills its beat, whatever the exercise's close.
  const drawn: Layout = loop ? loopLayout(layout, loop) : layout;
  const barLength = beatsPerBar * perBeat;
  const played = right.length > 0 ? right : left;
  const length = runLength(played.length, drawn) + (drawn.restAfter ?? 0);
  const barCount = Math.ceil(length / barLength);
  const staves: Staff[] = [];
  if (right.length > 0) staves.push(staffXml(right, 'right', 1, drawn, key.fifths));
  if (left.length > 0)
    staves.push(staffXml(left, 'left', staves.length === 0 ? 1 : 2, drawn, key.fifths));
  const shown = layout.showTime ? '' : ' print-object="no"';
  const measures: string[] = [];
  for (let m = 0; m < barCount; m++) {
    const duration = Math.min(barLength, length - m * barLength);
    const beats = duration / perBeat;
    let attributes = '';
    if (m === 0) {
      attributes =
        `<attributes><divisions>${perBeat}</divisions>` +
        `<key><fifths>${key.fifths}</fifths><mode>${key.mode}</mode></key>` +
        `<time${shown}><beats>${beats}</beats><beat-type>4</beat-type></time>` +
        (staves.length === 2 ? '<staves>2</staves>' : '') +
        staves.map((s) => `<clef number="${s.number}">${clefSign(s.firstClef)}</clef>`).join('') +
        '</attributes>';
    } else if (beats !== beatsPerBar) {
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

/**
 * A loop's layout: its steps' own lengths where the exercise has them, the last filling its beat
 * (a loop ends where it goes round), whatever the exercise's close.
 */
function loopLayout(layout: Layout, loop: { from: number; to: number }): Layout {
  if (!layout.durations) return { ...layout, closeBar: false };
  const durations = layout.durations.slice(loop.from, loop.to + 1);
  const onset = durations.slice(0, -1).reduce((a, d) => a + d, 0);
  const rest = onset % layout.perBeat;
  durations[durations.length - 1] = rest === 0 ? layout.perBeat : layout.perBeat - rest;
  // No closing rest: the loop goes round.
  const { perBeat, beatsPerBar, showTime, clefByBar } = layout;
  return { perBeat, beatsPerBar, showTime, clefByBar, closeBar: false, durations };
}

/** How many beats the exercise's score lasts (at `notesPerBeat`, as `scaleMusicXml` draws it). */
export function exerciseBeats(e: ScaleExercise, notesPerBeat?: number): number {
  const layout = layoutOf(e, notesPerBeat);
  const { right, left } = scaleNotes(e);
  const steps = stepsOf(right.length > 0 ? right : left).length;
  return runLength(steps, layout) / layout.perBeat;
}
