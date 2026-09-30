import { isHarmonyFamily } from './chordSymbols.ts';
import { EAR_FAMILIES } from './earItems.ts';
import type { EarAnswer } from './earSession.ts';
import type { ChordSymbolAnswer } from './harmonySession.ts';
import { isRhythmEarFamily, type RhythmEarAnswer } from './rhythmEar.ts';
import { isRhythmFamily, type RhythmAnswer } from './rhythmRead.ts';
import { isTheoryFamily } from './theoryItems.ts';
import type { TheoryAnswer } from './theorySession.ts';

export { byAnswerTime } from './earSession.ts';

// The `answers` store holds the scored answers of the Ear page and of the theory cards on Read
// (docs/EAR.md, "Records"), of rhythm on Read and rhythm dictation on Ear (docs/READING.md) and
// of the chord symbols on Harmony (docs/HARMONY.md), told apart by their family. Ear answers keep
// the keys of what was played to them and how often it was replayed; theory answers the written
// notes (or the key signature), their staff and whether the letter names were shown. Rhythm
// (family `rhythm`) keeps one answer per cell played: its onsets and how each was timed; rhythm
// dictation (family `rhythmEar`) one per cell tapped back, or one per bar chosen. Chord-symbol
// answers keep the symbol, the keys held and whether its notes were shown.

export type Answer = EarAnswer | TheoryAnswer | RhythmAnswer | RhythmEarAnswer | ChordSymbolAnswer;

export const isTheoryAnswer = (answer: Answer): answer is TheoryAnswer =>
  isTheoryFamily(answer.family);

export const isRhythmAnswer = (answer: Answer): answer is RhythmAnswer =>
  isRhythmFamily(answer.family);

export const isChordSymbolAnswer = (answer: Answer): answer is ChordSymbolAnswer =>
  isHarmonyFamily(answer.family);

export const isRhythmEarAnswer = (answer: Answer): answer is RhythmEarAnswer =>
  isRhythmEarFamily(answer.family);

/**
 * Ear's intervals, chords and melodies by name, so that no other family's answers (rhythm
 * dictation's among them) are ever taken for theirs.
 */
export const isEarAnswer = (answer: Answer): answer is EarAnswer =>
  (EAR_FAMILIES as readonly string[]).includes(answer.family);
