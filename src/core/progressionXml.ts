// A progression as MusicXML, for Verovio to draw and parseMusicXml to read back (docs/HARMONY.md,
// "Progressions (H2)"): one piano part on a grand staff, the right hand's chords on the treble
// staff with their symbols above (`<harmony>`), the left hand's pattern on the bass staff with the
// roman numerals below, the key signature, the time signature and the tempo.
//
// Verovio draws what the file says and infers nothing, so the file spells out the accidentals and
// the beams, as the scale exercises' does (scaleXml.ts).

import { MUSICXML_KIND, SYMBOL_SUFFIX } from './chordSymbols.ts';
import {
  arrangeProgression,
  DIVISIONS,
  type ArrangedNote,
  type Arrangement,
  type KeyChord,
  type ProgressionSpec,
} from './progressions.ts';
import { keyAlters } from './scales.ts';
import { staffKey, type StaffHands } from './score.ts';

/** ♩ = 80 unless another tempo is chosen. */
export const DEFAULT_PROGRESSION_BPM = 80;

const ACCIDENTALS: Readonly<Record<number, string>> = {
  [-2]: 'flat-flat',
  [-1]: 'flat',
  0: 'natural',
  1: 'sharp',
  2: 'double-sharp',
};

/** Staff 1 is the right hand, staff 2 the left: given, so no hand is ever guessed. */
export const PROGRESSION_HANDS: StaffHands = {
  [staffKey(0, 1)]: 'right',
  [staffKey(0, 2)]: 'left',
};

/** A roman numeral as the score writes it under the bass staff: `V⁷`, `ii⁷`, `Imaj⁷`, `iv`. */
export function numeralText(chord: Pick<KeyChord, 'numeral' | 'figure'>): string {
  return `${chord.numeral}${chord.figure.replace('7', '⁷')}`;
}

function harmonyXml(c: KeyChord): string {
  const kind = MUSICXML_KIND[c.symbol.quality];
  const text = SYMBOL_SUFFIX[c.symbol.quality];
  const { step, alter } = c.symbol.root;
  return (
    '<harmony print-frame="no" placement="above">' +
    `<root><root-step>${step}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ''}</root>` +
    `<kind text="${text}">${kind}</kind>` +
    '<staff>1</staff></harmony>'
  );
}

function wordsXml(text: string, staff: number, placement: 'above' | 'below'): string {
  return (
    `<direction placement="${placement}"><direction-type><words font-style="normal">${text}</words></direction-type>` +
    `<staff>${staff}</staff></direction>`
  );
}

function tempoXml(bpm: number): string {
  return (
    '<direction placement="above"><direction-type><metronome parentheses="no">' +
    `<beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type>` +
    `<staff>1</staff><sound tempo="${bpm}"/></direction>`
  );
}

/** The type of a duration in eighths, with a dot where it takes one. */
function typeOf(eighths: number): { type: string; dot: boolean } {
  switch (eighths) {
    case 1:
      return { type: 'eighth', dot: false };
    case 2:
      return { type: 'quarter', dot: false };
    case 3:
      return { type: 'quarter', dot: true };
    case 4:
      return { type: 'half', dot: false };
    case 6:
      return { type: 'half', dot: true };
    case 8:
      return { type: 'whole', dot: false };
    default:
      throw new RangeError(`No note value of ${eighths} eighths`);
  }
}

interface Accidentals {
  newBar: () => void;
  /**
   * The sign a note needs: where its alteration is not the one in force (the key's, or an earlier
   * note's in the bar), and a courtesy sign where the bar before altered it otherwise.
   */
  sign: (note: ArrangedNote) => string;
}

/** Alterations in force on a staff: by letter and octave, within the bar and the bar before. */
function accidentals(key: Readonly<Record<string, number>>): Accidentals {
  let inForce = new Map<string, number>();
  let before = new Map<string, number>();
  return {
    newBar() {
      before = inForce;
      inForce = new Map();
    },
    sign(note) {
      const { step, alter, octave } = note.pitch;
      const place = `${step}${octave}`;
      const expected = inForce.get(place) ?? key[step]!;
      const previous = before.get(place);
      const courtesy = previous !== undefined && previous !== alter && !inForce.has(place);
      inForce.set(place, alter);
      return alter !== expected || courtesy ? `<accidental>${ACCIDENTALS[alter]}</accidental>` : '';
    },
  };
}

function noteXml(
  note: ArrangedNote,
  staff: 1 | 2,
  inChord: boolean,
  accidental: string,
  beam: string,
): string {
  const { step, alter, octave } = note.pitch;
  const { type, dot } = typeOf(note.duration);
  return (
    '<note>' +
    (inChord ? '<chord/>' : '') +
    `<pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>` +
    `<duration>${note.duration}</duration><voice>${staff}</voice><type>${type}</type>` +
    (dot ? '<dot/>' : '') +
    accidental +
    `<staff>${staff}</staff>` +
    beam +
    '</note>'
  );
}

/**
 * A staff's notes in a bar, a chord's keys together (low to high), eighths beamed by the half
 * bar (by the bar in 3/4).
 */
function staffNotes(
  notes: readonly ArrangedNote[],
  staff: 1 | 2,
  signs: Accidentals,
  beamGroup: number,
): string {
  const onsets = [...new Set(notes.map((n) => n.onset))].sort((a, b) => a - b);
  const eighths = onsets.filter((onset) => notes.find((n) => n.onset === onset)!.duration === 1);
  return onsets
    .map((onset) => {
      const chord = notes.filter((n) => n.onset === onset).sort((a, b) => a.midi - b.midi);
      let beam = '';
      if (chord[0]!.duration === 1) {
        const group = eighths.filter(
          (e) => Math.floor(e / beamGroup) === Math.floor(onset / beamGroup),
        );
        if (group.length > 1) {
          const at = group.indexOf(onset);
          const value = at === 0 ? 'begin' : at === group.length - 1 ? 'end' : 'continue';
          beam = `<beam number="1">${value}</beam>`;
        }
      }
      return chord
        .map((note, k) => noteXml(note, staff, k > 0, signs.sign(note), k === 0 ? beam : ''))
        .join('');
    })
    .join('');
}

export interface ProgressionXmlOptions {
  /** Quarter notes a minute, written as the tempo mark. */
  bpm?: number;
}

/** The arrangement as MusicXML 4.0 (partwise). */
export function arrangementXml(a: Arrangement, options: ProgressionXmlOptions = {}): string {
  const bpm = options.bpm ?? DEFAULT_PROGRESSION_BPM;
  const barLength = a.beats * DIVISIONS;
  const alters = keyAlters(a.fifths);
  const right = accidentals(alters);
  const left = accidentals(alters);
  const measures = a.bars.map((bar, m) => {
    right.newBar();
    left.newBar();
    const attributes =
      m === 0
        ? `<attributes><divisions>${DIVISIONS}</divisions>` +
          `<key><fifths>${a.fifths}</fifths><mode>${a.mode}</mode></key>` +
          `<time><beats>${a.beats}</beats><beat-type>4</beat-type></time>` +
          '<staves>2</staves>' +
          '<clef number="1"><sign>G</sign><line>2</line></clef>' +
          '<clef number="2"><sign>F</sign><line>4</line></clef></attributes>'
        : '';
    const last =
      m === a.bars.length - 1
        ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>'
        : '';
    return (
      `<measure number="${m + 1}">` +
      attributes +
      (m === 0 ? tempoXml(bpm) : '') +
      harmonyXml(bar.chord) +
      staffNotes(
        bar.notes.filter((n) => n.hand === 'right'),
        1,
        right,
        barLength,
      ) +
      `<backup><duration>${barLength}</duration></backup>` +
      wordsXml(numeralText(bar.chord), 2, 'below') +
      staffNotes(
        bar.notes.filter((n) => n.hand === 'left'),
        2,
        left,
        a.beats === 3 ? barLength : barLength / 2,
      ) +
      last +
      '</measure>'
    );
  });
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<score-partwise version="4.0">' +
    '<part-list><score-part id="P1"><part-name print-object="no">Piano</part-name></score-part></part-list>' +
    `<part id="P1">${measures.join('\n')}</part>` +
    '</score-partwise>\n'
  );
}

/** The progression's score. */
export function progressionXml(spec: ProgressionSpec, options: ProgressionXmlOptions = {}): string {
  return arrangementXml(arrangeProgression(spec), options);
}
