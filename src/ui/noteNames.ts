import { useMemo } from 'react';
import { createNoteNames, type NoteNames, type NoteNaming } from '../core/noteNames.ts';
import { useI18n, type MessageKey } from '../i18n/index.ts';

export type { NoteNames };

/**
 * The names of notes as the reader asked for them (docs/PERSONAL.md, "Note names"): letters, or
 * do re mi in the language's own script. Every note and key of the keyboard that `ui/` names is
 * named through this, alone or by the formatter of its page; `core/note.ts`'s own names are for
 * what keeps the letters (a key or a scale, a chord and its symbol, the lessons), and
 * `noteNames.test.ts` keeps them out of everything else.
 */
export function useNoteNames(): NoteNames {
  const { noteNaming, locale } = useI18n();
  return useMemo(() => createNoteNames(noteNaming, locale), [noteNaming, locale]);
}

/**
 * What Read's hint is called: "Show letter names" while the names are letters, "Show note names"
 * once they are do re mi. Its toggle, and what a screen reader hears before one name or several.
 */
const HINT_WORDS = {
  letters: { toggle: 'read.hint', one: 'read.hint.label', several: 'theory.hint.label' },
  solfege: {
    toggle: 'settings.noteNames.hint',
    one: 'settings.noteNames.hint.label',
    several: 'settings.noteNames.hint.labels',
  },
} as const satisfies Record<NoteNaming, Record<string, MessageKey>>;

export function useHintWords(): (typeof HINT_WORDS)[NoteNaming] {
  return HINT_WORDS[useI18n().noteNaming];
}
