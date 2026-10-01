import {
  isChordSymbolAnswer,
  isEarAnswer,
  isRhythmAnswer,
  isRhythmEarAnswer,
  isTheoryAnswer,
  type Answer,
} from './answers.ts';
import { recoverEarSummary, type EarSessionSummary } from './earSession.ts';
import type { FreePlaySession } from './freePlay.ts';
import { recoverHarmonySummary, type HarmonySessionSummary } from './harmonySession.ts';
import type { ImprovSession } from './improvFigures.ts';
import type { PieceSession } from './pieceRecords.ts';
import { recoverRhythmEarSummary, type RhythmEarSessionSummary } from './rhythmEar.ts';
import { recoverRhythmSummary, type RhythmSessionSummary } from './rhythmRead.ts';
import type { ScaleSession } from './scaleRecords.ts';
import { sightRunCount, type SightSessionSummary } from './sightRead.ts';
import { recoverSummary, type Attempt, type SessionSummary } from './session.ts';
import { recoverTheorySummary, type TheorySessionSummary } from './theorySession.ts';

/** A flashcard session as stored: its summary. */
export type ReadSessionRecord = SessionSummary & { kind: 'read' };
export type FreePlaySessionRecord = FreePlaySession;
export type PieceSessionRecord = PieceSession;
export type ScaleSessionRecord = ScaleSession;
/**
 * An ear-training session as stored: its summary, told apart by its family (rhythm dictation,
 * `rhythmEar`, has figures of its own).
 */
export type EarSessionRecord = (EarSessionSummary | RhythmEarSessionSummary) & { kind: 'ear' };
/** A session of theory cards on Read (intervals, key signatures, chords) as stored. */
export type TheorySessionRecord = TheorySessionSummary & { kind: 'theory' };
/** A session of rhythm lines on Read (docs/READING.md, "Rhythm (R1)") as stored. */
export type RhythmSessionRecord = RhythmSessionSummary & { kind: 'rhythm' };
/** A session of chord symbols on the Harmony page as stored. */
export type HarmonySessionRecord = HarmonySessionSummary & { kind: 'harmony' };
/**
 * A sight-reading session on Read (docs/READING.md, "Sight-reading (R3)") as stored: stored again
 * after every run, so a closed tab loses nothing.
 */
export type SightSessionRecord = SightSessionSummary & { kind: 'sight' };
/**
 * An improvisation over a backing on the Harmony page (docs/HARMONY.md, "Improvise (H6)") as
 * stored: stored again as it goes, so a closed tab keeps most of it.
 */
export type ImprovSessionRecord = ImprovSession;
export type SessionRecord =
  | ReadSessionRecord
  | FreePlaySessionRecord
  | PieceSessionRecord
  | ScaleSessionRecord
  | EarSessionRecord
  | TheorySessionRecord
  | RhythmSessionRecord
  | HarmonySessionRecord
  | SightSessionRecord
  | ImprovSessionRecord;

/**
 * The runs of a session that grows while it is played and is stored again as it does (a scale
 * or sight-reading session; an improvisation's notes); 0 for the others. Of two copies, the one
 * with more is the later.
 */
export function sessionRuns(session: SessionRecord): number {
  if (session.kind === 'scale') return session.runs.length;
  if (session.kind === 'sight') return sightRunCount(session);
  if (session.kind === 'improv') return session.figures.notes;
  return 0;
}

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
 * Ear sessions (rhythm dictation's among them) for answers whose session was never stored (the
 * tab closed mid-session). `answers` must be in the order they happened; theory answers are
 * `recoverTheorySessions`'.
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
  for (const group of orphanGroups(answers.filter(isRhythmEarAnswer), sessions)) {
    const summary = recoverRhythmEarSummary(group);
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

/**
 * Harmony sessions for chord-symbol answers whose session was never stored (the tab closed
 * mid-session). `answers` must be in the order they happened; the others are left to the
 * functions above.
 */
export function recoverHarmonySessions(
  answers: readonly Answer[],
  sessions: readonly SessionRecord[],
): HarmonySessionRecord[] {
  const recovered: HarmonySessionRecord[] = [];
  for (const group of orphanGroups(answers.filter(isChordSymbolAnswer), sessions)) {
    const summary = recoverHarmonySummary(group);
    if (summary) recovered.push({ kind: 'harmony', ...summary });
  }
  return recovered;
}
