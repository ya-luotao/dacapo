/**
 * The practices of the Harmony page (docs/HARMONY.md): Chords now; Progressions and Improvise
 * join it as they are built, each a section of its own with its setup, session and summary, and
 * a chooser above them once there is more than one.
 */
export const HARMONY_PRACTICES = ['chords'] as const;
export type HarmonyPractice = (typeof HARMONY_PRACTICES)[number];
