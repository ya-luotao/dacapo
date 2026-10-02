// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { LoopRange } from '../../core/pieceRecords.ts';
import { pieceChecksum } from '../../core/pieceRecords.ts';
import { playOrder } from '../../core/repeats.ts';
import { createMatcher, rhythmPlan } from '../../core/rhythm.ts';
import { buildSteps } from '../../core/score.ts';
import { waitRange } from '../../core/wait.ts';
import furElise from '../../pieces/library/beethoven-fur-elise.musicxml?raw';
import { readScore } from '../../pieces/load.ts';
import fixture from './keyboard88.fixture.json';
import { recordedRun, waitRecording, type RecordableRun, type RunContext } from './record.ts';
import { idleRhythm, rhythmReducer, rhythmTakeDone } from './rhythm.ts';
import { runReducer, startRun } from './run.ts';

// With 88 keys nothing of a run changes (docs/PERSONAL.md, "The instrument's keys"): two scripted
// runs of Für Elise, one in wait mode and one in rhythm mode, leave the records and the take they
// left before the instrument's keys could be chosen. The fixture was written by the build before
// G6c, from this script.

const EPOCH = Date.UTC(2026, 9, 2, 9);
/** A key no step of the piece asks for: a wrong note in wait mode, an extra in rhythm mode. */
const STRAY = 22;

const score = readScore(furElise);
const order = playOrder(score.measures, 'play');
const steps = buildSteps(score, 'both', order);
const context = (extra: Partial<RunContext>): RunContext => ({
  pieceId: 'beethoven-fur-elise',
  checksum: pieceChecksum(score),
  title: 'Für Elise',
  hands: 'both',
  loop: null,
  repeats: 'play',
  tempo: 100,
  ...extra,
});

function waitRun() {
  const range = waitRange(steps, order, null, 0);
  let run = startRun({ id: 'wait-88', steps, range });
  let time = 1000;
  steps.forEach((step, i) => {
    time += 400 + (i % 5) * 37;
    const press = (midi: number) => {
      run = runReducer(run, {
        type: 'press',
        midi,
        velocity: 60 + (i % 9) * 5,
        time,
        at: EPOCH + Math.round(time),
      });
      run = runReducer(run, { type: 'input', input: { type: 'off', midi, time: time + 150 } });
      time += 3;
    };
    if (i % 7 === 3) press(STRAY);
    for (const midi of step.midis) press(midi);
  });
  return { recorded: recordedRun(waitRecording(run), context({})), take: run.take };
}

function rhythmRun() {
  const loop = { from: 0, to: 4 };
  const plan = rhythmPlan({ score, order, steps, loop, startBar: 0, scale: 0.6 })!;
  const matcher = createMatcher(plan);
  const origin = 5000;
  let state = rhythmReducer(idleRhythm('idle'), {
    type: 'start',
    id: 'rhythm-88',
    epochOrigin: EPOCH,
    origin,
    latency: 12,
  });
  const play = (midi: number, at: number) => {
    const result = matcher.play(midi, at);
    state = rhythmReducer(state, {
      type: 'played',
      result,
      midi,
      velocity: 50 + (midi % 40),
      time: origin + at + 12,
    });
    state = rhythmReducer(state, {
      type: 'input',
      input: { type: 'off', midi, time: origin + at + 12 + 90 },
    });
  };
  for (let round = 0; round < 2; round++) {
    plan.steps.forEach((step, j) => {
      const due = round * plan.length + step.at;
      state = rhythmReducer(state, { type: 'settled', timings: matcher.advance(due - 60) });
      for (const midi of step.midis) {
        if ((j + midi) % 11 === 0) continue;
        play(midi, due + (((j * 7 + midi) % 61) - 30));
      }
      if (j % 9 === 4) play(STRAY, due + 35);
    });
  }
  state = rhythmReducer(state, { type: 'settled', timings: matcher.finish(2 * plan.length + 10) });
  state = rhythmReducer(state, { type: 'end', reason: 'stopped' });
  const labelled: LoopRange = { ...loop, fromLabel: '0', toLabel: '4' };
  const run: RecordableRun = {
    id: state.id,
    records: state.records,
    startedEpoch: state.startedEpoch,
    ended: { completed: true },
    take: state.take,
    takeDone: rhythmTakeDone(state),
  };
  return {
    recorded: recordedRun(run, context({ loop: labelled, tempo: 60, mode: 'rhythm' })),
    take: state.take,
  };
}

/** As JSON has it: what is stored. */
const stored = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

describe('with 88 keys', () => {
  it('a wait run leaves the records and the take it left before', () => {
    const run = waitRun();
    expect(run.recorded!.steps.length).toBe(steps.length);
    expect(stored(run)).toEqual(fixture.wait);
  });

  it('a rhythm run leaves the records and the take it left before', () => {
    const run = rhythmRun();
    expect(run.recorded!.session.rhythm!.notes).toBeGreaterThan(50);
    expect(stored(run)).toEqual(fixture.rhythm);
  });
});
