import { parseMusicXml } from '../../../core/musicxml.ts';
import type { RhythmPlan } from '../../../core/rhythm.ts';
import { clickTimings, scaleRhythmPlan } from '../../../core/scaleClick.ts';
import type { StoredScaleRun } from '../../../core/scaleRecords.ts';
import { handsPlaying, parseExerciseKey } from '../../../core/scales.ts';
import { scaleHands, scaleMusicXml } from '../../../core/scaleXml.ts';

// A scale run played with the click keeps its keys and its grid; its timing against the click is
// recomputed exactly as the Scales page computes it after the run (docs/SCALES.md, "With the
// click"): the exercise's score drawn with the grid's notes to the beat, rhythm mode's plan of it at
// the run's tempo, and the matcher over the run's keys. The grid's notes to the beat are what the
// score was drawn with (a technique exercise with a rhythm of its own ignores them either way).

const plans = new Map<string, RhythmPlan | null>();

function planOf(exercise: string, perBeat: number, bpm: number): RhythmPlan | null {
  const key = `${exercise}|${perBeat}|${bpm}`;
  if (plans.has(key)) return plans.get(key)!;
  let plan: RhythmPlan | null = null;
  const e = parseExerciseKey(exercise);
  if (e) {
    try {
      const xml = scaleMusicXml(e, { notesPerBeat: perBeat });
      const score = parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
        hands: scaleHands(e),
      });
      plan = scaleRhythmPlan(score, handsPlaying(e.hands), bpm);
    } catch {
      plan = null;
    }
  }
  plans.set(key, plan);
  return plan;
}

/**
 * How far each note of a clicked run was from its place on the grid, ms (null: missed); null for a
 * run without the click, or of an exercise this build cannot write out.
 */
export function clickedRunDeviations(run: StoredScaleRun): (number | null)[] | null {
  const { click } = run;
  if (!click) return null;
  const plan = planOf(run.exercise, click.perBeat, click.bpm);
  if (!plan) return null;
  return clickTimings(plan, run.keys, click).flatMap((step) =>
    step.notes.map((note) => note.deviation),
  );
}
