import { noteAbove, rootPc } from './chordSymbols.ts';
import { fnv1a } from './pieceRecords.ts';
import { leftHand, type KeyChord, type LeftBar, type ProgressionChord } from './progressions.ts';
import { seededRng, type Rng } from './random.ts';
import { tonicPitch } from './scales.ts';
import type { Root } from './theoryItems.ts';

// Improvise on the Harmony page (docs/HARMONY.md, "Improvise (H6)" and "Clarifications (decided
// during H6)"): a backing of chords in a loop, its left hand in a pattern below the player's
// register, straight or swung; a scale to suggest; the calls of call and response; and how a note
// played over it is heard (a chord tone, a scale tone, or outside). Everything here is a pure
// function of the choices (and a call's seed), so the same backing is always the same notes and a
// take can be played back with it.

// --- Backings --------------------------------------------------------------------------------

const chord = (
  numeral: string,
  steps: number,
  semitones: number,
  quality: ProgressionChord['quality'],
  figure: ProgressionChord['figure'] = '',
): ProgressionChord => ({ steps, semitones, quality, numeral, figure });

const I = chord('I', 0, 0, 'maj');
const vi = chord('vi', 5, 9, 'min');
const IV = chord('IV', 3, 5, 'maj');
const V = chord('V', 4, 7, 'maj');
const I7 = chord('I', 0, 0, 'dom7', '7');
const IV7 = chord('IV', 3, 5, 'dom7', '7');
const V7 = chord('V', 4, 7, 'dom7', '7');
const ii7 = chord('ii', 1, 2, 'min7', '7');
const Imaj7 = chord('I', 0, 0, 'maj7', 'maj7');
// The Dorian vamp: i7 and IV7 of the mode (Dm7 and G7 in D Dorian), the IV7's 3rd its raised 6th.
const i7 = chord('i', 0, 0, 'min7', '7');
const IV7dorian = chord('IV', 3, 5, 'dom7', '7');

export const BACKING_IDS = ['blues', 'I-vi-IV-V', 'ii-V-I', 'vamp'] as const;
export type BackingId = (typeof BACKING_IDS)[number];
export const isBackingId = (v: unknown): v is BackingId =>
  (BACKING_IDS as readonly unknown[]).includes(v);

/**
 * The scales suggested: the key's major scale and its pentatonic, the blues scale (the minor
 * pentatonic with the ♭5 blue note), and for the vamp its Dorian mode and minor pentatonic.
 */
export const IMPROV_SCALES = [
  'blues',
  'majorPentatonic',
  'major',
  'dorian',
  'minorPentatonic',
] as const;
export type ImprovScale = (typeof IMPROV_SCALES)[number];
export const isImprovScale = (v: unknown): v is ImprovScale =>
  (IMPROV_SCALES as readonly unknown[]).includes(v);

/** Each scale's degrees: letters and semitones above the tonic (so it is spelled from the key). */
export const SCALE_DEGREES: Readonly<
  Record<ImprovScale, readonly (readonly [steps: number, semitones: number])[]>
> = {
  blues: [
    [0, 0],
    [2, 3],
    [3, 5],
    [4, 6],
    [4, 7],
    [6, 10],
  ],
  majorPentatonic: [
    [0, 0],
    [1, 2],
    [2, 4],
    [4, 7],
    [5, 9],
  ],
  major: [
    [0, 0],
    [1, 2],
    [2, 4],
    [3, 5],
    [4, 7],
    [5, 9],
    [6, 11],
  ],
  dorian: [
    [0, 0],
    [1, 2],
    [2, 3],
    [3, 5],
    [4, 7],
    [5, 9],
    [6, 10],
  ],
  minorPentatonic: [
    [0, 0],
    [2, 3],
    [3, 5],
    [4, 7],
    [6, 10],
  ],
};

/**
 * The left hand's patterns for a backing: H2's stride, arpeggio and Alberti bass, and the blues
 * shuffle (root and fifth, sixth, seventh, sixth, a pair of eighths to each beat).
 */
export const IMPROV_PATTERNS = ['shuffle', 'stride', 'arpeggio', 'alberti'] as const;
export type ImprovPattern = (typeof IMPROV_PATTERNS)[number];
export const isImprovPattern = (v: unknown): v is ImprovPattern =>
  (IMPROV_PATTERNS as readonly unknown[]).includes(v);

export const FEELS = ['straight', 'swing'] as const;
export type Feel = (typeof FEELS)[number];
export const isFeel = (v: unknown): v is Feel => (FEELS as readonly unknown[]).includes(v);

export interface Backing {
  id: BackingId;
  /** A chord to a bar, round the loop. */
  bars: readonly ProgressionChord[];
  /** Its tonics round the circle of fifths, as the Scales page names them; the first is the default. */
  keys: readonly string[];
  /** Major, or the vamp's Dorian: how its key is named. */
  mode: 'major' | 'dorian';
  /** The scales suggested; the first is the default. */
  scales: readonly ImprovScale[];
  /** The left hand's patterns; the first is the default. */
  patterns: readonly ImprovPattern[];
  feel: Feel;
}

const MAJOR_KEYS = ['C', 'G', 'D', 'Bb', 'F'] as const;

export const BACKINGS: Readonly<Record<BackingId, Backing>> = {
  // The 12-bar blues of H2, with V7 in its last bar: the turnaround that takes the loop round.
  blues: {
    id: 'blues',
    bars: [I7, I7, I7, I7, IV7, IV7, I7, I7, V7, IV7, I7, V7],
    keys: ['C', 'G', 'F'],
    mode: 'major',
    scales: ['blues', 'majorPentatonic'],
    patterns: ['shuffle', 'stride', 'arpeggio', 'alberti'],
    feel: 'swing',
  },
  'I-vi-IV-V': {
    id: 'I-vi-IV-V',
    bars: [I, vi, IV, V],
    keys: MAJOR_KEYS,
    mode: 'major',
    scales: ['majorPentatonic', 'major'],
    patterns: ['arpeggio', 'alberti', 'stride'],
    feel: 'straight',
  },
  // H2's jazz ii–V–I of seventh chords, its I held a second bar.
  'ii-V-I': {
    id: 'ii-V-I',
    bars: [ii7, V7, Imaj7, Imaj7],
    keys: MAJOR_KEYS,
    mode: 'major',
    scales: ['major', 'majorPentatonic'],
    patterns: ['stride', 'arpeggio', 'alberti'],
    feel: 'swing',
  },
  // Two chords of a Dorian mode, a bar each (Dm7–G7 in D Dorian).
  vamp: {
    id: 'vamp',
    bars: [i7, IV7dorian],
    keys: ['A', 'E', 'G', 'D'],
    mode: 'dorian',
    scales: ['dorian', 'minorPentatonic', 'blues'],
    patterns: ['arpeggio', 'alberti', 'stride'],
    feel: 'straight',
  },
};

/** The distinct chords of a backing in order, as its name writes them: I–vi–IV–V, i7–IV7. */
export function backingNumerals(id: BackingId): ProgressionChord[] {
  const bars = BACKINGS[id].bars;
  if (id === 'blues') return [I7, IV7, V7];
  return bars.filter((c, n) => n === 0 || c !== bars[n - 1]);
}

/** Quarter notes a minute to choose from. */
export const IMPROV_TEMPOS = [60, 72, 80, 96, 112, 132] as const;
export const DEFAULT_IMPROV_BPM = 80;
export const isImprovTempo = (v: unknown): v is number =>
  (IMPROV_TEMPOS as readonly unknown[]).includes(v);

/** Every backing is in 4/4. */
export const IMPROV_BEATS = 4;
/** Eighths to the bar. */
const BAR_EIGHTHS = IMPROV_BEATS * 2;
/** Bars to a phrase of call and response: the backing's call, then the player's answer. */
export const PHRASE_BARS = 2;
/**
 * Where a swung off-beat eighth falls: two thirds into the beat, the long and short eighths 2:1
 * (a triplet feel). A straight one falls halfway.
 */
export const SWING_RATIO = 2 / 3;
export const STRAIGHT_RATIO = 1 / 2;

// --- The plan --------------------------------------------------------------------------------

export interface ImprovSpec {
  backing: BackingId;
  /** One of the backing's keys. */
  key: string;
  scale: ImprovScale;
  pattern: ImprovPattern;
  feel: Feel;
  bpm: number;
  /** Call and response: the backing plays a two-bar phrase, the player answers in the next two. */
  call: boolean;
  /** The calls' seed, so the same calls play again (a take played back). */
  seed: number;
}

/** Whether a spec is one the setup can make (the key, scale and pattern of its backing). */
export function isImprovSpec(spec: Omit<ImprovSpec, 'seed' | 'call' | 'bpm'>): boolean {
  const backing = BACKINGS[spec.backing];
  return (
    backing.keys.includes(spec.key) &&
    backing.scales.includes(spec.scale) &&
    backing.patterns.includes(spec.pattern)
  );
}

/** A note of the backing's left hand within its loop bar, in eighths. */
export interface CompEvent {
  keys: number[];
  onset: number;
  duration: number;
  /** The bass (the bar's root, a stride's fifth) or the chord above it. */
  part: 'bass' | 'chord';
  /** The second of a pair of eighths (the shuffle's off-beat, Alberti's upper notes): lighter. */
  light?: boolean;
  /** Played short (the stride's chords on 2 and 4), whatever its written length. */
  short?: boolean;
}

export interface ImprovPlan {
  spec: ImprovSpec;
  beatMs: number;
  barMs: number;
  /** Where an off-beat eighth falls in its beat: `SWING_RATIO` or `STRAIGHT_RATIO`. */
  ratio: number;
  /** The loop's chords, a bar each, as the key spells them. */
  chords: KeyChord[];
  /** The loop's left hand, a bar each. */
  comp: CompEvent[][];
  /** The scale's tones from the tonic, spelled. */
  scaleTones: Root[];
  scalePcs: ReadonlySet<number>;
}

const tonicRoot = (tonic: string): Root => {
  const { step, alter } = tonicPitch(tonic, 4);
  return { step, alter };
};

/** The scale's tones from the tonic, spelled from it by letter (C blues: C E♭ F G♭ G B♭). */
export function scaleTones(tonic: string, scale: ImprovScale): Root[] {
  const root = tonicRoot(tonic);
  return SCALE_DEGREES[scale].map(([steps, semitones]) => noteAbove(root, steps, semitones));
}

/**
 * D2: the shuffle's root from here (C3, F2 and G2 in C; D2 for G's D7), so its dyads stay below
 * the player's register (up to B3) and none is lower than D2.
 */
const SHUFFLE_LOW = 38;
/** The shuffle's upper note on each beat, above the root: fifth, sixth, seventh, sixth. */
const SHUFFLE_TOPS = [7, 9, 10, 9] as const;

const from = (pc: number, low: number) => low + ((((pc - low) % 12) + 12) % 12);

/**
 * The blues shuffle under a dominant seventh chord (only the blues offers it): a dyad on each
 * beat, struck on the beat and on its off-beat.
 */
function shuffleBar(c: KeyChord): CompEvent[] {
  const root = from(rootPc(c.symbol.root), SHUFFLE_LOW);
  return SHUFFLE_TOPS.flatMap((top, beat) => {
    const keys = [root, root + top];
    return [
      { keys, onset: beat * 2, duration: 1, part: 'bass' as const },
      { keys, onset: beat * 2 + 1, duration: 1, part: 'bass' as const, light: true },
    ];
  });
}

/**
 * H2's left hand, each event given its part: the stride's root and fifth on 1 and 3 are the bass,
 * its chords on 2 and 4 short; the arpeggio's root is the bass; Alberti's low note on each beat
 * pair is the bass, its off-beat eighths lighter.
 */
function fromLeftBar(pattern: Exclude<ImprovPattern, 'shuffle'>, bar: LeftBar): CompEvent[] {
  return bar.events.map((e, n): CompEvent => {
    const event = { keys: e.keys, onset: e.onset, duration: e.duration };
    switch (pattern) {
      case 'stride':
        return n % 2 === 0 ? { ...event, part: 'bass' } : { ...event, part: 'chord', short: true };
      case 'arpeggio':
        return { ...event, part: n === 0 ? 'bass' : 'chord' };
      case 'alberti':
        return { ...event, part: n % 4 === 0 ? 'bass' : 'chord', light: n % 2 === 1 };
    }
  });
}

export function improvPlan(spec: ImprovSpec): ImprovPlan {
  const backing = BACKINGS[spec.backing];
  const beatMs = 60_000 / spec.bpm;
  // The loop is always heard going round: its chords are voiced so.
  const h2 = spec.pattern === 'shuffle' ? null : spec.pattern;
  const { chords, left } = leftHand(backing.bars, spec.key, h2 ?? 'block', true);
  const comp = chords.map((c, n) => (h2 === null ? shuffleBar(c) : fromLeftBar(h2, left[n]!)));
  const tones = scaleTones(spec.key, spec.scale);
  return {
    spec,
    beatMs,
    barMs: beatMs * IMPROV_BEATS,
    ratio: spec.feel === 'swing' ? SWING_RATIO : STRAIGHT_RATIO,
    chords,
    comp,
    scaleTones: tones,
    scalePcs: new Set(tones.map(rootPc)),
  };
}

export const loopBars = (plan: ImprovPlan) => plan.chords.length;
const mod = (n: number, m: number) => ((n % m) + m) % m;
export const loopBar = (plan: ImprovPlan, bar: number) => mod(bar, loopBars(plan));
export const chordOfBar = (plan: ImprovPlan, bar: number): KeyChord =>
  plan.chords[loopBar(plan, bar)]!;

/** Milliseconds from a bar's 1 to its eighth `e` (0–8), swung or straight. */
export function eighthTime(plan: ImprovPlan, e: number): number {
  const beat = Math.floor(e / 2);
  return beat * plan.beatMs + (e % 2 === 1 ? plan.ratio * plan.beatMs : 0);
}

/** The bar's 1, in ms from the first bar's (time 0). */
export const barStart = (plan: ImprovPlan, bar: number) => bar * plan.barMs;

// --- Call and response -----------------------------------------------------------------------

/** Phrases of two bars from the first: the even ones the backing's calls, the odd the answers. */
export const phraseOf = (bar: number) => Math.floor(bar / PHRASE_BARS);
export const isCallBar = (plan: ImprovPlan, bar: number) =>
  plan.spec.call && bar >= 0 && phraseOf(bar) % 2 === 0;
/** The bars the player plays in: every bar, or with call and response the answers. */
export const isPlayerBar = (plan: ImprovPlan, bar: number) => !isCallBar(plan, bar);

/** A note of a call: in eighths from the phrase's first 1, two bars long. */
export interface CallNote {
  midi: number;
  onset: number;
  duration: number;
  /** Velocity above or below the call's level. */
  accent: number;
}

/** C4 to C6: where the calls are played (the player's register, the backing below it). */
export const CALL_LOW = 60;
export const CALL_HIGH = 84;
/** The calls keep a little inside it. */
const CALL_FLOOR = 62;
const CALL_CEILING = 81;

/**
 * Two-bar rhythms of a call, `[onset, duration]` in eighths from its first 1: varied (pickups,
 * syncopations, runs of eighths and longer notes), the last note the longest or as long, and every
 * one done by the second bar's last eighth so the answer starts from a breath.
 */
export const CALL_RHYTHMS: readonly (readonly (readonly [number, number])[])[] = [
  [
    [0, 2],
    [2, 2],
    [4, 1],
    [5, 1],
    [6, 2],
    [8, 4],
  ],
  [
    [1, 1],
    [2, 1],
    [3, 2],
    [6, 1],
    [7, 1],
    [8, 2],
    [10, 4],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 2],
    [8, 1],
    [9, 1],
    [10, 2],
    [12, 3],
  ],
  [
    [0, 3],
    [3, 1],
    [4, 2],
    [7, 1],
    [8, 4],
  ],
  [
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 2],
    [8, 2],
    [12, 3],
  ],
  [
    [0, 2],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 2],
    [9, 1],
    [10, 4],
  ],
  [
    [1, 1],
    [2, 2],
    [4, 1],
    [5, 2],
    [8, 1],
    [9, 1],
    [10, 1],
    [11, 1],
    [12, 3],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 2],
    [4, 4],
    [8, 1],
    [9, 1],
    [10, 4],
  ],
];

/** The keys of the scale (and `extra` pitch classes) within C4–C6, low to high. */
function scaleKeys(plan: ImprovPlan, extra: readonly number[] = []): number[] {
  const pcs = new Set([...plan.scalePcs, ...extra]);
  const keys: number[] = [];
  for (let midi = CALL_LOW; midi <= CALL_HIGH; midi++) if (pcs.has(midi % 12)) keys.push(midi);
  return keys;
}

/** The chord tone nearest `midi` within the call's range (the lower on a tie), preferring `pcs`. */
function nearestTone(midi: number, pcs: readonly number[]): number {
  let best = midi;
  let distance = Infinity;
  for (let key = CALL_FLOOR; key <= CALL_CEILING; key++) {
    if (!pcs.includes(key % 12)) continue;
    const d = Math.abs(key - midi);
    if (d < distance) {
      distance = d;
      best = key;
    }
  }
  return best;
}

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;

/** The seed of a phrase's call: the session's seed and the phrase, mixed. */
const phraseSeed = (seed: number, phrase: number) =>
  (Math.imul(seed ^ 0x5bd1e995, 0x9e3779b1) + Math.imul(phrase + 1, 0x85ebca6b)) >>> 0;

/**
 * The call of a phrase (an even one): a short motif of the scale in two bars, its rhythm one of
 * `CALL_RHYTHMS`, moving mostly by step with a leap now and then, its notes on the 1 and the 3 a
 * tone of the chord sounding then, and its last note a chord tone (the root, 3rd or 5th where one
 * is near). Within C4–C6, kept a little inside it.
 */
export function callNotes(plan: ImprovPlan, phrase: number): CallNote[] {
  const rng = seededRng(phraseSeed(plan.spec.seed, phrase));
  const rhythm = pick(rng, CALL_RHYTHMS);
  const keys = scaleKeys(plan).filter((k) => k >= CALL_FLOOR && k <= CALL_CEILING);
  const firstBar = phrase * PHRASE_BARS;
  const chordAt = (onset: number) => chordOfBar(plan, firstBar + Math.floor(onset / BAR_EIGHTHS));
  // Start on a chord tone near the middle of the range.
  const first = chordAt(rhythm[0]![0]);
  const starts = keys.filter((k) => k >= 65 && k <= 76 && first.pcs.includes(k % 12));
  let midi = starts.length > 0 ? pick(rng, starts) : nearestTone(70, first.pcs);
  let direction = rng() < 0.5 ? 1 : -1;
  const notes: CallNote[] = [];
  rhythm.forEach(([onset, duration], n) => {
    const last = n === rhythm.length - 1;
    if (n > 0) {
      // Mostly a step of the scale, sometimes a third or a fourth; keep going the same way more
      // often than not, and turn back at the edges.
      if (rng() > 0.65) direction = -direction;
      const size = rng() < 0.7 ? 1 : rng() < 0.75 ? 2 : 3;
      let index = keys.findIndex((k) => k >= midi);
      if (index < 0) index = keys.length - 1;
      let next = index + direction * size;
      if (next < 0 || next >= keys.length) {
        direction = -direction;
        next = index + direction * size;
      }
      midi = keys[Math.max(0, Math.min(keys.length - 1, next))]!;
    }
    const c = chordAt(onset);
    const strong = onset % 4 === 0;
    if (last) {
      // Home on the root, 3rd or 5th if one is within a third (another key than the note before
      // where one is), else the nearest chord tone.
      const stable = c.pcs.slice(0, 3);
      const before = notes.at(-1)?.midi;
      const moved = stable.filter((pc) => pc !== (before ?? -1) % 12);
      const near = nearestTone(midi, moved.length > 0 ? moved : stable);
      midi = Math.abs(near - midi) <= 4 ? near : nearestTone(midi, c.pcs);
    } else if (strong) {
      midi = nearestTone(midi, c.pcs);
    }
    const accent = n === 0 ? 6 : last ? -2 : strong ? 4 : onset % 2 === 1 ? -6 : 0;
    notes.push({ midi, onset, duration, accent });
  });
  return notes;
}

// --- What the backing plays ------------------------------------------------------------------

export interface BackingNote {
  midi: number;
  /** ms from time 0, the first bar's 1. */
  on: number;
  off: number;
  velocity: number;
  part: 'bass' | 'chord' | 'call';
}

/** The backing's levels against the accompaniment level set in Settings (the bass at it). */
export const CHORD_BELOW = 8;
export const LIGHT_BELOW = 6;
export const CALL_ABOVE = 8;

const clampVelocity = (v: number) => Math.max(1, Math.min(127, Math.round(v)));

/**
 * What the backing plays in bar `bar` (from 0, the loop going round), its times in ms from the
 * first bar's 1: the left hand of the loop's bar, and with call and response the call's notes
 * that start in it. `level` is the accompaniment level (Settings): the bass at it, the chords
 * lighter, the call a little above. Each note ends a moment before its written end, so a key
 * struck again sounds again; the stride's chords are short.
 */
export function backingBar(plan: ImprovPlan, bar: number, level: number): BackingNote[] {
  const start = barStart(plan, bar);
  const gap = Math.min(30, plan.beatMs * 0.06);
  const time = (e: number) => start + eighthTime(plan, e);
  const notes: BackingNote[] = [];
  for (const event of plan.comp[loopBar(plan, bar)]!) {
    const on = time(event.onset);
    const off = event.short ? on + plan.beatMs * 0.55 : time(event.onset + event.duration) - gap;
    const velocity = clampVelocity(
      level - (event.part === 'chord' ? CHORD_BELOW : 0) - (event.light ? LIGHT_BELOW : 0),
    );
    for (const midi of event.keys) notes.push({ midi, on, off, velocity, part: event.part });
  }
  if (isCallBar(plan, bar) && bar % PHRASE_BARS === 0) {
    const first = barStart(plan, bar);
    for (const n of callNotes(plan, phraseOf(bar))) {
      const at = (e: number) =>
        first + Math.floor(e / BAR_EIGHTHS) * plan.barMs + eighthTime(plan, e % BAR_EIGHTHS);
      notes.push({
        midi: n.midi,
        on: at(n.onset),
        off: at(n.onset + n.duration) - gap,
        velocity: clampVelocity(level + CALL_ABOVE + n.accent),
        part: 'call',
      });
    }
  }
  return notes;
}

/**
 * The backing's checksum: its loop's left hand as generated (keys, onsets and lengths), with its
 * feel. A take of an improvisation keeps it, as a piece run's keeps its score's, so a backing
 * generated otherwise since is known.
 */
export function backingChecksum(plan: ImprovPlan): string {
  const text = plan.comp
    .map((bar) => bar.map((e) => `${e.keys.join('.')}@${e.onset}+${e.duration}`).join(' '))
    .join('|');
  return fnv1a(
    `${plan.spec.backing}:${plan.spec.key}:${plan.spec.pattern}:${plan.spec.feel}|${text}`,
  );
}

/** `improv:blues:F`: the "piece" of an improvisation's take, its backing and key. */
export const improvPieceId = (spec: Pick<ImprovSpec, 'backing' | 'key'>) =>
  `improv:${spec.backing}:${spec.key}`;

// --- How a note is heard ---------------------------------------------------------------------

/** How a note played sounds against the backing. */
export type NoteClass = 'chord' | 'scale' | 'outside';

/**
 * A note this far before a bar's 1 (a sixteenth) belongs to the bar it leads into: played a
 * moment early for the new chord, it is heard with it.
 */
export const anticipation = (plan: ImprovPlan) => plan.beatMs / 4;

/** The bar a note at `ms` (from time 0, its latency taken off) belongs to. */
export const noteBar = (plan: ImprovPlan, ms: number) =>
  Math.floor((ms + anticipation(plan)) / plan.barMs);

/**
 * A chord tone of the chord sounding when the note was struck (the next bar's when it comes a
 * sixteenth early, the first bar's in the count-in), else a tone of the scale, else outside.
 */
export function classifyNote(plan: ImprovPlan, midi: number, ms: number): NoteClass {
  const c = chordOfBar(plan, Math.max(0, noteBar(plan, ms)));
  const pc = ((midi % 12) + 12) % 12;
  if (c.pcs.includes(pc)) return 'chord';
  return plan.scalePcs.has(pc) ? 'scale' : 'outside';
}

/**
 * Whether a note at `ms` is on a strong beat (the 1 or the 3 of its bar): within a sixteenth of
 * it, either side.
 */
export function isStrongBeat(plan: ImprovPlan, ms: number): boolean {
  const window = anticipation(plan);
  const within = mod(ms, plan.barMs);
  const half = plan.barMs / 2;
  return within <= window || plan.barMs - within <= window || Math.abs(within - half) <= window;
}
