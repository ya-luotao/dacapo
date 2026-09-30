// Turns the transcription of Hanon's Nos. 42–53 (scripts/scales/hanon/s7/s7.json, built from a
// reading by build_s7.py) into the data of hanonTechnique.ts and renders that module. Pure, so the
// module's test can rebuild the data from the JSON and compare; the file I/O is in
// scripts/scales/hanonTechnique.ts. The app never imports it.

import type { HanonPart } from './hanonTechnique.ts';

/** One part of s7.json: every step of every bar, and the digits printed on each of its keys. */
export interface TechniqueEntry {
  number: number;
  part: string;
  page: number;
  pdf: number;
  beats: number;
  perBeat: number;
  /** Per hand, per bar, the steps: a note `C4` or a chord `C4+E4`, lowest first. */
  right: string[][];
  left: string[][];
  /** Per hand, per bar, per step, a digit or `.` for each key, lowest first. */
  rightFingers: string[][];
  leftFingers: string[][];
  /** Divisions of rest after the last step, in both hands (No. 50's chromatic scale). */
  rest?: number;
}

const STEP = /^[A-G](bb|b|##|#|x)?\d(\+[A-G](bb|b|##|#|x)?\d)*$/;

function isBars(value: unknown, item: (s: unknown) => boolean): value is string[][] {
  return Array.isArray(value) && value.every((bar) => Array.isArray(bar) && bar.every(item));
}

/** Reads s7.json, checking its shape: the hands bar for bar and step for step, a digit a key. */
export function readTechnique(json: unknown): TechniqueEntry[] {
  if (!Array.isArray(json)) throw new Error('s7.json: not a list');
  return json.map((raw, i) => {
    const e = raw as Record<string, unknown>;
    const where = `s7.json[${i}]`;
    for (const key of ['number', 'page', 'pdf', 'beats', 'perBeat'])
      if (!Number.isInteger(e[key])) throw new Error(`${where}: ${key}`);
    if (typeof e.part !== 'string') throw new Error(`${where}: part`);
    const steps = (s: unknown) => typeof s === 'string' && STEP.test(s);
    const digits = (s: unknown) => typeof s === 'string' && /^[1-5.]+$/.test(s);
    if (!isBars(e.right, steps) || !isBars(e.left, steps)) throw new Error(`${where}: steps`);
    if (!isBars(e.rightFingers, digits) || !isBars(e.leftFingers, digits))
      throw new Error(`${where}: digits`);
    const shape = (bars: string[][]) => bars.map((b) => b.map((s) => s.split('+').length));
    const same = (a: number[][], b: number[][]) => JSON.stringify(a) === JSON.stringify(b);
    if (
      !same(
        shape(e.right).map((b) => [b.length]),
        shape(e.left).map((b) => [b.length]),
      )
    )
      throw new Error(`${where}: the hands differ in steps`);
    if (
      !same(
        shape(e.right),
        e.rightFingers.map((b) => b.map((d) => d.length)),
      )
    )
      throw new Error(`${where}: RH digits off`);
    if (
      !same(
        shape(e.left),
        e.leftFingers.map((b) => b.map((d) => d.length)),
      )
    )
      throw new Error(`${where}: LH digits off`);
    if (e.rest !== undefined && !(Number.isInteger(e.rest) && (e.rest as number) > 0))
      throw new Error(`${where}: rest`);
    return {
      number: e.number as number,
      part: e.part,
      page: e.page as number,
      pdf: e.pdf as number,
      beats: e.beats as number,
      perBeat: e.perBeat as number,
      right: e.right,
      left: e.left,
      rightFingers: e.rightFingers,
      leftFingers: e.leftFingers,
      ...(e.rest !== undefined && { rest: e.rest as number }),
    };
  });
}

const BLACK = new Set([1, 3, 6, 8, 10]);
const SEMIS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ALTERS: Record<string, number> = { bb: -2, b: -1, '': 0, '#': 1, '##': 2, x: 2 };

function isBlack(name: string): boolean {
  const match = /^([A-G])(bb|b|##|#|x)?\d$/.exec(name)!;
  return BLACK.has((((SEMIS[match[1]!]! + ALTERS[match[2] ?? '']!) % 12) + 12) % 12);
}

/**
 * No. 53's footnote: "In all scales in Octaves, the black keys are to be taken with the 4th finger
 * of either hand." Hanon's own rule, printed once for the 24 keys, so each black-key octave takes
 * it: the right hand's upper key, the left hand's lower key (the thumb takes the other, which he
 * does not print). A digit he prints on the note is kept.
 */
function footnote53(e: TechniqueEntry, hand: 'right' | 'left'): string[][] {
  const steps = hand === 'right' ? e.right : e.left;
  const fingers = hand === 'right' ? e.rightFingers : e.leftFingers;
  return steps.map((bar, b) =>
    bar.map((step, s) => {
      const keys = step.split('+');
      const digits = [...fingers[b]![s]!];
      const at = hand === 'right' ? keys.length - 1 : 0;
      if (keys.length > 1 && isBlack(keys[at]!) && digits[at] === '.') digits[at] = '4';
      return digits.join('');
    }),
  );
}

const barsText = (bars: readonly (readonly string[])[]) => bars.map((b) => b.join(' ')).join(' | ');

/** The module's data: each part's steps and digits as text, bar by bar. */
export function techniqueData(entries: readonly TechniqueEntry[]): HanonPart[] {
  return entries.map((e) => ({
    number: e.number,
    part: e.part,
    page: e.page,
    beats: e.beats,
    perBeat: e.perBeat,
    right: barsText(e.right),
    left: barsText(e.left),
    rightFingers: barsText(e.number === 53 ? footnote53(e, 'right') : e.rightFingers),
    leftFingers: barsText(e.number === 53 ? footnote53(e, 'left') : e.leftFingers),
    ...(e.rest !== undefined && { rest: e.rest }),
  }));
}

/** The source of src/core/hanonTechnique.ts (prettier formats it afterwards). */
export function renderTechniqueModule(data: readonly HanonPart[]): string {
  return `// Generated by scripts/scales/hanonTechnique.ts from scripts/scales/hanon/s7/s7.json.
// Do not edit: change the transcription there and run
//   node --experimental-strip-types scripts/scales/hanonTechnique.ts
//
// Charles-Louis Hanon, The Virtuoso Pianist, G. Schirmer, New York, n.d. [1900], plate 15538,
// IMSLP #91547: the parts of Nos. 42–53 the Scales page offers, every note as printed and every
// fingering digit he prints, and in No. 53 his footnote's 4th finger on each black key. How it
// was read and checked is in scripts/scales/hanon/README.md.
//
// A part is one exercise as offered (a section of No. 42 on its root, a fingering of No. 45, a key
// of No. 53; \`close\` is the closing bar after an exercise's last part). Each hand is its bars,
// separated by \`|\`, each bar its steps: a note, or a chord's keys joined by \`+\`, lowest first,
// at sounding pitch (middle C is C4). A bar's steps fill it equally, the last bar less its
// closing rest where one is printed. The fingers are a character per key of each step, \`.\` where
// there is no digit.

export interface HanonPart {
  number: number;
  part: string;
  /** Printed page of the G. Schirmer edition. */
  page: number;
  /** Beats (quarters) to the bar, and divisions of a beat (4: sixteenths, 3: triplet eighths). */
  beats: number;
  perBeat: number;
  right: string;
  left: string;
  rightFingers: string;
  leftFingers: string;
  /** Divisions of rest after the last step, in both hands, where the plate prints one. */
  rest?: number;
}

export const HANON_PARTS: readonly HanonPart[] = ${JSON.stringify(data, null, 2)};
`;
}
