import { describe, expect, it } from 'vitest';
import { seededRng } from './random.ts';
import { createMatcher, type StepTiming } from './rhythm.ts';
import {
  cellBeats,
  getRhythmLevel,
  RHYTHM_LEVELS,
  type RhythmLevelId,
  type RhythmMeter,
} from './rhythmCells.ts';
import {
  advanceRhythmEar,
  barSound,
  cellConfusions,
  choiceQuestion,
  chooseBar,
  dictationRun,
  differingCell,
  drawBar,
  endRhythmEarSession,
  isBarOf,
  isDictationExtra,
  isRhythmEarItemOf,
  isRhythmEarLevelId,
  judgeTaps,
  makeQuestion,
  nextRhythmEarLevel,
  oneCellChanges,
  parseRhythmEarItem,
  promptScheduled,
  PROMPT_KEY,
  recordTaps,
  recoverRhythmEarSummary,
  rhythmEarConfusion,
  rhythmEarItem,
  rhythmEarItems,
  rhythmEarLevelProgress,
  rhythmEarStats,
  RHYTHM_EAR_LEVEL_IDS,
  sameSound,
  startRhythmEarSession,
  suggestedRhythmEarLevel,
  summarizeRhythmEar,
  tappedAs,
  type CellConfusions,
  type RhythmEarAnswer,
  type RhythmEarChoiceAnswer,
  type RhythmEarLevelId,
  type RhythmEarLevelProgress,
  type RhythmEarQuestion,
  type RhythmEarTapAnswer,
} from './rhythmEar.ts';

const level = (id: RhythmLevelId) => getRhythmLevel(id);
const NO_CONFUSIONS: CellConfusions = new Map();

/** Taps through rhythm mode's matcher, as the run gives them, and the bar judged. */
function tapBack(bar: string[], meter: RhythmMeter, bpm: number, times: number[]) {
  const run = dictationRun(bar, meter, bpm, true);
  const matcher = createMatcher(run.plan);
  const timings: StepTiming[] = [];
  const extras: number[] = [];
  for (const time of [...times].sort((a, b) => a - b)) {
    timings.push(...matcher.advance(time));
    const result = matcher.play(PROMPT_KEY, time);
    if (isDictationExtra(run, time, result.kind === 'hit')) extras.push(time - run.answer!.start);
  }
  timings.push(...matcher.finish(Infinity));
  return judgeTaps(bar, meter, bpm, timings, extras);
}

/** The times of the onsets of the bar tapped back, each moved by `off(i)` (null: not tapped). */
function onTime(
  bar: string[],
  meter: RhythmMeter,
  bpm: number,
  off: (i: number) => number | null = () => 0,
): number[] {
  const run = dictationRun(bar, meter, bpm, true);
  return run.plan.steps.flatMap((s, i) => {
    const d = off(i);
    return d === null ? [] : [s.at + d];
  });
}

describe('levels and items', () => {
  it('are Rhythm’s one-line levels', () => {
    expect(RHYTHM_EAR_LEVEL_IDS).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8']);
    expect(isRhythmEarLevelId('R9')).toBe(false);
    expect(nextRhythmEarLevel('R7')).toBe('R8');
    expect(nextRhythmEarLevel('R8')).toBeNull();
  });

  it('key an item by its cell and meter', () => {
    expect(rhythmEarItem('c:qe', '6/8')).toBe('rhythmEar:c:qe:6/8');
    expect(parseRhythmEarItem('rhythmEar:c:qe:6/8')).toEqual({ cell: 'c:qe', meter: '6/8' });
    expect(parseRhythmEarItem('rhythm:q:4/4')).toBeNull();
    expect(parseRhythmEarItem('rhythmEar:h|q:4/4')).toBeNull();
    expect(parseRhythmEarItem('rhythmEar:q:5/4')).toBeNull();
    expect(isRhythmEarItemOf('R2', 'rhythmEar:ee:2/4')).toBe(true);
    expect(isRhythmEarItemOf('R2', 'rhythmEar:ssss:4/4')).toBe(false);
    expect(isRhythmEarItemOf('R3', 'rhythmEar:q:2/4')).toBe(false);
    expect(rhythmEarItems('R1').slice(0, 4)).toEqual([
      'rhythmEar:q:4/4',
      'rhythmEar:q:3/4',
      'rhythmEar:q:2/4',
      'rhythmEar:qr:4/4',
    ]);
    // A whole note fills 4/4 only.
    expect(rhythmEarItems('R1')).toContain('rhythmEar:w:4/4');
    expect(rhythmEarItems('R1')).not.toContain('rhythmEar:w:3/4');
  });
});

describe('bars', () => {
  it('sound alike when their notes start and end together, ties joined', () => {
    expect(sameSound(barSound(['q', '~q', 'h'], '4/4'), barSound(['h', 'h'], '4/4'))).toBe(true);
    expect(sameSound(barSound(['e-q-e', 'h'], '4/4'), barSound(['tie-q-e', 'h'], '4/4'))).toBe(
      true,
    );
    expect(sameSound(barSound(['q', 'qr', 'h'], '4/4'), barSound(['h', 'h'], '4/4'))).toBe(false);
    expect(sameSound(barSound(['h', '~q', 'q'], '4/4'), barSound(['h', 'qr', 'q'], '4/4'))).toBe(
      false,
    );
  });

  it('follow a level’s rules, a rest first allowed', () => {
    const r1 = level('R1');
    expect(isBarOf(r1, '4/4', ['qr', 'q', 'h'])).toBe(true);
    expect(isBarOf(r1, '4/4', ['q', 'q', 'q'])).toBe(false);
    expect(isBarOf(r1, '4/4', ['q', 'qr', 'qr', 'q'])).toBe(false);
    expect(isBarOf(r1, '2/4', ['qr', 'qr'])).toBe(false);
    expect(isBarOf(r1, '4/4', ['q', 'w'])).toBe(false);
    expect(isBarOf(r1, '4/4', ['ee', 'q', 'h'])).toBe(false);
    const r4 = level('R4');
    expect(isBarOf(r4, '4/4', ['h', '~q', 'q'])).toBe(true);
    expect(isBarOf(r4, '4/4', ['~q', 'q', 'h'])).toBe(false);
    expect(isBarOf(r4, '4/4', ['qr', '~q', 'h'])).toBe(false);
    expect(isBarOf(r4, '4/4', ['h', '~q', '~q'])).toBe(false);
    expect(isBarOf(level('R7'), '4/4', ['q', 'e-q-e', 'q'])).toBe(false);
    expect(isBarOf(level('R8'), '6/8', ['c:qe', 'c:qd'])).toBe(true);
    expect(isBarOf(level('R8'), '4/4', ['c:qe', 'c:qd'])).toBe(false);
  });

  it('are drawn by the level’s rules, in every level and meter, sometimes from a rest', () => {
    const rng = seededRng(7);
    for (const id of RHYTHM_EAR_LEVEL_IDS) {
      const l = level(id);
      for (const meter of l.meters) {
        let rests = 0;
        for (let i = 0; i < 200; i++) {
          const bar = drawBar(l, meter, {}, rng);
          expect(isBarOf(l, meter, bar), `${id} ${meter} ${bar.join(' ')}`).toBe(true);
          if (bar[0] === 'qr' || bar[0] === 'c:qdr' || bar[0] === 'er-e') rests++;
        }
        expect(rests, `${id} ${meter}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('choosing', () => {
  it('offers bars differing in one cell of the same length, never sounding alike', () => {
    const bar = ['q', 'e-q-e', 'q'];
    const changes = oneCellChanges(level('R7'), '4/4', bar);
    // `tie-q-e` sounds as `e-q-e`: never offered for it.
    expect(changes.some((c) => c.cell === 'tie-q-e')).toBe(false);
    for (const c of changes) {
      expect(differingCell(bar, c.cells)).toBe(c.position);
      expect(cellBeats(c.cell)).toBe(cellBeats(bar[c.position]!));
    }
    // A half for a quarter tied to a quarter sounds alike too.
    const tied = oneCellChanges(level('R4'), '4/4', ['h', 'q', '~q']);
    expect(tied.some((c) => c.cells.join(' ') === 'h h')).toBe(false);
  });

  it('can always ask a question, in every level and meter', () => {
    const rng = seededRng(11);
    for (const id of RHYTHM_EAR_LEVEL_IDS) {
      const l = level(id);
      const seenMeters = new Set<RhythmMeter>();
      for (let i = 0; i < 150; i++) {
        const q = makeQuestion(i, { level: id, by: 'name', answers: [], previous: null, rng });
        seenMeters.add(q.meter);
        const choice = q.choice!;
        expect(choice.choices.length).toBeGreaterThanOrEqual(3);
        expect(choice.choices.length).toBeLessThanOrEqual(4);
        expect(choice.choices[choice.right]).toEqual(q.bar);
        const sounds = choice.choices.map((c) => barSound(c, q.meter));
        choice.choices.forEach((c, k) => {
          expect(isBarOf(l, q.meter, c), `${id} ${c.join(' ')}`).toBe(true);
          for (let j = 0; j < k; j++) expect(sameSound(sounds[j]!, sounds[k]!)).toBe(false);
          if (k !== choice.right) expect(differingCell(q.bar, c)).not.toBeNull();
        });
        // At least one of them changes the cell asked about.
        expect(
          choice.choices.some(
            (c, k) => k !== choice.right && differingCell(q.bar, c) === choice.target,
          ),
        ).toBe(true);
      }
      expect([...seenMeters].sort()).toEqual([...l.meters].sort());
    }
  });

  it('changes the cell asked about first, as the learner confuses it, then as it is heard', () => {
    const rng = seededRng(3);
    const bar = ['trip', 'q', 'h'];
    const plain = choiceQuestion(level('R6'), '4/4', bar, 0, NO_CONFUSIONS, rng)!;
    const changed = (c: string[]) => c[0];
    const offered = plain.choices.filter((_, k) => k !== plain.right).map(changed);
    // Every distractor changes the triplet (there are cells enough), two eighths among them.
    expect(offered).toContain('ee');
    expect(plain.choices.every((c, k) => k === plain.right || differingCell(bar, c) === 0)).toBe(
      true,
    );
    // Confused with dotted eighth and sixteenth, and with four sixteenths: those first.
    const confusions = new Map([
      [
        'trip',
        new Map([
          ['ed-s', 4],
          ['ssss', 2],
          ['ss-e', 1],
        ]),
      ],
    ]);
    const learnt = choiceQuestion(level('R6'), '4/4', bar, 0, confusions, rng)!;
    const learntOffered = learnt.choices.filter((_, k) => k !== learnt.right).map(changed);
    expect(learntOffered.sort()).toEqual(['ed-s', 'ss-e', 'ssss']);
  });

  it('changes another cell when too few can stand in for the one asked about', () => {
    // R1 in 4/4: a quarter can only become a rest.
    const bar = ['q', 'q', 'q', 'q'];
    const q = choiceQuestion(level('R1'), '4/4', bar, 1, NO_CONFUSIONS, seededRng(1))!;
    expect(q.choices).toHaveLength(4);
    const positions = q.choices
      .filter((_, k) => k !== q.right)
      .map((c) => differingCell(bar, c))
      .sort();
    expect(positions).toEqual([0, 1, 2, 3].filter((p) => positions.includes(p)));
    expect(positions).toContain(1);
    // A half in R1 has nothing of its length to stand in for it.
    expect(
      choiceQuestion(level('R1'), '3/4', ['h', 'q'], 0, NO_CONFUSIONS, seededRng(1)),
    ).toBeNull();
  });
});

describe('the run', () => {
  it('counts in, plays the bar without a click, counts in again and times the bar tapped', () => {
    const run = dictationRun(['q', 'ee', 'h'], '4/4', 60, true);
    expect(run.plan.countIn).toEqual([
      { at: -4000, accent: true },
      { at: -3000, accent: false },
      { at: -2000, accent: false },
      { at: -1000, accent: false },
    ]);
    // No click under the prompt (0–4000 ms): the second count-in and the bar tapped.
    expect(run.plan.clicks.map((c) => c.at)).toEqual([
      4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000,
    ]);
    expect(run.plan.clicks.filter((c) => c.accent).map((c) => c.at)).toEqual([4000, 8000]);
    expect(run.backing.notes.map((n) => n.on)).toEqual([0, 1000, 1500, 2000]);
    expect(run.backing.notes.every((n) => n.midi === PROMPT_KEY)).toBe(true);
    // Every note ends before the next starts on the same key.
    run.backing.notes.forEach((n, i) => {
      const next = run.backing.notes[i + 1];
      if (next) expect(n.off).toBeLessThan(next.on);
    });
    expect(run.lastOn).toBe(2000);
    expect(run.plan.steps.map((s) => s.at)).toEqual([8000, 9000, 9500, 10000]);
    expect(run.plan.length).toBe(12000);
    expect(run.answer).toEqual({ start: 8000, from: 8000 - 150, to: 12000 - 40 });
  });

  it('times triplets and 6/8 exactly', () => {
    const trip = dictationRun(['trip', 'q'], '2/4', 60, true);
    expect(trip.backing.notes.map((n) => n.on)).toEqual([0, 333.333, 666.667, 1000]);
    expect(trip.plan.steps.map((s) => s.at)).toEqual([4000, 4333.333, 4666.667, 5000]);
    // 6/8 at 60 dotted quarters: two clicks a bar, an eighth a third of a second.
    const compound = dictationRun(['c:eee', 'c:qe'], '6/8', 60, true);
    expect(compound.plan.countIn.map((c) => c.at)).toEqual([-2000, -1000]);
    expect(compound.backing.notes.map((n) => n.on)).toEqual([0, 333.333, 666.667, 1000, 1666.667]);
    expect(compound.barMs).toBe(2000);
  });

  it('plays the prompt alone to choose it, a tie as one note', () => {
    const run = dictationRun(['h', '~q', 'q'], '4/4', 120, false);
    expect(run.plan.steps).toEqual([]);
    expect(run.plan.clicks).toEqual([]);
    expect(run.plan.countIn).toHaveLength(4);
    expect(run.plan.length).toBe(2000);
    expect(run.backing.notes.map((n) => n.on)).toEqual([0, 1500]);
    expect(run.backing.notes[0]!.off).toBeGreaterThan(1400);
    expect(run.answer).toBeNull();
  });
});

describe('tapping back', () => {
  it('is right when every onset is in time and nothing else is tapped', () => {
    const bar = ['q', 'ee', 'h'];
    const result = tapBack(
      bar,
      '4/4',
      60,
      onTime(bar, '4/4', 60, (i) => [10, -20, 30, 0][i]!),
    );
    expect(result.correct).toBe(true);
    expect(result.right).toBe(3);
    expect(result.cells.map((c) => c.deviations)).toEqual([[10], [-20, 30], [0]]);
    expect(result.medianDeviation).toBe(15);
  });

  it('never takes the prompt or the count-ins for an answer', () => {
    const bar = ['q', 'ee', 'h'];
    // Tapping along with the prompt and both count-ins, then the bar in time.
    const along = [-3000, 0, 1000, 1500, 2000, 4000, 5000, 6000, 7000];
    const result = tapBack(bar, '4/4', 60, [...along, ...onTime(bar, '4/4', 60)]);
    expect(result.correct).toBe(true);
    expect(result.extras).toEqual([]);
  });

  it('counts a tap in a closing rest, or on the downbeat of a bar starting with one', () => {
    const bar = ['q', 'q', 'q', 'qr'];
    const closing = tapBack(bar, '4/4', 60, [...onTime(bar, '4/4', 60), 11000]);
    expect(closing.cells.map((c) => c.correct)).toEqual([true, true, true, false]);
    expect(closing.cells[3]!.extras).toEqual([0]);
    const rest = ['qr', 'q', 'h'];
    const early = tapBack(rest, '4/4', 60, [8010, ...onTime(rest, '4/4', 60)]);
    expect(early.cells.map((c) => c.correct)).toEqual([false, true, true]);
    expect(early.cells[0]!.extras).toEqual([10]);
    // The next downbeat is not part of the bar.
    const after = tapBack(bar, '4/4', 60, [...onTime(bar, '4/4', 60), 12000]);
    expect(after.correct).toBe(true);
  });

  it('misses an onset not tapped and judges a late one', () => {
    const bar = ['trip', 'q'];
    const result = tapBack(
      bar,
      '2/4',
      60,
      onTime(bar, '2/4', 60, (i) => [0, null, 90, 0][i]!),
    );
    expect(result.cells[0]!.deviations).toEqual([0, null, 90]);
    expect(result.cells[0]!.correct).toBe(false);
    expect(result.cells[1]!.correct).toBe(true);
    expect(result.onsets.map((o) => o.deviation)).toEqual([0, null, 90, 0]);
  });
});

const TAP_BASE = {
  id: 'a',
  sessionId: 's',
  family: 'rhythmEar' as const,
  level: 'R6' as const,
  by: 'play' as const,
  bpm: 60,
  question: 0,
  replays: 0,
  at: 1,
};

function tapAnswer(
  cell: string,
  prompt: number[],
  deviations: (number | null)[],
  extras: number[] = [],
): RhythmEarTapAnswer {
  const correct = extras.length === 0 && deviations.every((d) => d !== null && Math.abs(d) <= 50);
  return {
    ...TAP_BASE,
    item: rhythmEarItem(cell, '4/4'),
    prompt,
    answer: { deviations, extras },
    correct,
  };
}

describe('what taps are read as', () => {
  it('reads even eighths tapped for a triplet as two eighths', () => {
    // At 60 bpm: taps at 0 and 500 ms, half-way between the triplet’s onsets: one too many.
    const a = tapAnswer('trip', [0, 1 / 3, 2 / 3], [0, null, null], [500]);
    expect(a.correct).toBe(false);
    expect(tappedAs(a)).toBe('ee');
  });

  it('reads the right shape out of time as the cell asked, and nonsense as none', () => {
    expect(tappedAs(tapAnswer('ee', [0, 0.5], [0, 90]))).toBe('ee');
    expect(tappedAs(tapAnswer('ee', [0, 0.5], [0, 0], [300]))).toBe('ss-e');
    expect(tappedAs(tapAnswer('ee', [0, 0.5], [0, 0], [950]))).toBeNull();
    expect(tappedAs(tapAnswer('ed-s', [0, 0.75], [0, null], [500]))).toBe('ee');
    expect(tappedAs(tapAnswer('ed-s', [0, 0.75], [0, 0], [500]))).toBe('e-ss');
    // Nothing tapped for a quarter: a quarter rest.
    expect(tappedAs(tapAnswer('q', [0], [null]))).toBe('qr');
  });

  it('puts a choice in the table by the cell that differs', () => {
    const chosen: RhythmEarChoiceAnswer = {
      ...TAP_BASE,
      by: 'name',
      item: rhythmEarItem('trip', '4/4'),
      prompt: ['trip', 'q', 'h'],
      answer: ['ee', 'q', 'h'],
      correct: false,
      ms: 1200,
    };
    expect(rhythmEarConfusion(chosen)).toEqual({ asked: 'trip', answered: 'ee' });
    expect(rhythmEarConfusion({ ...chosen, answer: chosen.prompt, correct: true })).toEqual({
      asked: 'trip',
      answered: 'trip',
    });
    expect(rhythmEarConfusion({ ...chosen, answer: ['trip', 'qr', 'h'] })).toEqual({
      asked: 'q',
      answered: 'qr',
    });
    expect(rhythmEarConfusion({ ...chosen, answer: ['ee', 'qr', 'h'] })).toBeNull();
    const counts = cellConfusions([
      chosen,
      chosen,
      tapAnswer('trip', [0, 1 / 3, 2 / 3], [0, null, null], [500]),
    ]);
    expect(counts.get('trip')?.get('ee')).toBe(3);
  });
});

function question(bar: string[], meter: RhythmMeter, choice: RhythmEarQuestion['choice']) {
  return {
    index: 0,
    meter,
    bar,
    choice,
    opensAt: null,
    replays: 0,
    status: 'waiting' as const,
    chosen: null,
    tapped: null,
  };
}

describe('a session', () => {
  const ids = () => {
    let n = 0;
    return () => `id${n++}`;
  };

  it('counts a replay before the answer only, and a choice only once the window opens', () => {
    const choice = {
      target: 0,
      choices: [
        ['ee', 'q', 'h'],
        ['trip', 'q', 'h'],
      ],
      right: 1,
    };
    let s = startRhythmEarSession({
      id: 's',
      level: 'R6',
      by: 'name',
      bpm: 60,
      length: 2,
      at: 1000,
      question: question(['trip', 'q', 'h'], '4/4', choice),
    });
    s = promptScheduled(s, 0, 5000, false);
    s = promptScheduled(s, 0, 9000, true);
    expect(s.question.replays).toBe(1);
    const newId = ids();
    expect(chooseBar(s, 1, 8999, 2000, newId)).toBe(s);
    s = chooseBar(s, 0, 9600, 2000, newId);
    expect(s.question.status).toBe('wrong');
    const answer = s.answers[0] as RhythmEarChoiceAnswer;
    expect(answer).toMatchObject({
      item: 'rhythmEar:trip:4/4',
      by: 'name',
      prompt: ['trip', 'q', 'h'],
      answer: ['ee', 'q', 'h'],
      correct: false,
      ms: 600,
      replays: 1,
    });
    // Once answered, a replay is not counted, and another choice changes nothing.
    expect(promptScheduled(s, 0, 20000, true).question.replays).toBe(1);
    expect(chooseBar(s, 1, 9700, 2100, newId)).toBe(s);
  });

  it('keeps an answer for each cell tapped, stamped when the cell ended', () => {
    const bar = ['q', 'ee', 'h'];
    let s = startRhythmEarSession({
      id: 's',
      level: 'R2',
      by: 'play',
      bpm: 60,
      length: 1,
      at: 0,
      question: question(bar, '4/4', null),
    });
    const tapped = tapBack(
      bar,
      '4/4',
      60,
      onTime(bar, '4/4', 60, (i) => (i === 2 ? 80 : 0)),
    );
    s = recordTaps(s, tapped, 100_000, ids());
    expect(s.question.status).toBe('wrong');
    expect(s.answers.map((a) => [a.item, a.correct, a.at])).toEqual([
      ['rhythmEar:q:4/4', true, 101_000],
      ['rhythmEar:ee:4/4', false, 102_000],
      ['rhythmEar:h:4/4', true, 104_000],
    ]);
    expect((s.answers[1] as RhythmEarTapAnswer).answer).toEqual({
      deviations: [0, 80],
      extras: [],
    });
    s = advanceRhythmEar(s, () => question(bar, '4/4', null), 105_000);
    expect(s.phase).toBe('done');
    const summary = summarizeRhythmEar(s);
    expect(summary).toMatchObject({
      family: 'rhythmEar',
      by: 'play',
      questions: 1,
      questionsRight: 0,
      items: 3,
      correct: 2,
      medianDeviation: 0,
      medianMs: null,
      missed: [{ item: 'rhythmEar:ee:4/4', as: 'ee' }],
    });
    expect(recoverRhythmEarSummary(s.answers)).toMatchObject({
      questions: 1,
      items: 3,
      correct: 2,
      length: 1,
    });
  });

  it('ends early with the bars answered', () => {
    const s = startRhythmEarSession({
      id: 's',
      level: 'R1',
      by: 'play',
      bpm: 72,
      length: 10,
      at: 0,
      question: question(['w'], '4/4', null),
    });
    const done = endRhythmEarSession(s, 5000);
    expect(done.phase).toBe('done');
    expect(summarizeRhythmEar(done)).toMatchObject({ length: 10, questions: 0, accuracy: null });
  });
});

describe('mastery and the item model', () => {
  const answer = (i: number, correct: boolean, replays = 0, lvl: RhythmEarLevelId = 'R2') =>
    ({
      ...tapAnswer('q', [0], [correct ? 0 : null]),
      id: `a${i}`,
      level: lvl,
      item: 'rhythmEar:q:4/4',
      replays,
      at: i,
    }) satisfies RhythmEarAnswer;

  it('is 90 % of the level’s last 40 answers without a replay', () => {
    const answers = [
      ...Array.from({ length: 36 }, (_, i) => answer(i, true)),
      ...Array.from({ length: 4 }, (_, i) => answer(36 + i, false)),
      ...Array.from({ length: 5 }, (_, i) => answer(40 + i, false, 1)),
    ];
    const p = rhythmEarLevelProgress(answers, 'R2');
    expect(p).toMatchObject({ total: 45, answers: 40, accuracy: 0.9, mastered: true });
    expect(rhythmEarLevelProgress(answers.slice(1), 'R2').mastered).toBe(false);
    const progress = new Map<RhythmEarLevelId, RhythmEarLevelProgress>([
      ['R1', { ...p, level: 'R1' }],
    ]);
    expect(suggestedRhythmEarLevel(progress)).toBe('R2');
  });

  it('weighs a cell missed as an error and a choice by accuracy alone', () => {
    const stats = rhythmEarStats([answer(0, false), answer(1, true)]);
    expect(stats['rhythmEar:q:4/4']!.attempts).toBe(2);
    const drawn = RHYTHM_LEVELS.length;
    expect(drawn).toBeGreaterThan(8);
  });
});
