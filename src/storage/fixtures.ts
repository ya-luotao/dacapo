// Sample records for storage tests. Not imported by the app.
import { IDBFactory } from 'fake-indexeddb';
import type { SessionRecord } from '../core/log.ts';
import { parseNoteKey } from '../core/levels.ts';
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
