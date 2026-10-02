import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../pieces/library/index.ts';
import {
  sampleAttempt,
  sampleEarSession,
  sampleHeadline,
  sampleRhythmEarSession,
  sampleRhythmSession,
  sampleSightSession,
  sampleTheorySession,
} from '../storage/fixtures.ts';
import type { LevelTask, Task, TaskProgress } from './assignmentRecords.ts';
import {
  assignmentProgress,
  LEVEL_FAMILIES,
  levelsMastered,
  levelsOfFamily,
} from './assignments.ts';
import { CURRICULUM_LESSONS, MINOR_LESSON, scaleLadder } from './curriculum.ts';
import { LEVEL_IDS, type LevelId } from './levels.ts';
import type { PieceSessionRecord, ReadSessionRecord, SessionRecord } from './log.ts';
import { levelProgress, MASTERY_WINDOW, suggestedLevel } from './mastery.ts';
import { planSource, type StageStart } from './piecePlan.ts';
import { stepId, type PieceStep } from './pieceRecords.ts';
import { RECENT_RUNS, scaleProgress, suggestedExercise } from './scaleProgress.ts';
import { bars, note, Q, quarters, score } from './scoreFixtures.ts';
import { buildSteps, type HandSelection } from './score.ts';
import { SUGGEST_DAYS } from './scaleRanking.ts';
import { withRun, type ScaleSession } from './scaleRecords.ts';
import { recoverSummary, type Attempt } from './session.ts';
import { READS, type Reads, type StartingPoint } from './startingPoint.ts';
import {
  assignmentComesFirst,
  curriculumState,
  DEFAULT_PLAN_MINUTES,
  IN_HAND_DAYS,
  LESSON_FIRST,
  PLAN_COUNTS,
  PLAN_MINUTES,
  planFor,
  planOf,
  planProgress,
  readPlan,
  todayPlan,
  WORK_MS,
  type CurriculumState,
  type PlanMinutes,
  type PlanOptions,
  type PlanStep,
  type TodayPiece,
  type TodayPlan,
  type TodayRecords,
} from './today.ts';

const TZ = 'UTC';
const DAY = 86_400_000;
/** Thursday 24 September 2026. */
const TODAY = '2026-09-24';
/** An instant `days` days from today (negative: before it), at `hour` o'clock. */
const at = (days: number, hour = 17) => Date.UTC(2026, 8, 24, hour) + days * DAY;

const LIBRARY: TodayPiece[] = BUILT_IN.map((p) => ({
  id: p.id,
  grade: p.level,
  leadSheet: p.leadSheet === true,
  facts: p.facts,
  out: false,
}));
/** The library's first Initial piece: the one a player with no piece yet is given. */
const FIRST = 'turk-aller-anfang';
const ODE = 'beethoven-ode-to-joy';
const MINUET = 'petzold-minuet-in-g';
const MARCH = 'schumann-soldiers-march';
const ELISE = 'beethoven-fur-elise';

const EMPTY: TodayRecords = { sessions: [], attempts: [], answers: [], pieces: LIBRARY };
const ticked = (...slugs: string[]) => new Set(slugs);
const lessons = (n: number) => new Set(CURRICULUM_LESSONS.slice(0, n));
const options = (patch: Partial<PlanOptions> = {}): PlanOptions => ({
  today: TODAY,
  minutes: DEFAULT_PLAN_MINUTES,
  lessonsDone: ticked(),
  timeZone: TZ,
  ...patch,
});
const withSessions = (...sessions: SessionRecord[]): TodayRecords => ({ ...EMPTY, sessions });

const part = (plan: TodayPlan, name: PlanStep['part']) => plan.steps.filter((s) => s.part === name);
/** A step in a few words: the exercise, the piece, the family and level, the lesson. */
function named(step: PlanStep): string {
  if (step.kind === 'piece') return step.piece;
  const { task } = step;
  if (task.kind === 'scale') return task.exercise;
  return task.kind === 'level' ? `${task.family}:${task.level}` : `lesson:${task.slug}`;
}
const names = (plan: TodayPlan, name: PlanStep['part']) => part(plan, name).map(named);
const done = (plan: TodayPlan, records: TodayRecords, lessonsDone = ticked()) =>
  planProgress(plan, records, { lessonsDone, timeZone: TZ });

/** `runs` runs of an exercise on day `day`, each with the spread share `share`. */
function scales(
  id: string,
  exercise: string,
  day: number,
  o: { runs?: number; share?: number; hour?: number } = {},
): ScaleSession {
  let session: ScaleSession | null = null;
  for (let n = 0; n < (o.runs ?? 1); n++) {
    const startedAt = at(day, o.hour) + n * 20_000;
    const headline = sampleHeadline();
    headline.hands[0]!.spreadShare = o.share ?? 2;
    session = withRun(session, id, {
      id: `${id}:${n}`,
      exercise,
      startedAt,
      endedAt: startedAt + 10_000,
      headline,
    });
  }
  return session!;
}

/** A run of a piece on day `day`: to its end (`whole`) or not, `minutes` long. */
function played(
  id: string,
  pieceId: string,
  day: number,
  o: { whole?: boolean; minutes?: number; hands?: 'right' | 'left' | 'both'; hour?: number } = {},
): PieceSessionRecord {
  const startedAt = at(day, o.hour);
  const activeMs = (o.minutes ?? 2) * 60_000;
  return {
    kind: 'piece',
    id,
    pieceId,
    title: pieceId,
    hands: o.hands ?? 'both',
    loop: null,
    repeats: 'play',
    tempo: 100,
    startedAt,
    endedAt: startedAt + activeMs,
    activeMs,
    steps: 40,
    wrong: 0,
    completed: o.whole ?? false,
  };
}

/** A Read session at `level` on day `day`: `cards` cards, all right and quick. */
function read(
  id: string,
  day: number,
  o: { level?: LevelId; cards?: number; planned?: number } = {},
): { session: ReadSessionRecord; attempts: Attempt[] } {
  const cards = o.cards ?? 10;
  const attempts = Array.from({ length: cards }, (_, i) =>
    sampleAttempt(i, id, {
      id: `${id}:${i}`,
      level: o.level ?? 'L1',
      at: at(day) + i * 3000,
      correct: true,
      hinted: false,
      ms: 900,
    }),
  );
  return {
    attempts,
    session: { kind: 'read', ...recoverSummary(attempts)!, length: o.planned ?? cards },
  };
}

/** A session of another family, moved to day `day`. */
const on = <T extends SessionRecord>(session: T, day: number): T => ({
  ...session,
  startedAt: at(day),
});

describe('where every practice stands', () => {
  it('counts the lessons ticked and names the next', () => {
    const state = curriculumState(EMPTY, options({ lessonsDone: ticked('keyboard', 'staff') }));
    expect(state.lessons).toEqual({ done: 2, of: 15, next: 'landmarks' });
    // A page beside the lessons is not one of the fifteen.
    expect(curriculumState(EMPTY, options({ lessonsDone: ticked('inside') })).lessons.done).toBe(0);
  });

  it('has every family in the pages’ order, with its levels and its suggestion', () => {
    const state = curriculumState(EMPTY, options());
    expect(state.families.map((f) => f.family)).toEqual(LEVEL_FAMILIES);
    for (const f of state.families) {
      const levels = levelsOfFamily(f.family);
      expect(f, f.family).toMatchObject({
        levels: levels.length,
        mastered: 0,
        suggested: levels[0],
        lastAt: null,
        open: f.family === 'notes',
      });
    }
    expect(state.families.find((f) => f.family === 'tune')!.lesson).toBe('major-scale');
  });

  it('suggests a family’s first level not mastered, as its own page does', () => {
    const first = read('s1', -3, { level: 'L1', cards: MASTERY_WINDOW });
    const third = read('s2', -2, { level: 'L3', cards: MASTERY_WINDOW });
    const attempts = [...first.attempts, ...third.attempts];
    const state = curriculumState(
      { ...EMPTY, sessions: [first.session, third.session], attempts },
      options(),
    );
    const notes = state.families[0]!;
    expect(notes).toMatchObject({ family: 'notes', mastered: 2, suggested: 'L2' });
    expect(notes.lastAt).toBe(third.session.startedAt);
    expect(notes.suggested).toBe(
      suggestedLevel(LEVEL_IDS.map((level) => levelProgress(attempts, level))),
    );
  });

  it('says so when a family is mastered throughout', () => {
    const all = LEVEL_IDS.map((level, i) =>
      read(`s${i}`, -9 + i, { level, cards: MASTERY_WINDOW }),
    );
    const state = curriculumState(
      {
        ...EMPTY,
        sessions: all.map((r) => r.session),
        attempts: all.flatMap((r) => r.attempts),
      },
      options(),
    );
    expect(state.families[0]).toMatchObject({ mastered: LEVEL_IDS.length, suggested: null });
  });

  it('knows the scales played, the weakest lately and the next rung', () => {
    const sessions = [
      scales('k1', 'major:C:1:right', -2, { share: 3 }),
      scales('k2', 'major:C:1:left', -1, { share: 5 }),
      scales('k3', 'major:G:2:both', -40, { share: 9 }),
    ];
    const state = curriculumState(withSessions(...sessions), options());
    expect(state.scales).toEqual({
      open: true,
      played: 3,
      weakest: 'major:C:1:left',
      settled: false,
      next: 'major:C:2:both',
    });
    // The Scales page's own rule, on the same records.
    expect(state.scales.weakest).toBe(
      suggestedExercise(scaleProgress(sessions, at(0), TZ), at(0), TZ),
    );
  });

  it('counts the pieces in review and due, and the built-in pieces played per grade', () => {
    const sessions = [
      played('a', ODE, -6, { whole: true }),
      played('b', MINUET, -1, { whole: true }),
      played('c', 'trad-twinkle-twinkle', -3, { whole: true, hands: 'right' }),
      played('d', MARCH, -2),
    ];
    const state = curriculumState(withSessions(...sessions), options());
    expect(state.pieces.inReview).toBe(3);
    // Due a day after the run that put them in review: the longest overdue first.
    expect(state.pieces.due).toEqual([
      { id: ODE, overdue: 5 },
      { id: 'trad-twinkle-twinkle', overdue: 2 },
      { id: MINUET, overdue: 0 },
    ]);
    expect(state.pieces.grades.map((g) => g.grade)).toEqual([0, 1, 2, 3, 4, 5]);
    // Initial: the pieces written out and the two lead sheets.
    expect(state.pieces.grades[0]).toEqual({
      grade: 0,
      played: 2,
      of: BUILT_IN.filter((p) => p.level === 0).length,
    });
    expect(state.pieces.grades[1]).toMatchObject({ played: 1 });
    expect(state.pieces.grades[2]).toMatchObject({ played: 0 });
    expect(state.pieces.grades.reduce((n, g) => n + g.of, 0)).toBe(BUILT_IN.length);
    expect(state.pieces.inHand).toEqual({ id: MARCH, day: '2026-09-22' });
    expect(state.pieces.next).toBeNull();
  });

  it('tells a run to the end by its step records when they are here', () => {
    // Completed, but only three of the Ode's sixteen bars were played.
    const run = played('a', ODE, -3, { whole: true });
    const steps: PieceStep[] = [0, 1, 2].map((measure, n) => ({
      id: stepId('a', n),
      sessionId: 'a',
      pieceId: ODE,
      checksum: '7a47ee21',
      hands: 'both',
      measure,
      pass: 1,
      ms: 800,
      wrong: 0,
      at: run.startedAt + n * 1000,
    }));
    const records = { ...withSessions(run), steps: new Map([[ODE, steps]]) };
    const state = curriculumState(records, options());
    expect(state.pieces).toMatchObject({ inReview: 0, inHand: { id: ODE } });
    // Without them, the session alone says it was.
    expect(curriculumState(withSessions(run), options()).pieces.inReview).toBe(1);
  });
});

// docs/START.md: what a visitor said of themselves on the start page.
describe('a starting point', () => {
  const player = (reads: Reads): StartingPoint => ({ from: 'player', reads });
  /** The piece a newcomer is given once lesson 3 has opened Pieces. */
  const first = curriculumState(EMPTY, options({ lessonsDone: ticked('landmarks') })).pieces.next!;

  it('opens every practice at once for someone who plays already', () => {
    for (const reads of READS) {
      const state = curriculumState(EMPTY, options({ start: player(reads) }));
      expect(state.families.map((f) => f.open)).toEqual(LEVEL_FAMILIES.map(() => true));
      expect(state.scales.open).toBe(true);
      expect(state.pieces.open).toBe(true);
      // Open, the pieces have one to begin and the scales their first rung.
      expect(first).not.toBeNull();
      expect(state.pieces.next).toBe(first);
      expect(state.scales.next).toBe('major:C:1:right');
    }
  });

  it('changes nothing for a newcomer, nor for someone who never answered', () => {
    const records = withSessions(read('s1', -1).session, scales('k1', 'major:C:1:right', -1));
    for (const lessonsDone of [ticked(), ticked('landmarks', 'rhythm'), lessons(15)]) {
      const unasked = curriculumState(records, options({ lessonsDone }));
      expect(curriculumState(records, options({ lessonsDone, start: null }))).toEqual(unasked);
      expect(curriculumState(records, options({ lessonsDone, start: { from: 'new' } }))).toEqual(
        unasked,
      );
      for (const minutes of PLAN_MINUTES) {
        const plan = todayPlan(records, options({ lessonsDone, minutes }));
        expect(
          todayPlan(records, options({ lessonsDone, minutes, start: { from: 'new' } })),
        ).toEqual(plan);
      }
    }
  });

  it('begins Read’s notes where a player’s reading does, and nowhere else', () => {
    const suggested = (start: StartingPoint | null, records = EMPTY) =>
      curriculumState(records, options({ start })).families[0]!.suggested;
    expect(suggested(player('treble'))).toBe('L3');
    expect(suggested(player('both'))).toBe('L5');
    expect(suggested(player('ledger'))).toBe('L7');
    expect(suggested(player('unknown'))).toBe('L1');
    expect(suggested({ from: 'new' })).toBe('L1');
    // The other families begin at their first level, whatever is read.
    const state = curriculumState(EMPTY, options({ start: player('ledger') }));
    for (const f of state.families.slice(1)) {
      expect(f.suggested, f.family).toBe(levelsOfFamily(f.family)[0]);
    }
    // As on the Read page: the later of the first level not mastered and the floor.
    const fifth = read('s1', -2, { level: 'L5', cards: MASTERY_WINDOW });
    const records = { ...withSessions(fifth.session), attempts: fifth.attempts };
    expect(suggested(player('both'), records)).toBe('L6');
    expect(suggested(player('both'), records)).toBe(
      suggestedLevel(
        LEVEL_IDS.map((level) => levelProgress(fifth.attempts, level)),
        'L5',
      ),
    );
    expect(suggested(player('treble'), records)).toBe('L3');
  });

  it('does not report the levels below the floor as mastered', () => {
    const start = player('ledger');
    const state = curriculumState(EMPTY, options({ start }));
    // Where you are: none of seven, with L7 as the next step.
    expect(state.families[0]).toMatchObject({ levels: 7, mastered: 0, suggested: 'L7' });
    // Mastery is each level's own, as an assignment's "until mastered" asks: nothing was measured.
    const notes = LEVEL_IDS.map((level) => ({ family: 'notes' as const, level }));
    const input = { ...EMPTY, pieces: [], lessonsDone: ticked(), timeZone: TZ };
    expect(levelsMastered(notes, TODAY, input)).toEqual(LEVEL_IDS.map(() => false));
    const task: LevelTask = {
      kind: 'level',
      id: 't',
      family: 'notes',
      level: 'L1',
      goal: 'mastery',
    };
    const [progress] = assignmentProgress({ start: TODAY, due: TODAY, tasks: [task] }, input);
    expect(progress).toMatchObject({ met: false, done: 0 });
    // One level mastered is one of seven, floor or no floor.
    const seventh = read('s1', -2, { level: 'L7', cards: MASTERY_WINDOW });
    const records = { ...withSessions(seventh.session), attempts: seventh.attempts };
    expect(curriculumState(records, options({ start })).families[0]).toMatchObject({
      mastered: 1,
      // Everything from the floor on is mastered: the levels below are what is left.
      suggested: 'L1',
    });
  });

  it('leaves the lesson out of a player’s plan, at every length', () => {
    const start = player('both');
    for (const minutes of PLAN_MINUTES) {
      for (const n of [0, 3, LESSON_FIRST - 1, LESSON_FIRST, 14]) {
        const plan = todayPlan(EMPTY, options({ minutes, lessonsDone: lessons(n), start }));
        const fresh = names(plan, 'new');
        expect(
          fresh.filter((name) => name.startsWith('lesson:')),
          `${minutes}, ${n}`,
        ).toEqual([]);
        // Every family is open, so the levels the length has are all there, Read's from the floor.
        expect(fresh, `${minutes}, ${n}`).toHaveLength(PLAN_COUNTS[minutes].levels);
        expect(fresh[0]).toBe('notes:L5');
      }
    }
    // The 10-minute plan has a level where a newcomer's has the lesson alone.
    expect(names(todayPlan(EMPTY, options({ minutes: 10 })), 'new')).toEqual(['lesson:keyboard']);
    expect(names(todayPlan(EMPTY, options({ minutes: 10, start })), 'new')).toEqual(['notes:L5']);
    // The rest of the plan is a player's too: the first rung and the first piece are open.
    expect(todayPlan(EMPTY, options({ start })).steps.map(named)).toEqual([
      'major:C:1:right',
      first,
      'notes:L5',
    ]);
    // Where you are still counts the lessons: Learn stays where it is.
    expect(curriculumState(EMPTY, options({ start })).lessons).toEqual({
      done: 0,
      of: 15,
      next: 'keyboard',
    });
  });

  it('follows a changed answer at the next plan: today’s kept plan stands', () => {
    const start = player('ledger');
    const kept = todayPlan(EMPTY, options());
    expect(kept.steps.map(named)).toEqual(['lesson:keyboard', 'notes:L1']);
    // The answer changed in Settings: the plan of the day is the plan.
    expect(planFor(kept, EMPTY, options({ start }))).toBe(kept);
    // Another length, or another day, makes it again, for a player now.
    expect(planFor(kept, EMPTY, options({ start, minutes: 10 })).steps.map(named)).toEqual([
      'major:C:1:right',
      first,
      'notes:L7',
    ]);
    const tomorrow = planFor(kept, EMPTY, options({ start, today: '2026-09-25' }));
    expect(names(tomorrow, 'new')).toEqual(['notes:L7']);
  });
});

describe('the warm-up', () => {
  const warmup = (records: TodayRecords, patch: Partial<PlanOptions> = {}) =>
    part(todayPlan(records, options(patch)), 'warmup');

  it('is left out until Scales is open', () => {
    expect(warmup(EMPTY)).toEqual([]);
    expect(warmup(EMPTY, { lessonsDone: ticked('landmarks') })).toEqual([]);
  });

  it('is the first rung of the ladder for someone who never played a scale', () => {
    expect(warmup(EMPTY, { lessonsDone: ticked('major-scale') })).toEqual([
      {
        kind: 'task',
        id: 'warmup-1',
        part: 'warmup',
        why: { kind: 'nextScale' },
        task: { kind: 'scale', id: 'warmup-1', exercise: 'major:C:1:right', click: null, runs: 1 },
      },
    ]);
  });

  it('is the least even of the scales played lately, by the Scales page’s own rule', () => {
    const sessions = [
      scales('k1', 'major:C:1:right', -3, { share: 2, runs: 2 }),
      scales('k2', 'major:D:2:both', -2, { share: 6, runs: 3 }),
      scales('k3', 'hanon:C:2:both:1', -1, { share: 4 }),
    ];
    const [step] = warmup(withSessions(...sessions));
    expect(step).toMatchObject({ why: { kind: 'weakest' }, task: { exercise: 'major:D:2:both' } });
    expect(named(step!)).toBe(suggestedExercise(scaleProgress(sessions, at(0), TZ), at(0), TZ));
  });

  it('is the next rung once every scale played lately has its five runs', () => {
    const settled = [
      scales('k1', 'major:C:1:right', -3, { share: 2, runs: RECENT_RUNS }),
      scales('k2', 'major:C:1:left', -2, { share: 6, runs: RECENT_RUNS }),
    ];
    expect(warmup(withSessions(...settled))).toMatchObject([
      { why: { kind: 'nextScale' }, task: { exercise: 'major:C:2:both' } },
    ]);
    // One of them a run short: the scales in hand still want their work.
    const short = [settled[0]!, scales('k2', 'major:C:1:left', -2, { runs: RECENT_RUNS - 1 })];
    expect(warmup(withSessions(...short))).toMatchObject([
      { why: { kind: 'weakest' }, task: { exercise: 'major:C:1:left' } },
    ]);
    // Runs count over the weeks, not only the last days.
    const over = [
      scales('k0', 'major:C:1:left', -30, { runs: 1 }),
      scales('k2', 'major:C:1:left', -2, { runs: RECENT_RUNS - 1 }),
      settled[0]!,
    ];
    expect(names(todayPlan(withSessions(...over), options()), 'warmup')).toEqual([
      'major:C:2:both',
    ]);
  });

  it('is the next rung when no scale was played lately', () => {
    const old = [
      scales('k1', 'major:C:1:right', -20, { share: 9 }),
      scales('k2', 'major:C:1:left', -15),
    ];
    expect(warmup(withSessions(...old))).toMatchObject([
      { why: { kind: 'nextScale' }, task: { exercise: 'major:C:2:both' } },
    ]);
    // Thirteen days back is still lately, on the calendar.
    const edge = [scales('k1', 'major:C:1:right', -13, { hour: 1 })];
    expect(warmup(withSessions(...edge))).toMatchObject([{ why: { kind: 'weakest' } }]);
    const past = [scales('k1', 'major:C:1:right', -14, { hour: 23 })];
    expect(warmup(withSessions(...past))).toMatchObject([{ why: { kind: 'nextScale' } }]);
  });

  it('keeps to the scale in hand once the ladder is played through', () => {
    const ladder = scaleLadder(false).map((rung, i) => scales(`l${i}`, rung, -60));
    const lately = scales('k1', 'major:Db:2:both', -1, { runs: RECENT_RUNS });
    expect(warmup(withSessions(...ladder, lately))).toMatchObject([
      { why: { kind: 'weakest' }, task: { exercise: 'major:Db:2:both' } },
    ]);
    // With lesson 9 ticked the ladder goes on into the minors.
    expect(
      warmup(withSessions(...ladder, lately), { lessonsDone: ticked(MINOR_LESSON) }),
    ).toMatchObject([{ task: { exercise: 'harmonicMinor:A:1:right' } }]);
    // Nothing lately and no rung left: no warm-up.
    expect(warmup(withSessions(...ladder))).toEqual([]);
  });

  it('has the other of the two as the second warm-up of the 45-minute plan', () => {
    const working = [scales('k1', 'major:C:1:right', -1, { runs: 2 })];
    expect(names(todayPlan(withSessions(...working), options({ minutes: 45 })), 'warmup')).toEqual([
      'major:C:1:right',
      'major:C:1:left',
    ]);
    const settled = [scales('k1', 'major:C:1:right', -1, { runs: RECENT_RUNS })];
    const plan = todayPlan(withSessions(...settled), options({ minutes: 45 }));
    expect(names(plan, 'warmup')).toEqual(['major:C:1:left', 'major:C:1:right']);
    expect(part(plan, 'warmup').map((s) => s.why.kind)).toEqual(['nextScale', 'weakest']);
    expect(part(plan, 'warmup').map((s) => s.id)).toEqual(['warmup-1', 'warmup-2']);
    // Only one of the two to propose: one warm-up.
    expect(
      names(
        todayPlan(EMPTY, options({ minutes: 45, lessonsDone: ticked('major-scale') })),
        'warmup',
      ),
    ).toEqual(['major:C:1:right']);
    // The shorter plans have one.
    for (const minutes of [10, 20, 30] as const) {
      expect(names(todayPlan(withSessions(...working), options({ minutes })), 'warmup')).toEqual([
        'major:C:1:right',
      ]);
    }
  });

  it('is done by a run of that exercise today', () => {
    const before = scales('k1', 'major:C:1:right', -1, { runs: 2 });
    const plan = todayPlan(withSessions(before), options());
    expect(done(plan, withSessions(before))[0]).toBe(false);
    expect(done(plan, withSessions(before, scales('k2', 'major:G:1:right', 0)))[0]).toBe(false);
    expect(done(plan, withSessions(before, scales('k2', 'major:C:1:right', 0)))[0]).toBe(true);
  });
});

describe('the piece', () => {
  const open = ticked('landmarks');
  const work = (records: TodayRecords, patch: Partial<PlanOptions> = {}) =>
    part(todayPlan(records, options(patch)), 'work');

  it('is the piece in hand: practised lately and never played to its end', () => {
    const records = withSessions(played('a', MINUET, -2));
    expect(work(records)).toEqual([
      {
        kind: 'piece',
        id: 'work',
        part: 'work',
        why: { kind: 'inHand', days: 2 },
        piece: MINUET,
        goal: 'work',
      },
    ]);
  });

  it('is the one practised most recently of several', () => {
    const records = withSessions(
      played('a', MINUET, -2),
      played('b', MARCH, -1),
      played('c', MINUET, -5),
      played('d', ELISE, -3),
    );
    expect(work(records)).toMatchObject([{ piece: MARCH, why: { kind: 'inHand', days: 1 } }]);
  });

  it('is not a piece once played to its end, however lately it was practised', () => {
    const records = withSessions(
      played('a', MINUET, -9, { whole: true }),
      played('b', MINUET, -1),
      played('c', MARCH, -4),
    );
    expect(work(records)).toMatchObject([{ piece: MARCH }]);
  });

  it('is not a piece left for more than fourteen days', () => {
    // The Scales page's fourteen days, kept where the Pieces page reads them without its rules.
    expect(IN_HAND_DAYS).toBe(SUGGEST_DAYS);
    expect(work(withSessions(played('a', MINUET, -13, { hour: 1 })))).toMatchObject([
      { piece: MINUET, why: { kind: 'inHand', days: 13 } },
    ]);
    // Left longer, it gives way to the next piece.
    expect(work(withSessions(played('a', MINUET, -14, { hour: 23 })))).toMatchObject([
      { piece: FIRST, why: { kind: 'newPiece' } },
    ]);
  });

  it('may be an imported piece, but not one that is no longer here', () => {
    const mine: TodayPiece = { id: 'mine', grade: null, leadSheet: false, facts: null, out: false };
    const sessions = [played('a', 'mine', -1), played('b', MINUET, -2)];
    expect(work({ ...EMPTY, sessions, pieces: [...LIBRARY, mine] })).toMatchObject([
      { piece: 'mine', why: { kind: 'inHand', days: 1 } },
    ]);
    expect(work({ ...EMPTY, sessions })).toMatchObject([{ piece: MINUET }]);
    // Without its facts, a whole run with both hands is a run to its end.
    const whole = [played('a', 'mine', -1, { whole: true }), played('b', MINUET, -2)];
    expect(work({ ...EMPTY, sessions: whole, pieces: [...LIBRARY, mine] })).toMatchObject([
      { piece: MINUET },
    ]);
  });

  it('is the next piece when none is in hand and Pieces is open', () => {
    expect(work(EMPTY)).toEqual([]);
    expect(work(EMPTY, { lessonsDone: open })).toMatchObject([
      { id: 'work', piece: FIRST, goal: 'work', why: { kind: 'newPiece' } },
    ]);
    // An imported piece opens Pieces too.
    const mine: TodayPiece = { id: 'mine', grade: null, leadSheet: false, facts: null, out: false };
    expect(work({ ...EMPTY, pieces: [...LIBRARY, mine] })).toMatchObject([{ piece: FIRST }]);
  });

  it('goes up a grade once a piece of the grade below was played to its end', () => {
    const ode = played('a', ODE, -30, { whole: true });
    // The Initial pieces not begun come before a grade up.
    expect(work(withSessions(ode))).toMatchObject([{ piece: FIRST, why: { kind: 'newPiece' } }]);
    // The other pieces up to grade 1, but for the two minuets, begun long ago and left.
    const minuets = [MINUET, 'petzold-minuet-in-g-minor'];
    const begun = LIBRARY.filter(
      (p) => !p.leadSheet && p.grade !== null && p.grade <= 1 && p.id !== ODE,
    )
      .filter((p) => !minuets.includes(p.id))
      .map((p, i) => played(`g${i}`, p.id, -40));
    expect(work(withSessions(...begun, ode))).toMatchObject([
      { piece: MINUET, why: { kind: 'newPiece' } },
    ]);
    // Begun long ago and left: it has a session, so it is not proposed again.
    const tried = [ode, played('b', MINUET, -25), played('c', 'petzold-minuet-in-g-minor', -24)];
    expect(work(withSessions(...begun, ...tried))).toEqual([]);
    // A grade 1 piece finished: grade 2 is within reach.
    const first = [...begun, ode, played('b', MINUET, -25, { whole: true })];
    expect(work(withSessions(...first))).toMatchObject([{ piece: 'petzold-minuet-in-g-minor' }]);
    const both = [...first, played('c', 'petzold-minuet-in-g-minor', -24)];
    expect(work(withSessions(...both))).toMatchObject([{ piece: MARCH }]);
  });

  it('is done by a run to its end today, or five minutes on it today', () => {
    const before = played('a', MINUET, -1, { minutes: 20 });
    const plan = todayPlan(withSessions(before), options());
    const ticks = (...today: SessionRecord[]) => done(plan, withSessions(before, ...today))[0];
    expect(named(plan.steps[0]!)).toBe(MINUET);
    // Yesterday's twenty minutes are yesterday's.
    expect(ticks()).toBe(false);
    expect(ticks(played('b', MINUET, 0, { minutes: 4 }))).toBe(false);
    expect(ticks(played('b', MINUET, 0, { minutes: WORK_MS / 60_000 }))).toBe(true);
    expect(
      ticks(
        played('b', MINUET, 0, { minutes: 3 }),
        played('c', MINUET, 0, { minutes: 2, hour: 20 }),
      ),
    ).toBe(true);
    expect(ticks(played('b', MINUET, 0, { minutes: 1, whole: true }))).toBe(true);
    // Time on another piece is not time on this one.
    expect(ticks(played('b', MARCH, 0, { minutes: 30, whole: true }))).toBe(false);
  });
});

describe('something new', () => {
  const fresh = (records: TodayRecords, patch: Partial<PlanOptions> = {}) =>
    names(todayPlan(records, options(patch)), 'new');
  /** Lessons 3 and 4 ticked: with the notes, six families are open. */
  const six = ticked('landmarks', 'rhythm');

  it('proposes the families never practised first, in the pages’ order', () => {
    expect(fresh(EMPTY, { minutes: 45, lessonsDone: six })).toEqual([
      'lesson:keyboard',
      'notes:L1',
      'readInterval:RI1',
      'rhythm:R1',
    ]);
  });

  it('proposes only families that are open', () => {
    expect(fresh(EMPTY, { minutes: 45 })).toEqual(['lesson:keyboard', 'notes:L1']);
    // A session of a family opens it without its lesson.
    const ear = on(sampleEarSession('e1', 4).session, -1);
    expect(fresh(withSessions(ear), { minutes: 45 })).toEqual([
      'lesson:keyboard',
      'notes:L1',
      'interval:I1',
    ]);
  });

  it('takes the families in turn: the one left alone longest comes first', () => {
    const sessions = [
      read('s1', -1).session,
      on(sampleTheorySession('t1', 4).session, -5),
      on(sampleRhythmSession('r1', 2).session, -3),
    ];
    const plan = todayPlan(withSessions(...sessions), options({ minutes: 45, lessonsDone: six }));
    // Never practised (sight, intervals by ear, rhythm by ear) before all others.
    expect(names(plan, 'new')).toEqual([
      'lesson:keyboard',
      'sight:F1',
      'interval:I1',
      'rhythmEar:R1',
    ]);
    expect(part(plan, 'new').map((s) => s.why)).toEqual([
      { kind: 'lesson', n: 1, of: 15 },
      { kind: 'level', days: null },
      { kind: 'level', days: null },
      { kind: 'level', days: null },
    ]);
    // Once those have a session, the longest untouched leads: 5 days, 3 days, yesterday.
    const all = [
      ...sessions,
      on(sampleEarSession('e1', 4).session, -2),
      on(sampleRhythmEarSession('d1', 2).session, -2),
      on(sampleSightSession('g1', 2), -2),
    ];
    const later = todayPlan(withSessions(...all), options({ minutes: 45, lessonsDone: six }));
    expect(names(later, 'new')).toEqual([
      'lesson:keyboard',
      'readInterval:RI1',
      'rhythm:R1',
      // Three families at the same moment two days ago: the pages' order decides.
      'sight:F1',
    ]);
    expect(part(later, 'new')[1]!.why).toEqual({ kind: 'level', days: 5 });
    expect(part(later, 'new')[2]!.why).toEqual({ kind: 'level', days: 3 });
  });

  it('proposes a family’s first level not mastered, and none of a family mastered throughout', () => {
    const first = read('s1', -3, { level: 'L1', cards: MASTERY_WINDOW });
    const records = { ...withSessions(first.session), attempts: first.attempts };
    expect(fresh(records)).toEqual(['lesson:keyboard', 'notes:L2']);
    const all = LEVEL_IDS.map((level, i) =>
      read(`s${i}`, -9 + i, { level, cards: MASTERY_WINDOW }),
    );
    const mastered = {
      ...withSessions(...all.map((r) => r.session)),
      attempts: all.flatMap((r) => r.attempts),
    };
    expect(fresh(mastered)).toEqual(['lesson:keyboard']);
    expect(fresh(mastered, { lessonsDone: ticked('landmarks') })).toEqual([
      'lesson:keyboard',
      'readInterval:RI1',
    ]);
  });

  it('has the lesson before the levels in the longer plans, until all fifteen are ticked', () => {
    expect(fresh(EMPTY, { lessonsDone: lessons(4) })).toEqual([
      'lesson:sharps-and-flats',
      'notes:L1',
    ]);
    const plan = todayPlan(EMPTY, options({ lessonsDone: lessons(4) }));
    expect(part(plan, 'new')[0]).toEqual({
      kind: 'task',
      id: 'new-lesson',
      part: 'new',
      why: { kind: 'lesson', n: 5, of: 15 },
      task: { kind: 'lesson', id: 'new-lesson', slug: 'sharps-and-flats' },
    });
    expect(part(plan, 'new')[1]).toEqual({
      kind: 'task',
      id: 'new-1',
      part: 'new',
      why: { kind: 'level', days: null },
      task: { kind: 'level', id: 'new-1', family: 'notes', level: 'L1', goal: 1 },
    });
    expect(fresh(EMPTY, { lessonsDone: lessons(15) })).toEqual(['notes:L1']);
    expect(fresh(EMPTY, { minutes: 30, lessonsDone: lessons(15) })).toEqual([
      'notes:L1',
      'readInterval:RI1',
    ]);
  });

  it('in the 10-minute plan, has the lesson alone before seven ticks and a level alone after', () => {
    for (let n = 0; n <= 15; n++) {
      const [step, ...rest] = part(
        todayPlan(EMPTY, options({ minutes: 10, lessonsDone: lessons(n) })),
        'new',
      );
      expect(rest, `${n} ticked`).toEqual([]);
      if (n < LESSON_FIRST)
        expect(named(step!), `${n} ticked`).toBe(`lesson:${CURRICULUM_LESSONS[n]}`);
      else expect(named(step!), `${n} ticked`).toBe('notes:L1');
    }
    expect(LESSON_FIRST).toBe(7);
  });

  it('ticks a level by a session of it played to its end today, the lesson by its tick', () => {
    const plan = todayPlan(EMPTY, options());
    expect(names(plan, 'new')).toEqual(['lesson:keyboard', 'notes:L1']);
    expect(done(plan, EMPTY)).toEqual([false, false]);
    // Left halfway, or another level, or yesterday: not this step.
    const half = read('s1', 0, { cards: 4, planned: 10 }).session;
    const other = read('s2', 0, { level: 'L2' }).session;
    const yesterday = read('s3', -1).session;
    expect(done(plan, withSessions(half, other, yesterday))).toEqual([false, false]);
    expect(done(plan, withSessions(read('s4', 0).session))).toEqual([false, true]);
    expect(done(plan, EMPTY, ticked('keyboard'))).toEqual([true, false]);
  });
});

describe('play through', () => {
  const reviewed = [
    played('a', ODE, -6, { whole: true }),
    played('b', MINUET, -3, { whole: true }),
    played('c', MARCH, -9, { whole: true }),
    played('d', ELISE, -2, { whole: true }),
  ];

  it('has the pieces due for review, the longest overdue first', () => {
    const plan = todayPlan(withSessions(...reviewed), options({ minutes: 45 }));
    expect(part(plan, 'play')).toEqual([
      {
        kind: 'piece',
        id: 'play-1',
        part: 'play',
        why: { kind: 'due', days: 8 },
        piece: MARCH,
        goal: 'through',
      },
      {
        kind: 'piece',
        id: 'play-2',
        part: 'play',
        why: { kind: 'due', days: 5 },
        piece: ODE,
        goal: 'through',
      },
      {
        kind: 'piece',
        id: 'play-3',
        part: 'play',
        why: { kind: 'due', days: 2 },
        piece: MINUET,
        goal: 'through',
      },
    ]);
    expect(names(todayPlan(withSessions(...reviewed), options({ minutes: 10 })), 'play')).toEqual([
      MARCH,
    ]);
  });

  it('leaves out a piece taken out of review, and one not due yet', () => {
    const pieces = LIBRARY.map((p) => (p.id === MARCH ? { ...p, out: true } : p));
    const plan = todayPlan({ ...withSessions(...reviewed), pieces }, options({ minutes: 45 }));
    expect(names(plan, 'play')).toEqual([ODE, MINUET, ELISE]);
    // Played through yesterday, it is due today; reviewed again yesterday, it waits.
    const again = [...reviewed, played('e', ODE, -1, { whole: true })];
    expect(names(todayPlan(withSessions(...again), options({ minutes: 45 })), 'play')).toEqual([
      MARCH,
      MINUET,
      ELISE,
    ]);
  });

  it('is done by a run to the end today, not by time on the piece', () => {
    const plan = todayPlan(withSessions(...reviewed), options({ minutes: 10 }));
    const at = plan.steps.findIndex((s) => s.part === 'play');
    const ticks = (...today: SessionRecord[]) =>
      done(plan, withSessions(...reviewed, ...today))[at];
    expect(ticks()).toBe(false);
    expect(ticks(played('x', MARCH, 0, { minutes: 30 }))).toBe(false);
    expect(ticks(played('x', ODE, 0, { whole: true }))).toBe(false);
    expect(ticks(played('x', MARCH, 0, { whole: true }))).toBe(true);
  });
});

describe('the plan', () => {
  /** Everything to propose: two scales, a piece in hand, six open families, four pieces due. */
  const full: TodayRecords = withSessions(
    scales('k1', 'major:C:1:right', -1, { runs: 2 }),
    played('p1', 'burgmuller-arabesque', -1),
    played('a', ODE, -6, { whole: true }),
    played('b', MINUET, -3, { whole: true }),
    played('c', MARCH, -9, { whole: true }),
    played('d', ELISE, -2, { whole: true }),
  );
  const six = ticked('landmarks', 'rhythm');

  it('has as many steps in each part as its length says', () => {
    const shape = (minutes: PlanMinutes, lessonsDone = six) => {
      const plan = todayPlan(full, options({ minutes, lessonsDone }));
      return (['warmup', 'work', 'new', 'play'] as const).map((p) => part(plan, p).length);
    };
    // New: the lesson alone at 10, then the lesson and one, two and three levels.
    expect(shape(10)).toEqual([1, 1, 1, 1]);
    expect(shape(20)).toEqual([1, 1, 2, 2]);
    expect(shape(30)).toEqual([1, 1, 3, 2]);
    expect(shape(45)).toEqual([2, 1, 4, 3]);
    expect(shape(10, lessons(8))).toEqual([1, 1, 1, 1]);
    expect(PLAN_MINUTES).toEqual([10, 20, 30, 45]);
    expect(DEFAULT_PLAN_MINUTES).toBe(20);
    for (const minutes of PLAN_MINUTES) {
      const { warmup, levels, play } = PLAN_COUNTS[minutes];
      expect(shape(minutes, lessons(15))).toEqual([warmup, 1, levels, play]);
    }
  });

  it('is in the order of a session: warm-up, work, new (the lesson first), play through', () => {
    const plan = todayPlan(full, options({ minutes: 45, lessonsDone: six }));
    expect(plan.steps.map((s) => s.part)).toEqual([
      'warmup',
      'warmup',
      'work',
      'new',
      'new',
      'new',
      'new',
      'play',
      'play',
      'play',
    ]);
    expect(named(plan.steps[3]!)).toBe('lesson:keyboard');
    expect(new Set(plan.steps.map((s) => s.id)).size).toBe(plan.steps.length);
    expect(plan).toMatchObject({ day: TODAY, minutes: 45, lessonsDone: ['landmarks', 'rhythm'] });
  });

  it('leaves out a part with nothing to propose', () => {
    const plan = todayPlan(EMPTY, options({ minutes: 45 }));
    expect(plan.steps.map(named)).toEqual(['lesson:keyboard', 'notes:L1']);
  });

  it('is empty when nothing is waiting', () => {
    const nothing: CurriculumState = {
      lessons: { done: 15, of: 15, next: null },
      families: LEVEL_FAMILIES.map((family) => ({
        family,
        open: true,
        lesson: null,
        levels: levelsOfFamily(family).length,
        mastered: levelsOfFamily(family).length,
        suggested: null,
        lastAt: at(-1),
      })),
      scales: { open: true, played: 72, weakest: null, settled: true, next: null },
      pieces: { open: true, inReview: 2, due: [], grades: [], inHand: null, next: null },
    };
    for (const minutes of PLAN_MINUTES) {
      const plan = planOf(nothing, options({ minutes, lessonsDone: lessons(15) }));
      expect(plan.steps).toEqual([]);
      expect(done(plan, EMPTY)).toEqual([]);
    }
  });

  it('is not changed by what is recorded today', () => {
    const lessonsDone = ticked('landmarks', 'rhythm', 'major-scale');
    const mastered = read('m1', 0, { level: 'L1', cards: MASTERY_WINDOW });
    for (const minutes of PLAN_MINUTES) {
      const plan = todayPlan(full, options({ minutes, lessonsDone }));
      const later: TodayRecords = {
        ...full,
        sessions: [
          ...full.sessions,
          // The warm-up played five times over, a new scale, the piece in hand to its end, a
          // piece reviewed, another begun, a level mastered and a family practised for the first time.
          scales('t1', 'major:C:1:right', 0, { runs: 6, share: 9 }),
          scales('t2', 'major:C:1:left', 0),
          played('t3', 'burgmuller-arabesque', 0, { whole: true }),
          played('t4', MARCH, 0, { whole: true }),
          played('t5', 'bach-prelude-in-c', 0),
          mastered.session,
          on(sampleEarSession('t6', 4).session, 0),
        ],
        attempts: mastered.attempts,
      };
      expect(todayPlan(later, options({ minutes, lessonsDone }))).toEqual(plan);
      // And it is ticked by them.
      const ticks = done(plan, later, lessonsDone);
      const tick = (name: string) => ticks[plan.steps.findIndex((s) => named(s) === name)];
      expect(tick('major:C:1:right')).toBe(true);
      expect(tick('burgmuller-arabesque')).toBe(true);
      expect(tick(MARCH)).toBe(true);
      expect(tick('lesson:keyboard')).toBe(false);
      if (minutes !== 10) expect(tick('notes:L1')).toBe(true);
      expect(ticks.filter(Boolean).length).toBeLessThan(plan.steps.length);
    }
    // The day after, the same records make another plan.
    const ended = withSessions(
      ...full.sessions,
      played('t3', 'burgmuller-arabesque', 0, { whole: true }),
    );
    const next = todayPlan(ended, options({ today: '2026-09-25', minutes: 45 }));
    // The piece in hand was played to its end: a new piece is begun (the first of its grade, the
    // third, that has no session yet: not the Initial pieces), and it has come due for review,
    // last in the line.
    expect(names(next, 'work')).toEqual(['tchaikovsky-morning-prayer']);
    expect(names(next, 'play')).toEqual([MARCH, ODE, MINUET]);
    const state = curriculumState(ended, options({ today: '2026-09-25' }));
    expect(state.pieces.due.at(-1)).toEqual({ id: 'burgmuller-arabesque', overdue: 0 });
  });

  it('draws the line where today began on the player’s calendar', () => {
    // 23 September 23:30 and 24 September 00:30 in Auckland (UTC+12): eleven and twelve hours
    // before midnight UTC.
    const zone = 'Pacific/Auckland';
    const late = scales('k1', 'major:C:1:right', -1, { hour: 11.5 });
    const early = scales('k2', 'major:C:1:left', -1, { hour: 12.5 });
    const plan = todayPlan(withSessions(late, early), options({ timeZone: zone }));
    expect(names(plan, 'warmup')).toEqual(['major:C:1:right']);
    const progress = planProgress(plan, withSessions(late, early), {
      lessonsDone: ticked(),
      timeZone: zone,
    });
    expect(progress[0]).toBe(false);
    // In UTC both were yesterday: the second is the weaker by its date alone, and nothing is done.
    const utc = todayPlan(withSessions(late, early), options());
    expect(names(utc, 'warmup')).toEqual(['major:C:1:left']);
    // A scale session that runs past midnight keeps its runs from before for the plan.
    const across = withRun(late, 'k1', {
      id: 'k1:9',
      exercise: 'major:C:1:right',
      startedAt: at(-1, 12.5),
      endedAt: at(-1, 12.6),
      headline: sampleHeadline(),
    });
    const kept = todayPlan(withSessions(across), options({ timeZone: zone }));
    expect(kept).toEqual(todayPlan(withSessions(late), options({ timeZone: zone })));
    expect(
      planProgress(kept, withSessions(across), { lessonsDone: ticked(), timeZone: zone })[0],
    ).toBe(true);
  });
});

describe('the kept plan', () => {
  const records = withSessions(scales('k1', 'major:C:1:right', -1, { runs: 2 }));
  const first = todayPlan(records, options({ lessonsDone: lessons(2) }));

  it('stands for the rest of its day at its length', () => {
    // Records that arrive from another device, and a lesson ticked since, change nothing.
    const more = withSessions(
      ...records.sessions,
      scales('k9', 'major:D:2:both', -1, { share: 9 }),
    );
    const kept = planFor(first, more, options({ lessonsDone: lessons(3) }));
    expect(kept).toBe(first);
    expect(names(kept, 'new')[0]).toBe('lesson:landmarks');
    expect(done(kept, more, lessons(3))[names(kept, 'warmup').length]).toBe(true);
  });

  it('is made again for another length, from the lessons kept with it', () => {
    const longer = planFor(first, records, options({ minutes: 45, lessonsDone: lessons(3) }));
    expect(longer).toEqual(todayPlan(records, options({ minutes: 45, lessonsDone: lessons(2) })));
    expect(longer.minutes).toBe(45);
    expect(longer.lessonsDone).toEqual(['keyboard', 'staff']);
    // The lesson ticked today stays the step it was.
    expect(names(longer, 'new')[0]).toBe('lesson:landmarks');
  });

  it('is made anew on another day, from the lessons ticked then', () => {
    const next = planFor(first, records, options({ today: '2026-09-25', lessonsDone: lessons(3) }));
    expect(next).toEqual(
      todayPlan(records, options({ today: '2026-09-25', lessonsDone: lessons(3) })),
    );
    expect(next.day).toBe('2026-09-25');
    expect(names(next, 'new')[0]).toBe('lesson:rhythm');
    expect(planFor(null, records, options({ lessonsDone: lessons(2) }))).toEqual(first);
  });

  it('is read back from the browser as it was written', () => {
    const plan = todayPlan(
      withSessions(
        scales('k1', 'major:C:1:right', -1, { runs: 2 }),
        played('p1', 'burgmuller-arabesque', -1),
        played('a', ODE, -6, { whole: true }),
      ),
      options({ minutes: 45, lessonsDone: ticked('landmarks') }),
    );
    expect(plan.steps.length).toBeGreaterThan(5);
    expect(readPlan(JSON.parse(JSON.stringify(plan)))).toEqual(plan);
    const empty: TodayPlan = { day: TODAY, minutes: 10, steps: [], lessonsDone: [] };
    expect(readPlan(empty)).toEqual(empty);
  });

  it('is no plan when it is anything else', () => {
    const plan = JSON.parse(JSON.stringify(first)) as TodayPlan;
    const broken: unknown[] = [
      null,
      'plan',
      [],
      { ...plan, day: '24 Sep' },
      { ...plan, minutes: 15 },
      { ...plan, steps: 'none' },
      { ...plan, lessonsDone: [1] },
      { ...plan, steps: [{ ...plan.steps[0], part: 'encore' }] },
      { ...plan, steps: [{ ...plan.steps[0], why: { kind: 'because' } }] },
      { ...plan, steps: [{ ...plan.steps[0], task: { kind: 'scale', exercise: 'loud:C' } }] },
      {
        ...plan,
        steps: [{ ...plan.steps[0], task: { kind: 'level', family: 'notes', level: 'L99' } }],
      },
      { ...plan, steps: [{ ...plan.steps[0], task: { kind: 'lesson', slug: 'nowhere' } }] },
      { ...plan, steps: [{ ...plan.steps[0], task: { kind: 'minutes', minutes: 5, days: 1 } }] },
      { ...plan, steps: [plan.steps[0], plan.steps[0]] },
      {
        ...plan,
        steps: [{ kind: 'piece', id: 'work', part: 'work', why: { kind: 'newPiece' }, piece: 7 }],
      },
      { ...plan, steps: Array.from({ length: 40 }, () => plan.steps[0]) },
    ];
    for (const value of broken) expect(readPlan(value), JSON.stringify(value)).toBeNull();
    // What a plan does not hold is not kept.
    const extra = readPlan({ ...plan, note: 'x', steps: [{ ...plan.steps[0], note: 'y' }] });
    expect(extra).toEqual({ ...first, steps: [first.steps[0]] });
  });
});

// docs/PIECES.md, "A piece's plan": the work step opens the next step of the plan of the piece
// in hand, as it stood when the day began.
describe('the piece in hand’s next step', () => {
  /** An imported piece of eight bars: quarter notes over a whole note in the left hand. */
  const written = score(bars(8), [
    ...quarters(8, [60, 62, 64, 65]),
    ...Array.from({ length: 8 }, (_, i) => note(i, i * 4 * Q, 4 * Q, 48, 'left')),
  ]);
  const source = planSource(written);
  const mine: TodayPiece = {
    id: 'mine',
    grade: null,
    leadSheet: false,
    facts: source.facts,
    out: false,
  };
  const plans = new Map([['mine', source]]);

  /** A wait-mode run of bars 1 to 4 on day `day`, without a wrong note: session and steps. */
  function loop(id: string, day: number, hands: HandSelection, hour = 17) {
    const steps = buildSteps(written, hands)
      .filter((step) => step.measure <= 3)
      .map((step, n): PieceStep => ({
        id: stepId(id, n),
        sessionId: id,
        pieceId: 'mine',
        checksum: source.facts.checksum,
        hands,
        measure: step.measure,
        pass: 1,
        ms: 600,
        wrong: 0,
        at: at(day, hour) + n * 600,
      }));
    const session: PieceSessionRecord = {
      ...played(id, 'mine', day, { hands, hour }),
      loop: { from: 0, to: 3, fromLabel: '1', toLabel: '4' },
      steps: steps.length,
    };
    return { session, steps };
  }
  const records = (runs: ReturnType<typeof loop>[], withPlans = true): TodayRecords => ({
    ...EMPTY,
    sessions: runs.map((r) => r.session),
    steps: new Map([['mine', runs.flatMap((r) => r.steps)]]),
    pieces: [...LIBRARY, mine],
    ...(withPlans && { plans }),
  });
  const work = (r: TodayRecords) => part(todayPlan(r, options()), 'work')[0];
  const bars14 = { from: 0, to: 3, fromLabel: '1', toLabel: '4' };
  const right: StageStart = {
    stage: 'right',
    bars: bars14,
    hands: 'right',
    mode: 'wait',
    tempo: null,
  };

  it('is the work step’s, with what starting it sets', () => {
    expect(work(records([loop('a', -1, 'right')]))).toEqual({
      kind: 'piece',
      id: 'work',
      part: 'work',
      why: { kind: 'inHand', days: 1 },
      piece: 'mine',
      goal: 'work',
      step: right,
    });
    // Without the piece's score there is no plan: the piece is opened as it was left.
    const bare = work(records([loop('a', -1, 'right')], false));
    expect(bare).toMatchObject({ piece: 'mine', goal: 'work' });
    expect(bare).not.toHaveProperty('step');
    // Where you are has the same state.
    const state = curriculumState(records([loop('a', -1, 'right')]), options());
    expect(state.pieces.inHand).toEqual({ id: 'mine', day: '2026-09-23', step: right });
  });

  it('moves on as the stages are done: the right hand’s bars steady, the left hand is next', () => {
    const three = [loop('a', -3, 'right'), loop('b', -2, 'right'), loop('c', -1, 'right')];
    expect(work(records(three))).toMatchObject({
      why: { kind: 'inHand', days: 1 },
      step: { ...right, stage: 'left', hands: 'left' },
    });
  });

  it('is as it stood when the day began: what is played today ticks the step and leaves it', () => {
    const before = [loop('a', -2, 'right'), loop('b', -1, 'right')];
    const plan = todayPlan(records(before), options());
    // A third steady run today finishes the stage: the day's plan still names the right hand.
    const today = [...before, loop('c', 0, 'right', 9)];
    expect(todayPlan(records(today), options())).toEqual(plan);
    expect(part(plan, 'work')[0]).toMatchObject({ step: right });
    // The step is done as before: by five minutes on the piece or a run to its end.
    const index = plan.steps.findIndex((step) => step.id === 'work');
    expect(done(plan, records(today))[index]).toBe(false);
    const long = loop('d', 0, 'left', 10);
    long.session = { ...long.session, activeMs: WORK_MS };
    expect(done(plan, records([...today, long]))[index]).toBe(true);
    // Tomorrow's plan has the next stage.
    const next = todayPlan(records(today), options({ today: '2026-09-25' }));
    expect(part(next, 'work')[0]).toMatchObject({ step: { stage: 'left' } });
  });

  it('is kept with the plan, and read back field by field', () => {
    const plan = todayPlan(records([loop('a', -1, 'right')]), options());
    const kept = JSON.parse(JSON.stringify(plan)) as TodayPlan;
    expect(readPlan(kept)).toEqual(plan);
    const index = plan.steps.findIndex((step) => step.id === 'work');
    const withStep = (step: unknown, patch: object = {}): unknown => ({
      ...kept,
      steps: kept.steps.map((s, i) => (i === index ? { ...s, step, ...patch } : s)),
    });
    const stepOf = (value: unknown) => {
      const read = readPlan(value)?.steps[index];
      return read?.kind === 'piece' ? read.step : undefined;
    };

    // A stage in time, with its tempo; the whole piece, without bars.
    const inTime = { ...right, stage: 'inTime', hands: 'both', mode: 'rhythm', tempo: 60 };
    expect(stepOf(withStep(inTime))).toEqual(inTime);
    const whole = { stage: 'whole', bars: null, hands: 'both', mode: 'wait', tempo: null };
    expect(stepOf(withStep(whole))).toEqual(whole);
    // What a step does not hold is not kept.
    expect(stepOf(withStep({ ...right, done: false, bars: { ...bars14, note: 'x' } }))).toEqual(
      right,
    );

    // A plan kept before a piece had a plan: its work step has none, and stands as it was.
    const old = Object.fromEntries(
      Object.entries(kept.steps[index]!).filter(([field]) => field !== 'step'),
    );
    const earlier = { ...kept, steps: kept.steps.map((s, i) => (i === index ? old : s)) };
    expect(readPlan(earlier)).toEqual(earlier);
    expect(stepOf(earlier)).toBeUndefined();
    // Only the piece in hand has one: on a piece to play through it is not kept.
    expect(stepOf(withStep(right, { goal: 'through' }))).toBeUndefined();

    // A step that is anything else is no plan: it is made again.
    const broken: unknown[] = [
      null,
      'bars 1 to 4',
      { ...right, stage: 'encore' },
      { ...right, hands: 'feet' },
      { ...right, mode: 'memory' },
      { ...right, tempo: 65 },
      { ...right, tempo: undefined },
      { ...right, bars: null },
      { ...right, bars: { from: 3, to: 0, fromLabel: '4', toLabel: '1' } },
      { ...right, bars: { from: 0, to: 3 } },
      { ...right, bars: { ...bars14, from: -1 } },
      { ...right, bars: { ...bars14, toLabel: 'x'.repeat(40) } },
      { ...whole, bars: bars14 },
    ];
    for (const step of broken) expect(readPlan(withStep(step)), JSON.stringify(step)).toBeNull();
  });
});

describe('an assignment comes first', () => {
  const level: LevelTask = { kind: 'level', id: 't1', family: 'notes', level: 'L1', goal: 2 };
  const tasks: Task[] = [
    level,
    { kind: 'lesson', id: 't2', slug: 'staff' },
    { kind: 'unknown', id: 't3', raw: {} },
  ];
  const progress = (first: boolean, second: boolean): TaskProgress[] => [
    {
      kind: 'level',
      done: first ? 2 : 1,
      target: 2,
      met: first,
      best: null,
      last: null,
      mastery: null,
    },
    { kind: 'lesson', done: second ? 1 : 0, target: 1, met: second },
    { kind: 'unknown', done: 0, target: 0, met: false },
  ];

  it('hides the steps while it has open tasks', () => {
    expect(assignmentComesFirst(tasks, progress(false, false))).toBe(true);
    expect(assignmentComesFirst(tasks, progress(true, false))).toBe(true);
  });

  it('gives way once its tasks are met', () => {
    // A task this version does not know is never met, and holds nothing up.
    expect(assignmentComesFirst(tasks, progress(true, true))).toBe(false);
    expect(assignmentComesFirst([], [])).toBe(false);
  });
});

describe('the instrument’s keys (G6c)', () => {
  const C2_TO_C6 = { low: 36, high: 84 };
  const open = { lessonsDone: ticked('major-scale') };
  const rungs = ['major:C:1:right', 'major:C:1:left', 'major:C:2:both', 'major:G:1:right'];
  const sessions = [
    ...rungs.map((rung, i) => scales(`s${i}`, rung, -1, { runs: 5, share: 1, hour: 9 + i })),
    scales('s9', 'major:G:1:left', -1, { runs: 5, share: 3, hour: 15 }),
  ];

  it('does not propose as the next scale a rung that runs beyond the keyboard', () => {
    const state = (keys?: PlanOptions['keys']) =>
      curriculumState(withSessions(...sessions), options({ ...open, keys })).scales;
    // Two octaves of G major hands together go up to G6: over a keyboard that ends on C6.
    expect(state().next).toBe('major:G:2:both');
    expect(state(C2_TO_C6).next).toBe('major:F:1:right');
    expect(state({ low: 36, high: 96 }).next).toBe('major:G:2:both');
    expect(state({ low: 21, high: 108 }).next).toBe('major:G:2:both');
    // What was played stays what it was.
    expect(state(C2_TO_C6).played).toBe(5);
    expect(state(C2_TO_C6).weakest).toBe('major:G:1:left');
  });

  it('nor as the scale to play again one played lately that runs beyond it', () => {
    const beyond = [...sessions, scales('s10', 'major:G:2:both', -1, { runs: 5, share: 9 })];
    const state = (keys?: PlanOptions['keys']) =>
      curriculumState(withSessions(...beyond), options({ ...open, keys })).scales;
    expect(state().weakest).toBe('major:G:2:both');
    expect(state(C2_TO_C6).weakest).toBe('major:G:1:left');
    // Today's warm-up follows.
    const warmup = (keys?: PlanOptions['keys']) =>
      names(todayPlan(withSessions(...beyond), options({ ...open, keys })), 'warmup');
    expect(warmup()).toContain('major:F:1:right');
    expect(warmup(C2_TO_C6)).not.toContain('major:G:2:both');
    expect(warmup(C2_TO_C6)).toContain('major:F:1:right');
  });
});
