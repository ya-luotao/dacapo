import type { Attempt, SessionSummary } from '../../core/session.ts';
import { emptyStats, updateStats, type StatsByKey } from '../../core/weakness.ts';

/** Everything practised, as plain data: raw attempts, per-note stats and session summaries. */
export interface PracticeData {
  /** In the order they happened. */
  attempts: readonly Attempt[];
  stats: StatsByKey;
  sessions: readonly SessionSummary[];
}

export interface PracticeStore {
  getSnapshot: () => PracticeData;
  /** For `useSyncExternalStore`. */
  subscribe: (onChange: () => void) => () => void;
  recordAttempt: (attempt: Attempt) => void;
  recordSession: (summary: SessionSummary) => void;
}

export const EMPTY_PRACTICE: PracticeData = { attempts: [], stats: {}, sessions: [] };

/** Kept in memory for now; storage/ will load and save the same shapes. */
export function createPracticeStore(initial: PracticeData = EMPTY_PRACTICE): PracticeStore {
  let data = initial;
  const listeners = new Set<() => void>();

  function set(next: PracticeData) {
    data = next;
    for (const listener of [...listeners]) listener();
  }

  return {
    getSnapshot: () => data,
    subscribe(onChange) {
      listeners.add(onChange);
      return () => void listeners.delete(onChange);
    },
    recordAttempt(attempt) {
      const stats = updateStats(data.stats[attempt.note] ?? emptyStats(attempt.note), attempt);
      set({
        ...data,
        attempts: [...data.attempts, attempt],
        stats: { ...data.stats, [attempt.note]: stats },
      });
    },
    recordSession(summary) {
      set({ ...data, sessions: [...data.sessions, summary] });
    },
  };
}
