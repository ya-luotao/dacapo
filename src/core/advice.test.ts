import { describe, expect, it } from 'vitest';
import {
  EVEN_STEP_BPM,
  MISSED_STEP,
  reviewLine,
  rhythmAdvice,
  scaleAdvice,
  SLOWER_SHARE,
  waitAdvice,
  type RhythmRun,
  type ScaleFinding,
  type ScaleRun,
  type WaitRun,
  type WaitStep,
} from './advice.ts';
import type { PieceSessionRecord } from './log.ts';
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
