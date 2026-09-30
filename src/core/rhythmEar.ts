// Rhythm dictation, a family of the Ear page (docs/READING.md, "Rhythm dictation (R2, on Ear)"
// and "Clarifications (decided during R2)"): one bar of Rhythm's cells played on one key after a
// bar of count-in, then either tapped back after a second count-in (judged as Rhythm on Read
// judges a line) or chosen among bars written out that differ from it in one cell. The items are
// Rhythm's cells in a meter (`rhythmEar:<cell>:<meter>`), the levels R1–R8. Pure, so every rule
// is unit-tested; the run itself is rhythm mode's (`output/rhythm.ts`) on a plan made here.
//
// As in `session.ts`, `time` values are milliseconds on the performance.now() timeline (or on a
// run's clock, from the prompt's downbeat) and `at` values epoch ms, which is what gets stored.

import { activeTime } from './activity.ts';
import type { Click } from './metronome.ts';
import { RELEASE_GAP_MS, type DemoPlan } from './playback.ts';
import type { Rng } from './random.ts';
import { matchWindow, MIN_WINDOW_MS, type RhythmPlan, type StepTiming } from './rhythm.ts';
import {
  beatsPerBar,
  beatTicksOf,
  cellBeats,
  cellOnsets,
  CELLS,
  endsWithNote,
  fitsAt,
  getRhythmLevel,
  isCellKey,
  isRhythmMeter,
  RHYTHM_LEVELS,
  rhythmItemInLevel,
  type RhythmLevel,
  type RhythmLevelId,
  type RhythmMeter,
} from './rhythmCells.ts';
import {
  buildExercise,
  drawExercise,
  LINE_KEYS,
  msPerTick,
  RHYTHM_TARGET_MS,
  type PlacedNote,
} from './rhythmExercise.ts';
import { judgeCell, wholeMs } from './rhythmRead.ts';
import { TENDENCY_TRIM } from './rhythmRun.ts';
import { trimmedMean } from './robust.ts';
import { median, TIMEOUT_MS } from './session.ts';
import {
  noteWeight,
  pickWeighted,
  statsFromAttempts,
  type NoteStats,
  type StatsByKey,
} from './weakness.ts';

export const RHYTHM_EAR_FAMILY = 'rhythmEar';
export type RhythmEarFamily = typeof RHYTHM_EAR_FAMILY;
export const isRhythmEarFamily = (v: unknown): v is RhythmEarFamily => v === RHYTHM_EAR_FAMILY;

/** How a bar is answered: tapped back on the keys (`play`), or chosen among bars (`name`). */
export type RhythmEarMode = 'play' | 'name';
export const RHYTHM_EAR_MODES: readonly RhythmEarMode[] = ['play', 'name'];

// --- Levels ----------------------------------------------------------------------------------

/** Rhythm's levels but the two-hand ones: one bar on one key has one line. */
export type RhythmEarLevelId = Exclude<RhythmLevelId, 'R9' | 'R10'>;
export const RHYTHM_EAR_LEVELS: readonly RhythmLevel[] = RHYTHM_LEVELS.filter((l) => !l.hands);
export const RHYTHM_EAR_LEVEL_IDS = RHYTHM_EAR_LEVELS.map((l) => l.id) as RhythmEarLevelId[];

/** Every cell of the family, in the order the levels add them. */
export const RHYTHM_EAR_CELLS: readonly string[] = [
  ...new Set(RHYTHM_EAR_LEVELS.flatMap((l) => l.adds)),
];

export const isRhythmEarLevelId = (v: unknown): v is RhythmEarLevelId =>
  (RHYTHM_EAR_LEVEL_IDS as readonly unknown[]).includes(v);

export function nextRhythmEarLevel(id: RhythmEarLevelId): RhythmEarLevelId | null {
  return RHYTHM_EAR_LEVEL_IDS[RHYTHM_EAR_LEVEL_IDS.indexOf(id) + 1] ?? null;
}

// --- Items -----------------------------------------------------------------------------------

/** `rhythmEar:<cell>:<meter>`: `rhythmEar:ed-s:4/4`, `rhythmEar:c:qe:6/8`. */
export function rhythmEarItem(cell: string, meter: RhythmMeter): string {
  return `rhythmEar:${cell}:${meter}`;
}

/** An item's cell (one line's: no two-hand cells here) and meter; null when unknown. */
export function parseRhythmEarItem(item: unknown): { cell: string; meter: RhythmMeter } | null {
  if (typeof item !== 'string' || !item.startsWith('rhythmEar:')) return null;
  const at = item.lastIndexOf(':');
  const cell = item.slice('rhythmEar:'.length, at);
  const meter = item.slice(at + 1);
  if (!isRhythmMeter(meter) || !isCellKey(cell)) return null;
  return { cell, meter };
}

/** Whether `item` is one of `level`'s: a cell of the level in one of its meters. */
export function isRhythmEarItemOf(level: RhythmEarLevelId, item: string): boolean {
  const parsed = parseRhythmEarItem(item);
  return parsed !== null && rhythmItemInLevel(getRhythmLevel(level), parsed.cell, parsed.meter);
}

/** Every item of a level, cell by cell in the order the levels add them, then by meter. */
export function rhythmEarItems(level: RhythmEarLevelId): string[] {
  const l = getRhythmLevel(level);
  return l.cells.flatMap((cell) =>
    l.meters.filter((m) => rhythmItemInLevel(l, cell, m)).map((m) => rhythmEarItem(cell, m)),
  );
}

// --- Bars ------------------------------------------------------------------------------------

/** Whether a cell has a note struck in it (a rest, a note held on by a tie, have none). */
export const hasOnset = (cell: string, meter: RhythmMeter): boolean =>
  cellOnsets(cell, meter)[0]!.length > 0;

/** The notes and rests of one bar of cells, placed in ticks (ties joined across cells). */
export function barNotes(cells: readonly string[], meter: RhythmMeter): PlacedNote[] {
  // Any level of one line places cells alike.
  return buildExercise('R1', meter, cells).lines[0]!.filter((n) => n.cell >= 0);
}

/** Where each cell starts, in beats of the meter. */
export function cellStarts(cells: readonly string[]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const cell of cells) {
    out.push(at);
    at += cellBeats(cell);
  }
  return out;
}

/**
 * Whether `cells` make a bar `level` could ask in `meter`: each cell the level's and fitting
 * where it starts, the bar filled, a tie only after a note and never after another tie, never two
 * cells in a row with nothing to play, and a note to play somewhere. The rules of Rhythm's lines
 * (docs/READING.md, R1), except that a bar may start with a rest.
 */
export function isBarOf(level: RhythmLevel, meter: RhythmMeter, cells: readonly string[]): boolean {
  if (!level.meters.includes(meter) || cells.length === 0) return false;
  let at = 0;
  let sounds = false;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if (!level.cells.includes(cell) || !fitsAt(cell, meter, at)) return false;
    const previous = cells[i - 1];
    if (cell.startsWith('~')) {
      if (previous === undefined || previous.startsWith('~') || !endsWithNote(previous))
        return false;
    }
    const struck = hasOnset(cell, meter);
    if (!struck && previous !== undefined && !hasOnset(previous, meter)) return false;
    sounds ||= struck;
    at += cellBeats(cell);
  }
  return sounds && at === beatsPerBar(meter);
}

/** What a bar sounds like: each struck note's start and end, in ticks, a tie's notes as one. */
export function barSound(cells: readonly string[], meter: RhythmMeter): [number, number][] {
  const out: [number, number][] = [];
  for (const n of barNotes(cells, meter)) {
    if (n.rest) continue;
    const last = out.at(-1);
    if (n.tied && last && last[1] === n.tick) last[1] = n.tick + n.ticks;
    else if (!n.tied) out.push([n.tick, n.tick + n.ticks]);
  }
  return out;
}

export function sameSound(a: readonly (readonly number[])[], b: readonly (readonly number[])[]) {
  return (
    a.length === b.length && a.every((span, i) => span[0] === b[i]![0] && span[1] === b[i]![1])
  );
}

/** A bar is drawn again at most this often before the drawing gives up on a rule. */
const MAX_DRAWS = 200;

/**
 * Draws a bar as Rhythm draws a line's bar, by the item model keyed by this family's items (the
 * cells missed or tapped unevenly first, the level's new ones three times as often, those with
 * nothing to play a third as often), except that it may start with a rest.
 */
export function drawBar(
  level: RhythmLevel,
  meter: RhythmMeter,
  stats: StatsByKey,
  rng: Rng,
): string[] {
  let cells: string[] = [];
  for (let i = 0; i < MAX_DRAWS; i++) {
    cells = drawExercise({
      level,
      meter,
      bars: 1,
      stats,
      rng,
      startWithNote: false,
      itemOf: rhythmEarItem,
    }).cells.map((c) => c.key);
    if (isBarOf(level, meter, cells)) return cells;
  }
  return cells;
}

// --- Choose it -------------------------------------------------------------------------------

/**
 * What a cell is heard as first, before the learner's own confusions say otherwise: the spec's
 * pair (docs/READING.md, R2: a triplet heard as two eighths); every other pair by how near their
 * onsets are (`onsetDistance`).
 */
export const HEARD_AS: Readonly<Record<string, readonly string[]>> = { trip: ['ee'] };

/**
 * How far apart two cells of one length sound: each onset's distance, in beats, to the nearest of
 * the other's, summed both ways. A cell with no onset against one with some is far (2); two with
 * none (a rest and a note held on) are near but not alike (0.5).
 */
export function onsetDistance(a: string, b: string, meter: RhythmMeter): number {
  const [x] = cellOnsets(a, meter) as [number[]];
  const [y] = cellOnsets(b, meter) as [number[]];
  if (x.length === 0 && y.length === 0) return 0.5;
  if (x.length === 0 || y.length === 0) return 2;
  const near = (v: number, list: number[]) => Math.min(...list.map((w) => Math.abs(v - w)));
  return x.reduce((s, v) => s + near(v, y), 0) + y.reduce((s, v) => s + near(v, x), 0);
}

/** Counts of what each cell was answered as (chosen or tapped as), by cell asked. */
export type CellConfusions = ReadonlyMap<string, ReadonlyMap<string, number>>;

/** A bar that differs from the one played in one cell. */
export interface CellChange {
  position: number;
  cell: string;
  cells: string[];
}

/**
 * Every bar that differs from `bar` in exactly one cell, as the level could ask it: a cell of the
 * same length, fitting where it starts, that leaves the bar one of the level's (`isBarOf`) and
 * does not sound like it (`h` for `q` tied to `q`, `tie-q-e` for `e-q-e` are never offered).
 */
export function oneCellChanges(
  level: RhythmLevel,
  meter: RhythmMeter,
  bar: readonly string[],
): CellChange[] {
  const sound = barSound(bar, meter);
  const starts = cellStarts(bar);
  const out: CellChange[] = [];
  bar.forEach((key, position) => {
    for (const cell of level.cells) {
      if (cell === key || cellBeats(cell) !== cellBeats(key)) continue;
      if (!fitsAt(cell, meter, starts[position]!)) continue;
      const cells = bar.with(position, cell);
      if (!isBarOf(level, meter, cells) || sameSound(barSound(cells, meter), sound)) continue;
      out.push({ position, cell, cells });
    }
  });
  return out;
}

/** Choose it offers the bar played among at most this many others. */
export const MAX_DISTRACTORS = 3;
/** … and at least this many: three or four bars in all. */
export const MIN_DISTRACTORS = 2;

export interface ChoiceQuestion {
  /** The position of the cell asked about in the bar played. */
  target: number;
  /** The bars offered, in the order shown; one of them is the bar played. */
  choices: string[][];
  /** Index of the bar played among the choices. */
  right: number;
}

/**
 * The bars to choose from: the bar played and two or three that differ from it in one cell. They
 * change the cell asked about (`target`) first, the cells the learner has answered it as most
 * often first, then what it is heard as (`HEARD_AS`, then the nearest onsets); only where too few
 * cells can stand there do they change another cell. No two of them sound alike. Null when fewer
 * than two can be offered, or none changes the cell asked about.
 */
export function choiceQuestion(
  level: RhythmLevel,
  meter: RhythmMeter,
  bar: readonly string[],
  target: number,
  confusions: CellConfusions,
  rng: Rng,
): ChoiceQuestion | null {
  const changes = oneCellChanges(level, meter, bar);
  const noise = new Map(changes.map((c) => [c, rng()]));
  const rank = (a: CellChange, b: CellChange) => {
    const asked = (c: CellChange) => bar[c.position]!;
    const count = (c: CellChange) => confusions.get(asked(c))?.get(c.cell) ?? 0;
    const seed = (c: CellChange) => {
      const i = HEARD_AS[asked(c)]?.indexOf(c.cell) ?? -1;
      return i === -1 ? Number.POSITIVE_INFINITY : i;
    };
    return (
      count(b) - count(a) ||
      seed(a) - seed(b) ||
      onsetDistance(asked(a), a.cell, meter) - onsetDistance(asked(b), b.cell, meter) ||
      noise.get(a)! - noise.get(b)!
    );
  };
  const ordered = [
    ...changes.filter((c) => c.position === target).sort(rank),
    ...changes.filter((c) => c.position !== target).sort(rank),
  ];
  const picked: CellChange[] = [];
  const sounds = [barSound(bar, meter)];
  for (const change of ordered) {
    if (picked.length === MAX_DISTRACTORS) break;
    const sound = barSound(change.cells, meter);
    if (sounds.some((s) => sameSound(s, sound))) continue;
    picked.push(change);
    sounds.push(sound);
  }
  if (picked.length < MIN_DISTRACTORS || !picked.some((c) => c.position === target)) return null;
  const choices = [[...bar], ...picked.map((c) => c.cells)];
  // Shuffled, the bar played among them.
  const order = choices.map((_, i) => ({ i, key: rng() })).sort((a, b) => a.key - b.key);
  return {
    target,
    choices: order.map(({ i }) => choices[i]!),
    right: order.findIndex(({ i }) => i === 0),
  };
}

// --- The prompt ------------------------------------------------------------------------------

/** E4: the key the bar is played on (the note of Rhythm's one-line staff). */
export const PROMPT_KEY = LINE_KEYS[0]!;

/** A run of the prompt: rhythm mode's plan (count-in, clicks, steps) and the notes it plays. */
export interface DictationRun {
  plan: RhythmPlan;
  /** The bar, on `PROMPT_KEY`, as the run's backing. */
  backing: DemoPlan;
  /** Ms from the prompt's downbeat to its last note-on: a choice counts from here. */
  lastOn: number;
  /**
   * Tap it back: the bar tapped, from its downbeat, and the span of it a tap is judged in (from
   * the downbeat's window to just before the next downbeat). Null for the prompt alone.
   */
  answer: { start: number; from: number; to: number } | null;
  beatMs: number;
  barMs: number;
}

const exact = (ms: number) => Math.round(ms * 1000) / 1000;

/**
 * The run of a question, its clock from the prompt's downbeat: a bar of count-in, the bar played
 * on one key with no click under it, and with `tapBack` a second bar of count-in and the bar to
 * tap (the click going on under it), whose onsets are the steps.
 */
export function dictationRun(
  bar: readonly string[],
  meter: RhythmMeter,
  bpm: number,
  tapBack: boolean,
): DictationRun {
  const perTick = msPerTick(meter, bpm);
  // The beat is the tempo's (a dotted quarter in 6/8).
  const beatMs = 60_000 / bpm;
  const beats = beatsPerBar(meter);
  const barMs = exact(beats * beatMs);
  const barClicks = (bar: number): Click[] =>
    Array.from({ length: beats }, (_, k) => ({
      at: exact((bar * beats + k) * beatMs),
      accent: k === 0,
    }));
  const countIn = barClicks(-1);
  const clicks = tapBack ? [...barClicks(1), ...barClicks(2)] : [];

  const sound = barSound(bar, meter);
  const notes = sound.map(([from, to]) => {
    const on = exact(from * perTick);
    const end = to * perTick;
    return { midi: PROMPT_KEY, on, off: exact(end - Math.min(RELEASE_GAP_MS, (end - on) / 4)) };
  });
  const lastOn = notes.at(-1)?.on ?? 0;
  const length = exact((tapBack ? 3 : 1) * barMs);

  const start = exact(2 * barMs);
  const times = tapBack ? sound.map(([from]) => exact(start + from * perTick)) : [];
  const steps = times.map((at, i) => {
    const before = times[i - 1];
    const after = times[i + 1];
    return {
      step: i,
      at,
      midis: [PROMPT_KEY],
      measure: 2,
      pass: 1,
      played: 2,
      window: matchWindow(
        before === undefined ? Infinity : at - before,
        after === undefined ? Infinity : after - at,
      ),
      slot: (after ?? length) - at,
    };
  });
  const first = steps[0];
  return {
    plan: { steps, clicks, countIn, length, start: 0, loop: false },
    backing: { notes, steps: [], length, start: 0, loop: false },
    lastOn,
    answer: tapBack
      ? {
          start,
          // A tap on the downbeat of a bar starting with a rest is a tap too many.
          from: start - (first && first.at === start ? first.window : MIN_WINDOW_MS),
          to: exact(start + barMs - MIN_WINDOW_MS),
        }
      : null,
    beatMs,
    barMs,
  };
}

/**
 * Whether a tap the run's matcher took for no onset is one too many: inside the bar tapped
 * (`DictationRun.answer`). Taps with the count-ins or the prompt are not answers.
 */
export function isDictationExtra(run: DictationRun, time: number, hit: boolean): boolean {
  return !hit && run.answer !== null && time >= run.answer.from && time <= run.answer.to;
}

// --- Tap it back -----------------------------------------------------------------------------

export interface TappedCell {
  cell: number;
  key: string;
  /** The cell's onsets in beats from its start: the prompt stored. */
  prompt: number[];
  /** Per onset: whole ms early (−) or late (+), the latency taken off; null: missed. */
  deviations: (number | null)[];
  /** Taps too many in the cell's span, whole ms from its start (before the first: negative). */
  extras: number[];
  correct: boolean;
}

export interface TappedBar {
  /** Every onset of the bar, in time order. */
  onsets: { tick: number; deviation: number | null }[];
  /** Every tap too many, in ticks from the bar's downbeat, and the cell it counts for. */
  extras: { tick: number; cell: number }[];
  cells: TappedCell[];
  /** Cells right. */
  right: number;
  /** Every cell right: the bar tapped back. */
  correct: boolean;
  medianDeviation: number | null;
  tendency: number | null;
}

/**
 * Judges a bar tapped back, as Rhythm on Read judges a line (`judgeRhythmRun`): from the steps
 * the matcher settled (one per onset of the bar, in order) and the taps too many (`extraTaps`,
 * ms from the tapped bar's downbeat, the latency taken off). A cell is right when every onset in
 * it is in time and no tap too many fell in its span (one before the first cell counts for it).
 */
export function judgeTaps(
  bar: readonly string[],
  meter: RhythmMeter,
  bpm: number,
  timings: readonly StepTiming[],
  extraTaps: readonly number[],
): TappedBar {
  const perTick = msPerTick(meter, bpm);
  const beat = beatTicksOf(meter);
  const byStep = new Map(timings.map((t) => [t.step, t]));
  const struck = barSound(bar, meter).map(([tick]) => tick);
  const onsets = struck.map((tick, step) => {
    const raw = byStep.get(step)?.notes[0]?.deviation;
    return { tick, deviation: raw === undefined || raw === null ? null : wholeMs(raw) };
  });
  const starts = cellStarts(bar).map((b) => b * beat);
  // Whole ms, as stored, so an import places a tap in the same cell.
  const cellOf = (time: number) =>
    Math.max(
      0,
      starts.findLastIndex((s) => wholeMs(s * perTick) <= time),
    );
  const extras = extraTaps.map((raw) => {
    const time = wholeMs(raw);
    return { tick: time / perTick, cell: cellOf(time), time };
  });
  const cells = bar.map((key, index): TappedCell => {
    const from = starts[index]!;
    const to = from + cellBeats(key) * beat;
    const prompt = cellOnsets(key, meter)[0]!;
    const deviations = onsets.filter((o) => o.tick >= from && o.tick < to).map((o) => o.deviation);
    const own = extras.filter((e) => e.cell === index).map((e) => wholeMs(e.time - from * perTick));
    return {
      cell: index,
      key,
      prompt,
      deviations,
      extras: own,
      correct: judgeCell([deviations], own.length),
    };
  });
  const played = onsets.map((o) => o.deviation).filter((d) => d !== null);
  const right = cells.filter((c) => c.correct).length;
  return {
    onsets,
    extras: extras.map(({ tick, cell }) => ({ tick, cell })),
    cells,
    right,
    correct: right === cells.length,
    medianDeviation: median(played.map(Math.abs)),
    tendency: trimmedMean(played, TENDENCY_TRIM),
  };
}

// --- Answers ---------------------------------------------------------------------------------

interface AnswerBase {
  /** Stable and unique, so imports and sync can merge by id. */
  id: string;
  sessionId: string;
  family: RhythmEarFamily;
  level: RhythmEarLevelId;
  /** `rhythmEar:<cell>:<meter>`. */
  item: string;
  /** Beats a minute (dotted quarters in 6/8). */
  bpm: number;
  /** The question of the session (0-based): a bar tapped back leaves an answer per cell. */
  question: number;
  /** "Hear again" before the answer. */
  replays: number;
  /** Epoch ms: when the cell's span ended in the bar tapped, or when the bar was chosen. */
  at: number;
}

/** One cell of a bar tapped back. Plain data, stored and synced as is. */
export interface RhythmEarTapAnswer extends AnswerBase {
  by: 'play';
  /** The cell's onsets in beats from its start. */
  prompt: number[];
  answer: {
    /** Per onset of `prompt`: whole ms early (−) or late (+); null: missed. */
    deviations: (number | null)[];
    /** Taps too many in the cell's span, whole ms from its start. */
    extras: number[];
  };
  /** Every onset in time and no tap too many. */
  correct: boolean;
}

/** A bar chosen. Plain data, stored and synced as is. */
export interface RhythmEarChoiceAnswer extends AnswerBase {
  by: 'name';
  /** The bar played, as cells; the item is one of them, the cell the question changed. */
  prompt: string[];
  /** The bar chosen: the bar played, or one differing from it in one cell. */
  answer: string[];
  correct: boolean;
  /** From the prompt's last note-on (as last played) to the choice. */
  ms: number;
}

export type RhythmEarAnswer = RhythmEarTapAnswer | RhythmEarChoiceAnswer;

/** The one position where two bars of cells differ; null when none or several do. */
export function differingCell(a: readonly string[], b: readonly string[]): number | null {
  if (a.length !== b.length) return null;
  const at = a.flatMap((cell, i) => (cell === b[i] ? [] : [i]));
  return at.length === 1 ? at[0]! : null;
}

/** Taps are read as a cell whose onsets lie at most this far from them, in beats. */
export const TAPPED_AS_BEATS = 1 / 6;

/**
 * The cell a bar's taps in one cell's span make: of the cells of the same length (a tied cell only
 * when it is the one asked), the one with as many onsets, each tap within `TAPPED_AS_BEATS` of
 * one, nearest overall; the one asked when it is as near, then the first in the order the levels
 * add them. Null when none: taps that make no cell.
 */
export function tappedAs(answer: RhythmEarTapAnswer): string | null {
  const parsed = parseRhythmEarItem(answer.item);
  if (!parsed) return null;
  const { cell: asked, meter } = parsed;
  if (answer.correct) return asked;
  const beatMs = 60_000 / answer.bpm;
  const taps = [
    ...answer.prompt.flatMap((onset, i) => {
      const d = answer.answer.deviations[i];
      return d === null || d === undefined ? [] : [onset + d / beatMs];
    }),
    ...answer.answer.extras.map((ms) => ms / beatMs),
  ].sort((a, b) => a - b);
  const def = CELLS[asked]!;
  let best: { cell: string; error: number } | null = null;
  for (const cell of [asked, ...RHYTHM_EAR_CELLS]) {
    const other = CELLS[cell]!;
    if (other.compound !== def.compound || other.beats !== def.beats) continue;
    if (cell !== asked && cell.startsWith('~')) continue;
    const onsets = cellOnsets(cell, meter)[0]!;
    if (onsets.length !== taps.length) continue;
    const error = Math.max(0, ...onsets.map((o, i) => Math.abs(o - taps[i]!)));
    if (error > TAPPED_AS_BEATS + 1e-9) continue;
    if (!best || error < best.error - 1e-9) best = { cell, error };
  }
  return best?.cell ?? null;
}

/**
 * What an answer puts in the confusion table: the cell asked against the cell answered (chosen,
 * or tapped as; null: taps that make none). A bar chosen that differs in one cell is that cell
 * against the bar played's cell there; the bar played is the cell asked about, answered right.
 */
export function rhythmEarConfusion(answer: RhythmEarAnswer): {
  asked: string;
  answered: string | null;
} | null {
  const parsed = parseRhythmEarItem(answer.item);
  if (!parsed) return null;
  if (answer.by === 'play') return { asked: parsed.cell, answered: tappedAs(answer) };
  const same =
    answer.prompt.length === answer.answer.length &&
    answer.prompt.every((cell, i) => cell === answer.answer[i]);
  if (same) return { asked: parsed.cell, answered: parsed.cell };
  const at = differingCell(answer.prompt, answer.answer);
  if (at === null) return null;
  return { asked: answer.prompt[at]!, answered: answer.answer[at]! };
}

/** The confusion counts of `answers`, by cell asked, wrong answers only. */
export function cellConfusions(answers: readonly RhythmEarAnswer[]): CellConfusions {
  const out = new Map<string, Map<string, number>>();
  for (const answer of answers) {
    if (answer.correct) continue;
    const pair = rhythmEarConfusion(answer);
    if (!pair || pair.answered === null || pair.answered === pair.asked) continue;
    let row = out.get(pair.asked);
    if (!row) out.set(pair.asked, (row = new Map<string, number>()));
    row.set(pair.answered, (row.get(pair.answered) ?? 0) + 1);
  }
  return out;
}

/** How far a cell's onsets were from the beat on average: its unevenness; 0 with none played. */
function unevenness(answer: RhythmEarTapAnswer): number {
  const played = answer.answer.deviations.filter((d) => d !== null);
  return played.length === 0 ? 0 : played.reduce((s, d) => s + Math.abs(d), 0) / played.length;
}

/**
 * Per-item stats for the item model: a wrong answer counts as an error; a cell tapped right is
 * weighted by its unevenness, as on Read; a bar chosen, or anything after a replay, by accuracy
 * alone.
 */
export function rhythmEarStats(answers: readonly RhythmEarAnswer[]): Record<string, NoteStats> {
  return statsFromAttempts(
    answers.map((a) => ({
      note: a.item,
      correct: a.correct,
      ms: a.by === 'play' ? unevenness(a) : 0,
      hinted: a.by === 'name' || a.replays > 0,
      timedOut: false,
      at: a.at,
    })),
  );
}

/** The item model's speed target: a cell tapped right, against Rhythm's 25 ms. */
export const RHYTHM_EAR_TARGET_MS = RHYTHM_TARGET_MS;

/** Answers whose time says something about hearing: a bar chosen right at once, within 30 s. */
export function isTimedRhythmEar(answer: RhythmEarAnswer): answer is RhythmEarChoiceAnswer {
  return answer.by === 'name' && answer.correct && answer.replays === 0 && answer.ms <= TIMEOUT_MS;
}

/** The median time of the timed answers among `answers`; null with none. */
export function medianChoiceMs(answers: readonly RhythmEarAnswer[]): number | null {
  return median(answers.filter(isTimedRhythmEar).map((a) => a.ms));
}

// --- A session -------------------------------------------------------------------------------

/** Bars per session: as many as Echo's melodies. */
export const RHYTHM_EAR_SESSION_LENGTHS = [5, 10, 20] as const;
export type RhythmEarSessionLength = (typeof RHYTHM_EAR_SESSION_LENGTHS)[number];
export const DEFAULT_RHYTHM_EAR_SESSION_LENGTH: RhythmEarSessionLength = 10;

export interface RhythmEarQuestion {
  /** 0-based position in the session. */
  index: number;
  meter: RhythmMeter;
  bar: string[];
  /** Choose it: the question (the cell asked about, the bars offered); null tapping back. */
  choice: ChoiceQuestion | null;
  /**
   * Choose it: performance.now() of the prompt's last note-on as last played; a choice before it
   * does not count. Null until the prompt is scheduled.
   */
  opensAt: number | null;
  replays: number;
  status: 'waiting' | 'correct' | 'wrong';
  /** The choice made (an index into `choice.choices`). */
  chosen: number | null;
  /** The bar tapped back, judged. */
  tapped: TappedBar | null;
}

export interface RhythmEarSessionState {
  id: string;
  level: RhythmEarLevelId;
  by: RhythmEarMode;
  bpm: number;
  /** Bars to answer. */
  length: number;
  startedAt: number;
  endedAt: number | null;
  phase: 'running' | 'done';
  question: RhythmEarQuestion;
  answers: readonly RhythmEarAnswer[];
}

/** A question's item when it is chosen: the cell asked about; for a bar tapped, its first cell. */
export function questionItem(question: Pick<RhythmEarQuestion, 'bar' | 'meter' | 'choice'>) {
  return rhythmEarItem(question.bar[question.choice?.target ?? 0]!, question.meter);
}

export interface QuestionOptions {
  level: RhythmEarLevelId;
  by: RhythmEarMode;
  /** The family's answers so far (every level's), in the order they happened. */
  answers: readonly RhythmEarAnswer[];
  /** The item asked about last, so the next bar chosen is about another where it can be. */
  previous: string | null;
  rng: Rng;
}

/**
 * The next question: a meter of the level at random and a bar drawn by the item model; to choose
 * it, the cell asked about among those the bar can be asked about (`choiceQuestion`), weighted by
 * the model too, and the bars to choose from.
 */
export function makeQuestion(index: number, options: QuestionOptions): RhythmEarQuestion {
  const { by, answers, previous, rng } = options;
  const level = getRhythmLevel(options.level);
  const stats = rhythmEarStats(answers);
  const confusions = cellConfusions(answers);
  const base = { index, opensAt: null, replays: 0, status: 'waiting' as const, chosen: null };
  const meterOf = () => level.meters[Math.floor(rng() * level.meters.length)] ?? level.meters[0]!;
  if (by === 'play') {
    const meter = meterOf();
    return { ...base, meter, bar: drawBar(level, meter, stats, rng), choice: null, tapped: null };
  }
  let fallback: RhythmEarQuestion | null = null;
  for (let i = 0; i < MAX_DRAWS; i++) {
    const meter = meterOf();
    const bar = drawBar(level, meter, stats, rng);
    const askable = bar.flatMap((_, target) => {
      const choice = choiceQuestion(level, meter, bar, target, confusions, rng);
      return choice ? [choice] : [];
    });
    if (askable.length === 0) continue;
    const other = askable.filter((c) => rhythmEarItem(bar[c.target]!, meter) !== previous);
    const choice = pickWeighted(
      other.length > 0 ? other : askable,
      (c) => noteWeight(stats[rhythmEarItem(bar[c.target]!, meter)], RHYTHM_EAR_TARGET_MS),
      rng,
    );
    const question = { ...base, meter, bar, choice, tapped: null };
    if (other.length > 0) return question;
    fallback ??= question;
  }
  if (fallback) return fallback;
  throw new RangeError(`No bar of ${options.level} can be chosen among others`);
}

export function startRhythmEarSession(options: {
  id: string;
  level: RhythmEarLevelId;
  by: RhythmEarMode;
  bpm: number;
  length: number;
  at: number;
  question: RhythmEarQuestion;
}): RhythmEarSessionState {
  return {
    id: options.id,
    level: options.level,
    by: options.by,
    bpm: options.bpm,
    length: options.length,
    startedAt: options.at,
    endedAt: null,
    phase: 'running',
    question: options.question,
    answers: [],
  };
}

/**
 * The prompt of question `index` was scheduled; its last note-on is at `opensAt`. With `replay`
 * ("Hear again") before the answer, the replay is counted; one after it is not.
 */
export function promptScheduled(
  state: RhythmEarSessionState,
  index: number,
  opensAt: number,
  replay: boolean,
): RhythmEarSessionState {
  const { question } = state;
  if (state.phase !== 'running' || question.index !== index) return state;
  const counted = replay && question.status === 'waiting';
  return {
    ...state,
    question: { ...question, opensAt, replays: question.replays + (counted ? 1 : 0) },
  };
}

/** A bar chosen (an index into the choices) at `time`; before the window opens it is nothing. */
export function chooseBar(
  state: RhythmEarSessionState,
  index: number,
  time: number,
  at: number,
  newId: () => string,
): RhythmEarSessionState {
  const { question } = state;
  const choice = question.choice;
  if (
    state.phase !== 'running' ||
    state.by !== 'name' ||
    !choice ||
    question.status !== 'waiting' ||
    question.opensAt === null ||
    time < question.opensAt
  )
    return state;
  const chosen = choice.choices[index];
  if (!chosen) return state;
  const correct = index === choice.right;
  const record: RhythmEarChoiceAnswer = {
    id: newId(),
    sessionId: state.id,
    family: RHYTHM_EAR_FAMILY,
    level: state.level,
    item: questionItem(question),
    by: 'name',
    prompt: [...question.bar],
    answer: [...chosen],
    correct,
    ms: Math.round(time - question.opensAt),
    bpm: state.bpm,
    question: question.index,
    replays: question.replays,
    at,
  };
  return {
    ...state,
    answers: [...state.answers, record],
    question: { ...question, status: correct ? 'correct' : 'wrong', chosen: index },
  };
}

/**
 * A bar tapped back to its end: an answer for each of its cells, stamped when the cell's span
 * ended (`zeroAt`: the epoch ms of the tapped bar's downbeat).
 */
export function recordTaps(
  state: RhythmEarSessionState,
  tapped: TappedBar,
  zeroAt: number,
  newId: () => string,
): RhythmEarSessionState {
  const { question } = state;
  if (state.phase !== 'running' || state.by !== 'play' || question.status !== 'waiting')
    return state;
  const perTick = msPerTick(question.meter, state.bpm);
  const beat = beatTicksOf(question.meter);
  const starts = cellStarts(question.bar);
  const answers = tapped.cells.map((c): RhythmEarTapAnswer => ({
    id: newId(),
    sessionId: state.id,
    family: RHYTHM_EAR_FAMILY,
    level: state.level,
    item: rhythmEarItem(c.key, question.meter),
    by: 'play',
    prompt: [...c.prompt],
    answer: { deviations: [...c.deviations], extras: [...c.extras] },
    correct: c.correct,
    bpm: state.bpm,
    question: question.index,
    replays: question.replays,
    at: Math.round(zeroAt + (starts[c.cell]! + cellBeats(c.key)) * beat * perTick),
  }));
  return {
    ...state,
    answers: [...state.answers, ...answers],
    question: { ...question, status: tapped.correct ? 'correct' : 'wrong', tapped },
  };
}

/** After an answer: the next question (`next`), or the end of the session. */
export function advanceRhythmEar(
  state: RhythmEarSessionState,
  next: () => RhythmEarQuestion,
  at: number,
): RhythmEarSessionState {
  if (state.phase !== 'running' || state.question.status === 'waiting') return state;
  if (state.question.index + 1 >= state.length) return endRhythmEarSession(state, at);
  return { ...state, question: next() };
}

export function endRhythmEarSession(
  state: RhythmEarSessionState,
  at: number,
): RhythmEarSessionState {
  if (state.phase === 'done') return state;
  return { ...state, phase: 'done', endedAt: at };
}

// --- Figures ---------------------------------------------------------------------------------

/** An answer gone wrong: the cell asked, and what it was answered as (null: no cell). */
export interface RhythmEarMiss {
  item: string;
  as: string | null;
}

/** What a finished (or stopped) session amounts to. Plain data, stored as a session of `ear`. */
export interface RhythmEarSessionSummary {
  id: string;
  family: RhythmEarFamily;
  level: RhythmEarLevelId;
  by: RhythmEarMode;
  bpm: number;
  startedAt: number;
  endedAt: number;
  /** Time spent; pauses longer than `IDLE_MS` count as `IDLE_MS`. */
  activeMs: number;
  /** Bars planned, answered, and answered right (every cell, or the bar played chosen). */
  length: number;
  questions: number;
  questionsRight: number;
  /** Answers: the cells tapped, or the bars chosen. */
  items: number;
  correct: number;
  /** Of the answers; null when there are none. */
  accuracy: number | null;
  /** Choosing: over the timed answers (`isTimedRhythmEar`); null with none. */
  medianMs: number | null;
  /** Tapping back: the median |deviation| of the onsets played; null with none. */
  medianDeviation: number | null;
  /** "Hear again" over the bars answered. */
  replays: number;
  /** Every wrong answer, in order. */
  missed: RhythmEarMiss[];
}

export type RhythmEarSummaryInput = Pick<
  RhythmEarSessionState,
  'id' | 'level' | 'by' | 'bpm' | 'length' | 'startedAt' | 'endedAt' | 'answers'
>;

export function summarizeRhythmEar(state: RhythmEarSummaryInput): RhythmEarSessionSummary {
  const { answers } = state;
  const endedAt = state.endedAt ?? answers.at(-1)?.at ?? state.startedAt;
  const byQuestion = new Map<number, RhythmEarAnswer[]>();
  for (const a of answers) byQuestion.set(a.question, [...(byQuestion.get(a.question) ?? []), a]);
  const questions = [...byQuestion.values()];
  const correct = answers.filter((a) => a.correct).length;
  const played = answers
    .flatMap((a) => (a.by === 'play' ? a.answer.deviations : []))
    .filter((d) => d !== null);
  return {
    id: state.id,
    family: RHYTHM_EAR_FAMILY,
    level: state.level,
    by: state.by,
    bpm: state.bpm,
    startedAt: state.startedAt,
    endedAt,
    activeMs: activeTime([state.startedAt, ...answers.map((a) => a.at), endedAt]),
    length: state.length,
    questions: questions.length,
    questionsRight: questions.filter((q) => q.every((a) => a.correct)).length,
    items: answers.length,
    correct,
    accuracy: answers.length > 0 ? correct / answers.length : null,
    medianMs: medianChoiceMs(answers),
    medianDeviation: state.by === 'play' ? median(played.map(Math.abs)) : null,
    replays: questions.reduce((sum, q) => sum + Math.max(...q.map((a) => a.replays)), 0),
    missed: answers
      .filter((a) => !a.correct)
      .map((a) => {
        const pair = rhythmEarConfusion(a);
        const parsed = parseRhythmEarItem(a.item)!;
        return {
          item: pair ? rhythmEarItem(pair.asked, parsed.meter) : a.item,
          as: pair?.answered ?? null,
        };
      }),
  };
}

/**
 * The summary of a session whose answers were stored but whose end was not (the tab was closed
 * mid-session). `answers` must belong to one session, in the order they happened.
 */
export function recoverRhythmEarSummary(
  answers: readonly RhythmEarAnswer[],
): RhythmEarSessionSummary | null {
  const first = answers[0];
  const last = answers.at(-1);
  if (!first || !last) return null;
  return summarizeRhythmEar({
    id: first.sessionId,
    level: first.level,
    by: first.by,
    bpm: first.bpm,
    length: new Set(answers.map((a) => a.question)).size,
    startedAt: first.by === 'name' ? Math.round(first.at - first.ms) : first.at,
    endedAt: last.at,
    answers,
  });
}

// --- Mastery ---------------------------------------------------------------------------------

export const RHYTHM_EAR_MASTERY_WINDOW = 40;
export const RHYTHM_EAR_MASTERY_ACCURACY = 0.9;

export interface RhythmEarLevelProgress {
  level: RhythmEarLevelId;
  /** Every answer ever given at this level, replayed or not. */
  total: number;
  /** Answers without a replay in the window (at most `RHYTHM_EAR_MASTERY_WINDOW`). */
  answers: number;
  window: number;
  accuracy: number | null;
  /** Shown, not part of mastery: over the window's timed answers (bars chosen). */
  medianMs: number | null;
  mastered: boolean;
}

/**
 * Mastery, as the Ear page's: ≥ 90 % of the level's last 40 answers given without a replay (a
 * cell tapped back, or a bar chosen), however answered. `answers` in the order they happened.
 */
export function rhythmEarLevelProgress(
  answers: readonly RhythmEarAnswer[],
  level: RhythmEarLevelId,
): RhythmEarLevelProgress {
  const ofLevel = answers.filter((a) => a.level === level);
  const window = ofLevel.filter((a) => a.replays === 0).slice(-RHYTHM_EAR_MASTERY_WINDOW);
  const correct = window.filter((a) => a.correct).length;
  const accuracy = window.length > 0 ? correct / window.length : null;
  return {
    level,
    total: ofLevel.length,
    answers: window.length,
    window: RHYTHM_EAR_MASTERY_WINDOW,
    accuracy,
    medianMs: medianChoiceMs(window),
    mastered:
      window.length >= RHYTHM_EAR_MASTERY_WINDOW &&
      accuracy !== null &&
      accuracy >= RHYTHM_EAR_MASTERY_ACCURACY,
  };
}

/** The first level not mastered yet, or the last once all are. */
export function suggestedRhythmEarLevel(
  progress: ReadonlyMap<RhythmEarLevelId, RhythmEarLevelProgress>,
): RhythmEarLevelId {
  return (
    RHYTHM_EAR_LEVEL_IDS.find((id) => !progress.get(id)?.mastered) ?? RHYTHM_EAR_LEVEL_IDS.at(-1)!
  );
}
