// The curriculum (docs/TODAY.md): which lesson of Learn opens which practice, the order the scales
// are first met in, and the piece to begin next. It is the one place that joins the lessons and
// the practices. Nothing here locks anything: "open" only decides what today's plan and "Where
// you are" propose, and no page reads it. Pure, and without the rules of any practice.

import { LESSONS } from '../learn/lessons.ts';
import type { Answer } from './answers.ts';
import type { LevelFamily } from './assignmentRecords.ts';
import type { SessionRecord } from './log.ts';
import type { Attempt } from './session.ts';
import { opensEverything, type StartingPoint } from './startingPoint.ts';

/** What can be proposed: every family with levels, the scales and the pieces. */
export type Practice = LevelFamily | 'scales' | 'pieces';

/**
 * The lesson each practice opens with, by its slug; null for the one that is open from the
 * start. Harmony's progressions and Improvise, the metronome and free play have no levels and no
 * record of how far one has got: they are not here, and are never proposed.
 */
export const OPENS_WITH: Readonly<Record<Practice, string | null>> = {
  notes: null,
  readInterval: 'landmarks',
  keySignature: 'major-scale',
  readChord: 'chords',
  rhythm: 'rhythm',
  sight: 'rhythm',
  interval: 'landmarks',
  chord: 'chords',
  echo: 'major-scale',
  cadence: 'chords',
  tune: 'major-scale',
  rhythmEar: 'rhythm',
  chordSymbol: 'chords',
  scales: 'major-scale',
  pieces: 'landmarks',
};

/** The lessons that can be read, in order: the fifteen. */
export const CURRICULUM_LESSONS: readonly string[] = LESSONS.filter((l) => l.ready).map(
  (l) => l.slug,
);

/** A lesson's number as the Learn page counts it (the first is 1); 0 for none of them. */
export function lessonNumber(slug: string): number {
  return LESSONS.findIndex((lesson) => lesson.slug === slug) + 1;
}

/** The first lesson not ticked, or null once all are. */
export function nextLesson(lessonsDone: ReadonlySet<string>): string | null {
  return CURRICULUM_LESSONS.find((slug) => !lessonsDone.has(slug)) ?? null;
}

// --- Open ----------------------------------------------------------------------------------------

/** The practice a session belongs to; null for one that is never proposed (free play, Improvise). */
export function sessionPractice(session: SessionRecord): Practice | null {
  switch (session.kind) {
    case 'read':
      return 'notes';
    case 'theory':
    case 'ear':
    case 'harmony':
      return session.family;
    case 'rhythm':
      return 'rhythm';
    case 'sight':
      return 'sight';
    case 'scale':
      return 'scales';
    case 'piece':
      return 'pieces';
    default:
      return null;
  }
}

/** The records that show a practice was gone to: those of whoever practises. */
export interface PractisedInput {
  sessions: readonly SessionRecord[];
  attempts: readonly Attempt[];
  answers: readonly Answer[];
  /** A piece was imported here: someone means to play it. */
  imported: boolean;
}

/**
 * The practices the player has a record of: a session, an answer (a tab closed before its
 * session was stored leaves answers alone), a run; for Pieces an imported piece too.
 */
export function practised(input: PractisedInput): Set<Practice> {
  const found = new Set<Practice>();
  for (const session of input.sessions) {
    const practice = sessionPractice(session);
    if (practice) found.add(practice);
  }
  if (input.attempts.length > 0) found.add('notes');
  for (const answer of input.answers) found.add(answer.family);
  if (input.imported) found.add('pieces');
  return found;
}

/**
 * Whether a practice is open: its lesson is ticked, or the player has a record of it, or they
 * said on the start page that they play already (`start`, docs/START.md), which opens every
 * practice at once. Someone who went there on their own, or who needs no lesson, is not sent
 * back to one.
 */
export function isOpen(
  practice: Practice,
  lessonsDone: ReadonlySet<string>,
  records: ReadonlySet<Practice>,
  start: StartingPoint | null = null,
): boolean {
  const lesson = OPENS_WITH[practice];
  return (
    lesson === null || lessonsDone.has(lesson) || records.has(practice) || opensEverything(start)
  );
}

// --- A practice names its lesson -----------------------------------------------------------------

/** Scale runs recorded, of any exercise, after which the Scales page no longer names its lesson. */
export const KNOWN_SCALE_RUNS = 5;

/** Whether one of a practice's levels is mastered: whoever has one knows the practice. */
export function anyMastered(levels: Iterable<{ mastered: boolean } | undefined>): boolean {
  for (const level of levels) if (level?.mastered) return true;
  return false;
}

/**
 * The lesson a practice's page names to someone new to it ("New to this? Lesson 4, Rhythm and
 * the beat"): the one that opens the practice, until it is ticked or the practice is `known` —
 * a level of it mastered; for Scales `KNOWN_SCALE_RUNS` runs recorded; for Pieces a piece played
 * to its end. Someone who knows it is not told again, and neither is someone who said on the
 * start page that they play already (`start`, docs/START.md): every practice is open to them,
 * and none is new. Null for the practice open from the start, which no lesson opens.
 */
export function lessonToRead(
  practice: Practice,
  lessonsDone: ReadonlySet<string>,
  known: boolean,
  start: StartingPoint | null = null,
): string | null {
  const lesson = OPENS_WITH[practice];
  if (lesson === null || known || opensEverything(start)) return null;
  return lessonsDone.has(lesson) ? null : lesson;
}

// --- The scale ladder ----------------------------------------------------------------------------

/** The lesson on minor keys: once it is ticked, the ladder has each key's relative minor too. */
export const MINOR_LESSON = 'minor-keys';

/**
 * The major keys in the order they are first met (none, one, one, two … sharps or flats), each
 * with its relative minor as the Scales page spells it: F♯ major's is E♭ minor, the keys of D♯
 * minor.
 */
const LADDER_KEYS: readonly (readonly [major: string, minor: string])[] = [
  ['C', 'A'],
  ['G', 'E'],
  ['F', 'D'],
  ['D', 'B'],
  ['A', 'F#'],
  ['E', 'C#'],
  ['Bb', 'G'],
  ['Eb', 'C'],
  ['B', 'G#'],
  ['Ab', 'F'],
  ['F#', 'Eb'],
  ['Db', 'Bb'],
];

/** The three rungs of a key: one octave with each hand, then two octaves hands together. */
const RUNGS = ['1:right', '1:left', '2:both'] as const;

/**
 * The ladder: the scales in the order a learner first meets them, each rung an exercise key
 * (`major:C:1:right`; a test holds every one to `parseExerciseKey`, so this file needs none of
 * the exercises' rules). With `minor`, each major key's rungs are followed by its relative
 * harmonic minor's. Arpeggios, contrary motion and technique are the player's choice.
 */
export function scaleLadder(minor: boolean): string[] {
  return LADDER_KEYS.flatMap(([major, relative]) => [
    ...RUNGS.map((rung) => `major:${major}:${rung}`),
    ...(minor ? RUNGS.map((rung) => `harmonicMinor:${relative}:${rung}`) : []),
  ]);
}

/**
 * The next scale never played: the ladder's first rung without a recorded run (`played`: the
 * exercise keys that have one). Null once every rung has been played.
 */
export function nextRung(
  played: ReadonlySet<string>,
  lessonsDone: ReadonlySet<string>,
): string | null {
  return scaleLadder(lessonsDone.has(MINOR_LESSON)).find((rung) => !played.has(rung)) ?? null;
}

// --- The next piece ------------------------------------------------------------------------------

/** A piece as the curriculum sees it. */
export interface CurriculumPiece {
  id: string;
  /** A built-in piece's grade (0: Initial); null for an imported piece. */
  grade: number | null;
  /** A lead sheet: a melody with chord symbols, nothing written for the left hand. */
  leadSheet: boolean;
}

/**
 * The piece to begin when none is in hand: of the built-in pieces written for two hands that
 * have no session at all (`started`: the pieces that have one), the first by grade and then by
 * the library's order (`pieces` is in it), no more than one grade above the highest grade of a
 * built-in piece played to its end (`finished`); Initial only, when none has been. Null when no
 * piece is left within that: the library is the player's to choose from. Lead sheets and imported
 * pieces are not proposed.
 */
export function nextPiece(
  pieces: readonly CurriculumPiece[],
  started: ReadonlySet<string>,
  finished: ReadonlySet<string>,
): string | null {
  const grades = pieces.flatMap((p) => (p.grade !== null && finished.has(p.id) ? [p.grade] : []));
  const limit = grades.length > 0 ? Math.max(...grades) + 1 : 0;
  let next: { id: string; grade: number } | null = null;
  for (const piece of pieces) {
    if (piece.grade === null || piece.leadSheet || started.has(piece.id)) continue;
    if (piece.grade > limit) continue;
    if (next === null || piece.grade < next.grade) next = { id: piece.id, grade: piece.grade };
  }
  return next?.id ?? null;
}
