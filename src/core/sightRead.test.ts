// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import { createMatcher, type StepTiming } from './rhythm.ts';
import { buildSteps, type Score, type Step } from './score.ts';
import { generateFragment } from './sightFragment.ts';
import { type SightLevelId } from './sightLevels.ts';
import {
  firstTimeRun,
  judgeTimeRun,
  judgeWaitRun,
  sightLevelProgress,
  sightPlan,
  sightRunCount,
  suggestedSightLevel,
  summarizeSightSession,
  type SightSessionSummary,
  type TimeRunFigures,
} from './sightRead.ts';
import { sightHands, sightMusicXml } from './sightXml.ts';
import { press, startWait, type StepRecord } from './wait.ts';

function fragmentScore(level: SightLevelId, seed: number) {
  const f = generateFragment(level, seed);
  const score = parseMusicXml(
    new DOMParser().parseFromString(sightMusicXml(f), 'application/xml'),
    { hands: sightHands() },
  );
  return { f, score, steps: buildSteps(score, 'both') };
}

/** Plays every key of the plan, `shift(step, midi)` ms off (null: not at all), the extras given. */
function playRun(
  score: Score,
  steps: readonly Step[],
  bpm: number,
  shift: (step: Step, midi: number) => number | null,
  extras: { midi: number; time: number }[] = [],
): StepTiming[] {
  const plan = sightPlan(score, steps, bpm);
  const matcher = createMatcher(plan);
  const events: { midi: number; time: number }[] = [...extras];
  for (const s of plan.steps)
    for (const midi of s.midis) {
      const off = shift(steps[s.step]!, midi);
      if (off !== null) events.push({ midi, time: s.at + off });
    }
  events.sort((a, b) => a.time - b.time);
  const timings: StepTiming[] = [];
  for (const e of events) {
    timings.push(...matcher.advance(e.time));
    matcher.play(e.midi, e.time);
  }
  timings.push(...matcher.finish(plan.length + 1000));
  return timings;
}

const CONTEXT = { bpm: 72, readAhead: 'off', startedAt: 1000, endedAt: 30_000 } as const;

describe('the plan of a fragment', () => {
  it('times every step at the tempo and ends a beat after the last bar’s downbeat', () => {
    const { f, score, steps } = fragmentScore('F5', 3);
    const plan = sightPlan(score, steps, 60);
    expect(plan.steps).toHaveLength(steps.length);
    const beats = Number(f.meter[0]);
    expect(plan.steps.at(-1)!.at).toBe((f.bars - 1) * beats * 1000);
    expect(plan.length).toBe(((f.bars - 1) * beats + 1) * 1000);
    expect(plan.countIn).toHaveLength(beats);
  });
});

describe('judging a run in time', () => {
  it('counts every key right and in time when played on the beat', () => {
    const { score, steps } = fragmentScore('F8', 5);
    const run = judgeTimeRun(
      score,
      steps,
      playRun(score, steps, 72, () => 0),
      CONTEXT,
    );
    const keys = steps.reduce((n, s) => n + s.midis.length, 0);
    expect(run.figures).toMatchObject({
      mode: 'time',
      notes: keys,
      inTime: keys,
      early: 0,
      late: 0,
      wrong: 0,
      missed: 0,
      extras: 0,
      medianDeviation: 0,
      tendency: 0,
    });
    expect(run.bars.reduce((n, b) => n + b.notes, 0)).toBe(keys);
    for (const note of score.notes) expect(run.ink.get(note.id)).toBe('in');
  });

  it('tells late notes, missed ones, wrong keys and extras apart, bar by bar', () => {
    const { score, steps } = fragmentScore('F4', 8);
    const first = steps[0]!;
    const second = steps[1]!;
    const late = steps.find((s) => s.measure === 1)!;
    // Bar 1: its first step's right-hand key replaced by a key a semitone up (wrong), the second
    // step's keys all missed; bar 2's first step 80 ms late; one extra key in bar 3's rest of it.
    const wrongKey = Math.max(...first.midis);
    const timings = playRun(
      score,
      steps,
      60,
      (s, midi) =>
        s === first && midi === wrongKey ? null : s === second ? null : s === late ? 80 : 0,
      [{ midi: wrongKey + 1, time: 5 }],
    );
    const run = judgeTimeRun(score, steps, timings, { ...CONTEXT, bpm: 60 });
    if (run.figures.mode !== 'time') throw new Error('a run in time');
    expect(run.bars[0]).toMatchObject({ wrong: 1, missed: second.midis.length, extras: 0 });
    expect(run.bars[1]!.late).toBe(late.midis.length);
    expect(run.figures.late).toBe(late.midis.length);
    expect(run.figures.inTime).toBe(
      run.figures.notes - 1 - second.midis.length - late.midis.length,
    );
    const lateNote = score.notes.find((n) => n.id === late.noteIds[0])!;
    expect(run.ink.get(lateNote.id)).toBe('late');
    const missedId = second.noteIds[0]!;
    expect(run.ink.get(missedId)).toBe('missed');
    expect(run.figures.tendency).toBeGreaterThanOrEqual(0);
  });

  it('inks a tie’s second note as its first', () => {
    for (let seed = 1; seed < 60; seed++) {
      const { score, steps } = fragmentScore('F7', seed);
      const tied = score.notes.find((n) => n.tieStop);
      if (!tied) continue;
      const run = judgeTimeRun(
        score,
        steps,
        playRun(score, steps, 72, () => -70),
        CONTEXT,
      );
      expect(run.ink.get(tied.id)).toBe('early');
      return;
    }
    throw new Error('no tie in 60 fragments of F7');
  });
});

describe('judging a run in wait mode', () => {
  it('counts the wrong keys of each bar', () => {
    const { score, steps } = fragmentScore('F1', 2);
    let state = startWait(steps)!;
    const records: StepRecord[] = [];
    let time = 0;
    for (const step of steps) {
      if (step.index === 1) state = press(steps, state, step.midis[0]! + 1, (time += 100)).state;
      for (const midi of step.midis) {
        const result = press(steps, state, midi, (time += 300));
        state = result.state;
        if ('record' in result) records.push(result.record);
      }
    }
    const run = judgeWaitRun(score, steps, records, { startedAt: 1, endedAt: 2 });
    expect(run.figures).toEqual({
      mode: 'wait',
      startedAt: 1,
      endedAt: 2,
      notes: steps.length,
      wrong: 1,
    });
    expect(run.bars[steps[1]!.measure]!.wrong).toBe(1);
  });
});

function timeRun(startedAt: number, notes: number, inTime: number): TimeRunFigures {
  return {
    mode: 'time',
    bpm: 72,
    readAhead: 'off',
    startedAt,
    endedAt: startedAt + 20_000,
    notes,
    inTime,
    early: notes - inTime,
    late: 0,
    wrong: 0,
    missed: 0,
    extras: 0,
    medianDeviation: 10,
    tendency: -5,
  };
}

function session(
  id: string,
  level: SightLevelId,
  shares: number[],
  at: number,
  extra: { wait?: boolean } = {},
): SightSessionSummary {
  return summarizeSightSession({
    id,
    level,
    length: 8,
    startedAt: at,
    fragments: shares.map((share, i) => ({
      seed: i,
      version: 1,
      runs: [
        ...(extra.wait
          ? [
              {
                mode: 'wait' as const,
                startedAt: at + i * 60_000,
                endedAt: at + i * 60_000 + 1,
                notes: 40,
                wrong: 5,
              },
            ]
          : []),
        timeRun(at + i * 60_000 + 10, 40, Math.round(share * 40)),
        // "Again" does not count: sight-reading is the first reading.
        timeRun(at + i * 60_000 + 30_000, 40, 40),
      ],
    })),
  })!;
}

describe('a session and mastery', () => {
  it('is stored with the fragments played, ending with its last run', () => {
    const s = session('a', 'F2', [0.5, 1], 1_000_000);
    expect(s.fragments).toHaveLength(2);
    expect(sightRunCount(s)).toBe(4);
    expect(s.endedAt).toBe(1_000_000 + 60_000 + 30_000 + 20_000);
    expect(s.activeMs).toBeLessThanOrEqual(s.endedAt - s.startedAt);
    expect(firstTimeRun(s.fragments[0]!)!.inTime).toBe(20);
    expect(
      summarizeSightSession({
        id: 'b',
        level: 'F1',
        length: 4,
        startedAt: 0,
        fragments: [{ seed: 1, version: 1, runs: [] }],
      }),
    ).toBeNull();
  });

  it('is the last five fragments in time each at 90 % or more, by their first run in time', () => {
    const passing = session('a', 'F1', [0.9, 0.95, 1], 1_000_000, { wait: true });
    expect(sightLevelProgress([passing], 'F1')).toMatchObject({ total: 3, mastered: false });
    const more = session('b', 'F1', [0.9, 1], 2_000_000);
    const progress = sightLevelProgress([more, passing], 'F1');
    expect(progress).toMatchObject({ total: 5, mastered: true });
    expect(progress.window).toEqual([0.9, 0.95, 1, 0.9, 1]);
    // One weak fragment among the last five, and it is not.
    const weak = session('c', 'F1', [0.85], 3_000_000);
    expect(sightLevelProgress([passing, more, weak], 'F1').mastered).toBe(false);
    const progressMap = new Map([
      ['F1', sightLevelProgress([passing, more], 'F1')],
      ['F2', sightLevelProgress([], 'F2')],
    ] as const);
    expect(suggestedSightLevel(progressMap)).toBe('F2');
  });
});
