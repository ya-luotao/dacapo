import { describe, expect, it } from 'vitest';
import { seededRng } from './random.ts';
import {
  beatsPerBar,
  cellBeats,
  cellOnsets,
  CELLS,
  defaultRhythmBpm,
  endsWithNote,
  fitsAt,
  fitsMeter,
  getRhythmLevel,
  nextRhythmLevel,
  parseHandsKey,
  parseRhythmItem,
  RHYTHM_LEVELS,
  rhythmItem,
  rhythmItemInLevel,
  startsWithNote,
} from './rhythmCells.ts';
import {
  buildExercise,
  drawExercise,
  exerciseCounts,
  exerciseOnsets,
  exercisePlan,
  exerciseSteps,
  lineOfKey,
  msPerTick,
  quarterBpm,
  type RhythmExercise,
} from './rhythmExercise.ts';
import { TICKS_PER_QUARTER } from './score.ts';
import { emptyStats, updateStats } from './weakness.ts';

const Q = TICKS_PER_QUARTER;
const WORDS = { trip: 'trip', let: 'let' };

describe('cells', () => {
  it('are whole beats of their meter, triplets and sixteenths in exact ticks', () => {
    const beats = Object.fromEntries(Object.values(CELLS).map((c) => [c.key, c.beats]));
    expect(beats).toMatchObject({
      q: 1,
      qr: 1,
      h: 2,
      w: 4,
      hd: 3,
      'qd-e': 2,
      '~ee': 1,
      ssss: 1,
      'ed-s': 1,
      trip: 1,
      'e-q-e': 2,
      'tie-q-e': 2,
      'c:qe': 1,
      'c:qdr': 1,
    });
    for (const c of Object.values(CELLS)) {
      expect(Number.isInteger(c.beats), c.key).toBe(true);
      for (const n of c.notes) expect(Number.isInteger(n.ticks), c.key).toBe(true);
    }
    expect(CELLS.trip!.notes.map((n) => n.ticks)).toEqual([Q / 3, Q / 3, Q / 3]);
  });

  it('give their onsets in beats: rests and tied notes are not struck', () => {
    expect(cellOnsets('ed-s', '4/4')).toEqual([[0, 0.75]]);
    expect(cellOnsets('trip', '2/4')).toEqual([[0, 1 / 3, 2 / 3]]);
    expect(cellOnsets('er-e', '3/4')).toEqual([[0.5]]);
    expect(cellOnsets('tie-q-e', '4/4')).toEqual([[0, 0.5, 1.5]]);
    expect(cellOnsets('e-q-e', '4/4')).toEqual([[0, 0.5, 1.5]]);
    expect(cellOnsets('~q', '4/4')).toEqual([[]]);
    expect(cellOnsets('~qd-e', '3/4')).toEqual([[1.5]]);
    expect(cellOnsets('qr', '4/4')).toEqual([[]]);
    // 6/8 counts in dotted-quarter beats.
    expect(cellOnsets('c:qe', '6/8')).toEqual([[0, 2 / 3]]);
    expect(cellOnsets('c:eee', '6/8')).toEqual([[0, 1 / 3, 2 / 3]]);
    // Two hands: the right line, then the left one's beat repeated under it.
    expect(cellOnsets('h|q', '4/4')).toEqual([[0], [0, 1]]);
    expect(cellOnsets('trip|ee', '2/4')).toEqual([
      [0, 1 / 3, 2 / 3],
      [0, 0.5],
    ]);
  });

  it('read their items back, whatever colons the cell holds', () => {
    expect(parseRhythmItem(rhythmItem('c:qe', '6/8'))).toEqual({ cell: 'c:qe', meter: '6/8' });
    expect(parseRhythmItem('rhythm:ed-s:4/4')).toEqual({ cell: 'ed-s', meter: '4/4' });
    expect(parseRhythmItem('rhythm:ee|trip:2/4')).toEqual({ cell: 'ee|trip', meter: '2/4' });
    for (const bad of ['rhythm:x:4/4', 'rhythm:q:5/4', 'q:4/4', 'rhythm:q', 'rhythm:c:qe', 3, null])
      expect(parseRhythmItem(bad)).toBeNull();
    // A two-hand key: a known cell over a one-beat cell of simple time, neither tied.
    expect(parseHandsKey('h|q')).toEqual({ right: 'h', left: 'q' });
    for (const bad of ['q|h', 'q|c:qe', '~q|q', 'q|~q', 'q', 'q|q|q'])
      expect(parseHandsKey(bad)).toBeNull();
  });

  it('know where they fit: never across the barline, whole notes on 1, syncopations on 1 or 3', () => {
    expect(fitsAt('w', '4/4', 0)).toBe(true);
    expect(fitsAt('w', '4/4', 1)).toBe(false);
    expect(fitsAt('hd', '4/4', 1)).toBe(true);
    expect(fitsAt('hd', '4/4', 2)).toBe(false);
    expect(fitsAt('h', '3/4', 1)).toBe(true);
    expect(fitsAt('h', '3/4', 2)).toBe(false);
    expect(fitsAt('e-q-e', '4/4', 1)).toBe(false);
    expect(fitsAt('tie-q-e', '4/4', 2)).toBe(true);
    expect(fitsAt('c:qe', '4/4', 0)).toBe(false);
    expect(fitsAt('q', '6/8', 0)).toBe(false);
    expect(fitsAt('c:qd', '6/8', 1)).toBe(true);
    expect(fitsMeter('w', '3/4')).toBe(false);
    expect(fitsMeter('hd', '2/4')).toBe(false);
    expect(fitsAt('w|q', '4/4', 0)).toBe(true);
    expect(fitsAt('hd|q', '3/4', 0)).toBe(true);
    expect(endsWithNote('qr')).toBe(false);
    expect(endsWithNote('ed-s')).toBe(true);
    expect(startsWithNote('er-e')).toBe(false);
    expect(startsWithNote('qr|q')).toBe(true);
  });
});

describe('levels', () => {
  it('run R1 to R10, each adding cells to the ones before (two hands and 6/8 their own)', () => {
    expect(RHYTHM_LEVELS.map((l) => l.id)).toEqual([
      'R1',
      'R2',
      'R3',
      'R4',
      'R5',
      'R6',
      'R7',
      'R8',
      'R9',
      'R10',
    ]);
    expect(getRhythmLevel('R3').cells).toEqual(['q', 'qr', 'h', 'w', 'ee', 'er-e', 'hd', 'qd-e']);
    expect(getRhythmLevel('R4').adds).toEqual(['~q', '~h', '~ee', '~qd-e']);
    expect(getRhythmLevel('R8').meters).toEqual(['6/8']);
    expect(getRhythmLevel('R9').cells).toContain('h|q');
    expect(getRhythmLevel('R10').cells).toContain('trip|ee');
    expect(getRhythmLevel('R10').cells).toContain('ee|trip');
    expect(getRhythmLevel('R10').cells).not.toContain('q|q');
    expect(nextRhythmLevel('R9')).toBe('R10');
    expect(nextRhythmLevel('R10')).toBeNull();
  });

  it('start at 72 beats a minute, or 60 where they draw sixteenths', () => {
    const tempos = RHYTHM_LEVELS.map((l) => defaultRhythmBpm(l.id));
    expect(tempos).toEqual([72, 72, 72, 72, 60, 60, 60, 72, 72, 72]);
  });

  it('have every cell playable in some meter of theirs', () => {
    for (const level of RHYTHM_LEVELS) {
      for (const cell of level.adds)
        expect(
          level.meters.some((m) => rhythmItemInLevel(level, cell, m)),
          `${level.id} ${cell}`,
        ).toBe(true);
    }
    expect(rhythmItemInLevel(getRhythmLevel('R1'), 'w', '3/4')).toBe(false);
    expect(rhythmItemInLevel(getRhythmLevel('R1'), 'ee', '4/4')).toBe(false);
    expect(rhythmItemInLevel(getRhythmLevel('R5'), 'ssss', '3/4')).toBe(false);
  });
});

/** The keys of a drawn exercise's cells, bar by bar. */
const bars = (e: RhythmExercise) => {
  const out: string[][] = [];
  for (const c of e.cells) (out[c.bar] ??= []).push(c.key);
  return out;
};

describe('drawing an exercise', () => {
  it('fills whole bars with cells of the level that fit where they start', () => {
    for (const level of RHYTHM_LEVELS) {
      for (const meter of level.meters) {
        for (let seed = 1; seed <= 40; seed++) {
          const rng = seededRng(seed);
          const e = drawExercise({ level, meter, bars: 4, stats: {}, rng });
          const label = `${level.id} ${meter} #${seed}: ${e.cells.map((c) => c.key).join(' ')}`;
          expect(e.bars, label).toBe(4);
          expect(bars(e).length, label).toBe(4);
          for (const [b, keys] of bars(e).entries()) {
            let at = 0;
            for (const key of keys) {
              expect(level.cells, label).toContain(key);
              expect(fitsAt(key, meter, at), label).toBe(true);
              at += cellBeats(key);
            }
            expect(at, label).toBe(beatsPerBar(meter));
            // A note to play in every bar.
            expect(
              e.cells
                .filter((c) => c.bar === b)
                .some((c) => cellOnsets(c.key, meter).flat().length),
              label,
            ).toBeTruthy();
          }
          const keys = e.cells.map((c) => c.key);
          keys.forEach((key, i) => {
            // Never three in a row, nor two with nothing to play.
            if (i >= 2) expect(keys[i - 1] === key && keys[i - 2] === key, label).toBe(false);
            const silent = (k: string) => cellOnsets(k, meter).flat().length === 0;
            if (i >= 1) expect(silent(key) && silent(keys[i - 1]!), label).toBe(false);
            // A tie needs a note before it, and never follows a tie.
            if (key.startsWith('~')) {
              expect(i, label).toBeGreaterThan(0);
              expect(endsWithNote(keys[i - 1]!), label).toBe(true);
              expect(keys[i - 1]!.startsWith('~'), label).toBe(false);
            }
          });
          // The first cell starts with a note, or off the beat in R7.
          expect(startsWithNote(keys[0]!) || (level.offBeat && keys[0] === 'er-e'), label).toBe(
            true,
          );
        }
      }
    }
  });

  it('is the same for the same seed', () => {
    const level = getRhythmLevel('R6');
    const draw = () =>
      drawExercise({ level, meter: '4/4', bars: 4, stats: {}, rng: seededRng(7) }).cells.map(
        (c) => c.key,
      );
    expect(draw()).toEqual(draw());
  });

  it('starts about half of R7’s exercises off the beat', () => {
    const level = getRhythmLevel('R7');
    let off = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const e = drawExercise({ level, meter: '4/4', bars: 4, stats: {}, rng: seededRng(seed) });
      if (e.cells[0]!.key === 'er-e') off++;
    }
    expect(off).toBeGreaterThan(70);
    expect(off).toBeLessThan(150);
  });

  it('leaves two against three out of R10 until asked for', () => {
    const level = getRhythmLevel('R10');
    for (let seed = 1; seed <= 50; seed++) {
      const e = drawExercise({
        level,
        meter: '2/4',
        bars: 2,
        stats: {},
        rng: seededRng(seed),
        cross: false,
      });
      expect(e.bars).toBe(2);
      for (const c of e.cells) expect(c.key.split('|')).not.toContain('trip');
    }
  });

  it('favours the cells missed', () => {
    const level = getRhythmLevel('R2');
    // Every cell seen and played right, but `ee` always missed.
    const stats: Record<string, ReturnType<typeof emptyStats>> = {};
    for (const cell of level.cells) {
      const item = rhythmItem(cell, '4/4');
      let s = emptyStats(item);
      for (let i = 0; i < 10; i++)
        s = updateStats(s, {
          correct: cell !== 'ee',
          ms: 10,
          hinted: false,
          timedOut: false,
          at: i,
        });
      stats[item] = s;
    }
    const count = (withStats: boolean) => {
      let n = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const e = drawExercise({
          level,
          meter: '4/4',
          bars: 4,
          stats: withStats ? stats : {},
          rng: seededRng(seed),
        });
        n += e.cells.filter((c) => c.key === 'ee').length;
      }
      return n;
    };
    expect(count(true)).toBeGreaterThan(count(false) * 1.5);
  });
});

describe('an exercise in time', () => {
  const e = buildExercise('R6', '4/4', ['q', 'trip', 'ed-s', 'qr', 'h', '~q', 'ee']);

  it('places its notes in exact ticks, ties joined and the final note after the last bar', () => {
    expect(e.bars).toBe(2);
    expect(e.lines).toHaveLength(1);
    const line = e.lines[0]!;
    expect(line.map((n) => n.tick)).toEqual([
      0,
      Q,
      Q + 320,
      Q + 640,
      2 * Q,
      2 * Q + 720,
      3 * Q,
      4 * Q,
      6 * Q,
      7 * Q,
      7 * Q + Q / 2,
      8 * Q,
    ]);
    // The half note is tied into the next cell's quarter.
    expect(line[8]!.tie).toBe(false);
    expect(line[7]!.tied).toBe(false);
    expect(line[7]!).toMatchObject({ type: 'half', tie: true });
    expect(line[8]!).toMatchObject({ type: 'quarter', tied: true });
    expect(line.at(-1)).toMatchObject({ type: 'whole', cell: -1, tick: 8 * Q });
  });

  it('strikes what is neither a rest nor a tie’s end', () => {
    expect(exerciseOnsets(e).map((o) => [o.tick, o.cell])).toEqual([
      [0, 0],
      [Q, 1],
      [Q + 320, 1],
      [Q + 640, 1],
      [2 * Q, 2],
      [2 * Q + 720, 2],
      [4 * Q, 4],
      [7 * Q, 6],
      [7 * Q + Q / 2, 6],
      [8 * Q, -1],
    ]);
  });

  it('is rhythm mode’s plan at the tempo: count-in, clicks, and a last bar of one beat', () => {
    const plan = exercisePlan(e, 60);
    expect(plan.countIn.map((c) => c.at)).toEqual([-4000, -3000, -2000, -1000]);
    expect(plan.countIn.map((c) => c.accent)).toEqual([true, false, false, false]);
    expect(plan.steps.map((s) => s.at)).toEqual([
      0, 1000, 1333.333, 1666.667, 2000, 2750, 4000, 7000, 7500, 8000,
    ]);
    // The click on every beat, the final downbeat's too.
    expect(plan.clicks.map((c) => c.at)).toEqual([
      0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000,
    ]);
    expect(plan.length).toBe(9000);
    expect(plan.steps.every((s) => s.midis.length === 1 && s.midis[0] === 64)).toBe(true);
    // Windows: half the gap to the nearer neighbour, 40–150 ms.
    expect(plan.steps[1]!.window).toBe(150);
    const fast = exercisePlan(buildExercise('R5', '2/4', ['ssss', 'q']), 60);
    expect(fast.steps.map((s) => s.window)).toEqual([125, 125, 125, 125, 125, 150]);
  });

  it('clicks the dotted beat in 6/8, its tempo counted in dotted quarters', () => {
    const six = buildExercise('R8', '6/8', ['c:qe', 'c:eee']);
    expect(quarterBpm('6/8', 60)).toBe(90);
    expect(msPerTick('6/8', 60) * Q).toBeCloseTo(666.667, 3);
    const plan = exercisePlan(six, 60);
    expect(plan.countIn.map((c) => c.at)).toEqual([-2000, -1000]);
    expect(plan.steps.map((s) => s.at)).toEqual([0, 666.667, 1000, 1333.333, 1666.667, 2000]);
    expect(plan.length).toBe(3000);
  });

  it('matches two hands as two keys: the right hand’s line and the left’s', () => {
    const hands = buildExercise('R10', '2/4', ['trip|ee', 'q|er-e']);
    expect(exerciseSteps(hands).map((s) => [s.tick, s.midis])).toEqual([
      [0, [43, 64]],
      [320, [64]],
      [480, [43]],
      [640, [64]],
      [Q, [64]],
      [Q + 480, [43]],
      [2 * Q, [43, 64]],
    ]);
    expect(lineOfKey(60, true)).toBe(0);
    expect(lineOfKey(59, true)).toBe(1);
    expect(lineOfKey(21, false)).toBe(0);
  });
});

describe('counts', () => {
  const texts = (e: RhythmExercise) => exerciseCounts(e, WORDS).map((c) => c.text);

  it('count each beat as finely as it needs, the ones not played on in brackets', () => {
    expect(texts(buildExercise('R2', '4/4', ['q', 'ee', 'qr', 'q']))).toEqual([
      '1',
      '2',
      '&',
      '(3)',
      '4',
      '1',
    ]);
    expect(texts(buildExercise('R3', '2/4', ['qd-e']))).toEqual(['1', '(2)', '&', '1']);
    expect(texts(buildExercise('R5', '2/4', ['ed-s', 'e-ss']))).toEqual([
      '1',
      '(e)',
      '(&)',
      'a',
      '2',
      '(e)',
      '&',
      'a',
      '1',
    ]);
    expect(texts(buildExercise('R6', '2/4', ['trip', 'er-e']))).toEqual([
      '1',
      'trip',
      'let',
      '(2)',
      '&',
      '1',
    ]);
    expect(texts(buildExercise('R4', '3/4', ['q', '~h']))).toEqual(['1', '(2)', '(3)', '1']);
  });

  it('count 6/8 by the eighth, and two against three where something starts', () => {
    expect(texts(buildExercise('R8', '6/8', ['c:qe', 'c:qd']))).toEqual([
      '1',
      '(2)',
      '3',
      '4',
      '1',
    ]);
    expect(texts(buildExercise('R8', '6/8', ['c:eee', 'c:qdr']))).toEqual([
      '1',
      '2',
      '3',
      '(4)',
      '1',
    ]);
    expect(texts(buildExercise('R10', '2/4', ['trip|ee', 'q|ee']))).toEqual([
      '1',
      'trip',
      '&',
      'let',
      '2',
      '&',
      '1',
    ]);
    expect(texts(buildExercise('R9', '3/4', ['h|q', 'q|q']))).toEqual(['1', '2', '3', '1']);
  });

  it('say the triplet in the words given', () => {
    const e = buildExercise('R6', '2/4', ['trip', 'q']);
    expect(exerciseCounts(e, { trip: '连', let: '音' }).map((c) => c.text)).toEqual([
      '1',
      '连',
      '音',
      '2',
      '1',
    ]);
  });
});

describe('every level’s exercise', () => {
  it('has a plan whose steps are its onsets', () => {
    for (const level of RHYTHM_LEVELS) {
      const e = drawExercise({
        level,
        meter: level.meters[0]!,
        bars: 4,
        stats: {},
        rng: seededRng(3),
      });
      const plan = exercisePlan(e, defaultRhythmBpm(level.id));
      const ticks = [...new Set(exerciseOnsets(e).map((o) => o.tick))];
      expect(plan.steps.map((s) => s.step)).toEqual(ticks.map((_, i) => i));
      // The final note on the downbeat after the last bar.
      expect(plan.steps.at(-1)!.at).toBeCloseTo(
        e.bars * beatsPerBar(e.meter) * plan.clicks[1]!.at,
        1,
      );
    }
  });
});

describe('an exercise with cells to work on', () => {
  const level = getRhythmLevel('R5');
  const draw = (focus: readonly string[], seed: number, stats = {}) =>
    drawExercise({ level, meter: '4/4', bars: 4, stats, rng: seededRng(seed), focus });

  it('is made of those cells wherever one can stand', () => {
    // Two cells of one beat each that start and end with a note: every place takes one.
    const focus = level.cells.filter(
      (key) =>
        cellBeats(key) === 1 && startsWithNote(key) && endsWithNote(key) && !key.startsWith('~'),
    );
    expect(focus.length).toBeGreaterThanOrEqual(2);
    const two = focus.slice(0, 2);
    for (let seed = 1; seed <= 40; seed++) {
      const keys = draw(two, seed).cells.map((c) => c.key);
      expect(keys.every((key) => two.includes(key))).toBe(true);
    }
  });

  it('never has the same cell three times in a row, and fills in what they cannot', () => {
    const one = level.cells.find(
      (key) => cellBeats(key) === 1 && startsWithNote(key) && endsWithNote(key),
    )!;
    for (let seed = 1; seed <= 40; seed++) {
      const keys = draw([one], seed).cells.map((c) => c.key);
      keys.forEach((key, i) => {
        if (i >= 2) expect(keys[i - 1] === key && keys[i - 2] === key).toBe(false);
      });
      // Two of three places at least are its own.
      expect(keys.filter((key) => key === one).length * 3).toBeGreaterThanOrEqual(
        keys.length * 2 - 2,
      );
    }
  });

  it('keeps the weights among them: the weak cell comes more often', () => {
    const [weak, other] = level.cells
      .filter((key) => cellBeats(key) === 1 && startsWithNote(key) && endsWithNote(key))
      .filter((key) => !level.adds.includes(key)) as [string, string];
    const seen = (key: string, correct: boolean) =>
      Array.from({ length: 5 }).reduce<ReturnType<typeof emptyStats>>(
        (s) => updateStats(s, { correct, ms: 10, hinted: false, timedOut: false, at: 0 }),
        emptyStats(rhythmItem(key, '4/4')),
      );
    const stats = {
      [rhythmItem(weak, '4/4')]: seen(weak, false),
      [rhythmItem(other, '4/4')]: seen(other, true),
    };
    let weakCount = 0;
    let otherCount = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const cell of draw([weak, other], seed, stats).cells) {
        if (cell.key === weak) weakCount++;
        else if (cell.key === other) otherCount++;
      }
    }
    expect(weakCount).toBeGreaterThan(otherCount * 1.3);
  });

  it('is an exercise of the level as ever without them', () => {
    const plain = drawExercise({ level, meter: '4/4', bars: 4, stats: {}, rng: seededRng(3) });
    expect(draw([], 3)).toEqual(plain);
  });
});
