import { isEarAnswer, isRhythmAnswer, isTheoryAnswer, type Answer } from './answers.ts';
import { recoverEarSummary, type EarSessionSummary } from './earSession.ts';
import type { FreePlaySession } from './freePlay.ts';
import type { PieceSession } from './pieceRecords.ts';
import { recoverRhythmSummary, type RhythmSessionSummary } from './rhythmRead.ts';
import type { ScaleSession } from './scaleRecords.ts';
import { recoverSummary, type Attempt, type SessionSummary } from './session.ts';
import { recoverTheorySummary, type TheorySessionSummary } from './theorySession.ts';

/** A flashcard session as stored: its summary. */
export type ReadSessionRecord = SessionSummary & { kind: 'read' };
export type FreePlaySessionRecord = FreePlaySession;
export type PieceSessionRecord = PieceSession;
export type ScaleSessionRecord = ScaleSession;
/** An ear-training session as stored: its summary. */
export type EarSessionRecord = EarSessionSummary & { kind: 'ear' };
/** A session of theory cards on Read (intervals, key signatures, chords) as stored. */
export type TheorySessionRecord = TheorySessionSummary & { kind: 'theory' };
/** A session of rhythm lines on Read (docs/READING.md, "Rhythm (R1)") as stored. */
export type RhythmSessionRecord = RhythmSessionSummary & { kind: 'rhythm' };
export type SessionRecord =
  | ReadSessionRecord
  | FreePlaySessionRecord
  | PieceSessionRecord
  | ScaleSessionRecord
  | EarSessionRecord
  | TheorySessionRecord
  | RhythmSessionRecord;

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

/** The answers of each session that was never stored, grouped by session, in order. */
function orphanGroups<T extends { sessionId: string }>(
  answers: readonly T[],
  sessions: readonly SessionRecord[],
): T[][] {
  const known = new Set(sessions.map((s) => s.id));
  const orphans = new Map<string, T[]>();
  for (const answer of answers) {
    if (known.has(answer.sessionId)) continue;
    let group = orphans.get(answer.sessionId);
    if (!group) orphans.set(answer.sessionId, (group = []));
    group.push(answer);
  }
  return [...orphans.values()];
}

/**
 * Ear sessions for answers whose session was never stored (the tab closed mid-session).
 * `answers` must be in the order they happened; theory answers are `recoverTheorySessions`'.
 */
export function recoverEarSessions(
  answers: readonly Answer[],
  sessions: readonly SessionRecord[],
): EarSessionRecord[] {
  const recovered: EarSessionRecord[] = [];
  for (const group of orphanGroups(answers.filter(isEarAnswer), sessions)) {
    const summary = recoverEarSummary(group);
    if (summary) recovered.push({ kind: 'ear', ...summary });
  }
  return recovered;
}

/**
 * Theory sessions for answers whose session was never stored (the tab closed mid-session).
 * `answers` must be in the order they happened; ear answers are `recoverEarSessions`'.
 */
export function recoverTheorySessions(
  answers: readonly Answer[],
  sessions: readonly SessionRecord[],
): TheorySessionRecord[] {
  const recovered: TheorySessionRecord[] = [];
  for (const group of orphanGroups(answers.filter(isTheoryAnswer), sessions)) {
    const summary = recoverTheorySummary(group);
    if (summary) recovered.push({ kind: 'theory', ...summary });
  }
  return recovered;
}

/**
 * Rhythm sessions for answers whose session was never stored (the tab closed mid-session).
 * `answers` must be in the order they happened.
 */
export function recoverRhythmSessions(
  answers: readonly Answer[],
  sessions: readonly SessionRecord[],
): RhythmSessionRecord[] {
  const recovered: RhythmSessionRecord[] = [];
  for (const group of orphanGroups(answers.filter(isRhythmAnswer), sessions)) {
    const summary = recoverRhythmSummary(group);
    if (summary) recovered.push({ kind: 'rhythm', ...summary });
  }
  return recovered;
}
