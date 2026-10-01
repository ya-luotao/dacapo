import type { KnownTask, TaskKind } from '../../core/assignmentRecords.ts';
import { levelsOfFamily } from '../../core/assignments.ts';
import { exerciseKey } from '../../core/scales.ts';
import { LESSONS } from '../../learn/lessons.ts';
import { BUILT_IN } from '../../pieces/library/index.ts';
import { DEFAULT_EXERCISE } from '../scales/prefs.ts';

/** The name typed last, on this device: offered again for the next assignment. */
export const NAME_PREF = 'dacapo.assignments.name';

/** A task of `kind` as the editor first offers it. A piece's `pass` is filled in from its score. */
export function newTask(kind: TaskKind, id: string): KnownTask {
  switch (kind) {
    case 'piece': {
      const first = BUILT_IN[0]!;
      return {
        kind,
        id,
        piece: { id: first.id, title: '', composer: '', checksum: first.facts.checksum },
        bars: null,
        hands: 'both',
        mode: 'wait',
        tempo: 100,
        runs: 3,
        pass: { play: 0, skip: 0 },
      };
    }
    case 'scale':
      return { kind, id, exercise: exerciseKey(DEFAULT_EXERCISE), click: null, runs: 3 };
    case 'level':
      return { kind, id, family: 'notes', level: levelsOfFamily('notes')[0]!, goal: 3 };
    case 'lesson':
      return { kind, id, slug: LESSONS[0]!.slug };
    case 'minutes':
      return { kind, id, minutes: 20, days: 5 };
  }
}

/** An id for a new task: short, and not one the assignment's tasks have. */
export function newTaskId(taken: readonly { id: string }[]): string {
  const ids = new Set(taken.map((task) => task.id));
  for (let n = taken.length + 1; ; n++) {
    if (!ids.has(`t${n}`)) return `t${n}`;
  }
}
