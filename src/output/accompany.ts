// Wait-mode accompaniment: when the player completes a step, the other hand's notes that belong to
// it sound with their relative timing (see `accompanimentPlan`). A note stops at its written
// length, or earlier when the player completes the step where it ends; notes of an earlier step
// that have not started yet by then are dropped (unless already on their way to the instrument,
// at most a lookahead early), so nothing sounds noticeably out of order.

import type { AccompanimentPlan } from '../core/playback.ts';
import type { Clock, Scheduler } from './scheduler.ts';

export interface Accompanist {
  /** Step `step` was completed at `at` (performance.now() clock). */
  complete: (plan: AccompanimentPlan, step: number, at: number, velocity: number) => void;
  /** A new run: forgets the position. The caller silences the instrument. */
  reset: () => void;
}

export function createAccompanist(scheduler: Scheduler, clock: Clock): Accompanist {
  let active: { id: number; on: number; end: number }[] = [];
  let round = 0;
  let last = -1;

  return {
    complete(plan, step, at, velocity) {
      // Steps come in order; coming back to an earlier one is the loop going round.
      if (last >= 0 && step <= last) round++;
      last = step;
      const group = plan.steps.get(step);
      if (!group) return;
      const origin = Math.max(at, clock.now());
      const pos = round * plan.lapTicks + group.pos;
      active = active.filter((note) => {
        // Not started yet: dropped; if already handed to the port it is due any moment, so it plays.
        if (note.on > origin) return !scheduler.drop(note.id);
        if (note.end > pos) return true;
        scheduler.cut(note.id, origin);
        return false;
      });
      const ids = scheduler.playAll(
        group.notes.map((n) => ({
          midi: n.midi,
          velocity,
          on: origin + n.at,
          off: origin + n.at + n.length,
        })),
      );
      group.notes.forEach((n, i) => {
        active.push({ id: ids[i]!, on: origin + n.at, end: pos + n.until });
      });
    },
    reset() {
      active = [];
      round = 0;
      last = -1;
    },
  };
}
