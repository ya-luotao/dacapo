// A take as a Standard MIDI File (docs/PIECES.md, "A take as a MIDI file"): what was played in a
// run, to be heard in another program, opened in a notation program or sent to a teacher. Format
// 0: one track on channel 1, `SMF_TICKS` to the quarter note, every key down and up with its
// velocity and the three pedals as the take has them. A run played against a click carries the
// beat it was played to (its **grid**: the tempo and the bars), so its bars line up in a notation
// program; any other run is at ♩ = 120 with every event at its own time.

import { isCompound } from './metronome.ts';
import { DEFAULT_BPM, playSpan } from './playback.ts';
import { playOrder, type RepeatMode } from './repeats.ts';
import {
  buildSteps,
  TICKS_PER_QUARTER,
  type HandSelection,
  type Measure,
  type Score,
} from './score.ts';
import { dayKey } from './streak.ts';
import { TAKE_OFF, TAKE_ON, TAKE_PEDALS, type TakeEvent } from './takes.ts';
import type { BarLoop } from './wait.ts';

/** Ticks to the quarter note in the file. */
export const SMF_TICKS = 480;
/** The tempo of a file without a beat (wait and memory mode): its ticks are real time. */
export const SMF_FREE_BPM = 120;
/** A key up carries no velocity in a take: the value MIDI gives a release that has none. */
const RELEASE_VELOCITY = 64;

/** Quarter notes per minute from a tick of the span on. */
export interface SmfTempo {
  tick: number;
  bpm: number;
}

/** The time signature from a tick of the span on. */
export interface SmfMeter {
  tick: number;
  beats: number;
  beatType: number;
}

/**
 * The beat a run was played against, in file ticks from the take's time 0 (the start of the span
 * on the run's clock): the tempo as played and the bars.
 */
export interface SmfGrid {
  /** Sorted, the first at 0, each where the tempo changes. */
  tempos: readonly SmfTempo[];
  /** Sorted, the first at 0, each where the bars change length. */
  meters: readonly SmfMeter[];
  /** One time round the span. */
  length: number;
  /** A loop: the span goes round, and the tempo and the bars with it. */
  loop: boolean;
  /** Where the file begins: a bar line, at or after the take's time 0. */
  start: number;
}

/** A take as a file. */
export interface MidiFile {
  bytes: Uint8Array<ArrayBuffer>;
  /** The take's ms at the file's time 0. */
  start: number;
}

/** A number as a MIDI variable-length quantity: seven bits a byte, the high bit on all but the last. */
export function variableLength(value: number): number[] {
  let rest = Math.max(0, Math.round(value));
  const bytes = [rest % 128];
  rest = Math.floor(rest / 128);
  while (rest > 0) {
    bytes.unshift((rest % 128) + 128);
    rest = Math.floor(rest / 128);
  }
  return bytes;
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const isKey = (n: number | undefined): n is number =>
  n !== undefined && Number.isInteger(n) && n >= 0 && n <= 127;
const isPedal = (kind: number | undefined) => (TAKE_PEDALS as readonly number[]).includes(kind!);

/** One event of the track. At one tick: tempo and bars, pedals, key ups, then key downs. */
interface TrackEvent {
  tick: number;
  rank: number;
  data: number[];
}

const META = 0;
const CONTROL = 1;
const KEY_UP = 2;
const KEY_DOWN = 3;

/**
 * The take's keys and pedals at their ticks. Every key down gets its key up: a key struck again
 * with no key up between ends where it is struck again, one still down at the end ends with the
 * take's last event, and a key up for a key that is not down is left out. A key up comes at least
 * a tick after its key down, and a key is never struck before its last stroke ended, so two
 * strokes moved onto one tick (the count-in's, or two within a tick) stay two notes.
 */
function channelEvents(events: readonly TakeEvent[], tickOf: (ms: number) => number): TrackEvent[] {
  const out: TrackEvent[] = [];
  /** Keys down: the tick each was struck at. */
  const down = new Map<number, number>();
  /** Where each key's last stroke ended. */
  const ended = new Map<number, number>();
  let last = 0;
  const up = (key: number, tick: number) => {
    out.push({ tick, rank: KEY_UP, data: [0x80, key, RELEASE_VELOCITY] });
    down.delete(key);
    ended.set(key, tick);
    last = Math.max(last, tick);
  };
  for (const event of events) {
    const [ms, kind, a, b] = event as number[];
    const tick = tickOf(ms!);
    last = Math.max(last, tick);
    if (isPedal(kind)) {
      out.push({ tick, rank: CONTROL, data: [0xb0, kind!, clamp(Math.round(a!), 0, 127)] });
      continue;
    }
    if (!isKey(a)) continue;
    if (kind === TAKE_ON) {
      const struck = down.get(a);
      if (struck !== undefined) up(a, Math.max(tick, struck + 1));
      const at = Math.max(tick, ended.get(a) ?? 0);
      // Velocity 0 would be a key up: the softest key down is 1.
      out.push({ tick: at, rank: KEY_DOWN, data: [0x90, a, clamp(Math.round(b!), 1, 127)] });
      down.set(a, at);
      last = Math.max(last, at);
    } else if (kind === TAKE_OFF) {
      const struck = down.get(a);
      if (struck !== undefined) up(a, Math.max(tick, struck + 1));
    }
  }
  const end = last;
  for (const [key, struck] of [...down]) up(key, Math.max(end, struck + 1));
  return out;
}

/** Microseconds to the quarter note, as a tempo event has it (three bytes). */
function tempoData(bpm: number): number[] {
  const us = clamp(Math.round(60_000_000 / bpm), 1, 0xffffff);
  return [0xff, 0x51, 0x03, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff];
}

/**
 * A time signature event: the beats, the beat's note as a power of two, the MIDI clocks (24 to
 * the quarter) to a click of the metronome, the dotted beat in compound meters as the click has
 * it, and the 32nds to a quarter.
 */
function meterData(meter: Pick<SmfMeter, 'beats' | 'beatType'>): number[] {
  const unit = 96 / meter.beatType;
  const click = clamp(Math.round(isCompound(meter) ? unit * 3 : unit), 1, 255);
  return [0xff, 0x58, 0x04, meter.beats, Math.round(Math.log2(meter.beatType)), click, 8];
}

/** The grid's clock: ms on the run's clock to ticks from the take's time 0, and back. */
function gridClock(grid: SmfGrid) {
  const perMs = (bpm: number) => (bpm * SMF_TICKS) / 60_000;
  const segments: { tick: number; bpm: number; ms: number }[] = [];
  for (const { tick, bpm } of grid.tempos) {
    const before = segments.at(-1);
    segments.push({
      tick,
      bpm,
      ms: before ? before.ms + (tick - before.tick) / perMs(before.bpm) : 0,
    });
  }
  if (segments.length === 0) segments.push({ tick: 0, bpm: SMF_FREE_BPM, ms: 0 });
  const end = segments.at(-1)!;
  const lengthMs = end.ms + (grid.length - end.tick) / perMs(end.bpm);
  const going = grid.loop && grid.length > 0 && lengthMs > 0;
  return {
    /** Before time 0 at the first tempo, after the end of a span that does not go round at the last. */
    tick(ms: number): number {
      const round = going ? Math.max(0, Math.floor(ms / lengthMs)) : 0;
      const local = ms - round * lengthMs;
      const segment = segments.findLast((s) => s.ms <= local) ?? segments[0]!;
      return round * grid.length + segment.tick + (local - segment.ms) * perMs(segment.bpm);
    },
    ms(tick: number): number {
      const round = going ? Math.max(0, Math.floor(tick / grid.length)) : 0;
      const local = tick - round * grid.length;
      const segment = segments.findLast((s) => s.tick <= local) ?? segments[0]!;
      return round * lengthMs + segment.ms + (local - segment.tick) / perMs(segment.bpm);
    },
  };
}

/**
 * The grid's tempo and bars as events of a file that begins at `grid.start` and ends at tick
 * `end`: what is in force at the start is written at 0, and round after round of a loop what
 * changes from there on.
 */
function gridEvents(grid: SmfGrid, end: number): TrackEvent[] {
  const rounds = grid.loop && grid.length > 0 ? Math.floor((grid.start + end) / grid.length) : 0;
  const lay = <T extends { tick: number }>(
    marks: readonly T[],
    same: (a: T, b: T) => boolean,
    data: (mark: T) => number[],
  ): TrackEvent[] => {
    const laid: { tick: number; mark: T }[] = [];
    for (let round = 0; round <= rounds; round++) {
      for (const mark of marks) {
        const tick = Math.max(0, round * grid.length + mark.tick - grid.start);
        if (tick > end) continue;
        const before = laid.at(-1);
        // What is in force when the file begins replaces what came before it.
        if (before && before.tick === tick) laid.pop();
        if (laid.length > 0 && same(laid.at(-1)!.mark, mark)) continue;
        laid.push({ tick, mark });
      }
    }
    return laid.map(({ tick, mark }) => ({ tick, rank: META, data: data(mark) }));
  };
  return [
    ...lay(
      grid.tempos,
      (a, b) => a.bpm === b.bpm,
      (mark) => tempoData(mark.bpm),
    ),
    ...lay(grid.meters, (a, b) => a.beats === b.beats && a.beatType === b.beatType, meterData),
  ];
}

/**
 * The take as a Standard MIDI File, or null when no key was played in it. With a `grid` (a run
 * played against a click) the events are placed on its beat, the `latency` taken off them as the
 * run's timing takes it off; the count-in is left out, and what was played before the file's
 * first bar is moved to its time 0. Without one, time 0 is the take's first event and a tick is
 * 1/960 s. The track is named `title`.
 */
export function takeMidi(take: {
  title: string;
  events: readonly TakeEvent[];
  /** Rhythm mode: the latency the run was timed with (the take's times are raw). */
  latency?: number;
  grid?: SmfGrid | null;
}): MidiFile | null {
  const { events, grid = null, latency = 0 } = take;
  if (!events.some((e) => e[1] === TAKE_ON && isKey(e[2]))) return null;

  let start: number;
  let tickOf: (ms: number) => number;
  if (grid) {
    const clock = gridClock(grid);
    start = clock.ms(grid.start) + latency;
    tickOf = (ms) => Math.max(0, Math.round(clock.tick(ms - latency) - grid.start));
  } else {
    const first = events.reduce((earliest, e) => Math.min(earliest, e[0]!), Infinity);
    start = first;
    tickOf = (ms) => Math.round(((ms - first) * SMF_FREE_BPM * SMF_TICKS) / 60_000);
  }

  const played = channelEvents(events, tickOf);
  const end = played.reduce((latest, e) => Math.max(latest, e.tick), 0);
  const track = [
    ...(grid ? gridEvents(grid, end) : [{ tick: 0, rank: META, data: tempoData(SMF_FREE_BPM) }]),
    ...played,
  ]
    .map((event, order) => ({ ...event, order }))
    .sort((a, b) => a.tick - b.tick || a.rank - b.rank || a.order - b.order);

  const name = new TextEncoder().encode(take.title);
  const body: number[] = [0, 0xff, 0x03, ...variableLength(name.length), ...name];
  let at = 0;
  for (const event of track) {
    body.push(...variableLength(event.tick - at), ...event.data);
    at = event.tick;
  }
  body.push(0, 0xff, 0x2f, 0x00);

  const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
  return {
    bytes: Uint8Array.from([
      ...ascii('MThd'),
      ...u32(6),
      // Format 0, one track.
      ...[0, 0, 0, 1],
      ...[SMF_TICKS >> 8, SMF_TICKS & 0xff],
      ...ascii('MTrk'),
      ...u32(body.length),
      ...body,
    ]),
    start,
  };
}

/** Performance ticks (`TICKS_PER_QUARTER`) as file ticks. */
const fileTicks = (ticks: number) => Math.round((ticks * SMF_TICKS) / TICKS_PER_QUARTER);

/**
 * The time signature a bar is written with in the file: its own, or for a bar of another length
 * (a pickup, the two halves of a bar a repeat divides) the signature of the length it has, so
 * that every bar line of the score is a bar line of the file. A length no signature has keeps
 * the bar's own.
 */
export function barMeter(
  measure: Pick<Measure, 'duration' | 'beats' | 'beatType'>,
): Pick<SmfMeter, 'beats' | 'beatType'> {
  const whole = 4 * TICKS_PER_QUARTER;
  if (measure.duration !== (measure.beats * whole) / measure.beatType) {
    for (let beatType = measure.beatType; beatType <= 64; beatType *= 2) {
      const beats = (measure.duration * beatType) / whole;
      if (Number.isInteger(beats) && beats >= 1 && beats <= 255) return { beats, beatType };
    }
  }
  return { beats: measure.beats, beatType: measure.beatType };
}

/**
 * The grid of a rhythm-mode run of a piece: the score's tempo marks times the run's percent and
 * its bars, laid out over the span as the run's clock lays them out (`runClock`), and the file
 * beginning at the bar of the first key that was matched to the score (at the take's time 0, the
 * start of the span, when none was). Null when the run's bars cannot be found in the score.
 */
export function runGrid(run: {
  score: Score;
  hands: HandSelection;
  repeats: RepeatMode;
  loop: BarLoop | null;
  /** Percent of the score's tempo marks. */
  tempo: number;
  latency: number;
  events: readonly TakeEvent[];
}): SmfGrid | null {
  const { score } = run;
  const order = playOrder(score.measures, run.repeats);
  const span = playSpan(score, order, run.loop, 0);
  if (!span) return null;
  const scale = run.tempo / 100;
  const fallback = score.tempos[0]?.bpm ?? DEFAULT_BPM;

  const tempos: SmfTempo[] = [];
  const meters: SmfMeter[] = [];
  const mark = <T extends { tick: number }>(list: T[], next: T, same: (a: T, b: T) => boolean) => {
    if (list.at(-1)?.tick === next.tick) list.pop();
    if (list.length === 0 || !same(list.at(-1)!, next)) list.push(next);
  };
  for (let p = span.first; p <= span.last; p++) {
    const played = order[p]!;
    const measure = score.measures[played.measure]!;
    const at = played.start - span.from;
    // The tempo in force at the bar, then the marks inside it: as the run's clock has them.
    let bpm = fallback;
    for (const tempo of score.tempos) if (tempo.tick <= measure.start) bpm = tempo.bpm;
    const sameTempo = (a: SmfTempo, b: SmfTempo) => a.bpm === b.bpm;
    mark(tempos, { tick: fileTicks(at), bpm: bpm * scale }, sameTempo);
    for (const tempo of score.tempos) {
      if (tempo.tick <= measure.start || tempo.tick >= measure.start + measure.duration) continue;
      const tick = fileTicks(at + tempo.tick - measure.start);
      mark(tempos, { tick, bpm: tempo.bpm * scale }, sameTempo);
    }
    mark(
      meters,
      { tick: fileTicks(at), ...barMeter(measure) },
      (a, b) => a.beats === b.beats && a.beatType === b.beatType,
    );
  }
  const grid = {
    tempos,
    meters,
    length: fileTicks(span.to - span.from),
    loop: run.loop !== null,
    start: 0,
  };

  // The first key matched to the score, and the bar of its step in the round it was played in
  // (the round whose due time is nearest, as the take is read).
  const steps = buildSteps(score, run.hands, order);
  const first = run.events.find((e) => e[1] === TAKE_ON && steps[e[4]!] !== undefined);
  const step = first && steps[first[4]!]!;
  if (!step || step.played < span.first || step.played > span.last) return grid;
  const clock = gridClock(grid);
  const due = clock.ms(fileTicks(step.tick - span.from));
  const lap = clock.ms(grid.length);
  const round =
    grid.loop && lap > 0 ? Math.max(0, Math.round((first[0]! - run.latency - due) / lap)) : 0;
  return { ...grid, start: round * grid.length + fileTicks(order[step.played]!.start - span.from) };
}

/** A grid of one tempo and one time signature from the take's time 0 on (Improvise's backing). */
export function steadyGrid(bpm: number, beats = 4, beatType = 4): SmfGrid {
  return {
    tempos: [{ tick: 0, bpm }],
    meters: [{ tick: 0, beats, beatType }],
    length: (beats * 4 * SMF_TICKS) / beatType,
    loop: true,
    start: 0,
  };
}

/** What a file name cannot have on Windows, macOS or iOS, and control characters. */
const NOT_IN_A_FILE_NAME = /[\\/:*?"<>|\p{Cc}]/gu;
/** Titles are cut here, so the name stays well within what a file system takes. */
const MAX_TITLE = 80;

/**
 * `<title> <yyyy-mm-dd hh.mm>.mid`: the title without the characters a file name cannot have
 * (letters of every script stay), and the local date and time of `at` (epoch ms) in `timeZone`
 * (an IANA name; the system zone when omitted).
 */
export function midiFileName(title: string, at: number, timeZone?: string): string {
  const trim = (text: string) => text.replace(/^[\s.]+|[\s.]+$/gu, '');
  const cleaned = trim(title.replace(NOT_IN_A_FILE_NAME, '').replace(/\s+/gu, ' '));
  const name = trim([...cleaned].slice(0, MAX_TITLE).join(''));
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    (parts.find((p) => p.type === type)?.value ?? '').padStart(2, '0');
  return `${name || 'dacapo'} ${dayKey(at, timeZone)} ${part('hour')}.${part('minute')}.mid`;
}
