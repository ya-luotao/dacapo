import { describe, expect, it } from 'vitest';
import { canonicalText } from '../lib/canonical.ts';
import { MAX_BODY_BYTES, byteLength } from '../sync/records.ts';
import {
  isTakeEvent,
  PEDALS_UP,
  startTake,
  TAKE_CHUNK_EVENTS,
  takeChunkId,
  takeEvents,
  takeInput,
  takeNoteOff,
  takeNoteOn,
  takePedal,
  type TakeChunk,
} from './takes.ts';

describe('a take', () => {
  it('writes events as integers in ms from its start, and knows the keys held', () => {
    let take = startTake(1000.4, 1_700_000_000_000.6);
    take = takeNoteOn(take, 1000.4, 60, 80.2, 0);
    take = takePedal(take, 1100, 64, 127);
    take = takeNoteOn(take, 1250.6, 64, 70, -1);
    take = takeNoteOff(take, 1400, 60);
    expect(take.startedAt).toBe(1_700_000_000_001);
    expect(take.events).toEqual([
      [0, 1, 60, 80, 0],
      [100, 64, 127],
      [250, 1, 64, 70, -1],
      [400, 0, 60],
    ]);
    expect(take.held).toEqual([64]);
    expect(takeInput(take, { type: 'off', midi: 64, time: 1500 }).held).toEqual([]);
  });

  it('writes the pedals already down at its start, and the latency it was timed with', () => {
    const take = startTake(0, 0, { ...PEDALS_UP, 64: 100, 67: 127 }, 23.4);
    expect(take.events).toEqual([
      [0, 64, 100],
      [0, 67, 127],
    ]);
    expect(take.latency).toBe(23);
    expect(startTake(0, 0).events).toEqual([]);
    expect('latency' in startTake(0, 0)).toBe(false);
  });

  it('keeps negative times: a rhythm run’s count-in comes before its start', () => {
    const take = takeNoteOn(startTake(5000, 0), 4200, 60, 64, -1);
    expect(take.events).toEqual([[-800, 1, 60, 64, -1]]);
  });

  it('tells a well-formed event from a malformed one', () => {
    for (const event of [
      [0, 1, 60, 80, 3],
      [-5, 1, 127, 1, -1],
      [7, 0, 0],
      [9, 64, 0],
      [9, 66, 127],
      [9, 67, 64],
    ])
      expect(isTakeEvent(event), JSON.stringify(event)).toBe(true);
    for (const event of [
      [0, 1, 60, 80],
      [0, 1, 60, 80, -2],
      [0, 1, 128, 80, 0],
      [0, 0, 60, 1],
      [0, 65, 10],
      [0, 64, 128],
      [0.5, 0, 60],
      ['0', 0, 60],
      [],
      'x',
    ])
      expect(isTakeEvent(event), JSON.stringify(event)).toBe(false);
  });

  it('keeps a full chunk well under the 64 KB of a synced record, whatever its numbers', () => {
    // The largest numbers a long run can have: 7-digit times, 3-digit keys and velocities, and
    // 5-digit steps.
    const events = Array.from({ length: TAKE_CHUNK_EVENTS }, (_, i) =>
      i % 2 === 0 ? [9_999_999, 1, 127, 127, 99_999] : [9_999_999, 0, 127],
    );
    const chunk: TakeChunk = {
      id: takeChunkId('0f8fad5b-d9cb-469f-a165-70867728950e', 999),
      sessionId: '0f8fad5b-d9cb-469f-a165-70867728950e',
      pieceId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      checksum: 'ffffffff',
      hands: 'right',
      repeats: 'play',
      tempo: 200,
      mode: 'rhythm',
      latency: -150,
      startedAt: 1_800_000_000_000,
      chunk: 999,
      events,
    };
    const size = byteLength(canonicalText(chunk));
    expect(size).toBeLessThan(MAX_BODY_BYTES * 0.75);
    // Even with every event a key down.
    const downs = { ...chunk, events: events.map(() => [9_999_999, 1, 127, 127, 99_999]) };
    expect(byteLength(canonicalText(downs))).toBeLessThan(MAX_BODY_BYTES);
  });

  it('puts a take’s chunks back together in order', () => {
    const chunk = (n: number, events: number[][]) => ({ chunk: n, events }) as unknown as TakeChunk;
    expect(takeEvents([chunk(1, [[5, 0, 60]]), chunk(0, [[0, 1, 60, 80, 0]])])).toEqual([
      [0, 1, 60, 80, 0],
      [5, 0, 60],
    ]);
  });
});
