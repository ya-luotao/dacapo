import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type MetronomeSettings } from '../core/metronomeSettings.ts';
import type { PulseClick } from '../core/pulse.ts';
import {
  createMetronome,
  METRONOME_HIDDEN_LOOKAHEAD_MS,
  METRONOME_LEAD_MS,
  METRONOME_LOOKAHEAD_MS,
  METRONOME_TICK_MS,
  type MetronomePage,
} from './metronome.ts';
import { fakeClock, FakeAudioContext } from './testing.ts';

function fakePage() {
  const handlers = new Map<string, () => void>();
  const target = {
    addEventListener: (type: string, fn: () => void) => void handlers.set(type, fn),
    removeEventListener: (type: string) => void handlers.delete(type),
  };
  const page = {
    document: { ...target, visibilityState: 'visible' as DocumentVisibilityState },
    window: target,
  };
  return {
    page: page as unknown as MetronomePage,
    handlers,
    setHidden: (hidden: boolean) => {
      page.document.visibilityState = hidden ? 'hidden' : 'visible';
      handlers.get('visibilitychange')?.();
    },
  };
}

interface Scheduled {
  click: PulseClick;
  when: number;
  /** How far ahead of the context's time it was scheduled (ms). */
  ahead: number;
}

/** Context time 0 is performance time 10 000; the context runs with the clock. */
function setup(
  patch: Partial<MetronomeSettings> = {},
  { audio = true, delay = 0 }: { audio?: boolean; delay?: number } = {},
) {
  const clock = fakeClock(10_250);
  const context = new FakeAudioContext(10_000);
  Object.defineProperty(context, 'currentTime', { get: () => (clock.now() - 10_000) / 1000 });
  const scheduled: Scheduled[] = [];
  const saved: MetronomeSettings[] = [];
  const { page, handlers, setHidden } = fakePage();
  const metronome = createMetronome({
    clock,
    context: () => (audio ? context : null),
    settings: { ...DEFAULT_SETTINGS, ...patch },
    save: (s) => saved.push(s),
    delay: () => delay,
    page,
    onScheduled: (click, when) =>
      scheduled.push({ click, when, ahead: click.at - context.currentTime * 1000 }),
  });
  const advance = (ms: number) => clock.advance(ms);
  /** Jumps without running the timers in between, as a throttled background tab does. */
  const jump = (ms: number) => {
    clock.set(clock.now() + ms);
    clock.advance(0);
  };
  return { clock, context, metronome, scheduled, saved, advance, jump, handlers, setHidden };
}

describe('the metronome clicks on the audio clock', () => {
  it('schedules every click exactly, a short lookahead ahead, over two minutes', () => {
    const { metronome, scheduled, advance } = setup({ bpm: 120, subdivision: 2 });
    metronome.start();
    advance(120_000);
    // The first beat comes the lead after Start: context time 0.25 s + 120 ms.
    const origin = 250 + METRONOME_LEAD_MS;
    expect(scheduled[0]!.when).toBe(origin / 1000);
    expect(scheduled).toHaveLength(2 * 240);
    scheduled.forEach((s, k) => {
      expect(s.when).toBe((origin + (k * 60_000) / (120 * 2)) / 1000);
      expect(s.ahead).toBeGreaterThan(0);
      expect(s.ahead).toBeLessThanOrEqual(METRONOME_LOOKAHEAD_MS);
    });
  });

  it('changes tempo on the next beat and keeps the times exact after it', () => {
    const { metronome, scheduled, context, advance } = setup({ bpm: 240 });
    metronome.start();
    advance(60_000);
    const beforeChange = scheduled.length;
    metronome.setBpm(97);
    advance(60_000);
    const beats = scheduled.map((s) => s.when * 1000);
    // The beat under way when the tempo changed kept its length (250 ms) ...
    const boundary = beats[beforeChange]!;
    expect(boundary - beats[beforeChange - 1]!).toBeCloseTo(250, 9);
    // ... and from there on every beat is the boundary plus a whole number of 97 BPM beats.
    beats.slice(beforeChange).forEach((at, k) => {
      expect(at).toBeCloseTo(boundary + (k * 60_000) / 97, 9);
    });
    expect(context.cancelled).toBe(0);
    expect(metronome.getSnapshot().bpm).toBe(97);
  });

  it('cancels a click already scheduled past the boundary and schedules it anew', () => {
    const { metronome, scheduled, context, advance, clock } = setup({
      bpm: 120,
      subdivision: 4,
      sound: 'click',
    });
    metronome.start();
    // Just before a beat: its subdivisions within the lookahead are already scheduled.
    advance(METRONOME_LEAD_MS + 500 - 60);
    expect(clock.now()).toBeLessThan(10_250 + METRONOME_LEAD_MS + 500);
    const before = scheduled.map((s) => s.when);
    metronome.setBpm(60);
    advance(2000);
    // The next beat is the boundary: it stays where it was, and it and its subdivisions (already
    // scheduled at the old tempo) are scheduled again at the new one.
    const beat1 = (250 + METRONOME_LEAD_MS + 500) / 1000;
    const after = scheduled.slice(before.length).map((s) => Math.round((s.when - beat1) * 1000));
    expect(before.map((w) => Math.round((w - beat1) * 1000)).slice(-2)).toEqual([-125, 0]);
    expect(context.cancelled).toBe(1);
    expect(after.slice(0, 6)).toEqual([0, 250, 500, 750, 1000, 1250]);
  });

  it('keeps ticking in a hidden tab whose timers run once a second', () => {
    const { metronome, scheduled, advance, jump, setHidden } = setup({ bpm: 240 });
    metronome.start();
    advance(1000);
    setHidden(true);
    for (let i = 0; i < 20; i++) jump(1000);
    setHidden(false);
    advance(1000);
    const beats = scheduled.map((s) => s.when);
    // Not one beat missed or late: 4 a second for 22 s.
    expect(beats.length).toBeGreaterThanOrEqual(4 * 21);
    beats.forEach((when, k) => expect(when).toBe((250 + METRONOME_LEAD_MS + k * 250) / 1000));
    expect(Math.max(...scheduled.map((s) => s.ahead))).toBeLessThanOrEqual(
      METRONOME_HIDDEN_LOOKAHEAD_MS,
    );
  });

  it('survives timers slowed to once a minute (Chrome, a tab hidden for a while)', () => {
    const { metronome, scheduled, advance, jump, setHidden } = setup({ bpm: 90 });
    metronome.start();
    advance(500);
    setHidden(true);
    for (let i = 0; i < 5; i++) jump(60_000);
    const beats = scheduled.map((s) => s.when);
    expect(beats.length).toBeGreaterThanOrEqual(90 * 5);
    beats.forEach((when, k) =>
      expect(when * 1000).toBeCloseTo(250 + METRONOME_LEAD_MS + (k * 60_000) / 90, 9),
    );
  });

  it('forgets the clicks that have sounded', () => {
    const { metronome, advance } = setup({ bpm: 240, subdivision: 4 });
    metronome.start();
    advance(600_000);
    expect(metronome.pending()).toBeLessThan(30);
  });

  it('stops: what is waiting is cancelled and nothing more is scheduled', () => {
    const { metronome, scheduled, context, advance } = setup({ bpm: 120, sound: 'click' });
    metronome.start();
    advance(METRONOME_LEAD_MS + 450);
    const count = scheduled.length;
    metronome.stop();
    expect(context.cancelled).toBe(1);
    advance(3000);
    expect(scheduled).toHaveLength(count);
    expect(metronome.getSnapshot().status).toBe('stopped');
  });

  it('waits for a new context to run before it counts', () => {
    const { metronome, scheduled, context, advance } = setup();
    context.state = 'suspended';
    metronome.start();
    advance(200);
    expect(scheduled).toHaveLength(0);
    expect(context.resumed).toBeGreaterThan(0);
    context.state = 'running';
    advance(200);
    // Counted from when it ran (the next tick), not from Start.
    const first = scheduled[0]!.when - METRONOME_LEAD_MS / 1000;
    expect(first).toBeGreaterThan(0.45);
    expect(first).toBeLessThanOrEqual(0.45 + METRONOME_TICK_MS / 1000);
  });

  it('stops when the page goes away', () => {
    const { metronome, handlers } = setup();
    metronome.start();
    handlers.get('pagehide')!();
    expect(metronome.getSnapshot().status).toBe('stopped');
    expect(handlers.size).toBe(0);
  });
});

describe('settings while it plays', () => {
  it('accents the downbeat, mutes a muted beat, plays subdivisions softer', () => {
    const { metronome, context, advance } = setup({
      bpm: 60,
      sound: 'click',
      subdivision: 2,
      accents: ['accent', 'mute', 'normal', 'normal'],
    });
    metronome.start();
    advance(4000);
    expect(context.started.map((s) => s.frequency)).toEqual([1760, 990, 1320, 990, 1320, 990]);
  });

  it('plays nothing in visual-only mode, while the beat goes on', () => {
    const { metronome, scheduled, clock, advance } = setup({ bpm: 120, silent: true });
    metronome.start();
    advance(2000);
    expect(scheduled).toHaveLength(0);
    expect(metronome.position(clock.now())).toMatchObject({ beat: 3 });
    metronome.update({ silent: false });
    advance(1000);
    expect(scheduled.length).toBeGreaterThan(0);
  });

  it('changes the sound from the next click on', () => {
    const { metronome, context, advance } = setup({ bpm: 120, sound: 'click' });
    metronome.start();
    advance(1000);
    metronome.update({ sound: 'beep' });
    advance(1000);
    const freqs = context.started.map((s) => s.frequency);
    expect(freqs.slice(0, 2)).toEqual([1760, 1320]);
    expect(freqs.at(-1)).toBe(784);
  });

  it('sets the volume at once, smoothly', () => {
    const { metronome, context } = setup({ volume: 70 });
    metronome.start();
    metronome.update({ volume: 30 });
    expect(context.levels).toEqual([0.3]);
  });

  it('keeps the settings', () => {
    const { metronome, saved } = setup();
    metronome.setBpm(400);
    expect(saved.at(-1)!.bpm).toBe(300);
    metronome.update({ meter: { numerator: 3, denominator: 4 } });
    expect(saved.at(-1)!.accents).toEqual(['accent', 'normal', 'normal']);
  });

  it('nudges from the tempo asked for, not the one still heard', () => {
    const { metronome, advance } = setup({ bpm: 60 });
    metronome.start();
    advance(METRONOME_LEAD_MS + 200);
    metronome.nudge(1);
    metronome.nudge(1);
    metronome.nudge(1);
    expect(metronome.getSnapshot()).toMatchObject({ bpm: 60, target: 63 });
    expect(metronome.getSnapshot().settings.bpm).toBe(63);
    advance(1000);
    expect(metronome.getSnapshot()).toMatchObject({ bpm: 63, target: 63 });
  });

  it('taps the tempo', () => {
    const { metronome } = setup({ bpm: 80 });
    expect(metronome.tap(1000)).toBeNull();
    expect(metronome.tap(1400)).toBe(150);
    expect(metronome.getSnapshot().settings.bpm).toBe(150);
  });
});

describe('the trainer', () => {
  it('starts a ramp from its own tempo and moves the tempo heard, bar by bar', () => {
    const { metronome, clock, advance } = setup({
      bpm: 100,
      trainer: { ...DEFAULT_SETTINGS.trainer, kind: 'ramp', from: 60, to: 68, step: 4, every: 1 },
    });
    metronome.start();
    expect(metronome.getSnapshot().bpm).toBe(60);
    advance(METRONOME_LEAD_MS + 4000 + 100);
    expect(metronome.getSnapshot()).toMatchObject({ bar: 1, bpm: 64 });
    advance(60_000);
    expect(metronome.getSnapshot().bpm).toBe(68);
    expect(metronome.position(clock.now())!.bpm).toBe(68);
    // The tempo set by hand is untouched.
    expect(metronome.getSnapshot().settings.bpm).toBe(100);
  });

  it('gap: silent bars are not played, and the snapshot says so', () => {
    const { metronome, scheduled, advance } = setup({
      bpm: 240,
      trainer: { ...DEFAULT_SETTINGS.trainer, kind: 'gap', play: 1, mute: 1 },
    });
    metronome.start();
    advance(METRONOME_LEAD_MS + 1000 + 100);
    expect(metronome.getSnapshot()).toMatchObject({ bar: 1, silentBar: true });
    advance(4000);
    expect([...new Set(scheduled.map((s) => s.click.bar))]).toEqual([0, 2, 4]);
  });
});

describe('the tempo shown before Start is the tempo Start plays', () => {
  it('with a ramp: its own start', () => {
    const { metronome } = setup({
      bpm: 80,
      trainer: { ...DEFAULT_SETTINGS.trainer, kind: 'ramp', from: 60, to: 100 },
    });
    expect(metronome.getSnapshot()).toMatchObject({ bpm: 60, target: 60 });
  });

  it('with a ramp, a tempo set by hand becomes its start, stopped or playing', () => {
    const ramp = { ...DEFAULT_SETTINGS.trainer, kind: 'ramp' as const, from: 60, to: 100 };
    const { metronome, advance } = setup({ bpm: 80, trainer: ramp });
    metronome.setBpm(72);
    expect(metronome.getSnapshot()).toMatchObject({ bpm: 72, target: 72 });
    expect(metronome.getSnapshot().settings.trainer.from).toBe(72);
    metronome.start();
    advance(1000);
    metronome.setBpm(90);
    metronome.stop();
    metronome.start();
    expect(metronome.getSnapshot()).toMatchObject({ bpm: 90, target: 90 });
  });

  it('switching a ramp on while it plays starts it from its own tempo, on the next beat', () => {
    const { metronome, advance } = setup({ bpm: 120 });
    metronome.start();
    advance(1000);
    metronome.update({
      trainer: { ...DEFAULT_SETTINGS.trainer, kind: 'ramp', from: 60, to: 100, step: 5, every: 1 },
    });
    expect(metronome.getSnapshot()).toMatchObject({ bpm: 120, target: 60 });
    advance(1000);
    expect(metronome.getSnapshot().bpm).toBe(60);
  });
});

describe('rhythm mode comes first', () => {
  it('pauses the metronome, says why, and keeps it from starting until released', () => {
    const { metronome, context, advance } = setup({ bpm: 120 });
    metronome.start();
    advance(1000);
    const release = metronome.block('rhythm');
    expect(metronome.getSnapshot()).toMatchObject({
      status: 'paused',
      pausedBy: 'rhythm',
      blockedBy: 'rhythm',
    });
    expect(context.cancelled).toBeGreaterThanOrEqual(0);
    metronome.start();
    expect(metronome.getSnapshot().status).toBe('paused');
    release();
    release();
    expect(metronome.getSnapshot()).toMatchObject({ status: 'paused', blockedBy: null });
    metronome.start();
    expect(metronome.getSnapshot()).toMatchObject({ status: 'running', pausedBy: null });
  });

  it('resumes a ramp at the tempo it had reached', () => {
    const { metronome, advance } = setup({
      trainer: { ...DEFAULT_SETTINGS.trainer, kind: 'ramp', from: 60, to: 100, step: 10, every: 1 },
    });
    metronome.start();
    advance(METRONOME_LEAD_MS + 4000 + 100);
    expect(metronome.getSnapshot().bpm).toBe(70);
    metronome.block('calibration')();
    metronome.start();
    expect(metronome.getSnapshot().bpm).toBe(70);
    // A stop forgets it: the next start is the ramp's own.
    metronome.stop();
    metronome.start();
    expect(metronome.getSnapshot().bpm).toBe(60);
  });

  it('starts at a tempo set while paused', () => {
    const { metronome, advance } = setup({ bpm: 100 });
    metronome.start();
    advance(1000);
    metronome.block('rhythm')();
    metronome.setBpm(72);
    metronome.start();
    expect(metronome.getSnapshot()).toMatchObject({ bpm: 72, target: 72 });
  });

  it('a block on a stopped metronome only keeps it from starting', () => {
    const { metronome } = setup();
    const release = metronome.block('rhythm');
    expect(metronome.getSnapshot()).toMatchObject({ status: 'stopped', blockedBy: 'rhythm' });
    metronome.toggle();
    expect(metronome.getSnapshot().status).toBe('stopped');
    release();
    metronome.toggle();
    expect(metronome.getSnapshot().status).toBe('running');
  });
});

describe('what is heard when', () => {
  it('draws the beat when it reaches the speakers, then the calibrated delay later', () => {
    const latency = 40;
    const delay = 25;
    const { metronome, context, clock, advance, scheduled } = setup({ bpm: 120 }, { delay });
    // The output runs 40 ms behind the context's clock.
    context.getOutputTimestamp = () => ({
      contextTime: context.currentTime,
      performanceTime: 10_000 + context.currentTime * 1000 + latency,
    });
    metronome.start();
    advance(2000);
    const beat = scheduled[2]!;
    const heard = 10_000 + beat.when * 1000 + latency + delay;
    expect(metronome.position(heard)).toMatchObject({ beat: 2, phase: 0 });
    expect(metronome.position(heard - 1)).toMatchObject({ beat: 1 });
    expect(metronome.position(heard + 125)!.phase).toBeCloseTo(0.25, 9);
    expect(clock.now()).toBeGreaterThan(heard);
  });

  it('falls back on the reported latencies before the context gives timestamps', () => {
    const { metronome, context, advance, scheduled } = setup({ bpm: 120 });
    context.outputLatency = 0.03;
    context.baseLatency = 0.005;
    context.getOutputTimestamp = () => ({ contextTime: 0, performanceTime: 0 });
    metronome.start();
    advance(1000);
    const heard = 10_000 + scheduled[1]!.when * 1000 + 35;
    expect(metronome.position(heard)!.beat).toBe(1);
    expect(metronome.position(heard)!.phase).toBeCloseTo(0, 6);
  });

  it('without Web Audio runs the animation on its own clock', () => {
    const { metronome, clock, advance } = setup({ bpm: 60 }, { audio: false });
    metronome.start();
    expect(metronome.getSnapshot()).toMatchObject({ status: 'running', audio: false });
    advance(METRONOME_LEAD_MS + 2500);
    expect(metronome.position(clock.now())).toMatchObject({ beat: 2 });
    expect(metronome.position(clock.now())!.phase).toBeCloseTo(0.5, 6);
  });

  it('is null when not running', () => {
    const { metronome, clock } = setup();
    expect(metronome.position(clock.now())).toBeNull();
  });
});
