// Turns the transcription of Hanon's Part I (scripts/scales/hanon/part1/part1.json, built from a
// reading by build_part1.py) into the data of hanonPartOne.ts and renders that module. Pure, so the
// module's test can rebuild the data from the JSON and compare; the file I/O is in
// scripts/scales/hanonPartOne.ts. The app never imports it.

import type { HanonPartOne } from './hanonPartOne.ts';

/** One exercise of part1.json: every note of every bar, and the digits printed on them. */
export interface PartOneEntry {
  number: number;
  /** Printed page, and the page of the PDF (IMSLP #91547) it starts on. */
  page: number;
  pdf: number;
  /** Beats to the bar (2: 2/4). */
  beats: number;
  /** Bars of the ascending half, and of the descending half; the closing bar comes after. */
  up: number;
  down: number;
  /**
   * Per hand, per bar, the notes at sounding pitch (`C3`, `F#4`), the closing bar last; a chord's
   * keys joined by `+`, lowest first (No. 20 closes on one).
   */
  right: string[][];
  left: string[][];
  /** Per hand, per bar, per note, the digit printed, or null. */
  rightFingers: (number | null)[][];
  leftFingers: (number | null)[][];
  /** Digits printed that dacapo does not use (scripts/scales/hanon/part1/resolved.py). */
  corrections: PartOneCorrection[];
}

/** A printed digit taken otherwise: an engraving slip against the fingering of every other bar. */
export interface PartOneCorrection {
  /** Bar from 1, hand, and the note's place in the bar from 0. */
  bar: number;
  hand: 'RH' | 'LH';
  index: number;
  printed: number;
  used: number;
  reason: string;
}

const NOTE = /^[A-G](##|#|bb|b)?\d(\+[A-G](##|#|bb|b)?\d)*$/;

function isBars(value: unknown): value is string[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (bar) => Array.isArray(bar) && bar.every((n) => typeof n === 'string' && NOTE.test(n)),
    )
  );
}

function isFingers(value: unknown): value is (number | null)[][] {
  return (
    Array.isArray(value) &&
    value.every(
      (bar) =>
        Array.isArray(bar) &&
        bar.every(
          (d) => d === null || (Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 5),
        ),
    )
  );
}

/** Reads part1.json, checking its shape: the hands bar for bar, digits note for note. */
export function readPartOne(json: unknown): PartOneEntry[] {
  if (!Array.isArray(json)) throw new Error('part1.json: not a list');
  return json.map((raw, i) => {
    const e = raw as Record<string, unknown>;
    const where = `part1.json[${i}]`;
    for (const key of ['number', 'page', 'pdf', 'beats', 'up', 'down'])
      if (!Number.isInteger(e[key])) throw new Error(`${where}: ${key}`);
    if (!isBars(e.right) || !isBars(e.left)) throw new Error(`${where}: notes`);
    if (!isFingers(e.rightFingers) || !isFingers(e.leftFingers))
      throw new Error(`${where}: fingers`);
    const bars = (e.up as number) + (e.down as number) + 1;
    for (const hand of ['right', 'left', 'rightFingers', 'leftFingers'] as const)
      if ((e[hand] as unknown[]).length !== bars)
        throw new Error(`${where}: ${hand} has not ${bars} bars`);
    e.right.forEach((bar, b) => {
      if (bar.length !== (e.left as string[][])[b]!.length)
        throw new Error(`${where}: bar ${b + 1} differs`);
      if (bar.length !== (e.rightFingers as unknown[][])[b]!.length)
        throw new Error(`${where}: RH digits, bar ${b + 1}`);
      if (bar.length !== (e.leftFingers as unknown[][])[b]!.length)
        throw new Error(`${where}: LH digits, bar ${b + 1}`);
    });
    if (!Array.isArray(e.corrections)) throw new Error(`${where}: corrections`);
    for (const c of e.corrections as PartOneCorrection[]) {
      const fingers = c.hand === 'RH' ? e.rightFingers : e.leftFingers;
      if (fingers[c.bar - 1]?.[c.index] !== c.printed)
        throw new Error(`${where}: correction at bar ${c.bar} is not what is printed`);
    }
    return {
      number: e.number as number,
      page: e.page as number,
      pdf: e.pdf as number,
      beats: e.beats as number,
      up: e.up as number,
      down: e.down as number,
      right: e.right,
      left: e.left,
      rightFingers: e.rightFingers,
      leftFingers: e.leftFingers,
      corrections: e.corrections as PartOneCorrection[],
    };
  });
}

const barsText = (bars: readonly (readonly string[])[]) => bars.map((b) => b.join(' ')).join(' | ');
const fingersText = (bars: readonly (readonly (number | null)[])[]) =>
  bars.map((b) => b.map((d) => (d === null ? '.' : String(d))).join('')).join(' | ');

/** The fingers dacapo uses: as printed, the corrections applied. */
function used(e: PartOneEntry, hand: 'RH' | 'LH'): (number | null)[][] {
  const fingers = (hand === 'RH' ? e.rightFingers : e.leftFingers).map((bar) => [...bar]);
  for (const c of e.corrections) if (c.hand === hand) fingers[c.bar - 1]![c.index] = c.used;
  return fingers;
}

/** The module's data: each exercise's notes and digits as text, bar by bar. */
export function partOneData(entries: readonly PartOneEntry[]): HanonPartOne[] {
  return [...entries]
    .sort((a, b) => a.number - b.number)
    .map((e) => ({
      number: e.number,
      page: e.page,
      beats: e.beats,
      up: e.up,
      right: barsText(e.right),
      left: barsText(e.left),
      rightFingers: fingersText(used(e, 'RH')),
      leftFingers: fingersText(used(e, 'LH')),
    }));
}

/** Every correction, by exercise: what the module's fingers hold otherwise than printed. */
export function partOneCorrections(
  entries: readonly PartOneEntry[],
): (PartOneCorrection & { number: number })[] {
  return entries.flatMap((e) => e.corrections.map((c) => ({ number: e.number, ...c })));
}

/** The source of src/core/hanonPartOne.ts (prettier formats it afterwards). */
export function renderPartOneModule(data: readonly HanonPartOne[]): string {
  return `// Generated by scripts/scales/hanonPartOne.ts from scripts/scales/hanon/part1/part1.json.
// Do not edit: change the transcription there and run
//   node --experimental-strip-types scripts/scales/hanonPartOne.ts
//
// Charles-Louis Hanon, The Virtuoso Pianist, Part I, Nos. 1–20, G. Schirmer, New York, n.d.
// [1900], plate 15538, IMSLP #91547: every note as printed, and every fingering digit he prints
// (from the third bar only the fingers each exercise trains; the other notes have none). How it
// was read and checked is in scripts/scales/hanon/README.md.
//
// Each hand is its bars, separated by \`|\`: the ascending half (\`up\` bars), the descending half,
// then the closing bar. Notes are sounding pitches (middle C is C4), a chord's keys joined by \`+\`.
// The fingers are one character per note or chord, \`.\` where Hanon prints no digit.

export interface HanonPartOne {
  number: number;
  /** Printed page of the G. Schirmer edition. */
  page: number;
  /** Beats to the bar (2: 2/4, as printed). */
  beats: number;
  /** Bars of the ascending half; the descending half follows, then the closing bar. */
  up: number;
  right: string;
  left: string;
  rightFingers: string;
  leftFingers: string;
}

export const HANON_PART_ONE: readonly HanonPartOne[] = ${JSON.stringify(data, null, 2)};
`;
}
