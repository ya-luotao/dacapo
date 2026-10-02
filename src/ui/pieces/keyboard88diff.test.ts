// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { PieceTask } from '../../core/assignmentRecords.ts';
import * as assignments from '../../core/assignments.ts';
import * as heat from '../../core/barHeatmap.ts';
import * as expression from '../../core/expression.ts';
import { leftHandPatterns } from '../../core/leadSheet.ts';
import type { PieceSessionRecord } from '../../core/log.ts';
import { hiddenBars, promptsByBar, type MemoryStage } from '../../core/memory.ts';
import { parseMusicXml } from '../../core/musicxml.ts';
import { pieceFacts, type PieceFacts, type PieceStep } from '../../core/pieceRecords.ts';
import * as plan from '../../core/piecePlan.ts';
import { summarizeRun } from '../../core/pieceRun.ts';
import * as standing from '../../core/piecesStanding.ts';
import * as playback from '../../core/playback.ts';
import type { PatternId } from '../../core/progressions.ts';
import { playOrder, type PlayedMeasure, type RepeatMode } from '../../core/repeats.ts';
import * as review from '../../core/review.ts';
import { createMatcher, rhythmPlan } from '../../core/rhythm.ts';
import { summarizeRhythm } from '../../core/rhythmRun.ts';
import { buildSteps, type HandSelection, type Score, type Step } from '../../core/score.ts';
import * as takePb from '../../core/takePlayback.ts';
import type { TakeState } from '../../core/takes.ts';
import * as ladder from '../../core/tempoLadder.ts';
import * as trends from '../../core/trends.ts';
import { waitRange, type BarLoop } from '../../core/wait.ts';
import { transposed, withLeftHand } from '../../pieces/derive.ts';
import { BUILT_IN } from '../../pieces/library/index.ts';
import type { PracticeStore } from '../practice/store.ts';
import * as uiAdvice from './advice.ts';
import {
  recordedRun,
  useRunRecorder,
  waitRecording,
  type RecordableRun,
  type RecordedRun,
  type RunContext,
} from './record.ts';
import { idleRhythm, rhythmReducer, rhythmTakeDone } from './rhythm.ts';
import { runReducer, startRun, type Run } from './run.ts';

// With 88 keys nothing of a piece changes (docs/PERSONAL.md, "The instrument's keys"). This is
// the differential of G6c's review, kept as a test: scripted runs of three pieces (wait, memory
// and rhythm mode; clean, with wrong notes, stopped; whole, looped and from a later bar; one hand
// and both; repeats played and skipped; transposed; with a left hand made from the chord symbols;
// through the recorder hook), then everything stored and everything the readers make of it: the
// review, the tempo ladder, the advice, the trend, the weak bars, an assignment's runs, the
// plan, play back, Compare and the expression.
//
// keyboard88diff.fixture.json has a digest of it all for each run. It was written by this very
// file on the build before the instrument's keys (162fb5c: copy the file there and run it, the
// fixture absent), which is why the accompaniment is wired both ways below, and why nothing
// here names a keyboard except as "none".

/** A piece for two hands, a lead sheet with left-hand patterns, and one with ornaments. */
const PIECES: readonly string[] = [
  'beethoven-ode-to-joy',
  'trad-frere-jacques',
  'petzold-minuet-in-g',
];

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FILES = import.meta.glob<string>('../../pieces/library/*.musicxml', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const xmlOf = (id: string) => FILES[`../../pieces/library/${id}.musicxml`]!;
const domParse = (s: string) => new DOMParser().parseFromString(s, 'application/xml');

const EPOCH = Date.UTC(2026, 9, 2, 9);
const DAY = 86_400_000;

/** A seeded generator (mulberry32): the same runs every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value as text, with what JSON leaves out (maps, sets, infinities) written in. */
const textOf = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) => {
    if (v instanceof Map) return { __map: [...v.entries()] as unknown[] };
    if (v instanceof Set) return { __set: [...v.values()] as unknown[] };
    if (typeof v === 'number' && !Number.isFinite(v)) return `__${String(v)}`;
    if (typeof v === 'function') return '__fn';
    return v;
  }) ?? 'null';

/** A 53-bit hash of a text (cyrb53), as hex. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** The digests: one for each run (everything put under its key), one for each figure of a piece. */
const digests: Record<string, string> = {};
const errors: Record<string, string> = {};
let values = 0;
/** A run's key is its first seven parts: piece, version, hands, repeats, bars, start bar, run. */
const groupOf = (key: string) => key.split('/').slice(0, 7).join('/');
function put(key: string, value: () => unknown) {
  const group = groupOf(key);
  let text: string;
  try {
    text = textOf(value());
  } catch (e) {
    errors[key] = String(e);
    text = 'threw';
  }
  values++;
  digests[group] = hash(`${digests[group] ?? ''} ${key} ${hash(text)}`);
}

interface Setup {
  pieceId: string;
  title: string;
  score: Score;
  checksum: string;
  hands: HandSelection;
  repeats: RepeatMode;
  loop: BarLoop | null;
  startBar: number;
  tempo: number;
  transpose: number;
  leftHand?: PatternId;
}

const labelled = (s: Setup) =>
  s.loop && {
    ...s.loop,
    fromLabel: s.score.measures[s.loop.from]?.number ?? String(s.loop.from + 1),
    toLabel: s.score.measures[s.loop.to]?.number ?? String(s.loop.to + 1),
  };
const contextOf = (s: Setup, mode?: 'rhythm' | 'memory'): RunContext => ({
  pieceId: s.pieceId,
  checksum: s.checksum,
  title: s.title,
  hands: s.hands,
  loop: labelled(s),
  repeats: s.repeats,
  tempo: s.tempo,
  ...(mode && { mode }),
  ...(s.leftHand && { leftHand: s.leftHand }),
  ...(s.transpose !== 0 && { transpose: s.transpose }),
});

/**
 * The accompaniment as the piece's page wires it, the keyboard at its default: with every key
 * the player has, the app plays the other hand when asked to and nothing else. The build before
 * the instrument's keys has no `playedForPlayer`, and wired the other hand itself.
 */
function backingOf(
  s: Setup,
  order: readonly PlayedMeasure[],
  steps: readonly Step[],
  accompany: boolean,
) {
  const scale = s.tempo / 100;
  const common = { score: s.score, order, steps, loop: s.loop, scale };
  const demo = { ...common, hands: s.hands, startBar: s.startBar };
  if ('playedForPlayer' in playback) {
    const forPlayer = playback.playedForPlayer(s.hands, accompany, null);
    const backing = forPlayer
      ? playback.accompanimentPlan({ ...common, hand: null, include: forPlayer })
      : null;
    const timed = forPlayer ? playback.demoPlan({ ...demo, include: forPlayer }) : null;
    return { backing, accompanying: backing !== null, timed };
  }
  const before: typeof import('../../core/playback.ts') = playback;
  const backing =
    s.hands === 'both' ? null : before.accompanimentPlan({ ...common, hand: s.hands });
  const timed =
    s.hands !== 'both' && accompany
      ? before.demoPlan({ ...demo, include: before.otherHand(s.hands) })
      : null;
  return {
    backing: accompany ? backing : null,
    accompanying: accompany && backing !== null,
    timed,
  };
}

interface Done {
  key: string;
  setup: Setup;
  mode: 'wait' | 'memory' | 'rhythm';
  recorded: RecordedRun;
  take: TakeState | null;
  latency: number;
}

interface WaitOptions {
  stage?: MemoryStage;
  stopAfter?: number;
  rounds?: number;
  seed: number;
  at: number;
  clean?: boolean;
}

function waitScenario(key: string, s: Setup, o: WaitOptions): Done | null {
  const raw = rng(o.seed);
  const rand = o.clean ? () => 0.99 : raw;
  const order = playOrder(s.score.measures, s.repeats);
  const steps = buildSteps(s.score, s.hands, order);
  const range = waitRange(steps, order, s.loop, s.startBar);
  put(`${key}/steps`, () => steps);
  put(`${key}/range`, () => range);
  put(`${key}/demoPlan`, () =>
    playback.demoPlan({
      score: s.score,
      order,
      steps,
      hands: s.hands,
      loop: s.loop,
      startBar: s.startBar,
      scale: s.tempo / 100,
    }),
  );
  const acc = backingOf(s, order, steps, true);
  put(`${key}/backing`, () => acc);
  put(`${key}/backingOff`, () => backingOf(s, order, steps, false));
  if (!range) return null;
  const firstBar = steps[range.start ?? range.first]?.measure ?? s.startBar;
  const memory = o.stage
    ? { stage: o.stage, hidden: hiddenBars(s.score.measures, o.stage, firstBar) }
    : null;
  let run = startRun({ id: key, steps, range, memory });
  put(`${key}/wait0`, () => run.wait);
  let time = 1000 + Math.floor(rand() * 500);
  const epoch = (t: number) => o.at + Math.round(t);
  const held: number[] = [];
  const results: string[] = [];
  const press = (midi: number) => {
    const velocity = 40 + Math.floor(rand() * 60);
    const before = run;
    run = runReducer(run, {
      type: 'press',
      midi,
      velocity,
      time,
      at: epoch(time),
      pedals: { 64: 0, 66: 0, 67: 0 },
    });
    results.push(
      [midi, run.wait?.current, run.wait?.wrong, run.records.length, run === before].join(':'),
    );
    held.push(midi);
    time += 1 + Math.floor(rand() * 20);
  };
  const release = (count: number) => {
    while (held.length > count) {
      const midi = held.shift()!;
      run = runReducer(run, { type: 'input', input: { type: 'off', midi, time } });
      time += 1 + Math.floor(rand() * 9);
    }
  };
  const limit = o.stopAfter ?? Infinity;
  const perRound = range.last - range.first + 1;
  const total = s.loop
    ? perRound * (o.rounds ?? 3) - ((range.start ?? range.first) - range.first)
    : Infinity;
  let guard = 0;
  while (run.wait && !run.wait.finished && !run.ended && guard++ < 5000) {
    if (run.records.length >= limit || run.records.length >= total) break;
    const step = run.steps[run.wait.current]!;
    time += o.clean ? 400 : 150 + Math.floor(rand() * 900);
    if (rand() < 0.04) time += 12_000; // The player stops to think.
    if (rand() < 0.06) run = runReducer(run, { type: 'pauseClock' });
    if (memory && rand() < 0.15) run = runReducer(run, { type: 'peek' });
    if (rand() < 0.14) {
      // A wrong key: a neighbour of one of the step's keys, or a stray one.
      const base = step.midis[Math.floor(rand() * step.midis.length)]!;
      const wrong = rand() < 0.5 ? 22 : base + (rand() < 0.5 ? 1 : -1);
      press(wrong);
      if (rand() < 0.3) press(wrong);
    }
    if (rand() < 0.2) {
      const value = Math.floor(rand() * 127);
      run = runReducer(run, {
        type: 'input',
        input: { type: 'pedal', controller: 64, value, time },
      });
    }
    for (const ornament of step.ornaments ?? [])
      if (rand() < 0.8) for (const k of ornament.keys) press(k);
    const midis = [...step.midis];
    if (rand() < 0.5) midis.reverse();
    for (const midi of midis) {
      press(midi);
      if (rand() < 0.1) press(midi);
    }
    for (const ornament of step.ornaments ?? []) if (rand() < 0.5) press(ornament.midi);
    release(rand() < 0.3 ? 2 : 0);
  }
  if (s.loop && o.stopAfter === undefined) run = runReducer(run, { type: 'end' });
  time += 300;
  release(0);
  const ended: Run = run;
  put(`${key}/results`, () => results);
  put(`${key}/run`, () => ({
    records: ended.records,
    wait: ended.wait,
    startedAt: ended.startedAt,
    startedEpoch: ended.startedEpoch,
    ended: ended.ended,
    prompts: ended.prompts,
  }));
  put(`${key}/take`, () => ended.take);
  const recorded = recordedRun(waitRecording(ended), contextOf(s, o.stage ? 'memory' : undefined));
  put(`${key}/recorded`, () => recorded);
  put(`${key}/summary`, () => (ended.records.length ? summarizeRun(ended.records) : null));
  put(`${key}/promptsByBar`, () => (memory ? promptsByBar(ended.records) : null));
  // The other hand, as the page sets it off: at every record, in order.
  put(`${key}/accompanied`, () => {
    const { backing } = acc;
    if (!backing) return null;
    let round = 0;
    let last = -1;
    return ended.records.map((r) => {
      if (last >= 0 && r.step <= last) round++;
      last = r.step;
      return [r.step, round, backing.steps.get(r.step)?.notes.length ?? null];
    });
  });
  if (!recorded) return null;
  return {
    key,
    setup: s,
    mode: o.stage ? 'memory' : 'wait',
    recorded,
    take: ended.take,
    latency: 0,
  };
}

interface RhythmOptions {
  rounds?: number;
  stopAt?: number;
  seed: number;
  at: number;
  latency: number;
  clean?: boolean;
}

function rhythmScenario(key: string, s: Setup, o: RhythmOptions): Done | null {
  const raw = rng(o.seed);
  const rand = o.clean ? () => 0.5 : raw;
  const order = playOrder(s.score.measures, s.repeats);
  const steps = buildSteps(s.score, s.hands, order);
  const timed = rhythmPlan({
    score: s.score,
    order,
    steps,
    loop: s.loop,
    startBar: s.startBar,
    scale: s.tempo / 100,
  });
  put(`${key}/plan`, () => timed);
  put(`${key}/backing`, () => backingOf(s, order, steps, true).timed);
  put(`${key}/backingOff`, () => backingOf(s, order, steps, false).timed);
  if (!timed) return null;
  const matcher = createMatcher(timed);
  const origin = 5000;
  let state = rhythmReducer(idleRhythm('idle'), {
    type: 'start',
    id: key,
    epochOrigin: o.at,
    origin,
    latency: o.latency,
  });
  const results: unknown[] = [];
  const rounds = s.loop ? (o.rounds ?? 2) : 1;
  const firstIndex = Math.max(
    0,
    timed.steps.findIndex((x) => x.at >= timed.start),
  );
  let stopped: number | null = null;
  // Every key of the run, then in the order of time, as input comes.
  const plays: [midi: number, at: number][] = [];
  const pedalsAt: number[] = [];
  const add = (midi: number, at: number) => plays.push([midi, at]);
  add(60, timed.start - 900); // During the count-in.
  outer: for (let round = 0; round < rounds; round++) {
    for (let j = round === 0 ? firstIndex : 0; j < timed.steps.length; j++) {
      const step = timed.steps[j]!;
      const due = round * timed.length + step.at;
      if (o.stopAt !== undefined && due > o.stopAt) {
        stopped = o.stopAt;
        break outer;
      }
      for (const ornament of step.ornaments ?? [])
        if (rand() < 0.7) for (const k of ornament.keys) add(k, due + ornament.from + rand() * 20);
      for (const midi of step.midis) {
        const r = rand();
        if (r < 0.08) continue; // Missed.
        const offset = step.ornaments?.find((x) => x.midi === midi)?.offset ?? 0;
        const off = r < 0.2 ? (rand() - 0.5) * 2 * step.window * 1.3 : (rand() - 0.5) * 70;
        add(midi, due + offset + off);
        if (rand() < 0.03) add(midi, due + offset + 20);
      }
      if (rand() < 0.07) add(22, due + (rand() - 0.5) * 200);
      if (rand() < 0.1) pedalsAt.push(due);
    }
  }
  plays.sort((a, b) => a[1] - b[1]);
  const offs: [midi: number, at: number][] = [];
  let p = 0;
  for (const [midi, at] of plays) {
    if (stopped !== null && at > stopped) break;
    state = rhythmReducer(state, { type: 'settled', timings: matcher.advance(at - 5) });
    while (offs.length && offs[0]![1] <= at) {
      const [m, t] = offs.shift()!;
      state = rhythmReducer(state, {
        type: 'input',
        input: { type: 'off', midi: m, time: origin + t + o.latency },
      });
    }
    while (p < pedalsAt.length && pedalsAt[p]! <= at)
      state = rhythmReducer(state, {
        type: 'input',
        input: { type: 'pedal', controller: 64, value: 100, time: origin + pedalsAt[p++]! },
      });
    const result = matcher.play(midi, at);
    results.push([midi, Math.round(at), result]);
    state = rhythmReducer(state, {
      type: 'played',
      result,
      midi,
      velocity: 30 + Math.floor(rand() * 80),
      time: origin + at + o.latency,
    });
    if (rand() < 0.9) {
      offs.push([midi, at + 60 + rand() * 200]);
      offs.sort((a, b) => a[1] - b[1]);
    }
  }
  const endAt = stopped ?? rounds * timed.length + 10;
  state = rhythmReducer(state, { type: 'settled', timings: matcher.finish(endAt) });
  const done = stopped === null && !s.loop && matcher.done();
  state = rhythmReducer(state, { type: 'end', reason: done ? 'done' : 'stopped' });
  for (const [m, t] of offs)
    state = rhythmReducer(state, {
      type: 'input',
      input: { type: 'off', midi: m, time: origin + Math.max(t, endAt) + o.latency },
    });
  const ended = state;
  put(`${key}/results`, () => results);
  put(`${key}/state`, () => ended);
  const run: RecordableRun = {
    id: ended.id,
    records: ended.last ? ended.records : [],
    startedEpoch: ended.startedEpoch,
    ended:
      ended.status === 'ended'
        ? { completed: ended.end === 'done' || (ended.end === 'stopped' && s.loop !== null) }
        : null,
    take: ended.take,
    takeDone: rhythmTakeDone(ended),
  };
  const recorded = recordedRun(run, contextOf(s, 'rhythm'));
  put(`${key}/recorded`, () => recorded);
  put(`${key}/summary`, () => summarizeRhythm(ended.timings));
  if (!recorded) return null;
  return { key, setup: s, mode: 'rhythm', recorded, take: ended.take, latency: o.latency };
}

interface Stored {
  sessions: PieceSessionRecord[];
  steps: PieceStep[];
}

/** The readers of one run: its own figures, and its take read back. */
function readRun(d: Done, facts: PieceFacts, stored: Stored) {
  const { key, setup: s, recorded } = d;
  const { session, steps } = recorded;
  put(`${key}/r/gradeRun`, () => review.gradeRun(session, steps, facts));
  put(`${key}/r/gradeRunNoSteps`, () => review.gradeRun(session, undefined, facts));
  put(`${key}/r/isWholeRun`, () => [
    review.isWholeRun(session, steps, facts),
    review.isRunToTheEnd(session, steps, facts),
  ]);
  put(`${key}/r/countsForLadder`, () => ladder.countsForLadder(session, steps, facts));
  put(`${key}/r/afterRun`, () => uiAdvice.afterRun(recorded, stored, facts, false));
  put(`${key}/r/afterRunNoSteps`, () =>
    uiAdvice.afterRun(recorded, { sessions: stored.sessions, steps: null }, facts, false),
  );
  put(`${key}/r/observations`, () => trends.pieceStepObservations(steps));
  const past = {
    score: s.score,
    hands: s.hands,
    repeats: s.repeats,
    loop: s.loop,
    mode: d.mode === 'rhythm' ? ('rhythm' as const) : ('wait' as const),
    events: d.take?.events ?? [],
    keys: null,
  };
  const input = { ...past, tempo: s.tempo, latency: d.latency };
  put(`${key}/r/takePlayback`, () => takePb.takePlayback(input));
  put(`${key}/r/compareBar`, () => takePb.comparePlayback(input, 'bar'));
  put(`${key}/r/compareWhole`, () => takePb.comparePlayback(input, 'whole'));
  for (const melody of ['top', 'right'] as const)
    put(`${key}/r/expression-${melody}`, () =>
      expression.analyzeExpression({
        ...past,
        ...(d.mode === 'rhythm' && { scale: s.tempo / 100, latency: d.latency }),
        melody,
      }),
    );
}

/** The recorder hook, with a store that keeps what it is handed. */
function hookPath(
  key: string,
  s: Setup,
  o: { seed: number; at: number; stopAfter?: number; stage?: MemoryStage },
) {
  const order = playOrder(s.score.measures, s.repeats);
  const steps = buildSteps(s.score, s.hands, order);
  const range = waitRange(steps, order, s.loop, s.startBar);
  if (!range) return;
  const calls: unknown[] = [];
  const store = {
    recordPieceStep: (step: unknown, header: unknown) => calls.push(['step', step, header]),
    recordTake: (chunk: unknown) => calls.push(['take', chunk]),
    finishPieceRun: (id: unknown, session: unknown) => calls.push(['finish', id, session]),
  } as unknown as PracticeStore;
  const memory = o.stage
    ? { stage: o.stage, hidden: hiddenBars(s.score.measures, o.stage, 0) }
    : null;
  const context = contextOf(s, o.stage ? 'memory' : undefined);
  function Recorder({ run }: { run: Run }) {
    useRunRecorder(waitRecording(run), context, store);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  const rand = rng(o.seed);
  let run = startRun({ id: key, steps, range, memory });
  const render = () => {
    act(() => {
      root.render(createElement(Recorder, { run }));
    });
  };
  render();
  let time = 1000;
  let guard = 0;
  while (run.wait && !run.wait.finished && guard++ < 3000) {
    if (o.stopAfter !== undefined && run.records.length >= o.stopAfter) break;
    const step = run.steps[run.wait.current]!;
    time += 200 + Math.floor(rand() * 500);
    if (rand() < 0.1)
      run = runReducer(run, { type: 'press', midi: 22, velocity: 50, time, at: o.at + time });
    for (const midi of step.midis) {
      run = runReducer(run, { type: 'press', midi, velocity: 64, time, at: o.at + time });
      run = runReducer(run, { type: 'input', input: { type: 'off', midi, time: time + 90 } });
      time += 4;
    }
    if (rand() < 0.4) render();
  }
  render();
  act(() => {
    root.unmount();
  });
  put(`${key}/hook`, () => calls);
}

/** A piece's facts without the keys it reaches: the build before had none to compare. */
function withoutKeys(facts: PieceFacts): PieceFacts {
  const rest = { ...facts };
  delete rest.keys;
  return rest;
}

interface Version {
  tag: string;
  score: Score;
  transpose: number;
  leftHand?: PatternId;
}

/** Every run of a piece, and every reader of them. */
function drive(piece: (typeof BUILT_IN)[number]) {
  const xml = xmlOf(piece.id);
  const written = parseMusicXml(domParse(xml));
  const versions: Version[] = [{ tag: 'w', score: written, transpose: 0 }];
  for (const pattern of leftHandPatterns(written).slice(0, 2))
    versions.push({
      tag: `lh-${pattern}`,
      score: withLeftHand(xml, written, pattern).score,
      transpose: 0,
      leftHand: pattern,
    });
  versions.push({ tag: 't3', score: transposed(xml, written.hands, 3).score, transpose: 3 });
  const facts = pieceFacts(written);
  put(`${piece.id}/facts`, () => withoutKeys(facts));
  put(`${piece.id}/indexFacts`, () => withoutKeys(piece.facts));
  const stored: Stored = { sessions: [], steps: [] };
  const dones: Done[] = [];
  let n = 0;
  let seed = 1;
  for (const ch of piece.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const bars = written.measures.length;
  const short = { from: Math.min(1, bars - 1), to: Math.min(3, bars - 1) };
  const middle = Math.floor(bars / 2);
  for (const v of versions) {
    // Records are kept under the checksum of the piece as practised, in its written key.
    const { checksum } = v.leftHand ? pieceFacts(v.score) : facts;
    for (const hands of ['both', 'right', 'left'] as const) {
      for (const repeats of ['play', 'skip'] as const) {
        if (repeats === 'skip' && v.tag !== 'w') continue;
        const loops: (BarLoop | null)[] = [null, short];
        if (v.tag === 'w') loops.push({ from: middle, to: middle }, { from: 0, to: bars - 1 });
        for (const loop of loops) {
          const startBars = loop ? [loop.from, loop.to] : [0, Math.floor(bars / 3)];
          for (const startBar of new Set(startBars)) {
            const base: Setup = {
              pieceId: piece.id,
              title: piece.id,
              score: v.score,
              checksum,
              hands,
              repeats,
              loop,
              startBar,
              tempo: 100,
              transpose: v.transpose,
              leftHand: v.leftHand,
            };
            const bar = loop ? `${loop.from}-${loop.to}` : 'all';
            const tag = `${piece.id}/${v.tag}/${hands}/${repeats}/${bar}/b${startBar}`;
            // Each run has its own seed and its own time, three a day.
            const next = () => ({ seed: seed + n, at: EPOCH + n++ * (DAY / 3) });
            const add = (d: Done | null) => {
              if (!d) return;
              dones.push(d);
              stored.sessions.push(d.recorded.session);
              stored.steps.push(...d.recorded.steps);
            };
            const stage = (['all', 'alternate', 'phrases', 'first'] as const)[n % 4];
            add(waitScenario(`${tag}/wait`, base, next()));
            add(waitScenario(`${tag}/wait-stop`, base, { ...next(), stopAfter: 7 }));
            add(waitScenario(`${tag}/memory`, base, { ...next(), stage }));
            add(
              rhythmScenario(`${tag}/rhythm60`, { ...base, tempo: 60 }, { ...next(), latency: 12 }),
            );
            add(rhythmScenario(`${tag}/rhythm100`, base, { ...next(), latency: 0 }));
            add(waitScenario(`${tag}/wait-clean`, base, { ...next(), clean: true }));
            add(
              waitScenario(`${tag}/memory-clean`, base, { ...next(), clean: true, stage: 'first' }),
            );
            for (const tempo of [60, 70, 100])
              add(
                rhythmScenario(
                  `${tag}/rhythm-clean${tempo}`,
                  { ...base, tempo },
                  { ...next(), latency: 0, clean: true },
                ),
              );
            add(
              rhythmScenario(
                `${tag}/rhythm-stop`,
                { ...base, tempo: 80 },
                { ...next(), latency: 0, stopAt: 6000 },
              ),
            );
            if (v.tag === 'w' && repeats === 'play' && startBar === (loop ? loop.from : 0)) {
              hookPath(`${tag}/hook`, base, next());
              hookPath(`${tag}/hook-stop`, base, { ...next(), stopAfter: 5 });
              hookPath(`${tag}/hook-memory`, base, { ...next(), stage: 'alternate' });
            }
          }
        }
      }
    }
  }
  // Each run's own readers, against everything the piece has.
  for (const d of dones) readRun(d, facts, stored);
  // The piece's readers.
  const id = piece.id;
  const { sessions, steps: records } = stored;
  put(`${id}/P/review`, () => review.reviewSchedule(id, sessions, records, facts, 'UTC'));
  put(`${id}/P/reviewNoSteps`, () => review.reviewSchedule(id, sessions, null, facts, 'UTC'));
  put(`${id}/P/reviewNoNotes`, () =>
    review.reviewSchedule(id, sessions, records, { bars: facts.bars }, 'UTC'),
  );
  for (const hands of ['both', 'right', 'left'] as const) {
    put(`${id}/P/ladder-${hands}`, () => ladder.tempoLadder(id, hands, sessions, records, facts));
    const order = playOrder(written.measures, 'play');
    const steps = buildSteps(written, hands, order);
    const handBars = [...new Set(steps.map((x) => x.measure))].sort((a, b) => a - b);
    const options = { checksum: facts.checksum, hands, bars: handBars };
    for (const metric of ['hesitation', 'timing', 'memory'] as const)
      for (const allKeys of [false, true]) {
        put(`${id}/P/heat-${hands}-${metric}-${allKeys}`, () => {
          const barSteps = heat.barStepsIn(steps);
          const map = heat.barHeatmap(records, { ...options, metric, allKeys, barSteps });
          return {
            map,
            weakest: heat.weakestLoop(map.cells, order),
            steady: heat.steadyBars(map.cells),
          };
        });
        put(`${id}/P/heatNoBarSteps-${hands}-${metric}-${allKeys}`, () =>
          heat.barHeatmap(records, { ...options, metric, allKeys }),
        );
      }
    for (const mode of ['wait', 'rhythm', 'memory'] as const)
      for (const taskBars of [null, { ...short, fromLabel: 'a', toLabel: 'b' }]) {
        put(`${id}/P/task-${hands}-${mode}-${taskBars ? 'bars' : 'all'}`, () => {
          const pass = assignments.passSteps(written, hands, taskBars);
          const task: PieceTask = {
            kind: 'piece',
            id: 't',
            piece: { id, title: id, composer: '', checksum: facts.checksum },
            bars: taskBars,
            hands,
            mode,
            tempo: 40,
            runs: 3,
            pass,
          };
          const pieces = [{ id, checksum: facts.checksum }];
          return {
            pass,
            withSteps: assignments.pieceRuns(task, sessions, {
              steps: new Map([[id, records]]),
              pieces,
            }),
            without: assignments.pieceRuns(task, sessions, { pieces }),
          };
        });
      }
  }
  const source = plan.planSource(written);
  put(`${id}/P/plan`, () => plan.piecePlan({ pieceId: id, ...source, sessions, steps: records }));
  put(`${id}/P/nextStep`, () =>
    plan.nextStep({ pieceId: id, ...source, sessions, steps: records }),
  );
  put(`${id}/P/runsToTheEnd`, () =>
    standing
      .runsToTheEnd({ id, facts, out: false, grade: null, leadSheet: false }, sessions, records)
      .map((x) => x.id),
  );
  put(`${id}/P/observations`, () => trends.pieceStepObservations(records));
  return dones.length;
}

it('leaves, with 88 keys, every record and every figure of a piece as it was', async () => {
  let runs = 0;
  for (const piece of BUILT_IN) if (PIECES.includes(piece.id)) runs += drive(piece);
  expect(errors).toEqual({});
  expect(runs).toBeGreaterThan(1000);
  expect(values).toBeGreaterThan(20_000);
  // A line for each run: a difference names the run that changed.
  await expect(`${JSON.stringify(digests, null, 2)}\n`).toMatchFileSnapshot(
    './keyboard88diff.fixture.json',
  );
}, 120_000);
