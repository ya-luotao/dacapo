// Sample records for storage tests. Not imported by the app.
import { IDBFactory } from 'fake-indexeddb';
import { voiceCadence } from '../core/cadences.ts';
import { recoverEarSummary, type EarAnswer } from '../core/earSession.ts';
import type { RunHeadline } from '../core/evenness.ts';
import { recoverHarmonySummary, type ChordSymbolAnswer } from '../core/harmonySession.ts';
import { backingChecksum, improvPieceId, improvPlan, isPlayerBar } from '../core/improv.ts';
import { improvSession } from '../core/improvFigures.ts';
import type {
  EarSessionRecord,
  HarmonySessionRecord,
  ImprovSessionRecord,
  RhythmSessionRecord,
  SessionRecord,
  SightSessionRecord,
  TheorySessionRecord,
} from '../core/log.ts';
import { summarizeSightSession, type SightRunFigures } from '../core/sightRead.ts';
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
import { recoverRhythmSummary, type RhythmAnswer } from '../core/rhythmRead.ts';
import {
  recoverRhythmEarSummary,
  type RhythmEarAnswer,
  type RhythmEarChoiceAnswer,
  type RhythmEarTapAnswer,
} from '../core/rhythmEar.ts';
import { recoverSummary, type Attempt } from '../core/session.ts';
import { recoverTheorySummary, type TheoryAnswer } from '../core/theorySession.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import { TAKE_CHUNK_EVENTS, takeChunkId, type TakeChunk } from '../core/takes.ts';

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

/**
 * Chunk `chunk` of the take of run `sessionId`: `events` key presses (a key down, then up 300 ms
 * later, every 400 ms: C4 D4 E4 … matched to steps 0, 1, 2 …, every fifth one wrong), the sustain
 * pedal down at the start.
 */
export function sampleTake(
  sessionId: string,
  chunk = 0,
  patch: Partial<TakeChunk> = {},
  presses = 4,
): TakeChunk {
  const events: number[][] = chunk === 0 ? [[0, 64, 127]] : [];
  for (let i = 0; i < presses; i++) {
    const n = chunk * presses + i;
    const key = 60 + (n % 12);
    events.push([n * 400, 1, key, 60 + (n % 30), n % 5 === 4 ? -1 : n]);
    events.push([n * 400 + 300, 0, key]);
  }
  return {
    id: takeChunkId(sessionId, chunk),
    sessionId,
    pieceId: 'petzold-minuet-in-g',
    checksum: 'b80fe0e1',
    hands: 'right',
    repeats: 'play',
    tempo: 100,
    startedAt: T0,
    chunk,
    events,
    ...patch,
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
export function sampleAnswer(
  i: number,
  sessionId = 'e1',
  patch: Partial<EarAnswer> = {},
): EarAnswer {
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
  patch: Partial<EarAnswer> = {},
): EarAnswer {
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
export function sampleEchoAnswer(
  i: number,
  sessionId = 'e3',
  patch: Partial<EarAnswer> = {},
): EarAnswer {
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

/**
 * A cadence named (CA3, a deceptive cadence in D major, I–IV–V–vi): right on even `i`, named
 * authentic on odd `i`.
 */
export function sampleCadenceAnswer(
  i: number,
  sessionId = 'c1',
  patch: Partial<EarAnswer> = {},
): EarAnswer {
  const correct = i % 2 === 0;
  return {
    id: `${sessionId}:${i}`,
    sessionId,
    family: 'cadence',
    level: 'CA3',
    item: 'cad:deceptive',
    by: 'name',
    prompt: voiceCadence('D', ['I', 'IV', 'V', 'vi'], 0).flat(),
    answer: correct ? 'deceptive' : 'authentic',
    correct,
    ms: 1900 + i * 100,
    replays: i % 3 === 2 ? 1 : 0,
    at: T0 + 14_000_000 + i * 7000,
    key: { tonic: 'D', scale: 'major' },
    ...patch,
  };
}

/** A session of `count` cadences (`sampleCadenceAnswer`) with its record. */
export function sampleCadenceSession(
  sessionId: string,
  count: number,
): { answers: EarAnswer[]; session: EarSessionRecord } {
  const answers = Array.from({ length: count }, (_, i) => sampleCadenceAnswer(i, sessionId));
  return { answers, session: { kind: 'ear', ...recoverEarSummary(answers)! } };
}

/** An ear session of `count` answers (`sampleAnswer`) with its record. */
export function sampleEarSession(
  sessionId: string,
  count: number,
): { answers: EarAnswer[]; session: EarSessionRecord } {
  const answers = Array.from({ length: count }, (_, i) => sampleAnswer(i, sessionId));
  return { answers, session: { kind: 'ear', ...recoverEarSummary(answers)! } };
}

/**
 * Theory answers on Read, one of each kind of card: an interval named (RI3, C4–D♯4 up, wrong as
 * a minor 3rd on odd `i`), a key signature played (KS2, E♭ major: an E♭, or a D on odd `i`), a
 * chord played (RC2, C major on the treble staff) and a chord named (RC3, F♯ minor in 1st
 * inversion on the bass staff, as G♭ on odd `i`); 3 s apart, every third one hinted.
 */
export function sampleTheoryAnswers(i: number, sessionId = 't1'): TheoryAnswer[] {
  const right = i % 2 === 0;
  const base = { sessionId, correct: right, ms: 1800 + i * 100, hinted: i % 3 === 2 };
  const at = (n: number) => T0 + 12_000_000 + (i * 4 + n) * 3000;
  return [
    {
      ...base,
      id: `${sessionId}:${i}:ri`,
      family: 'readInterval',
      level: 'RI3',
      item: 'ri:A2:up',
      by: 'name',
      prompt: ['C4', 'D#4'],
      clef: 'treble',
      answer: right ? 'A2' : 'm3',
      at: at(0),
    },
    {
      ...base,
      id: `${sessionId}:${i}:ks`,
      family: 'keySignature',
      level: 'KS2',
      item: 'ks:3f:major',
      by: 'play',
      prompt: '3f',
      answer: [right ? 51 : 62],
      at: at(1),
    },
    {
      ...base,
      id: `${sessionId}:${i}:rc`,
      family: 'readChord',
      level: 'RC2',
      item: 'rc:maj:root',
      by: 'play',
      prompt: ['C4', 'E4', 'G4'],
      clef: 'treble',
      answer: right ? [60, 64, 67] : [60, 65],
      at: at(2),
    },
    {
      ...base,
      id: `${sessionId}:${i}:rn`,
      family: 'readChord',
      level: 'RC3',
      item: 'rc:min:1st',
      by: 'name',
      prompt: ['A2', 'C#3', 'F#3'],
      clef: 'bass',
      answer: right ? 'F#:min:1st' : 'Gb:min:1st',
      at: at(3),
    },
  ];
}

/** A theory session of intervals (RI3) of `count` answers with its record. */
export function sampleTheorySession(
  sessionId: string,
  count: number,
): { answers: TheoryAnswer[]; session: TheorySessionRecord } {
  const answers = Array.from({ length: count }, (_, i) => sampleTheoryAnswers(i, sessionId)[0]!);
  return { answers, session: { kind: 'theory', ...recoverTheorySummary(answers)! } };
}

/**
 * Rhythm answers on Read: one run of two bars of R3 in 3/4 (q h | qd-e ee), each cell timed; on
 * odd `run` the half note is missed with a tap in its span and the second eighth comes 60 ms late.
 */
export function sampleRhythmAnswers(run: number, sessionId = 'r1'): RhythmAnswer[] {
  const late = run % 2 === 1;
  const cells: {
    item: string;
    prompt: number[][];
    deviations: (number | null)[][];
    extras: number;
  }[] = [
    { item: 'rhythm:q:3/4', prompt: [[0]], deviations: [[-12]], extras: 0 },
    { item: 'rhythm:h:3/4', prompt: [[0]], deviations: [[late ? null : 5]], extras: late ? 1 : 0 },
    { item: 'rhythm:qd-e:3/4', prompt: [[0, 1.5]], deviations: [[0, -30]], extras: 0 },
    { item: 'rhythm:ee:3/4', prompt: [[0, 0.5]], deviations: [[8, late ? 60 : 20]], extras: 0 },
  ];
  const beats = [1, 2, 2, 1];
  let end = T0 + 13_000_000 + run * 10_000;
  return cells.map((c, i) => {
    end += beats[i]! * 1000;
    return {
      id: `${sessionId}:${run}:${i}`,
      sessionId,
      family: 'rhythm',
      level: 'R3',
      item: c.item,
      prompt: c.prompt,
      answer: { deviations: c.deviations, extras: c.extras },
      correct: c.extras === 0 && c.deviations.flat().every((d) => d !== null && Math.abs(d) <= 50),
      bpm: 60,
      exercise: Math.floor(run / 2),
      run,
      at: end,
    };
  });
}

/**
 * Sight-reading run `n` (F5, two fragments at most): even runs in time at 72 (the first all but
 * two notes in time, later ones rushing a little), odd ones in wait mode with two wrong keys.
 */
export function sampleSightRun(n: number): SightRunFigures {
  const startedAt = T0 + 14_000_000 + n * 40_000;
  const endedAt = startedAt + 27_000;
  if (n % 2 === 1) return { mode: 'wait', startedAt, endedAt, notes: 40, wrong: 2 };
  return {
    mode: 'time',
    bpm: 72,
    readAhead: n === 0 ? 'off' : 'on',
    startedAt,
    endedAt,
    notes: 40,
    inTime: 36 - n,
    early: 1 + n,
    late: 1,
    wrong: 1,
    missed: 1,
    extras: 2,
    medianDeviation: 18 + n,
    tendency: -4 - n,
  };
}

/** A sight-reading session of `runs` runs, two to a fragment, with its record. */
export function sampleSightSession(sessionId: string, runs: number): SightSessionRecord {
  const fragments = Array.from({ length: Math.ceil(runs / 2) }, (_, f) => ({
    seed: 1000 + f,
    version: 1,
    runs: Array.from({ length: Math.min(2, runs - 2 * f) }, (_, r) => sampleSightRun(2 * f + r)),
  }));
  return {
    kind: 'sight',
    ...summarizeSightSession({
      id: sessionId,
      level: 'F5',
      length: 4,
      startedAt: T0 + 14_000_000 - 5_000,
      fragments,
    })!,
  };
}

/** A rhythm session of `runs` runs with its record. */
export function sampleRhythmSession(
  sessionId: string,
  runs: number,
): { answers: RhythmAnswer[]; session: RhythmSessionRecord } {
  const answers = Array.from({ length: runs }, (_, i) => sampleRhythmAnswers(i, sessionId)).flat();
  return { answers, session: { kind: 'rhythm', ...recoverRhythmSummary(answers)! } };
}

/**
 * Chord-symbol answers on Harmony, one of each kind: a triad (H2, F♯m: right, or with a G on odd
 * `i`) and a slash chord (H4, C/E: E G C, or C E G♭ on odd `i`); 3 s apart, every third one
 * hinted.
 */
export function sampleChordSymbolAnswers(i: number, sessionId = 'h1'): ChordSymbolAnswer[] {
  const right = i % 2 === 0;
  const base = {
    sessionId,
    family: 'chordSymbol',
    by: 'play',
    correct: right,
    ms: 2100 + i * 100,
    hinted: i % 3 === 2,
  } as const;
  const at = (n: number) => T0 + 14_000_000 + (i * 2 + n) * 3000;
  return [
    {
      ...base,
      id: `${sessionId}:${i}:tri`,
      level: 'H2',
      item: 'sym:F♯m',
      prompt: 'F♯m',
      answer: right ? [54, 57, 61] : [54, 55],
      at: at(0),
    },
    {
      ...base,
      id: `${sessionId}:${i}:slash`,
      level: 'H4',
      item: 'sym:C/E',
      prompt: 'C/E',
      answer: right ? [52, 55, 60] : [60, 64, 66],
      at: at(1),
    },
  ];
}

/**
 * Rhythm dictation: bar `question` of R6 in 2/4 at ♩ = 60 tapped back (triplet, quarter), the
 * triplet tapped as two eighths on odd `question`, the quarter always in time.
 */
export function sampleRhythmEarTaps(question: number, sessionId = 'rd1'): RhythmEarTapAnswer[] {
  const odd = question % 2 === 1;
  const end = T0 + 16_000_000 + question * 20_000;
  const base = {
    sessionId,
    family: 'rhythmEar' as const,
    level: 'R6' as const,
    by: 'play' as const,
    bpm: 60,
    question,
    replays: odd ? 1 : 0,
  };
  return [
    {
      ...base,
      id: `${sessionId}:${question}:0`,
      item: 'rhythmEar:trip:2/4',
      prompt: [0, 1 / 3, 2 / 3],
      answer: odd
        ? { deviations: [0, null, null], extras: [500] }
        : { deviations: [0, -10, 12], extras: [] },
      correct: !odd,
      at: end + 1000,
    },
    {
      ...base,
      id: `${sessionId}:${question}:1`,
      item: 'rhythmEar:q:2/4',
      prompt: [0],
      answer: { deviations: [5], extras: [] },
      correct: true,
      at: end + 2000,
    },
  ];
}

/** A Harmony session of triads (H2) of `count` answers with its record. */
export function sampleHarmonySession(
  sessionId: string,
  count: number,
): { answers: ChordSymbolAnswer[]; session: HarmonySessionRecord } {
  const answers = Array.from(
    { length: count },
    (_, i) => sampleChordSymbolAnswers(i, sessionId)[0]!,
  );
  return { answers, session: { kind: 'harmony', ...recoverHarmonySummary(answers)! } };
}

/**
 * Rhythm dictation: bar `question` of R2 in 4/4 chosen, asked about its eighths (q ee h); on odd
 * `question` chosen with an eighth rest and eighth for them.
 */
export function sampleRhythmEarChoice(question: number, sessionId = 'rd2'): RhythmEarChoiceAnswer {
  const odd = question % 2 === 1;
  return {
    id: `${sessionId}:${question}`,
    sessionId,
    family: 'rhythmEar',
    level: 'R2',
    item: 'rhythmEar:ee:4/4',
    by: 'name',
    prompt: ['q', 'ee', 'h'],
    answer: odd ? ['q', 'er-e', 'h'] : ['q', 'ee', 'h'],
    correct: !odd,
    ms: 1500 + question * 100,
    bpm: 72,
    question,
    replays: 0,
    at: T0 + 17_000_000 + question * 15_000,
  };
}

/** A rhythm dictation session of `questions` bars, tapped back or chosen, with its record. */
export function sampleRhythmEarSession(
  sessionId: string,
  questions: number,
  by: 'play' | 'name' = 'play',
): { answers: RhythmEarAnswer[]; session: EarSessionRecord } {
  const answers: RhythmEarAnswer[] = Array.from({ length: questions }, (_, i) =>
    by === 'play' ? sampleRhythmEarTaps(i, sessionId) : [sampleRhythmEarChoice(i, sessionId)],
  ).flat();
  return { answers, session: { kind: 'ear', ...recoverRhythmEarSummary(answers)! } };
}

/**
 * An improvisation over the 12-bar blues in F at 96 with call and response (seed 5), with its
 * take: eighths up and down the F blues scale through the answers' bars, the sustain pedal down
 * through the first answer, `bars` bars long. Its take in chunks of at most `perChunk` events.
 */
export function sampleImprovSession(
  sessionId: string,
  bars = 8,
  perChunk = TAKE_CHUNK_EVENTS,
): { session: ImprovSessionRecord; takes: TakeChunk[] } {
  const plan = improvPlan({
    backing: 'blues',
    key: 'F',
    scale: 'blues',
    pattern: 'shuffle',
    feel: 'swing',
    bpm: 96,
    call: true,
    seed: 5,
  });
  const run = [65, 68, 70, 71, 72, 75, 77, 75, 72, 71, 70, 68];
  const events: number[][] = [[plan.barMs * 2 - 50, 64, 127]];
  for (let bar = 0; bar < bars; bar++) {
    if (!isPlayerBar(plan, bar)) continue;
    for (let e = 0; e < 8; e++) {
      const on = Math.round(bar * plan.barMs + e * (plan.beatMs / 2));
      const key = run[(bar * 8 + e) % run.length]!;
      events.push([on, 1, key, 60 + (e % 4) * 8, -1], [on + 120, 0, key]);
    }
    if (bar === 3) events.push([Math.round(4 * plan.barMs - 10), 64, 0]);
  }
  events.sort((a, b) => a[0]! - b[0]!);
  const zero = T0 + 20_000_000;
  const session = improvSession(plan, {
    id: sessionId,
    spec: plan.spec,
    click: false,
    startedAt: zero - 2800,
    zero,
    endedAt: zero + Math.round(bars * plan.barMs),
    events,
    latency: 12,
  })!;
  const takes: TakeChunk[] = [];
  for (let chunk = 0; chunk * perChunk < events.length; chunk++) {
    takes.push({
      id: takeChunkId(sessionId, chunk),
      sessionId,
      pieceId: improvPieceId(plan.spec),
      checksum: backingChecksum(plan),
      hands: 'both',
      repeats: 'play',
      tempo: 100,
      mode: 'rhythm',
      latency: 12,
      startedAt: zero,
      chunk,
      events: events.slice(chunk * perChunk, (chunk + 1) * perChunk),
    });
  }
  return { session, takes };
}
