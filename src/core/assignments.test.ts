import { describe, expect, it } from 'vitest';
import {
  sampleAnswer,
  sampleAttempt,
  sampleEarSession,
  sampleHarmonySession,
  sampleHeadline,
  sampleRhythmEarSession,
  sampleRhythmSession,
  sampleSightSession,
  sampleTheorySession,
  sampleTuneSession,
} from '../storage/fixtures.ts';
import type {
  Assignment,
  LevelTask,
  PieceTask,
  ScaleTask,
  TaskProgress,
} from './assignmentRecords.ts';
import { decodeShare, encodeShare, parseReport } from './assignmentShare.ts';
import {
  assignmentProgress,
  buildReport,
  reportDayList,
  reportDays,
  isTaskTempo,
  LEVEL_FAMILIES,
  levelsOfFamily,
  minutesPerDay,
  pageOfFamily,
  passSteps,
  pieceRuns,
  taskPiece,
  taskPieceIds,
  taskProgress,
  tasksMet,
  windowDays,
  type ProgressInput,
} from './assignments.ts';
import { recoverEarSummary } from './earSession.ts';
import type { ReadSessionRecord, SessionRecord } from './log.ts';
import { MASTERY_WINDOW } from './mastery.ts';
import { pieceSession, stepId, type PieceSession, type PieceStep } from './pieceRecords.ts';
import { withRun, type ScaleSession } from './scaleRecords.ts';
import { bar, bars, note, Q, score } from './scoreFixtures.ts';
import { recoverSummary } from './session.ts';
import { TUNE_IDS } from './tuneList.ts';

const TZ = 'UTC';
const DAY = 86_400_000;
/** Monday 21 September 2026, 17:00: the first day of the week set. */
const MON = Date.UTC(2026, 8, 21, 17);
const WEEK = { start: '2026-09-21', due: '2026-09-27' };
const CHECKSUM = 'abcdef01';

const EMPTY: ProgressInput = {
  sessions: [],
  attempts: [],
  answers: [],
  pieces: [{ id: 'p', checksum: CHECKSUM }],
  lessonsDone: new Set(),
  timeZone: TZ,
};

/** Bars 5–8 (indexes 4–7), two steps a bar: a pass is 8 steps; the whole piece (8 bars) 16. */
function pieceTask(patch: Partial<PieceTask> = {}): PieceTask {
  return {
    kind: 'piece',
    id: 't1',
    piece: { id: 'p', title: 'Piece', composer: '', checksum: CHECKSUM },
    bars: { from: 4, to: 7, fromLabel: '5', toLabel: '8' },
    hands: 'right',
    mode: 'wait',
    tempo: 80,
    runs: 3,
    pass: { play: 8, skip: 8 },
    ...patch,
  };
}

interface RunOptions {
  /** Days after Monday. */
  day?: number;
  /** The bars looped (indexes); null: from bar `from` to the end of the piece. */
  loop?: [number, number] | null;
  from?: number;
  /** Steps played; by default one pass of the loop, or the piece from `from`. */
  steps?: number;
  /** Wrong notes on these steps (by position in the run). */
  wrongAt?: number[];
  hands?: 'right' | 'left' | 'both';
  mode?: 'rhythm' | 'memory';
  tempo?: number;
  completed?: boolean;
  repeats?: 'play' | 'skip';
  pieceId?: string;
  checksum?: string;
  /** Rhythm mode: each step's one note, how far off (null: missed); cycled over the steps. */
  deviations?: (number | null)[];
  /** Semitones the piece was moved by (H4). */
  transpose?: number;
  /** The left hand was made from the chord symbols, in this pattern (H3). */
  leftHand?: 'block' | 'alberti';
}

/** A run of piece `p`: two steps a bar, round the loop (or through the piece) as far as `steps`. */
function run(id: string, o: RunOptions = {}): { session: PieceSession; steps: PieceStep[] } {
  const start = MON + (o.day ?? 0) * DAY;
  const [first, last] = o.loop ?? [o.from ?? 0, 7];
  const perLap = (last - first + 1) * 2;
  const count = o.steps ?? perLap;
  const steps: PieceStep[] = Array.from({ length: count }, (_, n) => ({
    id: stepId(id, n),
    sessionId: id,
    pieceId: o.pieceId ?? 'p',
    checksum: o.checksum ?? CHECKSUM,
    hands: o.hands ?? 'right',
    measure: first + Math.floor((n % perLap) / 2),
    pass: 1,
    ms: 500,
    wrong: o.wrongAt?.includes(n) ? 1 : 0,
    at: start + (n + 1) * 500,
    ...(o.transpose !== undefined && { transpose: o.transpose }),
    ...(o.mode === 'rhythm' && {
      mode: 'rhythm' as const,
      notes: [{ midi: 60, deviation: o.deviations ? o.deviations[n % o.deviations.length]! : 0 }],
    }),
    ...(o.mode === 'memory' && {
      mode: 'memory' as const,
      prompts: 0,
      stage: 'alternate' as const,
    }),
  }));
  const session = pieceSession(
    {
      id,
      pieceId: o.pieceId ?? 'p',
      title: 'Piece',
      hands: o.hands ?? 'right',
      loop: o.loop
        ? { from: first, to: last, fromLabel: String(first + 1), toLabel: String(last + 1) }
        : null,
      repeats: o.repeats ?? 'play',
      tempo: o.tempo ?? 80,
      startedAt: start,
      ...(o.mode && { mode: o.mode }),
      ...(o.leftHand && { leftHand: o.leftHand }),
      ...(o.transpose !== undefined && { transpose: o.transpose }),
    },
    steps,
    o.completed ?? true,
  );
  return { session, steps };
}

function withRuns(
  runs: { session: PieceSession; steps: PieceStep[] }[],
  patch: Partial<ProgressInput> = {},
): ProgressInput {
  const steps = new Map<string, PieceStep[]>();
  for (const r of runs) {
    for (const step of r.steps) steps.set(step.pieceId, [...(steps.get(step.pieceId) ?? []), step]);
  }
  return { ...EMPTY, sessions: runs.map((r) => r.session), steps, ...patch };
}

const piece = (task: PieceTask, input: ProgressInput) =>
  taskProgress(task, WEEK, input) as Extract<TaskProgress, { kind: 'piece' }>;

describe('what a task can name', () => {
  it('every family has its levels and its page', () => {
    for (const family of LEVEL_FAMILIES) {
      expect(levelsOfFamily(family).length, family).toBeGreaterThan(0);
      expect(['read', 'ear', 'harmony']).toContain(pageOfFamily(family));
    }
    expect(levelsOfFamily('notes')[0]).toBe('L1');
    expect(levelsOfFamily('readInterval')).toContain('RI2');
    expect(levelsOfFamily('cadence')).toContain('CA1');
    expect(pageOfFamily('sight')).toBe('read');
    expect(pageOfFamily('rhythmEar')).toBe('ear');
    expect(pageOfFamily('chordSymbol')).toBe('harmony');
  });

  it('takes the tempos the piece page offers', () => {
    expect([40, 100, 200].every(isTaskTempo)).toBe(true);
    expect([30, 85, 210, 100.5, '100', null].some(isTaskTempo)).toBe(false);
  });

  it('counts the steps of one pass, the repeats played and skipped', () => {
    // Four bars, the first two repeated; the right hand two notes a bar, the left one.
    const measures = bars(4);
    measures[1] = bar(1, 4 * Q, { repeat: { forward: false, backwardTimes: 2, ending: [] } });
    const notes = [0, 1, 2, 3].flatMap((m) => [
      note(m, m * 4 * Q, Q, 60),
      note(m, m * 4 * Q + 2 * Q, Q, 62),
      note(m, m * 4 * Q, 4 * Q, 48, 'left'),
    ]);
    const piece = score(measures, notes);
    expect(passSteps(piece, 'right', null)).toEqual({ play: 12, skip: 8 });
    expect(passSteps(piece, 'left', null)).toEqual({ play: 6, skip: 4 });
    expect(passSteps(piece, 'both', { from: 2, to: 3 })).toEqual({ play: 4, skip: 4 });
    // A loop over the repeated bars and the next plays the repeat within it.
    expect(passSteps(piece, 'right', { from: 0, to: 2 })).toEqual({ play: 10, skip: 6 });
    // No such bars: nothing to play.
    expect(passSteps(piece, 'right', { from: 7, to: 8 })).toEqual({ play: 0, skip: 0 });
  });
});

describe('a piece task', () => {
  it('counts every time round a loop over its bars as a run', () => {
    const task = pieceTask();
    // Three laps and three steps of a fourth.
    const progress = piece(task, withRuns([run('r1', { loop: [4, 7], steps: 27 })]));
    expect(progress).toMatchObject({ done: 3, target: 3, met: true, played: 3 });
    // A loop stopped halfway is no run, even when it was ended with Finish.
    expect(piece(task, withRuns([run('r2', { loop: [4, 7], steps: 7 })])).done).toBe(0);
  });

  it('counts a run through the whole piece, or a wider loop, by its steps in the bars', () => {
    const task = pieceTask();
    // The whole piece once: bars 5–8 once, with the wrong notes that fell in them.
    const whole = run('r1', { wrongAt: [0, 1, 2, 9] });
    expect(pieceRuns(task, [whole.session], withRuns([whole]))).toEqual([
      { at: whole.steps.at(-1)!.at, tempo: 80, right: 0.875, inTime: null },
    ]);
    // A loop over bars 3–8, twice round: two runs.
    expect(piece(task, withRuns([run('r2', { loop: [2, 7], steps: 24 })])).done).toBe(2);
    // A loop over bars 5–6 only never covers the task's bars, however often it goes round.
    expect(piece(task, withRuns([run('r3', { loop: [4, 5], steps: 40 })])).done).toBe(0);
    // A run started at bar 7 plays only half of them.
    expect(piece(task, withRuns([run('r4', { from: 6 })])).done).toBe(0);
  });

  it('wants the task’s hands and mode, its tempo or faster, and the window', () => {
    const task = pieceTask();
    const count = (o: RunOptions) => piece(task, withRuns([run('r', { loop: [4, 7], ...o })])).done;
    expect(count({})).toBe(1);
    expect(count({ hands: 'both' })).toBe(0);
    expect(count({ mode: 'rhythm' })).toBe(0);
    expect(count({ mode: 'memory' })).toBe(0);
    expect(count({ tempo: 70 })).toBe(0);
    expect(count({ tempo: 120 })).toBe(1);
    expect(count({ day: -1 })).toBe(0);
    expect(count({ day: 6 })).toBe(1);
    expect(count({ day: 7 })).toBe(0);
    expect(
      piece(pieceTask({ mode: 'memory' }), withRuns([run('m', { loop: [4, 7], mode: 'memory' })]))
        .done,
    ).toBe(1);
  });

  it('judges each run against the goal: notes right', () => {
    const task = pieceTask({ goal: { measure: 'right', percent: 90 } });
    // Lap 1 clean, lap 2 one wrong note in 8 (87.5 %), lap 3 clean.
    const progress = piece(task, withRuns([run('r1', { loop: [4, 7], steps: 24, wrongAt: [9] })]));
    expect(progress).toMatchObject({ done: 2, played: 3, met: false });
    expect(progress.best).toMatchObject({ right: 1, inTime: null });
    expect(progress.last).toMatchObject({ right: 1 });
    // Without a goal every run counts.
    expect(
      piece(pieceTask(), withRuns([run('r1', { loop: [4, 7], steps: 24, wrongAt: [9] })])).done,
    ).toBe(3);
  });

  it('judges each run against the goal: notes in time (rhythm mode)', () => {
    const task = pieceTask({ mode: 'rhythm', goal: { measure: 'inTime', percent: 75 } });
    // Per lap of 8: two notes late and one missed (5 of 8 in time), then all in time.
    const late = [0, 80, -80, null, 10, -10, 20, 0];
    const first = run('r1', { loop: [4, 7], mode: 'rhythm', deviations: late });
    const second = run('r2', { loop: [4, 7], mode: 'rhythm', day: 1, steps: 16 });
    const progress = piece(task, withRuns([first, second]));
    expect(progress).toMatchObject({ done: 2, played: 3, target: 3, met: false });
    expect(progress.best).toMatchObject({ right: 1, inTime: 1 });
    const runs = pieceRuns(task, [first.session], withRuns([first]));
    expect(runs[0]).toMatchObject({ right: 7 / 8, inTime: 5 / 8 });
  });

  it('rounds a run’s share to the whole percent the checklist shows', () => {
    // 7 of 8 right is 87.5 %, shown as 88 %: it meets "at least 88 %".
    const lap = run('r1', { loop: [4, 7], wrongAt: [3] });
    const at = (percent: number) =>
      piece(pieceTask({ goal: { measure: 'right', percent } }), withRuns([lap])).done;
    expect(at(88)).toBe(1);
    expect(at(89)).toBe(0);
  });

  it('counts a session played to its end when its step records are not here', () => {
    const task = pieceTask({ goal: { measure: 'right', percent: 80 } });
    const done = run('r1', { loop: [4, 7], steps: 24, wrongAt: [0, 1] });
    const left = run('r2', { loop: [4, 7], steps: 24, completed: false, day: 1 });
    const input: ProgressInput = { ...EMPTY, sessions: [done.session, left.session] };
    const progress = piece(task, input);
    // One run, however often the loop went round, with the session's own figures.
    expect(progress).toMatchObject({ done: 1, played: 1 });
    expect(progress.best).toEqual({
      at: done.session.endedAt,
      tempo: 80,
      right: 0.9167,
      inTime: null,
    });
    // The same for step records made on other notes: their steps are not the task's.
    const other = run('r3', { loop: [4, 7], steps: 24, checksum: '00000000' });
    expect(piece(pieceTask(), withRuns([other])).done).toBe(1);
  });

  it('counts the whole piece only when it was played from its first bar', () => {
    const task = pieceTask({ bars: null, pass: { play: 16, skip: 12 } });
    expect(piece(task, withRuns([run('r1')])).done).toBe(1);
    expect(piece(task, withRuns([run('r2', { from: 2 })])).done).toBe(0);
    expect(piece(task, withRuns([run('r3', { loop: [0, 7], steps: 32 })])).done).toBe(0);
    // With the repeats skipped, a pass is the task's count for that.
    expect(piece(task, withRuns([run('r4', { steps: 12, repeats: 'skip' })])).done).toBe(1);
    // A way the bars are never played (0 steps) falls back to the session.
    const never = pieceTask({ bars: null, pass: { play: 16, skip: 0 } });
    expect(piece(never, withRuns([run('r5', { steps: 5, repeats: 'skip' })])).done).toBe(1);
  });

  it('finds an imported piece under the id it has here, by its notes', () => {
    const task = pieceTask({
      piece: { id: 'teachers-id', title: 'Study', composer: '', checksum: CHECKSUM },
    });
    const pieces = [
      { id: 'mine', checksum: CHECKSUM },
      { id: 'other', checksum: '11111111' },
      { id: 'old', checksum: null },
    ];
    expect(taskPieceIds(task, pieces)).toEqual(['teachers-id', 'mine']);
    expect(taskPiece(task, pieces)).toEqual({ id: 'mine', checksum: CHECKSUM });
    expect(taskPiece(task, [{ id: 'other', checksum: '11111111' }])).toBeNull();
    // The piece under the task's own id, when its notes are not known yet or were changed.
    expect(taskPiece(task, [{ id: 'teachers-id', checksum: null }])?.id).toBe('teachers-id');
    expect(taskPiece(task, [{ id: 'teachers-id', checksum: '22222222' }, ...pieces])?.id).toBe(
      'mine',
    );
    const mine = run('r1', { loop: [4, 7], steps: 16, pieceId: 'mine' });
    const others = run('r2', { loop: [4, 7], steps: 16, pieceId: 'other', checksum: '11111111' });
    expect(piece(task, withRuns([mine, others], { pieces })).done).toBe(2);
  });

  it('counts only runs in the written key (H4)', () => {
    const task = pieceTask();
    const moved = run('r1', { loop: [4, 7], steps: 16, transpose: 2 });
    const written = run('r2', { loop: [4, 7], day: 1 });
    expect(piece(task, withRuns([moved])).done).toBe(0);
    expect(piece(task, withRuns([moved, written])).done).toBe(1);
    // Without step records too.
    expect(piece(task, { ...EMPTY, sessions: [moved.session] }).done).toBe(0);
  });

  it('counts a run with a left hand made from the chord symbols (H3)', () => {
    // Such a run's step records have the checksum of the notes with that left hand.
    const made = (id: string, o: RunOptions) =>
      run(id, { loop: [4, 7], steps: 24, leftHand: 'block', checksum: 'feedf00d', ...o });
    // The right hand is the melody as written: its passes are counted, whatever the pattern.
    const melody = pieceTask();
    expect(piece(melody, withRuns([made('r1', {})])).done).toBe(3);
    expect(piece(melody, withRuns([made('r2', { leftHand: 'alberti', steps: 20 })])).done).toBe(2);
    // With the left hand or both, a pass takes other steps in each pattern: a session played to
    // its end is one run.
    const both = pieceTask({ hands: 'both' });
    expect(piece(both, withRuns([made('r3', { hands: 'both' })])).done).toBe(1);
    expect(piece(both, withRuns([made('r4', { hands: 'both', completed: false })])).done).toBe(0);
    const left = pieceTask({ hands: 'left', pass: { play: 0, skip: 0 } });
    expect(piece(left, withRuns([made('r5', { hands: 'left' })])).done).toBe(1);
    // Both hands with the left hand as written (a lead sheet's is empty) are the task's notes.
    expect(
      piece(both, withRuns([run('r6', { loop: [4, 7], steps: 16, hands: 'both' })])).done,
    ).toBe(2);
    // A piece here under the task's id whose written notes are others: the session only.
    const pieces = [{ id: 'p', checksum: '99999999' }];
    expect(piece(melody, withRuns([made('r7', {})], { pieces })).done).toBe(1);
  });

  it('names the best and the latest run', () => {
    const task = pieceTask();
    const a = run('r1', { loop: [4, 7], wrongAt: [0, 1] });
    const b = run('r2', { loop: [4, 7], day: 1 });
    const c = run('r3', { loop: [4, 7], day: 2, wrongAt: [0] });
    const progress = piece(task, withRuns([c, a, b]));
    expect(progress.best?.at).toBe(b.steps.at(-1)!.at);
    expect(progress.last).toMatchObject({ at: c.steps.at(-1)!.at, right: 7 / 8 });
    expect(piece(task, EMPTY)).toMatchObject({
      done: 0,
      played: 0,
      best: null,
      last: null,
      met: false,
    });
  });
});

function scaleSession(
  id: string,
  runs: {
    exercise?: string;
    day?: number;
    click?: { bpm: number; perBeat: 2 | 3 | 4 };
    spread?: number;
  }[],
): ScaleSession {
  let session: ScaleSession | null = null;
  runs.forEach((r, n) => {
    const startedAt = MON + (r.day ?? 0) * DAY + n * 20_000;
    const headline = sampleHeadline();
    headline.hands[0]!.spread = r.spread ?? 8;
    session = withRun(session, id, {
      id: `${id}:${n}`,
      exercise: r.exercise ?? 'major:D:2:both',
      startedAt,
      endedAt: startedAt + 10_000,
      headline,
      ...(r.click && { click: r.click }),
    });
  });
  return session!;
}

describe('a scale task', () => {
  const task: ScaleTask = {
    kind: 'scale',
    id: 't2',
    exercise: 'major:D:2:both',
    click: null,
    runs: 3,
  };

  it('counts the runs of the exercise in the window, free or with the click', () => {
    const session = scaleSession('k1', [
      { spread: 12 },
      { spread: 6 },
      { exercise: 'major:C:1:right' },
      { click: { bpm: 60, perBeat: 4 }, spread: 9 },
      { day: 9 },
    ]);
    const progress = taskProgress(task, WEEK, { ...EMPTY, sessions: [session] });
    expect(progress).toMatchObject({ kind: 'scale', done: 3, target: 3, met: true });
    expect(progress).toMatchObject({
      best: { spread: 6, bpm: null },
      last: { spread: 9, bpm: 60 },
    });
  });

  it('with the click, wants the same notes to the beat at the tempo or faster', () => {
    const clicked: ScaleTask = { ...task, click: { bpm: 72, perBeat: 4 } };
    const session = scaleSession('k1', [
      {},
      { click: { bpm: 60, perBeat: 4 } },
      { click: { bpm: 72, perBeat: 4 } },
      { click: { bpm: 96, perBeat: 4 } },
      { click: { bpm: 96, perBeat: 2 } },
    ]);
    expect(taskProgress(clicked, WEEK, { ...EMPTY, sessions: [session] })).toMatchObject({
      done: 2,
      met: false,
      last: { bpm: 96 },
    });
  });

  it('leaves out a run that was no scale run', () => {
    const session = scaleSession('k1', [{}]);
    session.runs[0]!.headline.quality = 'not-a-scale-run';
    expect(taskProgress(task, WEEK, { ...EMPTY, sessions: [session] }).done).toBe(0);
  });
});

/** A Read session of `cards` cards at L1, `planned` planned, on day `day` of the week. */
function readSession(
  id: string,
  day: number,
  cards: number,
  planned = cards,
): {
  session: ReadSessionRecord;
  attempts: ReturnType<typeof sampleAttempt>[];
} {
  const attempts = Array.from({ length: cards }, (_, i) =>
    sampleAttempt(i, id, {
      id: `${id}:${i}`,
      at: MON + day * DAY + i * 3000,
      correct: true,
      hinted: false,
      ms: 900,
    }),
  );
  return { attempts, session: { kind: 'read', ...recoverSummary(attempts)!, length: planned } };
}

describe('a level task', () => {
  const task: LevelTask = { kind: 'level', id: 't3', family: 'notes', level: 'L1', goal: 2 };

  it('counts the sessions of the level played to their end, in the window', () => {
    const a = readSession('s1', 0, 10);
    const b = readSession('s2', 1, 6, 10);
    const c = readSession('s3', 8, 10);
    const other = { ...readSession('s4', 2, 10).session, level: 'L2' as const };
    const sessions = [a.session, b.session, c.session, other];
    const progress = taskProgress(task, WEEK, { ...EMPTY, sessions });
    expect(progress).toMatchObject({
      kind: 'level',
      done: 1,
      target: 2,
      met: false,
      mastery: null,
    });
    expect(progress).toMatchObject({ best: { accuracy: 1 }, last: { at: a.session.startedAt } });
  });

  it('judges mastery on everything answered up to the due day', () => {
    const mastery: LevelTask = { ...task, goal: 'mastery' };
    // 40 cards before the start, all right and quick: mastered on the first day already.
    const before = readSession('s0', -3, MASTERY_WINDOW);
    const input = { ...EMPTY, sessions: [before.session], attempts: before.attempts };
    expect(taskProgress(mastery, WEEK, input)).toMatchObject({
      done: 1,
      target: 1,
      met: true,
      mastery: { counted: MASTERY_WINDOW, window: MASTERY_WINDOW, accuracy: 1 },
    });
    // What was answered after the due day does not count.
    const after = readSession('s9', 9, MASTERY_WINDOW);
    expect(
      taskProgress(mastery, WEEK, {
        ...EMPTY,
        sessions: [after.session],
        attempts: after.attempts,
      }),
    ).toMatchObject({ done: 0, met: false, mastery: { counted: 0, accuracy: null } });
  });

  it('knows the sessions of every family', () => {
    // Fixtures happen on 20 September: a window around them.
    const window = { start: '2026-09-20', due: '2026-09-20' };
    const theory = sampleTheorySession('t1', 4);
    const rhythm = sampleRhythmSession('r1', 2);
    const sight = sampleSightSession('g1', 8);
    const ear = sampleEarSession('e1', 5);
    const dictation = sampleRhythmEarSession('d1', 3);
    const harmony = sampleHarmonySession('h1', 4);
    const sessions: SessionRecord[] = [
      theory.session,
      rhythm.session,
      sight,
      ear.session,
      dictation.session,
      harmony.session,
    ];
    const answers = [
      ...theory.answers,
      ...rhythm.answers,
      ...ear.answers,
      ...dictation.answers,
      ...harmony.answers,
    ].sort((a, b) => a.at - b.at);
    const input = { ...EMPTY, sessions, answers };
    const of = (family: LevelTask['family'], level: string, goal: LevelTask['goal'] = 1) =>
      taskProgress({ kind: 'level', id: 'x', family, level, goal }, window, input);
    expect(of('readInterval', theory.session.level)).toMatchObject({ done: 1, met: true });
    expect(of('rhythm', rhythm.session.level)).toMatchObject({ done: 1 });
    expect(of('sight', 'F5')).toMatchObject({ done: 1 });
    expect(of('interval', 'I1')).toMatchObject({
      done: 1,
      best: { accuracy: ear.session.accuracy },
    });
    expect(of('rhythmEar', dictation.session.level)).toMatchObject({ done: 1 });
    expect(of('chordSymbol', harmony.session.level)).toMatchObject({ done: 1 });
    // Another level of the family, or another family with the same level, has none.
    expect(of('interval', 'I2').done).toBe(0);
    expect(of('chord', 'C1').done).toBe(0);
    // Mastery by each page's own rules: a few answers are a start, not mastery.
    for (const [family, level] of [
      ['readInterval', theory.session.level],
      ['rhythm', rhythm.session.level],
      ['sight', 'F5'],
      ['interval', 'I1'],
      ['rhythmEar', dictation.session.level],
      ['chordSymbol', harmony.session.level],
    ] as const) {
      const progress = of(family, level, 'mastery');
      expect(progress, family).toMatchObject({ kind: 'level', target: 1, met: false });
      expect(progress.kind === 'level' && progress.mastery!.counted, family).toBeGreaterThan(0);
    }
  });

  it('takes a tune as a level of Ear: sessions played to the whole tune, or the tune learnt (H5)', () => {
    expect(LEVEL_FAMILIES.slice(LEVEL_FAMILIES.indexOf('echo'))).toEqual([
      'echo',
      'cadence',
      'tune',
      'rhythmEar',
      'chordSymbol',
    ]);
    expect(pageOfFamily('tune')).toBe('ear');
    expect(levelsOfFamily('tune')).toEqual([...TUNE_IDS]);
    // Fixtures happen on 20 September. Amazing Grace in A major: its second phrase heard again,
    // its third missed; then a session stopped after three phrases; then all of it right, in G.
    const window = { start: '2026-09-20', due: '2026-09-20' };
    const first = sampleTuneSession('u1');
    const part = sampleTuneSession('u2').answers.slice(0, 3);
    const stopped: SessionRecord = { kind: 'ear', ...recoverEarSummary(part)! };
    const right = sampleTuneSession('u3', 0).answers.map((a) => ({
      ...a,
      answer: [...a.prompt],
      correct: true,
      replays: 0,
      at: a.at + 3_600_000,
    }));
    const learnt: SessionRecord = { kind: 'ear', ...recoverEarSummary(right)! };
    const of = (
      goal: LevelTask['goal'],
      input: Partial<ProgressInput>,
      level = first.session.level,
    ) =>
      taskProgress({ kind: 'level', id: 'x', family: 'tune', level, goal }, window, {
        ...EMPTY,
        ...input,
      });

    // A session counts once the whole tune was asked, whatever was missed and in any key.
    const sessions = [first.session, stopped, learnt];
    expect(of(2, { sessions })).toMatchObject({
      kind: 'level',
      done: 2,
      target: 2,
      met: true,
      best: { accuracy: 1 },
      last: { at: learnt.startedAt, accuracy: 1 },
      mastery: null,
    });
    expect(of(1, { sessions: [stopped] })).toMatchObject({ done: 0, met: false });
    expect(of(1, { sessions }, 'trad-swing-low')).toMatchObject({ done: 0, met: false });

    // Learnt: every phrase and the whole tune last played right without Hear again.
    expect(of('mastery', { answers: first.answers })).toMatchObject({
      done: 0,
      target: 1,
      met: false,
      mastery: { counted: 4, window: 5, accuracy: 0.75 },
    });
    expect(of('mastery', { answers: [...first.answers, ...right] })).toMatchObject({
      done: 1,
      met: true,
      mastery: { counted: 5, window: 5, accuracy: 1 },
    });
  });

  it('masters an Ear level on its last 40 answers without a replay', () => {
    const answers = Array.from({ length: 40 }, (_, i) =>
      sampleAnswer(i, 'e9', { correct: true, replays: 0, at: MON + i * 4000 }),
    );
    const mastery: LevelTask = {
      kind: 'level',
      id: 'x',
      family: 'interval',
      level: 'I1',
      goal: 'mastery',
    };
    expect(taskProgress(mastery, WEEK, { ...EMPTY, answers })).toMatchObject({
      met: true,
      mastery: { counted: 40, window: 40, accuracy: 1 },
    });
  });
});

describe('lessons, minutes and tasks this version does not know', () => {
  it('ticks a lesson by its tick on this device', () => {
    const task = { kind: 'lesson', id: 't4', slug: 'staff' } as const;
    expect(taskProgress(task, WEEK, EMPTY)).toEqual({
      kind: 'lesson',
      done: 0,
      target: 1,
      met: false,
    });
    expect(taskProgress(task, WEEK, { ...EMPTY, lessonsDone: new Set(['staff']) })).toEqual({
      kind: 'lesson',
      done: 1,
      target: 1,
      met: true,
    });
  });

  it('counts the days with enough minutes, of any practice', () => {
    const free = (id: string, day: number, minutes: number): SessionRecord => ({
      kind: 'free',
      id,
      startedAt: MON + day * DAY,
      endedAt: MON + day * DAY + minutes * 60_000,
      activeMs: minutes * 60_000,
      notes: 10,
    });
    const sessions = [
      free('a', 0, 12),
      free('b', 0, 9),
      free('c', 1, 19),
      free('d', 3, 45),
      free('e', 8, 60),
    ];
    const task = { kind: 'minutes', id: 't5', minutes: 20, days: 2 } as const;
    expect(taskProgress(task, WEEK, { ...EMPTY, sessions })).toEqual({
      kind: 'minutes',
      done: 2,
      target: 2,
      met: true,
    });
    expect(minutesPerDay(sessions, WEEK, TZ)).toEqual([
      { day: '2026-09-21', minutes: 21 },
      { day: '2026-09-22', minutes: 19 },
      { day: '2026-09-24', minutes: 45 },
    ]);
  });

  it('never meets a task it does not know, and leaves it out of the count', () => {
    const unknown = { kind: 'unknown', id: 't9', raw: { kind: 'duet', id: 't9' } } as const;
    const tasks = [unknown, { kind: 'lesson', id: 't4', slug: 'staff' } as const];
    const progress = assignmentProgress(
      { ...WEEK, tasks },
      { ...EMPTY, lessonsDone: new Set(['staff']) },
    );
    expect(progress[0]).toEqual({ kind: 'unknown', done: 0, target: 0, met: false });
    expect(tasksMet(progress)).toEqual({ met: 1, of: 1 });
  });
});

describe('the window', () => {
  it('is the local calendar’s: from the first minute of the start to the last of the due day', () => {
    const task = pieceTask({ runs: 1 });
    const zone = 'Asia/Shanghai'; // UTC+8
    const at = (iso: string) => {
      const r = run('r', { loop: [4, 7] });
      const shift = Date.parse(iso) - r.session.startedAt;
      const session = { ...r.session, startedAt: r.session.startedAt + shift };
      return taskProgress(task, WEEK, { ...EMPTY, sessions: [session], timeZone: zone }).done;
    };
    // 21 September 00:10 in Shanghai is still the 20th in UTC.
    expect(at('2026-09-20T16:10:00Z')).toBe(1);
    expect(at('2026-09-20T15:50:00Z')).toBe(0);
    // 27 September 23:50 in Shanghai; ten minutes later it is the 28th.
    expect(at('2026-09-27T15:50:00Z')).toBe(1);
    expect(at('2026-09-27T16:10:00Z')).toBe(0);
  });

  it('lists its days', () => {
    expect(windowDays({ start: '2026-09-29', due: '2026-10-02' })).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
    expect(windowDays({ start: '2026-01-01', due: '2026-12-31' }, 3)).toHaveLength(3);
  });
});

describe('the report', () => {
  const free = (id: string, day: number, minutes: number): SessionRecord => ({
    kind: 'free',
    id,
    startedAt: MON + day * DAY,
    endedAt: MON + day * DAY + minutes * 60_000,
    activeMs: minutes * 60_000,
    notes: 10,
  });
  const assignment: Assignment = {
    id: 'assignment-1',
    title: 'Week 1',
    note: 'Slowly first.',
    teacher: 'Ms Clara',
    ...WEEK,
    tasks: [
      pieceTask({ goal: { measure: 'right', percent: 90 } }),
      { kind: 'scale', id: 't2', exercise: 'major:D:2:both', click: null, runs: 2 },
      { kind: 'level', id: 't3', family: 'notes', level: 'L1', goal: 'mastery' },
      { kind: 'lesson', id: 't4', slug: 'staff' },
      { kind: 'minutes', id: 't5', minutes: 20, days: 2 },
      { kind: 'unknown', id: 't6', raw: { kind: 'duet', id: 't6' } },
    ],
    createdAt: MON - DAY,
    updatedAt: MON - DAY + 5,
  };
  const laps = run('secret-session-id', { loop: [4, 7], steps: 16, wrongAt: [9] });
  const read = readSession('s1', 1, 12);
  const input = withRuns([laps], {
    sessions: [
      laps.session,
      scaleSession('k1', [{ spread: 7.25 }]),
      read.session,
      free('a', 0, 25),
      free('b', 2, 1500),
      free('c', 5, 40),
    ],
    attempts: read.attempts,
    lessonsDone: new Set(['staff']),
  });
  // Made on the Wednesday: three days of the week so far.
  const now = MON + 2 * DAY + 3 * 3_600_000;
  const progress = assignmentProgress(assignment, input);
  const report = buildReport(assignment, progress, {
    id: 'report-0001',
    from: 'Robin',
    note: 'Bar 7 is still hard.',
    now,
    sessions: input.sessions,
    timeZone: TZ,
  });

  it('carries each task with its goal and its figures, in the assignment’s order', () => {
    expect(report).toMatchObject({
      id: 'report-0001',
      assignmentId: 'assignment-1',
      assignmentVersion: assignment.updatedAt,
      title: 'Week 1',
      start: WEEK.start,
      due: WEEK.due,
      from: 'Robin',
      note: 'Bar 7 is still hard.',
      createdAt: now,
    });
    expect(report.tasks.map((entry) => entry.task)).toEqual(assignment.tasks);
    expect(report.tasks.map((entry) => entry.progress)).toEqual(progress);
    expect(report.tasks[0]!.progress).toMatchObject({
      kind: 'piece',
      done: 1,
      target: 3,
      met: false,
      played: 2,
      best: { right: 1 },
      last: { right: 0.875 },
    });
    expect(report.tasks[1]!.progress).toMatchObject({ done: 1, target: 2, best: { spread: 7.3 } });
    expect(report.tasks[2]!.progress).toMatchObject({
      met: false,
      mastery: { counted: 12, window: 40, accuracy: 1 },
    });
    expect(report.tasks[3]!.progress).toMatchObject({ kind: 'lesson', met: true });
    expect(report.tasks[4]!.progress).toMatchObject({ kind: 'minutes', done: 3, met: true });
    expect(report.tasks[5]!.progress).toEqual({ kind: 'unknown', done: 0, target: 0, met: false });
  });

  it('has the minutes of each day from the start to the day it is made', () => {
    // A day never has more minutes than it is long, whatever the sessions begun on it add up to.
    expect(report.days).toEqual([25, 0, 1440]);
    expect(reportDayList(report)).toEqual([
      { day: '2026-09-21', minutes: 25 },
      { day: '2026-09-22', minutes: 0 },
      { day: '2026-09-23', minutes: 1440 },
    ]);
    // Before the start there are none; after the due day, the whole window and no more.
    expect(reportDays(input.sessions, WEEK, '2026-09-20', TZ)).toEqual([]);
    expect(reportDays(input.sessions, WEEK, '2026-09-21', TZ)).toEqual([25]);
    expect(reportDays(input.sessions, WEEK, '2026-10-30', TZ)).toEqual([25, 0, 1440, 0, 0, 40, 0]);
  });

  it('holds figures only: no record, no id of one, nothing outside the assignment', () => {
    const text = JSON.stringify(report);
    for (const secret of ['secret-session-id', 's1', 'k1', '"steps"', '"sessions"', '"attempts"']) {
      expect(text, secret).not.toContain(secret);
    }
    expect(Object.keys(report).sort()).toEqual([
      'assignmentId',
      'assignmentVersion',
      'createdAt',
      'days',
      'due',
      'from',
      'id',
      'note',
      'start',
      'tasks',
      'title',
    ]);
  });

  it('is a report by the rules a link is read with, and travels in one', () => {
    expect(parseReport(JSON.parse(JSON.stringify(report)))).toEqual(report);
    const data = encodeShare({ kind: 'report', report })!;
    expect(decodeShare(data)).toEqual({ ok: true, value: { kind: 'report', report } });
  });
});
