import { describe, expect, it } from 'vitest';
import { EXTRAS, LESSONS, type LessonPractice } from '../learn/lessons.ts';
import { BUILT_IN } from '../pieces/library/index.ts';
import { sampleAttempt, sampleRun, sampleScaleSession, T0 } from '../storage/fixtures.ts';
import { LEVEL_FAMILIES, levelsOfFamily, pageOfFamily } from './assignments.ts';
import type { LevelFamily } from './assignmentRecords.ts';
import { nextPiece, OPENS_WITH, scaleLadder } from './curriculum.ts';
import {
  fallbackLink,
  firstLevelWith,
  lessonLinks,
  linkState,
  resolvePractice,
  type LinkState,
  type PracticeLink,
} from './lessonLinks.ts';
import { getLevel, LEVEL_IDS, LEVELS, type LevelId } from './levels.ts';
import { levelProgress, MASTERY_WINDOW, suggestedLevel } from './mastery.ts';
import { CELLS, getRhythmLevel, RHYTHM_LEVELS, type RhythmLevelId } from './rhythmCells.ts';
import { parseExerciseKey } from './scales.ts';
import type { Attempt } from './session.ts';
import { readingFloor, type StartingPoint } from './startingPoint.ts';
import { dayKey } from './streak.ts';
import { getTheoryLevel, KEY_SIGNATURE_LEVELS } from './theoryItems.ts';
import type { TodayPiece, TodayRecords } from './today.ts';

const TODAY = dayKey(T0 + 86_400_000, 'UTC');
const PIECES: TodayPiece[] = BUILT_IN.map((piece) => ({
  id: piece.id,
  grade: piece.level,
  leadSheet: piece.leadSheet === true,
  facts: piece.facts,
  out: false,
}));
const NOTHING: TodayRecords = { sessions: [], attempts: [], answers: [], pieces: PIECES };

/** A reader who has done nothing yet: every family suggests its first level. */
const NEW: LinkState = {
  suggested: (family) => levelsOfFamily(family)[0]!,
  mastered: () => false,
  nextRung: 'major:C:1:right',
  piece: null,
  hasPiece: (id) => BUILT_IN.some((piece) => piece.id === id),
};

const practiceOf = (slug: string): readonly LessonPractice[] =>
  [...LESSONS, ...EXTRAS].find((lesson) => lesson.slug === slug)!.practice;
const linksOf = (slug: string, state: LinkState | null = NEW) =>
  lessonLinks(practiceOf(slug), state);
const level = (family: LevelFamily, id: string): PracticeLink => ({
  kind: 'level',
  page: pageOfFamily(family),
  family,
  level: id,
});

describe('the first level with what a lesson teaches', () => {
  it('is found in the levels’ own data: sharps and flats, dots and ties, minor keys', () => {
    expect(firstLevelWith('sharps')).toEqual({ family: 'notes', level: 'L7' });
    expect(firstLevelWith('dotted')).toEqual({ family: 'rhythm', level: 'R3' });
    expect(firstLevelWith('minor')).toEqual({ family: 'keySignature', level: 'KS4' });
  });

  it('is the first: no level before it has any', () => {
    // Read's notes: every level before the one found is naturals only, and it has both signs.
    const sharps = LEVELS.findIndex((l) => l.id === firstLevelWith('sharps').level);
    for (const l of LEVELS.slice(0, sharps)) {
      expect(
        l.notes.every((note) => note.pitch.accidental === 0),
        l.id,
      ).toBe(true);
    }
    const signs = new Set(getLevel('L7').notes.map((note) => note.pitch.accidental));
    expect([...signs].sort()).toEqual([-1, 1]);

    // Rhythm: no cell of an earlier level has a dot or a tie; the level found adds the dotted
    // notes, and the one after it the ties.
    const marked = (key: string) => CELLS[key]!.notes.some((n) => n.dot || n.tie || n.tied);
    const dotted = RHYTHM_LEVELS.findIndex((l) => l.id === firstLevelWith('dotted').level);
    for (const l of RHYTHM_LEVELS.slice(0, dotted)) expect(l.cells.some(marked), l.id).toBe(false);
    const found = getRhythmLevel(firstLevelWith('dotted').level as RhythmLevelId);
    expect(found.adds.every(marked)).toBe(true);
    expect(found.adds.every((key) => CELLS[key]!.notes.some((n) => n.dot))).toBe(true);
    expect(RHYTHM_LEVELS[dotted + 1]!.adds.every((key) => CELLS[key]!.notes[0]!.tied)).toBe(true);

    // Key signatures: the levels before are major, the one found minor.
    const minor = KEY_SIGNATURE_LEVELS.findIndex((l) => l.id === firstLevelWith('minor').level);
    expect(KEY_SIGNATURE_LEVELS.slice(0, minor).every((l) => l.mode === 'major')).toBe(true);
    expect(getTheoryLevel('KS4')).toMatchObject({ family: 'keySignature', mode: 'minor' });
  });
});

describe('what the lessons name', () => {
  it('is one practice or two for every lesson and every page beside them', () => {
    for (const lesson of [...LESSONS, ...EXTRAS]) {
      expect(lesson.practice.length, lesson.slug).toBeGreaterThanOrEqual(1);
      expect(lesson.practice.length, lesson.slug).toBeLessThanOrEqual(2);
    }
  });

  it('exists: every family, every scale, every piece and every special level', () => {
    for (const lesson of [...LESSONS, ...EXTRAS]) {
      for (const practice of lesson.practice) {
        if ('family' in practice) {
          expect(LEVEL_FAMILIES, lesson.slug).toContain(practice.family);
          if (practice.level !== 'suggested') {
            // The level asked for is one of this family's.
            const first = firstLevelWith(practice.level);
            expect(first.family, lesson.slug).toBe(practice.family);
            expect(levelsOfFamily(practice.family), lesson.slug).toContain(first.level);
          }
        }
        if ('scale' in practice && practice.scale !== 'next') {
          expect(parseExerciseKey(practice.scale), lesson.slug).not.toBeNull();
        }
        if ('piece' in practice && practice.piece !== 'inHand') {
          const piece = BUILT_IN.find((p) => p.id === practice.piece);
          // A piece written for two hands, not a lead sheet.
          expect(piece, lesson.slug).toBeDefined();
          expect(piece!.leadSheet, lesson.slug).toBeUndefined();
        }
      }
    }
  });

  it('leads to a practice its own lesson or an earlier one opens (TODAY.md’s table)', () => {
    LESSONS.forEach((lesson, at) => {
      for (const practice of lesson.practice) {
        const opened =
          'family' in practice
            ? OPENS_WITH[practice.family]
            : 'scale' in practice
              ? OPENS_WITH.scales
              : 'piece' in practice || practice.page === 'pieces'
                ? OPENS_WITH.pieces
                : null;
        if (opened === null) continue;
        const opens = LESSONS.findIndex((l) => l.slug === opened);
        // Lesson 3 names the intervals on the staff, which it opens itself; lesson 6 the scales.
        expect(opens, `${lesson.slug} → ${opened}`).toBeLessThanOrEqual(at);
      }
    });
  });
});

describe('the links of each lesson, for a reader who is new', () => {
  it('follow the table of the specification', () => {
    const table: Record<string, PracticeLink[]> = {
      keyboard: [{ kind: 'page', page: 'play' }],
      staff: [level('notes', 'L1')],
      landmarks: [level('notes', 'L1'), level('readInterval', 'RI1')],
      rhythm: [level('rhythm', 'R1'), { kind: 'page', page: 'metronome' }],
      'sharps-and-flats': [level('notes', 'L7')],
      'major-scale': [{ kind: 'scale', exercise: 'major:C:1:right' }, level('keySignature', 'KS1')],
      posture: [
        { kind: 'scale', exercise: 'majorFiveFinger:C:1:right' },
        { kind: 'page', page: 'play' },
      ],
      'rhythm-2': [level('rhythm', 'R3')],
      'minor-keys': [
        { kind: 'scale', exercise: 'harmonicMinor:A:1:right' },
        level('keySignature', 'KS4'),
      ],
      dynamics: [{ kind: 'piece', id: 'schumann-soldiers-march' }],
      pedals: [
        { kind: 'piece', id: 'beethoven-fur-elise' },
        { kind: 'page', page: 'play' },
      ],
      ornaments: [{ kind: 'piece', id: 'petzold-minuet-in-g' }],
      chords: [level('chordSymbol', 'H1'), level('chord', 'C1')],
      // No piece in hand and none to propose: the library.
      practising: [{ kind: 'page', page: 'pieces' }],
      styles: [{ kind: 'page', page: 'pieces' }],
      inside: [{ kind: 'page', page: 'play' }],
    };
    expect(Object.keys(table).sort()).toEqual(
      [...LESSONS, ...EXTRAS].map((lesson) => lesson.slug).sort(),
    );
    for (const [slug, links] of Object.entries(table)) expect(linksOf(slug), slug).toEqual(links);
  });

  it('are the pages themselves until there is a state to resolve them against', () => {
    expect(linksOf('landmarks', null)).toEqual([
      { kind: 'page', page: 'read' },
      { kind: 'page', page: 'read' },
    ]);
    expect(linksOf('major-scale', null)).toEqual([
      { kind: 'page', page: 'scales' },
      { kind: 'page', page: 'read' },
    ]);
    expect(linksOf('chords', null)).toEqual([
      { kind: 'page', page: 'harmony' },
      { kind: 'page', page: 'ear' },
    ]);
    expect(linksOf('dynamics', null)).toEqual([{ kind: 'page', page: 'pieces' }]);
    expect(linksOf('keyboard', null)).toEqual([{ kind: 'page', page: 'play' }]);
  });
});

describe('the links as the reader gets on', () => {
  it('follow the level a family suggests, and its last level once all are mastered', () => {
    const on: LinkState = {
      ...NEW,
      suggested: (family) => (family === 'notes' ? 'L4' : family === 'rhythm' ? null : 'RI2'),
    };
    expect(linksOf('staff', on)).toEqual([level('notes', 'L4')]);
    expect(linksOf('landmarks', on)).toEqual([level('notes', 'L4'), level('readInterval', 'RI2')]);
    // Every rhythm level mastered: the page suggests its last.
    expect(linksOf('rhythm', on)[0]).toEqual(level('rhythm', 'R10'));
  });

  it('name the level with sharps and flats, and the first with minor keys, whatever is mastered', () => {
    const all: LinkState = { ...NEW, suggested: () => null, mastered: () => true };
    expect(linksOf('sharps-and-flats', all)).toEqual([level('notes', 'L7')]);
    expect(linksOf('minor-keys', all)[1]).toEqual(level('keySignature', 'KS4'));
    const early: LinkState = { ...NEW, suggested: () => 'L2' };
    expect(linksOf('sharps-and-flats', early)).toEqual([level('notes', 'L7')]);
  });

  it('name the first level with dots or ties until it is mastered, then the level suggested', () => {
    // Not there yet: the lesson still leads to its own level, not to where the page would go.
    const before: LinkState = { ...NEW, suggested: () => 'R1' };
    expect(linksOf('rhythm-2', before)).toEqual([level('rhythm', 'R3')]);
    const mastered = (upTo: number) => (family: LevelFamily, id: string) =>
      family === 'rhythm' && Number(id.slice(1)) <= upTo;
    // Mastered out of order (R1 and R2 are not): the level suggested, by the family's own rule.
    expect(
      linksOf('rhythm-2', { ...NEW, suggested: () => 'R1', mastered: (_, l) => l === 'R3' }),
    ).toEqual([level('rhythm', 'R1')]);
    expect(linksOf('rhythm-2', { ...NEW, suggested: () => 'R5', mastered: mastered(4) })).toEqual([
      level('rhythm', 'R5'),
    ]);
    expect(linksOf('rhythm-2', { ...NEW, suggested: () => null, mastered: mastered(10) })).toEqual([
      level('rhythm', 'R10'),
    ]);
  });

  it('name the next rung of the scale ladder, and the page once every rung was played', () => {
    const ladder = scaleLadder(true);
    expect(linksOf('major-scale', { ...NEW, nextRung: ladder[1]! })[0]).toEqual({
      kind: 'scale',
      exercise: 'major:C:1:left',
    });
    expect(linksOf('major-scale', { ...NEW, nextRung: null })[0]).toEqual({
      kind: 'page',
      page: 'scales',
    });
    // The lessons' own scales do not move with the ladder.
    expect(linksOf('posture', { ...NEW, nextRung: null })[0]).toEqual({
      kind: 'scale',
      exercise: 'majorFiveFinger:C:1:right',
    });
  });

  it('name the piece in hand or the next piece, an imported one too', () => {
    const inHand: LinkState = { ...NEW, piece: 'petzold-minuet-in-g' };
    expect(linksOf('practising', inHand)).toEqual([{ kind: 'piece', id: 'petzold-minuet-in-g' }]);
    const imported: LinkState = { ...NEW, piece: 'p1', hasPiece: (id) => id === 'p1' };
    expect(linksOf('practising', imported)).toEqual([{ kind: 'piece', id: 'p1' }]);
  });
});

describe('what a link names that is not there', () => {
  it('falls back to the page that practises it', () => {
    // A level its family does not have.
    const strange: LinkState = { ...NEW, suggested: () => 'L99' };
    expect(resolvePractice({ family: 'notes', level: 'suggested' }, strange)).toEqual({
      kind: 'page',
      page: 'read',
    });
    expect(resolvePractice({ family: 'interval', level: 'suggested' }, strange)).toEqual({
      kind: 'page',
      page: 'ear',
    });
    // A special level asked of a family that has no such level.
    expect(resolvePractice({ family: 'chordSymbol', level: 'minor' }, NEW)).toEqual({
      kind: 'page',
      page: 'harmony',
    });
    // A scale that is no exercise; a piece this build does not have, or deleted since.
    expect(resolvePractice({ scale: 'pentatonic:C:1:right' }, NEW)).toEqual({
      kind: 'page',
      page: 'scales',
    });
    expect(resolvePractice({ piece: 'no-such-piece' }, NEW)).toEqual({
      kind: 'page',
      page: 'pieces',
    });
    expect(resolvePractice({ piece: 'inHand' }, { ...NEW, piece: 'deleted-since' })).toEqual({
      kind: 'page',
      page: 'pieces',
    });
    expect(fallbackLink({ page: 'metronome' })).toEqual({ kind: 'page', page: 'metronome' });
  });
});

describe('the state the links are resolved against', () => {
  const options = { today: TODAY, lessonsDone: new Set<string>(), timeZone: 'UTC' };

  it('is where every practice stands: nothing played, everything at its beginning', () => {
    const state = linkState(NOTHING, options);
    expect(state.suggested('notes')).toBe('L1');
    expect(state.suggested('rhythm')).toBe('R1');
    expect(state.mastered('rhythm', 'R3')).toBe(false);
    expect(state.nextRung).toBe('major:C:1:right');
    // Pieces open with lesson 3: until then there is no piece to propose.
    expect(state.piece).toBeNull();
    expect(state.hasPiece('beethoven-fur-elise')).toBe(true);
    expect(state.hasPiece('p1')).toBe(false);
    expect(lessonLinks(practiceOf('practising'), state)).toEqual([
      { kind: 'page', page: 'pieces' },
    ]);
  });

  it('proposes the next piece once Pieces is open, and the piece in hand once one is', () => {
    const open = linkState(NOTHING, { ...options, lessonsDone: new Set(['landmarks']) });
    // The curriculum's own next piece (TODAY.md), whatever the library's first piece is.
    const next = nextPiece(PIECES, new Set(), new Set());
    expect(next).not.toBeNull();
    expect(BUILT_IN.find((piece) => piece.id === next)).toMatchObject({ level: 0 });
    expect(open.piece).toBe(next);
    expect(lessonLinks(practiceOf('practising'), open)).toEqual([{ kind: 'piece', id: next }]);
    // A run of the Minuet begun yesterday and not played to its end: in hand.
    const { session } = sampleRun('r1', 3, { pieceId: 'petzold-minuet-in-g' });
    const inHand = linkState({ ...NOTHING, sessions: [{ ...session, completed: false }] }, options);
    expect(inHand.piece).toBe('petzold-minuet-in-g');
  });

  it('moves on with the records: a level mastered, a rung played', () => {
    // Forty right answers in time: L1 is mastered, and the notes suggest L2.
    const attempts = Array.from({ length: MASTERY_WINDOW }, (_, i) =>
      sampleAttempt(i, 's1', { note: 'C4@treble', correct: true, ms: 800, hinted: false }),
    );
    const scales = sampleScaleSession('k1', 1);
    const state = linkState({ ...NOTHING, attempts, sessions: [scales.session] }, options);
    expect(state.suggested('notes')).toBe('L2');
    expect(state.mastered('notes', 'L1')).toBe(true);
    expect(state.mastered('notes', 'L2')).toBe(false);
    expect(lessonLinks(practiceOf('staff'), state)).toEqual([level('notes', 'L2')]);
    // The scale played is a rung or not: either way the next rung is one never played.
    expect(state.nextRung).not.toBe(scales.session.runs[0]!.exercise);
    expect(scaleLadder(false)).toContain(state.nextRung);
  });
});

describe('the links of someone who plays already (docs/START.md)', () => {
  const options = { today: TODAY, lessonsDone: new Set<string>(), timeZone: 'UTC' };
  const player = (reads: 'treble' | 'both' | 'ledger' | 'unknown'): StartingPoint => ({
    from: 'player',
    reads,
  });
  /** Forty right answers in time at each of `levels`: they are mastered. */
  const mastering = (...levels: LevelId[]): Attempt[] =>
    levels.flatMap((id, n) =>
      Array.from({ length: MASTERY_WINDOW }, (_, i) =>
        sampleAttempt(n * 100 + i, 's1', {
          level: id,
          note: getLevel(id).notes[0]!.key,
          correct: true,
          ms: 800,
          hinted: false,
        }),
      ),
    );
  /** What the Read page itself opens its notes on: its own rule, with the floor. */
  const onThePage = (attempts: readonly Attempt[], start: StartingPoint | null) =>
    suggestedLevel(
      LEVEL_IDS.map((id) => levelProgress(attempts, id)),
      readingFloor(start),
    );

  it('begin Read’s notes where their reading does: the level suggested is the page’s, floor and all', () => {
    const cases: [StartingPoint | null, LevelId[], LevelId][] = [
      // Nothing played: the floor itself.
      [player('treble'), [], 'L3'],
      [player('both'), [], 'L5'],
      [player('ledger'), [], 'L7'],
      // Would rather find out, a newcomer, no answer: no floor.
      [player('unknown'), [], 'L1'],
      [{ from: 'new' }, [], 'L1'],
      [null, [], 'L1'],
      // The floor mastered: on from it. The levels below it are passed over, mastered or not.
      [player('both'), ['L5'], 'L6'],
      [player('both'), ['L1', 'L5', 'L6'], 'L7'],
      [player('treble'), ['L1', 'L2'], 'L3'],
      // A level below the floor mastered changes nothing above it.
      [player('both'), ['L1'], 'L5'],
      // Every level from the floor on mastered: the page's last level, not one below the floor.
      [player('ledger'), ['L7'], 'L7'],
      [player('both'), ['L5', 'L6', 'L7'], 'L7'],
    ];
    for (const [start, levels, expected] of cases) {
      const attempts = mastering(...levels);
      const state = linkState({ ...NOTHING, attempts }, { ...options, start });
      const label = `${JSON.stringify(start)} with ${levels.join(',') || 'nothing'} mastered`;
      // The same level as the Read page opens on.
      expect(onThePage(attempts, start), label).toBe(expected);
      expect(lessonLinks(practiceOf('staff'), state), label).toEqual([level('notes', expected)]);
      expect(lessonLinks(practiceOf('landmarks'), state)[0], label).toEqual(
        level('notes', expected),
      );
    }
  });

  it('leave the other links as they are: the floor is of Read’s notes alone', () => {
    const state = linkState(NOTHING, { ...options, start: player('ledger') });
    expect(lessonLinks(practiceOf('landmarks'), state)[1]).toEqual(level('readInterval', 'RI1'));
    expect(lessonLinks(practiceOf('rhythm'), state)[0]).toEqual(level('rhythm', 'R1'));
    expect(lessonLinks(practiceOf('rhythm-2'), state)).toEqual([level('rhythm', 'R3')]);
    // The level with sharps and flats is the lesson's own, floor or none.
    expect(lessonLinks(practiceOf('sharps-and-flats'), state)).toEqual([level('notes', 'L7')]);
    expect(
      lessonLinks(
        practiceOf('sharps-and-flats'),
        linkState(NOTHING, { ...options, start: player('treble') }),
      ),
    ).toEqual([level('notes', 'L7')]);
  });

  it('have a piece to begin at once: Pieces is open to them without its lesson', () => {
    const next = nextPiece(PIECES, new Set(), new Set());
    expect(linkState(NOTHING, options).piece).toBeNull();
    expect(linkState(NOTHING, { ...options, start: { from: 'new' } }).piece).toBeNull();
    const state = linkState(NOTHING, { ...options, start: player('unknown') });
    expect(state.piece).toBe(next);
    expect(lessonLinks(practiceOf('practising'), state)).toEqual([{ kind: 'piece', id: next }]);
  });
});
