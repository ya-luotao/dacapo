import { describe, expect, it } from 'vitest';
import {
  cardAdvice,
  EVEN_STEP_BPM,
  familyAfter,
  levelOfItems,
  MISSED_STEP,
  practiceItems,
  practiceLength,
  PRACTISE_CARDS,
  PRACTISE_MIN_ITEMS,
  reviewLine,
  rhythmAdvice,
  scaleAdvice,
  sessionMastery,
  toPractise,
  TOO_FAR_MIN_ANSWERS,
  SLOWER_SHARE,
  TOO_FAR_SHARE,
  waitAdvice,
  type CardSession,
  type FamilyStanding,
  type RhythmRun,
  type ScaleFinding,
  type ScaleRun,
  type WaitRun,
  type WaitStep,
} from './advice.ts';
import type { LevelFamily } from './assignmentRecords.ts';
import type { PieceSessionRecord } from './log.ts';
import { levelProgress, MASTERY_ACCURACY, MASTERY_MEDIAN_MS, MASTERY_WINDOW } from './mastery.ts';
import { HARMONY_MASTERY_MEDIAN_MS } from './harmonySession.ts';
import { SESSION_LENGTHS, type Attempt } from './session.ts';
import {
  SIGHT_MASTERY_FRAGMENTS,
  SIGHT_MASTERY_SHARE,
  sightLevelProgress,
  summarizeSightSession,
  type SightSessionSummary,
} from './sightRead.ts';
import { theoryMasteryMedianMs } from './theorySession.ts';
import { MEMORY_STAGES } from './memory.ts';
import { pieceSession, stepId, type PieceFacts, type PieceStep } from './pieceRecords.ts';
import {
  CLEAN_NOTES,
  IN_TIME_SHARE,
  POOR_NOTES,
  REVIEW_INTERVALS,
  reviewSchedule,
  SLOW_BAR,
} from './review.ts';
import { TENDENCY_MS, type RhythmStretch } from './rhythmRun.ts';
import { CLICK_MAX_BPM, CLICK_MIN_BPM } from './scaleClick.ts';
import { LADDER_STEP, SCORE_TEMPO, TEMPOS } from './tempoLadder.ts';

/** Steps a bar in the runs below. */
const PER_BAR = 4;

/** A run of `bars` bars, four even steps each; `change` alters the steps it names. */
function steps(bars: number, change: Record<number, Partial<WaitStep>> = {}): WaitStep[] {
  return Array.from({ length: bars * PER_BAR }, (_, n) => ({
    measure: Math.floor(n / PER_BAR),
    ms: 500,
    wrong: 0,
    ...change[n],
  }));
}

/** A clean, even run to the end with both hands, unless said otherwise. */
function wait(over: Partial<WaitRun> = {}): WaitRun {
  const run = over.steps ?? steps(5);
  return {
    stage: null,
    hands: 'both',
    twoHands: true,
    steps: run,
    notes: run.length,
    whole: true,
    next: 60,
    ...over,
  };
}

describe('after a run in wait mode', () => {
  // 20 steps: two wrong notes are 1 in POOR_NOTES, three are more.
  const bars = (2 * POOR_NOTES) / PER_BAR;
  const many = (at: Record<number, Partial<WaitStep>>) => steps(bars, at);

  it('says nothing of a run without steps', () => {
    expect(waitAdvice(wait({ steps: [] }))).toBeNull();
  });

  it('many wrong notes with both hands: one hand at a time, the right first', () => {
    const run = wait({ steps: many({ 0: { wrong: 2 }, 9: { wrong: 1 } }) });
    expect(waitAdvice(run)).toEqual({
      rule: 'oneHand',
      wrong: 3,
      steps: 2 * POOR_NOTES,
      action: { kind: 'hands', hands: 'right' },
    });
  });

  it('many is more than 1 wrong note in POOR_NOTES steps', () => {
    const at = many({ 0: { wrong: 2 } });
    expect(at.length).toBe(2 * POOR_NOTES);
    expect(waitAdvice(wait({ steps: at, whole: false }))).toBeNull();
    expect(waitAdvice(wait({ steps: many({ 0: { wrong: 3 } }), whole: false }))?.rule).toBe(
      'oneHand',
    );
  });

  it('starts with the hand with more wrong notes, where the steps tell', () => {
    const left = many({
      0: { wrong: 1, hand: 'right' },
      1: { wrong: 2, hand: 'left' },
      // A step both hands play tells nothing.
      2: { wrong: 5, hand: null },
    });
    expect(waitAdvice(wait({ steps: left }))?.action).toEqual({ kind: 'hands', hands: 'left' });
    const level = many({ 0: { wrong: 2, hand: 'right' }, 1: { wrong: 2, hand: 'left' } });
    expect(waitAdvice(wait({ steps: level }))?.action).toEqual({ kind: 'hands', hands: 'right' });
  });

  it('many wrong notes with one hand: the bar with most of them and the bar either side', () => {
    const run = wait({
      hands: 'right',
      steps: many({ 4: { wrong: 1 }, 9: { wrong: 2 }, 10: { wrong: 1 } }),
    });
    expect(waitAdvice(run)).toEqual({
      rule: 'fewBars',
      wrong: 4,
      steps: 2 * POOR_NOTES,
      action: { kind: 'loop', from: 1, to: 3 },
    });
  });

  it('takes the earliest of the bars with most wrong notes, and stays inside the run', () => {
    const first = wait({ hands: 'left', steps: many({ 0: { wrong: 2 }, 17: { wrong: 2 } }) });
    expect(waitAdvice(first)?.action).toEqual({ kind: 'loop', from: 0, to: 1 });
    const last = wait({ hands: 'left', steps: many({ 0: { wrong: 1 }, 17: { wrong: 2 } }) });
    expect(waitAdvice(last)?.action).toEqual({ kind: 'loop', from: 3, to: 4 });
    // A loop of bars 7–9 (written 6–8): the bars it played, not its neighbours in the score.
    const looped = wait({
      hands: 'right',
      whole: false,
      steps: steps(4, { 5: { wrong: 3 } }).map((s) => ({ ...s, measure: s.measure + 6 })),
    });
    expect(waitAdvice(looped)?.action).toEqual({ kind: 'loop', from: 6, to: 8 });
  });

  it('a piece with one hand to play is taken a few bars at a time, also with Both', () => {
    const run = wait({ twoHands: false, steps: many({ 9: { wrong: 3 } }) });
    expect(waitAdvice(run)?.rule).toBe('fewBars');
  });

  it('does not cut down a run that is those few bars already', () => {
    const run = wait({ hands: 'right', whole: false, steps: steps(3, { 5: { wrong: 3 } }) });
    expect(waitAdvice(run)).toBeNull();
    // Its slow bar is still worth looping.
    const slow = steps(3, { 5: { wrong: 3 } }).map((s) =>
      s.measure === 1 ? { ...s, ms: 5000 } : s,
    );
    expect(waitAdvice(wait({ hands: 'right', whole: false, steps: slow }))).toEqual({
      rule: 'slowBar',
      measure: 1,
      action: { kind: 'loop', from: 1, to: 1 },
    });
  });

  it('a bar that held the run up is looped: its mean step over SLOW_BAR times the median', () => {
    const slowed = (ms: number) => steps(5).map((s) => (s.measure === 2 ? { ...s, ms } : s));
    expect(waitAdvice(wait({ steps: slowed(SLOW_BAR * 500 + 1) }))).toEqual({
      rule: 'slowBar',
      measure: 2,
      action: { kind: 'loop', from: 2, to: 2 },
    });
    // At twice the median exactly it is not over it: the run is clean and even.
    expect(waitAdvice(wait({ steps: slowed(SLOW_BAR * 500) }))?.rule).toBe('toRhythm');
  });

  it('names the slowest of the bars that held it up, as the summary lists them', () => {
    const run = steps(6).map((s) =>
      s.measure === 1 ? { ...s, ms: 1500 } : s.measure === 4 ? { ...s, ms: 2500 } : s,
    );
    expect(waitAdvice(wait({ steps: run }))).toMatchObject({ rule: 'slowBar', measure: 4 });
  });

  it('wrong notes come before a slow bar', () => {
    const run = many({ 0: { wrong: 3 } }).map((s) => (s.measure === 2 ? { ...s, ms: 5000 } : s));
    expect(waitAdvice(wait({ steps: run }))?.rule).toBe('oneHand');
    expect(waitAdvice(wait({ steps: run, hands: 'right' }))?.rule).toBe('fewBars');
  });

  it('a run of one bar has no bar slower than the rest', () => {
    const run = steps(1, { 0: { ms: 9000 } });
    expect(waitAdvice(wait({ steps: run, whole: false }))).toBeNull();
  });

  it('clean and even, to the end: rhythm mode at the ladder’s next rung', () => {
    expect(waitAdvice(wait({ next: 70 }))).toEqual({
      rule: 'toRhythm',
      tempo: 70,
      action: { kind: 'rhythm', tempo: 70 },
    });
    // With one hand as well: the ladder is that hand's.
    expect(waitAdvice(wait({ hands: 'left', next: 60 }))?.rule).toBe('toRhythm');
  });

  it('clean is at most one wrong note in CLEAN_NOTES of the notes it is counted against', () => {
    const run = steps(5, { 3: { wrong: 2 } });
    expect(waitAdvice(wait({ steps: run, notes: 2 * CLEAN_NOTES }))?.rule).toBe('toRhythm');
    expect(waitAdvice(wait({ steps: run, notes: 2 * CLEAN_NOTES - 1 }))).toBeNull();
  });

  it('says nothing of a clean run that is not one to the end, or with the ladder climbed', () => {
    expect(waitAdvice(wait({ whole: false }))).toBeNull();
    expect(waitAdvice(wait({ next: null }))).toBeNull();
  });
});

describe('after a run in memory mode', () => {
  const stage = MEMORY_STAGES[1];

  it('loops the bar that needed most prompts, before any slow bar', () => {
    const run = steps(5, { 5: { prompts: 1 }, 13: { prompts: 2 }, 14: { prompts: 1 } }).map((s) =>
      s.measure === 0 ? { ...s, ms: 5000 } : s,
    );
    expect(waitAdvice(wait({ stage, steps: run }))).toEqual({
      rule: 'promptedBar',
      measure: 3,
      prompts: 3,
      action: { kind: 'loop', from: 3, to: 3 },
    });
  });

  it('loops a slow bar when none needed a prompt', () => {
    const run = steps(5).map((s) => (s.measure === 0 ? { ...s, ms: 5000 } : s));
    expect(waitAdvice(wait({ stage, steps: run }))?.rule).toBe('slowBar');
  });

  it('wrong notes come first, as in wait mode', () => {
    const run = steps(5, { 0: { wrong: 3, prompts: 3 } });
    expect(waitAdvice(wait({ stage, steps: run }))?.rule).toBe('oneHand');
  });

  it('clean and even: the next stage, while there is one', () => {
    for (const [i, at] of MEMORY_STAGES.slice(0, -1).entries()) {
      const next = MEMORY_STAGES[i + 1]!;
      expect(waitAdvice(wait({ stage: at }))).toEqual({
        rule: 'toStage',
        stage: next,
        action: { kind: 'stage', stage: next },
      });
    }
  });

  it('clean and even at the last stage: rhythm mode, as after a wait run', () => {
    expect(waitAdvice(wait({ stage: MEMORY_STAGES.at(-1)!, next: 80 }))).toEqual({
      rule: 'toRhythm',
      tempo: 80,
      action: { kind: 'rhythm', tempo: 80 },
    });
  });
});

/** 20 notes due: two missed or extra are 1 in POOR_NOTES, sixteen in time are IN_TIME_SHARE. */
const DUE = 2 * POOR_NOTES;

/** A run to the end at 80 %, every note played and in time, on the beat. */
function rhythm(
  summary: Partial<RhythmRun['summary']> = {},
  over: Partial<Omit<RhythmRun, 'summary'>> = {},
): RhythmRun {
  return {
    tempo: 80,
    calibrated: true,
    whole: true,
    next: 90,
    ...over,
    summary: {
      notes: DUE,
      inTime: DUE,
      missed: 0,
      extra: 0,
      tendency: 0,
      drift: [],
      wholeRun: false,
      ...summary,
    },
  };
}

function stretch(
  from: number,
  to: number,
  direction: RhythmStretch['direction'] = 'faster',
  rounds: [number, number] = [0, 0],
): RhythmStretch {
  return {
    direction,
    from: { measure: from, round: rounds[0] },
    to: { measure: to, round: rounds[1] },
    fromTime: 0,
    toTime: 1000,
    change: -40,
  };
}

describe('after a run in rhythm mode', () => {
  it('says nothing of a run without notes', () => {
    expect(rhythmAdvice(rhythm({ notes: 0, inTime: 0 }))).toBeNull();
  });

  it('notes went missing: twenty less', () => {
    expect(rhythmAdvice(rhythm({ missed: 2, extra: 1, inTime: DUE - 2 }))).toEqual({
      rule: 'missed',
      missed: 2,
      extra: 1,
      notes: DUE,
      tempo: 80,
      action: { kind: 'tempo', tempo: 80 - MISSED_STEP },
    });
    expect(MISSED_STEP).toBe(20);
  });

  it('missing is more than 1 missed or extra note in POOR_NOTES', () => {
    expect(rhythmAdvice(rhythm({ missed: 1, extra: 1, inTime: DUE - 1 }))?.rule).not.toBe('missed');
    expect(rhythmAdvice(rhythm({ missed: 3, inTime: DUE - 3 }))?.rule).toBe('missed');
    expect(rhythmAdvice(rhythm({ extra: 3 }))?.rule).toBe('missed');
  });

  it('does not go under the slowest tempo', () => {
    const missing = { missed: 5, inTime: DUE - 5 };
    expect(rhythmAdvice(rhythm(missing, { tempo: 50 }))?.action).toEqual({
      kind: 'tempo',
      tempo: TEMPOS[0],
    });
    // At the slowest there is nothing slower to take: the rules that follow have their say.
    expect(rhythmAdvice(rhythm(missing, { tempo: TEMPOS[0] }))).toBeNull();
    expect(
      rhythmAdvice(rhythm({ ...missing, drift: [stretch(4, 7)] }, { tempo: TEMPOS[0] }))?.rule,
    ).toBe('drift');
  });

  it('not in time: ten less', () => {
    const inTime = IN_TIME_SHARE * DUE - 1;
    expect(rhythmAdvice(rhythm({ inTime }))).toEqual({
      rule: 'notInTime',
      inTime,
      notes: DUE,
      tempo: 80,
      action: { kind: 'tempo', tempo: 80 - LADDER_STEP },
    });
    expect(rhythmAdvice(rhythm({ inTime }, { tempo: TEMPOS[0] }))).toBeNull();
  });

  it('in time is IN_TIME_SHARE of the notes or more', () => {
    expect(rhythmAdvice(rhythm({ inTime: IN_TIME_SHARE * DUE }))?.rule).toBe('nextTempo');
  });

  it('missing notes come before notes not in time', () => {
    expect(rhythmAdvice(rhythm({ missed: 5, inTime: 2 }))?.rule).toBe('missed');
  });

  it('a stretch that moved is looped: the first that can be', () => {
    const drift = [stretch(2, 3, 'slower', [0, 1]), stretch(4, 7), stretch(9, 10)];
    expect(rhythmAdvice(rhythm({ drift }))).toEqual({
      rule: 'drift',
      direction: 'faster',
      action: { kind: 'loop', from: 4, to: 7 },
    });
  });

  it('a tempo that moved through the whole run has no stretch to loop', () => {
    const run = rhythm({ drift: [stretch(0, 15)], wholeRun: true });
    // Nor is it steady: the tendency is not the thing to say. It is clean and in time.
    expect(rhythmAdvice({ ...run, summary: { ...run.summary, tendency: 40 } })?.rule).toBe(
      'nextTempo',
    );
  });

  it('always late, never calibrated: the delay may be the computer’s', () => {
    expect(rhythmAdvice(rhythm({ tendency: 35 }, { calibrated: false }))).toEqual({
      rule: 'tendency',
      ms: 35,
      action: { kind: 'calibrate' },
    });
  });

  it('always late or early otherwise: nothing to press', () => {
    expect(rhythmAdvice(rhythm({ tendency: 35 }))).toEqual({
      rule: 'tendency',
      ms: 35,
      action: null,
    });
    expect(rhythmAdvice(rhythm({ tendency: -22 }))).toEqual({
      rule: 'tendency',
      ms: -22,
      action: null,
    });
    // No delay makes a note early: nothing to calibrate.
    expect(rhythmAdvice(rhythm({ tendency: -22 }, { calibrated: false }))?.action).toBeNull();
  });

  it('a tendency is one of TENDENCY_MS or more, as the summary says "on the beat" under it', () => {
    expect(rhythmAdvice(rhythm({ tendency: TENDENCY_MS }))?.rule).toBe('tendency');
    expect(rhythmAdvice(rhythm({ tendency: -TENDENCY_MS }))?.rule).toBe('tendency');
    expect(rhythmAdvice(rhythm({ tendency: TENDENCY_MS - 0.5 }))?.rule).toBe('nextTempo');
    expect(rhythmAdvice(rhythm({ tendency: null }))?.rule).toBe('nextTempo');
  });

  it('a stretch that moved comes before the tendency', () => {
    expect(rhythmAdvice(rhythm({ tendency: 35, drift: [stretch(4, 7)] }))?.rule).toBe('drift');
  });

  it('clean and in time, to the end: the ladder’s next rung', () => {
    expect(rhythmAdvice(rhythm({}, { tempo: 70, next: 80 }))).toEqual({
      rule: 'nextTempo',
      tempo: 70,
      action: { kind: 'tempo', tempo: 80 },
    });
    // A rung reached before stands: the next is the one above it.
    expect(rhythmAdvice(rhythm({}, { tempo: 60, next: 90 }))?.action).toEqual({
      kind: 'tempo',
      tempo: 90,
    });
  });

  it('clean is at most one missed or extra note in CLEAN_NOTES', () => {
    const notes = 2 * CLEAN_NOTES;
    expect(rhythmAdvice(rhythm({ notes, inTime: notes - 2, missed: 1, extra: 1 }))?.rule).toBe(
      'nextTempo',
    );
    expect(rhythmAdvice(rhythm({ notes, inTime: notes - 3, missed: 2, extra: 1 }))).toBeNull();
  });

  it('at the score’s tempo or beyond there is no further rung', () => {
    expect(rhythmAdvice(rhythm({}, { tempo: SCORE_TEMPO, next: null }))).toEqual({
      rule: 'scoreTempo',
      tempo: SCORE_TEMPO,
      action: null,
    });
    expect(rhythmAdvice(rhythm({}, { tempo: 120, next: null }))?.rule).toBe('scoreTempo');
    // A slower run of a piece already at tempo: nothing to add.
    expect(rhythmAdvice(rhythm({}, { tempo: 70, next: null }))).toBeNull();
  });

  it('says nothing of a clean run that is not one to the end', () => {
    expect(rhythmAdvice(rhythm({}, { whole: false }))).toBeNull();
  });
});

describe('what the run did to the review', () => {
  const TZ = 'UTC';
  const DAY = 86_400_000;
  const T0 = Date.UTC(2026, 8, 1, 18);
  const FACTS: PieceFacts = {
    checksum: 'abcdef01',
    bars: { right: 4, left: 4, both: 4 },
    notes: { play: 100, skip: 80 },
  };

  /** A wait run to the end on day `day`, with `wrong` wrong notes. */
  function run(id: string, day: number, wrong = 0) {
    const start = T0 + day * DAY;
    const steps: PieceStep[] = Array.from({ length: 8 }, (_, n) => ({
      id: stepId(id, n),
      sessionId: id,
      pieceId: 'p',
      checksum: FACTS.checksum,
      hands: 'both',
      measure: Math.floor(n / 2),
      pass: 1,
      ms: 800,
      wrong: n === 0 ? wrong : 0,
      at: start + n * 1000,
    }));
    const session = pieceSession(
      {
        id,
        pieceId: 'p',
        title: 'Piece',
        hands: 'both',
        loop: null,
        repeats: 'play',
        tempo: 100,
        startedAt: start,
      },
      steps,
      true,
    );
    return { session, steps };
  }

  /** The line for the last of `runs`: the schedule without it, and with it. */
  function line(runs: { session: PieceSessionRecord; steps: PieceStep[] }[], out = false) {
    const schedule = (list: typeof runs) =>
      reviewSchedule(
        'p',
        list.map((r) => r.session),
        list.flatMap((r) => r.steps),
        FACTS,
        TZ,
      );
    return reviewLine(schedule(runs.slice(0, -1)), schedule(runs), out);
  }

  it('the first run to the end puts the piece in review', () => {
    expect(line([run('a', 0)])).toEqual({ kind: 'new', days: REVIEW_INTERVALS[0] });
  });

  it('a review that went well moves the interval up', () => {
    expect(line([run('a', 0), run('b', 1)])).toEqual({
      kind: 'better',
      days: REVIEW_INTERVALS[1],
    });
  });

  it('a review neither clean nor poor keeps it', () => {
    // 5 wrong in 100 notes: over 1 in CLEAN_NOTES, not over 1 in POOR_NOTES.
    expect(line([run('a', 0), run('b', 1), run('c', 3, 5)])).toEqual({
      kind: 'same',
      days: REVIEW_INTERVALS[1],
    });
  });

  it('a review with too many wrong notes moves it down', () => {
    expect(line([run('a', 0), run('b', 1), run('c', 3, 11)])).toEqual({
      kind: 'worse',
      days: REVIEW_INTERVALS[0],
    });
  });

  it('says nothing of a piece taken out of review', () => {
    expect(line([run('a', 0)], true)).toBeNull();
    expect(line([run('a', 0), run('b', 1)], true)).toBeNull();
  });

  it('says nothing of a run before the date due: it counts only for the figures', () => {
    expect(line([run('a', 0), run('b', 0)])).toBeNull();
    expect(line([run('a', 0), run('b', 1), run('c', 2)])).toBeNull();
  });

  it('says nothing of a run that is not one to the end', () => {
    expect(reviewLine(null, null, false)).toBeNull();
    const before = reviewSchedule('p', [run('a', 0).session], run('a', 0).steps, FACTS, TZ);
    expect(reviewLine(before, before, false)).toBeNull();
  });
});

/** A run at free tempo, four notes a second (♩ = 60 with four to the beat), measured. */
function scale(findings: ScaleFinding[], over: Partial<ScaleRun> = {}): ScaleRun {
  return {
    measured: true,
    provisional: false,
    findings,
    shown: 3,
    place: true,
    click: null,
    perBeat: 4,
    tempo: 4,
    startTempo: 4,
    calibrated: true,
    ...over,
  };
}

/** The same with the click at ♩ = 60, on it. */
const clicked = (findings: ScaleFinding[], over: Partial<NonNullable<ScaleRun['click']>> = {}) =>
  scale(findings, { click: { bpm: 60, tendency: 0, ...over } });

describe('after a scale run', () => {
  it('says nothing of a trill, repeated notes or chords: their thresholds are provisional', () => {
    expect(scaleAdvice(scale(['trill', 'loudness'], { provisional: true }))).toBeNull();
    expect(scaleAdvice(scale([], { provisional: true, measured: false }))).toBeNull();
  });

  it('too many mistakes to measure: slower, the click a fifth under the run’s tempo', () => {
    expect(scaleAdvice(scale([], { measured: false }))).toEqual({
      rule: 'slower',
      action: { kind: 'click', bpm: 60 * SLOWER_SHARE },
    });
    expect(scaleAdvice({ ...clicked([]), measured: false })?.action).toEqual({
      kind: 'click',
      bpm: 48,
    });
    // Three notes to the beat: the same notes a second are a faster beat.
    expect(scaleAdvice(scale([], { measured: false, perBeat: 3 }))?.action).toEqual({
      kind: 'click',
      bpm: 64,
    });
  });

  it('says it without a button when the tempo is not known, or nothing slower can be set', () => {
    expect(scaleAdvice(scale([], { measured: false, tempo: null }))).toEqual({
      rule: 'slower',
      action: null,
    });
    const slowest = { ...clicked([], { bpm: CLICK_MIN_BPM }), measured: false };
    expect(scaleAdvice(slowest)).toEqual({ rule: 'slower', action: null });
    // Faster than the click goes: its fastest is slower still.
    expect(scaleAdvice(scale([], { measured: false, tempo: 16 }))?.action).toEqual({
      kind: 'click',
      bpm: CLICK_MAX_BPM,
    });
  });

  it.each(['thumbUnder', 'fingerOver', 'pattern', 'hesitation'] as const)(
    'a place named (%s): loop around it',
    (finding) => {
      expect(scaleAdvice(scale([finding, 'connection', 'loudness']))).toEqual({
        rule: finding,
        action: { kind: 'loop' },
      });
      expect(scaleAdvice(scale([finding], { place: false }))).toBeNull();
    },
  );

  it('the tempo moved: the click at the tempo the run started at', () => {
    expect(scaleAdvice(scale(['faster'], { tempo: 5, startTempo: 4.4 }))).toEqual({
      rule: 'startTempo',
      bpm: 66,
      perBeat: 4,
      action: { kind: 'click', bpm: 66 },
    });
    expect(scaleAdvice(scale(['slower'], { perBeat: 2, startTempo: 3 }))).toMatchObject({
      rule: 'startTempo',
      bpm: 90,
      perBeat: 2,
    });
    // With the click, that is the click's tempo.
    expect(scaleAdvice(clicked(['onClick', 'faster']))).toMatchObject({
      rule: 'startTempo',
      bpm: 60,
    });
  });

  it('says nothing of a tempo the click cannot be set to', () => {
    const slow = (CLICK_MIN_BPM - 1) / 60;
    const fast = (CLICK_MAX_BPM + 1) / 60;
    expect(scaleAdvice(scale(['faster'], { perBeat: 1, startTempo: slow }))).toBeNull();
    expect(scaleAdvice(scale(['faster'], { perBeat: 1, startTempo: fast }))).toBeNull();
    expect(
      scaleAdvice(scale(['faster'], { perBeat: 1, startTempo: CLICK_MAX_BPM / 60 }))?.rule,
    ).toBe('startTempo');
    expect(scaleAdvice(scale(['faster'], { startTempo: null }))).toBeNull();
  });

  it('the hands apart: each hand alone, the right first', () => {
    expect(scaleAdvice(scale(['apart', 'connection']))).toEqual({
      rule: 'eachHand',
      action: { kind: 'hands', hands: 'right' },
    });
  });

  it('before or after the click: as rhythm mode’s tendency', () => {
    const late = clicked(['clickLate'], { tendency: 28 });
    expect(scaleAdvice({ ...late, calibrated: false })).toEqual({
      rule: 'tendency',
      ms: 28,
      action: { kind: 'calibrate' },
    });
    expect(scaleAdvice(late)).toEqual({ rule: 'tendency', ms: 28, action: null });
    const early = clicked(['clickEarly'], { tendency: -19 });
    expect(scaleAdvice({ ...early, calibrated: false })).toEqual({
      rule: 'tendency',
      ms: -19,
      action: null,
    });
  });

  it('advises on the first sentence shown that names something to work on', () => {
    // The run stopped, the keys were joined, the hands together: nothing to work on in those.
    expect(scaleAdvice(scale(['stopped', 'hesitation', 'connection']))?.rule).toBe('hesitation');
    expect(scaleAdvice(scale(['connection', 'pedal', 'faster']))?.rule).toBe('startTempo');
    expect(scaleAdvice(scale(['together', 'connection', 'faster']))?.rule).toBe('startTempo');
    expect(scaleAdvice(clicked(['onClick', 'hesitation']))?.rule).toBe('hesitation');
    // The verdict's order is the order of rules.
    expect(scaleAdvice(scale(['thumbUnder', 'hesitation', 'faster']))?.rule).toBe('thumbUnder');
    expect(scaleAdvice(clicked(['clickLate', 'hesitation'], { tendency: 30 }))?.rule).toBe(
      'tendency',
    );
    expect(scaleAdvice(scale(['hesitation', 'apart']))?.rule).toBe('hesitation');
  });

  it('says nothing of a problem the verdict has no room to show', () => {
    const run = scale(['connection', 'pedal', 'loudness', 'faster']);
    expect(scaleAdvice(run)).toBeNull();
    expect(scaleAdvice({ ...run, shown: 4 })?.rule).toBe('startTempo');
  });

  it('even at free tempo: next, with the click at the run’s tempo', () => {
    expect(scaleAdvice(scale(['connection', 'loudness']))).toEqual({
      rule: 'even',
      action: { kind: 'click', bpm: 60 },
    });
    expect(scaleAdvice(scale(['together', 'connection', 'loudness']))?.rule).toBe('even');
    expect(scaleAdvice(scale([]))?.rule).toBe('even');
  });

  it('does not call a run even that stopped, or whose tempo the click cannot take', () => {
    expect(scaleAdvice(scale(['stopped', 'connection']))).toBeNull();
    expect(scaleAdvice(scale(['connection'], { tempo: null }))).toBeNull();
    expect(scaleAdvice(scale(['connection'], { tempo: 16 }))).toBeNull();
  });

  it('even with the click: the next tempo', () => {
    expect(scaleAdvice(clicked(['onClick', 'connection']))).toEqual({
      rule: 'evenClick',
      bpm: 60,
      action: { kind: 'click', bpm: 60 + EVEN_STEP_BPM },
    });
    expect(EVEN_STEP_BPM).toBe(8);
  });

  it('with the click, even is said of notes the verdict says kept to it', () => {
    expect(scaleAdvice(clicked(['onClick']))?.rule).toBe('evenClick');
    expect(scaleAdvice(clicked(['noTendency', 'connection'], { tendency: null }))).toBeNull();
  });

  it('goes no faster than the click does', () => {
    expect(
      scaleAdvice(clicked(['onClick'], { bpm: CLICK_MAX_BPM - EVEN_STEP_BPM }))?.action,
    ).toEqual({ kind: 'click', bpm: CLICK_MAX_BPM });
    expect(
      scaleAdvice(clicked(['onClick'], { bpm: CLICK_MAX_BPM - EVEN_STEP_BPM + 1 })),
    ).toBeNull();
  });
});

/** A session of ten cards at a level in the middle of its family, nothing to say of it. */
function cards(over: Partial<CardSession> = {}): CardSession {
  return {
    masteredBefore: false,
    mastered: false,
    nextLevel: 'L4',
    nextFamily: null,
    answers: 10,
    correct: 9,
    complete: true,
    below: { level: 'L2', mastered: true },
    practise: [],
    ...over,
  };
}

describe('after a session of cards', () => {
  it('says nothing when no rule applies', () => {
    expect(cardAdvice(cards())).toBeNull();
    expect(cardAdvice(cards({ answers: 0, correct: 0 }))).toBeNull();
  });

  it('mastered just now: the next level', () => {
    expect(cardAdvice(cards({ mastered: true }))).toEqual({
      say: { rule: 'mastered', action: { kind: 'level', level: 'L4' } },
      practise: null,
    });
  });

  it('says so once: a level mastered before the session is not mastered just now', () => {
    expect(cardAdvice(cards({ masteredBefore: true, mastered: true }))).toBeNull();
    // Nor is one the session took out of mastery again.
    expect(cardAdvice(cards({ masteredBefore: true, mastered: false }))).toBeNull();
  });

  it('after the family’s last level: the family to go on with, or nothing to press', () => {
    const last = cards({ mastered: true, nextLevel: null });
    expect(
      cardAdvice({ ...last, nextFamily: { family: 'readInterval', level: 'RI1' } })?.say,
    ).toEqual({
      rule: 'mastered',
      action: { kind: 'family', family: 'readInterval', level: 'RI1' },
    });
    expect(cardAdvice(last)?.say).toEqual({ rule: 'mastered', action: null });
  });

  it('mastered just now is the family’s own rule over the answers before and after', () => {
    /** `n` un-hinted answers at L3, the first `wrong` of them wrong, each in `ms`. */
    const attempts = (n: number, wrong = 0, ms = MASTERY_MEDIAN_MS - 1, session = 'old') =>
      Array.from({ length: n }, (_, i): Attempt => ({
        id: `${session}-${i}`,
        sessionId: session,
        level: 'L3',
        note: 'C3@bass',
        target: 48,
        played: i < wrong ? 50 : 48,
        correct: i >= wrong,
        ms,
        hinted: false,
        timedOut: false,
        at: i,
      }));
    const now = (before: Attempt[], session: Attempt[]) =>
      cardAdvice(
        cards({
          masteredBefore: levelProgress(before, 'L3').mastered,
          mastered: levelProgress([...before, ...session], 'L3').mastered,
        }),
      )?.say?.rule;
    // The window fills: one card short before, full after.
    expect(now(attempts(MASTERY_WINDOW - 1), attempts(1, 0, 900, 'new'))).toBe('mastered');
    expect(now(attempts(MASTERY_WINDOW - 2), attempts(1, 0, 900, 'new'))).toBeUndefined();
    // The share right reaches MASTERY_ACCURACY: the oldest wrong answer leaves the window.
    const allowed = MASTERY_WINDOW - Math.ceil(MASTERY_ACCURACY * MASTERY_WINDOW);
    const justUnder = attempts(MASTERY_WINDOW, allowed + 1);
    expect(now(justUnder, attempts(1, 0, 900, 'new'))).toBe('mastered');
    expect(now(justUnder, attempts(1, 1, 900, 'new'))).toBeUndefined();
    // The median comes under MASTERY_MEDIAN_MS.
    const slow = attempts(MASTERY_WINDOW, 0, MASTERY_MEDIAN_MS);
    expect(now(slow, attempts(MASTERY_WINDOW / 2 + 1, 0, 900, 'new'))).toBe('mastered');
    expect(now(slow, attempts(MASTERY_WINDOW / 2 - 1, 0, 900, 'new'))).toBeUndefined();
    // Mastered already: the next session does not say it again.
    expect(now(attempts(MASTERY_WINDOW), attempts(10, 0, 900, 'new'))).toBeUndefined();
  });

  it('a level too far: under TOO_FAR_SHARE right, and the level below not mastered', () => {
    const below = { level: 'L2', mastered: false };
    expect(cardAdvice(cards({ correct: 5, below }))).toEqual({
      say: {
        rule: 'tooFar',
        correct: 5,
        answers: 10,
        below: 'L2',
        action: { kind: 'level', level: 'L2' },
      },
      practise: null,
    });
    // 60 % right is not under it.
    expect(TOO_FAR_SHARE * 10).toBe(6);
    expect(cardAdvice(cards({ correct: 6, below }))).toBeNull();
    expect(cardAdvice(cards({ answers: 20, correct: 11, below }))?.say?.rule).toBe('tooFar');
    expect(cardAdvice(cards({ answers: 20, correct: 12, below }))).toBeNull();
  });

  it('says a level is too far of a session played to its end, or of ten answers', () => {
    const below = { level: 'L2', mastered: false };
    expect(TOO_FAR_MIN_ANSWERS).toBe(SESSION_LENGTHS[0]);
    // Stopped after two cards, both wrong: nothing is said of the level.
    expect(cardAdvice(cards({ complete: false, answers: 2, correct: 0, below }))).toBeNull();
    const short = TOO_FAR_MIN_ANSWERS - 1;
    expect(cardAdvice(cards({ complete: false, answers: short, correct: 0, below }))).toBeNull();
    // Stopped with as many answers as the shortest session has: it is.
    const stopped = cards({ complete: false, answers: TOO_FAR_MIN_ANSWERS, correct: 0, below });
    expect(cardAdvice(stopped)?.say?.rule).toBe('tooFar');
    // Played to its end, however short the session (Echo's five melodies, rhythm's four lines).
    expect(cardAdvice(cards({ complete: true, answers: 5, correct: 2, below }))?.say?.rule).toBe(
      'tooFar',
    );
    // The floor is the too-far rule's alone: a level mastered by a stopped session is said.
    expect(
      cardAdvice(cards({ complete: false, answers: 1, correct: 1, mastered: true }))?.say?.rule,
    ).toBe('mastered');
  });

  it('is not too far with the level below mastered, or at the family’s first level', () => {
    expect(cardAdvice(cards({ correct: 2 }))).toBeNull();
    expect(cardAdvice(cards({ correct: 2, below: null }))).toBeNull();
  });

  it('items to practise: the button alone, ten cards or twice the items', () => {
    expect(cardAdvice(cards({ practise: ['a', 'b', 'c'] }))).toEqual({
      say: null,
      practise: { kind: 'practise', items: ['a', 'b', 'c'], length: PRACTISE_CARDS },
    });
    const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    expect(cardAdvice(cards({ practise: seven }))?.practise).toMatchObject({ length: 14 });
    expect(practiceLength(5)).toBe(PRACTISE_CARDS);
    expect(practiceLength(6)).toBe(12);
  });

  it('says one sentence at most, in order: mastered, then a level too far', () => {
    const below = { level: 'L2', mastered: false };
    expect(cardAdvice(cards({ mastered: true, correct: 2, below }))?.say?.rule).toBe('mastered');
    expect(cardAdvice(cards({ correct: 2, below }))?.say?.rule).toBe('tooFar');
    expect(cardAdvice(cards({ correct: 2 }))).toBeNull();
  });

  it('offers the items to practise beside either sentence, and alone without one', () => {
    const below = { level: 'L2', mastered: false };
    const practise = ['a', 'b', 'c'];
    const offered = { kind: 'practise', items: practise, length: PRACTISE_CARDS };
    const mastered = cardAdvice(cards({ mastered: true, correct: 2, below, practise }));
    expect(mastered?.say?.rule).toBe('mastered');
    expect(mastered?.practise).toEqual(offered);
    const tooFar = cardAdvice(cards({ correct: 2, below, practise }));
    expect(tooFar?.say?.rule).toBe('tooFar');
    expect(tooFar?.practise).toEqual(offered);
    expect(cardAdvice(cards({ correct: 2, practise }))).toEqual({ say: null, practise: offered });
  });
});

describe('the items to practise', () => {
  const level = ['a', 'b', 'c', 'd', 'e', 'f'];
  const even = () => 1;

  it('are those listed, each once, in the order listed', () => {
    expect(practiceItems(['d', 'b', 'd', 'f', 'b'], level, even)).toEqual(['d', 'b', 'f']);
    expect(practiceItems(['f', 'e', 'd', 'c', 'b'], level, even)).toEqual([
      'f',
      'e',
      'd',
      'c',
      'b',
    ]);
  });

  it('are the level’s own: others are left out, and with none left there are none', () => {
    expect(practiceItems(['x', 'd', 'y', 'b', 'a'], level, even)).toEqual(['d', 'b', 'a']);
    expect(practiceItems(['x', 'y'], level, even)).toEqual([]);
    expect(practiceItems([], level, even)).toEqual([]);
  });

  it('are filled up to PRACTISE_MIN_ITEMS with the level’s weakest, the heaviest first', () => {
    const weight = (item: string) => ({ a: 1, b: 4, c: 2, d: 4, e: 3, f: 1 })[item] ?? 0;
    expect(PRACTISE_MIN_ITEMS).toBe(3);
    // One listed: the two heaviest others, the earlier in the level of equals.
    expect(practiceItems(['c'], level, weight)).toEqual(['c', 'b', 'd']);
    // Two listed: one more, and never one of them again.
    expect(practiceItems(['b', 'd'], level, weight)).toEqual(['b', 'd', 'e']);
    expect(practiceItems(['f', 'a'], level, weight)).toEqual(['f', 'a', 'b']);
  });

  it('are fewer in a level of fewer', () => {
    expect(practiceItems(['a'], ['a', 'b'], even)).toEqual(['a', 'b']);
    expect(practiceItems(['a'], ['a'], even)).toEqual(['a']);
  });
});

describe('the level some items are practised at', () => {
  const levels = [
    { id: 'L1', items: ['a', 'b'] },
    { id: 'L2', items: ['a', 'b', 'c'] },
    { id: 'L3', items: ['c', 'd', 'e'] },
  ];

  it('is the first that has them all', () => {
    expect(levelOfItems(['b', 'a'], levels)).toBe('L1');
    expect(levelOfItems(['c', 'a'], levels)).toBe('L2');
    expect(levelOfItems(['e'], levels)).toBe('L3');
  });

  it('is the first that has the first of them when none has them all', () => {
    expect(levelOfItems(['d', 'a'], levels)).toBe('L3');
    expect(levelOfItems(['a', 'e'], levels)).toBe('L1');
  });

  it('is none for items no level has, or for none', () => {
    expect(levelOfItems(['x'], levels)).toBeNull();
    expect(levelOfItems([], levels)).toBeNull();
  });
});

describe('the family to go on with', () => {
  const page = (family: LevelFamily) =>
    family === 'interval' || family === 'chord'
      ? 'ear'
      : family === 'chordSymbol'
        ? 'harmony'
        : 'read';
  const standing = (family: LevelFamily, over: Partial<FamilyStanding> = {}): FamilyStanding => ({
    family,
    open: true,
    suggested: 'X1',
    lastAt: null,
    ...over,
  });

  it('is one of the same page before one of another', () => {
    const families = [
      standing('notes', { suggested: null }),
      standing('readInterval', { lastAt: 50 }),
      standing('interval', { lastAt: 10 }),
    ];
    expect(familyAfter('notes', families, page)).toEqual({ family: 'readInterval', level: 'X1' });
  });

  it('is the one longest left alone, a family never practised before all', () => {
    const families = [
      standing('notes', { suggested: null }),
      standing('readInterval', { lastAt: 50 }),
      standing('keySignature', { lastAt: 20, suggested: 'KS2' }),
      standing('readChord', { lastAt: 30 }),
    ];
    expect(familyAfter('notes', families, page)).toEqual({ family: 'keySignature', level: 'KS2' });
    const fresh = [...families, standing('rhythm')];
    expect(familyAfter('notes', fresh, page)?.family).toBe('rhythm');
    // Of equals, the earlier in the pages' order.
    const equal = [
      standing('notes', { suggested: null }),
      standing('readChord'),
      standing('rhythm'),
    ];
    expect(familyAfter('notes', equal, page)?.family).toBe('readChord');
  });

  it('leaves out families not open, mastered throughout, and the one just finished', () => {
    const families = [
      standing('notes'),
      standing('readInterval', { open: false }),
      standing('keySignature', { suggested: null }),
      standing('interval', { lastAt: 99 }),
    ];
    expect(familyAfter('notes', families, page)).toEqual({ family: 'interval', level: 'X1' });
    expect(familyAfter('interval', families, page)).toEqual({ family: 'notes', level: 'X1' });
    expect(familyAfter('notes', families.slice(0, 3), page)).toBeNull();
  });
});

describe('whether a session took its level to mastery', () => {
  /** A sight-reading session of fragments first played in time with these shares right. */
  function sight(id: string, shares: number[], at: number): SightSessionSummary {
    return summarizeSightSession({
      id,
      level: 'F1',
      length: 8,
      startedAt: at,
      fragments: shares.map((share, i) => ({
        seed: i,
        version: 1,
        runs: [
          {
            mode: 'time' as const,
            bpm: 72,
            readAhead: 'off' as const,
            startedAt: at + i * 60_000,
            endedAt: at + i * 60_000 + 20_000,
            notes: 40,
            inTime: Math.round(share * 40),
            early: 40 - Math.round(share * 40),
            late: 0,
            wrong: 0,
            missed: 0,
            extras: 0,
            medianDeviation: 10,
            tendency: -5,
          },
        ],
      })),
    })!;
  }
  const after = (sessions: SightSessionSummary[], id: string) =>
    sessionMastery(
      sessions,
      (s) => s.id === id,
      (of) => sightLevelProgress(of, 'F1').mastered,
    );
  const good = SIGHT_MASTERY_SHARE;

  it('sight-reading: by its sessions without the session and with it', () => {
    const earlier = sight('a', Array<number>(SIGHT_MASTERY_FRAGMENTS - 2).fill(good), 1_000_000);
    // The session's two fragments fill the window: mastered just now.
    const last = sight('b', [good, 1], 2_000_000);
    expect(after([earlier, last], 'b')).toEqual({ masteredBefore: false, mastered: true });
    expect(cardAdvice(cards({ ...after([earlier, last], 'b'), answers: 0, correct: 0 }))).toEqual({
      say: { rule: 'mastered', action: { kind: 'level', level: 'L4' } },
      practise: null,
    });
    // One fragment short, or one of them under the line: not yet.
    const one = sight('b', [1], 2_000_000);
    expect(after([earlier, one], 'b')).toEqual({ masteredBefore: false, mastered: false });
    const weak = sight('b', [good - 0.05, 1], 2_000_000);
    expect(after([earlier, weak], 'b')).toEqual({ masteredBefore: false, mastered: false });
    // The next session of the mastered level is not told again.
    const next = sight('c', [1], 3_000_000);
    const then = after([earlier, last, next], 'c');
    expect(then).toEqual({ masteredBefore: true, mastered: true });
    expect(cardAdvice(cards({ ...then, answers: 0, correct: 0 }))).toBeNull();
    // The order the sessions are stored in does not matter.
    expect(after([last, earlier], 'b')).toEqual({ masteredBefore: false, mastered: true });
  });

  it('sight-reading: a session that takes the level out of mastery says nothing', () => {
    const earlier = sight('a', Array<number>(SIGHT_MASTERY_FRAGMENTS).fill(1), 1_000_000);
    const weak = sight('b', [0.5], 2_000_000);
    const then = after([earlier, weak], 'b');
    expect(then).toEqual({ masteredBefore: true, mastered: false });
    // No answers to count: it is never a level too far either.
    const below = { level: 'F1', mastered: false };
    expect(cardAdvice(cards({ ...then, answers: 0, correct: 0, below }))).toBeNull();
  });

  it('Read’s notes: by the attempts without the session’s and with them', () => {
    const attempt = (i: number, sessionId: string): Attempt => ({
      id: `${sessionId}-${i}`,
      sessionId,
      level: 'L3',
      note: 'C3@bass',
      target: 48,
      played: 48,
      correct: true,
      ms: 900,
      hinted: false,
      timedOut: false,
      at: i,
    });
    const old = Array.from({ length: MASTERY_WINDOW - 1 }, (_, i) => attempt(i, 'old'));
    const now = [attempt(MASTERY_WINDOW, 'new')];
    const of = (attempts: Attempt[], id: string) =>
      sessionMastery(
        attempts,
        (a) => a.sessionId === id,
        (records) => levelProgress(records, 'L3').mastered,
      );
    expect(of([...old, ...now], 'new')).toEqual({ masteredBefore: false, mastered: true });
    expect(of([...old, ...now], 'old')).toEqual({ masteredBefore: false, mastered: true });
    expect(of(old, 'new')).toEqual({ masteredBefore: false, mastered: false });
  });
});

describe('what a session leaves to practise', () => {
  const level = ['a', 'b', 'c', 'd', 'e', 'f'];
  const even = () => 1;
  /** A summary's "slowest" list: three items, whatever their times. */
  const slowest = (...ms: number[]) => ms.map((time, i) => ({ item: level[i]!, ms: time }));
  const offered = (missed: string[], slow: { item: string; ms: number }[], line: number | null) =>
    cardAdvice(cards({ practise: practiceItems(toPractise(missed, slow, line), level, even) }));

  it('a session with nothing missed and every answer fast leaves nothing', () => {
    // The summary still lists its three slowest: none of them is slow.
    expect(toPractise([], slowest(900, 300, 300), MASTERY_MEDIAN_MS)).toEqual([]);
    expect(offered([], slowest(900, 300, 300), MASTERY_MEDIAN_MS)).toBeNull();
  });

  it('one slow item is enough, filled up to three', () => {
    expect(toPractise([], slowest(2400, 300, 300), MASTERY_MEDIAN_MS)).toEqual(['a']);
    expect(offered([], slowest(2400, 300, 300), MASTERY_MEDIAN_MS)?.practise).toEqual({
      kind: 'practise',
      items: ['a', 'b', 'c'],
      length: PRACTISE_CARDS,
    });
  });

  it('slow is not under the line the family’s mastery draws for the median', () => {
    for (const line of [
      MASTERY_MEDIAN_MS,
      theoryMasteryMedianMs('readInterval'),
      theoryMasteryMedianMs('keySignature'),
      theoryMasteryMedianMs('readChord'),
      HARMONY_MASTERY_MEDIAN_MS,
    ]) {
      expect(toPractise([], slowest(line - 1), line)).toEqual([]);
      expect(toPractise([], slowest(line), line)).toEqual(['a']);
      expect(toPractise([], slowest(line + 1, line, line - 1), line)).toEqual(['a', 'b']);
    }
    // The lines are the mastery rules' own.
    expect(MASTERY_MEDIAN_MS).toBe(2000);
    expect(theoryMasteryMedianMs('readInterval')).toBe(3000);
    expect(theoryMasteryMedianMs('readChord')).toBe(4000);
    expect(HARMONY_MASTERY_MEDIAN_MS).toBe(3000);
  });

  it('the missed items come first, then the slow ones, each once', () => {
    const slow = [
      { item: 'b', ms: 5000 },
      { item: 'd', ms: 2500 },
      { item: 'e', ms: 400 },
    ];
    expect(toPractise(['d', 'c', 'd'], slow, MASTERY_MEDIAN_MS)).toEqual(['d', 'c', 'b']);
    expect(toPractise(['c'], slow, MASTERY_MEDIAN_MS)).toEqual(['c', 'b', 'd']);
  });

  it('a family whose mastery draws no line for the time has its missed items alone', () => {
    expect(toPractise([], slowest(9000, 8000), null)).toEqual([]);
    expect(toPractise(['c'], slowest(9000, 8000), null)).toEqual(['c']);
    expect(offered([], slowest(9000, 8000), null)).toBeNull();
  });
});
