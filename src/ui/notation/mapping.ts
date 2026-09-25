// Our notes to the renderer's: matched by written onset and pitch, independent of any engine.

import { TICKS_PER_QUARTER, type ScoreNote } from '../../core/score.ts';

/** A note as the renderer reports it. */
export interface DrawnNote<T> {
  item: T;
  /** Written onset in ticks. */
  tick: number;
  midi: number;
  grace: boolean;
}

export interface NoteMapping<T> {
  notes: Map<string, T>;
  /** Our notes that must be pressed but have nothing drawn for them. */
  unplaced: string[];
  /** Matched only by the nearby fallback. */
  nearby: number;
}

/** How far the fallback looks: an engine that plays a grace note on the beat delays the note. */
export const NEARBY_TICKS = TICKS_PER_QUARTER / 2;

type Ours = Pick<ScoreNote, 'id' | 'onset' | 'midi' | 'tieStop'>;

/**
 * Exact matches first; several of ours on the same key and onset (a unison in two voices) take
 * the drawn notes in order. What is left is matched to the nearest drawn note of the same key
 * within `NEARBY_TICKS`. Tied continuations that find nothing are not reported: they are never
 * pressed.
 */
export function matchNotes<T>(
  ours: readonly Ours[],
  drawn: readonly DrawnNote<T>[],
): NoteMapping<T> {
  const pool = new Map<string, DrawnNote<T>[]>();
  for (const d of drawn) {
    if (d.grace) continue;
    const key = `${d.tick}|${d.midi}`;
    const list = pool.get(key);
    if (list) list.push(d);
    else pool.set(key, [d]);
  }
  const notes = new Map<string, T>();
  const left: Ours[] = [];
  for (const n of ours) {
    const d = pool.get(`${n.onset}|${n.midi}`)?.shift();
    if (d) notes.set(n.id, d.item);
    else left.push(n);
  }
  const unplaced: string[] = [];
  let nearby = 0;
  for (const n of left) {
    let best: DrawnNote<T>[] | null = null;
    let distance = Infinity;
    for (const list of pool.values()) {
      const d = list[0];
      if (!d || d.midi !== n.midi) continue;
      const gap = Math.abs(d.tick - n.onset);
      if (gap <= NEARBY_TICKS && gap < distance) {
        best = list;
        distance = gap;
      }
    }
    const d = best?.shift();
    if (d) {
      notes.set(n.id, d.item);
      nearby++;
    } else if (!n.tieStop) unplaced.push(n.id);
  }
  return { notes, unplaced, nearby };
}

/** A renderer's timemap entry, in written order (repeats not expanded). */
export interface TimemapEntry {
  qstamp: number;
  on?: string[];
  measureOn?: string;
}

/**
 * Written ticks of the renderer's note onsets. Each onset is taken relative to the start of its
 * measure and anchored on our measure start, so a measure the engine measures differently (a
 * pickup, an overfull bar) cannot shift the rest.
 */
export function writtenOnsets(
  timemap: readonly TimemapEntry[],
  measureIndex: ReadonlyMap<string, number>,
  measureStarts: readonly number[],
): { id: string; tick: number }[] {
  const out: { id: string; tick: number }[] = [];
  let anchorQ = 0;
  let anchorTick = 0;
  for (const entry of timemap) {
    if (entry.measureOn !== undefined) {
      const index = measureIndex.get(entry.measureOn);
      if (index !== undefined && measureStarts[index] !== undefined) {
        anchorQ = entry.qstamp;
        anchorTick = measureStarts[index];
      }
    }
    const tick = anchorTick + Math.round((entry.qstamp - anchorQ) * TICKS_PER_QUARTER);
    for (const id of entry.on ?? []) out.push({ id, tick });
  }
  return out;
}
