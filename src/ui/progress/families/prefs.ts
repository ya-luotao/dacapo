import { ANSWER_FAMILIES, type AnswerFamily } from '../../../core/answerProgress.ts';
import { readPref, writePref } from '../../../lib/localPrefs.ts';

/** Which families' sections on the Progress page were opened or folded, remembered per browser. */
export const PROGRESS_PREFS_KEY = 'dacapo.progress';

/** The sections opened or folded by hand; the others follow the default. */
export interface SectionChoices {
  open: AnswerFamily[];
  folded: AnswerFamily[];
}

const familiesIn = (value: unknown, except: readonly AnswerFamily[] = []): AnswerFamily[] =>
  Array.isArray(value)
    ? ANSWER_FAMILIES.filter((family) => value.includes(family) && !except.includes(family))
    : [];

/** The stored choices, in the page's order; anything unknown or broken is left out. */
export function parseSectionChoices(text: string | null): SectionChoices {
  try {
    const value: unknown = text === null ? null : JSON.parse(text);
    if (typeof value !== 'object' || value === null) return { open: [], folded: [] };
    const { open, folded } = value as { open?: unknown; folded?: unknown };
    const opened = familiesIn(open);
    // A family in both lists is left to the default.
    const shut = familiesIn(folded);
    return {
      open: opened.filter((f) => !shut.includes(f)),
      folded: shut.filter((f) => !opened.includes(f)),
    };
  } catch {
    return { open: [], folded: [] };
  }
}

/**
 * Whether a section is open: as it was last opened or folded by hand, otherwise only the family
 * practised most recently.
 */
export function isSectionOpen(
  family: AnswerFamily,
  choices: SectionChoices,
  latest: AnswerFamily | null,
): boolean {
  if (choices.open.includes(family)) return true;
  if (choices.folded.includes(family)) return false;
  return family === latest;
}

/** The choices after a section is opened or folded by hand. */
export function chooseSection(
  choices: SectionChoices,
  family: AnswerFamily,
  open: boolean,
): SectionChoices {
  const others = (list: readonly AnswerFamily[]) => list.filter((f) => f !== family);
  return open
    ? { open: familiesIn([...choices.open, family]), folded: others(choices.folded) }
    : { open: others(choices.open), folded: familiesIn([...choices.folded, family]) };
}

export const readSectionChoices = (): SectionChoices =>
  parseSectionChoices(readPref(PROGRESS_PREFS_KEY));

export function writeSectionChoices(choices: SectionChoices): void {
  writePref(PROGRESS_PREFS_KEY, JSON.stringify(choices));
}
