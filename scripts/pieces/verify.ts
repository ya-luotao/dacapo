// Proofreads a MusicXML file against an independent MIDI rendering of the same edition: every
// (onset, pitch) the file asks to be played must be in the MIDI file and the other way round.
// The file is read with dacapo's own parser, so the check covers the parser too.
//
//   node --experimental-strip-types scripts/pieces/verify.ts <file.musicxml> <oracle.mid>
//     [--order document|play|skip] [--bars A-B] [--midi-at Q] [--grid N]
//
// --order     document: every written bar once, all endings in turn, as a LilyPond MIDI file
//             without \unfoldRepeats plays them (default); play: repeats unrolled; skip: every
//             bar once, last ending only.
// --bars      only these written measures (0-based indices, inclusive).
// --midi-at   where the first of those bars starts in the MIDI file, in quarter notes (default:
//             at the same position as in the file).
// --grid      onsets per quarter note that count as on the grid (default 4: sixteenths). MIDI notes
//             off the grid are grace notes and ornaments as the oracle plays them; they are listed,
//             not compared.

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { parseMusicXml } from '../../src/core/musicxml.ts';
import { midiName } from '../../src/core/note.ts';
import { performanceOrder, writtenOrder, type PlayedMeasure } from '../../src/core/repeats.ts';
import { TICKS_PER_QUARTER, type Hand, type Score } from '../../src/core/score.ts';
import { parseXml } from './dom.ts';
import { readMidiFile, type MidiTrack } from './smf.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    order: { type: 'string', default: 'document' },
    bars: { type: 'string' },
    'midi-at': { type: 'string' },
    grid: { type: 'string', default: '4' },
  },
});
const [file, oracle] = positionals;
if (!file || !oracle) {
  console.error(
    'usage: verify.ts <file.musicxml> <oracle.mid> [--order …] [--bars A-B] [--midi-at Q]',
  );
  process.exit(2);
}

const xml = readFileSync(file, 'utf8');
const score = parseMusicXml(parseXml(xml));

function order(s: Score, mode: string): PlayedMeasure[] {
  if (mode === 'play') return performanceOrder(s.measures);
  if (mode === 'skip') return writtenOrder(s.measures);
  if (mode === 'document')
    return s.measures.map((m) => ({ measure: m.index, pass: 1, start: m.start }));
  throw new Error(`unknown order ${mode}`);
}

const [from, to] = values.bars
  ? values.bars.split('-').map(Number)
  : [0, score.measures.length - 1];
const played = order(score, values.order).filter((p) => p.measure >= from! && p.measure <= to!);
if (played.length === 0) throw new Error('no bars to compare');
const windowStart = played[0]!.start;
const last = played.at(-1)!;
const windowEnd = last.start + score.measures[last.measure]!.duration;

interface Event {
  tick: number;
  midi: number;
  hand: Hand | null;
}

const ours: Event[] = [];
for (const p of played) {
  const m = score.measures[p.measure]!;
  for (const n of score.notes)
    if (n.measure === p.measure && !n.tieStop)
      ours.push({ tick: p.start + n.onset - m.start, midi: n.midi, hand: n.hand });
}

const grid = Number(values.grid);
const midiAt =
  values['midi-at'] !== undefined ? Number(values['midi-at']) : windowStart / TICKS_PER_QUARTER;
const span = (windowEnd - windowStart) / TICKS_PER_QUARTER;
const eps = 1e-6;
const tracks = readMidiFile(oracle).filter((t) => t.notes.length > 0);
const offGrid: string[] = [];
const theirsByTrack = tracks.map((track: MidiTrack) =>
  track.notes.flatMap((n) => {
    const q = n.onset - midiAt;
    if (q < -eps || q >= span - eps) return [];
    if (Math.abs(n.onset * grid - Math.round(n.onset * grid)) > eps) {
      offGrid.push(`${midiName(n.midi)} at ${n.onset.toFixed(3)}`);
      return [];
    }
    return [{ tick: windowStart + Math.round(q * TICKS_PER_QUARTER), midi: n.midi }];
  }),
);
const theirs = theirsByTrack.flat();

const key = (e: { tick: number; midi: number }) => `${e.tick}|${e.midi}`;
function difference<T extends { tick: number; midi: number }>(
  a: T[],
  b: { tick: number; midi: number }[],
): T[] {
  const pool = new Map<string, number>();
  for (const e of b) pool.set(key(e), (pool.get(key(e)) ?? 0) + 1);
  return a.filter((e) => {
    const left = pool.get(key(e)) ?? 0;
    if (left > 0) pool.set(key(e), left - 1);
    return left === 0;
  });
}

function where(tick: number): string {
  const p = [...played].reverse().find((x) => x.start <= tick) ?? played[0]!;
  const m = score.measures[p.measure]!;
  const beat = 1 + (tick - p.start) / ((4 * TICKS_PER_QUARTER) / m.beatType);
  return `bar ${m.number}${p.pass > 1 ? ` (pass ${p.pass})` : ''} beat ${+beat.toFixed(3)}`;
}

const extra = difference(ours, theirs);
const missing = difference(theirs, ours);
const matched = ours.length - extra.length;
const graces = (xml.match(/<grace\b/g) ?? []).length;
console.log(
  `${file}: ${matched}/${ours.length} notes match ${oracle} (${theirs.length} in the oracle; ` +
    `order ${values.order}, bars ${from}-${to}); oracle notes off the grid: ${offGrid.length}; ` +
    `grace notes in the file: ${graces}`,
);
if (offGrid.length > 0) console.log(`  off the grid: ${offGrid.join(', ')}`);

// Informational: the two staves of the oracle against our two hands, whichever way round fits.
if (theirsByTrack.length === 2) {
  const hand = (h: Hand) => ours.filter((e) => e.hand === h);
  const fit = (r: number, l: number) => [
    hand('right').length - difference(hand('right'), theirsByTrack[r]!).length,
    hand('left').length - difference(hand('left'), theirsByTrack[l]!).length,
  ];
  const a = fit(0, 1);
  const b = fit(1, 0);
  const [right, left] = a[0]! + a[1]! >= b[0]! + b[1]! ? a : b;
  console.log(
    `  hands: right ${right}/${hand('right').length}, left ${left}/${hand('left').length}`,
  );
}
for (const e of extra) console.log(`  not in the oracle: ${midiName(e.midi)} at ${where(e.tick)}`);
for (const e of missing)
  console.log(`  missing from the file: ${midiName(e.midi)} at ${where(e.tick)}`);
process.exit(extra.length > 0 || missing.length > 0 ? 1 : 0);
