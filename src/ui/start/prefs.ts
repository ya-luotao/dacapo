import { readStartingPoint, type StartingPoint } from '../../core/startingPoint.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';

// The starting point as it is kept in the browser (docs/START.md): the answer given on the start
// page, changed in Settings. Kept per device like the other preferences, never synced or
// exported. This file is loaded at the start: the home page reads it to know a visitor who
// answered from a first visit.

const START_KEY = 'dacapo.start';

/** The answer kept on this device; null when none was given, or what is kept is not one. */
export function readStartPref(): StartingPoint | null {
  try {
    return readStartingPoint(JSON.parse(readPref(START_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

export function writeStartPref(start: StartingPoint): void {
  writePref(START_KEY, JSON.stringify(start));
}
