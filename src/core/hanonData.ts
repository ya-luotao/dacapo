// Turns the Hanon transcription (scripts/scales/hanon/hanon.json and hanon41.json) into the data
// of scaleFingering.ts and renders that module. Pure, so the module's test can rebuild the data from
// the JSON and compare; the file I/O is in scripts/scales/fingering.ts. The app never imports it.

/** The four runs of one scale as fingers, index 0 first (see RUN_ORDER in the rendered module). */
export interface HanonRuns<T> {
  rightUp: T;
  rightDown: T;
  leftUp: T;
  leftDown: T;
}

export type HanonRun = keyof HanonRuns<unknown>;
export const RUNS: readonly HanonRun[] = ['rightUp', 'rightDown', 'leftUp', 'leftDown'];

export type HanonMode = 'major' | 'harmonicMinor' | 'melodicMinor';

/** One entry of hanon.json, the fields used here. Note names like `F##4`, `Bb2`. */
export interface HanonEntry extends HanonRuns<number[]> {
  number: 39 | 40;
  key: string;
  mode: HanonMode | 'chromatic';
  variant?: string;
  page: number;
  notes: string[];
  notesDown: string[];
  notesLeft: string[];
  notesLeftDown: string[];
}

/** A digit dacapo does not take as printed. */
export interface HanonCorrection {
  key: string;
  mode: HanonMode;
  run: HanonRun;
  /** Index in the run (0 = its first note). */
  index: number;
  note: string;
  printed: number;
  used: number;
  reason: string;
}

/** The one correction decided in S0 (docs/SCALES.md, Clarifications). */
export const CORRECTIONS: readonly HanonCorrection[] = [
  {
    key: 'D',
    mode: 'major',
    run: 'leftDown',
    index: 27,
    note: 'E2',
    printed: 1,
    used: 4,
    reason:
      'Printed 1 on both copies of the plate; the pattern of every other octave and the 5 on the following D need 4.',
  },
];

/** Fingers as digits, grouped by octave with spaces: what the rendered module holds. */
export interface FingeringScale extends HanonRuns<string> {
  key: string;
  mode: HanonMode;
  /** Printed page of the G. Schirmer edition. */
  page: number;
}

export interface FingeringChromatic extends HanonRuns<string> {
  page: number;
}

/** No. 41: the arpeggio of the major or minor triad in root position. */
export type HanonArpeggioMode = 'major' | 'minor';

/** One entry of hanon41.json, the fields used here: runs of 13 notes, four octaves of a triad. */
export interface HanonArpeggioEntry extends HanonRuns<number[]> {
  number: 41;
  key: string;
  mode: HanonArpeggioMode;
  page: number;
  notes: string[];
  notesDown: string[];
  notesLeft: string[];
  notesLeftDown: string[];
}

export interface FingeringArpeggio extends HanonRuns<string> {
  key: string;
  mode: HanonArpeggioMode;
  page: number;
}

export interface FingeringData {
  scales: FingeringScale[];
  chromatic: FingeringChromatic;
  arpeggios: FingeringArpeggio[];
  corrections: HanonCorrection[];
}

const NOTE = /^[A-G](#{1,2}|b{1,2})?\d$/;

function isFingerList(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((f) => Number.isInteger(f) && (f as number) >= 1 && (f as number) <= 5)
  );
}

function isNoteList(value: unknown, length: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((n) => typeof n === 'string' && NOTE.test(n))
  );
}

/** Checks the shape of hanon.json and keeps the entries used: No. 39 and No. 40 at the octave. */
export function readHanon(json: unknown): HanonEntry[] {
  if (!Array.isArray(json)) throw new Error('hanon.json: not a list');
  const out: HanonEntry[] = [];
  for (const raw of json as unknown[]) {
    const e = raw as Partial<Record<keyof HanonEntry, unknown>>;
    const chromatic = e.number === 40;
    if (chromatic && e.variant !== 'octave') continue;
    const length = chromatic ? 49 : 29;
    const where = `hanon.json ${String(e.number)} ${String(e.key)} ${String(e.mode)}`;
    if (e.number !== 39 && e.number !== 40) throw new Error(`${where}: unknown number`);
    if (typeof e.key !== 'string' || typeof e.mode !== 'string' || typeof e.page !== 'number')
      throw new Error(`${where}: key, mode or page missing`);
    for (const run of RUNS)
      if (!isFingerList(e[run], length))
        throw new Error(`${where}: ${run} is not ${length} fingers`);
    for (const names of ['notes', 'notesDown', 'notesLeft', 'notesLeftDown'] as const)
      if (!isNoteList(e[names], length))
        throw new Error(`${where}: ${names} is not ${length} notes`);
    out.push(e as HanonEntry);
  }
  return out;
}

/** Checks the shape of hanon41.json (No. 41, the arpeggios on the triads in the 24 keys). */
export function readHanonArpeggios(json: unknown): HanonArpeggioEntry[] {
  if (!Array.isArray(json)) throw new Error('hanon41.json: not a list');
  const out: HanonArpeggioEntry[] = [];
  for (const raw of json as unknown[]) {
    const e = raw as Partial<Record<keyof HanonArpeggioEntry, unknown>>;
    const where = `hanon41.json ${String(e.key)} ${String(e.mode)}`;
    if (e.number !== 41) throw new Error(`${where}: not No. 41`);
    if (typeof e.key !== 'string' || (e.mode !== 'major' && e.mode !== 'minor'))
      throw new Error(`${where}: key or mode missing`);
    if (typeof e.page !== 'number') throw new Error(`${where}: page missing`);
    for (const run of RUNS)
      if (!isFingerList(e[run], 13)) throw new Error(`${where}: ${run} is not 13 fingers`);
    for (const names of ['notes', 'notesDown', 'notesLeft', 'notesLeftDown'] as const)
      if (!isNoteList(e[names], 13)) throw new Error(`${where}: ${names} is not 13 notes`);
    out.push(e as HanonArpeggioEntry);
  }
  if (out.length !== 24) throw new Error(`hanon41.json: ${out.length} arpeggios, expected 24`);
  return out;
}

/** `1231234 1231234 1231234 1231234 5`: octaves of `period` notes from the start, the top apart. */
function digitsUp(fingers: readonly number[], period: number): string {
  const groups: string[] = [];
  for (let i = 0; i < fingers.length - 1; i += period)
    groups.push(fingers.slice(i, i + period).join(''));
  return [...groups, String(fingers.at(-1))].join(' ');
}

/** `5 4321321 4321321 4321321 4321321`: the top, then octaves of `period` notes ending on the tonic. */
function digitsDown(fingers: readonly number[], period: number): string {
  const groups = [String(fingers[0])];
  for (let i = 1; i < fingers.length; i += period)
    groups.push(fingers.slice(i, i + period).join(''));
  return groups.join(' ');
}

function runsAsDigits(e: HanonRuns<readonly number[]>, period: number): HanonRuns<string> {
  return {
    rightUp: digitsUp(e.rightUp, period),
    rightDown: digitsDown(e.rightDown, period),
    leftUp: digitsUp(e.leftUp, period),
    leftDown: digitsDown(e.leftDown, period),
  };
}

/** Hanon's order is by fourths; the module keeps it, so it reads alongside the scan. */
export function fingeringData(
  entries: readonly HanonEntry[],
  arpeggioEntries: readonly HanonArpeggioEntry[],
): FingeringData {
  const scales: FingeringScale[] = [];
  let chromatic: FingeringChromatic | null = null;
  for (const entry of entries) {
    const e: HanonEntry = { ...entry };
    for (const run of RUNS) e[run] = [...entry[run]];
    if (e.mode === 'chromatic') {
      if (e.notes[0] !== 'C3' || e.notesLeft[0] !== 'C2')
        throw new Error('hanon.json: the chromatic scale at the octave does not start on C');
      chromatic = { page: e.page, ...runsAsDigits(e, 12) };
      continue;
    }
    const mode = e.mode;
    for (const c of CORRECTIONS) {
      if (c.key !== e.key || c.mode !== mode) continue;
      const names = c.run.startsWith('right')
        ? c.run.endsWith('Up')
          ? e.notes
          : e.notesDown
        : c.run.endsWith('Up')
          ? e.notesLeft
          : e.notesLeftDown;
      if (names[c.index] !== c.note || e[c.run][c.index] !== c.printed)
        throw new Error(`correction ${c.key} ${c.mode} ${c.run}[${c.index}] does not match`);
      e[c.run][c.index] = c.used;
    }
    scales.push({ key: e.key, mode, page: e.page, ...runsAsDigits(e, 7) });
  }
  if (!chromatic) throw new Error('hanon.json: no chromatic scale at the octave');
  if (scales.length !== 36) throw new Error(`hanon.json: ${scales.length} scales, expected 36`);
  const arpeggios = arpeggioEntries.map((e): FingeringArpeggio => ({
    key: e.key,
    mode: e.mode,
    page: e.page,
    ...runsAsDigits(e, 3),
  }));
  return { scales, chromatic, arpeggios, corrections: [...CORRECTIONS] };
}

export const EDITION =
  'Charles-Louis Hanon, The Virtuoso Pianist, Nos. 39, 40 and 41. G. Schirmer, New York, n.d. [1900], plate 15538 (IMSLP #91547).';

const HEADER = `// Generated by scripts/scales/fingering.ts from scripts/scales/hanon/hanon.json and hanon41.json.
// Do not edit: change the transcription or the corrections there and run
//   node --experimental-strip-types scripts/scales/fingering.ts
//
// Fingering from Charles-Louis Hanon, The Virtuoso Pianist, G. Schirmer, New York, n.d. [1900],
// plate 15538, IMSLP #91547: No. 39 (the major, harmonic minor and melodic minor scales), No. 40
// (the chromatic scale at the octave) and No. 41 (the arpeggios on the major and minor triads), as
// printed there: four octaves, hands an octave apart. How it was read and checked is in
// scripts/scales/hanon/README.md.
//
// Each run is a string of fingers, one digit per note, grouped by octave for reading (spaces carry
// no meaning). \`…Up\` goes from the tonic to the top note inclusive, \`…Down\` from the top note back
// to the tonic inclusive, so the top note is the last digit of one and the first of the other.
// Hanon never prints the closing tonic of a scale (his run repeats); it takes his starting finger.
// Melodic minor goes down as the natural minor. Keys are Hanon's spelling (G♭ major, not F♯).
// The arpeggios have 13 notes a run, grouped by octave of the triad (root, third, fifth).
`;

function quote(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function runsSource(r: HanonRuns<string>, indent: string): string {
  return RUNS.map((run) => `${indent}${run}: ${quote(r[run])},\n`).join('');
}

/** The module's source, formatted as Prettier formats it (fingering.ts runs Prettier over it). */
export function renderFingeringModule(data: FingeringData): string {
  const corrected = new Set(data.corrections.map((c) => `${c.key}:${c.mode}`));
  let out = HEADER;
  out += `
export const HANON_EDITION =
  ${quote(EDITION)};

export interface HanonRuns {
  rightUp: string;
  rightDown: string;
  leftUp: string;
  leftDown: string;
}

export interface HanonScale extends HanonRuns {
  /** Hanon's spelling of the tonic. */
  key: string;
  mode: 'major' | 'harmonicMinor' | 'melodicMinor';
  /** Printed page. */
  page: number;
}

/** A digit taken otherwise than printed; the runs below already hold \`used\`. */
export interface HanonCorrection {
  key: string;
  mode: HanonScale['mode'];
  run: keyof HanonRuns;
  /** Index in the run, 0 = its first note. */
  index: number;
  note: string;
  printed: number;
  used: number;
  reason: string;
}

export const HANON_CORRECTIONS: readonly HanonCorrection[] = [
`;
  for (const c of data.corrections) {
    out += '  {\n';
    out += `    key: ${quote(c.key)},\n    mode: ${quote(c.mode)},\n    run: ${quote(c.run)},\n`;
    out += `    index: ${c.index},\n    note: ${quote(c.note)},\n`;
    out += `    printed: ${c.printed},\n    used: ${c.used},\n`;
    out += `    reason:\n      ${quote(c.reason)},\n`;
    out += '  },\n';
  }
  out += `];

/** No. 39, in Hanon's order (majors by fourths, each followed by its relative minor twice). */
export const HANON_SCALES: readonly HanonScale[] = [
`;
  for (const s of data.scales) {
    if (corrected.has(`${s.key}:${s.mode}`)) {
      for (const c of data.corrections.filter((x) => x.key === s.key && x.mode === s.mode))
        out += `  // ${c.run}[${c.index}] (${c.note}): printed ${c.printed}, used ${c.used}; see HANON_CORRECTIONS.\n`;
    }
    out += '  {\n';
    out += `    key: ${quote(s.key)},\n    mode: ${quote(s.mode)},\n    page: ${s.page},\n`;
    out += runsSource(s, '    ');
    out += '  },\n';
  }
  const c = data.chromatic;
  out += `];

/** No. 40, the chromatic scale at the octave, from C (right hand C3, left hand C2). */
export const HANON_CHROMATIC: HanonRuns & { page: number } = {
  page: ${c.page},
${runsSource(c, '  ')}};

export interface HanonArpeggio extends HanonRuns {
  /** Hanon's spelling of the root. */
  key: string;
  mode: 'major' | 'minor';
  /** Printed page. */
  page: number;
}

/**
 * No. 41, in Hanon's order (majors by fourths, each followed by its relative minor). Digits he did
 * not print are filled by the rules of scripts/scales/hanon/build41.py.
 */
export const HANON_ARPEGGIOS: readonly HanonArpeggio[] = [
`;
  for (const a of data.arpeggios) {
    out += '  {\n';
    out += `    key: ${quote(a.key)},\n    mode: ${quote(a.mode)},\n    page: ${a.page},\n`;
    out += runsSource(a, '    ');
    out += '  },\n';
  }
  out += '];\n';
  return out;
}
