/**
 * The practices of the Harmony page (docs/HARMONY.md): Chords, Progressions and Improvise. Each
 * is a section of its own with its setup, and a chooser above them says which is shown.
 */
export const HARMONY_PRACTICES = ['chords', 'progressions', 'improvise'] as const;
export type HarmonyPractice = (typeof HARMONY_PRACTICES)[number];
