// What the lesson on touch hears in your playing: whether five notes get louder, and how each note
// joins the next. The numbers are the ones docs/EXPRESSION.md plans for the Pieces (its X2), so a
// lesson and the Pieces will agree; the Pieces' own analysis will live in core/expression.ts.

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

/** A note let go this long before the next begins has left a gap (EXPRESSION.md, X2). */
export const LEGATO_GAP_MS = 20;
/** A note held this long into the next smudges it. */
export const LEGATO_OVERLAP_MS = 80;

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
