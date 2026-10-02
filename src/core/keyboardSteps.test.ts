import { describe, expect, it } from 'vitest';
import { FULL_KEYS, KEYBOARDS } from './instrument.ts';
import { keyboardScore, PASSED_STEPS, Q, SMALL, STEPS } from './keyboardFixture.ts';
import {
  accompanied,
  accompanimentPlan,
  beyondKeyboard,
  demoPlan,
  playedForPlayer,
  type AccompanimentNote,
} from './playback.ts';
import { performanceOrder } from './repeats.ts';
import { createMatcher, rhythmPlan, type StepTiming } from './rhythm.ts';
import { buildSteps, type Step } from './score.ts';
import {
  press,
  startWait,
  waitRange,
  type PressResult,
  type StepRecord,
  type WaitState,
} from './wait.ts';

const score = keyboardScore();
const order = performanceOrder(score.measures);
const full = buildSteps(score, 'both', order);
const steps = buildSteps(score, 'both', order, SMALL);

/** Presses `keys` at 100 ms apart from `at`, and returns every result with the last state. */
function play(
  list: readonly Step[],
  state: WaitState,
  keys: readonly number[],
  at = 1000,
): { results: PressResult[]; state: WaitState } {
  const results: PressResult[] = [];
  keys.forEach((midi, i) => {
    const result = press(list, state, midi, at + i * 100);
    results.push(result);
    state = result.state;
  });
  return { results, state };
}

/** The records a run leaves, in order: each step completed with the steps passed round it. */
function recordsOf(results: readonly PressResult[]): StepRecord[] {
  return results.flatMap((r) =>
    'record' in r ? [...(r.passed?.before ?? []), r.record, ...(r.passed?.after ?? [])] : [],
  );
}

describe('the steps on a keyboard with fewer keys', () => {
  it('are the same steps, each with its keys beyond the keyboard set apart', () => {
    expect(steps).toHaveLength(STEPS);
    expect(steps.map((s) => s.midis)).toEqual([
      [48, 60],
      [64],
      [67],
      [62],
      [],
      [],
      [52],
      [48, 60],
      [48, 60],
    ]);
    expect(steps.map((s) => s.given)).toEqual([
      undefined,
      undefined,
      [43, 76],
      undefined,
      [84],
      [83],
      [81],
      undefined,
      undefined,
    ]);
    // A step is never left out: its index, bar, pass and time are those of every keyboard.
    const place = (s: Step) => [
      s.index,
      s.tick,
      s.played,
      s.measure,
      s.pass,
      s.writtenTick,
      s.beat,
    ];
    expect(steps.map(place)).toEqual(full.map(place));
    // Its notes are the player's, the others the app's; an ornament stays with its step.
    steps.forEach((s, i) => {
      expect([...s.noteIds, ...(s.givenIds ?? [])].sort()).toEqual([...full[i]!.noteIds].sort());
      expect(s.ornaments).toEqual(full[i]!.ornaments);
    });
    expect(steps.filter((s) => s.midis.length === 0)).toHaveLength(PASSED_STEPS);
  });

  it('are untouched with 88 keys, and on a keyboard that has every key of the piece', () => {
    expect(buildSteps(score, 'both', order, FULL_KEYS)).toEqual(full);
    expect(buildSteps(score, 'both', order, null)).toEqual(full);
    expect(buildSteps(score, 'both', order, KEYBOARDS[61])).toEqual(full);
    expect(full.every((s) => s.given === undefined && s.givenIds === undefined)).toBe(true);
  });

  it('sets the keys apart for one hand as for both', () => {
    const left = buildSteps(score, 'left', order, SMALL);
    expect(left.map((s) => [s.midis, s.given])).toEqual([
      [[48], undefined],
      [[], [43]],
      [[52], undefined],
      [[48], undefined],
      [[48], undefined],
    ]);
  });
});

describe('wait mode on a keyboard with fewer keys', () => {
  const start = () => startWait(steps)!;

  it('waits for the keys the player has: a chord split with the app is complete with them', () => {
    const { results, state } = play(steps, start(), [60, 48, 64, 67]);
    expect(results.map((r) => r.kind)).toEqual(['progress', 'complete', 'complete', 'complete']);
    // G4 alone completes the chord G4 + E5 over G2: two keys were the app's.
    expect(results[3]).toMatchObject({ record: { step: 2, wrong: 0, given: 2 } });
    expect(state.current).toBe(3);
  });

  it('passes a step with none of the player’s keys, and records it as it goes by', () => {
    const { results, state } = play(steps, start(), [60, 48, 64, 67, 62]);
    // D4 completes step 3; steps 4 and 5 (C6, B5) are passed, and the run waits on step 6.
    const last = results.at(-1)!;
    expect(last.kind).toBe('complete');
    expect(state.current).toBe(6);
    expect(state.pressed).toEqual([]);
    expect(recordsOf([last])).toEqual([
      { step: 3, measure: 1, pass: 1, ms: 100, wrong: 0, at: 1400 },
      { step: 4, measure: 2, pass: 1, ms: 0, wrong: 0, at: 1400, passed: true, given: 1 },
      { step: 5, measure: 2, pass: 1, ms: 0, wrong: 0, at: 1400, passed: true, given: 1 },
    ]);
    // The next step's clock starts where the run arrived on it.
    expect(state.since).toBe(1400);
  });

  it('leaves a record for every step of the run, as on 88 keys', () => {
    const { results, state } = play(steps, start(), [60, 48, 64, 67, 62, 52, 60, 48, 48, 60]);
    expect(results.at(-1)!.kind).toBe('finished');
    expect(state.finished).toBe(true);
    const records = recordsOf(results);
    expect(records.map((r) => r.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(records.map((r) => [r.measure, r.pass])).toEqual(full.map((s) => [s.measure, s.pass]));
    expect(records.filter((r) => r.passed).map((r) => r.step)).toEqual([4, 5]);
    // The notes played for the player, step by step: E5 and G2, C6, B5, A5.
    expect(records.reduce((sum, r) => sum + (r.given ?? 0), 0)).toBe(5);
  });

  it('counts a wrong key as before, and a key the app plays as neither right nor wrong', () => {
    let state = play(steps, start(), [60, 48, 64]).state;
    // On the split chord: F4 is wrong; E5 and G2 are the app's, struck all the same.
    const wrong = press(steps, state, 65, 2000);
    expect(wrong.kind).toBe('wrong');
    state = wrong.state;
    for (const key of [76, 43]) {
      const given = press(steps, state, key, 2100);
      expect(given.kind).toBe('given');
      expect(given.state.wrong).toBe(1);
      expect(given.state.pressed).toEqual([]);
      state = given.state;
    }
    const done = press(steps, state, 67, 2200);
    expect(done).toMatchObject({ kind: 'complete', record: { step: 2, wrong: 1, given: 2 } });
    // Still the app's just after the step: E5 struck late is no wrong note of the next.
    expect(press(steps, done.state, 76, 2300).kind).toBe('given');
    // And the keys of the steps passed are the app's while the run waits past them.
    const past = press(steps, done.state, 62, 2400);
    expect(past.state.current).toBe(6);
    expect(press(steps, past.state, 84, 2500).kind).toBe('given');
    expect(press(steps, past.state, 83, 2500).kind).toBe('given');
    expect(press(steps, past.state, 81, 2500).kind).toBe('given');
    // A key that is nobody's is wrong.
    expect(press(steps, past.state, 85, 2500).kind).toBe('wrong');
  });

  it('takes the keys of an ornament on a note the app plays as neither right nor wrong', () => {
    const state = play(steps, start(), [60, 48, 64, 67, 62]).state;
    // Step 6: E3 is the player's; A5 with its mordent (G5) is the app's.
    expect(steps[6]!.ornaments!.map((o) => [o.midi, o.keys])).toEqual([[81, [79]]]);
    expect(press(steps, state, 79, 3000)).toMatchObject({
      kind: 'ornament',
      step: 6,
      principal: false,
    });
    const done = press(steps, state, 52, 3100);
    expect(done).toMatchObject({ kind: 'complete', record: { step: 6, wrong: 0, given: 1 } });
    // The ornament goes on after its step: its key and its principal are still not wrong.
    expect(press(steps, done.state, 79, 3200).kind).toBe('ornament');
    expect(press(steps, done.state, 81, 3200).kind).toBe('ornament');
  });

  it('begins after the steps passed at the start, and records them with the first step', () => {
    // From bar 3 (steps 4 and 5 are the app's): the run waits on step 6.
    const range = waitRange(steps, order, null, 2)!;
    expect(range.start).toBe(4);
    const state = startWait(steps, range)!;
    expect(state.current).toBe(6);
    expect(state.lead).toEqual([4, 5]);
    expect(state.since).toBeNull();
    const first = press(steps, state, 52, 5000);
    expect(recordsOf([first]).map((r) => [r.step, r.passed ?? false, r.ms, r.at])).toEqual([
      [4, true, 0, 5000],
      [5, true, 0, 5000],
      [6, false, 0, 5000],
    ]);
    expect(first.state.lead).toBeUndefined();
  });

  it('goes round a loop past the steps the app plays, a record for each every time round', () => {
    // Bars 2–3: steps 2 and 3 are the player's, 4 and 5 the app's.
    const range = waitRange(steps, order, { from: 1, to: 2 }, 1)!;
    expect([range.first, range.last]).toEqual([2, 5]);
    const { results, state } = play(steps, startWait(steps, range)!, [67, 62, 67, 62]);
    expect(results.map((r) => r.kind)).toEqual(['complete', 'complete', 'complete', 'complete']);
    expect(recordsOf(results).map((r) => r.step)).toEqual([2, 3, 4, 5, 2, 3, 4, 5]);
    // D4 ends the round: the run is back on the loop's first step, a lap on.
    expect(results[1]!.state).toMatchObject({ current: 2, laps: 1 });
    expect(state).toMatchObject({ current: 2, laps: 2, finished: false });
  });

  it('passes the steps of a loop before its first key on the way round, too', () => {
    // Bars 3–4: the loop begins with two steps of the app's.
    const range = waitRange(steps, order, { from: 2, to: 3 }, 2)!;
    expect([range.first, range.last]).toEqual([4, 7]);
    const { results } = play(steps, startWait(steps, range)!, [52, 60, 48, 52]);
    expect(recordsOf(results).map((r) => r.step)).toEqual([4, 5, 6, 7, 4, 5, 6]);
  });

  it('finishes with the steps passed after its last key', () => {
    // Bars 1–3 without a loop end on two steps of the app's.
    const { results, state } = play(
      steps,
      startWait(steps, { first: 0, last: 5 })!,
      [60, 48, 64, 67, 62],
    );
    expect(results.at(-1)!.kind).toBe('finished');
    expect(state.finished).toBe(true);
    expect(recordsOf(results).map((r) => r.step)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('has nothing to play where every step is the app’s', () => {
    expect(startWait(steps, { first: 4, last: 5 })).toBeNull();
    expect(startWait(steps, { first: 4, last: 5, loop: true })).toBeNull();
  });

  it('plays a repeat’s second pass as the first: the steps passed have their pass', () => {
    const repeated = keyboardScore(true);
    const repeatOrder = performanceOrder(repeated.measures);
    const list = buildSteps(repeated, 'both', repeatOrder, SMALL);
    expect(list).toHaveLength(STEPS + 4);
    const { results } = play(
      list,
      startWait(list)!,
      [60, 48, 64, 67, 62, 67, 62, 52, 60, 48, 48, 60],
    );
    expect(results.at(-1)!.kind).toBe('finished');
    expect(recordsOf(results).map((r) => [r.measure, r.pass, r.passed ?? false])).toEqual(
      list.map((s) => [s.measure, s.pass, s.midis.length === 0]),
    );
  });

  it('is as before with 88 keys: no step passed, no key the app’s', () => {
    const state = startWait(full)!;
    expect(state).toEqual({
      current: 0,
      pressed: [],
      wrong: 0,
      since: null,
      first: 0,
      last: STEPS - 1,
      loop: false,
      laps: 0,
      finished: false,
    });
    const { results } = play(
      full,
      state,
      [60, 48, 64, 67, 76, 43, 62, 84, 83, 81, 52, 60, 48, 48, 60],
    );
    expect(results.at(-1)!.kind).toBe('finished');
    expect(results.some((r) => r.kind === 'given' || 'passed' in r)).toBe(false);
    expect(recordsOf(results).every((r) => r.passed === undefined && r.given === undefined)).toBe(
      true,
    );
  });
});

describe('rhythm mode on a keyboard with fewer keys', () => {
  const plan = rhythmPlan({ score, order, steps, loop: null, startBar: 0, scale: 1 })!;
  const fullPlan = rhythmPlan({ score, order, steps: full, loop: null, startBar: 0, scale: 1 })!;

  it('has every step due at its time, with the keys the player has', () => {
    expect(plan.steps.map((s) => [s.step, s.at, s.midis, s.given])).toEqual(
      steps.map((s, i) => [i, i * 1000, s.midis, s.given]),
    );
    // The windows and the shares of the run are those of 88 keys.
    expect(plan.steps.map((s) => [s.window, s.slot])).toEqual(
      fullPlan.steps.map((s) => [s.window, s.slot]),
    );
  });

  /** Plays every key the player has `late` ms after its beat, and settles the run. */
  function run(late: number, extra: [midi: number, at: number][] = []): StepTiming[] {
    const matcher = createMatcher(plan);
    const settled: StepTiming[] = [];
    const strokes = [
      ...plan.steps.flatMap((s) => s.midis.map((midi): [number, number] => [midi, s.at + late])),
      ...extra,
    ].sort((a, b) => a[1] - b[1]);
    for (const [midi, at] of strokes) {
      settled.push(...matcher.advance(at));
      matcher.play(midi, at);
    }
    settled.push(...matcher.finish(plan.length + 500));
    return settled;
  }

  it('counts the notes the player had: the app’s are neither due nor missed', () => {
    const settled = run(20);
    expect(settled.map((t) => t.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(settled.map((t) => t.notes.map((n) => n.midi))).toEqual(steps.map((s) => s.midis));
    expect(settled.flatMap((t) => t.notes).every((n) => n.deviation === 20)).toBe(true);
    // A step with none of the player's keys settles with no note, and nothing missed.
    expect(settled[4]).toMatchObject({ notes: [], extra: 0, given: 1, measure: 2 });
    expect(settled[5]).toMatchObject({ notes: [], extra: 0, given: 1 });
    expect(settled.map((t) => t.given)).toEqual([
      undefined,
      undefined,
      2,
      undefined,
      1,
      1,
      1,
      undefined,
      undefined,
    ]);
  });

  it('takes a key the app plays, struck with its step, as neither a hit nor an extra note', () => {
    const matcher = createMatcher(plan);
    matcher.advance(1900);
    // The split chord at 2000 ms: E5 and G2 are the app's.
    expect(matcher.play(76, 2010)).toEqual({ kind: 'given', midi: 76 });
    expect(matcher.play(43, 2020)).toEqual({ kind: 'given', midi: 43 });
    expect(matcher.play(67, 2030)).toMatchObject({ kind: 'hit', step: 2, deviation: 30 });
    // On a step passed: C6 with it is the app's; a stray key there is an extra note, as anywhere.
    expect(matcher.play(84, 4010)).toEqual({ kind: 'given', midi: 84 });
    expect(matcher.play(85, 4020)).toEqual({ kind: 'extra', midi: 85 });
    // Far from its step the app's key is an extra note like any other.
    expect(matcher.play(76, 4980)).toEqual({ kind: 'extra', midi: 76 });
    const settled = matcher.finish(plan.length + 500);
    expect(settled.find((t) => t.step === 2)).toMatchObject({
      notes: [{ midi: 67, deviation: 30 }],
      extra: 0,
    });
    expect(settled.find((t) => t.step === 4)!.extra).toBe(1);
    expect(settled.find((t) => t.step === 5)!.extra).toBe(1);
  });

  it('does not count the keys of an ornament on a note the app plays', () => {
    const matcher = createMatcher(plan);
    matcher.advance(5900);
    expect(matcher.play(79, 6010)).toMatchObject({ kind: 'ornament', step: 6 });
    expect(matcher.play(52, 6000)).toMatchObject({ kind: 'hit', step: 6 });
  });

  it('goes round a loop, the steps the app plays settled every time round', () => {
    const loop = { from: 1, to: 2 };
    const looped = rhythmPlan({ score, order, steps, loop, startBar: 1, scale: 1 })!;
    expect(looped.steps.map((s) => s.step)).toEqual([2, 3, 4, 5]);
    const matcher = createMatcher(looped);
    const settled: StepTiming[] = [];
    for (let round = 0; round < 3; round++) {
      for (const s of looped.steps) {
        const due = round * looped.length + s.at;
        settled.push(...matcher.advance(due - 10));
        for (const midi of s.midis) matcher.play(midi, due);
      }
    }
    settled.push(...matcher.finish(3 * looped.length));
    expect(settled.map((t) => [t.round, t.step, t.notes.length])).toEqual([
      [0, 2, 1],
      [0, 3, 1],
      [0, 4, 0],
      [0, 5, 0],
      [1, 2, 1],
      [1, 3, 1],
      [1, 4, 0],
      [1, 5, 0],
      [2, 2, 1],
      [2, 3, 1],
      [2, 4, 0],
      [2, 5, 0],
    ]);
  });

  it('is as before with 88 keys', () => {
    expect(fullPlan.steps.every((s) => s.given === undefined)).toBe(true);
    const matcher = createMatcher(fullPlan);
    for (const s of fullPlan.steps) for (const midi of s.midis) matcher.play(midi, s.at);
    const settled = matcher.finish(fullPlan.length + 500);
    expect(settled.every((t) => t.given === undefined && t.notes.length > 0)).toBe(true);
  });
});

/** In whole ms: tempo arithmetic leaves 999.9999… where 1000 is meant. */
const whole = (n: AccompanimentNote): AccompanimentNote => ({
  ...n,
  at: Math.round(n.at),
  length: Math.round(n.length),
});

describe('what the app plays for the player', () => {
  it('is nothing with 88 keys and both hands, the other hand with one, as before', () => {
    expect(beyondKeyboard('both', FULL_KEYS)).toBeNull();
    expect(beyondKeyboard('both', null)).toBeNull();
    expect(playedForPlayer('both', true, null)).toBeNull();
    expect(playedForPlayer('right', false, null)).toBeNull();
    const other = playedForPlayer('right', true, null)!;
    expect(score.notes.filter(other).every((n) => n.hand === 'left')).toBe(true);
    expect(score.notes.filter(other)).toHaveLength(
      score.notes.filter((n) => n.hand === 'left').length,
    );
  });

  it('is the notes of the hands practised beyond the keyboard, whether or not the other hand plays', () => {
    const beyond = beyondKeyboard('both', SMALL)!;
    expect(score.notes.filter(beyond).map((n) => n.midi)).toEqual([76, 43, 84, 83, 81]);
    // The right hand alone: its own notes beyond, and with the other hand that hand whole.
    const alone = playedForPlayer('right', false, SMALL)!;
    expect(score.notes.filter(alone).map((n) => n.midi)).toEqual([76, 84, 83, 81]);
    const accompanied = playedForPlayer('right', true, SMALL)!;
    expect(
      score.notes
        .filter(accompanied)
        .map((n) => n.midi)
        .sort((a, b) => a - b),
    ).toEqual([43, 48, 48, 48, 52, 76, 81, 83, 84].sort((a, b) => a - b));
  });

  it('sounds with the step it belongs to in wait mode: with it, or after it at the tempo', () => {
    const plan = accompanimentPlan({
      score,
      order,
      steps,
      hand: null,
      include: beyondKeyboard('both', SMALL)!,
      loop: null,
      scale: 1,
    })!;
    // Only the steps the player has a key of set anything off.
    expect([...plan.steps.keys()]).toEqual([0, 1, 2, 3, 6, 7, 8]);
    // The split chord: E5 for its beat and G2 for the bar, with the step.
    expect(plan.steps.get(2)!.notes.map(whole)).toEqual([
      { midi: 43, at: 0, length: 2000, until: 2 * Q },
      { midi: 76, at: 0, length: 1000, until: Q },
    ]);
    // The steps passed (C6, then B5) belong to the step before them: a beat and two beats on.
    expect(plan.steps.get(3)!.notes.map(whole)).toEqual([
      { midi: 84, at: 1000, length: 1000, until: 2 * Q },
      { midi: 83, at: 2000, length: 1000, until: 3 * Q },
    ]);
    // A5 with its mordent, from the step it is on.
    expect(plan.steps.get(6)!.notes.map((n) => n.midi)).toEqual([81, 79, 81]);
    expect(plan.steps.get(6)!.notes[0]!.at).toBe(0);
    expect(plan.steps.get(0)!.notes).toEqual([]);
  });

  it('plays the steps passed at the start of a loop after its last step, as a lead-in', () => {
    const loop = { from: 2, to: 3 };
    const plan = accompanimentPlan({
      score,
      order,
      steps,
      hand: null,
      include: beyondKeyboard('both', SMALL)!,
      loop,
      scale: 1,
    })!;
    expect([...plan.steps.keys()]).toEqual([6, 7]);
    // After the loop's last step (bar 4, beat 2): C6 a beat on, B5 two.
    expect(plan.steps.get(7)!.notes.map((n) => [n.midi, Math.round(n.at)])).toEqual([
      [84, 1000],
      [83, 2000],
    ]);
  });

  it('is told again from the steps completed, for a run played back', () => {
    const plan = accompanimentPlan({
      score,
      order,
      steps,
      hand: null,
      include: beyondKeyboard('both', SMALL)!,
      loop: null,
      scale: 1,
    })!;
    // The player goes on to D4 half a second after the chord, then waits three seconds.
    const notes = accompanied(plan, [
      { step: 2, at: 10_000 },
      { step: 3, at: 10_500 },
      { step: 6, at: 13_500 },
    ]);
    const ms = (n: { midi: number; on: number; off: number }) => ({
      midi: n.midi,
      on: Math.round(n.on),
      off: Math.round(n.off),
    });
    expect(notes.map((n) => n.midi)).toEqual([43, 76, 84, 83, 81, 79, 81]);
    expect(Math.round(notes[4]!.on)).toBe(13_500);
    expect(notes.slice(0, 4).map(ms)).toEqual([
      // G2 lasts the bar as written, E5 is cut where the player went on.
      { midi: 43, on: 10_000, off: 12_000 },
      { midi: 76, on: 10_000, off: 10_500 },
      { midi: 84, on: 11_500, off: 12_500 },
      { midi: 83, on: 12_500, off: 13_500 },
    ]);
    // A step completed before the app's notes of the one before have started drops them.
    const hurried = accompanied(plan, [
      { step: 3, at: 20_000 },
      { step: 6, at: 20_400 },
    ]);
    expect(hurried.map((n) => n.midi)).toEqual([81, 79, 81]);
  });

  it('plays in time in rhythm mode: the demo of those notes alone', () => {
    const backing = demoPlan({
      score,
      order,
      steps,
      hands: 'both',
      loop: null,
      startBar: 0,
      scale: 1,
      include: beyondKeyboard('both', SMALL)!,
    })!;
    expect(backing.notes.map((n) => [n.midi, Math.round(n.on)])).toEqual([
      [43, 2000],
      [76, 2000],
      [84, 4000],
      [83, 5000],
      [81, 6000],
      [79, expect.any(Number)],
      [81, expect.any(Number)],
    ]);
  });
});
