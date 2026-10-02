import { isNoteNaming, type NoteNaming } from '../core/noteNames.ts';
import { readPref, writePref } from '../lib/localPrefs.ts';

// How notes are named (docs/PERSONAL.md, "Note names"): kept on the device beside the language,
// letters unless do re mi was asked for.

const STORAGE_KEY = 'dacapo.noteNames';

export function readNoteNaming(): NoteNaming {
  const stored = readPref(STORAGE_KEY);
  return isNoteNaming(stored) ? stored : 'letters';
}

/** Letters are what the app names notes by with nothing kept, so choosing them keeps nothing. */
export function writeNoteNaming(naming: NoteNaming): void {
  writePref(STORAGE_KEY, naming === 'letters' ? null : naming);
}
