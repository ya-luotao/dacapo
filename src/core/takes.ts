// A take: what was played in a run of a piece, as it happened (docs/EXPRESSION.md, "Takes"). The
// keys with their velocities and releases and the pedals, times in ms from the run's start, each
// note-on with the step it was matched to. Every expression figure is recomputed from it, and
// "Play back your run" plays it. Stored compactly, in chunks of at most `TAKE_CHUNK_EVENTS` events,
// one record each, written as the run goes.

import type { RepeatMode } from './repeats.ts';
import type { HandSelection } from './score.ts';

/** Events per stored chunk: a chunk stays well under the sync service's 64 KB per record. */
export const TAKE_CHUNK_EVENTS = 2000;

/** The pedals a take keeps: sustain (CC 64), sostenuto (CC 66) and una corda (CC 67). */
export const TAKE_PEDALS = [64, 66, 67] as const;
export type TakePedal = (typeof TAKE_PEDALS)[number];

/** An event's kind, its second number: a key down, a key up, or the pedal's controller number. */
export const TAKE_ON = 1;
export const TAKE_OFF = 0;

/**
 * One event, as integers: `[ms, 1, key, velocity, step]` a key down, matched to the step (an index
 * into the run's steps, for its hands and repeats) or −1 when it matched none (a wrong or extra
 * note, or one before the run's first window); `[ms, 0, key]` a key up; `[ms, 64 | 66 | 67, value]`
 * a pedal's position (0–127).
 */
export type TakeEvent = readonly number[];

/** The last position of each pedal, before a run starts. */
export type PedalPositions = Readonly<Record<TakePedal, number>>;

export const PEDALS_UP: PedalPositions = { 64: 0, 66: 0, 67: 0 };

/** A take being recorded, in the run's state. */
export interface TakeState {
  /** The run's start on the performance.now() clock: time 0 of the events. */
  origin: number;
  /** The same moment in epoch ms. */
  startedAt: number;
  /** Rhythm mode: the latency taken off every key for the timing (the events keep raw times). */
  latency?: number;
  events: readonly TakeEvent[];
  /** Keys down now, so the take can wait for their release after the run ends. */
  held: readonly number[];
}

/**
 * A take starting at `origin` (performance.now()) = `startedAt` (epoch ms). A pedal already down
 * is written at 0, so the take says what the pedals did from its start.
 */
export function startTake(
  origin: number,
  startedAt: number,
  pedals: PedalPositions = PEDALS_UP,
  latency?: number,
): TakeState {
  return {
    origin,
    startedAt: Math.round(startedAt),
    ...(latency !== undefined && { latency: Math.round(latency) }),
    events: TAKE_PEDALS.filter((c) => pedals[c] > 0).map((c) => [0, c, pedals[c]]),
    held: [],
  };
}

const at = (take: TakeState, time: number) => Math.round(time - take.origin);

export function takeNoteOn(
  take: TakeState,
  time: number,
  key: number,
  velocity: number,
  step: number,
): TakeState {
  return {
    ...take,
    events: [...take.events, [at(take, time), TAKE_ON, key, Math.round(velocity), step]],
    held: take.held.includes(key) ? take.held : [...take.held, key],
  };
}

export function takeNoteOff(take: TakeState, time: number, key: number): TakeState {
  return {
    ...take,
    events: [...take.events, [at(take, time), TAKE_OFF, key]],
    held: take.held.filter((k) => k !== key),
  };
}

export function takePedal(
  take: TakeState,
  time: number,
  controller: TakePedal,
  value: number,
): TakeState {
  return { ...take, events: [...take.events, [at(take, time), controller, Math.round(value)]] };
}

/** A key up or a pedal, for a take (a key down needs its match, see `takeNoteOn`). */
export type TakeInput =
  | { type: 'off'; midi: number; time: number }
  | { type: 'pedal'; controller: TakePedal; value: number; time: number };

export function takeInput(take: TakeState, input: TakeInput): TakeState {
  return input.type === 'off'
    ? takeNoteOff(take, input.time, input.midi)
    : takePedal(take, input.time, input.controller, input.value);
}

/** One stored chunk of a take. */
export interface TakeChunk {
  /** `sessionId:take:n`, n the chunk's position in the take: stable, so imports merge by id. */
  id: string;
  sessionId: string;
  pieceId: string;
  /** `pieceChecksum` of the score as it was practised. */
  checksum: string;
  hands: HandSelection;
  repeats: RepeatMode;
  /** Percent of the score's tempo marks. */
  tempo: number;
  mode?: 'rhythm' | 'memory';
  /** Rhythm mode: the latency taken off for the timing, in ms. */
  latency?: number;
  /**
   * Semitones the piece was moved by (docs/HARMONY.md, H4); absent in the written key. The keys
   * of the events are the keys played; the steps they name are the same in every key.
   */
  transpose?: number;
  /** Epoch ms of time 0: the first key (wait mode), the start of the span (rhythm mode). */
  startedAt: number;
  /** The chunk's position in the take, from 0. */
  chunk: number;
  events: TakeEvent[];
}

export function takeChunkId(sessionId: string, chunk: number): string {
  return `${sessionId}:take:${String(chunk).padStart(3, '0')}`;
}

export function byTakeChunk(a: TakeChunk, b: TakeChunk): number {
  return a.startedAt - b.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** The events of a take in order, from its chunks (of one session). */
export function takeEvents(chunks: readonly TakeChunk[]): TakeEvent[] {
  return [...chunks].sort((a, b) => a.chunk - b.chunk).flatMap((c) => c.events);
}

/** Whether `value` is a well-formed event (see `TakeEvent`). */
export function isTakeEvent(value: unknown): value is TakeEvent {
  if (!Array.isArray(value) || !value.every((n) => Number.isSafeInteger(n))) return false;
  const [, kind, a, b, step] = value as number[];
  const midi = (n: number | undefined) => n !== undefined && n >= 0 && n <= 127;
  if (kind === TAKE_ON)
    return value.length === 5 && midi(a) && midi(b) && step !== undefined && step >= -1;
  if (kind === TAKE_OFF) return value.length === 3 && midi(a);
  return (TAKE_PEDALS as readonly number[]).includes(kind!) && value.length === 3 && midi(a);
}
