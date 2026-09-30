// Sample records for storage tests. Not imported by the app.
import { IDBFactory } from 'fake-indexeddb';
import { recoverEarSummary, type Answer } from '../core/earSession.ts';
import type { RunHeadline } from '../core/evenness.ts';
import type { EarSessionRecord, SessionRecord } from '../core/log.ts';
import { parseNoteKey } from '../core/levels.ts';
import {
  pieceSession,
  stepId,
  type PieceRunHeader,
  type PieceSession,
  type PieceStep,
} from '../core/pieceRecords.ts';
import {
  scaleRunId,
  withRun,
  type ScaleSession,
  type StoredScaleRun,
} from '../core/scaleRecords.ts';
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

/** C major up and down one octave, right hand: MIDI keys in the order played. */
const C_MAJOR = [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60];

/**
 * Run `n` of scale session `sessionId`: one octave of C major, a key every 250 ms (the last one
 * still down at the end), velocities around 64, runs 20 s apart.
 */
export function sampleScaleRun(
  sessionId: string,
  n: number,
  patch: Partial<StoredScaleRun> = {},
): StoredScaleRun {
  return {
    id: scaleRunId(sessionId, n),
    sessionId,
    exercise: 'major:C:1:right',
    startedAt: T0 + n * 20_000,
    end: 'finished',
    keys: C_MAJOR.map((midi, i) => ({
      midi,
      on: i * 250 + ((i * 7 + n) % 5),
      off: i === C_MAJOR.length - 1 ? null : i * 250 + 200,
      velocity: 60 + ((i * 3 + n) % 9),
    })),
    pedal:
      n % 2 === 1
        ? [
            { down: true, time: 900.5 },
            { down: false, time: 1400 },
          ]
        : [],
    pedalAtStart: false,
    velocityMeasured: true,
    inputs: ['Digital Piano'],
    ...patch,
  };
}

/** Headline figures of a run such as `sampleScaleRun`'s. */
export function sampleHeadline(patch: Partial<RunHeadline> = {}): RunHeadline {
  return {
    version: 1,
    quality: 'ok',
    counts: { expected: 15, matched: 15, wrong: 0, missed: 0, extra: 0 },
    velocityMeasured: true,
    hands: [
      {
        hand: 'right',
        spread: 2.4,
        spreadShare: 1,
        rough: true,
        hesitations: 0,
        medianInterval: 250,
      },
    ],
    ...patch,
  };
}

/** A scale session of `count` runs, built as the Scales page builds it. */
export function sampleScaleSession(
  sessionId: string,
  count: number,
  patch: Partial<StoredScaleRun> = {},
): { runs: StoredScaleRun[]; session: ScaleSession } {
  const runs = Array.from({ length: count }, (_, n) => sampleScaleRun(sessionId, n, patch));
  let session: ScaleSession | null = null;
  for (const run of runs) {
    session = withRun(session, sessionId, {
      id: run.id,
      exercise: run.exercise,
      startedAt: run.startedAt,
      endedAt: run.startedAt + Math.max(...run.keys.map((k) => k.on)),
      headline: sampleHeadline(),
    });
  }
  return { runs, session: session! };
}

/**
 * Answer `i` of ear session `sessionId`: a perfect 5th up played on the keyboard, every fourth
 * one a key too low; 4 s apart, a replay on every fifth.
 */
export function sampleAnswer(i: number, sessionId = 'e1', patch: Partial<Answer> = {}): Answer {
  const lower = 48 + (i % 12);
  const correct = i % 4 !== 3;
  return {
    id: `${sessionId}:${i}`,
    sessionId,
    family: 'interval',
    level: 'I1',
    item: 'int:P5:up',
    by: 'play',
    prompt: [lower, lower + 7],
    answer: [correct ? lower + 7 : lower + 6],
    correct,
    ms: 900 + ((i * 373) % 2400),
    replays: i % 5 === 4 ? 1 : 0,
    at: T0 + 7_200_000 + i * 4000,
    ...patch,
  };
}

/** A chord named by its buttons: a major triad in root position answered as minor on odd `i`. */
export function sampleNamedAnswer(
  i: number,
  sessionId = 'e2',
  patch: Partial<Answer> = {},
): Answer {
  const correct = i % 2 === 0;
  return {
    id: `${sessionId}:${i}`,
    sessionId,
    family: 'chord',
    level: 'C1',
    item: 'chord:maj:root',
    by: 'name',
    prompt: [55, 59, 62],
    answer: correct ? 'maj:root' : 'min:root',
    correct,
    ms: 1500,
    replays: 0,
    at: T0 + 9_000_000 + i * 4000,
    ...patch,
  };
}

/** A melody played back (EC2 in C): right on even `i`, wrong at its third note on odd `i`. */
export function sampleEchoAnswer(i: number, sessionId = 'e3', patch: Partial<Answer> = {}): Answer {
  const correct = i % 2 === 0;
  return {
    id: `${sessionId}:${i}`,
    sessionId,
    family: 'echo',
    level: 'EC2',
    item: 'echo:EC2',
    by: 'play',
    prompt: [64, 67, 65, 60],
    answer: correct ? [64, 67, 65, 60] : [64, 67, 64],
    correct,
    ms: 2400 + i * 100,
    replays: 0,
    at: T0 + 10_000_000 + i * 8000,
    key: { tonic: 'C', scale: 'major' },
    ...patch,
  };
}

/** An ear session of `count` answers (`sampleAnswer`) with its record. */
export function sampleEarSession(
  sessionId: string,
  count: number,
): { answers: Answer[]; session: EarSessionRecord } {
  const answers = Array.from({ length: count }, (_, i) => sampleAnswer(i, sessionId));
  return { answers, session: { kind: 'ear', ...recoverEarSummary(answers)! } };
}
