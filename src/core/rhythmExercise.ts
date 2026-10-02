// A rhythm exercise on Read (docs/READING.md, "Rhythm (R1)"): four bars of cells in one meter
// (two in R9–R10 at first), chosen by the item model, and a note on the downbeat of the bar after
// them, so a run ends on a beat. From it come the onsets in exact ticks and rhythm mode's plan
// (core/rhythm.ts), which times the taps as it times a piece.

import { performanceOrder } from './repeats.ts';
import { rhythmPlan, type RhythmPlan } from './rhythm.ts';
import {
  barTicksOf,
  beatTicksOf,
  beatsPerBar,
  cellBeats,
  cellLines,
  endsWithNote,
  fitsAt,
  getRhythmLevel,
  R10_CROSS,
  rhythmItem,
  startsWithNote,
  cellOnsets,
  type CellNote,
  type RhythmLevel,
  type RhythmLevelId,
  type RhythmMeter,
} from './rhythmCells.ts';
import type { Rng } from './random.ts';
import { TICKS_PER_QUARTER, type Measure, type Step, type TempoMark } from './score.ts';
import { noteWeight, pickWeighted, type StatsByKey } from './weakness.ts';

/** Bars of cells in an exercise; the two-hand levels start with two. */
export const EXERCISE_BARS = 4;
export const HANDS_FIRST_BARS = 2;
/**
 * R9–R10 play two bars (and R10 keeps to rhythms without triplets) until this many cells of the
 * level have been played: the level's mastery window.
 */
export const HANDS_WARMUP_CELLS = 40;
/** The cells a level adds are drawn this many times as often as the earlier levels' ones. */
export const NEW_CELL_WEIGHT = 3;
/**
 * The item model's "speed" target: a cell played right is weighted by how far its onsets were
 * from the beat on average (its unevenness), against half of `IN_TIME_MS`.
 */
export const RHYTHM_TARGET_MS = 25;
/** Never the same cell more than this many times in a row. */
export const MAX_REPEATS = 2;
/**
 * A cell with nothing to play (a rest, a note held on by a tie) is drawn this much as often as
 * the others, and never right after another: a line is for reading notes, and a bar of rests
 * teaches nothing about rhythm.
 */
export const SILENT_WEIGHT = 1 / 3;

/** A note or rest of an exercise, placed in time. */
export interface PlacedNote extends CellNote {
  /** Ticks from the start of the exercise. */
  tick: number;
  /** Index into `RhythmExercise.cells`; -1 for the final note. */
  cell: number;
  /** Tied to the next note of its line (in its cell or the next). */
  tie: boolean;
}

export interface PlacedCell {
  key: string;
  item: string;
  /** Ticks from the start of the exercise. */
  start: number;
  ticks: number;
  bar: number;
}

export interface RhythmExercise {
  level: RhythmLevelId;
  meter: RhythmMeter;
  /** Bars of cells; the final note is on the downbeat of the bar after them. */
  bars: number;
  cells: PlacedCell[];
  /** One list per line (the right hand's first), in time order, the final note last. */
  lines: PlacedNote[][];
}

/** The note a bar of `meter` is filled with at the end: the exercise's final note. */
function finalNote(meter: RhythmMeter): Pick<CellNote, 'type' | 'dot'> {
  if (meter === '4/4') return { type: 'whole', dot: false };
  if (meter === '2/4') return { type: 'half', dot: false };
  return { type: 'half', dot: true };
}

/** Places cells (keys, in order, whole bars of `meter`) as an exercise. */
export function buildExercise(
  level: RhythmLevelId,
  meter: RhythmMeter,
  keys: readonly string[],
): RhythmExercise {
  const beat = beatTicksOf(meter);
  const bar = barTicksOf(meter);
  const cells: PlacedCell[] = [];
  const lineCount = getRhythmLevel(level).hands ? 2 : 1;
  const lines: PlacedNote[][] = Array.from({ length: lineCount }, () => []);
  let tick = 0;
  keys.forEach((key, index) => {
    const ticks = cellBeats(key) * beat;
    cells.push({
      key,
      item: rhythmItem(key, meter),
      start: tick,
      ticks,
      bar: Math.floor(tick / bar),
    });
    cellLines(key).forEach((notes, l) => {
      const line = lines[l]!;
      let at = tick;
      for (const n of notes) {
        // A note tied from the one before: that one is tied to it.
        if (n.tied && line.length > 0) line[line.length - 1]!.tie = true;
        line.push({ ...n, tick: at, cell: index });
        at += n.ticks;
      }
    });
    tick += ticks;
  });
  if (tick % bar !== 0) throw new RangeError(`Cells end inside a bar: ${keys.join(' ')}`);
  const end = finalNote(meter);
  for (const line of lines)
    line.push({
      ...end,
      rest: false,
      triplet: false,
      tied: false,
      tie: false,
      ticks: bar,
      tick,
      cell: -1,
    });
  return { level, meter, bars: tick / bar, cells, lines };
}

export interface DrawOptions {
  level: RhythmLevel;
  meter: RhythmMeter;
  bars: number;
  /** Per-item stats of the player's cells (`rhythmStats`). */
  stats: StatsByKey;
  rng: Rng;
  /** R10 before its warm-up is done: no two against three yet. */
  cross?: boolean;
  /**
   * The first cell starts with a note (the default, a line's rule). Rhythm dictation lets a bar
   * start with a rest: after its count-in the rest is heard.
   */
  startWithNote?: boolean;
  /** The item a cell is weighted by: `rhythm:<cell>:<meter>` unless given (dictation's own). */
  itemOf?: (cell: string, meter: RhythmMeter) => string;
  /**
   * Cells to work on ("Practise these", docs/ADVICE.md): wherever one of them can stand it is one
   * of them that is drawn, by the same weights; the level's other cells fill what they cannot.
   */
  focus?: readonly string[];
}

/**
 * Draws an exercise, bar by bar and cell by cell: each cell from those of the level that fit where
 * it starts, favouring the ones missed or played unevenly (the weakness model, keyed by item) and
 * the level's own new ones, a third as often those with nothing to play; never the same cell
 * three times in a row, nor two with nothing to play. A cell tied from the one before needs a note
 * there to tie from and never follows another tie; the first cell starts with a note (R7 starts
 * half of its exercises off the beat, with `er-e`); and every bar has a note to play. With cells
 * to work on (`focus`), those come first wherever the same rules let one stand.
 */
export function drawExercise(options: DrawOptions): RhythmExercise {
  const { level, meter, bars, stats, rng } = options;
  const cross = options.cross ?? true;
  const startWithNote = options.startWithNote ?? true;
  const itemOf = options.itemOf ?? rhythmItem;
  const focus = new Set(options.focus ?? []);
  const pool = level.cells.filter((key) => cross || !key.split('|').includes(R10_CROSS));
  const perBar = beatsPerBar(meter);
  const keys: string[] = [];
  const offBeat = level.offBeat && rng() < 0.5;
  for (let b = 0; b < bars; b++) {
    let at = 0;
    let played = false;
    while (at < perBar) {
      const previous = keys.at(-1) ?? null;
      const fits = pool.filter((key) => fitsAt(key, meter, at));
      // What a line must be: a tie needs a note before it to tie from, and never follows a tie;
      // the first cell starts with a note.
      const possible = fits.filter((key) => {
        if (key.startsWith('~'))
          return previous !== null && !previous.startsWith('~') && endsWithNote(previous);
        return keys.length > 0 || !startWithNote || startsWithNote(key);
      });
      // What it should be, unless nothing else fits: no cell three times in a row, no two
      // cells in a row with nothing to play, and a note to play in every bar.
      const preferred = possible.filter((key) => {
        if (keys.length >= MAX_REPEATS && keys.slice(-MAX_REPEATS).every((k) => k === key))
          return false;
        const sounds = hasOnset(key, meter);
        if (!sounds && previous !== null && !hasOnset(previous, meter)) return false;
        const last = at + cellBeats(key) >= perBar;
        return !last || played || sounds;
      });
      const allowed = preferred.length > 0 ? preferred : possible;
      const wanted = allowed.filter((key) => focus.has(key));
      let key: string;
      if (keys.length === 0 && offBeat && fits.includes('er-e')) key = 'er-e';
      else
        key = pickWeighted(
          wanted.length > 0 ? wanted : allowed,
          (k) =>
            noteWeight(stats[itemOf(k, meter)], RHYTHM_TARGET_MS) *
            (level.adds.includes(k) ? NEW_CELL_WEIGHT : 1) *
            (hasOnset(k, meter) ? 1 : SILENT_WEIGHT),
          rng,
        );
      if (hasOnset(key, meter)) played = true;
      keys.push(key);
      at += cellBeats(key);
    }
  }
  return buildExercise(level.id, meter, keys);
}

function hasOnset(key: string, meter: RhythmMeter): boolean {
  return cellOnsets(key, meter).some((line) => line.length > 0);
}

// --- Onsets ----------------------------------------------------------------------------------

/** A note struck: a key is due. */
export interface Onset {
  /** 0: the right hand's (or the only) line; 1: the left hand's. */
  line: number;
  tick: number;
  /** Index into the exercise's cells; -1 for the final note. */
  cell: number;
}

/** Every onset, in time order, the right hand's first where both hands strike together. */
export function exerciseOnsets(exercise: RhythmExercise): Onset[] {
  const out: Onset[] = [];
  exercise.lines.forEach((notes, line) => {
    for (const n of notes) if (!n.rest && !n.tied) out.push({ line, tick: n.tick, cell: n.cell });
  });
  return out.sort((a, b) => a.tick - b.tick || a.line - b.line);
}

// --- Counts ----------------------------------------------------------------------------------

/** The words of a count that are not numbers or letters: the syllables of a triplet. */
export interface CountWords {
  trip: string;
  let: string;
}

export interface Count {
  /** Ticks from the start of the exercise. */
  tick: number;
  /** "1", "e", "&", "a", the triplet's words; bracketed when held: "(2)". */
  text: string;
  /** Counted but not played on: written in brackets, "1 (2) & 3". */
  held: boolean;
}

/** The text of a count `offset` ticks into a beat of simple time: e, &, a, trip, let. */
function subCount(offset: number, words: CountWords): string {
  const q = TICKS_PER_QUARTER;
  if (offset === q / 3) return words.trip;
  if (offset === (2 * q) / 3) return words.let;
  if (offset === q / 4) return 'e';
  if (offset === (3 * q) / 4) return 'a';
  return '&';
}

/**
 * The counts under the line, beat by beat, as lesson 8 writes them: each beat divided as finely
 * as the notes and rests starting in it need ("1", "1 &", "1 trip let", "1 e & a"; in 6/8 "1 2 3"
 * by the eighth), the counts where nothing is struck in brackets. Both hands' notes count; a beat
 * of two against three is counted where something starts, "1 trip & let". The final note is "1".
 */
export function exerciseCounts(exercise: RhythmExercise, words: CountWords): Count[] {
  const { meter } = exercise;
  const beat = beatTicksOf(meter);
  const bar = barTicksOf(meter);
  const notes = exercise.lines.flat();
  const struck = new Set(notes.filter((n) => !n.rest && !n.tied).map((n) => n.tick));
  const starts = [...new Set(notes.map((n) => n.tick))];
  /** One count of the time signature: a quarter, or an eighth in 6/8. */
  const count = meter === '6/8' ? TICKS_PER_QUARTER / 2 : TICKS_PER_QUARTER;
  const q = TICKS_PER_QUARTER;
  const steps = meter === '6/8' ? [beat, count, count / 2] : [q, q / 2, q / 3, q / 4];
  const text = (t: number) => {
    const inBar = t % bar;
    if (inBar % count === 0) return String(inBar / count + 1);
    return meter === '6/8' ? '&' : subCount(inBar % count, words);
  };
  const out: Count[] = [];
  const add = (t: number) => {
    const held = !struck.has(t);
    out.push({ tick: t, text: held ? `(${text(t)})` : text(t), held });
  };
  for (let from = 0; from < exercise.bars * bar; from += beat) {
    const offsets = starts.filter((t) => t >= from && t < from + beat).map((t) => t - from);
    const step = steps.find((s) => offsets.every((o) => o % s === 0));
    if (step === undefined) {
      // Thirds and halves at once (two against three): only where something starts.
      for (const o of [...new Set([0, ...offsets])].sort((a, b) => a - b)) add(from + o);
    } else {
      for (let t = from; t < from + beat; t += step) add(t);
    }
  }
  add(exercise.bars * bar);
  return out;
}

/**
 * The key each line is matched as, as rhythm mode sees it: the pitch its notes are written at on
 * a one-line staff (E4 under a hidden treble clef, G2 under a hidden bass clef; see rhythmXml.ts).
 */
export const LINE_KEYS: readonly number[] = [64, 43];

/** Middle C: in the two-hand levels, the right hand taps from here up and the left below it. */
export const MIDDLE_C = 60;

/** The line a key played belongs to: any key in one line; by the hand in two. */
export function lineOfKey(midi: number, hands: boolean): number {
  return hands && midi < MIDDLE_C ? 1 : 0;
}

/** Quarter notes a minute for `bpm` beats a minute (a beat of 6/8 is a dotted quarter). */
export function quarterBpm(meter: RhythmMeter, bpm: number): number {
  return (bpm * beatTicksOf(meter)) / TICKS_PER_QUARTER;
}

/** Milliseconds per tick at `bpm` beats a minute. */
export function msPerTick(meter: RhythmMeter, bpm: number): number {
  return 60_000 / (quarterBpm(meter, bpm) * TICKS_PER_QUARTER);
}

/**
 * The exercise as rhythm mode's score: its bars, and one more of a single beat for the final
 * note, so the run (and the click) ends a beat after it; the tempo mark at the start.
 */
export function exerciseScore(
  exercise: RhythmExercise,
  bpm: number,
): { measures: Measure[]; tempos: TempoMark[] } {
  const [beats, beatType] = exercise.meter.split('/').map(Number) as [number, number];
  const bar = barTicksOf(exercise.meter);
  const measures = Array.from({ length: exercise.bars + 1 }, (_, index): Measure => ({
    index,
    number: String(index + 1),
    start: index * bar,
    duration: index < exercise.bars ? bar : beatTicksOf(exercise.meter),
    beats,
    beatType,
    repeat: { forward: false, backwardTimes: null, ending: [] },
    jumps: [],
  }));
  return { measures, tempos: [{ tick: 0, bpm: quarterBpm(exercise.meter, bpm) }] };
}

/** The onsets grouped into steps (the keys due together), in time order. */
export function exerciseSteps(exercise: RhythmExercise): Step[] {
  const bar = barTicksOf(exercise.meter);
  const beat = beatTicksOf(exercise.meter);
  const byTick = new Map<number, Onset[]>();
  for (const onset of exerciseOnsets(exercise)) {
    const list = byTick.get(onset.tick) ?? [];
    list.push(onset);
    byTick.set(onset.tick, list);
  }
  return [...byTick].map(([tick, onsets], index): Step => {
    const measure = Math.floor(tick / bar);
    return {
      index,
      tick,
      played: measure,
      measure,
      pass: 1,
      writtenTick: tick,
      beat: 1 + (tick - measure * bar) / beat,
      midis: [...new Set(onsets.map((o) => LINE_KEYS[o.line]!))].sort((a, b) => a - b),
      noteIds: [],
      heldIds: [],
    };
  });
}

/** Rhythm mode's plan of the exercise at `bpm` beats a minute: count-in, clicks, windows. */
export function exercisePlan(exercise: RhythmExercise, bpm: number): RhythmPlan {
  const score = exerciseScore(exercise, bpm);
  const plan = rhythmPlan({
    score,
    order: performanceOrder(score.measures),
    steps: exerciseSteps(exercise),
    loop: null,
    startBar: 0,
    scale: 1,
  });
  if (!plan) throw new Error('An exercise always has a plan');
  return plan;
}
