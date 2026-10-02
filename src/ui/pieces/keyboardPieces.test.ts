// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { KEYBOARDS, type KeyRange } from '../../core/instrument.ts';
import { keyboardScore } from '../../core/keyboardFixture.ts';
import type { PieceSessionRecord } from '../../core/log.ts';
import { nextStep, piecePlan, planSource } from '../../core/piecePlan.ts';
import { pieceFacts, type PieceStep } from '../../core/pieceRecords.ts';
import { playOrder } from '../../core/repeats.ts';
import { keysOfRun } from '../../core/runKeys.ts';
import { buildSteps, type HandSelection, type Score } from '../../core/score.ts';
import { takePlayback } from '../../core/takePlayback.ts';
import { startWait, waitRange, type BarLoop } from '../../core/wait.ts';
import { BUILT_IN } from '../../pieces/library/index.ts';
import { readScore } from '../../pieces/load.ts';
import { recordedRun, waitRecording } from './record.ts';
import { runReducer, startRun, type Run } from './run.ts';

// The library's pieces on keyboards with fewer keys (docs/PERSONAL.md, "The instrument's keys"):
// a plan that asks for nothing nobody can play, and a past run read with the keyboard it keeps.

const FILES = import.meta.glob<string>('../../pieces/library/*.musicxml', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const scoreOf = (id: string): Score => readScore(FILES[`../../pieces/library/${id}.musicxml`]!);
const EPOCH = Date.UTC(2026, 9, 2, 9);

/** Small keyboards a player may set under Other: C3–C5, F3–C6 and C3–C6. */
const SMALL_KEYBOARDS: KeyRange[] = [
  { low: 48, high: 72 },
  { low: 53, high: 84 },
  { low: 48, high: 84 },
];

/** A clean run in wait mode on `keys`: `rounds` times round `loop`, or once to the end. */
function waitRun(
  id: string,
  pieceId: string,
  score: Score,
  keys: KeyRange | null,
  hands: HandSelection,
  loop: BarLoop | null,
  rounds = 3,
): { run: Run; session: PieceSessionRecord; steps: PieceStep[] } {
  const order = playOrder(score.measures, 'play');
  const list = buildSteps(score, hands, order, keys);
  const range = waitRange(list, order, loop, loop?.from ?? 0);
  let run = startRun({ id, steps: list, range });
  const perRound = range
    ? list.slice(range.first, range.last + 1).filter((s) => s.midis.length > 0).length
    : 0;
  let time = 1000;
  for (let own = 0; run.wait && !run.wait.finished && (!loop || own < perRound * rounds); own++) {
    time += 600;
    for (const midi of run.steps[run.wait.current]!.midis) {
      run = runReducer(run, { type: 'press', midi, velocity: 64, time, at: EPOCH + time });
      run = runReducer(run, { type: 'input', input: { type: 'off', midi, time: time + 200 } });
    }
  }
  if (loop) run = runReducer(run, { type: 'end' });
  const recorded = recordedRun(waitRecording(run), {
    pieceId,
    checksum: pieceFacts(score).checksum,
    title: pieceId,
    hands,
    loop: loop && { ...loop, fromLabel: String(loop.from + 1), toLabel: String(loop.to + 1) },
    repeats: 'play',
    tempo: 100,
    keys,
  })!;
  return { run, session: recorded.session, steps: recorded.steps };
}

describe('a piece’s plan on a keyboard with fewer keys', () => {
  const ODE = 'beethoven-ode-to-joy';
  const ode = scoreOf(ODE);
  /** F3–C6: the left hand of the first bars lies under it. */
  const F3_C6 = { low: 53, high: 84 };

  it('is the plan of 88 keys on a keyboard that has every key of the piece', () => {
    expect(planSource(ode).phrases.every((p) => p.playable === undefined)).toBe(true);
    const on61 = planSource(ode, KEYBOARDS[61]);
    expect(on61.phrases).toEqual(
      planSource(ode).phrases.map((phrase) => ({
        ...phrase,
        playable: { right: true, left: true, both: true },
      })),
    );
    const input = { pieceId: ODE, sessions: [], steps: [] };
    const stages = (source: ReturnType<typeof planSource>) => {
      const plan = piecePlan({ ...input, ...source });
      return [plan.stages, plan.rows.map((row) => row.stages), plan.whole, plan.next];
    };
    expect(stages(on61)).toEqual(stages(planSource(ode)));
  });

  it('has no stage for a hand whose every step of the phrase is the app’s', () => {
    const source = planSource(ode, F3_C6);
    const first = source.phrases[0]!;
    expect(first.playable).toEqual({ right: true, left: false, both: true });
    const plan = piecePlan({ pieceId: ODE, ...source, sessions: [], steps: [] });
    const stagesOf = (row: number) => plan.rows[row]!.stages.flatMap((s) => (s ? [s.stage] : []));
    expect(stagesOf(0)).toEqual(['right', 'together', 'inTime']);
    expect(plan.next).toMatchObject({ stage: 'right', phrase: 0 });
    // On 88 keys the left hand of those bars is a stage, and comes after the right.
    const whole = piecePlan({ pieceId: ODE, ...planSource(ode), sessions: [], steps: [] });
    expect(whole.rows[0]!.stages.flatMap((s) => (s ? [s.stage] : []))).toEqual([
      'right',
      'left',
      'together',
      'inTime',
    ]);
  });

  it('goes on past it: after the right hand, together, not a left hand nobody can play', () => {
    const source = planSource(ode, F3_C6);
    const { from, to } = source.phrases[0]!;
    const right = waitRun('a', ODE, ode, F3_C6, 'right', { from, to });
    const after = (runs: (typeof right)[]) =>
      nextStep({
        pieceId: ODE,
        ...source,
        sessions: runs.map((r) => r.session),
        steps: runs.flatMap((r) => r.steps),
      });
    expect(after([right])).toMatchObject({ stage: 'together', hands: 'both', bars: { from, to } });
    // Together is three clean times round too, the left hand's steps passed: then the next phrase.
    const both = waitRun('b', ODE, ode, F3_C6, 'both', { from, to });
    expect(both.session.given).toBeGreaterThan(0);
    const next = after([right, both])!;
    expect(next.stage).not.toBe('together');
    expect(next.bars!.from).toBeGreaterThan(to);
    // Read with the plan of 88 keys, the same records would ask for the left hand for ever.
    expect(
      nextStep({
        pieceId: ODE,
        ...planSource(ode),
        sessions: [right.session, both.session],
        steps: [...right.steps, ...both.steps],
      }),
    ).toMatchObject({ stage: 'left', bars: { from, to } });
  });

  it('asks, in every library piece on every keyboard, only for stages the player can start', () => {
    let stages = 0;
    let left = 0;
    for (const piece of BUILT_IN) {
      const score = scoreOf(piece.id);
      const order = playOrder(score.measures, 'play');
      const full = planSource(score);
      for (const keys of [...SMALL_KEYBOARDS, KEYBOARDS[49], KEYBOARDS[61]]) {
        const source = planSource(score, keys);
        const plan = piecePlan({ pieceId: piece.id, ...source, sessions: [], steps: [] });
        left += full.phrases.length - source.phrases.length;
        const startable = (hands: HandSelection, bars: BarLoop | null) => {
          const list = buildSteps(score, hands, order, keys);
          const range = waitRange(list, order, bars, bars?.from ?? 0);
          return range !== null && startWait(list, range) !== null;
        };
        for (const row of plan.rows)
          for (const stage of row.stages) {
            if (!stage) continue;
            stages++;
            expect([piece.id, keys, stage.stage, startable(stage.hands, stage.bars)]).toEqual([
              piece.id,
              keys,
              stage.stage,
              true,
            ]);
          }
        if (plan.rows.length > 0) expect(startable(plan.whole.hands, null)).toBe(true);
        // What is left out is what cannot be started, and nothing else.
        for (const phrase of full.phrases)
          for (const hands of ['right', 'left', 'both'] as const) {
            if (phrase.bars[hands].length === 0) continue;
            const kept = source.phrases.find((p) => p.from === phrase.from);
            expect([piece.id, keys, phrase.from, hands, kept?.playable?.[hands] ?? false]).toEqual([
              piece.id,
              keys,
              phrase.from,
              hands,
              startable(hands, phrase),
            ]);
          }
      }
    }
    expect(stages).toBeGreaterThan(1000);
    // No phrase of the library is all the app's on these keyboards.
    expect(left).toBe(0);
  });

  it('leaves out a phrase with nothing for the player in it', () => {
    // The fixture's last bar (C4 over C3) is a phrase of its own; on C♯4–C5 it is all the app's.
    const score = keyboardScore();
    expect(planSource(score).phrases.map((p) => [p.from, p.to])).toEqual([
      [0, 3],
      [4, 4],
    ]);
    const source = planSource(score, { low: 61, high: 73 });
    expect(source.phrases.map((p) => [p.from, p.to])).toEqual([[0, 3]]);
    // Its left hand is all under the keyboard: the phrase has the right hand's stages alone.
    expect(source.phrases[0]!.playable).toEqual({ right: true, left: false, both: true });
    const plan = piecePlan({ pieceId: 'p', ...source, sessions: [], steps: [] });
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0]!.stages.flatMap((s) => (s ? [s.stage] : []))).toEqual([
      'right',
      'together',
      'inTime',
    ]);
  });

  it('has no plan for a piece with nothing for the player to play', () => {
    // C7–C8: every note of the Ode is under it.
    const source = planSource(ode, { low: 96, high: 108 });
    expect(source.phrases).toEqual([]);
    const plan = piecePlan({ pieceId: ODE, ...source, sessions: [], steps: [] });
    expect(plan).toMatchObject({ rows: [], stages: [], next: null });
    expect(nextStep({ pieceId: ODE, ...source, sessions: [], steps: [] })).toBeNull();
  });
});

describe('Für Elise on 61 keys, played to the end and read later', () => {
  const ELISE = 'beethoven-fur-elise';
  const score = scoreOf(ELISE);
  const played = waitRun('e', ELISE, score, KEYBOARDS[61], 'both', null);
  const events = played.run.take!.events;
  const past = { score, hands: 'both' as const, repeats: 'play' as const, loop: null, events };
  const playback = (keys: KeyRange | null) =>
    takePlayback({ ...past, mode: 'wait', tempo: 100, latency: 0, keys })!;

  it('keeps its keyboard: the final bass A, the only note the app played, sounds again', () => {
    expect(played.session).toMatchObject({ completed: true, given: 1, keys: [36, 96] });
    const keys = keysOfRun({ ...past, mode: 'wait', keys: played.session.keys });
    expect(keys).toEqual(KEYBOARDS[61]);
    const whole = playback(keys);
    expect(whole.keys.filter((k) => k.midi === 33)).toHaveLength(1);
    expect(whole.keys).toEqual(playback(KEYBOARDS[61]).keys);
    // Read as a run on 88 keys it would be missing.
    expect(playback(null).keys.some((k) => k.midi === 33)).toBe(false);
  });

  it('is told its keyboard without one, the last step of a run to the end being left', () => {
    const { given, completed } = played.session;
    const told = keysOfRun({ ...past, mode: 'wait', given, completed });
    // A1 was the app's, in the run's last step: the keyboard begins above it.
    expect(told).toEqual({ low: 34, high: 108 });
    expect(playback(told).keys).toEqual(playback(KEYBOARDS[61]).keys);
    // A run stopped on its last step tells nothing of it: the step may not have been completed.
    expect(keysOfRun({ ...past, mode: 'wait', given, completed: false })).toBeNull();
  });
});
