// Rhythm on Read (docs/READING.md, "Rhythm (R1)"): the cells a rhythm line is built from, the
// levels R1–R10 and the item keys the answers are stored under. A cell is one beat long (a
// dotted-quarter beat in 6/8), or two, three or four beats for the longer notes and the
// syncopations; its key names its written shape, so two cells that sound alike (`h` and `q` tied
// to `q`) are separate items. Everything here is in ticks (`TICKS_PER_QUARTER` to a quarter), so
// an eighth of a triplet (320) and a sixteenth (240) are whole numbers.

import { TICKS_PER_QUARTER } from './score.ts';

export type RhythmMeter = '4/4' | '3/4' | '2/4' | '6/8';
export const RHYTHM_METERS: readonly RhythmMeter[] = ['4/4', '3/4', '2/4', '6/8'];

export const isRhythmMeter = (v: unknown): v is RhythmMeter =>
  (RHYTHM_METERS as readonly unknown[]).includes(v);

/** The beat a player counts and the click sounds: a quarter, or a dotted quarter in 6/8. */
export function beatTicksOf(meter: RhythmMeter): number {
  return meter === '6/8' ? (TICKS_PER_QUARTER * 3) / 2 : TICKS_PER_QUARTER;
}

/** Beats to the bar (two in 6/8). */
export function beatsPerBar(meter: RhythmMeter): number {
  return meter === '6/8' ? 2 : Number(meter[0]);
}

export function barTicksOf(meter: RhythmMeter): number {
  return beatsPerBar(meter) * beatTicksOf(meter);
}

/** The time signature as written: [beats, beat type]. */
export function timeSignature(meter: RhythmMeter): [number, number] {
  const [beats, type] = meter.split('/').map(Number);
  return [beats!, type!];
}

export type NoteType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th';

/** One written note or rest of a cell. */
export interface CellNote {
  type: NoteType;
  dot: boolean;
  rest: boolean;
  /** One of three in the time of two. */
  triplet: boolean;
  /** Continues a tie from the note before (in this cell or the one before): no key is pressed. */
  tied: boolean;
  /** Tied to the next note of the cell. (A tie into the next cell is the next cell's `tied`.) */
  tie: boolean;
  ticks: number;
}

const BASE: Record<NoteType, number> = {
  whole: 4 * TICKS_PER_QUARTER,
  half: 2 * TICKS_PER_QUARTER,
  quarter: TICKS_PER_QUARTER,
  eighth: TICKS_PER_QUARTER / 2,
  '16th': TICKS_PER_QUARTER / 4,
};

/**
 * A note from a short spelling: `w h q e s` (whole to sixteenth), then `.` for a dot, `r` for a
 * rest, `3` for a triplet, `~` in front for a note tied from the one before and `~` behind for one
 * tied to the next: `q.`, `er`, `e3`, `~q`, `e~`.
 */
function note(spelling: string): CellNote {
  const tied = spelling.startsWith('~');
  const tie = spelling.length > 1 && spelling.endsWith('~');
  const body = spelling.replace(/^~/, '').replace(/~$/, '');
  const type = ({ w: 'whole', h: 'half', q: 'quarter', e: 'eighth', s: '16th' } as const)[
    body[0] as 'w' | 'h' | 'q' | 'e' | 's'
  ];
  const dot = body.includes('.');
  const triplet = body.includes('3');
  const base = BASE[type] * (dot ? 1.5 : 1);
  return {
    type,
    dot,
    rest: body.includes('r'),
    triplet,
    tied,
    tie,
    ticks: triplet ? (base * 2) / 3 : base,
  };
}

export interface CellDef {
  key: string;
  notes: readonly CellNote[];
  /** Length in beats of its meter. */
  beats: number;
  /** A 6/8 cell: one dotted-quarter beat. */
  compound: boolean;
}

function cell(key: string, spelling: string, compound = false): CellDef {
  const notes = spelling.split(' ').map(note);
  const ticks = notes.reduce((sum, n) => sum + n.ticks, 0);
  const beat = compound ? (TICKS_PER_QUARTER * 3) / 2 : TICKS_PER_QUARTER;
  return { key, notes, beats: ticks / beat, compound };
}

/**
 * Every single-line cell, by key. `~` in front of a key is the cell with its first note tied from
 * the last note of the cell before (R4's ties, within the bar or over the barline); `tie-q-e` is
 * `e-q-e` with its quarter written as two eighths tied over the beat (R7).
 */
export const CELLS: Readonly<Record<string, CellDef>> = Object.fromEntries(
  [
    cell('q', 'q'),
    cell('qr', 'qr'),
    cell('h', 'h'),
    cell('w', 'w'),
    cell('ee', 'e e'),
    cell('er-e', 'er e'),
    cell('hd', 'h.'),
    cell('qd-e', 'q. e'),
    cell('~q', '~q'),
    cell('~h', '~h'),
    cell('~ee', '~e e'),
    cell('~qd-e', '~q. e'),
    cell('ssss', 's s s s'),
    cell('e-ss', 'e s s'),
    cell('ss-e', 's s e'),
    cell('ed-s', 'e. s'),
    cell('trip', 'e3 e3 e3'),
    cell('e-q-e', 'e q e'),
    cell('tie-q-e', 'e e~ ~e e'),
    cell('c:qe', 'q e', true),
    cell('c:eq', 'e q', true),
    cell('c:eee', 'e e e', true),
    cell('c:qd', 'q.', true),
    cell('c:qdr', 'q.r', true),
  ].map((c) => [c.key, c]),
);

export const isCellKey = (v: unknown): v is string =>
  typeof v === 'string' && Object.hasOwn(CELLS, v);

/** The cells whose first note can be tied from the note before (R4). */
export const TIED_CELLS = ['~q', '~h', '~ee', '~qd-e'] as const;

/**
 * A cell of the two-hand levels, `right|left`: the right hand's cell over the left's. The left
 * cell is one beat long and repeated under the whole of the right one (R9's left hand keeps the
 * beat: `h|q` is a half note over two quarters).
 */
export interface HandsCell {
  right: string;
  left: string;
}

export function parseHandsKey(key: string): HandsCell | null {
  const parts = key.split('|');
  if (parts.length !== 2) return null;
  const [right, left] = parts as [string, string];
  if (!isCellKey(right) || !isCellKey(left)) return null;
  const l = CELLS[left]!;
  const r = CELLS[right]!;
  if (l.beats !== 1 || l.compound || r.compound || l.notes[0]!.tied || r.notes[0]!.tied)
    return null;
  return { right, left };
}

export type RhythmLevelId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10';

export interface RhythmLevel {
  id: RhythmLevelId;
  /** The cells this level adds (weighted up while it is practised). */
  adds: readonly string[];
  /** Every cell the level draws from: its own and the earlier levels' (hands keys in R9–R10). */
  cells: readonly string[];
  meters: readonly RhythmMeter[];
  /** Two lines, the right hand over the left. */
  hands: boolean;
  /** Draws sixteenths: its tempo starts at 60 instead of 72. */
  sixteenths: boolean;
  /** R7: half of the exercises start off the beat, with `er-e`. */
  offBeat: boolean;
}

const SIMPLE_ADDS: readonly (readonly string[])[] = [
  ['q', 'qr', 'h', 'w'],
  ['ee', 'er-e'],
  ['hd', 'qd-e'],
  [...TIED_CELLS],
  ['ssss', 'e-ss', 'ss-e', 'ed-s'],
  ['trip'],
  ['e-q-e', 'tie-q-e'],
];

/** R9: the right hand's cells, over the left hand's beat. */
const R9_RIGHT = ['q', 'qr', 'h', 'w', 'ee', 'er-e', 'hd', 'qd-e'];
/** R10: one-beat cells in two different rhythms at once; with `trip`, two against three. */
const R10_CELLS = ['q', 'qr', 'ee', 'er-e', 'trip'];
export const R10_CROSS = 'trip';

const r9 = R9_RIGHT.map((right) => `${right}|q`);
const r10 = R10_CELLS.flatMap((right) =>
  R10_CELLS.filter((left) => left !== right).map((left) => `${right}|${left}`),
);

export const RHYTHM_LEVELS: readonly RhythmLevel[] = [
  ...SIMPLE_ADDS.map((adds, i): RhythmLevel => {
    const cells = SIMPLE_ADDS.slice(0, i + 1).flat();
    const meters: RhythmMeter[][] = [
      ['4/4', '3/4', '2/4'],
      ['4/4', '3/4', '2/4'],
      ['4/4', '3/4'],
      ['4/4', '3/4'],
      ['4/4', '2/4'],
      ['4/4', '2/4'],
      ['4/4'],
    ];
    return {
      id: `R${i + 1}` as RhythmLevelId,
      adds,
      cells,
      meters: meters[i]!,
      hands: false,
      sixteenths: cells.includes('ssss'),
      offBeat: i === 6,
    };
  }),
  {
    id: 'R8',
    adds: ['c:qe', 'c:eq', 'c:eee', 'c:qd', 'c:qdr'],
    cells: ['c:qe', 'c:eq', 'c:eee', 'c:qd', 'c:qdr'],
    meters: ['6/8'],
    hands: false,
    sixteenths: false,
    offBeat: false,
  },
  {
    id: 'R9',
    adds: r9,
    cells: r9,
    meters: ['4/4', '3/4'],
    hands: true,
    sixteenths: false,
    offBeat: false,
  },
  {
    id: 'R10',
    adds: r10,
    cells: r10,
    meters: ['4/4', '2/4'],
    hands: true,
    sixteenths: false,
    offBeat: false,
  },
];

export const RHYTHM_LEVEL_IDS: readonly RhythmLevelId[] = RHYTHM_LEVELS.map((l) => l.id);

export const isRhythmLevelId = (v: unknown): v is RhythmLevelId =>
  (RHYTHM_LEVEL_IDS as readonly unknown[]).includes(v);

export function getRhythmLevel(id: RhythmLevelId): RhythmLevel {
  return RHYTHM_LEVELS.find((l) => l.id === id)!;
}

export function nextRhythmLevel(id: RhythmLevelId): RhythmLevelId | null {
  return RHYTHM_LEVEL_IDS[RHYTHM_LEVEL_IDS.indexOf(id) + 1] ?? null;
}

// --- Tempo -----------------------------------------------------------------------------------

export const RHYTHM_MIN_BPM = 40;
export const RHYTHM_MAX_BPM = 160;

/** Beats a minute a level starts at: 72, or 60 where it draws sixteenths. */
export function defaultRhythmBpm(level: RhythmLevelId): number {
  return getRhythmLevel(level).sixteenths ? 60 : 72;
}

export const isRhythmBpm = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= RHYTHM_MIN_BPM && v <= RHYTHM_MAX_BPM;

// --- Items -----------------------------------------------------------------------------------

/** `rhythm:<cell>:<meter>`, as the answers store keeps it: `rhythm:ed-s:4/4`, `rhythm:c:qe:6/8`. */
export function rhythmItem(cell: string, meter: RhythmMeter): string {
  return `rhythm:${cell}:${meter}`;
}

/** An item's cell and meter (the cell's own key may hold a colon: `c:qe`); null when unknown. */
export function parseRhythmItem(item: unknown): { cell: string; meter: RhythmMeter } | null {
  if (typeof item !== 'string' || !item.startsWith('rhythm:')) return null;
  const at = item.lastIndexOf(':');
  const cell = item.slice('rhythm:'.length, at);
  const meter = item.slice(at + 1);
  if (!isRhythmMeter(meter) || !isKnownCell(cell)) return null;
  return { cell, meter };
}

/** A single-line cell or a two-hand one. */
export const isKnownCell = (key: string): boolean => isCellKey(key) || parseHandsKey(key) !== null;

/** How long a cell (either kind) is, in beats of its meter. */
export function cellBeats(key: string): number {
  const hands = parseHandsKey(key);
  return CELLS[hands ? hands.right : key]!.beats;
}

/** Whether `cell` in `meter` can be one of `level`'s items. */
export function rhythmItemInLevel(level: RhythmLevel, cell: string, meter: RhythmMeter): boolean {
  return level.cells.includes(cell) && level.meters.includes(meter) && fitsMeter(cell, meter);
}

/** Whether a cell fits a bar of `meter` at all (see `fitsAt`). */
export function fitsMeter(cell: string, meter: RhythmMeter): boolean {
  const beats = beatsPerBar(meter);
  for (let at = 0; at < beats; at++) if (fitsAt(cell, meter, at)) return true;
  return false;
}

/**
 * Whether a cell can start on beat `at` (0-based) of a bar of `meter`: 6/8 takes only its own
 * cells, and simple time none of them; a cell never crosses the barline; a whole note fills the
 * bar; the syncopations start on beat 1 or 3, so the middle of a 4/4 bar is always shown.
 */
export function fitsAt(cell: string, meter: RhythmMeter, at: number): boolean {
  const hands = parseHandsKey(cell);
  const def = CELLS[hands ? hands.right : cell];
  if (!def) return false;
  if (def.compound !== (meter === '6/8')) return false;
  if (at + def.beats > beatsPerBar(meter)) return false;
  if (def.key === 'w') return at === 0;
  if (def.key === 'e-q-e' || def.key === 'tie-q-e') return at % 2 === 0;
  return true;
}

/**
 * The cell's written notes, one list per line (the right hand's first): a two-hand cell's left
 * cell repeated under the right one.
 */
export function cellLines(key: string): CellNote[][] {
  const hands = parseHandsKey(key);
  if (!hands) return [[...CELLS[key]!.notes]];
  const right = CELLS[hands.right]!;
  const left = CELLS[hands.left]!;
  return [[...right.notes], Array.from({ length: right.beats }, () => left.notes).flat()];
}

/**
 * The cell's onsets in beats from its start, one list per line: every note that is struck (not a
 * rest, not a tie's continuation). The prompt stored with each answer.
 */
export function cellOnsets(key: string, meter: RhythmMeter): number[][] {
  const beat = beatTicksOf(meter);
  return cellLines(key).map((notes) => {
    const out: number[] = [];
    let at = 0;
    for (const n of notes) {
      if (!n.rest && !n.tied) out.push(at / beat);
      at += n.ticks;
    }
    return out;
  });
}

/** Whether a cell's last note (on every line) sounds on into what follows: a tie can start there. */
export function endsWithNote(key: string): boolean {
  return cellLines(key).every((notes) => !notes.at(-1)!.rest);
}

/** Whether a cell begins with a note struck on its first beat (on some line). */
export function startsWithNote(key: string): boolean {
  return cellLines(key).some((notes) => !notes[0]!.rest && !notes[0]!.tied);
}
