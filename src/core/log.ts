import type { FreePlaySession } from './freePlay.ts';
import type { PieceSession } from './pieceRecords.ts';
import { recoverSummary, type Attempt, type SessionSummary } from './session.ts';

/** A flashcard session as stored: its summary. */
export type ReadSessionRecord = SessionSummary & { kind: 'read' };
export type FreePlaySessionRecord = FreePlaySession;
export type PieceSessionRecord = PieceSession;
export type SessionRecord = ReadSessionRecord | FreePlaySessionRecord | PieceSessionRecord;

export function byTime(a: Attempt, b: Attempt): number {
  return a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Most recent first. */
export function byStartDescending(a: SessionRecord, b: SessionRecord): number {
  return b.startedAt - a.startedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Read sessions for attempts whose session was never stored (the tab closed mid-session).
 * `attempts` must be in the order they happened.
 */
export function recoverReadSessions(
  attempts: readonly Attempt[],
  sessions: readonly SessionRecord[],
): ReadSessionRecord[] {
  const known = new Set(sessions.map((s) => s.id));
  const orphans = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    if (known.has(attempt.sessionId)) continue;
    let group = orphans.get(attempt.sessionId);
    if (!group) orphans.set(attempt.sessionId, (group = []));
    group.push(attempt);
  }
  const recovered: ReadSessionRecord[] = [];
  for (const group of orphans.values()) {
    const summary = recoverSummary(group);
    if (summary) recovered.push({ kind: 'read', ...summary });
  }
  return recovered;
}
