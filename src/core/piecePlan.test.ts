// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BUILT_IN } from '../pieces/library/index.ts';
import furElise from '../pieces/library/beethoven-fur-elise.musicxml?raw';
import twinkle from '../pieces/library/trad-twinkle-twinkle.musicxml?raw';
import allerAnfang from '../pieces/library/turk-aller-anfang.musicxml?raw';
import { STEADY_RUNS } from './barHeatmap.ts';
import type { PieceSessionRecord } from './log.ts';
import { isPickup } from './memory.ts';
import { parseMusicXml } from './musicxml.ts';
import {
  pieceSession,
  stepId,
  type PieceFacts,
  type PieceStep,
  type PracticeMode,
} from './pieceRecords.ts';
import {
  piecePhrases,
  piecePlan,
  planSource,
  stageStart,
  type PiecePlan,
  type PlanSource,
  type PlanStage,
} from './piecePlan.ts';
import type { PatternId } from './progressions.ts';
import { CLEAN_NOTES, IN_TIME_SHARE } from './review.ts';
import { bar, bars, note, Q, quarters, score } from './scoreFixtures.ts';
import { buildSteps, type HandSelection, type Measure, type Score } from './score.ts';
import { LADDER_START, SCORE_TEMPO } from './tempoLadder.ts';

const PIECE = 'p';
const T0 = Date.UTC(2026, 9, 1, 9);
const MINUTE = 60_000;

/** Whole notes in the left hand, one a bar, in bars `from`–`to` of 4/4. */
const wholes = (from: number, to: number, start = 0) =>
  Array.from({ length: to - from + 1 }, (_, i) =>
    note(from + i, start + (from + i) * 4 * Q, 4 * Q, 48, 'left'),
  );

/** Eight bars of 4/4: quarter notes in the right hand over a whole note in the left. */
const TWO_HANDS = score(bars(8), [...quarters(8, [60, 62, 64, 65]), ...wholes(0, 7)]);
const SOURCE = planSource(TWO_HANDS);

interface RunOptions {
  hands?: HandSelection;
  /** Written bars looped, first and last; the whole piece without. */
  bars?: [number, number];
  /** Times round the loop. */
  laps?: number;
  /** Steps left out at the end: the run was stopped there. */
  cut?: number;
  mode?: PracticeMode;
  ms?: number;
  /** Bars with a wrong note on their first step. */
  wrong?: number[];
  /** Rhythm mode: each key's deviation, and the steps (by position in the run) with a key missed. */
  deviation?: (n: number) => number;
  missed?: number[];
  tempo?: number;
  transpose?: number;
  leftHand?: PatternId;
  checksum?: string;
  pieceId?: string;
  completed?: boolean;
}

let runs = 0;

/** A run of `piece` as its records have it: its step records and its session. */
function run(
  id: string,
  o: RunOptions = {},
  piece: { score: Score; source: PlanSource } = { score: TWO_HANDS, source: SOURCE },
): { session: PieceSessionRecord; steps: PieceStep[] } {
  const hands = o.hands ?? 'both';
  const [from, to] = o.bars ?? [0, piece.score.measures.length - 1];
  const lap = buildSteps(piece.score, hands).filter((s) => s.measure >= from && s.measure <= to);
  const played = Array.from({ length: o.laps ?? 1 }, () => lap).flat();
  // Each run begins a minute after the one before: the heatmap takes the latest.
  const start = T0 + runs++ * MINUTE;
  const steps = played.slice(0, played.length - (o.cut ?? 0)).map((step, n): PieceStep => {
    const first = lap.find((s) => s.measure === step.measure) === step;
    return {
      id: stepId(id, n),
      sessionId: id,
      pieceId: o.pieceId ?? PIECE,
      checksum: o.checksum ?? piece.source.facts.checksum,
      hands,
      measure: step.measure,
      pass: step.pass,
      ms: o.ms ?? 600,
      wrong: first && o.wrong?.includes(step.measure) ? 1 : 0,
      at: start + n * 600,
      ...(o.mode === 'rhythm' && {
        mode: 'rhythm' as const,
        notes: step.midis.map((midi) => ({
          midi,
          deviation: o.missed?.includes(n) ? null : (o.deviation?.(n) ?? 10),
        })),
      }),
      ...(o.mode === 'memory' && { mode: 'memory' as const, prompts: 0, stage: 'all' as const }),
      ...(o.transpose !== undefined && { transpose: o.transpose }),
    };
  });
  const session = pieceSession(
    {
      id,
      pieceId: o.pieceId ?? PIECE,
      title: 'Piece',
      hands,
      loop: o.bars ? { from, to, fromLabel: String(from + 1), toLabel: String(to + 1) } : null,
      repeats: 'play',
      tempo: o.tempo ?? 100,
      startedAt: start,
      ...(o.mode && o.mode !== 'wait' && { mode: o.mode }),
      ...(o.leftHand && { leftHand: o.leftHand }),
      ...(o.transpose !== undefined && { transpose: o.transpose }),
    },
    steps,
    o.completed ?? true,
  );
  return { session, steps };
}

type Run = ReturnType<typeof run>;

/** `STEADY_RUNS` runs of the same, one after the other: what makes their bars steady. */
const thrice = (id: string, o: RunOptions = {}, piece?: Parameters<typeof run>[2]): Run[] =>
  Array.from({ length: STEADY_RUNS }, (_, i) => run(`${id}${i}`, o, piece));

const plan = (list: Run[], source: PlanSource = SOURCE): PiecePlan =>
  piecePlan({
    pieceId: PIECE,
    ...source,
    sessions: list.map((r) => r.session),
    steps: list.flatMap((r) => r.steps),
  });

/** The stages done, row by row, as their names; then the whole piece. */
const done = (p: PiecePlan): string[][] => [
  ...p.rows.map((row) => row.stages.flatMap((s) => (s?.done ? [s.stage] : []))),
  p.whole.done ? ['whole'] : [],
];
/** A stage in a few words: its name with its bars. */
const named = (s: PlanStage | null): string | null =>
  s && (s.bars ? `${s.stage} ${s.bars.fromLabel}-${s.bars.toLabel}` : s.stage);

const readXml = (xml: string): Score =>
  parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'));

describe('the phrases of a piece', () => {
  it('are four bars each, named by their bars, with the bars and steps each hand has', () => {
    expect(piecePhrases(TWO_HANDS)).toEqual([
      {
        from: 0,
        to: 3,
        fromLabel: '1',
        toLabel: '4',
        bars: { right: [0, 1, 2, 3], left: [0, 1, 2, 3], both: [0, 1, 2, 3] },
        steps: { right: 16, left: 4, both: 16 },
      },
      {
        from: 4,
        to: 7,
        fromLabel: '5',
        toLabel: '8',
        bars: { right: [4, 5, 6, 7], left: [4, 5, 6, 7], both: [4, 5, 6, 7] },
        steps: { right: 16, left: 4, both: 16 },
      },
    ]);
    expect(SOURCE.facts.bars).toEqual({ right: 8, left: 8, both: 8 });
  });

  it('take an upbeat into the first phrase', () => {
    // A quarter's upbeat, then eight bars.
    const measures: Measure[] = [bar(0, 0, { duration: Q })];
    for (let i = 1; i <= 8; i++) measures.push(bar(i, Q + (i - 1) * 4 * Q));
    const upbeat = score(measures, [
      note(0, 0, Q, 67),
      ...measures.slice(1).map((m) => note(m.index, m.start, 4 * Q, 60)),
    ]);
    expect(isPickup(measures, 0)).toBe(true);
    expect(piecePhrases(upbeat).map((p) => [p.from, p.to, p.steps.right])).toEqual([
      [0, 4, 5],
      [5, 8, 4],
    ]);
  });

  it('are one phrase for a piece shorter than a phrase', () => {
    const short = score(bars(3), quarters(3));
    const phrases = piecePhrases(short);
    expect(phrases.map((p) => [p.from, p.to])).toEqual([[0, 2]]);
    const p = piecePlan({ pieceId: PIECE, ...planSource(short), sessions: [], steps: [] });
    expect(p.rows.length).toBe(1);
    expect(named(p.next)).toBe('right 1-3');
  });

  it('are counted in written bars: a repeated phrase is one phrase, as a loop takes it', () => {
    const measures = bars(8);
    measures[0] = { ...measures[0]!, repeat: { forward: true, backwardTimes: null, ending: [] } };
    measures[3] = { ...measures[3]!, repeat: { forward: false, backwardTimes: 2, ending: [] } };
    const repeated = score(measures, [...quarters(8), ...wholes(0, 7)]);
    const source = planSource(repeated);
    // Twelve bars are played, eight are written: two phrases, a time through each as written.
    expect(buildSteps(repeated, 'right').length).toBe(48);
    expect(source.phrases.map((p) => [p.from, p.to, p.steps.right])).toEqual([
      [0, 3, 16],
      [4, 7, 16],
    ]);
    // A run with the repeat played passes twice through bars 1 to 4: both passes are the bar's.
    const piece = { score: repeated, source };
    const whole = thrice('r', { hands: 'right' }, piece);
    expect(whole[0]!.steps.filter((s) => s.measure === 0).map((s) => s.pass)).toEqual([
      1, 1, 1, 1, 2, 2, 2, 2,
    ]);
    expect(done(plan(whole, source))).toEqual([['right'], ['right'], []]);
    // A wrong note on the repeat is the bar's wrong note.
    const slip = run('slip', { hands: 'right' }, piece);
    slip.steps.find((s) => s.measure === 2 && s.pass === 2)!.wrong = 1;
    expect(done(plan([...whole, slip], source))).toEqual([[], ['right'], []]);
  });

  it('leave out the stages a hand has no notes for', () => {
    // The left hand comes in at bar 5: the first phrase is the right hand's alone.
    const late = score(bars(8), [...quarters(8), ...wholes(4, 7)]);
    const p = piecePlan({ pieceId: PIECE, ...planSource(late), sessions: [], steps: [] });
    expect(p.stages).toEqual(['right', 'left', 'together', 'inTime']);
    expect(p.rows.map((row) => row.stages.map((s) => s?.stage ?? null))).toEqual([
      ['right', null, null, 'inTime'],
      ['right', 'left', 'together', 'inTime'],
    ]);
    // In time is with both hands, as the piece has two.
    expect(p.rows[0]!.stages[3]).toMatchObject({ hands: 'both', mode: 'rhythm' });
    // A phrase in which nothing is played is no phrase.
    const rest = score(bars(8), quarters(4));
    expect(piecePhrases(rest).map((x) => [x.from, x.to])).toEqual([[0, 3]]);
  });
});

describe('a piece’s plan', () => {
  it('begins with the first phrase’s right hand, and names what starting each stage sets', () => {
    const p = plan([]);
    expect(p.stages).toEqual(['right', 'left', 'together', 'inTime']);
    expect(done(p)).toEqual([[], [], []]);
    const bars14 = { from: 0, to: 3, fromLabel: '1', toLabel: '4' };
    expect(p.next).toEqual({
      stage: 'right',
      phrase: 0,
      bars: bars14,
      hands: 'right',
      mode: 'wait',
      tempo: null,
      done: false,
    });
    expect(p.rows[0]!.stages.map((s) => stageStart(s!))).toEqual([
      { stage: 'right', bars: bars14, hands: 'right', mode: 'wait', tempo: null },
      { stage: 'left', bars: bars14, hands: 'left', mode: 'wait', tempo: null },
      { stage: 'together', bars: bars14, hands: 'both', mode: 'wait', tempo: null },
      // In time: rhythm mode, both hands, at the tempo ladder's rung.
      { stage: 'inTime', bars: bars14, hands: 'both', mode: 'rhythm', tempo: LADDER_START },
    ]);
    // The whole piece: both hands, no loop.
    expect(stageStart(p.whole)).toEqual({
      stage: 'whole',
      bars: null,
      hands: 'both',
      mode: 'wait',
      tempo: null,
    });
  });

  it('has a hand done once every bar of the phrase is steady with it: three runs, none less', () => {
    const two = [
      run('a', { hands: 'right', bars: [0, 3] }),
      run('b', { hands: 'right', bars: [0, 3] }),
    ];
    expect(STEADY_RUNS).toBe(3);
    expect(done(plan(two))).toEqual([[], [], []]);
    const three = [...two, run('c', { hands: 'right', bars: [0, 3] })];
    const p = plan(three);
    expect(done(p)).toEqual([['right'], [], []]);
    expect(named(p.next)).toBe('left 1-4');
    // Three runs of three of its four bars leave the phrase open.
    expect(done(plan(thrice('d', { hands: 'right', bars: [0, 2] })))).toEqual([[], [], []]);
    // A loop that went round three times is one run.
    expect(done(plan([run('e', { hands: 'right', bars: [0, 3], laps: 3 })]))).toEqual([[], [], []]);
  });

  it('counts each hand apart, and together only with both', () => {
    const right = thrice('r', { hands: 'right', bars: [0, 3] });
    const left = thrice('l', { hands: 'left', bars: [0, 3] });
    expect(done(plan([...right, ...left]))).toEqual([['right', 'left'], [], []]);
    expect(named(plan([...right, ...left]).next)).toBe('together 1-4');
    const both = thrice('b', { bars: [0, 3] });
    // Both hands alone do not make either hand's stage.
    expect(done(plan(both))).toEqual([['together'], [], []]);
    expect(named(plan(both).next)).toBe('right 1-4');
  });

  it('does not take a hesitating run, a wrong note or a run by heart for steady', () => {
    const slow = thrice('s', { hands: 'right', bars: [0, 3], ms: 1400 });
    expect(done(plan(slow))).toEqual([[], [], []]);
    const wrong = thrice('w', { hands: 'right', bars: [0, 3], wrong: [1] });
    expect(done(plan(wrong))).toEqual([[], [], []]);
    // Hesitation is wait mode's: memory and rhythm runs are other figures of the heatmap.
    const memory = thrice('m', { hands: 'right', bars: [0, 3], mode: 'memory' });
    const rhythm = thrice('t', { hands: 'right', bars: [0, 3], mode: 'rhythm' });
    expect(done(plan([...memory, ...rhythm]))).toEqual([[], [], []]);
  });

  it('opens a stage again when a bar stops being steady', () => {
    const steady = thrice('r', { hands: 'right', bars: [0, 3] });
    const slip = run('slip', { hands: 'right', bars: [0, 3], wrong: [2] });
    const p = plan([...steady, slip]);
    expect(done(p)).toEqual([[], [], []]);
    expect(named(p.next)).toBe('right 1-4');
    // And closes it once its last three runs are clean again.
    const again = thrice('again', { hands: 'right', bars: [0, 3] });
    expect(done(plan([...steady, slip, ...again]))).toEqual([['right'], [], []]);
  });

  it('goes phrase by phrase through the hands, then in time phrase by phrase, then the whole piece', () => {
    const hands = (bars: [number, number], id: string) => [
      ...thrice(`${id}r`, { hands: 'right', bars }),
      ...thrice(`${id}l`, { hands: 'left', bars }),
      ...thrice(`${id}b`, { bars }),
    ];
    const first = hands([0, 3], 'a');
    // The first phrase is together: the second phrase's right hand, not the first in time.
    expect(named(plan(first).next)).toBe('right 5-8');
    const second = [...first, ...hands([4, 7], 'b')];
    expect(done(plan(second))).toEqual([
      ['right', 'left', 'together'],
      ['right', 'left', 'together'],
      [],
    ]);
    expect(plan(second).next).toMatchObject({ stage: 'inTime', phrase: 0, mode: 'rhythm' });
    const timed = [...second, run('t1', { bars: [0, 3], mode: 'rhythm', tempo: 60 })];
    expect(named(plan(timed).next)).toBe('inTime 5-8');
    const all = [...timed, run('t2', { bars: [4, 7], mode: 'rhythm', tempo: 60 })];
    expect(plan(all).next).toMatchObject({
      stage: 'whole',
      bars: null,
      hands: 'both',
      mode: 'wait',
    });
    // A run to the end: every stage is done, and nothing is next.
    const through = [...all, run('w')];
    expect(done(plan(through)).at(-1)).toEqual(['whole']);
    expect(plan(through).next).toBeNull();
  });

  it('leaves running ahead to the player: a stage done out of order is done, and the first open one is next', () => {
    // The whole piece played to its end, slowly, before anything else: it is in review, and
    // the plan still begins at the beginning.
    const through = [run('w', { ms: 1500 })];
    const p = plan(through);
    expect(done(p)).toEqual([[], [], ['whole']]);
    expect(named(p.next)).toBe('right 1-4');
    // The second phrase in time, before its hands: done, and not what comes next.
    const ahead = plan([...through, run('t', { bars: [4, 7], mode: 'rhythm' })]);
    expect(done(ahead)).toEqual([[], ['inTime'], ['whole']]);
    expect(named(ahead.next)).toBe('right 1-4');
  });

  it('takes the whole piece by a run to the end, as the review does', () => {
    // Stopped before the end, a loop, one hand of two: none is a run to the end.
    const stopped = run('s', { cut: 20, completed: false });
    const loop = run('l', { bars: [0, 7] });
    const hand = run('h', { hands: 'right' });
    expect(done(plan([stopped, loop, hand])).at(-1)).toEqual([]);
    // In rhythm mode or by heart it is one.
    expect(done(plan([run('r', { mode: 'rhythm' })])).at(-1)).toEqual(['whole']);
    expect(done(plan([run('m', { mode: 'memory' })])).at(-1)).toEqual(['whole']);
  });

  it('leaves out the records of another piece, and of another version of the notes', () => {
    const other = thrice('o', { hands: 'right', bars: [0, 3], pieceId: 'q' });
    const old = thrice('v', { hands: 'right', bars: [0, 3], checksum: '00000000' });
    expect(done(plan([...other, ...old]))).toEqual([[], [], []]);
    expect(named(plan([...other, ...old]).next)).toBe('right 1-4');
  });
});

describe('in time', () => {
  /** Sixteen right-hand steps and four left-hand notes a time through: twenty keys. */
  const lap = 16;

  it('is done by one time through the phrase in rhythm mode, clean and in time, at any tempo', () => {
    const once = run('a', { bars: [0, 3], mode: 'rhythm', tempo: 40 });
    expect(done(plan([once]))).toEqual([['inTime'], [], []]);
    // Not in wait mode, however clean; nor with one hand of two.
    expect(done(plan([run('b', { bars: [0, 3] })]))).toEqual([[], [], []]);
    const hand = run('c', { hands: 'right', bars: [0, 3], mode: 'rhythm' });
    expect(done(plan([hand]))).toEqual([[], [], []]);
  });

  it('draws the review’s lines: one note in fifty missed or extra, eighty per cent in time', () => {
    expect([CLEAN_NOTES, IN_TIME_SHARE]).toEqual([50, 0.8]);
    // Twenty keys: one missed is more than one in fifty.
    const missed = run('a', { bars: [0, 3], mode: 'rhythm', missed: [5] });
    expect(done(plan([missed]))).toEqual([[], [], []]);
    const extra = run('b', { bars: [0, 3], mode: 'rhythm', wrong: [2] });
    expect(done(plan([extra]))).toEqual([[], [], []]);
    // Four steps of sixteen (five keys of twenty) 80 ms late: 75 % in time is not enough.
    const late = run('c', { bars: [0, 3], mode: 'rhythm', deviation: (n) => (n < 4 ? 80 : 10) });
    expect(done(plan([late]))).toEqual([[], [], []]);
    // Three steps late (four keys of twenty): 80 % in time is.
    const most = run('d', { bars: [0, 3], mode: 'rhythm', deviation: (n) => (n < 3 ? 80 : 10) });
    expect(done(plan([most]))).toEqual([['inTime'], [], []]);
  });

  it('takes a loop a time through at a time: one clean round is enough', () => {
    // The first round has a missed note, the second is clean, the third was stopped in its
    // second bar with notes missed while reaching for Stop.
    const looped = run('a', {
      bars: [0, 3],
      laps: 3,
      cut: 9,
      mode: 'rhythm',
      missed: [3, 2 * lap + 5, 2 * lap + 6],
    });
    expect(looped.steps.length).toBe(3 * lap - 9);
    expect(done(plan([looped]))).toEqual([['inTime'], [], []]);
    // Without a clean round it is not done.
    const never = run('b', { bars: [0, 3], laps: 2, mode: 'rhythm', missed: [3, lap + 3] });
    expect(done(plan([never]))).toEqual([[], [], []]);
    // A round stopped before its last bar is no time through.
    const cut = run('c', { bars: [0, 3], cut: 4, mode: 'rhythm' });
    expect(done(plan([cut]))).toEqual([[], [], []]);
  });

  it('is told for each phrase from a run of the whole piece', () => {
    // A slip in bar 6: the first phrase was in time, the second was not.
    const through = run('a', { mode: 'rhythm', wrong: [5] });
    expect(done(plan([through]))).toEqual([['inTime'], [], ['whole']]);
    // Stopped in bar 7: bars 1 to 4 were played through, bars 5 to 8 were not.
    const stopped = run('b', { mode: 'rhythm', cut: 8, completed: false });
    expect(done(plan([stopped]))).toEqual([['inTime'], [], []]);
  });

  it('is started at the tempo ladder’s rung', () => {
    const rung = (list: Run[]) => plan(list).rows[0]!.stages[3]!.tempo;
    expect(rung([])).toBe(LADDER_START);
    // The ladder is climbed by runs to the end: a loop leaves it where it was.
    expect(rung([run('a', { bars: [0, 3], mode: 'rhythm', tempo: 80 })])).toBe(LADDER_START);
    expect(rung([run('b', { mode: 'rhythm', tempo: 60 })])).toBe(70);
    // Once the score's tempo is reached the ladder has no next rung: the score's tempo it is.
    expect(rung([run('c', { mode: 'rhythm', tempo: 100 })])).toBe(SCORE_TEMPO);
  });
});

describe('runs that are not of the piece as written', () => {
  it('count for nothing in another key', () => {
    const moved = [
      ...thrice('r', { hands: 'right', bars: [0, 3], transpose: 2 }),
      run('t', { bars: [0, 3], mode: 'rhythm', transpose: 2 }),
      run('w', { transpose: -3 }),
    ];
    expect(done(plan(moved))).toEqual([[], [], []]);
    expect(named(plan(moved).next)).toBe('right 1-4');
  });

  it('count for nothing with a left hand made from the chord symbols, but for the melody', () => {
    // Such a run was played on other notes: its records have another checksum.
    const made = { leftHand: 'block' as const, checksum: '0badc0de' };
    const both = [
      ...thrice('b', { bars: [0, 3], ...made }),
      ...thrice('l', { hands: 'left', bars: [0, 3], ...made }),
      run('t', { bars: [0, 3], mode: 'rhythm', ...made }),
    ];
    expect(done(plan(both))).toEqual([[], [], []]);
    // The right hand alone is the melody as written, whatever the left hand: it counts.
    const melody = thrice('r', { hands: 'right', bars: [0, 3], ...made });
    expect(done(plan(melody))).toEqual([['right'], [], []]);
  });
});

describe('a piece for one hand', () => {
  /** Eight bars of quarter notes, the right hand alone: a lead sheet with its left hand as written. */
  const melody = score(bars(8), quarters(8, [60, 62, 64, 65]));
  const source = planSource(melody);
  const piece = { score: melody, source };

  it('has that hand and In time, and the whole piece with that hand', () => {
    const p = plan([], source);
    expect(source.facts.bars).toEqual({ right: 8, left: 0, both: 8 });
    expect(p.stages).toEqual(['right', 'inTime']);
    expect(p.rows.map((row) => row.stages.map((s) => s?.stage))).toEqual([
      ['right', 'inTime'],
      ['right', 'inTime'],
    ]);
    expect(p.rows[0]!.stages[1]).toMatchObject({ hands: 'right', mode: 'rhythm' });
    expect(p.whole).toMatchObject({ hands: 'right', bars: null });
    expect(named(p.next)).toBe('right 1-4');
  });

  it('counts Both as that hand, as its page does', () => {
    const both = thrice('b', { bars: [0, 3] }, piece);
    expect(done(plan(both, source))).toEqual([['right'], [], []]);
    const right = thrice('r', { hands: 'right', bars: [4, 7] }, piece);
    expect(done(plan(right, source))).toEqual([[], ['right'], []]);
    // In time and to the end with either.
    const timed = [
      run('t1', { bars: [0, 3], mode: 'rhythm' }, piece),
      run('t2', { hands: 'right', bars: [4, 7], mode: 'rhythm' }, piece),
    ];
    expect(done(plan(timed, source))).toEqual([['inTime'], ['inTime'], []]);
    expect(done(plan([run('w', { hands: 'right' }, piece)], source)).at(-1)).toEqual(['whole']);
  });

  it('takes a lead sheet by its melody, whatever plays the left hand', () => {
    // A left hand from the symbols: the right hand's runs are the melody's, in wait mode and in
    // time; a run of both hands to the end still brings the piece into review.
    const made = { leftHand: 'alberti' as const, checksum: '0badc0de' };
    const list = [
      ...thrice('r', { hands: 'right', bars: [0, 3], ...made }, piece),
      run('t', { hands: 'right', bars: [0, 3], mode: 'rhythm', ...made }, piece),
      ...thrice('b', { bars: [4, 7], ...made }, piece),
      run('w', made, piece),
    ];
    const p = plan(list, source);
    expect(done(p)).toEqual([['right', 'inTime'], [], ['whole']]);
    expect(named(p.next)).toBe('right 5-8');
  });
});

describe('the library’s pieces', () => {
  const facts = (id: string): PieceFacts => BUILT_IN.find((p) => p.id === id)!.facts;

  it('Aller Anfang ist schwer: two phrases of four bars, both hands in each', () => {
    const source = planSource(readXml(allerAnfang));
    expect(source.facts).toEqual(facts('turk-aller-anfang'));
    expect(source.phrases.map((p) => [p.fromLabel, p.toLabel])).toEqual([
      ['1', '4'],
      ['5', '8'],
    ]);
    for (const phrase of source.phrases)
      expect([phrase.bars.right.length, phrase.bars.left.length]).toEqual([4, 4]);
    // A time through the phrases takes the steps a run of the piece takes.
    const steps = (hands: HandSelection) => source.phrases.reduce((n, p) => n + p.steps[hands], 0);
    const score = readXml(allerAnfang);
    for (const hands of ['right', 'left', 'both'] as const)
      expect(steps(hands)).toBe(buildSteps(score, hands).length);
    const p = piecePlan({ pieceId: 'turk-aller-anfang', ...source, sessions: [], steps: [] });
    expect(p.stages).toEqual(['right', 'left', 'together', 'inTime']);
    expect(named(p.next)).toBe('right 1-4');
  });

  it('Für Elise: an upbeat, repeats and voltas; every written bar is in one phrase', () => {
    const score = readXml(furElise);
    const source = planSource(score);
    expect(source.facts).toEqual(facts('beethoven-fur-elise'));
    expect(isPickup(score.measures, 0)).toBe(true);
    // The upbeat is the first phrase's.
    expect(source.phrases[0]).toMatchObject({ from: 0, fromLabel: score.measures[0]!.number });
    const covered = source.phrases.flatMap((p) =>
      Array.from({ length: p.to - p.from + 1 }, (_, i) => p.from + i),
    );
    expect(covered).toEqual(score.measures.map((m) => m.index));
    // A phrase is at most four bars (five with the upbeat), and a volta begins one.
    for (const [i, phrase] of source.phrases.entries())
      expect(phrase.to - phrase.from + 1).toBeLessThanOrEqual(i === 0 ? 5 : 4);
    const starts = new Set(source.phrases.map((p) => p.from));
    score.measures.forEach((m, i) => {
      const before = score.measures[i - 1];
      if (
        m.repeat.ending.length > 0 &&
        before &&
        before.repeat.ending.join() !== m.repeat.ending.join()
      )
        expect(starts.has(i), `bar ${m.number}`).toBe(true);
    });
    // The bars each hand plays in the phrases are the bars it plays in the piece.
    for (const hands of ['right', 'left', 'both'] as const)
      expect(source.phrases.reduce((n, p) => n + p.bars[hands].length, 0)).toBe(
        source.facts.bars[hands],
      );
  });

  it('Twinkle, Twinkle, a lead sheet: the right hand, In time and the whole piece', () => {
    const source = planSource(readXml(twinkle));
    expect(source.facts).toEqual(facts('trad-twinkle-twinkle'));
    expect(source.facts.bars.left).toBe(0);
    const p = piecePlan({ pieceId: 'trad-twinkle-twinkle', ...source, sessions: [], steps: [] });
    expect(p.stages).toEqual(['right', 'inTime']);
    expect(p.whole.hands).toBe('right');
  });
});
