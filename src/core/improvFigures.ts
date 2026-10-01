import { activeTime } from './activity.ts';
import {
  anticipation,
  classifyNote,
  isCallBar,
  isPlayerBar,
  isStrongBeat,
  loopBar,
  loopBars,
  noteBar,
  PHRASE_BARS,
  type BackingId,
  type Feel,
  type ImprovPattern,
  type ImprovPlan,
  type ImprovScale,
  type ImprovSpec,
} from './improv.ts';
import { TAKE_OFF, TAKE_ON, type TakeEvent } from './takes.ts';

// What an improvisation over a backing amounts to (docs/HARMONY.md, "Improvise (H6)"): feedback,
// not a score. Counted from its take, over the player's own bars (every bar, or with call and
// response the answers): the notes as chord tones, scale tones or outside, the ones on the strong
// beats, the range, the time something sounded, the figures played again, and the calls answered.
// Counts, not shares, so a stored session can be checked and read in any way later.

export interface ImprovFigures {
  /** The loop as played: ms from time 0 (the first bar's 1) to the stop. */
  ms: number;
  /** Keys struck in the player's bars, and how each was heard. */
  notes: number;
  chord: number;
  scale: number;
  outside: number;
  /** Of the notes, those on the 1 or the 3, and of those the chord tones. */
  strong: number;
  strongChord: number;
  /** The lowest and highest key struck; null without a note. */
  low: number | null;
  high: number | null;
  /** The player's bars' time, and how much of it something played sounded (a key or the pedal). */
  playerMs: number;
  soundMs: number;
  /** The melody's notes (the top of what is struck together), and of those in a figure played before. */
  melody: number;
  repeated: number;
  /** Calls whose answer has begun, and those answered with at least a note. */
  calls: number;
  answered: number;
  /** For each bar of the loop: the chord tones and the notes struck in it, every time round. */
  byBar: [chord: number, notes: number][];
}

/** Keys struck this close together are one moment of the melody, its top note. */
export const TOGETHER_MS = 30;
/** A figure: this many notes of the melody, its shape (the steps between them) at any pitch. */
export const FIGURE_NOTES = 4;
/** The sustain pedal holds the strings from this value up. */
const PEDAL_DOWN = 64;

interface Struck {
  midi: number;
  /** ms from time 0, its latency taken off. */
  at: number;
  bar: number;
}

/** Merges intervals (each `[from, to)`), sorted. */
function union(intervals: [number, number][]): [number, number][] {
  const sorted = intervals.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** The length of what `a` and `b` (each merged and sorted) share. */
function overlap(a: readonly [number, number][], b: readonly [number, number][]): number {
  let total = 0;
  let j = 0;
  for (const [from, to] of a) {
    while (j < b.length && b[j]![1] <= from) j++;
    for (let k = j; k < b.length && b[k]![0] < to; k++)
      total += Math.max(0, Math.min(to, b[k]![1]) - Math.max(from, b[k]![0]));
  }
  return total;
}

/**
 * The share of the melody's notes that belong to a figure heard before: of each run of
 * `FIGURE_NOTES` notes, its shape (the semitones from each to the next) is compared with every
 * earlier one; a match marks all of its notes. Struck together, the top note is the melody's.
 */
export function repeatedNotes(struck: readonly { midi: number; at: number }[]): {
  melody: number;
  repeated: number;
} {
  const melody: number[] = [];
  let groupAt = -Infinity;
  for (const note of [...struck].sort((a, b) => a.at - b.at || a.midi - b.midi)) {
    if (note.at - groupAt <= TOGETHER_MS && melody.length > 0) {
      melody[melody.length - 1] = Math.max(melody.at(-1)!, note.midi);
    } else {
      melody.push(note.midi);
      groupAt = note.at;
    }
  }
  const marked = new Set<number>();
  const seen = new Set<string>();
  for (let start = 0; start + FIGURE_NOTES <= melody.length; start++) {
    const shape = melody
      .slice(start + 1, start + FIGURE_NOTES)
      .map((midi, i) => midi - melody[start + i]!)
      .join(',');
    if (seen.has(shape)) for (let i = 0; i < FIGURE_NOTES; i++) marked.add(start + i);
    seen.add(shape);
  }
  return { melody: melody.length, repeated: marked.size };
}

/** A key of a take as it sounded: ms from time 0. */
export interface PlayedNote {
  midi: number;
  velocity: number;
  on: number;
  off: number;
}

/**
 * The notes of a take as they sounded, in order: each key from its strike to its release, or
 * while the sustain pedal holds it on to the pedal's lift, and never past the key's next strike;
 * a key not let go (or held by a pedal never lifted) sounds to `end`. Times are taken `latency`
 * earlier, so the notes line up with what the player heard. Playing a take back uses them, the
 * pedal in the notes' lengths (the scheduler sends notes only).
 */
export function playedNotes(
  events: readonly TakeEvent[],
  latency = 0,
  end = Infinity,
): PlayedNote[] {
  const time = (event: TakeEvent) => event[0]! - latency;
  const pedal: [number, boolean][] = [];
  for (const event of events) {
    if (event[1] === 64) pedal.push([time(event), event[2]! >= PEDAL_DOWN]);
  }
  /** When a key let go at `at` stops sounding: then, or at the pedal's lift (null: never). */
  const lift = (at: number): number | null => {
    let down = false;
    for (const [when, value] of pedal) {
      if (when > at) break;
      down = value;
    }
    if (!down) return at;
    for (const [when, value] of pedal) if (when > at && !value) return when;
    return null;
  };
  const notes: PlayedNote[] = [];
  /** The note of each key still sounding (held, or let go under the pedal), and if let go when. */
  const open = new Map<number, { note: PlayedNote; released: number | null }>();
  const close = (midi: number, at: number) => {
    const sounding = open.get(midi);
    if (!sounding) return;
    open.delete(midi);
    const until = sounding.released === null ? at : (lift(sounding.released) ?? end);
    sounding.note.off = Math.max(sounding.note.on, Math.min(until, at));
  };
  for (const event of events) {
    const at = time(event);
    if (event[1] === TAKE_ON) {
      const midi = event[2]!;
      close(midi, at);
      const note = { midi, velocity: event[3]!, on: at, off: at };
      notes.push(note);
      open.set(midi, { note, released: null });
    } else if (event[1] === TAKE_OFF) {
      const sounding = open.get(event[2]!);
      if (sounding && sounding.released === null) sounding.released = at;
    }
  }
  for (const midi of [...open.keys()]) close(midi, end);
  return notes;
}

/**
 * The figures of a take over a backing, `end` ms after time 0 (the stop). Every time is taken
 * `latency` earlier, as rhythm mode takes it: a key arrives that much after it sounded. A note
 * belongs to its bar as `classifyNote` has it (a sixteenth early is the next bar's); notes before
 * the first bar's 1 (less a sixteenth) or in a call are not the player's turn.
 */
export function improvFigures(
  plan: ImprovPlan,
  events: readonly TakeEvent[],
  end: number,
  latency = 0,
): ImprovFigures {
  const loop = loopBars(plan);
  const byBar: [number, number][] = Array.from({ length: loop }, () => [0, 0]);
  const struck: Struck[] = [];
  const figures: ImprovFigures = {
    ms: Math.max(0, Math.round(end)),
    notes: 0,
    chord: 0,
    scale: 0,
    outside: 0,
    strong: 0,
    strongChord: 0,
    low: null,
    high: null,
    playerMs: 0,
    soundMs: 0,
    melody: 0,
    repeated: 0,
    calls: 0,
    answered: 0,
    byBar,
  };
  const early = anticipation(plan);
  for (const event of events) {
    if (event[1] !== TAKE_ON) continue;
    const at = event[0]! - latency;
    if (at < -early || at > end) continue;
    const bar = Math.max(0, noteBar(plan, at));
    if (!isPlayerBar(plan, bar)) continue;
    struck.push({ midi: event[2]!, at, bar });
  }
  const sounding = playedNotes(events, latency, end).map(({ on, off }): [number, number] => [
    on,
    Math.min(off, end),
  ]);

  for (const { midi, at, bar } of struck) {
    const heard = classifyNote(plan, midi, at);
    figures.notes++;
    figures[heard]++;
    const cell = byBar[loopBar(plan, bar)]!;
    cell[1]++;
    if (heard === 'chord') cell[0]++;
    if (isStrongBeat(plan, at)) {
      figures.strong++;
      if (heard === 'chord') figures.strongChord++;
    }
    figures.low = figures.low === null ? midi : Math.min(figures.low, midi);
    figures.high = figures.high === null ? midi : Math.max(figures.high, midi);
  }

  // The player's bars, within the loop as played.
  const windows: [number, number][] = [];
  for (let bar = 0; bar * plan.barMs < end; bar++) {
    if (!isPlayerBar(plan, bar)) continue;
    windows.push([bar * plan.barMs, Math.min(end, (bar + 1) * plan.barMs)]);
  }
  const playerWindows = union(windows);
  figures.playerMs = Math.round(playerWindows.reduce((sum, [a, b]) => sum + b - a, 0));
  figures.soundMs = Math.min(
    figures.playerMs,
    Math.round(overlap(union(sounding.map(([a, b]) => [a, Math.min(b, end)])), playerWindows)),
  );

  const { melody, repeated } = repeatedNotes(struck);
  figures.melody = melody;
  figures.repeated = repeated;

  if (plan.spec.call) {
    const answered = new Set(struck.map((s) => Math.floor(s.bar / PHRASE_BARS)));
    for (let bar = 0; bar * plan.barMs < end; bar += PHRASE_BARS) {
      if (!isCallBar(plan, bar)) continue;
      const answer = bar + PHRASE_BARS;
      if (answer * plan.barMs >= end) break;
      figures.calls++;
      if (answered.has(Math.floor(answer / PHRASE_BARS))) figures.answered++;
    }
  }
  return figures;
}

/** The figures as a player reads them: shares (0–1) and rates, null where there is nothing to share. */
export interface ImprovReading {
  /** Of the notes on strong beats, the chord tones. */
  strongChord: number | null;
  /** Of all the notes, the chord tones, the scale tones and the outside ones. */
  chord: number | null;
  scale: number | null;
  outside: number | null;
  notesPerBar: number;
  /** Of the player's time, the share with nothing sounding. */
  silence: number | null;
  /** Of the melody's notes, those in a figure played before. */
  repeated: number | null;
  /** Bars of the player's turn, whole or not. */
  bars: number;
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export function readFigures(figures: ImprovFigures, barMs: number): ImprovReading {
  const bars = barMs > 0 ? figures.playerMs / barMs : 0;
  return {
    strongChord: share(figures.strongChord, figures.strong),
    chord: share(figures.chord, figures.notes),
    scale: share(figures.scale, figures.notes),
    outside: share(figures.outside, figures.notes),
    notesPerBar: bars > 0 ? figures.notes / Math.max(1, bars) : 0,
    silence: figures.playerMs > 0 ? 1 - figures.soundMs / figures.playerMs : null,
    repeated: figures.melody >= FIGURE_NOTES ? share(figures.repeated, figures.melody) : null,
    bars,
  };
}

// --- The session -----------------------------------------------------------------------------

/**
 * An improvisation as stored (`sessions`, kind `improv`): the backing played and the figures, for
 * the log and the streak. Its take is in `takes`, under its id.
 */
export interface ImprovSession {
  kind: 'improv';
  id: string;
  /** Epoch ms: Start, and the stop. */
  startedAt: number;
  endedAt: number;
  /** Start to stop, a pause between keys longer than `IDLE_MS` counting as `IDLE_MS`. */
  activeMs: number;
  backing: BackingId;
  key: string;
  scale: ImprovScale;
  pattern: ImprovPattern;
  feel: Feel;
  bpm: number;
  click: boolean;
  call: boolean;
  seed: number;
  figures: ImprovFigures;
}

export interface ImprovSessionInput {
  id: string;
  spec: ImprovSpec;
  click: boolean;
  /** Epoch ms of Start, of time 0 (the first bar's 1) and of the stop. */
  startedAt: number;
  zero: number;
  endedAt: number;
  events: readonly TakeEvent[];
  latency: number;
}

/**
 * The session of a loop just stopped, or null when nothing was played in it (no key from the
 * first bar on): a backing listened to is not practice.
 */
export function improvSession(plan: ImprovPlan, input: ImprovSessionInput): ImprovSession | null {
  const end = Math.max(0, input.endedAt - input.zero);
  const figures = improvFigures(plan, input.events, end, input.latency);
  const keys = input.events
    .filter((e) => e[1] === TAKE_ON && e[0]! - input.latency >= -anticipation(plan) && e[0]! <= end)
    .map((e) => input.zero + e[0]!);
  if (keys.length === 0) return null;
  const { spec } = input;
  const endedAt = Math.max(input.startedAt, Math.round(input.endedAt));
  return {
    kind: 'improv',
    id: input.id,
    startedAt: Math.round(input.startedAt),
    endedAt,
    activeMs: Math.round(activeTime([input.startedAt, ...keys, endedAt])),
    backing: spec.backing,
    key: spec.key,
    scale: spec.scale,
    pattern: spec.pattern,
    feel: spec.feel,
    bpm: spec.bpm,
    click: input.click,
    call: spec.call,
    seed: spec.seed,
    figures,
  };
}

/** The spec a stored session was played with. */
export const sessionSpec = (s: ImprovSession): ImprovSpec => ({
  backing: s.backing,
  key: s.key,
  scale: s.scale,
  pattern: s.pattern,
  feel: s.feel,
  bpm: s.bpm,
  call: s.call,
  seed: s.seed,
});
