// The starting point (docs/START.md): what a visitor says of themselves on the start page — new
// to the piano, or playing already and reading so far. It is a preference of the device, kept in
// the browser and never synced or exported; nothing here measures anything, and nothing is locked
// by it. Pure, and without the rules of any practice: the start of the app reads it too.

import type { LevelId } from './levels.ts';

/**
 * What someone who plays already reads without counting lines: the treble staff, both staves,
 * ledger lines with sharps and flats, or `unknown` for "I would rather find out".
 */
export const READS = ['treble', 'both', 'ledger', 'unknown'] as const;
export type Reads = (typeof READS)[number];

/**
 * Where a visitor starts from. `new`: the lessons begin with the keyboard itself, and a practice
 * opens as its lesson is read. `player`: every practice is open at once, the lessons are not put
 * into Today, and Read's notes begin where the reading does.
 */
export type StartingPoint = { from: 'new' } | { from: 'player'; reads: Reads };

/** The answer before one is given on the start page: what the app does unasked. */
export const DEFAULT_START: StartingPoint = { from: 'new' };
/** What a player reads until they say: nothing is assumed. */
export const DEFAULT_READS: Reads = 'unknown';

/**
 * The starting point read back from the browser's preferences, field by field: only what an
 * answer can hold is kept, and anything else (another version's, a damaged entry) is no answer.
 */
export function readStartingPoint(value: unknown): StartingPoint | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { from, reads } = value as Record<string, unknown>;
  if (from === 'new') return { from: 'new' };
  if (from !== 'player') return null;
  const known = READS.find((r) => r === reads);
  return known ? { from: 'player', reads: known } : null;
}

/** Whether the starting point opens every practice at once: that of someone who plays already. */
export function opensEverything(start: StartingPoint | null): boolean {
  return start?.from === 'player';
}

/**
 * Where Read's notes begin for what a player reads already: the first level beyond it (the bass
 * staff, the grand staff, sharps and flats). Null without one: for a newcomer, and for a player
 * who would rather find out.
 */
const FLOORS: Readonly<Record<Reads, LevelId | null>> = {
  treble: 'L3',
  both: 'L5',
  ledger: 'L7',
  unknown: null,
};

export function readingFloor(start: StartingPoint | null): LevelId | null {
  return start?.from === 'player' ? FLOORS[start.reads] : null;
}
