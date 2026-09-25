import { describe, expect, it } from 'vitest';
import { sampleHeader, sampleRhythmStep, T0 } from '../storage/fixtures.ts';
import { pieceSession, rhythmCounts } from './pieceRecords.ts';
import type { StepTiming } from './rhythm.ts';
import { IN_TIME_MS, summarizeRhythm } from './rhythmRun.ts';

/** Quarter notes at ♩ = 90, four per bar, over `bars` bars; `dev(n)` per note (null: missed). */
function timings(bars: number, dev: (n: number) => number | null, rounds = 1): StepTiming[] {
  const out: StepTiming[] = [];
  for (let round = 0; round < rounds; round++) {
    for (let n = 0; n < bars * 4; n++) {
      const played = Math.floor(n / 4);
      const i = round * bars * 4 + n;
      out.push({
        step: n,
        round,
        measure: played,
        pass: 1,
        played,
        due: i * 667,
        slot: 667,
        notes: [{ midi: 60, deviation: dev(i) }],
        extra: 0,
      });
    }
  }
  return out;
}

describe('summarizeRhythm', () => {
  it('counts hits, notes within ±50 ms, missed and extra notes', () => {
    const list = timings(2, (n) => [0, 49, 50, 51, -50, -51, null, 120][n % 8]!);
    list[3]!.extra = 2;
    const s = summarizeRhythm(list);
    expect(s).toMatchObject({ notes: 8, hits: 7, missed: 1, extra: 2, rounds: 1 });
    expect(s.inTime).toBe(4); // 0, 49, 50, −50
    expect(IN_TIME_MS).toBe(50);
  });

  it('reports the tendency: late by a steady 40 ms, unmoved by a slip', () => {
    const late = summarizeRhythm(timings(4, (n) => (n === 5 ? -140 : n === 9 ? null : 40)));
    expect(late.tendency).toBe(40);
    expect(late.drift).toEqual([]);
    const early = summarizeRhythm(timings(4, () => -25));
    expect(early.tendency).toBe(-25);
    expect(summarizeRhythm(timings(1, () => null)).tendency).toBeNull();
  });

  it('names the bars where the player sped up, with the rounds of a loop', () => {
    // Bars 9–12 of 16 rush from 0 to −60 ms.
    const rush = summarizeRhythm(
      timings(16, (n) => (n >= 32 && n < 48 ? (-60 * (n - 32)) / 15 : 0)),
    );
    expect(rush.drift).toEqual([
      {
        direction: 'faster',
        from: { measure: 8, round: 0 },
        to: { measure: 11, round: 0 },
        fromTime: 32 * 667,
        toTime: 47 * 667,
        change: -60,
      },
    ]);
    // A four-bar loop played four times, dragging in the third time round.
    const loop = summarizeRhythm(
      timings(4, (n) => (n >= 32 && n < 48 ? 5 * (n - 32) : n >= 48 ? 75 : 0), 4),
    );
    expect(loop.rounds).toBe(4);
    expect(loop.drift[0]).toMatchObject({
      direction: 'slower',
      from: { measure: 0, round: 2 },
      to: { measure: 3, round: 2 },
    });
  });

  it('lays out every note for the chart, from the first due', () => {
    const list = timings(1, (n) => (n === 2 ? null : n * 10));
    list.forEach((t) => (t.due += 5000));
    expect(summarizeRhythm(list).timeline.map((n) => [n.time, n.deviation])).toEqual([
      [0, 0],
      [667, 10],
      [1334, null],
      [2001, 30],
    ]);
  });
});

describe('rhythm sessions', () => {
  it('count notes, hits and notes in time; time is the steps’ share of the run', () => {
    const steps = Array.from({ length: 10 }, (_, n) => sampleRhythmStep('r1', n));
    expect(rhythmCounts(steps)).toEqual({
      notes: 20,
      hits: 18,
      inTime: steps
        .flatMap((s) => s.notes!)
        .filter((n) => n.deviation !== null && Math.abs(n.deviation) <= 50).length,
    });
    const session = pieceSession(sampleHeader('r1', { mode: 'rhythm' }), steps, true);
    expect(session).toMatchObject({
      mode: 'rhythm',
      activeMs: 6670,
      steps: 10,
      wrong: 1,
      endedAt: T0 + 9 * 667 + 667,
      rhythm: { notes: 20, hits: 18 },
    });
  });
});
