// How a run of a piece was played beyond its notes and timing (docs/EXPRESSION.md): its loudness
// and balance against the score's dynamics (X1). Everything is recomputed from the run's take
// (takes.ts) and the score, and every loudness threshold is a share of the run's own range of
// velocities, since velocity curves differ between instruments. The fractions are provisional
// until runs recorded on real instruments set them (the Pieces page's development-only "Save this
// run" button exports a run for that).

import { isDynamic, performedMarks, performedSpans, type Dynamic } from './markings.ts';
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
import { TAKE_OFF, TAKE_ON, type TakeEvent } from './takes.ts';
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
  slots: BeatSlot[];
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
  notes: PlayedNote[];
  /** Rounds of a loop that were played (1 without a loop). */
  rounds: number;
  dynamics: DynamicsAnalysis;
}

// --- Reconstruction ---------------------------------------------------------------------------------

/**
 * Rhythm mode's clock: ms from the take's time 0 (the span's start) of a performance tick at the
 * run's tempo, and a loop's length (its rounds repeat every `length` ms).
 */
export interface RunClock {
  ms: (tick: number) => number;
  length: number | null;
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
    notes,
    rounds: Math.max(1, rounds.length),
    dynamics: {
      velocityMeasured: measured,
      range,
      step,
      accentStep: stepOf(range, ACCENT_STEP, ACCENT_STEP_MIN),
      balanceStep,
      slots,
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
