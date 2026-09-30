// How a run of a piece was played beyond its notes and timing (docs/EXPRESSION.md): its loudness
// and balance against the score's dynamics (X1), and how long each note was held against its
// articulation, slurs, staccato and tenuto (X2). Everything is recomputed from the run's take
// (takes.ts) and the score, and every loudness threshold is a share of the run's own range of
// velocities, since velocity curves differ between instruments. The fractions are provisional
// until runs recorded on real instruments set them (the Pieces page's development-only "Save this
// run" button exports a run for that).

import {
  isDynamic,
  performedMarks,
  performedSpans,
  type Dynamic,
  type PedalMark,
} from './markings.ts';
import { beatTicks } from './metronome.ts';
import { playSpan, timeline } from './playback.ts';
import { playOrder, resolveLoop, type PlayedMeasure, type RepeatMode } from './repeats.ts';
import { quantile, theilSen } from './robust.ts';
import {
  buildSteps,
  inHands,
  staffKey,
  TICKS_PER_QUARTER,
  type Hand,
  type HandSelection,
  type Score,
  type ScoreNote,
  type Step,
} from './score.ts';
import { TAKE_OFF, TAKE_ON, type TakeEvent, type TakePedal } from './takes.ts';
import type { BarLoop } from './wait.ts';

// --- Constants ------------------------------------------------------------------------------------

/**
 * Bumped whenever a rule or threshold below changes what a run's figures come out as, so saved
 * runs (the development export) can be told apart.
 */
export const ANALYSIS_VERSION = 1;

/** A run's range of loudness: its velocities from this quantile... */
export const RANGE_LOW = 0.05;
/** ...to this one, so a slip or two at either end does not set it. */
export const RANGE_HIGH = 0.95;

/**
 * One level of dynamics (p to mp, mf to f; p to f is three) is at least this share of the run's
 * range louder or softer...
 */
export const DYNAMIC_STEP = 0.12;
/** ...and at least this many velocity units, however narrow the range. */
export const DYNAMIC_STEP_MIN = 4;
/**
 * A change of level is too much when it takes this much more of the run's range than its share of
 * the levels the run is marked with (mp to mf in a piece marked from pp to ff is a sixth of them).
 * The widest contrast marked is never too much: the range is the run's own.
 */
export const TOO_MUCH_SHARE = 0.3;
/**
 * A change the other way is "the wrong way round" from this share of one step on (noise alone
 * crosses less); a smaller one is no change at all, which is too little.
 */
export const WRONG_WAY_SHARE = 1;
/** A passage between two dynamics is judged when it lasts at least this many beats... */
export const MIN_PASSAGE_BEATS = 2;
/** ...and has at least this many notes played (outside hairpins and accents). */
export const MIN_PASSAGE_NOTES = 3;
/** A hairpin is judged when it lasts at least this many beats and has this many steps played. */
export const MIN_HAIRPIN_BEATS = 2;
export const MIN_HAIRPIN_STEPS = 3;

/** An accented note stands above its neighbours' median by this share of the range... */
export const ACCENT_STEP = 0.18;
/** ...and at least this many velocity units. */
export const ACCENT_STEP_MIN = 8;
/** The neighbours of an accented step: this many steps of its hand on each side. */
export const ACCENT_NEIGHBOURS = 3;

/** The melody sounds over the accompaniment by at least this share of the range... */
export const BALANCE_STEP = 0.08;
/** ...and at least this many velocity units. */
export const BALANCE_STEP_MIN = 3;
/** Notes struck within this of the melody's note are struck with it. */
export const TOGETHER_MS = 30;

/** The sustain pedal is down from this controller value on, as MIDI has it. */
export const PEDAL_DOWN = 64;

// --- Input ----------------------------------------------------------------------------------------

/** Which note is the melody for the balance: a piece setting. */
export const MELODIES = ['right', 'left', 'top'] as const;
export type Melody = (typeof MELODIES)[number];

export function isMelody(value: unknown): value is Melody {
  return (MELODIES as readonly unknown[]).includes(value);
}

/** A run as its take and its settings give it. */
export interface ExpressionInput {
  score: Score;
  hands: HandSelection;
  repeats: RepeatMode;
  loop: BarLoop | null;
  mode: 'wait' | 'rhythm';
  /** Rhythm mode: the tempo as a fraction of the score's, and the latency taken off every key. */
  scale?: number;
  latency?: number;
  events: readonly TakeEvent[];
  /** The melody for the balance (default: the right hand's top note). */
  melody?: Melody;
}

// --- Output ---------------------------------------------------------------------------------------

/** A key of the score as played: from the take, matched to its note. */
export interface PlayedNote {
  note: ScoreNote;
  hand: Hand;
  /** Index into the run's steps. */
  step: number;
  /** The round of a loop (0 = the first). */
  round: number;
  /** The step's performance tick, and its place in the play order. */
  tick: number;
  played: number;
  /** Written measure. */
  measure: number;
  /** ms from the take's time 0. */
  on: number;
  /** Released at, ms; null when still down at the end of the take. */
  off: number | null;
  velocity: number;
  /** The sustain pedal was down when the key came up. */
  pedalled: boolean;
}

export type Verdict = 'right' | 'too-little' | 'too-much' | 'wrong-way' | 'missed';

/** Where a judgement is in the score: written bars, to loop them. */
export interface BarSpan {
  from: number;
  to: number;
}

interface Judged {
  verdict: Verdict;
  /** The written bars it concerns (the first and last), for "bars to look at". */
  bars: BarSpan;
  /** Performance tick where it is marked, for the chart. */
  tick: number;
  /** Where it is marked: the pass through a repeat (1 = the first) and the beat in its bar. */
  pass: number;
  beat: number;
}

/** From one dynamic level to another: the passages before and after, compared. */
export interface LevelJudgement extends Judged {
  kind: 'level';
  from: Dynamic;
  to: Dynamic;
  /** Levels apart, signed: + louder. */
  levels: number;
  /** Median velocity after minus before; null when missed. */
  change: number | null;
  /** The least change for "right", velocity units. */
  needed: number;
}

export interface HairpinJudgement extends Judged {
  kind: 'hairpin';
  hairpin: 'crescendo' | 'diminuendo';
  written: 'wedge' | 'words';
  end: number;
  hand: Hand;
  /** The fitted change over the span, velocity units (+ louder); null when missed. */
  change: number | null;
  needed: number;
}

/** An accent, strong accent, sf, sfz, fz, rf… on a note or a chord. */
export interface AccentJudgement extends Judged {
  kind: 'accent';
  mark: 'accent' | 'strong-accent' | Dynamic;
  hand: Hand;
  /** Above the neighbours' median, velocity units; null when missed. */
  margin: number | null;
  needed: number;
}

export type DynamicsJudgement = LevelJudgement | HairpinJudgement | AccentJudgement;

export type BalanceVerdict = 'balanced' | 'equal' | 'under';

export interface BalanceBar {
  /** Written measure. */
  measure: number;
  /** Melody notes struck with the accompaniment in it. */
  groups: number;
  /** Median of melody − the median of the notes struck with it, velocity units. */
  margin: number;
  verdict: BalanceVerdict;
}

/** A beat of the run in the order played: the curve's x. */
export interface BeatSlot {
  round: number;
  played: number;
  measure: number;
  /** 0-based beat in the bar. */
  beat: number;
  /** Performance ticks: where the beat starts and its length. */
  tick: number;
  length: number;
}

/** One bar as played (a round and a place in the play order): its loudness per hand. */
export interface BarLoudness {
  round: number;
  played: number;
  measure: number;
  /** Median velocity of the hand's notes in it; null when it played none. */
  right: number | null;
  left: number | null;
}

export interface Loudness {
  /** P5 and P95 of the run's velocities. */
  low: number;
  high: number;
}

/** The score's dynamics over what was played, in performance ticks: for the chart. */
export interface DynamicsMarks {
  dynamics: { tick: number; dynamic: Dynamic }[];
  hairpins: {
    tick: number;
    end: number;
    kind: 'crescendo' | 'diminuendo';
    written: 'wedge' | 'words';
  }[];
  accents: { tick: number }[];
}

export interface DynamicsAnalysis {
  /** Whether the keys carried loudness: the computer keyboard and a pointer do not. */
  velocityMeasured: boolean;
  range: Loudness | null;
  /** The thresholds in velocity units for this run. */
  step: number;
  accentStep: number;
  balanceStep: number;
  /** Per hand, per slot: the median velocity of the notes begun in it, or null. */
  curve: Record<Hand, (number | null)[]>;
  /** The bars played, in order, for the table. */
  bars: BarLoudness[];
  /** Where the run played, the score has a dynamic in force, a hairpin or an accent... */
  marked: boolean;
  /** ...and asks for a change there: another level, a hairpin or an accent. */
  changes: boolean;
  marks: DynamicsMarks;
  judgements: DynamicsJudgement[];
  /** Null when the hands never played together (one hand practised). */
  balance: {
    groups: number;
    balanced: number;
    margin: number;
    bars: BalanceBar[];
  } | null;
}

export interface ExpressionAnalysis {
  version: number;
  /** How the run was timed: held lengths are against the tempo (rhythm) or the run's own pace. */
  mode: 'wait' | 'rhythm';
  notes: PlayedNote[];
  /** Rounds of a loop that were played (1 without a loop). */
  rounds: number;
  /** The beats of the bars played, in order: the charts' x axis. */
  slots: BeatSlot[];
  dynamics: DynamicsAnalysis;
  articulation: ArticulationAnalysis;
  pedal: PedalAnalysis;
}

// --- Articulation (X2) ----------------------------------------------------------------------------

/** Legato: a note let go this long before the next begins has left a gap ("broken")... */
export const LEGATO_GAP_MS = 20;
/** ...and one held this long into the next smudges it. */
export const LEGATO_OVERLAP_MS = 80;
/** A staccato (or spiccato) note is held at most this share of its written length... */
export const STACCATO_MAX = 0.5;
/** ...a staccatissimo at most this share. */
export const STACCATISSIMO_MAX = 1 / 3;
/** A tenuto is held at least this share of its length. */
export const TENUTO_MIN = 0.9;
/** A plain note let go before this share of its length is cut short (unless it may breathe). */
export const CUT_SHORT = 0.7;

/** How a note is marked to be played. */
export type Touch = 'legato' | 'staccato' | 'staccatissimo' | 'tenuto' | 'plain';

export type ArticulationVerdict =
  | 'right'
  /** Legato: a gap before the next note. */
  | 'broken'
  /** Legato: held too far into the next note. */
  | 'smudged'
  /** Staccato: held too long. */
  | 'long'
  /** Tenuto: not held its length. */
  | 'short'
  /** A plain note let go early. */
  | 'cut-short';

export type ArticulationProblem = Exclude<ArticulationVerdict, 'right'>;
export const ARTICULATION_PROBLEMS: readonly ArticulationProblem[] = [
  'broken',
  'smudged',
  'long',
  'short',
  'cut-short',
];

export interface NoteArticulation {
  played: PlayedNote;
  touch: Touch;
  /** Held, ms. */
  held: number;
  /** The written length at the tempo played (or, in wait mode, as the run went), ms; legato: none. */
  written: number | null;
  /** Legato: the next note's start less this one's release (+ a gap, − an overlap), ms. */
  join: number | null;
  verdict: ArticulationVerdict;
}

export interface ArticulationBar {
  round: number;
  played: number;
  measure: number;
  judged: number;
  right: number;
  problems: Record<ArticulationProblem, number>;
}

export interface ArticulationMarks {
  /** Slurs played, in performance ticks from their first note to their last. */
  slurs: { tick: number; end: number }[];
  /** Notes marked short (staccato, staccatissimo, spiccato) and held (tenuto). */
  short: { tick: number }[];
  held: { tick: number }[];
}

export interface ArticulationAnalysis {
  /** The notes judged, in the order played. */
  notes: NoteArticulation[];
  /** Notes let go while the sustain pedal was down: the pedal hides their release. */
  pedalled: number;
  judged: number;
  right: number;
  /** The bars played, in order. */
  bars: ArticulationBar[];
  marks: ArticulationMarks;
}

// --- Pedal (X3) -----------------------------------------------------------------------------------

/**
 * At a marked change the sustain pedal goes up at most this long after the new note is struck (the
 * lesson on the pedals uses the same)...
 */
export const CHANGE_MAX_MS = 250;
/** ...and down again at most this long after it went up (legato, or syncopated, pedalling). */
export const RELEASE_MAX_MS = 400;
/**
 * Lifted early, the pedal leaves a gap only when nothing sounds for longer than this (as long as
 * legato allows between two notes): a hand holding the notes over leaves none.
 */
export const PEDAL_GAP_MS = LEGATO_GAP_MS;
/** Una corda and sostenuto are held through their marked span when down this share of it. */
export const CORDA_HELD = 0.9;

/** Where a pedal stood from a moment of the run on, placed in the score for the chart. */
export interface PedalPoint {
  round: number;
  /** Performance tick. */
  tick: number;
  /** The raw position, 0–127 (down from `PEDAL_DOWN`, a half pedal below it). */
  value: number;
}

export type PedalVerdict = 'clean' | 'gap' | 'blur' | 'missed';

/**
 * A sustain pedal mark as played: its start (down), a change, its stop (up), or a lift inside a
 * marked span that broke the sound.
 */
export interface PedalJudgement {
  mark: 'start' | 'change' | 'stop' | 'lift';
  verdict: PedalVerdict;
  /** A gap: how long nothing sounded; a blur: how long the old harmony rang over the new; ms. */
  ms: number | null;
  round: number;
  /** Performance tick of the mark (of a lift, where the pedal went up). */
  tick: number;
  measure: number;
  pass: number;
  beat: number;
  bars: BarSpan;
}

export type CordaVerdict = 'held' | 'partly' | 'missed';

/** A span marked _una corda_ (to _tre corde_) or sostenuto, as played. */
export interface CordaJudgement {
  pedal: 'una-corda' | 'sostenuto';
  verdict: CordaVerdict;
  /** The share of the span the pedal was down. */
  share: number;
  round: number;
  tick: number;
  measure: number;
  pass: number;
  beat: number;
  bars: BarSpan;
}

export interface PedalBar {
  round: number;
  played: number;
  measure: number;
  /** The share of the bar's time the sustain pedal was down; null when the run gave it no time. */
  down: number | null;
  judged: number;
  clean: number;
  problems: Record<Exclude<PedalVerdict, 'clean'>, number>;
}

export interface PedalAnalysis {
  /** The take has the sustain pedal (CC 64) in it; without it nothing is drawn or judged. */
  used: boolean;
  /** Each pedal as played over the beats of the run; sostenuto and una corda only when used. */
  lines: {
    sustain: PedalPoint[];
    sostenuto: PedalPoint[] | null;
    unaCorda: PedalPoint[] | null;
  };
  /** The score's sustain pedal marks where the run played, for the chart. */
  marks: { round: number; tick: number; type: 'start' | 'change' | 'stop' }[];
  /** The score marks the sustain pedal where the run played. */
  marked: boolean;
  judgements: PedalJudgement[];
  corde: CordaJudgement[];
  /** The share of the run's time (its first key to its last release) the sustain pedal was down. */
  down: number | null;
  bars: PedalBar[];
}

// --- Reconstruction ---------------------------------------------------------------------------------

/**
 * Rhythm mode's clock: ms from the take's time 0 (the span's start) of a performance tick at the
 * run's tempo, and a loop's length (its rounds repeat every `length` ms).
 */
export interface RunClock {
  ms: (tick: number) => number;
  length: number | null;
  /** The span's performance ticks, [from, to). */
  from: number;
  to: number;
}

export function runClock(
  score: Pick<Score, 'measures' | 'tempos'>,
  order: readonly PlayedMeasure[],
  loop: BarLoop | null,
  scale: number,
): RunClock | null {
  // The start bar moves where the first round begins, not the clock's zero.
  const span = playSpan(score, order, loop, 0);
  if (!span) return null;
  const exact = timeline(score, order, scale);
  const zero = exact(span.from);
  return {
    ms: (tick) => exact(tick) - zero,
    length: loop ? exact(span.to) - zero : null,
    from: span.from,
    to: span.to,
  };
}

/**
 * The take's times against the score: when the run was at a tick of a round (ms of the take), and
 * where in the score a moment of the take falls. Rhythm mode has its clock (the take's times are
 * raw, so the latency is added back); wait mode has only the steps as the run reached them (each
 * step's first key per round) and shares the time between two steps out by their ticks.
 */
export interface RunTimes {
  /** ms of the take; null outside what the run reached (wait mode). */
  at: (round: number, tick: number) => number | null;
  /** Where a moment falls: in wait mode on a step, between two, or held at the nearest. */
  place: (ms: number) => { round: number; tick: number } | null;
}

/** Each round's steps as the run reached them: the tick and the time of the step's first key. */
function waitAnchors(notes: readonly PlayedNote[]): Map<number, { tick: number; time: number }[]> {
  const first = new Map<string, { round: number; tick: number; time: number }>();
  for (const n of notes) {
    const id = `${n.round}:${n.step}`;
    const seen = first.get(id);
    if (!seen || n.on < seen.time) first.set(id, { round: n.round, tick: n.tick, time: n.on });
  }
  const anchors = new Map<number, { tick: number; time: number }[]>();
  for (const { round, tick, time } of first.values()) {
    const list = anchors.get(round) ?? [];
    list.push({ tick, time });
    anchors.set(round, list);
  }
  for (const list of anchors.values()) list.sort((a, b) => a.tick - b.tick);
  return anchors;
}

export function runTimes(
  notes: readonly PlayedNote[],
  clock: RunClock | null,
  latency = 0,
): RunTimes {
  if (clock) {
    const length = clock.length ?? null;
    const rounds = notes.reduce((max, n) => Math.max(max, n.round), 0);
    return {
      at: (round, tick) => latency + round * (length ?? 0) + clock.ms(tick),
      place: (ms) => {
        const t = ms - latency;
        const round = length ? Math.min(rounds, Math.max(0, Math.floor(t / length))) : 0;
        const local = t - round * (length ?? 0);
        // The clock rises with the tick: find the tick by halving.
        let lo = clock.from;
        let hi = clock.to;
        if (local <= clock.ms(lo)) return { round, tick: lo };
        if (local >= clock.ms(hi)) return { round, tick: hi };
        for (let k = 0; k < 40 && hi - lo > 0.5; k++) {
          const mid = (lo + hi) / 2;
          if (clock.ms(mid) <= local) lo = mid;
          else hi = mid;
        }
        return { round, tick: lo };
      },
    };
  }
  const anchors = waitAnchors(notes);
  const timeline = [...anchors]
    .flatMap(([round, list]) => list.map((a) => ({ round, ...a })))
    .sort((a, b) => a.time - b.time || a.round - b.round || a.tick - b.tick);
  return {
    at: (round, tick) => {
      const list = anchors.get(round) ?? [];
      for (let k = 0; k < list.length; k++) {
        const b = list[k]!;
        if (b.tick < tick) continue;
        if (b.tick === tick) return b.time;
        const a = list[k - 1];
        return a ? a.time + ((tick - a.tick) / (b.tick - a.tick)) * (b.time - a.time) : null;
      }
      return null;
    },
    place: (ms) => {
      if (timeline.length === 0) return null;
      const k = timeline.findLastIndex((a) => a.time <= ms);
      if (k < 0) return { round: timeline[0]!.round, tick: timeline[0]!.tick };
      const a = timeline[k]!;
      const b = timeline[k + 1];
      if (!b || b.round !== a.round || b.time <= a.time) return { round: a.round, tick: a.tick };
      return {
        round: a.round,
        tick: a.tick + ((ms - a.time) / (b.time - a.time)) * (b.tick - a.tick),
      };
    },
  };
}

/** The run's steps and the range of them it covered: first and last step index. */
export interface RunSteps {
  order: PlayedMeasure[];
  steps: Step[];
  first: number;
  last: number;
}

export function runSteps(
  score: Score,
  hands: HandSelection,
  repeats: RepeatMode,
  loop: BarLoop | null,
): RunSteps {
  const order = playOrder(score.measures, repeats);
  const steps = buildSteps(score, hands, order);
  let first = 0;
  let last = steps.length - 1;
  if (loop) {
    const resolved = resolveLoop(order, loop.from, loop.to);
    first = resolved ? steps.findIndex((s) => s.played >= resolved.first) : -1;
    last = resolved ? steps.findLastIndex((s) => s.played <= resolved.last) : -2;
    if (first < 0) first = 0;
  }
  return { order, steps, first, last };
}

/**
 * The keys of the take matched to the score's notes, each with its release and whether the
 * sustain pedal held it. A key struck again on its step before the step was complete (wait mode)
 * counts once, as the last stroke; wrong and extra notes are left out. Rounds of a loop: in wait
 * mode a step earlier than the one before starts a new round, in rhythm mode the round is the one
 * whose due time is nearest.
 */
export function playedNotes(
  score: Score,
  steps: readonly Step[],
  events: readonly TakeEvent[],
  clock: RunClock | null,
  latency = 0,
): PlayedNote[] {
  const byId = new Map(score.notes.map((n) => [n.id, n]));
  const out: (PlayedNote | null)[] = [];
  /** Index in `out` of the key's note while it is down; -1 for a key not matched. */
  const down = new Map<number, number>();
  const occurrence = new Map<string, number>();
  let sustain = 0;
  let round = 0;
  let lastStep = -1;

  const release = (key: number, time: number) => {
    const index = down.get(key);
    down.delete(key);
    const note = index === undefined || index < 0 ? null : out[index];
    if (note && note.off === null) {
      note.off = time;
      note.pedalled = sustain >= PEDAL_DOWN;
    }
  };

  for (const event of events) {
    const [time, kind, a, b, stepIndex] = event as number[];
    if (kind === 64) {
      sustain = a!;
      continue;
    }
    if (kind === TAKE_OFF) {
      release(a!, time!);
      continue;
    }
    if (kind !== TAKE_ON) continue;
    const key = a!;
    // A key struck again without a key up in between: the first stroke ended there.
    if (down.has(key)) release(key, time!);
    const step = stepIndex === undefined ? undefined : steps[stepIndex];
    const note = step?.noteIds.map((id) => byId.get(id)).find((n) => n?.midi === key);
    if (!step || !note || note.hand === null) {
      down.set(key, -1);
      continue;
    }
    if (clock) {
      const due = clock.ms(step.tick);
      round =
        clock.length && clock.length > 0
          ? Math.max(0, Math.round((time! - latency - due) / clock.length))
          : 0;
    } else {
      if (step.index < lastStep) round++;
      lastStep = step.index;
    }
    const id = `${round}:${step.index}:${key}`;
    const before = occurrence.get(id);
    if (before !== undefined) out[before] = null;
    occurrence.set(id, out.length);
    down.set(key, out.length);
    out.push({
      note,
      hand: note.hand,
      step: step.index,
      round,
      tick: step.tick,
      played: step.played,
      measure: step.measure,
      on: time!,
      off: null,
      velocity: b!,
      pedalled: false,
    });
  }
  return out
    .filter((n): n is PlayedNote => n !== null)
    .sort((x, y) => x.round - y.round || x.tick - y.tick || x.on - y.on);
}

/**
 * Whether the keys carried loudness: the computer keyboard and the on-screen piano send one fixed
 * velocity, and so does an instrument set to a fixed touch (as the Scales page decides it).
 */
export function velocityMeasured(events: readonly TakeEvent[]): boolean {
  let first: number | null = null;
  for (const e of events) {
    if (e[1] !== TAKE_ON) continue;
    if (first === null) first = e[3]!;
    else if (e[3] !== first) return true;
  }
  return false;
}

// --- Dynamics -------------------------------------------------------------------------------------

/** The loudness levels, soft to loud: their distance is the number of levels between them. */
const LEVELS: readonly Dynamic[] = [
  'pppppp',
  'ppppp',
  'pppp',
  'ppp',
  'pp',
  'p',
  'mp',
  'mf',
  'f',
  'ff',
  'fff',
  'ffff',
  'fffff',
  'ffffff',
];

/** The level a dynamic leaves in force: its own, or the soft one after a sudden accent (fp). */
const LEVEL_AFTER: Partial<Record<Dynamic, Dynamic>> = {
  fp: 'p',
  sfp: 'p',
  sfpp: 'pp',
  sfzp: 'p',
};

/** The dynamics that accent their note. */
const ACCENTING: ReadonlySet<Dynamic> = new Set<Dynamic>([
  'sf',
  'sfz',
  'sffz',
  'fz',
  'rf',
  'rfz',
  'fp',
  'sfp',
  'sfpp',
  'sfzp',
]);

export function levelOf(dynamic: Dynamic): number | null {
  const level = LEVEL_AFTER[dynamic] ?? dynamic;
  const index = LEVELS.indexOf(level);
  return index < 0 ? null : index;
}

const median = (values: readonly number[]) => quantile(values, 0.5);

/** The step size for a share of the range, at least `floor` velocity units. */
const stepOf = (range: Loudness | null, share: number, floor: number) =>
  Math.max(floor, share * (range ? range.high - range.low : 0));

function judgeChange(
  change: number,
  sign: number,
  needed: number,
  step: number,
  tooMuch: number | null,
): Verdict {
  const signed = change * sign;
  if (signed <= -WRONG_WAY_SHARE * step) return 'wrong-way';
  if (signed < needed) return 'too-little';
  if (tooMuch !== null && signed >= tooMuch) return 'too-much';
  return 'right';
}

interface Context {
  score: Score;
  order: readonly PlayedMeasure[];
  steps: readonly Step[];
  first: number;
  last: number;
  notes: readonly PlayedNote[];
  /** The ticks the run played through: from its first note's step to its last's. */
  from: number;
  to: number;
  practised: (hand: Hand | null) => boolean;
  byId: ReadonlyMap<string, ScoreNote>;
}

/** The hand's written notes on a step of the run. */
function handNotes(ctx: Context, step: Step, hand: Hand): ScoreNote[] {
  return step.noteIds.map((id) => ctx.byId.get(id)!).filter((n) => n.hand === hand);
}

/** The run's steps (within its range) from tick `from` to `to`, inclusive. */
function stepsBetween(ctx: Context, from: number, to: number): Step[] {
  const out: Step[] = [];
  for (let i = ctx.first; i <= ctx.last; i++) {
    const s = ctx.steps[i]!;
    if (s.tick >= from && s.tick <= to) out.push(s);
  }
  return out;
}

/** The beats of the bars played, round after round, from the first note's bar to the last's. */
function beatSlots(ctx: Context): BeatSlot[] {
  const { score, order, notes } = ctx;
  const slots: BeatSlot[] = [];
  const rounds = new Map<number, [number, number]>();
  for (const n of notes) {
    const span = rounds.get(n.round);
    if (!span) rounds.set(n.round, [n.played, n.played]);
    else rounds.set(n.round, [Math.min(span[0], n.played), Math.max(span[1], n.played)]);
  }
  for (const [round, [first, last]] of [...rounds].sort((a, b) => a[0] - b[0])) {
    for (let p = first; p <= last; p++) {
      const played = order[p]!;
      const measure = score.measures[played.measure]!;
      const { beat } = beatTicks(measure);
      const count = Math.max(1, Math.ceil(measure.duration / beat));
      for (let k = 0; k < count; k++) {
        const tick = played.start + k * beat;
        slots.push({
          round,
          played: p,
          measure: played.measure,
          beat: k,
          tick,
          length: Math.min(beat, played.start + measure.duration - tick),
        });
      }
    }
  }
  return slots;
}

/** The slot a note falls in, by round and tick; -1 when none. */
export function slotOf(slots: readonly BeatSlot[], round: number, tick: number): number {
  let lo = 0;
  let hi = slots.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = slots[mid]!;
    if (s.round < round || (s.round === round && s.tick <= tick)) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const s = found < 0 ? null : slots[found]!;
  return s && s.round === round && tick < s.tick + s.length ? found : -1;
}

function loudnessCurve(slots: readonly BeatSlot[], notes: readonly PlayedNote[]) {
  const buckets: Record<Hand, number[][]> = {
    right: slots.map(() => []),
    left: slots.map(() => []),
  };
  for (const n of notes) {
    const i = slotOf(slots, n.round, n.tick);
    if (i >= 0) buckets[n.hand][i]!.push(n.velocity);
  }
  return {
    right: buckets.right.map((v) => median(v)),
    left: buckets.left.map((v) => median(v)),
  };
}

function barLoudness(slots: readonly BeatSlot[], notes: readonly PlayedNote[]): BarLoudness[] {
  const out: BarLoudness[] = [];
  const velocities = new Map<string, Record<Hand, number[]>>();
  for (const slot of slots) {
    const id = `${slot.round}:${slot.played}`;
    if (velocities.has(id)) continue;
    velocities.set(id, { right: [], left: [] });
    out.push({
      round: slot.round,
      played: slot.played,
      measure: slot.measure,
      right: null,
      left: null,
    });
  }
  for (const n of notes) velocities.get(`${n.round}:${n.played}`)?.[n.hand].push(n.velocity);
  for (const bar of out) {
    const v = velocities.get(`${bar.round}:${bar.played}`)!;
    bar.right = median(v.right);
    bar.left = median(v.left);
  }
  return out;
}

/** The written bar of a performance tick. */
function measureAt(order: readonly PlayedMeasure[], score: Score, tick: number): number {
  let found = order[0]?.measure ?? 0;
  for (const p of order) {
    if (p.start > tick) break;
    found = p.measure;
    if (tick < p.start + score.measures[p.measure]!.duration) break;
  }
  return found;
}

/** The pass and the beat (1-based, in the time signature's unit, as a step's) of a tick. */
function placeOf(ctx: Context, tick: number): { pass: number; beat: number } {
  let place = { pass: 1, beat: 1 };
  for (const p of ctx.order) {
    if (p.start > tick) break;
    const m = ctx.score.measures[p.measure]!;
    place = { pass: p.pass, beat: 1 + ((tick - p.start) * m.beatType) / (4 * TICKS_PER_QUARTER) };
  }
  return place;
}

/** Written bars from `from` to `to`; just `to` when the play order went back between them. */
function barSpan(from: number, to: number): BarSpan {
  return from <= to ? { from, to } : { from: to, to };
}

/** The beat length at a performance tick, in ticks. */
function beatAt(order: readonly PlayedMeasure[], score: Score, tick: number): number {
  return beatTicks(score.measures[measureAt(order, score, tick)]!).beat;
}

/** Notes accented by an articulation or an accenting dynamic, by `round:step:hand`. */
interface Accent {
  mark: AccentJudgement['mark'];
  step: number;
  hand: Hand;
}

function accentsOf(ctx: Context): Accent[] {
  const { score, steps, first, last } = ctx;
  const out: Accent[] = [];
  const byTick = new Map<number, Step[]>();
  for (let i = first; i <= last; i++) {
    const s = steps[i]!;
    const list = byTick.get(s.tick) ?? [];
    list.push(s);
    byTick.set(s.tick, list);
  }
  const { byId } = ctx;
  for (let i = first; i <= last; i++) {
    const s = steps[i]!;
    for (const id of s.noteIds) {
      const note = byId.get(id)!;
      if (!ctx.practised(note.hand)) continue;
      const mark = note.articulations?.find((a) => a === 'accent' || a === 'strong-accent');
      if (mark && !out.some((a) => a.step === s.index && a.hand === note.hand))
        out.push({ mark, step: s.index, hand: note.hand! });
    }
  }
  const dynamics = performedMarks(
    score.markings.dynamics.filter((d) => ACCENTING.has(d.dynamic)),
    score.measures,
    ctx.order,
  );
  for (const { mark, at } of dynamics) {
    const own = score.hands[staffKey(mark.part, mark.staff)] ?? null;
    const candidates = (byTick.get(at) ?? []).flatMap((s) =>
      s.noteIds
        .map((id) => byId.get(id)!)
        .filter((n) => n.part === mark.part && ctx.practised(n.hand))
        .map((n) => ({ step: s.index, hand: n.hand! })),
    );
    // The staff's own hand, else the other hand of the part struck there.
    const pick = candidates.find((c) => c.hand === own) ?? candidates[0];
    if (pick && !out.some((a) => a.step === pick.step && a.hand === pick.hand))
      out.push({ mark: mark.dynamic, step: pick.step, hand: pick.hand });
  }
  return out;
}

/** Per round, step and hand: the loudest note struck (a chord's loudest, usually its melody). */
function stepPeaks(notes: readonly PlayedNote[]) {
  const peaks = new Map<string, number>();
  for (const n of notes) {
    const id = `${n.round}:${n.step}:${n.hand}`;
    peaks.set(id, Math.max(peaks.get(id) ?? 0, n.velocity));
  }
  return peaks;
}

function judgeAccents(
  ctx: Context,
  accents: readonly Accent[],
  range: Loudness | null,
  rounds: readonly number[],
): AccentJudgement[] {
  const needed = stepOf(range, ACCENT_STEP, ACCENT_STEP_MIN);
  const peaks = stepPeaks(ctx.notes);
  const accented = new Set(accents.map((a) => `${a.step}:${a.hand}`));
  const out: AccentJudgement[] = [];
  for (const accent of accents) {
    const step = ctx.steps[accent.step]!;
    if (step.tick < ctx.from || step.tick > ctx.to) continue;
    // The hand's steps around it, without other accents.
    const handSteps: number[] = [];
    for (let i = ctx.first; i <= ctx.last; i++) {
      if (i === accent.step || accented.has(`${i}:${accent.hand}`)) continue;
      if (handNotes(ctx, ctx.steps[i]!, accent.hand).length > 0) handSteps.push(i);
    }
    const before = handSteps.filter((i) => i < accent.step).slice(-ACCENT_NEIGHBOURS);
    const after = handSteps.filter((i) => i > accent.step).slice(0, ACCENT_NEIGHBOURS);
    const margins: number[] = [];
    let heard = false;
    for (const round of rounds) {
      const own = peaks.get(`${round}:${accent.step}:${accent.hand}`);
      if (own === undefined) continue;
      heard = true;
      const around = [...before, ...after]
        .map((i) => peaks.get(`${round}:${i}:${accent.hand}`))
        .filter((v): v is number => v !== undefined);
      if (around.length >= 2) margins.push(own - median(around)!);
    }
    if (heard && margins.length === 0) continue;
    const margin = median(margins);
    out.push({
      kind: 'accent',
      mark: accent.mark,
      hand: accent.hand,
      tick: step.tick,
      pass: step.pass,
      beat: step.beat,
      bars: { from: step.measure, to: step.measure },
      margin,
      needed,
      verdict:
        margin === null
          ? 'missed'
          : margin <= 0
            ? 'wrong-way'
            : margin < needed
              ? 'too-little'
              : 'right',
    });
  }
  return out;
}

/** Hairpins in the part's staves the run practised, once each (the same one on two staves once). */
function hairpinsOf(ctx: Context) {
  const { score } = ctx;
  const seen = new Set<string>();
  return performedSpans(score.markings.hairpins, score.measures, ctx.order).filter((h) => {
    const hand = score.hands[staffKey(h.mark.part, h.mark.staff)] ?? null;
    if (!ctx.practised(hand)) return false;
    const id = `${h.mark.part}:${hand}:${h.at}:${h.end}:${h.mark.kind}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function judgeHairpins(
  ctx: Context,
  hairpins: ReturnType<typeof hairpinsOf>,
  accents: readonly Accent[],
  step: number,
): HairpinJudgement[] {
  const { score } = ctx;
  // An accent (an sf where the hairpin arrives, say) stands out of the line on purpose.
  const accented = new Set(accents.map((a) => `${a.step}:${a.hand}`));
  const out: HairpinJudgement[] = [];
  for (const { mark, at, end } of hairpins) {
    const hand = score.hands[staffKey(mark.part, mark.staff)]!;
    if (end - at < MIN_HAIRPIN_BEATS * beatAt(ctx.order, score, at)) continue;
    // Its steps for that hand (the arrival included), all within what the run played, and enough
    // of them to fit a line.
    const written = stepsBetween(ctx, at, end).filter(
      (s) => handNotes(ctx, s, hand).length > 0 && !accented.has(`${s.index}:${hand}`),
    );
    if (written.length < MIN_HAIRPIN_STEPS) continue;
    if (written[0]!.tick < ctx.from || written.at(-1)!.tick > ctx.to) continue;
    const peaks = new Map<string, { tick: number; velocity: number }>();
    for (const n of ctx.notes) {
      if (n.hand !== hand || n.tick < at || n.tick > end) continue;
      if (accented.has(`${n.step}:${n.hand}`)) continue;
      const id = `${n.round}:${n.step}`;
      const p = peaks.get(id);
      if (!p || n.velocity > p.velocity) peaks.set(id, { tick: n.tick, velocity: n.velocity });
    }
    const points = [...peaks.values()];
    const sign = mark.kind === 'crescendo' ? 1 : -1;
    const fit =
      new Set(points.map((p) => p.tick)).size >= MIN_HAIRPIN_STEPS
        ? theilSen(
            points.map((p) => p.tick),
            points.map((p) => p.velocity),
          )
        : null;
    const change = fit ? fit.slope * (end - at) : null;
    out.push({
      kind: 'hairpin',
      hairpin: mark.kind,
      written: mark.written,
      hand,
      tick: at,
      ...placeOf(ctx, at),
      end,
      bars: barSpan(mark.measure, measureAt(ctx.order, score, Math.max(at, end - 1))),
      change,
      needed: step,
      verdict: change === null ? 'missed' : judgeChange(change, sign, step, step, null),
    });
  }
  return out;
}

function judgeLevels(
  ctx: Context,
  hairpins: ReturnType<typeof hairpinsOf>,
  accents: readonly Accent[],
  range: Loudness | null,
  step: number,
): LevelJudgement[] {
  const { score } = ctx;
  const parts = new Set(score.notes.filter((n) => ctx.practised(n.hand)).map((n) => n.part));
  // Levels in force, in the order played: one per tick, a repeated level not a change.
  const marks: { at: number; dynamic: Dynamic; level: number; measure: number }[] = [];
  for (const { mark, at } of performedMarks(score.markings.dynamics, score.measures, ctx.order)) {
    if (!parts.has(mark.part) || !isDynamic(mark.dynamic)) continue;
    const level = levelOf(mark.dynamic);
    if (level === null) continue;
    const previous = marks.at(-1);
    if (previous?.at === at) continue;
    if (previous?.level === level) continue;
    marks.push({ at, dynamic: mark.dynamic, level, measure: mark.measure });
  }
  const accented = new Set(accents.map((a) => `${a.step}:${a.hand}`));
  const outside = (n: PlayedNote) =>
    !accented.has(`${n.step}:${n.hand}`) &&
    !hairpins.some((h) => n.tick >= h.at && n.tick <= h.end);
  const out: LevelJudgement[] = [];
  const end = ctx.to + 1;
  // The levels marked in what was played: from the one in force at its start to its end.
  const inForce = marks.findLastIndex((m) => m.at <= ctx.from);
  const levelsMarked = marks
    .filter((m, k) => k === inForce || (m.at > ctx.from && m.at <= ctx.to))
    .map((m) => m.level);
  const span = Math.max(...levelsMarked) - Math.min(...levelsMarked);
  const width = range ? range.high - range.low : 0;
  for (let k = 1; k < marks.length; k++) {
    const a = marks[k - 1]!;
    const b = marks[k]!;
    const bEnd = marks[k + 1]?.at ?? Infinity;
    // Both passages within what the run played.
    const aFrom = Math.max(a.at, ctx.from);
    const bTo = Math.min(bEnd, end);
    if (aFrom >= b.at || bTo <= b.at) continue;
    const beats = (from: number, to: number) => (to - from) / beatAt(ctx.order, score, from);
    if (beats(aFrom, b.at) < MIN_PASSAGE_BEATS || beats(b.at, bTo) < MIN_PASSAGE_BEATS) continue;
    const before = ctx.notes.filter((n) => n.tick >= aFrom && n.tick < b.at && outside(n));
    const after = ctx.notes.filter((n) => n.tick >= b.at && n.tick < bTo && outside(n));
    // Passages written with too few notes to tell (a held chord) are not judged.
    const writtenIn = (from: number, to: number) =>
      stepsBetween(ctx, from, to - 1).flatMap((s) =>
        s.noteIds
          .map((id) => ctx.byId.get(id)!)
          .filter(
            (n) =>
              ctx.practised(n.hand) &&
              !accented.has(`${s.index}:${n.hand}`) &&
              !hairpins.some((h) => s.tick >= h.at && s.tick <= h.end),
          ),
      ).length;
    if (writtenIn(aFrom, b.at) < MIN_PASSAGE_NOTES || writtenIn(b.at, bTo) < MIN_PASSAGE_NOTES)
      continue;
    const levels = b.level - a.level;
    const needed = Math.abs(levels) * step;
    const share = Math.abs(levels) / span;
    const tooMuch = share < 1 ? Math.max(needed + step, (share + TOO_MUCH_SHARE) * width) : null;
    const heard = before.length >= MIN_PASSAGE_NOTES && after.length >= MIN_PASSAGE_NOTES;
    const change = heard
      ? median(after.map((n) => n.velocity))! - median(before.map((n) => n.velocity))!
      : null;
    out.push({
      kind: 'level',
      from: a.dynamic,
      to: b.dynamic,
      levels,
      tick: b.at,
      ...placeOf(ctx, b.at),
      // The change is heard across the mark: from the bar before a mark on a barline.
      bars: barSpan(measureAt(ctx.order, score, b.at - 1), b.measure),
      change,
      needed,
      verdict:
        change === null ? 'missed' : judgeChange(change, Math.sign(levels), needed, step, tooMuch),
    });
  }
  return out;
}

function balanceOf(ctx: Context, melody: Melody, step: number): DynamicsAnalysis['balance'] {
  const { notes } = ctx;
  const byTime = [...notes].sort((a, b) => a.on - b.on);
  const occurrences = new Map<string, PlayedNote[]>();
  for (const n of notes) {
    const id = `${n.round}:${n.step}`;
    const list = occurrences.get(id) ?? [];
    list.push(n);
    occurrences.set(id, list);
  }
  const perBar = new Map<number, number[]>();
  const margins: number[] = [];
  for (const group of occurrences.values()) {
    const candidates = melody === 'top' ? group : group.filter((n) => n.hand === melody);
    if (candidates.length === 0) continue;
    const top = candidates.reduce((a, b) => (b.note.midi > a.note.midi ? b : a));
    const others = byTime.filter((n) => n !== top && Math.abs(n.on - top.on) <= TOGETHER_MS);
    if (!others.some((n) => n.hand !== top.hand)) continue;
    const margin = top.velocity - median(others.map((n) => n.velocity))!;
    margins.push(margin);
    const list = perBar.get(top.measure) ?? [];
    list.push(margin);
    perBar.set(top.measure, list);
  }
  if (margins.length === 0) return null;
  const verdict = (m: number): BalanceVerdict =>
    m >= step ? 'balanced' : m <= -step ? 'under' : 'equal';
  return {
    groups: margins.length,
    balanced: margins.filter((m) => verdict(m) === 'balanced').length,
    margin: median(margins)!,
    bars: [...perBar]
      .sort((a, b) => a[0] - b[0])
      .map(([measure, list]) => {
        const margin = median(list)!;
        return { measure, groups: list.length, margin, verdict: verdict(margin) };
      }),
  };
}

// --- Articulation: the analysis ---------------------------------------------------------------------

/** A note's written length with the notes tied to it, in ticks. */
function tiedLength(note: ScoreNote, continuations: ReadonlyMap<string, ScoreNote>): number {
  let length = note.duration;
  let current = note;
  for (let guard = 0; current.tieStart && guard < 64; guard++) {
    const next = continuations.get(
      `${current.part}:${current.staff}:${current.midi}:${current.onset + current.duration}`,
    );
    if (!next) break;
    length += next.duration;
    current = next;
  }
  return length;
}

/** Each voice's struck notes (tied continuations left out), by part, staff and voice. */
function voicesOf(score: Score): Map<string, ScoreNote[]> {
  const out = new Map<string, ScoreNote[]>();
  for (const n of score.notes) {
    if (n.tieStop || n.hand === null) continue;
    const id = `${n.part}:${n.staff}:${n.voice}`;
    const list = out.get(id) ?? [];
    list.push(n);
    out.set(id, list);
  }
  return out;
}

/** The onset of the voice's next struck note after `onset`; null at the voice's end. */
function nextOnset(voice: readonly ScoreNote[], onset: number): number | null {
  let best: number | null = null;
  for (const n of voice) if (n.onset > onset && (best === null || n.onset < best)) best = n.onset;
  return best;
}

function judgeHeld(touch: Touch, share: number): ArticulationVerdict {
  switch (touch) {
    case 'staccato':
      return share <= STACCATO_MAX ? 'right' : 'long';
    case 'staccatissimo':
      return share <= STACCATISSIMO_MAX ? 'right' : 'long';
    case 'tenuto':
      return share >= TENUTO_MIN ? 'right' : 'short';
    default:
      return share < CUT_SHORT ? 'cut-short' : 'right';
  }
}

function analyzeArticulation(
  ctx: Context,
  clock: RunClock | null,
  slots: readonly BeatSlot[],
): ArticulationAnalysis {
  const { score, notes } = ctx;
  const continuations = new Map(
    score.notes
      .filter((n) => n.tieStop)
      .map((n) => [`${n.part}:${n.staff}:${n.midi}:${n.onset}`, n] as const),
  );
  const voices = voicesOf(score);
  const voiceOf = (n: ScoreNote) => voices.get(`${n.part}:${n.staff}:${n.voice}`) ?? [];

  // Slurs: the notes that join the next (to the slur's last onset), and the last ones.
  const slurredTo = new Map<string, number>();
  const slurEnd = new Set<string>();
  for (const slur of score.markings.slurs) {
    const from = ctx.byId.get(slur.from);
    const to = ctx.byId.get(slur.to);
    if (!from || !to || to.onset <= from.onset) continue;
    for (const n of voices.get(`${slur.part}:${slur.staff}:${slur.voice}`) ?? []) {
      if (n.onset >= from.onset && n.onset < to.onset)
        slurredTo.set(n.id, Math.max(slurredTo.get(n.id) ?? 0, to.onset));
      if (n.onset === to.onset) slurEnd.add(n.id);
    }
  }
  const fermatas = new Set(score.markings.fermatas.map((f) => `${f.part}:${f.staff}:${f.tick}`));

  const touchOf = (n: ScoreNote): Touch | null => {
    const arts = n.articulations ?? [];
    const short = arts.find((a) => a === 'staccato' || a === 'spiccato' || a === 'staccatissimo');
    // Portato (detached-legato, or tenuto and staccato together) is not judged.
    if (arts.includes('detached-legato') || (short && arts.includes('tenuto'))) return null;
    if (short) return short === 'staccatissimo' ? 'staccatissimo' : 'staccato';
    if (arts.includes('tenuto')) return 'tenuto';
    if (slurredTo.has(n.id)) return 'legato';
    // The last note of a slur may be shorter.
    if (slurEnd.has(n.id)) return null;
    return 'plain';
  };

  // Wait mode: when the run reached a tick (each step's first key, per round), to time lengths by.
  const reached = runTimes(notes, null).at;
  /** A written length in ms: at the run's tempo (rhythm mode), or as the run went (wait mode). */
  const writtenMs = (p: PlayedNote, length: number): number | null => {
    if (clock) return clock.ms(p.tick + length) - clock.ms(p.tick);
    const end = reached(p.round, p.tick + length);
    return end === null ? null : end - p.on;
  };

  const out: NoteArticulation[] = [];
  let pedalled = 0;
  const lastStep = ctx.last;
  for (const p of notes) {
    const touch = touchOf(p.note);
    if (touch === null || p.off === null) continue;
    const held = p.off - p.on;
    const length = tiedLength(p.note, continuations);
    const voice = voiceOf(p.note);
    const next = nextOnset(voice, p.note.onset);
    if (touch === 'legato') {
      // The next note of the slur's voice, played in the same round after this step. A key
      // struck again cannot be joined.
      if (next === null || next > slurredTo.get(p.note.id)!) continue;
      const nextStep = ctx.steps.find((s) => s.index > p.step && s.writtenTick === next);
      if (!nextStep) continue;
      const nextNotes = voice.filter((n) => n.onset === next);
      if (nextNotes.some((n) => n.midi === p.note.midi)) continue;
      const heard = notes.filter(
        (n) => n.round === p.round && n.step === nextStep.index && nextNotes.includes(n.note),
      );
      if (heard.length === 0) continue;
      if (p.pedalled) {
        pedalled++;
        continue;
      }
      const join = Math.min(...heard.map((n) => n.on)) - p.off;
      out.push({
        played: p,
        touch,
        held,
        written: null,
        join,
        verdict: join > LEGATO_GAP_MS ? 'broken' : -join > LEGATO_OVERLAP_MS ? 'smudged' : 'right',
      });
      continue;
    }
    // A plain note may breathe before a rest, under a fermata and at the end of the run.
    if (
      touch === 'plain' &&
      (next === null ||
        next > p.note.onset + length ||
        fermatas.has(`${p.note.part}:${p.note.staff}:${p.note.onset}`) ||
        p.step === lastStep)
    )
      continue;
    const written = writtenMs(p, length);
    if (written === null || written <= 0) continue;
    if (p.pedalled) {
      pedalled++;
      continue;
    }
    out.push({
      played: p,
      touch,
      held,
      written,
      join: null,
      verdict: judgeHeld(touch, held / written),
    });
  }

  // Per bar played.
  const bars: ArticulationBar[] = [];
  const barOf = new Map<string, ArticulationBar>();
  for (const slot of slots) {
    const id = `${slot.round}:${slot.played}`;
    if (barOf.has(id)) continue;
    const bar: ArticulationBar = {
      round: slot.round,
      played: slot.played,
      measure: slot.measure,
      judged: 0,
      right: 0,
      problems: { broken: 0, smudged: 0, long: 0, short: 0, 'cut-short': 0 },
    };
    barOf.set(id, bar);
    bars.push(bar);
  }
  for (const a of out) {
    const bar = barOf.get(`${a.played.round}:${a.played.played}`);
    if (!bar) continue;
    bar.judged++;
    if (a.verdict === 'right') bar.right++;
    else bar.problems[a.verdict]++;
  }

  // What the chart draws above the bars: the slurs, and the notes marked short or held.
  const played = new Set(notes.map((n) => n.step));
  const marks: ArticulationMarks = { slurs: [], short: [], held: [] };
  for (let i = ctx.first; i <= ctx.last; i++) {
    if (!played.has(i)) continue;
    const s = ctx.steps[i]!;
    const touches = s.noteIds
      .map((id) => ctx.byId.get(id)!)
      .filter((n) => ctx.practised(n.hand))
      .map(touchOf);
    if (touches.some((t) => t === 'staccato' || t === 'staccatissimo'))
      marks.short.push({ tick: s.tick });
    if (touches.includes('tenuto')) marks.held.push({ tick: s.tick });
    for (const slur of score.markings.slurs) {
      if (!s.noteIds.includes(slur.from)) continue;
      const from = ctx.byId.get(slur.from)!;
      const to = ctx.byId.get(slur.to);
      if (to && to.onset > from.onset)
        marks.slurs.push({ tick: s.tick, end: s.tick + to.onset - from.onset });
    }
  }

  return {
    notes: out,
    pedalled,
    judged: out.length,
    right: out.filter((a) => a.verdict === 'right').length,
    bars,
    marks,
  };
}

/** What went wrong in a bar: how many notes of a touch were played how. */
export interface ArticulationSlip {
  touch: Touch;
  verdict: ArticulationProblem;
  count: number;
}

/** The articulation's three bars to look at: the most notes not played as written. */
export function articulationToLookAt(a: ArticulationAnalysis): LookAt<ArticulationSlip>[] {
  const slips = new Map<string, ArticulationSlip & { measure: number }>();
  for (const n of a.notes) {
    if (n.verdict === 'right') continue;
    const id = `${n.played.measure}:${n.touch}:${n.verdict}`;
    const slip = slips.get(id) ?? {
      measure: n.played.measure,
      touch: n.touch,
      verdict: n.verdict,
      count: 0,
    };
    slip.count++;
    slips.set(id, slip);
  }
  return worstPlaces(
    [...slips.values()]
      .sort((x, y) => x.measure - y.measure)
      .map(({ measure, ...slip }) => ({
        bars: { from: measure, to: measure },
        weight: slip.count,
        problem: slip,
      })),
  );
}

// --- Pedal: the analysis --------------------------------------------------------------------------

/** A pedal going down (to `PEDAL_DOWN` or over) or up, in the order of the take. */
interface Transition {
  time: number;
  down: boolean;
}

/** The raw positions of one pedal in the take. */
function pedalValues(events: readonly TakeEvent[], controller: TakePedal) {
  return events.filter((e) => e[1] === controller).map((e) => ({ time: e[0]!, value: e[2]! }));
}

/** Where the pedal changed from up to down and back; it starts up. */
function transitionsOf(values: readonly { time: number; value: number }[]): Transition[] {
  const out: Transition[] = [];
  let down = false;
  for (const { time, value } of values) {
    if (value >= PEDAL_DOWN === down) continue;
    down = !down;
    out.push({ time, down });
  }
  return out;
}

function isDownAt(tr: readonly Transition[], time: number): boolean {
  return tr.findLast((x) => x.time <= time)?.down ?? false;
}

/** How long the pedal was down between two moments, ms. */
function downTime(tr: readonly Transition[], from: number, to: number): number {
  let total = 0;
  let down = isDownAt(tr, from);
  let since = from;
  for (const x of tr) {
    if (x.time <= from) continue;
    if (x.time >= to) break;
    if (down) total += x.time - since;
    down = x.down;
    since = x.time;
  }
  return total + (down ? to - since : 0);
}

/** Where some key was down: every stroke of the take, merged, in order. */
function soundingOf(events: readonly TakeEvent[], end: number): [number, number][] {
  const strokes: [number, number][] = [];
  const down = new Map<number, number>();
  for (const e of events) {
    const [time, kind, key] = e as number[];
    if (kind === TAKE_ON) {
      const on = down.get(key!);
      if (on !== undefined) strokes.push([on, time!]);
      down.set(key!, time!);
    } else if (kind === TAKE_OFF) {
      const on = down.get(key!);
      if (on !== undefined) strokes.push([on, time!]);
      down.delete(key!);
    }
  }
  for (const on of down.values()) strokes.push([on, end]);
  strokes.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [on, off] of strokes) {
    const last = merged.at(-1);
    if (last && on <= last[1]) last[1] = Math.max(last[1], off);
    else merged.push([on, off]);
  }
  return merged;
}

/** The longest stretch from `from` to `to` in which no key was down, ms. */
function silence(sounding: readonly [number, number][], from: number, to: number): number {
  let longest = 0;
  let at = from;
  for (const [on, off] of sounding) {
    if (off <= at) continue;
    if (on >= to) break;
    longest = Math.max(longest, on - at);
    at = Math.max(at, off);
    if (at >= to) return longest;
  }
  return Math.max(longest, to - at);
}

/** A sustain mark where the run struck its note: `n`, the note's first key (ms of the take). */
interface StruckMark {
  type: 'start' | 'change' | 'stop';
  round: number;
  tick: number;
  n: number;
}

type RawPedalJudgement = Pick<PedalJudgement, 'mark' | 'verdict' | 'ms' | 'round' | 'tick'>;

/**
 * The sustain pedal against its marks, in the order they were struck (docs/EXPRESSION.md, "Pedal"):
 * down through a marked span; at a change up after the new note, within `CHANGE_MAX_MS`, and down
 * again within `RELEASE_MAX_MS`; up at a stop within `CHANGE_MAX_MS` of its note. Lifted before a
 * note, the pedal leaves a gap unless a key sounded all along; up too late, or not at all before the
 * next mark (or the end of the take), the old harmony blurs into the new.
 */
export function judgeSustain(
  marks: readonly StruckMark[],
  tr: readonly Transition[],
  sounding: readonly [number, number][],
  end: number,
  place: (ms: number) => { round: number; tick: number } | null,
): RawPedalJudgement[] {
  const out: RawPedalJudgement[] = [];
  const first = (down: boolean, from: number, to: number) =>
    tr.find((x) => x.down === down && x.time > from && x.time < to)?.time ?? null;
  /** After `from` the pedal goes down again within `RELEASE_MAX_MS`: clean, a gap, or missed. */
  const caught = (from: number, to: number) => {
    const d = first(true, from, to);
    if (d === null) return { verdict: 'missed' as const, ms: null, down: null };
    const gap = d - from > RELEASE_MAX_MS ? silence(sounding, from, d) : 0;
    return gap > PEDAL_GAP_MS
      ? { verdict: 'gap' as const, ms: gap, down: d }
      : { verdict: 'clean' as const, ms: null, down: d };
  };
  let since = -Infinity;
  let inSpan = false;
  marks.forEach((mark, i) => {
    const { n } = mark;
    const next = marks.slice(i + 1).find((m) => m.n > n)?.n ?? Math.max(end, n);
    // Inside a marked span, every lift before this note: pressed again before it, a gap where the
    // sound broke; still up at the note, the lift of this mark.
    let early: number | null = null;
    if (inSpan) {
      for (const up of tr) {
        if (up.down || up.time <= since || up.time > n) continue;
        const again = tr.find((x) => x.down && x.time > up.time && x.time <= n);
        if (!again) {
          early = up.time;
          continue;
        }
        const gap = silence(sounding, up.time, again.time);
        const at = place(up.time);
        if (gap > PEDAL_GAP_MS && at)
          out.push({ mark: 'lift', verdict: 'gap', ms: gap, round: at.round, tick: at.tick });
      }
    }
    const down = isDownAt(tr, n);
    const judged = (verdict: PedalVerdict, ms: number | null = null) =>
      out.push({ mark: mark.type, verdict, ms, round: mark.round, tick: mark.tick });
    if (mark.type === 'stop') {
      if (early !== null) {
        const gap = silence(sounding, early, n);
        judged(gap > PEDAL_GAP_MS ? 'gap' : 'clean', gap > PEDAL_GAP_MS ? gap : null);
      } else if (down) {
        const up = first(false, n, next);
        if (up === null) judged('blur', next - n);
        else if (up - n > CHANGE_MAX_MS) judged('blur', up - n);
        else judged('clean');
      }
      // Not down since the span began: its start was missed, and the stop has nothing to lift.
      since = n;
      inSpan = false;
      return;
    }
    let from = n;
    if (mark.type === 'change' && early !== null) {
      const gap = silence(sounding, early, n);
      if (gap > PEDAL_GAP_MS) {
        judged('gap', gap);
        since = first(true, n, next) ?? n;
        inSpan = true;
        return;
      }
      // The hand held the notes over: the lift counts from the note.
    } else if (mark.type === 'change' && down) {
      const up = first(false, n, next);
      if (up === null || up - n > CHANGE_MAX_MS) {
        judged('blur', (up ?? next) - n);
        since = up === null ? next : (first(true, up, next) ?? up);
        inSpan = true;
        return;
      }
      from = up;
    } else if (down) {
      // A start with the pedal already down.
      judged('clean');
      since = n;
      inSpan = true;
      return;
    }
    const c = caught(from, next);
    judged(c.verdict, c.ms);
    since = c.down ?? from;
    inSpan = true;
  });
  return out;
}

function analyzePedal(
  ctx: Context,
  events: readonly TakeEvent[],
  notes: readonly PlayedNote[],
  slots: readonly BeatSlot[],
  times: RunTimes,
): PedalAnalysis {
  const { score, order, steps } = ctx;
  const values = pedalValues(events, 64);
  const tr = transitionsOf(values);
  const used = values.length > 0;
  const ends = events.map((e) => e[0]!);
  const end = ends.length > 0 ? Math.max(...ends) : 0;
  const parts = new Set(score.notes.filter((n) => ctx.practised(n.hand)).map((n) => n.part));

  // Each round: its notes, its first key and its last release.
  const byRound = new Map<number, PlayedNote[]>();
  for (const n of notes) {
    const list = byRound.get(n.round) ?? [];
    list.push(n);
    byRound.set(n.round, list);
  }
  /** The first key of the step at or after `tick` in the round, not after `until`. */
  const struck = (round: number, tick: number, until: number): number | null => {
    let step: Step | null = null;
    for (let i = ctx.first; i <= ctx.last; i++) {
      const s = steps[i]!;
      if (s.tick >= tick) {
        step = s.tick <= until ? s : null;
        break;
      }
    }
    if (!step) return null;
    const on = (byRound.get(round) ?? []).filter((n) => n.step === step.index).map((n) => n.on);
    return on.length > 0 ? Math.min(...on) : null;
  };
  const inSlots = (round: number, tick: number) => slotOf(slots, round, tick) >= 0;
  const rounds = [...byRound.keys()].sort((a, b) => a - b);
  const performed = (pedal: PedalMark['pedal']) =>
    performedMarks(
      score.markings.pedals.filter(
        (p) => p.pedal === pedal && p.type !== 'continue' && parts.has(p.part),
      ),
      score.measures,
      order,
    );

  // The sustain marks where the run played, and those whose note was struck.
  const sustain = performed('sustain');
  const marks: PedalAnalysis['marks'] = [];
  const struckMarks: StruckMark[] = [];
  for (const round of rounds) {
    sustain.forEach(({ mark, at }, k) => {
      if (!inSlots(round, at)) return;
      const type = mark.type as StruckMark['type'];
      marks.push({ round, tick: at, type });
      const n = struck(round, at, sustain[k + 1]?.at ?? Infinity);
      if (n !== null) struckMarks.push({ type, round, tick: at, n });
    });
  }
  struckMarks.sort((a, b) => a.n - b.n || a.round - b.round || a.tick - b.tick);
  // A stop and a start struck on the same note are a change there.
  const merged: StruckMark[] = [];
  for (const m of struckMarks) {
    const last = merged.at(-1);
    if (last && last.type === 'stop' && m.type === 'start' && last.n === m.n) {
      merged[merged.length - 1] = { ...m, type: 'change' };
    } else {
      merged.push(m);
    }
  }
  const sounding = soundingOf(events, end);
  const where = (tick: number) => {
    const measure = measureAt(order, score, tick);
    return { measure, ...placeOf(ctx, tick), bars: { from: measure, to: measure } };
  };
  // A lift is placed between two steps by the time: to the nearest sixteenth, to be named.
  const sixteenth = TICKS_PER_QUARTER / 4;
  const judgements: PedalJudgement[] = used
    ? judgeSustain(merged, tr, sounding, end, times.place).map((j) => {
        const tick = j.mark === 'lift' ? Math.round(j.tick / sixteenth) * sixteenth : j.tick;
        return { ...j, tick, ...where(tick) };
      })
    : [];
  judgements.sort((a, b) => a.round - b.round || a.tick - b.tick);

  // Una corda and sostenuto, against their words, when the take has them.
  const corde: CordaJudgement[] = [];
  for (const [pedal, controller] of [
    ['una-corda', 67],
    ['sostenuto', 66],
  ] as const) {
    const own = pedalValues(events, controller);
    if (own.length === 0) continue;
    const ctr = transitionsOf(own);
    const list = performed(pedal);
    for (const round of rounds) {
      const last = byRound.get(round)!;
      const roundEnd = Math.max(...last.map((n) => n.off ?? n.on));
      list.forEach(({ mark, at }, k) => {
        if (mark.type !== 'start' || !inSlots(round, at)) return;
        const stop = list.slice(k + 1).find((s) => s.mark.type === 'stop');
        const from = struck(round, at, stop?.at ?? Infinity);
        if (from === null) return;
        const to = (stop && struck(round, stop.at, Infinity)) ?? roundEnd;
        if (to <= from) return;
        const share = downTime(ctr, from, to) / (to - from);
        corde.push({
          pedal,
          verdict: share >= CORDA_HELD ? 'held' : share > 0 ? 'partly' : 'missed',
          share,
          round,
          tick: at,
          ...where(at),
        });
      });
    }
  }

  // The lines, from the run's first key, placed in the score.
  const first = notes.length > 0 ? Math.min(...notes.map((n) => n.on)) : 0;
  const lineOf = (own: readonly { time: number; value: number }[]): PedalPoint[] => {
    const start = slots[0];
    if (!start) return [];
    const points: PedalPoint[] = [
      {
        round: start.round,
        tick: start.tick,
        value: own.findLast((v) => v.time <= first)?.value ?? 0,
      },
    ];
    for (const { time, value } of own) {
      if (time <= first) continue;
      const at = times.place(time);
      if (at) points.push({ ...at, value });
    }
    return points;
  };
  const unaCorda = pedalValues(events, 67);
  const sostenuto = pedalValues(events, 66);

  // Per bar played: the share of its time the pedal was down, and its marks.
  const ranges = new Map<string, BeatSlot & { to: number }>();
  for (const slot of slots) {
    const id = `${slot.round}:${slot.played}`;
    const range = ranges.get(id);
    if (range) range.to = slot.tick + slot.length;
    else ranges.set(id, { ...slot, to: slot.tick + slot.length });
  }
  const bars = [...ranges.values()].map(({ round, played, measure, tick, to }): PedalBar => {
    const list = byRound.get(round) ?? [];
    // Wait mode knows the times between the round's steps; before them only from the round's first
    // key, after them as far as its last release.
    const a =
      times.at(round, tick) ?? (list.length > 0 ? Math.min(...list.map((n) => n.on)) : null);
    const b =
      times.at(round, to) ?? (list.length > 0 ? Math.max(...list.map((n) => n.off ?? n.on)) : null);
    return {
      round,
      played,
      measure,
      down: used && a !== null && b !== null && b > a ? downTime(tr, a, b) / (b - a) : null,
      judged: 0,
      clean: 0,
      problems: { gap: 0, blur: 0, missed: 0 },
    };
  });
  const barIndex = new Map(bars.map((b) => [`${b.round}:${b.played}`, b]));
  for (const j of judgements) {
    const slot = slots[slotOf(slots, j.round, j.tick)];
    const bar = slot && barIndex.get(`${slot.round}:${slot.played}`);
    if (!bar) continue;
    bar.judged++;
    if (j.verdict === 'clean') bar.clean++;
    else bar.problems[j.verdict]++;
  }

  const lastOff = notes.length > 0 ? Math.max(...notes.map((n) => n.off ?? n.on)) : first;
  return {
    used,
    lines: {
      sustain: used ? lineOf(values) : [],
      sostenuto: sostenuto.length > 0 ? lineOf(sostenuto) : null,
      unaCorda: unaCorda.length > 0 ? lineOf(unaCorda) : null,
    },
    marks,
    marked: marks.length > 0,
    judgements,
    corde,
    down: used && lastOff > first ? downTime(tr, first, lastOff) / (lastOff - first) : null,
    bars,
  };
}

/** How much a pedal mark played wrong weighs among the bars to look at. */
const PEDAL_SEVERITY: Record<PedalVerdict, number> = { gap: 2, blur: 2, missed: 2, clean: 0 };
const CORDA_SEVERITY: Record<CordaVerdict, number> = { missed: 2, partly: 1, held: 0 };

export type PedalProblem =
  { kind: 'sustain'; judgement: PedalJudgement } | { kind: 'corda'; judgement: CordaJudgement };

/** The pedal's three bars to look at: the marks not played cleanly. */
export function pedalToLookAt(p: PedalAnalysis): LookAt<PedalProblem>[] {
  return worstPlaces<PedalProblem>(
    [
      ...p.judgements.map((judgement) => ({
        bars: judgement.bars,
        weight: PEDAL_SEVERITY[judgement.verdict],
        problem: { kind: 'sustain' as const, judgement },
        tick: judgement.tick,
      })),
      ...p.corde.map((judgement) => ({
        bars: judgement.bars,
        weight: CORDA_SEVERITY[judgement.verdict],
        problem: { kind: 'corda' as const, judgement },
        tick: judgement.tick,
      })),
    ].sort((a, b) => a.tick - b.tick),
  );
}

// --- The analysis ---------------------------------------------------------------------------------

export function analyzeExpression(input: ExpressionInput): ExpressionAnalysis {
  const { score, hands, repeats, loop, mode, events } = input;
  const { order, steps, first, last } = runSteps(score, hands, repeats, loop);
  const clock = mode === 'rhythm' ? runClock(score, order, loop, input.scale ?? 1) : null;
  const notes = playedNotes(score, steps, events, clock, input.latency ?? 0);
  const rounds = [...new Set(notes.map((n) => n.round))].sort((a, b) => a - b);
  const measured = velocityMeasured(events);
  const velocities = notes.map((n) => n.velocity);
  const range =
    measured && velocities.length > 0
      ? { low: quantile(velocities, RANGE_LOW)!, high: quantile(velocities, RANGE_HIGH)! }
      : null;
  const ticks = notes.map((n) => n.tick);
  const ctx: Context = {
    score,
    order,
    steps,
    first,
    last,
    notes,
    from: ticks.length > 0 ? Math.min(...ticks) : 0,
    to: ticks.length > 0 ? Math.max(...ticks) : -1,
    practised: (hand) => inHands(hand, hands),
    byId: new Map(score.notes.map((n) => [n.id, n])),
  };
  const slots = beatSlots(ctx);
  const step = stepOf(range, DYNAMIC_STEP, DYNAMIC_STEP_MIN);
  const accents = accentsOf(ctx);
  const hairpins = hairpinsOf(ctx);
  const parts = new Set(score.notes.filter((n) => ctx.practised(n.hand)).map((n) => n.part));
  const seenDynamics = new Set<number>();
  const marks: DynamicsMarks = {
    dynamics: performedMarks(score.markings.dynamics, score.measures, order)
      .filter(({ mark, at }) => {
        if (!parts.has(mark.part) || seenDynamics.has(at)) return false;
        seenDynamics.add(at);
        return true;
      })
      .map(({ mark, at }) => ({ tick: at, dynamic: mark.dynamic })),
    hairpins: hairpins.map((h) => ({
      tick: h.at,
      end: h.end,
      kind: h.mark.kind,
      written: h.mark.written,
    })),
    accents: [...new Set(accents.map((a) => steps[a.step]!.tick))].map((tick) => ({ tick })),
  };
  // Marked where the run played: a level in force there, or a mark within it; and whether any of
  // it asks for a change (another level, a hairpin, an accent).
  const levels = marks.dynamics.flatMap((d) => {
    const level = levelOf(d.dynamic);
    return level === null ? [] : [{ tick: d.tick, level }];
  });
  const inForce = levels.findLastIndex((l) => l.tick <= ctx.from);
  const levelsHere = new Set(
    levels
      .filter((l, k) => k === inForce || (l.tick > ctx.from && l.tick <= ctx.to))
      .map((l) => l.level),
  );
  const changes =
    levelsHere.size > 1 ||
    marks.hairpins.some((h) => h.end >= ctx.from && h.tick <= ctx.to) ||
    marks.accents.some((a) => a.tick >= ctx.from && a.tick <= ctx.to);
  const marked = changes || marks.dynamics.some((d) => d.tick <= ctx.to);
  const judgements: DynamicsJudgement[] = range
    ? [
        ...judgeLevels(ctx, hairpins, accents, range, step),
        ...judgeHairpins(ctx, hairpins, accents, step),
        ...judgeAccents(ctx, accents, range, rounds),
      ].sort((a, b) => a.tick - b.tick)
    : [];
  const balanceStep = stepOf(range, BALANCE_STEP, BALANCE_STEP_MIN);
  return {
    version: ANALYSIS_VERSION,
    mode,
    notes,
    rounds: Math.max(1, rounds.length),
    slots,
    articulation: analyzeArticulation(ctx, clock, slots),
    pedal: analyzePedal(ctx, events, notes, slots, runTimes(notes, clock, input.latency ?? 0)),
    dynamics: {
      velocityMeasured: measured,
      range,
      step,
      accentStep: stepOf(range, ACCENT_STEP, ACCENT_STEP_MIN),
      balanceStep,
      curve: range ? loudnessCurve(slots, notes) : { right: [], left: [] },
      bars: range ? barLoudness(slots, notes) : [],
      marked,
      changes,
      marks,
      judgements,
      balance: range ? balanceOf(ctx, input.melody ?? 'right', balanceStep) : null,
    },
  };
}

// --- Bars to look at ---------------------------------------------------------------------------

/** How much a verdict weighs when ranking the bars to look at. */
const SEVERITY: Record<Verdict, number> = {
  'wrong-way': 3,
  missed: 2,
  'too-little': 2,
  'too-much': 2,
  right: 0,
};
/** A bar where the accompaniment covers the melody, or matches it. */
const BALANCE_SEVERITY: Record<BalanceVerdict, number> = { under: 2, equal: 1, balanced: 0 };

/** Where a run lost its expression: the bars (or a marking's span) and what went wrong there. */
export interface LookAt<T> {
  bars: BarSpan;
  /** What went wrong there, in the order of the score. */
  problems: T[];
  weight: number;
}

export type DynamicsProblem =
  { kind: 'marking'; judgement: DynamicsJudgement } | { kind: 'balance'; bar: BalanceBar };

/** The worst `n` places, heaviest first, then in the order of the score. */
export function worstPlaces<T>(
  items: readonly { bars: BarSpan; weight: number; problem: T }[],
  n = 3,
): LookAt<T>[] {
  const places = new Map<string, LookAt<T> & { order: number }>();
  items.forEach(({ bars, weight, problem }, order) => {
    if (weight <= 0) return;
    const id = `${bars.from}-${bars.to}`;
    const place = places.get(id) ?? { bars, problems: [], weight: 0, order };
    place.problems.push(problem);
    place.weight += weight;
    places.set(id, place);
  });
  return [...places.values()]
    .sort((a, b) => b.weight - a.weight || a.bars.from - b.bars.from || a.order - b.order)
    .slice(0, n)
    .map(({ bars, problems, weight }) => ({ bars, problems, weight }));
}

/** The dynamics' three bars to look at: markings not played as written, then the balance. */
export function dynamicsToLookAt(d: DynamicsAnalysis): LookAt<DynamicsProblem>[] {
  return worstPlaces<DynamicsProblem>([
    ...d.judgements.map((judgement) => ({
      bars: judgement.bars,
      weight: SEVERITY[judgement.verdict],
      problem: { kind: 'marking' as const, judgement },
    })),
    ...(d.balance?.bars ?? []).map((bar) => ({
      bars: { from: bar.measure, to: bar.measure },
      weight: BALANCE_SEVERITY[bar.verdict],
      problem: { kind: 'balance' as const, bar },
    })),
  ]);
}
