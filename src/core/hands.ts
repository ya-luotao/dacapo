// Which staff each hand plays. A score may hold other instruments too (a voice over the piano);
// only the piano's staves are practised, the rest is drawn as accompaniment.

import { staffKey, type Hand, type PartInfo, type StaffHands } from './score.ts';

const PIANO_NAME = /piano|pno|klavier|clavier|keyboard|钢琴|鋼琴/i;

/** General MIDI programs 1–8 are the pianos. */
const isPianoProgram = (program: number | null) => program !== null && program >= 1 && program <= 8;

export function isPianoLike(part: PartInfo): boolean {
  return (
    PIANO_NAME.test(part.name) || PIANO_NAME.test(part.instrument) || isPianoProgram(part.program)
  );
}

export interface DetectedHands {
  hands: StaffHands;
  /** No part looked like a piano; the first parts were taken as right and left hand. */
  guessed: boolean;
}

/**
 * The piano is the first part with two staves (a piano-like one preferred): staff 1 is the right
 * hand, the others the left. Otherwise two single-staff piano parts are right and left hand, in
 * score order. Failing both, the first part is the right hand and the second the left.
 */
export function detectHands(parts: readonly PartInfo[]): DetectedHands {
  const hands: Record<string, Hand | null> = {};
  for (const part of parts)
    for (let staff = 1; staff <= part.staves; staff++) hands[staffKey(part.index, staff)] = null;

  const grand = parts.filter((p) => p.staves >= 2);
  const piano = grand.find(isPianoLike) ?? grand[0];
  if (piano) {
    for (let staff = 1; staff <= piano.staves; staff++)
      hands[staffKey(piano.index, staff)] = staff === 1 ? 'right' : 'left';
    return { hands, guessed: false };
  }

  const single = parts.filter(isPianoLike);
  const guessed = single.length === 0;
  const [right, left] = guessed ? parts : single;
  if (right) hands[staffKey(right.index, 1)] = 'right';
  if (left) hands[staffKey(left.index, 1)] = 'left';
  // One part alone is simply a one-staff piece, not a guess.
  return { hands, guessed: guessed && parts.length > 1 };
}

/** The detected hands with a piece's override on top; keys the score does not have are ignored. */
export function applyHands(detected: StaffHands, override: StaffHands | null): StaffHands {
  if (!override) return detected;
  const out: Record<string, Hand | null> = { ...detected };
  for (const key of Object.keys(detected)) if (key in override) out[key] = override[key]!;
  return out;
}

export function isStaffHands(value: unknown): value is StaffHands {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, hand]) =>
      /^\d{1,3}\.\d{1,2}$/.test(key) && (hand === 'right' || hand === 'left' || hand === null),
  );
}
