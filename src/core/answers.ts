import type { EarAnswer } from './earSession.ts';
import { isTheoryFamily } from './theoryItems.ts';
import type { TheoryAnswer } from './theorySession.ts';

export { byAnswerTime } from './earSession.ts';

// The `answers` store holds the scored answers of the Ear page and of the theory cards on Read
// (docs/EAR.md, "Records"): two shapes, told apart by their family. Ear answers keep the keys of
// what was played to them and how often it was replayed; theory answers the written notes (or the
// key signature), their staff and whether the letter names were shown.

export type Answer = EarAnswer | TheoryAnswer;

export const isTheoryAnswer = (answer: Answer): answer is TheoryAnswer =>
  isTheoryFamily(answer.family);

export const isEarAnswer = (answer: Answer): answer is EarAnswer => !isTheoryAnswer(answer);
