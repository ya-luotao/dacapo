import { describe, expect, it } from 'vitest';
import { LESSONS } from '../learn/lessons.ts';
import { BUILT_IN } from '../pieces/library/index.ts';
import {
  sampleAnswer,
  sampleAttempt,
  sampleEarSession,
  sampleHarmonySession,
  sampleRhythmEarSession,
  sampleRhythmSession,
  sampleScaleSession,
  sampleSightSession,
  sampleTheorySession,
  sampleTuneSession,
} from '../storage/fixtures.ts';
import { LEVEL_FAMILIES } from './assignments.ts';
import {
  CURRICULUM_LESSONS,
  isOpen,
  lessonNumber,
  MINOR_LESSON,
  nextLesson,
  nextPiece,
  nextRung,
  OPENS_WITH,
  practised,
  scaleLadder,
  sessionPractice,
  type CurriculumPiece,
  type Practice,
  type PractisedInput,
} from './curriculum.ts';
import type { SessionRecord } from './log.ts';
import { MAJOR_TONICS, MINOR_TONICS, parseExerciseKey } from './scales.ts';
import { recoverSummary } from './session.ts';

const NONE: PractisedInput = { sessions: [], attempts: [], answers: [], imported: false };
const ticked = (...slugs: string[]) => new Set(slugs);

describe('which lesson opens which practice', () => {
  it('names a lesson of Learn for every practice but the notes', () => {
    for (const [practice, slug] of Object.entries(OPENS_WITH)) {
      if (practice === 'notes') expect(slug).toBeNull();
      else expect(CURRICULUM_LESSONS, practice).toContain(slug);
    }
    // Every family the pages have is in the table, with the scales and the pieces.
    expect(Object.keys(OPENS_WITH).sort()).toEqual([...LEVEL_FAMILIES, 'pieces', 'scales'].sort());
  });

  it('follows the table of the specification, lesson by number', () => {
    const number = (practice: Practice) => {
      const slug = OPENS_WITH[practice];
      return slug === null ? 0 : lessonNumber(slug);
    };
    const byLesson: Record<number, Practice[]> = {
      0: ['notes'],
      3: ['readInterval', 'interval', 'pieces'],
      4: ['rhythm', 'sight', 'rhythmEar'],
      6: ['keySignature', 'echo', 'tune', 'scales'],
      13: ['readChord', 'chord', 'cadence', 'chordSymbol'],
    };
    for (const [lesson, practices] of Object.entries(byLesson)) {
      for (const practice of practices) expect(number(practice), practice).toBe(Number(lesson));
    }
    expect(Object.values(byLesson).flat()).toHaveLength(Object.keys(OPENS_WITH).length);
    expect(lessonNumber(MINOR_LESSON)).toBe(9);
    expect(lessonNumber('inside')).toBe(0);
  });

  it('counts the fifteen lessons, and finds the first not ticked', () => {
    expect(CURRICULUM_LESSONS).toHaveLength(15);
    expect(CURRICULUM_LESSONS).toEqual(LESSONS.map((l) => l.slug));
    expect(nextLesson(ticked())).toBe('keyboard');
    // A lesson read out of order leaves the first gap as the next.
    expect(nextLesson(ticked('keyboard', 'staff', 'rhythm'))).toBe('landmarks');
    expect(nextLesson(new Set(CURRICULUM_LESSONS))).toBeNull();
    // A page beside the lessons is no lesson of the fifteen.
    expect(nextLesson(ticked('inside'))).toBe('keyboard');
  });
});

describe('a practice is open', () => {
  it('once its lesson is ticked', () => {
    const none = practised(NONE);
    expect(isOpen('notes', ticked(), none)).toBe(true);
    for (const practice of Object.keys(OPENS_WITH) as Practice[]) {
      const slug = OPENS_WITH[practice];
      if (slug === null) continue;
      expect(isOpen(practice, ticked(), none), practice).toBe(false);
      expect(isOpen(practice, ticked(slug), none), practice).toBe(true);
    }
    // Lesson 6 opens the scales, key signatures, Echo and the tunes, and nothing of lesson 13.
    const six = ticked('major-scale');
    expect(isOpen('scales', six, none)).toBe(true);
    expect(isOpen('tune', six, none)).toBe(true);
    expect(isOpen('chordSymbol', six, none)).toBe(false);
  });

  it('once the player has a session of it, whatever the lessons', () => {
    const read = sampleAttempt(0);
    const sessions: [Practice, SessionRecord][] = [
      ['notes', { kind: 'read', ...recoverSummary([read])! }],
      ['readInterval', sampleTheorySession('t1', 2).session],
      ['rhythm', sampleRhythmSession('r1', 1).session],
      ['sight', sampleSightSession('g1', 2)],
      ['interval', sampleEarSession('e1', 2).session],
      ['tune', sampleTuneSession('u1').session],
      ['rhythmEar', sampleRhythmEarSession('d1', 1).session],
      ['chordSymbol', sampleHarmonySession('h1', 2).session],
      ['scales', sampleScaleSession('k1', 1).session],
    ];
    for (const [practice, session] of sessions) {
      expect(sessionPractice(session), practice).toBe(practice);
      const had = practised({ ...NONE, sessions: [session] });
      expect([...had], practice).toEqual([practice]);
      expect(isOpen(practice, ticked(), had), practice).toBe(true);
    }
  });

  it('once there is an answer or a run of it without a session', () => {
    // A tab closed before the session was stored leaves the answers alone.
    expect([...practised({ ...NONE, attempts: [sampleAttempt(0)] })]).toEqual(['notes']);
    expect([...practised({ ...NONE, answers: [sampleAnswer(0)] })]).toEqual(['interval']);
    const chords = practised({ ...NONE, answers: sampleHarmonySession('h1', 1).answers });
    expect(isOpen('chordSymbol', ticked(), chords)).toBe(true);
    expect(isOpen('chord', ticked(), chords)).toBe(false);
  });

  it('Pieces by a run of a piece, or by a piece imported', () => {
    const run: SessionRecord = {
      kind: 'piece',
      id: 'p1',
      pieceId: 'beethoven-ode-to-joy',
      title: 'Ode to Joy',
      hands: 'right',
      loop: null,
      repeats: 'play',
      tempo: 100,
      startedAt: 0,
      endedAt: 60_000,
      activeMs: 60_000,
      steps: 20,
      wrong: 0,
      completed: false,
    };
    expect(isOpen('pieces', ticked(), practised(NONE))).toBe(false);
    expect(isOpen('pieces', ticked(), practised({ ...NONE, sessions: [run] }))).toBe(true);
    expect(isOpen('pieces', ticked(), practised({ ...NONE, imported: true }))).toBe(true);
  });

  it('never by free play or an improvisation', () => {
    const free: SessionRecord = {
      kind: 'free',
      id: 'f1',
      startedAt: 0,
      endedAt: 300_000,
      activeMs: 300_000,
      notes: 400,
    };
    expect(sessionPractice(free)).toBeNull();
    expect(practised({ ...NONE, sessions: [free] }).size).toBe(0);
  });
});

describe('the scale ladder', () => {
  it('names an exercise of the Scales page on every rung', () => {
    for (const minor of [false, true]) {
      const ladder = scaleLadder(minor);
      for (const rung of ladder) expect(parseExerciseKey(rung), rung).not.toBeNull();
      expect(new Set(ladder).size).toBe(ladder.length);
    }
  });

  it('goes through the twelve major keys in order, three rungs each', () => {
    const ladder = scaleLadder(false);
    expect(ladder).toHaveLength(36);
    expect(ladder.slice(0, 4)).toEqual([
      'major:C:1:right',
      'major:C:1:left',
      'major:C:2:both',
      'major:G:1:right',
    ]);
    const keys = ladder.filter((rung) => rung.endsWith(':2:both')).map((r) => r.split(':')[1]);
    expect(keys).toEqual(['C', 'G', 'F', 'D', 'A', 'E', 'Bb', 'Eb', 'B', 'Ab', 'F#', 'Db']);
    expect([...keys].sort()).toEqual([...MAJOR_TONICS].sort());
  });

  it('follows each major key with its relative harmonic minor once lesson 9 is ticked', () => {
    const ladder = scaleLadder(true);
    expect(ladder).toHaveLength(72);
    expect(ladder.slice(0, 7)).toEqual([
      'major:C:1:right',
      'major:C:1:left',
      'major:C:2:both',
      'harmonicMinor:A:1:right',
      'harmonicMinor:A:1:left',
      'harmonicMinor:A:2:both',
      'major:G:1:right',
    ]);
    const minors = ladder.filter((r) => r.startsWith('harmonicMinor') && r.endsWith(':2:both'));
    // A minor third below its major, as the Scales page spells it (F♯ major's is E♭ minor).
    expect(minors.map((r) => r.split(':')[1])).toEqual([
      'A',
      'E',
      'D',
      'B',
      'F#',
      'C#',
      'G',
      'C',
      'G#',
      'F',
      'Eb',
      'Bb',
    ]);
    expect(minors.map((r) => r.split(':')[1]).sort()).toEqual([...MINOR_TONICS].sort());
  });

  it('proposes the first rung never played', () => {
    expect(nextRung(new Set(), ticked())).toBe('major:C:1:right');
    expect(nextRung(new Set(['major:C:1:right']), ticked())).toBe('major:C:1:left');
    // A rung played out of order is not asked for again; the gap before it still is.
    expect(nextRung(new Set(['major:C:1:right', 'major:C:2:both']), ticked())).toBe(
      'major:C:1:left',
    );
    const c = ['major:C:1:right', 'major:C:1:left', 'major:C:2:both'];
    expect(nextRung(new Set(c), ticked())).toBe('major:G:1:right');
    expect(nextRung(new Set(c), ticked(MINOR_LESSON))).toBe('harmonicMinor:A:1:right');
    // Other exercises are the player's choice: they are no rung.
    expect(nextRung(new Set(['majorArpeggio:C:1:right', 'hanon:C:2:both:1']), ticked())).toBe(
      'major:C:1:right',
    );
    expect(nextRung(new Set(scaleLadder(false)), ticked())).toBeNull();
    expect(nextRung(new Set(scaleLadder(false)), ticked(MINOR_LESSON))).toBe(
      'harmonicMinor:A:1:right',
    );
    expect(nextRung(new Set(scaleLadder(true)), ticked(MINOR_LESSON))).toBeNull();
  });
});

describe('the next piece', () => {
  const library: CurriculumPiece[] = BUILT_IN.map((p) => ({
    id: p.id,
    grade: p.level,
    leadSheet: p.leadSheet === true,
  }));
  const none = new Set<string>();
  /** The pieces of a grade written for two hands, in the library's order. */
  const written = (grade: number) =>
    library.filter((p) => p.grade === grade && !p.leadSheet).map((p) => p.id);

  it('is the first Initial piece written for two hands when nothing was played to its end', () => {
    expect(written(0).slice(0, 3)).toEqual([
      'turk-aller-anfang',
      'beethoven-ode-to-joy',
      'czerny-op599-no11',
    ]);
    expect(nextPiece(library, none, none)).toBe('turk-aller-anfang');
    // One begun: the next in the library's order.
    expect(nextPiece(library, new Set(['turk-aller-anfang']), none)).toBe('beethoven-ode-to-joy');
    // The Initial lead sheets are not proposed, and nothing above Initial is yet.
    expect(nextPiece(library, new Set(written(0)), none)).toBeNull();
  });

  it('goes by grade, then by the library’s order, among pieces without a session', () => {
    const ode = new Set(['beethoven-ode-to-joy']);
    // An Initial piece played to its end: the Initial pieces not begun still come first.
    expect(nextPiece(library, ode, ode)).toBe('turk-aller-anfang');
    // Initial used up: grade 1, in the library's order.
    const initial = new Set(written(0));
    expect(written(1)).toEqual([
      'turk-bey-der-wiege',
      'beyer-abendlied',
      'beyer-op101-no66',
      'schumann-melodie',
      'petzold-minuet-in-g',
      'petzold-minuet-in-g-minor',
    ]);
    expect(nextPiece(library, initial, ode)).toBe('turk-bey-der-wiege');
    const two = new Set([...initial, ...written(1).slice(0, 5)]);
    expect(nextPiece(library, two, ode)).toBe('petzold-minuet-in-g-minor');
    // Grade 1 is used up and only an Initial piece was finished: nothing within a grade above.
    const three = new Set([...two, 'petzold-minuet-in-g-minor']);
    expect(nextPiece(library, three, ode)).toBeNull();
  });

  it('reaches one grade above the highest grade played to its end', () => {
    const started = new Set(
      library.filter((p) => p.grade !== null && p.grade <= 1).map((p) => p.id),
    );
    // A grade 1 piece finished: the first grade 2 piece in the library's order.
    expect(nextPiece(library, started, new Set(['petzold-minuet-in-g']))).toBe(
      'schumann-soldiers-march',
    );
    // Grade 3 is two above Initial: out of reach until a grade 2 piece was finished.
    const upToTwo = new Set(
      library.filter((p) => p.grade !== null && p.grade <= 2).map((p) => p.id),
    );
    expect(nextPiece(library, upToTwo, new Set(['petzold-minuet-in-g']))).toBeNull();
    expect(nextPiece(library, upToTwo, new Set(['bach-musette-in-d']))).toBe(
      'burgmuller-arabesque',
    );
  });

  it('never proposes a lead sheet or an imported piece', () => {
    const pieces: CurriculumPiece[] = [
      { id: 'sheet', grade: 0, leadSheet: true },
      { id: 'mine', grade: null, leadSheet: false },
    ];
    expect(nextPiece(pieces, none, none)).toBeNull();
    // An imported piece played to its end sets no grade either.
    expect(nextPiece([...pieces, ...library], none, new Set(['mine']))).toBe('turk-aller-anfang');
  });
});
