// A rhythm exercise as MusicXML, for Verovio to draw and parseMusicXml to read back: one line of
// rhythm on a one-line staff (two, the right hand over the left, in R9–R10), with the time
// signature, notes on the line, beams by the beat (by three eighths in 6/8), ties, triplets with
// their 3, sixteenths' second beams and rests centred on the line. The counts under the line are
// the page's to draw (`exerciseCounts`): Verovio neither sizes nor spaces text given to it as
// directions, and the page lights the count being played.
//
// Verovio draws what the file says: the notes are pitched (E4 under a hidden treble clef and G2
// under a hidden bass clef each sit on the one line), so they are ordinary notes to the parser and
// to Verovio's timemap, which ScoreView maps them by; the beams are spelled out.

import { barTicksOf, beatTicksOf, timeSignature, type RhythmMeter } from './rhythmCells.ts';
import type { PlacedNote, RhythmExercise } from './rhythmExercise.ts';
import { staffKey, TICKS_PER_QUARTER, type StaffHands } from './score.ts';

/** MusicXML divisions per quarter: a triplet eighth (8), a sixteenth (6), a dotted one (18). */
const DIVISIONS = 24;
const TICKS_PER_DIVISION = TICKS_PER_QUARTER / DIVISIONS;

/** Where each line's notes sit: on the line of a one-line staff (see LINE_KEYS). */
const LINE_PITCH = [
  { step: 'E', octave: 4, clef: '<sign>G</sign><line>2</line>' },
  { step: 'G', octave: 2, clef: '<sign>F</sign><line>4</line>' },
] as const;

/** Which hand each staff is, for parseMusicXml: the right hand's line on top. */
export function rhythmHands(exercise: Pick<RhythmExercise, 'lines'>): StaffHands {
  return exercise.lines.length === 2
    ? { [staffKey(0, 1)]: 'right', [staffKey(0, 2)]: 'left' }
    : { [staffKey(0, 1)]: 'right' };
}

const divisions = (ticks: number) => ticks / TICKS_PER_DIVISION;

function beamable(n: PlacedNote): boolean {
  return !n.rest && (n.type === 'eighth' || n.type === '16th');
}

/**
 * The beams of a line: notes shorter than a quarter, one after another within a beat (a dotted
 * quarter in 6/8), are joined; a note alone in its beat keeps its flag. The second beam joins
 * neighbouring sixteenths; a sixteenth alone in a group gets a hook pointing into the beat.
 */
function beamsOf(notes: readonly PlacedNote[], meter: RhythmMeter): string[][] {
  const beat = beatTicksOf(meter);
  const out = notes.map(() => [] as string[]);
  const groups: number[][] = [];
  notes.forEach((n, i) => {
    const index = Math.floor(n.tick / beat);
    const fits = beamable(n) && n.tick + n.ticks <= (index + 1) * beat;
    const last = groups.at(-1);
    const prev = notes[i - 1];
    if (fits && last && last.at(-1) === i - 1 && prev && Math.floor(prev.tick / beat) === index)
      last.push(i);
    else if (fits) groups.push([i]);
  });
  for (const group of groups) {
    if (group.length < 2) continue;
    group.forEach((i, k) => {
      const value = k === 0 ? 'begin' : k === group.length - 1 ? 'end' : 'continue';
      out[i]!.push(`<beam number="1">${value}</beam>`);
    });
    group.forEach((i, k) => {
      if (notes[i]!.type !== '16th') return;
      const prev = group[k - 1];
      const next = group[k + 1];
      const prevS = prev !== undefined && notes[prev]!.type === '16th';
      const nextS = next !== undefined && notes[next]!.type === '16th';
      let value: string;
      if (prevS && nextS) value = 'continue';
      else if (nextS) value = 'begin';
      else if (prevS) value = 'end';
      else value = next === undefined ? 'backward hook' : 'forward hook';
      out[i]!.push(`<beam number="2">${value}</beam>`);
    });
  }
  return out;
}

/** The triplets of a line: where each run of triplet notes within one beat starts and stops. */
function tupletsOf(notes: readonly PlacedNote[], meter: RhythmMeter): ('start' | 'stop' | null)[] {
  const beat = beatTicksOf(meter);
  return notes.map((n, i) => {
    if (!n.triplet) return null;
    const same = (m: PlacedNote | undefined) =>
      m?.triplet === true && Math.floor(m.tick / beat) === Math.floor(n.tick / beat);
    if (!same(notes[i - 1])) return 'start';
    return same(notes[i + 1]) ? null : 'stop';
  });
}

function noteXml(
  n: PlacedNote,
  line: number,
  beams: readonly string[],
  tuplet: 'start' | 'stop' | null,
): string {
  const staff = line + 1;
  const pitch = LINE_PITCH[line]!;
  const head = n.rest
    ? `<rest><display-step>${pitch.step}</display-step><display-octave>${pitch.octave}</display-octave></rest>`
    : `<pitch><step>${pitch.step}</step><octave>${pitch.octave}</octave></pitch>`;
  const tieStart = n.tie && !n.rest;
  const notations: string[] = [];
  if (n.tied) notations.push('<tied type="stop"/>');
  if (tieStart) notations.push('<tied type="start"/>');
  // The beam shows the group, so the 3 goes without a bracket; away from the stems.
  if (tuplet === 'start')
    notations.push(
      `<tuplet type="start" bracket="${beams.length > 0 ? 'no' : 'yes'}" show-number="actual" placement="${line === 0 ? 'above' : 'below'}"/>`,
    );
  if (tuplet === 'stop') notations.push('<tuplet type="stop"/>');
  return (
    '<note>' +
    head +
    `<duration>${divisions(n.ticks)}</duration>` +
    (n.tied ? '<tie type="stop"/>' : '') +
    (tieStart ? '<tie type="start"/>' : '') +
    `<voice>${staff}</voice><type>${n.type}</type>` +
    (n.dot ? '<dot/>' : '') +
    (n.triplet
      ? '<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes><normal-type>eighth</normal-type></time-modification>'
      : '') +
    (n.rest ? '' : `<stem>${line === 0 ? 'up' : 'down'}</stem>`) +
    `<staff>${staff}</staff>` +
    beams.join('') +
    (notations.length > 0 ? `<notations>${notations.join('')}</notations>` : '') +
    '</note>'
  );
}

/** MusicXML 4.0 (partwise) for the exercise: its bars and the final note's bar. */
export function rhythmMusicXml(exercise: RhythmExercise): string {
  const { meter } = exercise;
  const bar = barTicksOf(meter);
  const [beats, beatType] = timeSignature(meter);
  const staves = exercise.lines.length;
  const perLine = exercise.lines.map((notes) => ({
    notes,
    beams: beamsOf(notes, meter),
    tuplets: tupletsOf(notes, meter),
  }));
  const measures: string[] = [];
  for (let m = 0; m <= exercise.bars; m++) {
    const from = m * bar;
    const attributes =
      m === 0
        ? `<attributes><divisions>${DIVISIONS}</divisions>` +
          '<key print-object="no"><fifths>0</fifths></key>' +
          `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
          (staves === 2 ? '<staves>2</staves>' : '') +
          exercise.lines
            .map(
              (_, l) => `<clef number="${l + 1}" print-object="no">${LINE_PITCH[l]!.clef}</clef>`,
            )
            .join('') +
          exercise.lines
            .map(
              (_, l) =>
                `<staff-details number="${l + 1}"><staff-lines>1</staff-lines></staff-details>`,
            )
            .join('') +
          '</attributes>'
        : '';
    const content = perLine
      .map(({ notes, beams, tuplets }, l) =>
        notes
          .map((n, i) =>
            n.tick >= from && n.tick < from + bar ? noteXml(n, l, beams[i]!, tuplets[i]!) : '',
          )
          .join(''),
      )
      .join(`<backup><duration>${divisions(bar)}</duration></backup>`);
    const barline =
      m === exercise.bars
        ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
        : '';
    measures.push(`<measure number="${m + 1}">${attributes}${content}${barline}</measure>`);
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<score-partwise version="4.0">' +
    '<part-list><score-part id="P1"><part-name print-object="no">Rhythm</part-name></score-part></part-list>' +
    `<part id="P1">${measures.join('\n')}</part>` +
    '</score-partwise>\n'
  );
}
