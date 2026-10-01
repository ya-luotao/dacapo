// A phrase of a tune as MusicXML, for Verovio to draw after a wrong answer (docs/HARMONY.md,
// "Playing by ear (H5)"): one treble staff with the key and time signatures, the phrase in its own
// rhythm from its first note to the end of its last (an upbeat's bar and a last bar cut short are
// short bars), and the key played wrong written with the note it should have been, as a chord.
//
// Verovio draws what the file says and infers nothing, so the file spells out the values, the
// rests, the beams (by the beat: a dotted quarter in 6/8) and every sign a bar needs.

import type { MelodyKey } from './earMelody.ts';
import { spellInKey } from './earMelody.ts';
import { keyAlters } from './keys.ts';
import {
  staffKey,
  TICKS_PER_QUARTER,
  type Score,
  type SpelledPitch,
  type StaffHands,
} from './score.ts';
import {
  barTicks,
  beatTicks,
  tuneFifths,
  tuneKey,
  tunePitch,
  type Tune,
  type TuneMark,
} from './tunes.ts';

/** Divisions per quarter: a sixteenth is one. */
const DIVISIONS = 4;
const TICKS_PER_DIVISION = TICKS_PER_QUARTER / DIVISIONS;
const divisions = (ticks: number) => ticks / TICKS_PER_DIVISION;

const ACCIDENTALS: Record<number, string> = {
  [-2]: 'flat-flat',
  [-1]: 'flat',
  0: 'natural',
  1: 'sharp',
  2: 'double-sharp',
};

/** A written value from its length in ticks: what the tunes are written in. */
const VALUES: Readonly<Record<number, { type: string; dot: boolean }>> = {
  [4 * TICKS_PER_QUARTER]: { type: 'whole', dot: false },
  [3 * TICKS_PER_QUARTER]: { type: 'half', dot: true },
  [2 * TICKS_PER_QUARTER]: { type: 'half', dot: false },
  [1.5 * TICKS_PER_QUARTER]: { type: 'quarter', dot: true },
  [TICKS_PER_QUARTER]: { type: 'quarter', dot: false },
  [0.75 * TICKS_PER_QUARTER]: { type: 'eighth', dot: true },
  [0.5 * TICKS_PER_QUARTER]: { type: 'eighth', dot: false },
  [0.25 * TICKS_PER_QUARTER]: { type: '16th', dot: false },
};

function valueOf(ticks: number): { type: string; dot: boolean } {
  const value = VALUES[ticks];
  if (!value) throw new Error(`no written value of ${ticks} ticks`);
  return value;
}

/** The one staff is the right hand's, for parseMusicXml. */
export function tuneHands(): StaffHands {
  return { [staffKey(0, 1)]: 'right' };
}

/** A key played wrong: which key of the tune it was played for, and the key played. */
export interface WrongKey {
  /** An index into `Tune.notes`. */
  key: number;
  midi: number;
}

/**
 * The beams of a bar's marks: notes shorter than a quarter, one after another within a beat, are
 * joined; the second beam joins neighbouring sixteenths, and a sixteenth alone among eighths gets
 * a hook into the beat. `positions` are ticks from the 1 of the meter.
 */
function beamsOf(
  marks: readonly TuneMark[],
  positions: readonly number[],
  beat: number,
): string[][] {
  const out = marks.map(() => [] as string[]);
  const beamable = (m: TuneMark) => m.pitch !== null && m.duration < TICKS_PER_QUARTER;
  const beatOf = (i: number) => Math.floor(positions[i]! / beat);
  const groups: number[][] = [];
  marks.forEach((m, i) => {
    if (!beamable(m)) return;
    const last = groups.at(-1);
    if (last && last.at(-1) === i - 1 && beatOf(i - 1) === beatOf(i)) last.push(i);
    else groups.push([i]);
  });
  const sixteenth = (i: number | undefined) =>
    i !== undefined && marks[i]!.duration === TICKS_PER_QUARTER / 4;
  for (const group of groups) {
    if (group.length < 2) continue;
    group.forEach((i, k) => {
      const value = k === 0 ? 'begin' : k === group.length - 1 ? 'end' : 'continue';
      out[i]!.push(`<beam number="1">${value}</beam>`);
    });
    group.forEach((i, k) => {
      if (!sixteenth(i)) return;
      const prev = sixteenth(group[k - 1]);
      const next = sixteenth(group[k + 1]);
      const value =
        prev && next
          ? 'continue'
          : next
            ? 'begin'
            : prev
              ? 'end'
              : k === group.length - 1
                ? 'backward hook'
                : 'forward hook';
      out[i]!.push(`<beam number="2">${value}</beam>`);
    });
  }
  return out;
}

const pitchXml = ({ step, alter, octave }: SpelledPitch) =>
  `<pitch><step>${step}</step>${alter !== 0 ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>`;

/**
 * MusicXML 4.0 (partwise) for phrase `phrase` (0-based) of the tune in the key `semitones` from
 * the written one; with `wrong`, the key played wrong stands with the note it was played for.
 */
export function tunePhraseXml(
  tune: Tune,
  phrase: number,
  semitones: number,
  wrong: WrongKey | null = null,
): string {
  const span = tune.phrases[phrase];
  if (!span) throw new RangeError(`${tune.id} has no phrase ${phrase + 1}`);
  const first = tune.notes[span.from]!;
  const last = tune.notes[span.to - 1]!;
  const start = first.onset;
  const end = last.onset + last.duration;
  const fifths = tuneFifths(tune, semitones);
  const key: MelodyKey = tuneKey(tune, semitones);
  const inKey = keyAlters(fifths);
  const full = barTicks(tune);
  const beat = beatTicks(tune);
  const measures: string[] = [];

  for (const bar of tune.bars) {
    const from = Math.max(bar.start, start);
    const to = Math.min(bar.start + bar.duration, end);
    if (from >= to) continue;
    const marks = tune.marks.filter((m) => m.onset >= from && m.onset < to);
    const positions = marks.map((m) => bar.offset + m.onset - bar.start);
    const beams = beamsOf(marks, positions, beat);
    // The signs in force in the bar, by letter and octave.
    const inForce = new Map<string, number>();
    const sign = (pitch: SpelledPitch, always = false) => {
      const place = `${pitch.step}${pitch.octave}`;
      const shown = always || pitch.alter !== (inForce.get(place) ?? inKey[pitch.step]);
      return shown ? `<accidental>${ACCIDENTALS[pitch.alter]}</accidental>` : '';
    };
    const notes = marks.map((m, i) => {
      const { type, dot } = valueOf(m.duration);
      const value = `<duration>${divisions(m.duration)}</duration>`;
      const written = `<voice>1</voice><type>${type}</type>${dot ? '<dot/>' : ''}`;
      if (m.pitch === null) return `<note><rest/>${value}${written}<staff>1</staff></note>`;
      const pitch = tunePitch(tune, m.pitch, semitones);
      // The key played, with its own sign: it changes nothing of what follows.
      const played =
        wrong && wrong.key === m.key && !m.tieStop ? spellInKey(wrong.midi, key) : null;
      // On the note's own line or space, both are given their sign: one could not tell them else.
      const clash = played?.step === pitch.step && played.octave === pitch.octave;
      const accidental = m.tieStop ? '' : sign(pitch, clash);
      inForce.set(`${pitch.step}${pitch.octave}`, pitch.alter);
      const ties =
        (m.tieStop ? '<tie type="stop"/>' : '') + (m.tieStart ? '<tie type="start"/>' : '');
      const tied =
        (m.tieStop ? '<tied type="stop"/>' : '') + (m.tieStart ? '<tied type="start"/>' : '');
      let out =
        `<note>${pitchXml(pitch)}${value}${ties}${written}${accidental}<staff>1</staff>` +
        `${beams[i]!.join('')}${tied ? `<notations>${tied}</notations>` : ''}</note>`;
      if (played) {
        const shown = clash || played.alter !== inKey[played.step];
        out +=
          `<note><chord/>${pitchXml(played)}${value}${written}` +
          `${shown ? `<accidental>${ACCIDENTALS[played.alter]}</accidental>` : ''}<staff>1</staff></note>`;
      }
      return out;
    });
    const attributes =
      measures.length === 0
        ? `<attributes><divisions>${DIVISIONS}</divisions>` +
          `<key><fifths>${fifths}</fifths><mode>major</mode></key>` +
          `<time><beats>${tune.beats}</beats><beat-type>${tune.beatType}</beat-type></time>` +
          '<clef><sign>G</sign><line>2</line></clef></attributes>'
        : '';
    const short = to - from < full;
    measures.push(
      `<measure number="${measures.length + 1}"${short ? ' implicit="yes"' : ''}>` +
        `${attributes}${notes.join('')}</measure>`,
    );
  }
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<score-partwise version="4.0">' +
    '<part-list><score-part id="P1"><part-name print-object="no">Tune</part-name></score-part></part-list>' +
    `<part id="P1">${measures.join('\n')}</part>` +
    '</score-partwise>\n'
  );
}

/**
 * How the notes of a phrase drawn by `tunePhraseXml` (and read back as `score`) are inked after a
 * wrong answer: the keys played right before it `is-pressed`, the key played wrong `is-missed`.
 * Keyed by the score's note ids, for ScoreView.
 */
export function tuneInk(
  score: Pick<Score, 'notes'>,
  tune: Tune,
  phrase: number,
  semitones: number,
  wrong: WrongKey,
): Map<string, string> {
  const span = tune.phrases[phrase]!;
  const start = tune.notes[span.from]!.onset;
  const asked = tune.notes[wrong.key];
  const ink = new Map<string, string>();
  for (const note of score.notes) {
    const at = note.onset + start;
    if (asked && at === asked.onset && note.midi === wrong.midi) {
      ink.set(note.id, 'is-missed');
      continue;
    }
    // A tied note belongs to the key it continues.
    const key = tune.notes.findIndex(
      (n, i) => i >= span.from && i < span.to && at >= n.onset && at < n.onset + n.duration,
    );
    if (key !== -1 && key < wrong.key && note.midi === tune.notes[key]!.midi + semitones)
      ink.set(note.id, 'is-pressed');
  }
  return ink;
}
