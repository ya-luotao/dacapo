import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_VERSION,
  PROBLEM_MIN_MS,
  PROBLEM_MIN_Z,
  type PlayedNote,
  type RunHeadline,
} from './evenness.ts';
import type { SessionRecord } from './log.ts';
import { seededRng, type Rng } from './random.ts';
import {
  byWeakness,
  DEGREE_MIN_Z,
  MIN_RUNS,
  placesOverRuns,
  RECENT_RUNS,
  runFigures,
  scaleProgress,
  suggestedExercise,
  type ExerciseProgress,
} from './scaleProgress.ts';
import { withRun, type ScaleSession, type StoredScaleRun } from './scaleRecords.ts';
import { parseExerciseKey, scaleNotes } from './scales.ts';
import type { ScaleNote } from './scaleTypes.ts';
import type { Hand } from './score.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** 2026-09-27 12:00 UTC. */
const NOW = Date.UTC(2026, 8, 27, 12);

interface HandSpec {
  hand?: Hand;
  spread?: number | null;
  share?: number | null;
  rough?: boolean;
  hesitations?: number;
}

function headline(hands: HandSpec[] = [{}], version = ANALYSIS_VERSION): RunHeadline {
  return {
    version,
    quality: 'ok',
    counts: { expected: 29, matched: 29, wrong: 0, missed: 0, extra: 0 },
    velocityMeasured: true,
    hands: hands.map((h, i) => ({
      hand: h.hand ?? (i === 0 ? 'right' : 'left'),
      spread: h.spread === undefined ? 20 : h.spread,
      spreadShare: h.share === undefined ? 8 : h.share,
      rough: h.rough ?? false,
      hesitations: h.hesitations ?? 0,
      medianInterval: 250,
    })),
  };
}

interface RunSpec {
  exercise?: string;
  at: number;
  hands?: HandSpec[];
  version?: number;
}

let nextId = 0;
/** One session per call, its runs in the order given. */
function session(...runs: RunSpec[]): ScaleSession {
  const id = `s${nextId++}`;
  let s: ScaleSession | null = null;
  runs.forEach((r, n) => {
    s = withRun(s, id, {
      id: `${id}:${n}`,
      exercise: r.exercise ?? 'major:C:2:right',
      startedAt: r.at,
      endedAt: r.at + 8000,
      headline: headline(r.hands, r.version),
    });
  });
  return s!;
}

const byKey = (progress: readonly ExerciseProgress[], key: string) =>
  progress.find((p) => p.exercise === key)!;

describe('scaleProgress', () => {
  it('groups the runs of scale sessions by exercise, other sessions ignored', () => {
    const other = { kind: 'free', id: 'f', startedAt: NOW - HOUR } as unknown as SessionRecord;
    const progress = scaleProgress(
      [
        session({ at: NOW - 3 * HOUR }, { exercise: 'major:G:2:right', at: NOW - 2 * HOUR }),
        other,
        session({ at: NOW - HOUR }),
      ],
      NOW,
    );
    expect(progress.map((p) => p.exercise).sort()).toEqual(['major:C:2:right', 'major:G:2:right']);
    expect(byKey(progress, 'major:C:2:right').runs).toBe(2);
    expect(byKey(progress, 'major:C:2:right').lastAt).toBe(NOW - HOUR);
    expect(byKey(progress, 'major:G:2:right').runs).toBe(1);
    expect(scaleProgress([other], NOW)).toEqual([]);
  });

  it('latest is the latest run, best the lowest spread of a run that is not rough', () => {
    const [p] = scaleProgress(
      [
        // Sessions out of order: runs are ordered by time, not by where they were found.
        session({ at: NOW - HOUR, hands: [{ spread: 25, share: 10, hesitations: 1 }] }),
        session(
          { at: NOW - 5 * DAY, hands: [{ spread: 18, share: 7 }] },
          { at: NOW - 4 * DAY, hands: [{ spread: 9, share: 4, rough: true }] },
          { at: NOW - 3 * DAY, hands: [{ spread: 18, share: 6 }] },
        ),
      ],
      NOW,
    );
    expect(p!.runs).toBe(4);
    expect(p!.latest).toEqual({ spread: 25, spreadShare: 10, rough: false, hesitations: 1 });
    // The rough 9 ms is not the best; of two equal spreads the first to reach it is.
    expect(p!.best).toEqual({ spread: 18, spreadShare: 7, at: NOW - 5 * DAY, rough: false });
  });

  it('every run rough (one octave): the best is the lowest rough one, marked so', () => {
    const [p] = scaleProgress(
      [
        session(
          { at: NOW - 3 * HOUR, hands: [{ spread: 30, share: 12, rough: true }] },
          { at: NOW - 2 * HOUR, hands: [{ spread: 22, share: 9, rough: true }] },
          { at: NOW - HOUR, hands: [{ spread: 22, share: 8, rough: true }] },
        ),
      ],
      NOW,
    );
    expect(p!.best).toEqual({ spread: 22, spreadShare: 9, at: NOW - 2 * HOUR, rough: true });
    expect(p!.latest?.rough).toBe(true);
    // Rough runs still give a trend and a rank.
    expect(p!.days).toHaveLength(1);
    expect(p!.recentShare).toBe(9);
    // No run with a spread: no best.
    const [none] = scaleProgress([session({ at: NOW - HOUR, hands: [{ spread: null }] })], NOW);
    expect(none!.best).toBeNull();
  });

  it('runs of another analysis version count as played, without figures', () => {
    const old = ANALYSIS_VERSION - 1;
    const [p] = scaleProgress(
      [
        session(
          { at: NOW - 2 * HOUR, hands: [{ spread: 30, share: 12 }] },
          { at: NOW - HOUR, hands: [{ spread: 5, share: 2 }], version: old },
        ),
      ],
      NOW,
    );
    expect(p!.runs).toBe(2);
    expect(p!.lastAt).toBe(NOW - HOUR);
    expect(p!.latest).toBeNull();
    expect(p!.best?.spread).toBe(30);
    expect(p!.days.map((d) => d.runs)).toEqual([1]);
    expect(p!.recentShare).toBe(12);

    const [only] = scaleProgress([session({ at: NOW - HOUR, version: old })], NOW);
    expect(only).toMatchObject({ runs: 1, latest: null, best: null, days: [], recentShare: null });
  });

  it('hands together: the hand with the larger spread', () => {
    expect(
      runFigures(
        headline([
          { hand: 'right', spread: 15, share: 6 },
          { hand: 'left', spread: 22, share: 9, hesitations: 2 },
        ]),
      ),
    ).toEqual({ spread: 22, spreadShare: 9, rough: false, hesitations: 2 });
    // A hand without a spread gives way to one with.
    expect(
      runFigures(
        headline([
          { hand: 'right', spread: null, share: null },
          { hand: 'left', spread: 12, share: 5 },
        ]),
      )?.spread,
    ).toBe(12);
    expect(runFigures(headline([{ spread: null, share: null }]))?.spread).toBeNull();
    expect(runFigures({ ...headline(), quality: 'not-a-scale-run' })).toBeNull();
  });

  it('median per local day, across midnight in the player’s time zone', () => {
    // 23:30 and 00:30 in New York (UTC−4 in September): one day apart there, one day in UTC.
    const lateEvening = Date.UTC(2026, 8, 26, 3, 30);
    const afterMidnight = Date.UTC(2026, 8, 26, 4, 30);
    const sessions = [
      session(
        { at: lateEvening - HOUR, hands: [{ spread: 10, share: 4 }] },
        { at: lateEvening, hands: [{ spread: 30, share: 12 }] },
        { at: afterMidnight, hands: [{ spread: 40, share: 16 }] },
      ),
    ];
    const [ny] = scaleProgress(sessions, NOW, 'America/New_York');
    expect(ny!.days).toEqual([
      { day: '2026-09-25', spread: 20, spreadShare: 8, runs: 2 },
      { day: '2026-09-26', spread: 40, spreadShare: 16, runs: 1 },
    ]);
    const [utc] = scaleProgress(sessions, NOW, 'UTC');
    expect(utc!.days).toEqual([{ day: '2026-09-26', spread: 30, spreadShare: 12, runs: 3 }]);
  });

  it('the trend covers the last 30 calendar days, today included', () => {
    const [p] = scaleProgress(
      [
        session(
          { at: NOW - 30 * DAY, hands: [{ spread: 50 }] },
          { at: NOW - 29 * DAY, hands: [{ spread: 40 }] },
          { at: NOW, hands: [{ spread: 20 }] },
        ),
      ],
      NOW,
      'UTC',
    );
    expect(p!.days.map((d) => [d.day, d.spread])).toEqual([
      ['2026-08-29', 40],
      ['2026-09-27', 20],
    ]);
    // Older runs still count as played and for the best run.
    expect(p!.runs).toBe(3);
    expect(p!.best?.spread).toBe(20);
  });

  it('ranks on the median share of the last runs', () => {
    const shares = [30, 30, 30, 5, 6, 7, 8, 9];
    const [p] = scaleProgress(
      [session(...shares.map((share, i) => ({ at: NOW - (10 - i) * HOUR, hands: [{ share }] })))],
      NOW,
    );
    expect(RECENT_RUNS).toBe(5);
    expect(p!.recentShare).toBe(7);
  });

  it('weakest first: the larger recent share, then without figures, then the latest played', () => {
    const old = ANALYSIS_VERSION - 1;
    const progress = scaleProgress(
      [
        session(
          { exercise: 'major:C:2:right', at: NOW - 5 * HOUR, hands: [{ share: 6 }] },
          { exercise: 'major:G:2:right', at: NOW - 4 * HOUR, hands: [{ share: 11 }] },
          { exercise: 'major:D:2:right', at: NOW - 3 * HOUR, hands: [{ share: 6 }] },
          { exercise: 'major:A:2:right', at: NOW - 2 * HOUR, version: old },
          { exercise: 'major:E:2:right', at: NOW - HOUR, version: old },
          { exercise: 'major:B:2:right', at: NOW - 3 * HOUR, hands: [{ share: 6 }] },
        ),
      ],
      NOW,
    );
    expect(progress.map((p) => p.exercise)).toEqual([
      'major:G:2:right',
      // Equal shares: the latest played first, then by key.
      'major:B:2:right',
      'major:D:2:right',
      'major:C:2:right',
      // No figures: last, the latest played first.
      'major:E:2:right',
      'major:A:2:right',
    ]);
    // The comparator is total and agrees with the order.
    expect([...progress].reverse().sort(byWeakness)).toEqual(progress);
  });
});

describe('suggestedExercise', () => {
  it('the weakest of the exercises played in the last 14 days', () => {
    const progress = scaleProgress(
      [
        session(
          { exercise: 'major:C:2:right', at: NOW - 20 * DAY, hands: [{ share: 20 }] },
          { exercise: 'major:G:2:right', at: NOW - 13 * DAY, hands: [{ share: 9 }] },
          { exercise: 'major:D:2:right', at: NOW - HOUR, hands: [{ share: 6 }] },
        ),
      ],
      NOW,
    );
    expect(progress[0]!.exercise).toBe('major:C:2:right');
    expect(suggestedExercise(progress, NOW, 'UTC')).toBe('major:G:2:right');
    // A day later G falls out of the window.
    expect(suggestedExercise(progress, NOW + DAY, 'UTC')).toBe('major:D:2:right');
    // Order of the input does not matter.
    expect(suggestedExercise([...progress].reverse(), NOW, 'UTC')).toBe('major:G:2:right');
  });

  it('none without a recent exercise that has figures', () => {
    expect(suggestedExercise([], NOW)).toBeNull();
    const stale = scaleProgress([session({ at: NOW - 15 * DAY })], NOW);
    expect(suggestedExercise(stale, NOW, 'UTC')).toBeNull();
    const old = scaleProgress([session({ at: NOW - HOUR, version: ANALYSIS_VERSION - 1 })], NOW);
    expect(suggestedExercise(old, NOW, 'UTC')).toBeNull();
  });
});

// --- Places over runs: simulated runs -----------------------------------------------------------

function gaussian(rng: Rng): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

interface Player {
  ioi?: number;
  /** Onset jitter, ms. */
  sigma: number;
  /** Every thumb passing under comes this late, ms. */
  thumb?: number;
  /** Any other note late by this much, ms. */
  late?: (note: ScaleNote) => number;
}

/** A run of `exercise` with every note played right, onsets jittered, thumbs possibly late. */
function simulate(
  rng: Rng,
  exercise: string,
  player: Player,
  n: number,
  sessionId = 'sim',
): StoredScaleRun {
  const { right, left } = scaleNotes(parseExerciseKey(exercise)!);
  const ioi = player.ioi ?? 250;
  const keys: PlayedNote[] = [];
  for (const hand of [right, left]) {
    for (const note of hand) {
      const late =
        (note.crossing === 'thumbUnder' ? (player.thumb ?? 0) : 0) + (player.late?.(note) ?? 0);
      const on = 500 + note.index * ioi + player.sigma * gaussian(rng) + late;
      keys.push({ midi: note.midi, on, off: on + 0.9 * ioi, velocity: 64 });
    }
  }
  keys.sort((a, b) => a.on - b.on);
  const first = keys[0]!.on;
  return {
    id: `${sessionId}:${n}`,
    sessionId,
    exercise,
    startedAt: NOW - (100 - n) * HOUR,
    end: 'finished',
    keys: keys.map((k) => ({ ...k, on: k.on - first, off: k.off === null ? null : k.off - first })),
    pedal: [],
    pedalAtStart: false,
    velocityMeasured: false,
    inputs: [],
  };
}

function simulateRuns(rng: Rng, exercise: string, player: Player, count: number) {
  return Array.from({ length: count }, (_, n) => simulate(rng, exercise, player, n));
}

const C2 = 'major:C:2:right';
const thumbIndexes = (exercise: string, hand: Hand = 'right') =>
  scaleNotes(parseExerciseKey(exercise)!)
    [hand].filter((n) => n.crossing === 'thumbUnder')
    .map((n) => n.index);

describe('placesOverRuns', () => {
  it('names a thumb that is 25 ms late in every run, and nothing else', () => {
    const rng = seededRng(11);
    const result = placesOverRuns(simulateRuns(rng, C2, { sigma: 15, thumb: 25 }, 10));
    expect(result.runs).toBe(10);
    expect(result.irregular).toHaveLength(1);
    const [place] = result.irregular;
    expect(place).toMatchObject({ hand: 'right', direction: 'up', crossing: 'thumbUnder' });
    expect(place!.indexes).toEqual(thumbIndexes(C2).filter((i) => i <= 14));
    expect(place!.runs).toBe(10);
    expect(place!.irregularity).toBeGreaterThan(15);
    expect(place!.irregularity).toBeLessThan(32);
    expect(Math.abs(place!.irregularity) / place!.standardError).toBeGreaterThanOrEqual(
      PROBLEM_MIN_Z,
    );
    expect(place!.instability).toBeGreaterThan(0);
    // Every note has its figures, in run order; the thumbs stand out.
    expect(result.places.map((p) => p.index)).toEqual(Array.from({ length: 29 }, (_, i) => i));
    for (const p of result.places.filter((p) => p.crossing === 'thumbUnder'))
      expect(p.irregularity).toBeGreaterThan(8);
  });

  it('names the thumb in most exercises and a steady player’s notes rarely', () => {
    const rng = seededRng(12);
    const exercises = 60;
    let thumbNamed = 0;
    let perNoteNamed = 0;
    for (let e = 0; e < exercises; e++) {
      const bump = placesOverRuns(simulateRuns(rng, C2, { sigma: 15, thumb: 25 }, 5));
      if (bump.irregular.some((p) => p.crossing === 'thumbUnder' && p.direction === 'up'))
        thumbNamed++;
      const steady = placesOverRuns(simulateRuns(rng, C2, { sigma: 15 }, 5));
      // The spec's rule read per note, with each note's own SD: what the naming rule avoids.
      const named = steady.places.filter(
        (p) =>
          !p.turn &&
          Math.abs(p.irregularity) >= PROBLEM_MIN_MS &&
          Math.abs(p.irregularity) >= PROBLEM_MIN_Z * p.standardError,
      );
      if (named.length > 0) perNoteNamed++;
    }
    // Simulated over 300 exercises: 95 % named; per note, a steady player 62 % of the time.
    expect(thumbNamed / exercises).toBeGreaterThan(0.85);
    expect(perNoteNamed / exercises).toBeGreaterThan(0.4);

    // A steady player, by crossing and by degree (simulated: 0–9 % over 3–10 runs).
    for (const [exercise, sigma] of [
      [C2, 15],
      [C2, 25],
      ['major:C:4:left', 25],
      ['naturalMinor:A:2:right', 25],
    ] as const) {
      let named = 0;
      for (let e = 0; e < exercises; e++)
        if (placesOverRuns(simulateRuns(rng, exercise, { sigma }, 5)).irregular.length > 0) named++;
      expect(named / exercises, `${exercise} σ = ${sigma}`).toBeLessThan(0.1);
    }
  });

  it('names nothing with fewer than 3 runs', () => {
    const rng = seededRng(13);
    const result = placesOverRuns(simulateRuns(rng, C2, { sigma: 5, thumb: 40 }, MIN_RUNS - 1));
    expect(result.runs).toBe(2);
    expect(result.places).toEqual([]);
    expect(result.irregular).toEqual([]);
    expect(placesOverRuns([])).toEqual({ runs: 0, places: [], irregular: [] });
  });

  it('skips a run that is not a scale run', () => {
    const rng = seededRng(14);
    const runs = simulateRuns(rng, C2, { sigma: 10, thumb: 30 }, 4);
    // The newest run: a few notes of the scale, then playing around.
    const noise = { ...runs[3]!, keys: runs[3]!.keys.slice(0, 6) };
    for (let i = 0; i < 20; i++)
      noise.keys.push({
        midi: 40 + ((i * 7) % 30),
        on: 2000 + 100 * i,
        off: 2050 + 100 * i,
        velocity: 64,
      });
    const result = placesOverRuns([...runs.slice(0, 3), noise]);
    expect(result.runs).toBe(3);
    expect(result.places.every((p) => p.runs <= 3)).toBe(true);
    expect(result.irregular[0]?.crossing).toBe('thumbUnder');
  });

  it('names a degree where there is no crossing, as in a scale without fingering', () => {
    const rng = seededRng(18);
    const exercise = 'naturalMinor:A:2:right';
    expect(scaleNotes(parseExerciseKey(exercise)!).right.every((n) => n.crossing === null)).toBe(
      true,
    );
    // D (degree 3) going up, 25 ms late every time.
    const late = (n: ScaleNote) => (n.direction === 'up' && n.degree === 3 ? 25 : 0);
    const result = placesOverRuns(simulateRuns(rng, exercise, { sigma: 15, late }, 10));
    expect(result.places).toHaveLength(29);
    expect(result.irregular).toHaveLength(1);
    expect(result.irregular[0]).toMatchObject({
      hand: 'right',
      direction: 'up',
      crossing: null,
      degree: 3,
      indexes: [3, 10],
      runs: 10,
      notes: 20,
    });
    expect(
      Math.abs(result.irregular[0]!.irregularity / result.irregular[0]!.standardError),
    ).toBeGreaterThanOrEqual(DEGREE_MIN_Z);

    // In a scale with fingering too: A (degree 5, the 3rd finger) going up in C major.
    const a = (n: ScaleNote) => (n.direction === 'up' && n.degree === 5 ? 25 : 0);
    const c = placesOverRuns(simulateRuns(rng, C2, { sigma: 15, late: a }, 10));
    expect(c.irregular.map((p) => [p.direction, p.crossing, p.degree])).toEqual([['up', null, 5]]);
  });

  it('never names the first or last note alone, nor the turn', () => {
    const rng = seededRng(19);
    const late = (n: ScaleNote) => (n.index === 28 || n.turn ? 40 : 0);
    const result = placesOverRuns(simulateRuns(rng, C2, { sigma: 10, late }, 10));
    // Their figures are there, for the chart…
    expect(result.places.find((p) => p.index === 28)!.irregularity).toBeGreaterThan(25);
    expect(result.places.find((p) => p.turn)!.irregularity).toBeGreaterThan(25);
    // …but no place is named for them.
    expect(result.irregular).toEqual([]);
  });

  it('uses the latest runs only', () => {
    const rng = seededRng(15);
    // Ten runs with a late thumb, then five even ones.
    const runs = [
      ...simulateRuns(rng, C2, { sigma: 10, thumb: 40 }, 10),
      ...Array.from({ length: 5 }, (_, n) => simulate(rng, C2, { sigma: 10 }, 10 + n)),
    ];
    expect(placesOverRuns(runs).irregular).not.toEqual([]);
    const recent = placesOverRuns(runs, 5);
    expect(recent.runs).toBe(5);
    expect(recent.irregular).toEqual([]);
  });

  it('rejects runs of more than one exercise', () => {
    const rng = seededRng(16);
    const runs = [
      ...simulateRuns(rng, C2, { sigma: 10 }, 3),
      simulate(rng, 'major:G:2:right', { sigma: 10 }, 3),
    ];
    expect(() => placesOverRuns(runs)).toThrow(/more than one exercise/);
  });

  it('is quick: ten runs of four octaves', () => {
    const rng = seededRng(17);
    const runs = simulateRuns(rng, 'major:C:4:right', { sigma: 15, thumb: 25 }, 10);
    placesOverRuns(runs);
    const start = performance.now();
    const result = placesOverRuns(runs);
    const ms = performance.now() - start;
    expect(result.runs).toBe(10);
    expect(result.irregular[0]?.crossing).toBe('thumbUnder');
    // About 2 ms here (hands together, about 30); the bound is generous for slow machines.
    expect(ms).toBeLessThan(100);
  });
});
