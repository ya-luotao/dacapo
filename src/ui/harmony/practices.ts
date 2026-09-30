/**
 * The practices of the Harmony page (docs/HARMONY.md): Chords and Progressions; Improvise joins
 * them when it is built. Each is a section of its own with its setup, and a chooser above them
 * says which is shown.
 */
export const HARMONY_PRACTICES = ['chords', 'progressions'] as const;
export type HarmonyPractice = (typeof HARMONY_PRACTICES)[number];
