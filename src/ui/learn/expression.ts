// What the lessons on touch and the pedals hear in your playing: whether five notes get louder,
// how each note joins the next, and whether the pedal changes just after each new chord. The
// numbers are the Pieces' (docs/EXPRESSION.md, X2 and X3), so a lesson and the Pieces agree: the
// legato and pedal ones are core/expression.ts's own.

import {
  CHANGE_MAX_MS,
  LEGATO_GAP_MS,
  LEGATO_OVERLAP_MS,
  RELEASE_MAX_MS,
} from '../../core/expression.ts';

/** A note as played: when the key went down and came up (null while held), and how hard. */
export interface Stroke {
  midi: number;
  on: number;
  off: number | null;
  velocity: number;
}

// Getting louder.

/**
 * How much louder the last note must be than the first when not every note is louder than the
 * one before: 15% of the whole range of velocities (1 to 127), about 19. One keyboard's velocities
 * differ from another's, so nothing asks for a particular loudness, only for a rise.
 */
export const CRESCENDO_RISE = Math.round(0.15 * 126);

/** Below this spread, the notes were all as loud as each other (as the computer keys play). */
const EVEN_SPREAD = 4;

export type CrescendoVerdict =
  /** Every note louder than the one before. */
  | 'rising'
  /** Not every step, but the last is the loudest and well above the first. */
  | 'overall'
  /** All about as loud: no crescendo at all. */
  | 'even'
  /** Louder and softer, or softer overall. */
  | 'not';

export function judgeCrescendo(velocities: readonly number[]): CrescendoVerdict {
  if (velocities.length < 2) return 'not';
  if (velocities.every((v, i) => i === 0 || v > velocities[i - 1]!)) return 'rising';
  const first = velocities[0]!;
  const last = velocities.at(-1)!;
  const loudest = Math.max(...velocities);
  if (last - first >= CRESCENDO_RISE && last >= loudest) return 'overall';
  if (loudest - Math.min(...velocities) < EVEN_SPREAD) return 'even';
  return 'not';
}

export function isCrescendo(verdict: CrescendoVerdict): boolean {
  return verdict === 'rising' || verdict === 'overall';
}

// Joined and detached.

/** How legato is judged, the same as the Pieces' (EXPRESSION.md, X2): a gap, and an overlap. */
export { LEGATO_GAP_MS, LEGATO_OVERLAP_MS };

export type Join =
  /** Let go as the next note began, give or take a little: legato. */
  | { kind: 'joined'; ms: number }
  /** Silence between them, `ms` long. */
  | { kind: 'gap'; ms: number }
  /** Held `ms` into the next note: more than a legato needs. */
  | { kind: 'overlap'; ms: number };

/**
 * How a note met the next one: `ms` is the silence between them (a gap), or how long they sounded
 * together (an overlap). A note still held overlaps the next by as long as both have been down,
 * until `now`.
 */
export function joinOf(note: Stroke, next: Stroke, now: number): Join {
  const between = next.on - (note.off ?? now);
  if (between > LEGATO_GAP_MS) return { kind: 'gap', ms: Math.round(between) };
  if (-between > LEGATO_OVERLAP_MS) return { kind: 'overlap', ms: Math.round(-between) };
  return { kind: 'joined', ms: Math.round(Math.abs(between)) };
}

/** How much of the time to the next note a note was held: 1 is all of it. */
export function heldShare(note: Stroke, next: Stroke, now: number): number {
  const span = next.on - note.on;
  if (span <= 0) return 1;
  return ((note.off ?? now) - note.on) / span;
}

// Changing the pedal.

/**
 * The pedal goes up at most `CHANGE_MAX_MS` after a new chord and down again at most
 * `RELEASE_MAX_MS` after it went up: the Pieces' own (EXPRESSION.md, X3).
 */
export { CHANGE_MAX_MS, RELEASE_MAX_MS };

/** The sustain pedal going down or up. */
export interface PedalEvent {
  down: boolean;
  time: number;
}

export type PedalChange =
  /** Not decided yet: the pedal may still go up, or down again. */
  | { kind: 'pending' }
  /** Up after the chord, within CHANGE_MAX_MS, and down again within RELEASE_MAX_MS. */
  | { kind: 'clean'; up: number; down: number }
  /** Lifted `ms` before the chord was played: a gap in the sound. */
  | { kind: 'early'; ms: number }
  /** Lifted `ms` after the chord, too late: the old chord blurred into the new one. */
  | { kind: 'late'; ms: number }
  /** Not lifted before the next chord: the chords ran into each other. */
  | { kind: 'held' }
  /** Lifted in time, but down again only `ms` later: the new chord went unheld. */
  | { kind: 'slow'; ms: number }
  /** The pedal was not down when the chord came: nothing to change. */
  | { kind: 'none' };

/** Whether the pedal is down at `time`, from its events in order. */
export function pedalDownAt(pedal: readonly PedalEvent[], time: number): boolean {
  let down = false;
  for (const e of pedal) {
    if (e.time > time) break;
    down = e.down;
  }
  return down;
}

/**
 * Each pedal change, one for every chord after the first: `chords` are when each chord was played,
 * in order; `pedal` the pedal's events, in order, from before the first chord; `now` the present.
 * The first chord only starts the pedal. For each later chord it should come up just after the
 * chord and go down again straight away (legato, or syncopated, pedalling).
 */
export function judgePedalChanges(
  chords: readonly number[],
  pedal: readonly PedalEvent[],
  now: number,
): PedalChange[] {
  const changes: PedalChange[] = [];
  // Where the last change ended: events before it belong to earlier chords. After the first chord,
  // the pedal's first press.
  const first = chords[0] ?? 0;
  let since = pedal.find((e) => e.down && e.time > first)?.time ?? first;
  for (let k = 1; k < chords.length; k++) {
    const at = chords[k]!;
    const next = chords[k + 1] ?? Infinity;
    const lifted = pedal.findLast((e) => !e.down && e.time > since && e.time <= at);
    if (lifted) {
      // Up before the chord (and maybe down again before it too): the sound broke.
      changes.push({ kind: 'early', ms: Math.round(at - lifted.time) });
      since = pedal.find((e) => e.down && e.time > lifted.time && e.time < next)?.time ?? at;
      continue;
    }
    if (!pedalDownAt(pedal, at)) {
      changes.push({ kind: 'none' });
      since = pedal.find((e) => e.down && e.time > at && e.time < next)?.time ?? at;
      continue;
    }
    const up = pedal.find((e) => !e.down && e.time > at && e.time < next);
    if (!up) {
      since = at;
      if (next !== Infinity) changes.push({ kind: 'held' });
      else if (now - at > CHANGE_MAX_MS) changes.push({ kind: 'late', ms: Math.round(now - at) });
      else changes.push({ kind: 'pending' });
      continue;
    }
    const late = up.time - at;
    const down = pedal.find((e) => e.down && e.time > up.time && e.time < next);
    since = down?.time ?? up.time;
    if (late > CHANGE_MAX_MS) {
      changes.push({ kind: 'late', ms: Math.round(late) });
      continue;
    }
    if (!down) {
      const waited = Math.min(next, now) - up.time;
      changes.push(
        waited > RELEASE_MAX_MS ? { kind: 'slow', ms: Math.round(waited) } : { kind: 'pending' },
      );
      continue;
    }
    const again = down.time - up.time;
    changes.push(
      again > RELEASE_MAX_MS
        ? { kind: 'slow', ms: Math.round(again) }
        : { kind: 'clean', up: Math.round(late), down: Math.round(again) },
    );
  }
  return changes;
}
