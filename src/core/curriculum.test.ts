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
  anyMastered,
  CURRICULUM_LESSONS,
  isOpen,
  KNOWN_SCALE_RUNS,
  lessonNumber,
  lessonToRead,
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
import { READS } from './startingPoint.ts';

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

  // docs/START.md: the third way, beside a lesson's tick and a record.
  it('at once for someone who said they play already, whatever they read', () => {
    const none = practised(NONE);
    for (const practice of Object.keys(OPENS_WITH) as Practice[]) {
      for (const reads of READS) {
        expect(isOpen(practice, ticked(), none, { from: 'player', reads }), practice).toBe(true);
      }
    }
  });

  it('as before for a newcomer, and for someone who never answered', () => {
    const none = practised(NONE);
    const had = practised({ ...NONE, answers: [sampleAnswer(0)] });
    for (const practice of Object.keys(OPENS_WITH) as Practice[]) {
      for (const lessonsDone of [ticked(), ticked('landmarks'), new Set(CURRICULUM_LESSONS)]) {
        for (const records of [none, had]) {
          const open = isOpen(practice, lessonsDone, records);
          expect(isOpen(practice, lessonsDone, records, null), practice).toBe(open);
          expect(isOpen(practice, lessonsDone, records, { from: 'new' }), practice).toBe(open);
        }
      }
    }
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

describe('a practice names its lesson', () => {
  it('names the lesson that opens it, to someone who has neither read it nor knows the practice', () => {
    expect(lessonToRead('rhythm', ticked(), false)).toBe('rhythm');
    expect(lessonToRead('rhythmEar', ticked(), false)).toBe('rhythm');
    expect(lessonToRead('readInterval', ticked('keyboard', 'staff'), false)).toBe('landmarks');
    expect(lessonToRead('scales', ticked(), false)).toBe('major-scale');
    expect(lessonToRead('pieces', ticked(), false)).toBe('landmarks');
    expect(lessonToRead('chordSymbol', ticked('rhythm'), false)).toBe('chords');
    // Every practice a lesson opens names that lesson.
    for (const [practice, slug] of Object.entries(OPENS_WITH)) {
      expect(lessonToRead(practice as Practice, ticked(), false), practice).toBe(slug);
    }
  });

  it('names none once the lesson is ticked', () => {
    expect(lessonToRead('rhythm', ticked('rhythm'), false)).toBeNull();
    expect(lessonToRead('sight', ticked('rhythm'), false)).toBeNull();
    expect(lessonToRead('scales', ticked('major-scale'), false)).toBeNull();
    // Another lesson's tick does not count.
    expect(lessonToRead('scales', ticked('minor-keys'), false)).toBe('major-scale');
  });

  it('names none to someone who knows the practice', () => {
    expect(lessonToRead('rhythm', ticked(), true)).toBeNull();
    expect(lessonToRead('pieces', ticked(), true)).toBeNull();
  });

  it('names none to someone who said they play already: every practice is open to them', () => {
    const player = { from: 'player', reads: 'unknown' } as const;
    for (const practice of Object.keys(OPENS_WITH) as Practice[]) {
      expect(lessonToRead(practice, ticked(), false, player), practice).toBeNull();
      // The same notion of open as today's plan and Where you are have.
      expect(isOpen(practice, ticked(), new Set(), player), practice).toBe(true);
    }
    // A newcomer's answer, or none, changes nothing.
    expect(lessonToRead('rhythm', ticked(), false, { from: 'new' })).toBe('rhythm');
    expect(lessonToRead('rhythm', ticked(), false, null)).toBe('rhythm');
    expect(lessonToRead('rhythm', ticked('rhythm'), false, { from: 'new' })).toBeNull();
  });

  it('names none for the notes, which are open from the start', () => {
    expect(lessonToRead('notes', ticked(), false)).toBeNull();
    expect(lessonToRead('notes', ticked(), true)).toBeNull();
  });

  it('knows a practice by a level mastered: one is enough, of any of its levels', () => {
    expect(anyMastered([])).toBe(false);
    expect(anyMastered([{ mastered: false }, { mastered: false }])).toBe(false);
    expect(anyMastered([{ mastered: false }, { mastered: true }])).toBe(true);
    // A level never practised has no progress yet.
    expect(anyMastered([undefined, undefined])).toBe(false);
    expect(anyMastered([undefined, { mastered: true }])).toBe(true);
    expect(anyMastered(new Map([['R1', { mastered: true }]]).values())).toBe(true);
  });

  it('knows the scales by five runs', () => {
    expect(KNOWN_SCALE_RUNS).toBe(5);
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
  const byId = new Map(library.map((p) => [p.id, p]));
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

  it('stays at the grade reached while it has a piece without a session, in the library’s order', () => {
    const ode = new Set(['beethoven-ode-to-joy']);
    // An Initial piece played to its end: the Initial pieces not begun still come first.
    expect(nextPiece(library, ode, ode)).toBe('turk-aller-anfang');
    // Initial used up: the grade above, in the library's order.
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

  it('never goes back below the grade reached', () => {
    // Für Elise (grade 3) played to its end, and nothing else begun: the other grade 3 pieces,
    // in the library's order, not the ten first pieces.
    const elise = new Set(['beethoven-fur-elise']);
    expect(written(3)).toEqual([
      'burgmuller-arabesque',
      'beethoven-fur-elise',
      'tchaikovsky-morning-prayer',
    ]);
    expect(nextPiece(library, elise, elise)).toBe('burgmuller-arabesque');
    expect(nextPiece(library, new Set([...elise, 'burgmuller-arabesque']), elise)).toBe(
      'tchaikovsky-morning-prayer',
    );
    // The grade reached is the highest of those finished, whatever was finished below it.
    const finished = new Set(['turk-aller-anfang', 'bach-musette-in-d']);
    expect(written(2)[0]).toBe('schumann-soldiers-march');
    expect(nextPiece(library, finished, finished)).toBe('schumann-soldiers-march');
    // A piece of a lower grade without a session is never the next piece, whatever is left above.
    for (const reached of [1, 2, 3, 4, 5]) {
      const done = new Set([written(reached)[0]!]);
      const started = new Set(done);
      for (let next = nextPiece(library, started, done); next;) {
        expect(byId.get(next)!.grade, next).toBeGreaterThanOrEqual(reached);
        expect(byId.get(next)!.grade, next).toBeLessThanOrEqual(reached + 1);
        started.add(next);
        next = nextPiece(library, started, done);
      }
    }
  });

  it('goes up one grade once the grade reached has none left, and no further', () => {
    const elise = new Set(['beethoven-fur-elise']);
    // Grade 3 used up: the first of grade 4.
    const three = new Set(written(3));
    expect(written(4)).toEqual(['chopin-prelude-in-c-minor', 'satie-gymnopedie-1']);
    expect(nextPiece(library, three, elise)).toBe('chopin-prelude-in-c-minor');
    // Grade 4 used up too, with nothing of it finished: grade 5 is two above the grade reached.
    const four = new Set([...three, ...written(4)]);
    expect(written(5)).toEqual(['bach-prelude-in-c']);
    expect(nextPiece(library, four, elise)).toBeNull();
    // A grade 4 piece finished: grade 5 is within reach; above the last grade there is nothing.
    const satie = new Set(['satie-gymnopedie-1']);
    expect(nextPiece(library, four, satie)).toBe('bach-prelude-in-c');
    const all = new Set(library.map((p) => p.id));
    expect(nextPiece(library, all, new Set(['bach-prelude-in-c']))).toBeNull();
  });

  it('takes the grade reached from a lead sheet played to its end, and proposes none', () => {
    // Auld Lang Syne is a lead sheet of grade 2: the written pieces of grade 2 follow it.
    const sheet = new Set(['trad-auld-lang-syne']);
    expect(byId.get('trad-auld-lang-syne')).toMatchObject({ grade: 2, leadSheet: true });
    expect(nextPiece(library, sheet, sheet)).toBe('schumann-soldiers-march');
    // The other lead sheets of grade 2 are not proposed when its written pieces are used up.
    const two = new Set([...sheet, ...written(2)]);
    expect(nextPiece(library, two, sheet)).toBe('burgmuller-arabesque');
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
