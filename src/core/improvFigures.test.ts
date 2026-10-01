import { describe, expect, it } from 'vitest';
import { IDLE_MS } from './activity.ts';
import { improvPlan, type ImprovSpec } from './improv.ts';
import {
  improvFigures,
  improvSession,
  playedNotes,
  readFigures,
  repeatedNotes,
  sessionSpec,
} from './improvFigures.ts';
import type { TakeEvent } from './takes.ts';

const spec = (patch: Partial<ImprovSpec> = {}): ImprovSpec => ({
  backing: 'blues',
  key: 'C',
  scale: 'blues',
  pattern: 'shuffle',
  feel: 'straight',
  bpm: 120,
  call: false,
  seed: 1,
  ...patch,
});

/** Keys as `[midi, on, off]` (ms from time 0): a take's events in order. */
function take(notes: [number, number, number][], extra: TakeEvent[] = []): TakeEvent[] {
  const events: TakeEvent[] = [
    ...notes.flatMap(([midi, on, off]): TakeEvent[] => [
      [on, 1, midi, 70, -1],
      [off, 0, midi],
    ]),
    ...extra,
  ];
  return events.sort((a, b) => a[0]! - b[0]!);
}

describe('improvisation figures', () => {
  // C blues at 120: a bar is 2000 ms, a beat 500, a sixteenth 125.
  const plan = improvPlan(spec());
  const notes: [number, number, number][] = [
    [64, 0, 400], // E over C7, on the 1: a chord tone
    [63, 500, 900], // E♭, the blue third: the scale
    [69, 1000, 1400], // A, on the 3: outside
    [67, 1500, 1900], // G: a chord tone
    [72, 2000, 2400], // C, the next bar's 1
  ];

  it('counts how each note was heard, on the strong beats, its range and its silence', () => {
    const figures = improvFigures(plan, take(notes), 4000);
    expect(figures).toMatchObject({
      ms: 4000,
      notes: 5,
      chord: 3,
      scale: 1,
      outside: 1,
      strong: 3,
      strongChord: 2,
      low: 63,
      high: 72,
      playerMs: 4000,
      soundMs: 2000,
      melody: 5,
      repeated: 0,
      calls: 0,
      answered: 0,
    });
    expect(figures.byBar).toHaveLength(12);
    expect(figures.byBar.slice(0, 3)).toEqual([
      [2, 4],
      [1, 1],
      [0, 0],
    ]);
    expect(readFigures(figures, plan.barMs)).toEqual({
      strongChord: 2 / 3,
      chord: 3 / 5,
      scale: 1 / 5,
      outside: 1 / 5,
      notesPerBar: 2.5,
      silence: 0.5,
      repeated: 0,
      bars: 2,
    });
  });

  it('hears the pedal hold a note on after its key is let go', () => {
    const pedalled = improvFigures(
      plan,
      take(
        [[64, 0, 400]],
        [
          [300, 64, 127],
          [1800, 64, 0],
        ],
      ),
      2000,
    );
    expect(pedalled.soundMs).toBe(1800);
    // A key still held at the stop sounds to the stop.
    expect(improvFigures(plan, [[1000, 1, 60, 70, -1]], 2000).soundMs).toBe(1000);
  });

  it('plays a take back as it sounded: the pedal in the lengths, a key struck again cut', () => {
    const events: TakeEvent[] = [
      [100, 1, 60, 80, -1],
      [300, 64, 127],
      [400, 0, 60],
      [600, 1, 64, 50, -1],
      [700, 0, 64],
      [900, 1, 60, 70, -1],
      [1000, 0, 60],
      [1200, 64, 0],
      [1500, 1, 67, 60, -1],
    ];
    expect(playedNotes(events, 20, 2000)).toEqual([
      { midi: 60, velocity: 80, on: 80, off: 880 },
      { midi: 64, velocity: 50, on: 580, off: 1180 },
      { midi: 60, velocity: 70, on: 880, off: 1180 },
      { midi: 67, velocity: 60, on: 1480, off: 2000 },
    ]);
  });

  it('takes the latency off every time', () => {
    const late = take(notes.map(([m, on, off]) => [m, on + 40, off + 40]));
    const figures = improvFigures(plan, late, 4000, 40);
    expect(figures).toEqual(improvFigures(plan, take(notes), 4000));
  });

  it('counts a note a sixteenth early with the bar it leads into, and none before', () => {
    const figures = improvFigures(
      plan,
      take([
        [60, -400, -300], // in the count-in: not counted
        [64, -100, 300], // a sixteenth early for the first 1
        [69, 8000 - 80, 8100], // A just before bar 5's F7: its third, on the 1
      ]),
      10_000,
    );
    expect(figures.notes).toBe(2);
    expect(figures.strong).toBe(2);
    expect(figures.strongChord).toBe(2);
    expect(figures.byBar[0]).toEqual([1, 1]);
    expect(figures.byBar[4]).toEqual([1, 1]);
  });

  it('with call and response, counts the answers only, and the calls answered', () => {
    const called = improvPlan(spec({ call: true }));
    // Five bars: the call (0–1), the answer (2–3), the next call (4) whose answer never came.
    const figures = improvFigures(
      called,
      take([
        [70, 1000, 1500], // over the call: not the player's turn
        [64, 4000, 4500],
        [67, 5000, 5500],
      ]),
      10_000,
    );
    expect(figures.notes).toBe(2);
    expect(figures.playerMs).toBe(4000);
    expect(figures.soundMs).toBe(1000);
    expect(figures.calls).toBe(1);
    expect(figures.answered).toBe(1);
    const unanswered = improvFigures(called, take([[70, 1000, 1500]]), 12_500);
    expect(unanswered.calls).toBe(2);
    expect(unanswered.answered).toBe(0);
    expect(unanswered.playerMs).toBe(4000 + 500);
  });

  it('finds the figures played again, at any pitch, the top of a chord being the melody', () => {
    expect(
      repeatedNotes([60, 62, 64, 60, 65, 67, 69, 65].map((midi, i) => ({ midi, at: i * 250 }))),
    ).toEqual({
      melody: 8,
      repeated: 4,
    });
    // Struck together: one note of the melody, the top one.
    expect(
      repeatedNotes([
        { midi: 48, at: 0 },
        { midi: 60, at: 10 },
        { midi: 62, at: 300 },
      ]),
    ).toEqual({ melody: 2, repeated: 0 });
    // A riff played three times: all but its first time.
    const riff = [60, 63, 65, 66, 67];
    const three = [...riff, ...riff, ...riff].map((midi, i) => ({ midi, at: i * 200 }));
    const { melody, repeated } = repeatedNotes(three);
    expect(melody).toBe(15);
    expect(repeated).toBe(10);
  });
});

describe('the session', () => {
  const plan = improvPlan(spec({ call: true, seed: 99 }));
  const base = {
    id: 'i1',
    spec: plan.spec,
    click: true,
    startedAt: 1_700_000_000_000,
    zero: 1_700_000_002_200,
    latency: 0,
  };

  it('is recorded with its backing, its figures and its time', () => {
    const session = improvSession(plan, {
      ...base,
      endedAt: base.zero + 10_000,
      events: take([
        [64, 4000, 4500],
        [67, 5000, 5500],
      ]),
    })!;
    expect(session).toMatchObject({
      kind: 'improv',
      id: 'i1',
      startedAt: base.startedAt,
      endedAt: base.zero + 10_000,
      activeMs: 12_200,
      backing: 'blues',
      key: 'C',
      scale: 'blues',
      pattern: 'shuffle',
      feel: 'straight',
      bpm: 120,
      click: true,
      call: true,
      seed: 99,
    });
    expect(session.figures.notes).toBe(2);
    expect(sessionSpec(session)).toEqual(plan.spec);
  });

  it('counts a long silence as a pause, and nothing played as no session', () => {
    const session = improvSession(plan, {
      ...base,
      endedAt: base.zero + 300_000,
      events: take([[64, 4000, 4500]]),
    })!;
    expect(session.activeMs).toBe(6200 + IDLE_MS);
    expect(improvSession(plan, { ...base, endedAt: base.zero + 8000, events: [] })).toBeNull();
    // Keys in the count-in only: nothing was played over the backing.
    expect(
      improvSession(plan, {
        ...base,
        endedAt: base.zero + 8000,
        events: take([[60, -1500, -1000]]),
      }),
    ).toBeNull();
  });
});
