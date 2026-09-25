import { describe, expect, it } from 'vitest';
import { performanceOrder } from './repeats.ts';
import {
  createMatcher,
  matchWindow,
  MAX_WINDOW_MS,
  MIN_WINDOW_MS,
  rhythmPlan,
  type RhythmPlan,
  type StepTiming,
} from './rhythm.ts';
import { buildSteps, type Score } from './score.ts';
import { bars, note, Q, quarters, score } from './scoreFixtures.ts';

function planOf(
  s: Score,
  options: { loop?: { from: number; to: number } | null; startBar?: number; scale?: number } = {},
): RhythmPlan {
  const order = performanceOrder(s.measures);
  return rhythmPlan({
    score: s,
    order,
    steps: buildSteps(s, 'right', order),
    loop: options.loop ?? null,
    startBar: options.startBar ?? 0,
    scale: options.scale ?? 1,
  })!;
}

/** ♩ = 60: a quarter is 1 s. */
const slow = (count: number, keys?: number[]) =>
  score(bars(count), quarters(count, keys), [{ tick: 0, bpm: 60 }]);

const brief = (t: StepTiming) =>
  `${t.step}@${t.due}:${t.notes.map((n) => `${n.midi}${n.deviation === null ? '×' : n.deviation >= 0 ? `+${n.deviation}` : n.deviation}`).join(',')}${t.extra ? ` +${t.extra}x` : ''}`;

describe('matchWindow', () => {
  it('is half the gap to the nearer step, capped at 150 ms, at least 40 ms', () => {
    expect(matchWindow(200, 400)).toBe(100);
    expect(matchWindow(1000, 1000)).toBe(MAX_WINDOW_MS);
    expect(matchWindow(50, 1000)).toBe(MIN_WINDOW_MS);
    expect(matchWindow(Infinity, 250)).toBe(125);
  });
});

describe('rhythmPlan', () => {
  it('times the steps, their windows and slots at the tempo', () => {
    // Quarters, then two eighths, then a half note.
    const s = score(
      bars(1),
      [
        note(0, 0, Q, 60),
        note(0, Q, Q / 2, 62),
        note(0, 1.5 * Q, Q / 2, 64),
        note(0, 2 * Q, 2 * Q, 65),
      ],
      [{ tick: 0, bpm: 120 }],
    );
    const plan = planOf(s);
    expect(plan.steps.map((t) => [t.at, t.window, t.slot])).toEqual([
      [0, MAX_WINDOW_MS, 500], // 500 ms to the next: half is 250, capped
      [500, 125, 250], // an eighth (250 ms) on the right
      [750, 125, 250],
      [1000, 125, 1000], // the last step: its slot runs to the end of the span
    ]);
    expect(plan.length).toBe(2000);
    expect(plan.clicks).toHaveLength(4);
    expect(plan.countIn.map((c) => c.at)).toEqual([-2000, -1500, -1000, -500]);
  });

  it('scales the windows with the tempo', () => {
    const eighths = score(
      bars(1),
      Array.from({ length: 8 }, (_, i) => note(0, (i * Q) / 2, Q / 2, 60 + i)),
      [{ tick: 0, bpm: 120 }],
    );
    // 250 ms apart at 100 %, 125 at 200 %, 625 at 40 %.
    expect(planOf(eighths).steps[3]!.window).toBe(125);
    expect(planOf(eighths, { scale: 2 }).steps[3]!.window).toBe(62.5);
    expect(planOf(eighths, { scale: 0.4 }).steps[3]!.window).toBe(MAX_WINDOW_MS);
  });

  it('a loop measures the gaps across its wrap; a start bar begins the first round there', () => {
    const s = score(
      bars(2),
      [note(0, 0, Q, 60), note(1, 4 * Q + 3.5 * Q, Q / 2, 62)],
      [{ tick: 0, bpm: 60 }],
    );
    const looped = planOf(s, { loop: { from: 0, to: 1 } });
    // The eighth at 7.5 s is 0.5 s before the wrap to the note at 0 (8 s): window 150 → 150,
    // and the first note is 0.5 s after the last one of the previous round.
    expect(looped.steps.map((t) => [t.at, t.window, t.slot])).toEqual([
      [0, 150, 7500],
      [7500, 150, 500],
    ]);
    expect(planOf(s, { startBar: 1 }).start).toBe(4000);
  });
});

describe('createMatcher', () => {
  it('matches each note to its step by key, with its deviation', () => {
    const matcher = createMatcher(planOf(slow(1, [60, 62, 64, 65])));
    expect(matcher.play(60, 30)).toEqual({
      kind: 'hit',
      step: 0,
      round: 0,
      midi: 60,
      deviation: 30,
    });
    expect(matcher.play(62, 960)).toMatchObject({ kind: 'hit', deviation: -40 });
    expect(matcher.play(64, 2000)).toMatchObject({ kind: 'hit', deviation: 0 });
    expect(matcher.play(61, 2500)).toEqual({ kind: 'extra', midi: 61 });
    expect(matcher.advance(3100).map(brief)).toEqual([
      '0@0:60+30',
      '1@1000:62-40',
      '2@2000:64+0 +1x', // the extra is nearer to beat 3 than to beat 4
    ]);
    // Nothing on beat 4: missed once its window has closed.
    expect(matcher.advance(4000).map(brief)).toEqual(['3@3000:65×']);
    expect(matcher.done()).toBe(true);
  });

  it('a note inside the window matches, a note just outside is an extra and the key is missed', () => {
    const plan = planOf(slow(1));
    const window = plan.steps[1]!.window;
    expect(window).toBe(MAX_WINDOW_MS);
    const inside = createMatcher(plan);
    expect(inside.play(60, 1000 + window - 1)).toMatchObject({
      kind: 'hit',
      deviation: window - 1,
    });
    expect(inside.play(60, 2000 - window + 1)).toMatchObject({
      kind: 'hit',
      deviation: -window + 1,
    });
    // The edge itself is inside.
    expect(inside.play(60, 3000 + window)).toMatchObject({ kind: 'hit', deviation: window });

    const outside = createMatcher(plan);
    expect(outside.play(60, 1000 + window + 1)).toEqual({ kind: 'extra', midi: 60 });
    expect(outside.play(60, 2000 - window - 1)).toEqual({ kind: 'extra', midi: 60 });
    expect(outside.advance(2600).map(brief)).toEqual([
      '0@0:60×',
      '1@1000:60× +1x',
      '2@2000:60× +1x',
    ]);
  });

  it('matches each key of a chord on its own; a wrong key of a chord is an extra', () => {
    const s = score(
      bars(1),
      [note(0, 0, 4 * Q, 60), note(0, 0, 4 * Q, 64), note(0, 0, 4 * Q, 67)],
      [{ tick: 0, bpm: 60 }],
    );
    const matcher = createMatcher(planOf(s));
    matcher.play(64, -20);
    matcher.play(60, 10);
    matcher.play(66, 15);
    expect(matcher.finish(5000).map(brief)).toEqual(['0@0:60+10,64-20,67× +1x']);
  });

  it('where windows overlap (the 40 ms floor), a note goes to the nearer due key', () => {
    // The same key 60 ms apart at ♩ = 250: both windows are 40 ms.
    const fast = score(
      bars(1),
      Array.from({ length: 4 }, (_, i) => note(0, (i * Q) / 4, Q / 4, 60)),
      [{ tick: 0, bpm: 250 }],
    );
    const plan = planOf(fast);
    expect(plan.steps.map((t) => [t.at, t.window])).toEqual([
      [0, 40],
      [60, 40],
      [120, 40],
      [180, 40],
    ]);
    const matcher = createMatcher(plan);
    expect(matcher.play(60, 35)).toMatchObject({ kind: 'hit', step: 1, deviation: -25 });
  });

  it('a key struck twice: the first stroke counts, the second is an extra', () => {
    const matcher = createMatcher(planOf(slow(1)));
    matcher.play(60, 10);
    expect(matcher.play(60, 40)).toEqual({ kind: 'extra', midi: 60 });
    expect(matcher.advance(600).map(brief)).toEqual(['0@0:60+10 +1x']);
  });

  it('ignores notes before the first window (the count-in) and after the end', () => {
    const matcher = createMatcher(planOf(slow(1)));
    expect(matcher.play(60, -2000)).toEqual({ kind: 'ignored' });
    expect(matcher.play(60, -MAX_WINDOW_MS - 1)).toEqual({ kind: 'ignored' });
    expect(matcher.play(60, -MAX_WINDOW_MS)).toMatchObject({ kind: 'hit' });
    matcher.advance(10_000);
    expect(matcher.play(60, 10_000)).toEqual({ kind: 'ignored' });
  });

  it('goes round a loop: rounds due at round × length, the wrap judged like any gap', () => {
    const plan = planOf(slow(1, [60, 62, 64, 65]), { loop: { from: 0, to: 0 } });
    const matcher = createMatcher(plan);
    for (const round of [0, 1, 2]) {
      [60, 62, 64, 65].forEach((midi, i) => matcher.play(midi, round * 4000 + i * 1000 + 20));
    }
    // A note 100 ms early for round 3's first beat, played at the end of round 2.
    expect(matcher.play(60, 12_000 - 100)).toMatchObject({
      kind: 'hit',
      round: 3,
      deviation: -100,
    });
    const settled = matcher.advance(12_600);
    expect(settled).toHaveLength(13);
    expect(settled.map((t) => [t.round, t.due])).toEqual([
      [0, 0],
      [0, 1000],
      [0, 2000],
      [0, 3000],
      [1, 4000],
      [1, 5000],
      [1, 6000],
      [1, 7000],
      [2, 8000],
      [2, 9000],
      [2, 10_000],
      [2, 11_000],
      [3, 12_000],
    ]);
    expect(settled.every((t) => t.notes[0]!.deviation !== null)).toBe(true);
    expect(matcher.done()).toBe(false);
  });

  it('starts at the start bar, and a loop goes on from its first bar', () => {
    const plan = planOf(slow(2), { loop: { from: 0, to: 1 }, startBar: 1 });
    const matcher = createMatcher(plan);
    matcher.play(60, 4000);
    matcher.play(60, 8000);
    const settled = matcher.advance(8600);
    expect(settled.map((t) => `${t.round}:${t.measure}@${t.due}`)).toEqual([
      '0:1@4000',
      '0:1@5000',
      '0:1@6000',
      '0:1@7000',
      '1:0@8000',
    ]);
  });

  it('finish settles what was due and drops what was still to come', () => {
    const matcher = createMatcher(planOf(slow(1)));
    matcher.play(60, 5);
    // Stopped 50 ms after beat 2 was due, without it being played: its window is still open.
    const settled = matcher.finish(1050);
    expect(settled.map(brief)).toEqual(['0@0:60+5']);
    expect(matcher.done()).toBe(true);
    const played = createMatcher(planOf(slow(1)));
    played.play(60, 0);
    played.play(60, 1010);
    expect(played.finish(1050).map(brief)).toEqual(['0@0:60+0', '1@1000:60+10']);
  });
});
