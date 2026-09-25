// Sample records for storage tests. Not imported by the app.
import { IDBFactory } from 'fake-indexeddb';
import type { SessionRecord } from '../core/log.ts';
import { parseNoteKey } from '../core/levels.ts';
import {
  pieceSession,
  stepId,
  type PieceRunHeader,
  type PieceSession,
  type PieceStep,
} from '../core/pieceRecords.ts';
import { recoverSummary, type Attempt } from '../core/session.ts';
import type { StoredPiece } from '../core/storedPiece.ts';

export const T0 = Date.UTC(2026, 8, 20, 10);

const NOTES = ['C4@treble', 'E4@treble', 'G4@treble', 'D4@treble', 'F4@treble'];

/** A fresh, empty IndexedDB for the next test (needs `fake-indexeddb/auto` imported first). */
export function resetIndexedDB(): void {
  globalThis.indexedDB = new IDBFactory();
}

export function sampleAttempt(i: number, sessionId = 's1', patch: Partial<Attempt> = {}): Attempt {
  const note = patch.note ?? NOTES[i % NOTES.length]!;
  const target = parseNoteKey(note)!.midi;
  const correct = patch.correct ?? i % 4 !== 3;
  return {
    id: `a${i}`,
    sessionId,
    level: 'L1',
    note,
    target,
    played: correct ? target : target + 1,
    correct,
    ms: 600 + ((i * 373) % 2400),
    hinted: i % 7 === 6,
    timedOut: false,
    at: T0 + i * 3000,
    ...patch,
  };
}

/** Two flashcard sessions with their attempts and one free-play session. */
export function sampleData(): { sessions: SessionRecord[]; attempts: Attempt[] } {
  const first = Array.from({ length: 12 }, (_, i) => sampleAttempt(i, 's1'));
  const second = Array.from({ length: 8 }, (_, i) => sampleAttempt(100 + i, 's2'));
  const read = (attempts: Attempt[]): SessionRecord => ({
    kind: 'read',
    ...recoverSummary(attempts)!,
  });
  return {
    sessions: [
      read(first),
      read(second),
      {
        kind: 'free',
        id: 'f1',
        startedAt: T0 + 3_600_000,
        endedAt: T0 + 3_900_000,
        activeMs: 300_000,
        notes: 412,
      },
    ],
    attempts: [...first, ...second],
  };
}

/** An imported piece with a one-bar score. */
export function samplePiece(i: number, patch: Partial<StoredPiece> = {}): StoredPiece {
  return {
    id: `p${i}`,
    title: `Piece ${i}`,
    composer: 'Someone',
    fileName: `piece-${i}.mxl`,
    xml: `<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>${4 + (i % 2)}</octave></pitch><duration>4</duration></note></measure></part></score-partwise>`,
    importedAt: T0 + i * 60_000,
    hands: null,
    warnings: [],
    ...patch,
  };
}

/** The header of a wait-mode run on piece `pieceId`. */
export function sampleHeader(id: string, patch: Partial<PieceRunHeader> = {}): PieceRunHeader {
  return {
    id,
    pieceId: 'petzold-minuet-in-g',
    title: 'Minuet in G major',
    hands: 'right',
    loop: null,
    repeats: 'play',
    tempo: 100,
    startedAt: T0,
    ...patch,
  };
}

/** Step `n` of run `sessionId`: bar n % 4, a second after the one before. */
export function sampleStep(
  sessionId: string,
  n: number,
  patch: Partial<PieceStep> = {},
): PieceStep {
  return {
    id: stepId(sessionId, n),
    sessionId,
    pieceId: 'petzold-minuet-in-g',
    checksum: 'b80fe0e1',
    hands: 'right',
    measure: n % 4,
    pass: 1,
    ms: 800 + ((n * 211) % 900),
    wrong: n % 5 === 4 ? 1 : 0,
    at: T0 + (n + 1) * 1000,
    ...patch,
  };
}

/** A run of `count` steps with its session. */
export function sampleRun(
  sessionId: string,
  count: number,
  patch: Partial<PieceStep> = {},
  header: Partial<PieceRunHeader> = {},
): { steps: PieceStep[]; session: PieceSession } {
  const steps = Array.from({ length: count }, (_, n) => sampleStep(sessionId, n, patch));
  const first = steps[0]!;
  return {
    steps,
    session: pieceSession(
      sampleHeader(sessionId, {
        pieceId: first.pieceId,
        hands: first.hands,
        startedAt: first.at - first.ms,
        ...header,
      }),
      steps,
      true,
    ),
  };
}

/** Step `n` of rhythm run `sessionId`: bar n % 4, a two-key chord every 667 ms, the high key missed on every fifth. */
export function sampleRhythmStep(
  sessionId: string,
  n: number,
  patch: Partial<PieceStep> = {},
): PieceStep {
  return {
    ...sampleStep(sessionId, n),
    ms: 667,
    wrong: n % 7 === 6 ? 1 : 0,
    at: T0 + n * 667,
    mode: 'rhythm',
    notes: [
      { midi: 60, deviation: ((n * 37) % 61) - 30 },
      { midi: 64, deviation: n % 5 === 4 ? null : ((n * 23) % 41) - 10 },
    ],
    ...patch,
  };
}

/** A rhythm run of `count` steps with its session. */
export function sampleRhythmRun(
  sessionId: string,
  count: number,
): { steps: PieceStep[]; session: PieceSession } {
  const steps = Array.from({ length: count }, (_, n) => sampleRhythmStep(sessionId, n));
  return {
    steps,
    session: pieceSession(
      sampleHeader(sessionId, { mode: 'rhythm', startedAt: steps[0]!.at }),
      steps,
      true,
    ),
  };
}
