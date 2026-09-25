import { describe, expect, it } from 'vitest';
import { accompanimentPlan, DEFAULT_BPM, demoPlan } from '../core/playback.ts';
import { performanceOrder } from '../core/repeats.ts';
import { buildSteps, type Hand, type Measure, type Score, type ScoreNote } from '../core/score.ts';
import { createAccompanist } from './accompany.ts';
import { createDemoPlayer, DEMO_LEAD_MS } from './demo.ts';
import type { InterruptReason } from './output.ts';
import { createScheduler, type Scheduler } from './scheduler.ts';
import { fakeClock, FakePort, type Sent } from './testing.ts';

const Q = 960;
const MSQ = 60_000 / DEFAULT_BPM;

function note(
  measure: number,
  at: number,
  duration: number,
  midi: number,
  hand: Hand,
  tie: { tieStart?: boolean; tieStop?: boolean } = {},
): ScoreNote {
  return {
    id: `${measure}-${at}-${midi}`,
    part: 0,
    measure,
    onset: measure * 4 * Q + at,
    duration,
    midi,
    pitch: { step: 'C', alter: 0, octave: 4 },
    staff: hand === 'right' ? 1 : 2,
    hand,
    voice: '1',
    tieStart: tie.tieStart ?? false,
    tieStop: tie.tieStop ?? false,
  };
}

function bars(count: number): Measure[] {
  return Array.from({ length: count }, (_, index) => ({
    index,
    number: String(index + 1),
    start: index * 4 * Q,
    duration: 4 * Q,
    beats: 4,
    beatType: 4,
    repeat: { forward: false, backwardTimes: null, ending: [] },
    jumps: [],
  }));
}

/** Right: C5 D5 E5 F5 per bar (quarters). Left: a C3 half note, then G3 tied into the next bar. */
function piece(count = 2): Score {
  const notes: ScoreNote[] = [];
  for (let m = 0; m < count; m++) {
    [72, 74, 76, 77].forEach((midi, beat) => notes.push(note(m, beat * Q, Q, midi, 'right')));
    notes.push(note(m, 0, 2 * Q, 48, 'left'));
  }
  notes.push(note(0, 2 * Q, 2 * Q, 55, 'left', { tieStart: true }));
  notes.push(note(1, 0, Q, 55, 'left', { tieStop: true }));
  notes.sort((a, b) => a.onset - b.onset || a.midi - b.midi);
  return {
    title: '',
    composer: '',
    parts: [],
    hands: {},
    measures: bars(count),
    notes,
    tempos: [],
    warnings: [],
  };
}

function setup() {
  const clock = fakeClock(1000);
  const port = new FakePort();
  const scheduler = createScheduler({ clock });
  scheduler.setPort(port);
  return { clock, port, scheduler };
}

/** Note messages only (the panic's controller resets left out). */
const notes = (sent: Sent[]) => sent.filter(({ data }) => (data[0]! & 0xe0) === 0x80);

/** Every key struck is released afterwards, in order, and never struck twice without a release. */
function expectNoStuckNotes(sent: Sent[]) {
  const down = new Map<number, number>();
  for (const { data } of notes(sent)) {
    const on = (data[0]! & 0xf0) === 0x90;
    const key = data[1]!;
    if (on) {
      expect(down.get(key) ?? 0, `key ${key} struck twice`).toBe(0);
      down.set(key, 1);
    } else {
      down.set(key, 0);
    }
  }
  expect([...down].filter(([, n]) => n > 0)).toEqual([]);
}

describe('demo player', () => {
  const s = piece();
  const order = performanceOrder(s.measures);
  const steps = buildSteps(s, 'right', order);
  const plan = (scale = 1, loop: { from: number; to: number } | null = null) =>
    demoPlan({ score: s, order, steps, hands: 'right', loop, startBar: 0, scale })!;

  it('silences first, then sends each note at its time for the tempo', () => {
    const { clock, port, scheduler } = setup();
    const player = createDemoPlayer(scheduler, clock);
    player.play(plan(0.5), 72);
    expect(port.sent.slice(0, 48).every(({ data }) => (data[0]! & 0xf0) === 0xb0)).toBe(true);
    clock.advance(20_000);
    const start = 1000 + DEMO_LEAD_MS;
    const ons = notes(port.sent).filter(({ data }) => (data[0]! & 0xf0) === 0x90);
    expect(ons.map(({ data }) => data[1])).toEqual([72, 74, 76, 77, 72, 74, 76, 77]);
    // Half the tempo: a quarter lasts twice as long.
    ons.forEach(({ time, data }, i) => {
      expect(data[2]).toBe(72);
      expect(time).toBeCloseTo(start + i * 2 * MSQ);
    });
    expect(player.getState()).toBe('stopped');
    expectNoStuckNotes(port.sent);
  });

  it('moves the cursor with the music', () => {
    const { clock, scheduler } = setup();
    const player = createDemoPlayer(scheduler, clock);
    const changes: (number | null)[] = [];
    player.subscribe(() => changes.push(player.currentStep()));
    player.play(plan(), 72);
    expect(player.currentStep()).toBe(0);
    clock.advance(DEMO_LEAD_MS + MSQ + 1);
    expect(player.currentStep()).toBe(1);
    clock.advance(2 * MSQ);
    expect(player.currentStep()).toBe(3);
    clock.advance(10 * MSQ);
    expect(player.currentStep()).toBeNull();
    expect(changes).toEqual([0, 1, 2, 3, 4, 5, 6, 7, null]);
  });

  it('pause silences and remembers the place; resume goes on from there', () => {
    const { clock, port, scheduler } = setup();
    const player = createDemoPlayer(scheduler, clock);
    player.play(plan(), 72);
    clock.advance(DEMO_LEAD_MS + 1.5 * MSQ); // in the middle of D5
    player.pause();
    expect(player.getState()).toBe('paused');
    expect(scheduler.sounding()).toEqual([]);
    expect(port.log().slice(-49, -48)).toEqual(['off 74']);
    const before = port.sent.length;
    clock.advance(5000);
    expect(port.sent.length).toBe(before);
    expect(player.currentStep()).toBe(1);

    player.resume();
    clock.advance(DEMO_LEAD_MS + 1);
    // D5 is not struck again; E5 comes half a quarter after resuming.
    const ons = port
      .log()
      .slice(before)
      .filter((l) => l.startsWith('on'));
    expect(ons).toEqual([]);
    clock.advance(MSQ / 2);
    expect(
      port
        .log()
        .slice(before)
        .filter((l) => l.startsWith('on'))[0],
    ).toMatch(/^on 76/);
    player.stop();
    expectNoStuckNotes(port.sent);
  });

  it('a new tempo while paused only takes the new plan and place, in one change', () => {
    const { clock, port, scheduler } = setup();
    const player = createDemoPlayer(scheduler, clock);
    player.play(plan(), 72);
    clock.advance(DEMO_LEAD_MS + 2.5 * MSQ);
    player.pause();
    const states: string[] = [];
    player.subscribe(() => states.push(player.getState()));
    const before = port.sent.length;
    const at = player.position()!;
    player.play(plan(0.5), 72, { round: 0, ms: at.ms * 2 }, true);
    expect(states).toEqual(['paused']);
    expect(port.sent.length).toBe(before);
    expect(player.currentStep()).toBe(2);
    player.resume();
    clock.advance(DEMO_LEAD_MS + MSQ + 1); // half a quarter at half speed
    expect(
      port
        .log()
        .slice(before)
        .filter((l) => l.startsWith('on'))[0],
    ).toMatch(/^on 77 .*@/);
    player.stop();
    expectNoStuckNotes(port.sent);
  });

  it('goes round a loop until stopped, with no stuck notes at the wrap or the stop', () => {
    const { clock, port, scheduler } = setup();
    const player = createDemoPlayer(scheduler, clock);
    const looped = plan(1, { from: 1, to: 1 });
    player.play(looped, 72);
    clock.advance(DEMO_LEAD_MS + 3 * looped.length + MSQ / 2);
    expect(player.getState()).toBe('playing');
    expect(player.position()!.round).toBe(3);
    const ons = port.log().filter((l) => l.startsWith('on'));
    expect(ons.length).toBeGreaterThanOrEqual(13);
    player.stop();
    expect(scheduler.sounding()).toEqual([]);
    expect(scheduler.pending()).toBe(0);
    const after = port.sent.length;
    clock.advance(10_000);
    expect(port.sent.length).toBe(after);
    expectNoStuckNotes(port.sent);
  });
});

describe('demo player, interrupted from outside', () => {
  const s = piece();
  const order = performanceOrder(s.measures);
  const steps = buildSteps(s, 'right', order);
  const looped = demoPlan({
    score: s,
    order,
    steps,
    hands: 'right',
    loop: { from: 0, to: 1 },
    startBar: 0,
    scale: 1,
  })!;

  function interruptible() {
    const listeners = new Set<(reason: InterruptReason) => void>();
    const onInterrupt = (listener: (reason: InterruptReason) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };
    // What the output does: silence, then tell the listeners.
    const fire = (scheduler: Scheduler, reason: InterruptReason) => {
      scheduler.panic();
      for (const listener of [...listeners]) listener(reason);
    };
    return { onInterrupt, fire, listeners };
  }

  it('a hidden page pauses the loop: nothing more is queued, and it can be resumed', () => {
    const { clock, port, scheduler } = setup();
    const { onInterrupt, fire, listeners } = interruptible();
    const player = createDemoPlayer(scheduler, clock, onInterrupt);
    player.play(looped, 72);
    clock.advance(DEMO_LEAD_MS + 5 * MSQ);
    fire(scheduler, 'hidden');
    expect(player.getState()).toBe('paused');
    const after = port.sent.length;
    clock.advance(3 * looped.length);
    expect(port.sent.length).toBe(after);
    expect(port.sent.slice(-48).every(({ data }) => (data[0]! & 0xf0) === 0xb0)).toBe(true);
    player.resume();
    clock.advance(DEMO_LEAD_MS + MSQ);
    expect(
      port
        .log()
        .slice(after)
        .some((l) => l.startsWith('on')),
    ).toBe(true);
    player.stop();
    expect(listeners.size).toBe(0);
    expectNoStuckNotes(port.sent);
  });

  it('a route change stops it, without a second panic', () => {
    const { clock, port, scheduler } = setup();
    const { onInterrupt, fire } = interruptible();
    const player = createDemoPlayer(scheduler, clock, onInterrupt);
    player.play(looped, 72);
    clock.advance(DEMO_LEAD_MS + MSQ / 2);
    fire(scheduler, 'route');
    expect(player.getState()).toBe('stopped');
    const after = port.sent.length;
    clock.advance(3 * looped.length);
    expect(port.sent.length).toBe(after);
    expectNoStuckNotes(port.sent);
  });
});

describe('accompanist', () => {
  function setupPlan(loop: { from: number; to: number } | null = null, hand: Hand = 'right') {
    const s = piece();
    const order = performanceOrder(s.measures);
    const steps = buildSteps(s, hand, order);
    const plan = accompanimentPlan({ score: s, order, steps, hand, loop, scale: 1 })!;
    return { plan, steps };
  }

  it('plays the other hand when a step is completed, with its timing', () => {
    const { clock, port, scheduler } = setup();
    const { plan } = setupPlan(null, 'left');
    const acc = createAccompanist(scheduler, clock);
    // Left step 0 (C3) brings in the right hand's C5 and D5; step 1 (G3) E5 and F5.
    acc.complete(plan, 0, 1000, 60);
    clock.advance(3 * MSQ);
    expect(port.log().map((l) => l.replace(/\.\d+/g, ''))).toEqual([
      'on 72 v60@1000',
      `off 72@${Math.trunc(1000 + MSQ)}`,
      `on 74 v60@${Math.trunc(1000 + MSQ)}`,
      `off 74@${Math.trunc(1000 + 2 * MSQ)}`,
    ]);
  });

  it('a step completed early cuts what ends there and drops what has not started', () => {
    const { clock, port, scheduler } = setup();
    const { plan } = setupPlan(null, 'left');
    const acc = createAccompanist(scheduler, clock);
    acc.complete(plan, 0, 1000, 60);
    clock.advance(100); // the player is quick: G3 after 100 ms
    acc.complete(plan, 1, clock.now(), 60);
    clock.advance(5000);
    const log = port.log();
    expect(log.filter((l) => l.startsWith('on')).map((l) => l.split(' ')[1])).toEqual([
      '72',
      '76',
      '77',
    ]);
    // C5 is released when G3 (step 1) comes, at 1100, before its written end.
    expect(log[1]).toBe('off 72@1100');
    expectNoStuckNotes(port.sent);
  });

  it('a note already on its way to the instrument when the next step comes still plays in full', () => {
    const { clock, port, scheduler } = setup();
    const { plan } = setupPlan(null, 'left');
    const acc = createAccompanist(scheduler, clock);
    acc.complete(plan, 0, 1000, 60); // C5 now, D5 one quarter later
    clock.advance(MSQ - 40); // D5 has been handed over (40 ms before it is due)
    acc.complete(plan, 1, clock.now(), 60);
    clock.advance(5000);
    const d5 = port.log().filter((l) => /^(on|off) 74\b/.test(l));
    expect(d5).toHaveLength(2);
    const [on, off] = d5.map((l) => Number(l.split('@')[1]));
    expect(off! - on!).toBeCloseTo(MSQ, 0);
    expectNoStuckNotes(port.sent);
  });

  it('a longer note sounds on under the following steps until the step where it ends; a tie is not struck again', () => {
    const { clock, port, scheduler } = setup();
    const { plan, steps } = setupPlan(null, 'right');
    const acc = createAccompanist(scheduler, clock);
    // Right hand, slowly: G3 comes with step 2 (beat 3) and is tied to beat 1 of bar 2 (+ one quarter).
    for (let i = 0; i < steps.length; i++) {
      acc.complete(plan, i, clock.now(), 60);
      clock.advance(MSQ * 0.9); // a little faster than written
    }
    clock.advance(10_000);
    const ons = port.log().filter((l) => l.startsWith('on'));
    expect(ons.map((l) => l.split(' ')[1])).toEqual(['48', '55', '48']);
    // G3 sounds until the player reaches the step where it ends (bar 2, beat 2), three steps on.
    const g = port.log().filter((l) => /^(on|off) 55\b/.test(l));
    const onAt = Number(g[0]!.split('@')[1]);
    const offAt = Number(g[1]!.split('@')[1]);
    expect(offAt - onAt).toBeCloseTo(3 * MSQ * 0.9, 0);
    expectNoStuckNotes(port.sent);
  });

  it('goes round a loop without stuck notes, the lead-in included', () => {
    const { clock, port, scheduler } = setup();
    // Practising the right hand in bar 2 only: C3 on beat 1 belongs with the right hand's C5.
    const { plan, steps } = setupPlan({ from: 1, to: 1 }, 'right');
    const acc = createAccompanist(scheduler, clock);
    const inLoop = steps.filter((s) => s.measure === 1).map((s) => s.index);
    for (let round = 0; round < 4; round++) {
      for (const step of inLoop) {
        acc.complete(plan, step, clock.now(), 60);
        clock.advance(round % 2 === 0 ? 150 : 900); // fast, then slow
      }
    }
    clock.advance(10_000);
    const ons = port.log().filter((l) => l.startsWith('on'));
    // C3 once per round; G3's tie starts outside the loop, so it is never struck.
    expect(ons.map((l) => l.split(' ')[1])).toEqual(['48', '48', '48', '48']);
    expect(scheduler.sounding()).toEqual([]);
    expectNoStuckNotes(port.sent);
  });

  it('restart: reset plus panic leaves nothing sounding or queued', () => {
    const { clock, port, scheduler } = setup();
    const { plan } = setupPlan(null, 'left');
    const acc = createAccompanist(scheduler, clock);
    acc.complete(plan, 0, 1000, 60);
    clock.advance(10);
    acc.reset();
    scheduler.panic();
    const after = port.sent.length;
    clock.advance(5000);
    expect(port.sent.length).toBe(after);
    expect(scheduler.sounding()).toEqual([]);
    expectNoStuckNotes(port.sent);
  });
});
