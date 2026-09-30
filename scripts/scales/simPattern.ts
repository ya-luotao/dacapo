// Simulates the single-run pattern places (evenness.ts, PATTERN_MIN_Z): how often a steady player
// is named a place, and how often a note of every group played late is found. Run from the
// repository root:
//
//   node --experimental-strip-types scripts/scales/simPattern.ts
//
// Hanon No. 1's shape (C E F G A G F E up fourteen bars, the mirror down fourteen, one hand) and
// the broken chords over two octaves; onset jitter σ, 125–250 ms notes, 400 runs per case.

import { analyzeRun, type PlayedNote } from '../../src/core/evenness.ts';
import { seededRng } from '../../src/core/random.ts';
import type { ScaleNote } from '../../src/core/scaleTypes.ts';

const UP = [0, 2, 3, 4, 5, 4, 3, 2];
const DOWN = [0, -2, -3, -4, -5, -4, -3, -2];
const SEMIS = [0, 2, 4, 5, 7, 9, 11];
const midiOf = (degree: number) =>
  48 + 12 * Math.floor(degree / 7) + SEMIS[((degree % 7) + 7) % 7]!;

function hanonLike(): ScaleNote[] {
  const notes: ScaleNote[] = [];
  const push = (degree: number, place: number, direction: 'up' | 'down', turn = false) =>
    notes.push({
      hand: 'right',
      index: notes.length,
      pitch: { step: 'C', alter: 0, octave: 4 },
      midi: midiOf(degree),
      finger: null,
      direction,
      turn,
      degree: place,
      crossing: null,
      pattern: true,
    });
  for (let bar = 0; bar < 14; bar++)
    UP.forEach((d, place) => push(bar + d, place, 'up', bar === 13 && place === 7));
  for (let bar = 0; bar < 14; bar++) DOWN.forEach((d, place) => push(18 - bar + d, place, 'down'));
  push(0, 0, 'down');
  return notes;
}

function brokenLike(): ScaleNote[] {
  const notes: ScaleNote[] = [];
  const chords = [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1, 0];
  const pos = (p: number) => 7 * Math.floor(p / 3) + 2 * (p % 3);
  chords.forEach((k, c) =>
    [k, k + 1, k + 2, k + 1].forEach((p, place) =>
      notes.push({
        hand: 'right',
        index: notes.length,
        pitch: { step: 'C', alter: 0, octave: 4 },
        midi: midiOf(pos(p)),
        finger: null,
        direction: c <= 6 ? 'up' : 'down',
        turn: c === 6 && place === 3,
        degree: place,
        crossing: null,
        pattern: true,
      }),
    ),
  );
  notes.push({ ...notes[0]!, index: notes.length, direction: 'down' });
  return notes;
}

function simulate(
  expected: ScaleNote[],
  ioi: number,
  sigma: number,
  late: { place: number; ms: number } | null,
  runs: number,
): { named: number; found: number } {
  const rng = seededRng(7);
  const gauss = () => {
    const u = 1 - rng();
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  let named = 0;
  let found = 0;
  for (let r = 0; r < runs; r++) {
    const played: PlayedNote[] = expected.map((n, i) => {
      let on = i * ioi + sigma * gauss();
      if (
        late &&
        n.degree === late.place &&
        n.direction === 'up' &&
        i > 0 &&
        i < expected.length - 1
      )
        on += late.ms;
      return { midi: n.midi, on, off: on + ioi * 0.9, velocity: 64 };
    });
    played.sort((a, b) => a.on - b.on);
    const a = analyzeRun({ expected, played, velocityMeasured: false });
    if (!a.problem) continue;
    if (late && a.problem.degree === late.place && a.problem.direction === 'up') found++;
    else named++;
  }
  return { named, found };
}

const RUNS = 400;
for (const [label, expected] of [
  ['Hanon No. 1 shape', hanonLike()],
  ['broken chords, 2 octaves', brokenLike()],
] as const) {
  for (const ioi of [125, 250])
    for (const sigma of [10, 15, 25]) {
      const steady = simulate(expected, ioi, sigma, null, RUNS);
      const late = simulate(expected, ioi, sigma, { place: 3, ms: 25 }, RUNS);
      console.log(
        `${label}: ${ioi} ms notes, σ = ${sigma} ms — steady named ${((100 * steady.named) / RUNS).toFixed(1)} %; ` +
          `place 4 going up 25 ms late found ${((100 * late.found) / RUNS).toFixed(1)} %, something else ${((100 * late.named) / RUNS).toFixed(1)} %`,
      );
    }
}
