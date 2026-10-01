// Playing a tune by ear (docs/HARMONY.md, "Playing by ear (H5)" and its clarifications): the
// melodies of tuneData.ts read into keys, phrases and bars; the key a session is in; what a prompt
// sounds like; and whether stored keys are a phrase of a tune. Pure, so every rule is tested. The
// Ear page and the validators load this module, never the app's start: earItems.ts and
// earSession.ts take a tune's prompt from here through the session's options.

import type { MelodyKey } from './earMelody.ts';
import { signatureTonic, tonicPitch } from './keys.ts';
import { midiOf } from './musicxml.ts';
import { pitchClass, type Letter } from './note.ts';
import type { Rng } from './random.ts';
import { TICKS_PER_QUARTER, type SpelledPitch } from './score.ts';
import { TUNE_SOURCES } from './tuneData.ts';
import { parseTuneItem, WHOLE_TUNE, type TuneId, type TunePart } from './tuneList.ts';
import { MAX_TRANSPOSE, transposedFifths, transposeInterval, transposePitch } from './transpose.ts';

/** A sixteenth: the unit of tuneData.ts's lengths. */
const SIXTEENTH = TICKS_PER_QUARTER / 4;

/** A written note or rest of the melody, as it is drawn. */
export interface TuneMark {
  /** Ticks from the start of the tune as it is sung. */
  onset: number;
  duration: number;
  /** Null: a rest. */
  pitch: SpelledPitch | null;
  /** The key it belongs to (an index into `Tune.notes`); −1 for a rest. */
  key: number;
  /** Tied to the next note of its key. */
  tieStart: boolean;
  /** The continuation of a tie: drawn, not struck. */
  tieStop: boolean;
}

/** A key to play: a written note, or the notes a tie joins. */
export interface TuneNote {
  midi: number;
  pitch: SpelledPitch;
  /** Ticks from the start of the tune as it is sung. */
  onset: number;
  /** As long as it sounds: tied notes together. */
  duration: number;
}

export interface TuneBar {
  /** Ticks from the start of the tune as it is sung. */
  start: number;
  duration: number;
  /**
   * Where in its meter the bar begins, in ticks from the 1: more than 0 for an upbeat bar, which
   * ends on the barline (the first bar, or the second part of a bar divided by a repeat sign).
   */
  offset: number;
}

/** A phrase: its keys `from` up to (not including) `to`, indexes into `Tune.notes`. */
export interface TuneSpan {
  from: number;
  to: number;
}

export interface Tune {
  id: TuneId;
  /** Its key as written: the signature and the tonic of its major key. */
  fifths: number;
  beats: number;
  beatType: number;
  /** Quarter notes a minute. */
  bpm: number;
  notes: readonly TuneNote[];
  marks: readonly TuneMark[];
  bars: readonly TuneBar[];
  phrases: readonly TuneSpan[];
}

/** The length of a full bar of the meter, in ticks. */
export const barTicks = (tune: Pick<Tune, 'beats' | 'beatType'>) =>
  (tune.beats * 4 * TICKS_PER_QUARTER) / tune.beatType;

/** The beat: a dotted quarter in a compound meter (6/8), else the time signature's unit. */
export function beatTicks(tune: Pick<Tune, 'beats' | 'beatType'>): number {
  const unit = (4 * TICKS_PER_QUARTER) / tune.beatType;
  return tune.beatType === 8 && tune.beats % 3 === 0 && tune.beats > 3 ? 3 * unit : unit;
}

function parsePitch(name: string): SpelledPitch | null {
  const match = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!match) return null;
  const alter = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return { step: match[1] as Letter, alter, octave: Number(match[3]) };
}

/** Reads a tune of tuneData.ts; throws on a table it cannot read (a test reads them all). */
export function readTune(id: TuneId): Tune {
  const source = TUNE_SOURCES[id];
  const full = barTicks(source);
  const notes: TuneNote[] = [];
  const marks: TuneMark[] = [];
  const bars: TuneBar[] = [];
  const phrases: TuneSpan[] = [];
  let tick = 0;
  let barStart = 0;
  let tied = false;
  const endBar = () => {
    if (tick === barStart) throw new Error(`${id}: an empty bar`);
    bars.push({ start: barStart, duration: tick - barStart, offset: 0 });
    barStart = tick;
  };
  for (const line of source.phrases) {
    const from = notes.length;
    for (const token of line.split(/\s+/).filter((t) => t !== '')) {
      if (token === '|') {
        endBar();
        continue;
      }
      const match = /^(r|[A-G][#b]?\d)\/(\d+)(~?)$/.exec(token);
      if (!match) throw new Error(`${id}: cannot read ${token}`);
      const duration = Number(match[2]) * SIXTEENTH;
      const tieStart = match[3] === '~';
      if (match[1] === 'r') {
        if (tied || tieStart) throw new Error(`${id}: a tie at a rest`);
        marks.push({
          onset: tick,
          duration,
          pitch: null,
          key: -1,
          tieStart: false,
          tieStop: false,
        });
      } else {
        const pitch = parsePitch(match[1]!)!;
        const midi = midiOf(pitch);
        if (tied) {
          const key = notes.at(-1);
          if (!key || key.midi !== midi) throw new Error(`${id}: a tie between two keys`);
          key.duration += duration;
        } else {
          notes.push({ midi, pitch, onset: tick, duration });
        }
        marks.push({
          onset: tick,
          duration,
          pitch,
          key: notes.length - 1,
          tieStart,
          tieStop: tied,
        });
        tied = tieStart;
      }
      tick += duration;
    }
    if (notes.length === from) throw new Error(`${id}: a phrase without a note`);
    phrases.push({ from, to: notes.length });
  }
  if (tied) throw new Error(`${id}: a tie into nothing`);
  if (tick !== barStart) endBar();
  // An upbeat bar ends on the barline: the first bar, or the second part of a divided bar.
  bars.forEach((bar, i) => {
    const before = bars[i - 1];
    const upbeat =
      bar.duration < full &&
      (i === 0 || (before !== undefined && before.duration + bar.duration === full));
    if (upbeat) bar.offset = full - bar.duration;
  });
  const { fifths, beats, beatType, bpm } = source;
  return { id, fifths, beats, beatType, bpm, notes, marks, bars, phrases };
}

const tunes = new Map<TuneId, Tune>();

/** The tune, read once. */
export function getTune(id: TuneId): Tune {
  let tune = tunes.get(id);
  if (!tune) tunes.set(id, (tune = readTune(id)));
  return tune;
}

/** The keys a part of a tune is: a phrase's, or all of them. */
export function tuneSpan(tune: Tune, part: TunePart): TuneSpan {
  if (part === WHOLE_TUNE) return { from: 0, to: tune.notes.length };
  const span = tune.phrases[part - 1];
  if (!span) throw new RangeError(`${tune.id} has no phrase ${part}`);
  return span;
}

// --- Keys ------------------------------------------------------------------------------------

/**
 * How far a tune may be moved: up to six semitones up or down, as a piece is (transpose.ts). The
 * tunes lie between C4 and F5, so every key is between F♯3 and B5.
 */
export const TUNE_TRANSPOSITIONS: readonly number[] = Array.from(
  { length: 2 * MAX_TRANSPOSE },
  (_, i) => (i < MAX_TRANSPOSE ? i - MAX_TRANSPOSE : i - MAX_TRANSPOSE + 1),
);

/**
 * Another key, each of the eleven as likely as the next. Six semitones up and six down are one
 * key an octave apart, so each of the two is drawn half as often as another distance: of 22 lots
 * the first is six down, the last six up, and every other distance has two.
 */
export function drawTransposition(rng: Rng): number {
  const lots = 2 * (TUNE_TRANSPOSITIONS.length - 1);
  const lot = Math.min(lots - 1, Math.floor(rng() * lots));
  return TUNE_TRANSPOSITIONS[Math.ceil(lot / 2)]!;
}

/** The key signature of the tune moved by `semitones`: the simpler of the two that name it. */
export const tuneFifths = (tune: Pick<Tune, 'fifths'>, semitones: number) =>
  semitones === 0 ? tune.fifths : transposedFifths(tune.fifths, semitones);

/** The key the tune is in when moved by `semitones`, as an answer keeps it. */
export function tuneKey(tune: Pick<Tune, 'fifths'>, semitones: number): MelodyKey {
  return { tonic: signatureTonic(tuneFifths(tune, semitones), 'major'), scale: 'major' };
}

/** A note of the tune as written in the key `semitones` away. */
export function tunePitch(tune: Pick<Tune, 'fifths'>, pitch: SpelledPitch, semitones: number) {
  return semitones === 0 ? pitch : transposePitch(pitch, transposeInterval(tune.fifths, semitones));
}

/** The pitch class of a tune's written tonic. */
const tonicPc = (tune: Pick<Tune, 'fifths'>) =>
  pitchClass(midiOf(tonicPitch(signatureTonic(tune.fifths, 'major'), 4)));

/**
 * The tonic triad that sets the key, in root position: its root the highest tonic that is not
 * above the tune's lowest note, so the chord is the same before every phrase.
 */
export function tuneChord(tune: Tune, semitones: number): number[] {
  const lowest = Math.min(...tune.notes.map((n) => n.midi));
  const root = lowest - ((((lowest - tonicPc(tune)) % 12) + 12) % 12) + semitones;
  return [root, root + 4, root + 7];
}

// --- The prompt ------------------------------------------------------------------------------

/** How much of its length a note sounds, so a key struck again is heard again. */
export const TUNE_NOTE_SHARE = 0.9;

/** A key of a prompt in time: ms from the phrase's first note. */
export interface TuneEvent {
  on: number;
  off: number;
}

/** What a tune's prompt carries while it is live (earItems.ts, `Prompt.tune`). */
export interface TunePrompt {
  tune: TuneId;
  part: TunePart;
  /** Semitones from the written key: 0 in its own key. */
  semitones: number;
  key: MelodyKey;
  /** The tonic triad, low to high. */
  chord: readonly number[];
  /** The rest between the chord and the phrase: a beat of the tune. */
  restMs: number;
  /** When each key of the prompt sounds, from its first note. */
  events: readonly TuneEvent[];
  /** The index (into the prompt's keys) each of its phrases begins at: one for a phrase. */
  starts: readonly number[];
}

const msPerTick = (tune: Pick<Tune, 'bpm'>) => 60_000 / (tune.bpm * TICKS_PER_QUARTER);

/** The keys of a part of the tune in the key `semitones` away, in order. */
export function tuneKeys(tune: Tune, part: TunePart, semitones: number): number[] {
  const { from, to } = tuneSpan(tune, part);
  return tune.notes.slice(from, to).map((n) => n.midi + semitones);
}

/** When the keys `from`–`to` sound, in ms from the first: each in its own rhythm. */
export function tuneEvents(tune: Tune, { from, to }: TuneSpan): TuneEvent[] {
  const ms = msPerTick(tune);
  const origin = tune.notes[from]!.onset;
  return tune.notes.slice(from, to).map((n) => {
    const on = (n.onset - origin) * ms;
    return { on: Math.round(on), off: Math.round(on + n.duration * ms * TUNE_NOTE_SHARE) };
  });
}

/** The prompt of a tune's item, in the key `semitones` from the written one. */
export function tunePrompt(
  item: string,
  semitones: number,
): { item: string; notes: number[]; tune: TunePrompt } {
  const parsed = parseTuneItem(item);
  if (!parsed) throw new RangeError(`Not a tune's item: ${item}`);
  const tune = getTune(parsed.tune);
  const span = tuneSpan(tune, parsed.part);
  const starts =
    parsed.part === WHOLE_TUNE ? tune.phrases.map((phrase) => phrase.from - span.from) : [0];
  return {
    item,
    notes: tuneKeys(tune, parsed.part, semitones),
    tune: {
      tune: tune.id,
      part: parsed.part,
      semitones,
      key: tuneKey(tune, semitones),
      chord: tuneChord(tune, semitones),
      restMs: Math.round(beatTicks(tune) * msPerTick(tune)),
      events: tuneEvents(tune, span),
      starts,
    },
  };
}

/** The phrase (0-based, in the tune) a key of a prompt belongs to. */
export function promptPhrase(prompt: Pick<TunePrompt, 'part' | 'starts'>, index: number): number {
  if (prompt.part !== WHOLE_TUNE) return prompt.part - 1;
  let phrase = 0;
  prompt.starts.forEach((start, i) => {
    if (index >= start) phrase = i;
  });
  return phrase;
}

// --- Stored answers ----------------------------------------------------------------------------

/**
 * How far stored keys are from the item's part of the tune as written: the same number of
 * semitones for every key, at most six either way; null when they are not that part in any key.
 */
export function tuneSemitones(item: string, keys: readonly number[]): number | null {
  const parsed = parseTuneItem(item);
  if (!parsed) return null;
  const written = tuneKeys(getTune(parsed.tune), parsed.part, 0);
  if (keys.length !== written.length) return null;
  const semitones = keys[0]! - written[0]!;
  if (!Number.isInteger(semitones) || Math.abs(semitones) > MAX_TRANSPOSE) return null;
  return keys.every((midi, i) => midi - written[i]! === semitones) ? semitones : null;
}

/**
 * Whether stored keys are the item's part of its tune in `key`: the tune moved by up to six
 * semitones, and the key named as the session names it.
 */
export function tuneFits(item: string, keys: readonly number[], key: unknown): boolean {
  const parsed = parseTuneItem(item);
  const semitones = tuneSemitones(item, keys);
  if (!parsed || semitones === null) return false;
  if (typeof key !== 'object' || key === null || Array.isArray(key)) return false;
  const { tonic, scale } = key as Record<string, unknown>;
  const own = tuneKey(getTune(parsed.tune), semitones);
  return Object.keys(key).length === 2 && tonic === own.tonic && scale === own.scale;
}
