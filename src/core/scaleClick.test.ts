// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './musicxml.ts';
import { summarizeRhythm } from './rhythmRun.ts';
import {
  clickTimings,
  isClickTempo,
  isNotesPerBeat,
  scaleRhythmPlan,
  type NotesPerBeat,
} from './scaleClick.ts';
import { scaleNotes } from './scales.ts';
import type { ScaleExercise } from './scaleTypes.ts';
import { scaleHands, scaleMusicXml } from './scaleXml.ts';

function planOf(e: ScaleExercise, bpm: number, perBeat: NotesPerBeat) {
  const xml = scaleMusicXml(e, { notesPerBeat: perBeat });
  const score = parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
    hands: scaleHands(e),
  });
  return scaleRhythmPlan(score, e.hands, bpm)!;
}

const C_ONE: ScaleExercise = { type: 'major', tonic: 'C', octaves: 1, hands: 'right' };
const C_MIDIS = scaleNotes(C_ONE).right.map((n) => n.midi);

describe('the scale in time', () => {
  it('puts each note on the grid: 4 to the beat at ♩ = 60 is a note every 250 ms', () => {
    const plan = planOf(C_ONE, 60, 4);
    expect(plan.steps.map((s) => s.at)).toEqual(C_MIDIS.map((_, i) => i * 250));
    expect(plan.steps.map((s) => s.midis)).toEqual(C_MIDIS.map((m) => [m]));
    // A click on every beat, the bar's first accented; the last note fills its beat.
    expect(plan.clicks.map((c) => c.at)).toEqual([0, 1000, 2000, 3000]);
    expect(plan.clicks.map((c) => c.accent)).toEqual([true, false, false, false]);
    expect(plan.length).toBe(4000);
    // One bar of count-in, four clicks, ending where the first note is due.
    expect(plan.countIn.map((c) => c.at)).toEqual([-4000, -3000, -2000, -1000]);
  });

  it('plays 2 notes to the beat as eighths and 3 as triplets', () => {
    expect(planOf(C_ONE, 90, 2).steps[3]!.at).toBeCloseTo((3 * 60_000) / 90 / 2, 3);
    const triplets = planOf(C_ONE, 80, 3);
    expect(triplets.steps[3]!.at).toBeCloseTo(750, 3);
    expect(triplets.steps[4]!.at).toBeCloseTo(1000, 3);
  });

  it('asks for both keys of a place together, hands together', () => {
    const plan = planOf({ ...C_ONE, hands: 'both' }, 60, 4);
    expect(plan.steps[0]!.midis).toEqual([48, 60]);
    expect(plan.steps).toHaveLength(15);
  });
});

describe('the run against the click', () => {
  const keys = (late: number, jitter: (i: number) => number = () => 0) =>
    C_MIDIS.map((midi, i) => ({ midi, on: i * 250 + jitter(i) + late }));

  it('reads a run 20 ms late throughout as 20 ms late, and on the beat with that latency', () => {
    const plan = planOf(C_ONE, 60, 4);
    // The first key 20 ms after it was due: the grid's zero is 20 ms before the run's clock.
    const late = summarizeRhythm(
      clickTimings(plan, keys(0), { zero: -20, latency: 0, stoppedAt: null }),
    );
    expect(late).toMatchObject({ notes: 15, hits: 15, missed: 0, extra: 0, inTime: 15 });
    expect(late.tendency).toBeCloseTo(20, 6);
    const calibrated = summarizeRhythm(
      clickTimings(plan, keys(0), { zero: -20, latency: 20, stoppedAt: null }),
    );
    expect(calibrated.tendency).toBeCloseTo(0, 6);
  });

  it('counts a note never played as missed and a stray key as extra', () => {
    const plan = planOf(C_ONE, 60, 4);
    const played = keys(0).filter((_, i) => i !== 5);
    played.splice(8, 0, { midi: 61, on: 8 * 250 + 110 });
    const summary = summarizeRhythm(
      clickTimings(plan, played, { zero: 0, latency: 0, stoppedAt: null }),
    );
    expect(summary).toMatchObject({ notes: 15, hits: 14, missed: 1, extra: 1 });
  });

  it('drops the notes not yet due when the run was stopped', () => {
    const plan = planOf(C_ONE, 60, 4);
    const summary = summarizeRhythm(
      clickTimings(plan, keys(0).slice(0, 6), { zero: 0, latency: 0, stoppedAt: 6 * 250 - 100 }),
    );
    expect(summary).toMatchObject({ notes: 6, hits: 6, missed: 0 });
  });

  it('matches what the live matcher took, whatever the order of keys and clock', () => {
    const plan = planOf({ ...C_ONE, octaves: 2 }, 100, 4);
    const midis = scaleNotes({ ...C_ONE, octaves: 2 }).right.map((n) => n.midi);
    const step = 60_000 / 100 / 4;
    const played = midis.map((midi, i) => ({ midi, on: i * step + ((i * 37) % 23) - 11 }));
    const summary = summarizeRhythm(
      clickTimings(plan, played, { zero: 5, latency: 0, stoppedAt: null }),
    );
    expect(summary.hits).toBe(midis.length);
    const deviations = summary.timeline.map((n) => n.deviation!);
    deviations.forEach((d, i) => expect(d).toBeCloseTo(((i * 37) % 23) - 11 - 5, 6));
  });
});

describe('click settings', () => {
  it('takes whole tempos from 40 to 160 and 2, 3 or 4 notes a beat', () => {
    expect([39, 40, 160, 161, 80.5, '80'].map(isClickTempo)).toEqual([
      false,
      true,
      true,
      false,
      false,
      false,
    ]);
    expect([1, 2, 3, 4, 5].map(isNotesPerBeat)).toEqual([false, true, true, true, false]);
  });
});
