// Playing a run back (docs/PIECES.md, "Play back your run"): its take as a plan for the demo
// player, the keys with their own velocities and releases and the pedals as they moved, the cursor
// on the steps as the run reached them, a wrong key where it fell. And **Compare**: the written
// version (the demo at the run's tempo), then the run, bar by bar or all of it at once.

import { playedNotes, runClock, runSteps, runTimes, type PlayedNote } from './expression.ts';
import { hasKey, type KeyRange } from './instrument.ts';
import type { TrillStart } from './ornaments.ts';
import {
  accompanied,
  accompanimentPlan,
  beyondKeyboard,
  DEMO_VELOCITY,
  demoPlan,
  playSpan,
  timeline,
  type DemoControl,
  type DemoNote,
  type DemoPlan,
} from './playback.ts';
import type { PlayedMeasure, RepeatMode } from './repeats.ts';
import type { HandSelection, Score, Step } from './score.ts';
import { TAKE_OFF, TAKE_ON, TAKE_PEDALS, type TakeEvent } from './takes.ts';
import type { BarLoop } from './wait.ts';

/** The last release rings this long before playing back stops (and silences the instrument). */
export const PLAYBACK_TAIL_MS = 1200;
/** A key the take never let go of sounds until its end, but at least this long. */
export const UNRELEASED_MS = 400;
/** Between the written bar and the run's, and between one bar and the next, in Compare. */
export const COMPARE_GAP_MS = 700;
/** A wrong key is shown at least this long, even when it was let go sooner. */
export const WRONG_SHOWN_MS = 400;

/** A run, as its session and take give it. */
export interface PlaybackRun {
  score: Score;
  hands: HandSelection;
  repeats: RepeatMode;
  loop: BarLoop | null;
  mode: 'wait' | 'rhythm';
  /** Percent of the score's tempo marks. */
  tempo: number;
  /** Rhythm mode: the latency taken off every key (the take's times are raw). */
  latency: number;
  events: readonly TakeEvent[];
  /** Where trills start in the written version (the piece's setting). */
  trillStart?: TrillStart;
  /**
   * The keyboard the run was played on, when it had fewer keys (docs/PERSONAL.md, "The
   * instrument's keys"): the notes beyond it, which the app played for the player, are played
   * again with the run, at `givenVelocity` (the demo's when absent).
   */
  keys?: KeyRange | null;
  givenVelocity?: number;
}

/** A key as it sounds in the plan. */
export interface PlaybackKey {
  midi: number;
  on: number;
  off: number;
  /** The step it was matched to (an index into `steps`); null for a wrong key or the written version's. */
  step: number | null;
  /** A wrong or extra key of the run, to show where it fell. */
  wrong: boolean;
}

/** What is playing from `at` on: the run, or (in Compare) the score as written. */
export interface PlaybackPart {
  at: number;
  kind: 'run' | 'written';
  /** Written measure index of the bar (bar by bar), or null for all of it at once. */
  measure: number | null;
  pass: number;
}

export interface TakePlayback {
  plan: DemoPlan;
  /** The run's steps, for its hands and repeats: `plan.steps` index them. */
  steps: Step[];
  keys: PlaybackKey[];
  /** Sorted by time; empty when playing the run alone. */
  parts: PlaybackPart[];
  /** Where each written bar is first reached, in the order played: "from bar" starts there. */
  bars: { measure: number; at: number }[];
}

interface Anchor {
  round: number;
  step: number;
  at: number;
}

interface Reading {
  order: PlayedMeasure[];
  steps: Step[];
  notes: PlayedNote[];
  /** Key downs and ups in the take's ms, paired. */
  strokes: { midi: number; on: number; off: number; step: number; velocity: number }[];
  /** Each (round, step) the run reached, at its first key, in time order. */
  anchors: Anchor[];
  /**
   * Where the cursor is from when: on each step from its first key; in wait mode a wrong key moves
   * it on to the step the run was waiting for, where the wrong key fell.
   */
  cursor: Anchor[];
  /** The last event of the take. */
  end: number;
  clock: ReturnType<typeof runClock>;
}

const isPedal = (kind: number) => (TAKE_PEDALS as readonly number[]).includes(kind);

function read(run: PlaybackRun): Reading | null {
  const { score, events } = run;
  const { order, steps } = runSteps(score, run.hands, run.repeats, run.loop, run.keys);
  const clock = run.mode === 'rhythm' ? runClock(score, order, run.loop, run.tempo / 100) : null;
  const notes = playedNotes(score, steps, events, clock, run.latency);
  const strokes: Reading['strokes'] = [];
  const down = new Map<number, number>();
  let end = -Infinity;
  for (const event of events) {
    const [time, kind, key, velocity, step] = event as number[];
    end = Math.max(end, time!);
    if (kind === TAKE_ON) {
      // A key struck again without a key up in between: the first stroke ended there.
      const open = down.get(key!);
      if (open !== undefined) strokes[open]!.off = time!;
      down.set(key!, strokes.length);
      strokes.push({ midi: key!, on: time!, off: NaN, step: step!, velocity: velocity! });
    } else if (kind === TAKE_OFF) {
      const open = down.get(key!);
      if (open !== undefined) strokes[open]!.off = time!;
      down.delete(key!);
    }
  }
  if (strokes.length === 0) return null;
  for (const s of strokes) if (Number.isNaN(s.off)) s.off = Math.max(end, s.on + UNRELEASED_MS);
  end = Math.max(end, ...strokes.map((s) => s.off));
  const first = new Map<string, { round: number; step: number; at: number }>();
  for (const n of notes) {
    const id = `${n.round}:${n.step}`;
    const seen = first.get(id);
    if (!seen || n.on < seen.at) first.set(id, { round: n.round, step: n.step, at: n.on });
  }
  const anchors = [...first.values()].sort(
    (a, b) => a.at - b.at || a.round - b.round || a.step - b.step,
  );
  const reading = { order, steps, notes, strokes, anchors, cursor: anchors, end, clock };
  if (run.mode === 'wait') {
    const early: Anchor[] = [];
    for (const s of strokes) {
      if (s.step >= 0 && steps[s.step] !== undefined) continue;
      const next = anchors.find((a) => a.at > s.on);
      if (next && isWrong(reading, run, s.midi, s.on))
        early.push({ round: next.round, step: next.step, at: s.on });
    }
    // The cursor stays where a wrong key moved it when the step's own key comes.
    reading.cursor = [...anchors, ...early]
      .sort((a, b) => a.at - b.at)
      .filter(
        (a, k, all) => k === 0 || all[k - 1]!.step !== a.step || all[k - 1]!.round !== a.round,
      );
  }
  return reading;
}

/** Whether `midi` belongs to an ornament of `step` (its principal struck again included). */
function ornamental(step: Step | undefined, midi: number): boolean {
  return Boolean(step?.ornaments?.some((o) => o.midi === midi || o.keys.includes(midi)));
}

/**
 * Whether a key matched to nothing is wrong: not in a rhythm run's count-in, and not the principal
 * of an ornament struck again (or, in a take from before X4, a key of the ornament) on the step the
 * run was on or the one before it. Nor is a key the app played for the player (beyond the keyboard
 * the run was played on) struck all the same, on the screen say: of the step the run was on, the
 * one before, the one after, or a step passed between them, it counted as neither right nor wrong.
 */
function isWrong(
  r: Reading,
  { mode, keys }: Pick<PlaybackRun, 'mode' | 'keys'>,
  midi: number,
  at: number,
): boolean {
  if (mode === 'rhythm' && at < 0) return false;
  const k = r.anchors.findLastIndex((a) => a.at <= at);
  for (const anchor of [r.anchors[k], r.anchors[k - 1]])
    if (anchor && ornamental(r.steps[anchor.step], midi)) return false;
  if (keys && !hasKey(keys, midi)) {
    const around = [r.anchors[k - 1], r.anchors[k], r.anchors[k + 1]].flatMap((a) =>
      a ? [a.step] : [],
    );
    const from = Math.min(...around);
    const to = Math.max(...around);
    for (let i = from; i <= to; i++) if (r.steps[i]?.given?.includes(midi)) return false;
  }
  return true;
}

/**
 * The notes the app played for the player in the run (those beyond its keyboard), in the take's
 * ms, as they sounded: in rhythm mode on the run's clock, from the bar the run began in (its
 * first key matched) to the take's end; in wait mode with each step completed, as the other
 * hand's are (`accompanied`). Empty for a run on a keyboard with every key.
 */
function playedFor(run: PlaybackRun, r: Reading): DemoNote[] {
  const include = beyondKeyboard(run.hands, run.keys);
  if (!include) return [];
  const { score, loop } = run;
  const scale = run.tempo / 100;
  const { order, steps } = r;
  if (r.clock) {
    const written = demoPlan({
      score,
      order,
      steps,
      hands: run.hands,
      loop,
      startBar: loop?.from ?? 0,
      scale,
      include,
      trillStart: run.trillStart,
    });
    const first = r.anchors[0];
    if (!written || !first) return [];
    const lap = r.clock.length ?? 0;
    const from = first.round * lap + r.clock.ms(order[steps[first.step]!.played]!.start);
    const rounds = lap > 0 ? Math.floor(r.end / lap) : 0;
    const out: DemoNote[] = [];
    for (let round = first.round; round <= rounds; round++) {
      for (const n of written.notes) {
        const on = round * lap + n.on;
        if (on >= from - 0.5 && on <= r.end)
          out.push({ midi: n.midi, on, off: round * lap + n.off });
      }
    }
    return out;
  }
  const plan = accompanimentPlan({
    score,
    order,
    steps,
    hand: null,
    include,
    loop,
    scale,
    trillStart: run.trillStart,
  });
  if (!plan) return [];
  // A step is completed with the last of the player's keys it waits for.
  const visits = new Map<string, { step: number; keys: Set<number>; at: number }>();
  for (const n of r.notes) {
    const id = `${n.round}:${n.step}`;
    const visit = visits.get(id) ?? { step: n.step, keys: new Set<number>(), at: -Infinity };
    visit.keys.add(n.note.midi);
    visit.at = Math.max(visit.at, n.on);
    visits.set(id, visit);
  }
  const completions = [...visits.values()]
    .filter((v) => steps[v.step]!.midis.every((midi) => v.keys.has(midi)))
    .sort((a, b) => a.at - b.at);
  return accompanied(plan, completions);
}

/** The pedals of the take as plan controls, `shift` added to their times. */
function pedals(events: readonly TakeEvent[], shift: number): DemoControl[] {
  return events
    .filter((e) => isPedal(e[1]!))
    .map((e) => ({ at: e[0]! + shift, controller: e[1]!, value: e[2]! }))
    .sort((a, b) => a.at - b.at);
}

function cuesOf(keys: readonly PlaybackKey[], parts: readonly PlaybackPart[]): number[] {
  const times = new Set<number>();
  for (const k of keys) {
    times.add(k.on);
    times.add(k.off);
    if (k.wrong) times.add(Math.max(k.off, k.on + WRONG_SHOWN_MS));
  }
  for (const p of parts) times.add(p.at);
  return [...times].sort((a, b) => a - b);
}

/** The run as it was played, from its first key (a rhythm run's count-in included) to its last. */
export function takePlayback(run: PlaybackRun): TakePlayback | null {
  const r = read(run);
  if (!r) return null;
  // From time 0, or from the first key or pedal before it (a rhythm run's count-in).
  const shift = -Math.min(0, ...run.events.map((e) => e[0]!));
  const keys: PlaybackKey[] = r.strokes.map((s) => {
    const matched = s.step >= 0 && r.steps[s.step] !== undefined;
    return {
      midi: s.midi,
      on: s.on + shift,
      off: s.off + shift,
      step: matched ? s.step : null,
      wrong: !matched && isWrong(r, run, s.midi, s.on),
    };
  });
  const velocities = r.strokes.map((s) => s.velocity);
  // The notes the app played for the player, so the run is heard whole.
  for (const n of playedFor(run, r)) {
    keys.push({ midi: n.midi, on: n.on + shift, off: n.off + shift, step: null, wrong: false });
    velocities.push(run.givenVelocity ?? DEMO_VELOCITY);
  }
  const byOn = keys.map((_, i) => i).sort((a, b) => keys[a]!.on - keys[b]!.on || a - b);
  const sounded = byOn.map((i) => ({ ...keys[i]!, velocity: velocities[i]! }));
  const steps = r.cursor.map((a) => ({ step: a.step, at: a.at + shift }));
  const bars: TakePlayback['bars'] = [];
  for (const a of r.anchors) {
    const measure = r.steps[a.step]!.measure;
    if (!bars.some((b) => b.measure === measure)) bars.push({ measure, at: a.at + shift });
  }
  return {
    plan: {
      notes: sounded.map(({ midi, on, off, velocity }) => ({ midi, on, off, velocity })),
      steps,
      length: Math.max(r.end, ...sounded.map((k) => k.off - shift)) + shift + PLAYBACK_TAIL_MS,
      start: 0,
      loop: false,
      controls: pedals(run.events, shift),
      cues: cuesOf(keys, []),
    },
    steps: r.steps,
    keys: sounded.map(({ midi, on, off, step, wrong }) => ({ midi, on, off, step, wrong })),
    parts: [],
    bars,
  };
}

export type CompareBy = 'bar' | 'whole';

/** A stretch of the run (its first round) and the same bars as written. */
interface Window {
  /** Positions in the play order, inclusive. */
  first: number;
  last: number;
  /** The run's ms, [start, end). */
  start: number;
  end: number;
}

/**
 * Compare: for each bar of the run's first round (or for all of them at once), the bar as written,
 * played by the demo at the run's tempo, then as the run played it, with its velocities and pedal;
 * the pedals come up at the end of each of the run's stretches.
 */
export function comparePlayback(run: PlaybackRun, by: CompareBy): TakePlayback | null {
  const r = read(run);
  if (!r) return null;
  const { score } = run;
  const scale = run.tempo / 100;
  const { order } = runSteps(score, run.hands, run.repeats, run.loop);
  const span = playSpan(score, order, run.loop, 0);
  const demo = demoPlan({
    score,
    order,
    steps: r.steps,
    hands: run.hands,
    loop: run.loop,
    startBar: run.loop?.from ?? 0,
    scale,
    trillStart: run.trillStart,
  });
  if (!span || !demo) return null;
  const written = timeline(score, order, scale);
  const zero = written(span.from);
  const times = runTimes(r.notes, r.clock, run.latency);
  const given = playedFor(run, r);

  // The first round's bars, in the order played, each from its first key (or its downbeat on a
  // rhythm run's clock, whichever is earlier) to the next one's.
  const round = r.anchors.filter((a) => a.round === 0);
  const byPlayed = new Map<number, number>();
  for (const a of round) {
    const played = r.steps[a.step]!.played;
    const clockAt = run.mode === 'rhythm' ? times.at(0, order[played]!.start) : null;
    const at = Math.min(a.at, clockAt ?? Infinity);
    byPlayed.set(played, Math.min(byPlayed.get(played) ?? Infinity, at));
  }
  const played = [...byPlayed.keys()].sort((a, b) => a - b);
  if (played.length === 0) return null;
  const nextRound = r.anchors.find((a) => a.round > 0)?.at ?? Infinity;
  const roundEnd = Math.min(nextRound, r.end);
  const bars: Window[] = played.map((p, i) => {
    const next = played[i + 1];
    return {
      first: p,
      last: p,
      start: byPlayed.get(p)!,
      end: next === undefined ? roundEnd : byPlayed.get(next)!,
    };
  });
  const windows: Window[] =
    by === 'bar'
      ? bars
      : [{ first: bars[0]!.first, last: bars.at(-1)!.last, start: bars[0]!.start, end: roundEnd }];

  const notes: DemoPlan['notes'] = [];
  const controls: DemoControl[] = [];
  const steps: DemoPlan['steps'] = [];
  const keys: PlaybackKey[] = [];
  const parts: PlaybackPart[] = [];
  const barsAt: TakePlayback['bars'] = [];
  let t = 0;
  for (const w of windows) {
    const from = order[w.first]!.start;
    const to = order[w.last]!.start + score.measures[order[w.last]!.measure]!.duration;
    const measure = by === 'bar' ? order[w.first]!.measure : null;
    const pass = by === 'bar' ? order[w.first]!.pass : 1;
    const head = order[w.first]!.measure;
    if (!barsAt.some((b) => b.measure === head)) barsAt.push({ measure: head, at: t });

    // As written: the demo's notes that start in these bars, cut at their end.
    // In whole ms: what is played back needs no finer time.
    const a = Math.round(written(from) - zero);
    const b = Math.round(written(to) - zero);
    parts.push({ at: t, kind: 'written', measure, pass });
    for (const n of demo.notes) {
      if (n.on < a || n.on >= b) continue;
      const on = t + Math.round(n.on) - a;
      const off = t + Math.round(Math.min(n.off, b)) - a;
      notes.push({ midi: n.midi, on, off });
      keys.push({ midi: n.midi, on, off, step: null, wrong: false });
    }
    for (const s of demo.steps)
      if (s.at >= a && s.at < b) steps.push({ step: s.step, at: t + Math.round(s.at) - a });
    t += b - a + COMPARE_GAP_MS;

    // As played: the keys that start in the window, cut at its end, and the pedals.
    const shift = t - w.start;
    parts.push({ at: t, kind: 'run', measure, pass });
    const state = new Map<number, number>();
    for (const e of run.events) {
      if (!isPedal(e[1]!)) continue;
      if (e[0]! < w.start) state.set(e[1]!, e[2]!);
      else if (e[0]! < w.end) controls.push({ at: e[0]! + shift, controller: e[1]!, value: e[2]! });
    }
    for (const [controller, value] of state) controls.push({ at: t, controller, value });
    for (const s of r.strokes) {
      if (s.on < w.start || s.on >= w.end) continue;
      const matched = s.step >= 0 && r.steps[s.step] !== undefined;
      const on = s.on + shift;
      const off = Math.min(s.off, w.end) + shift;
      notes.push({ midi: s.midi, on, off, velocity: s.velocity });
      keys.push({
        midi: s.midi,
        on,
        off,
        step: matched ? s.step : null,
        wrong: !matched && isWrong(r, run, s.midi, s.on),
      });
    }
    for (const n of given) {
      if (n.on < w.start || n.on >= w.end) continue;
      const on = n.on + shift;
      const off = Math.min(n.off, w.end) + shift;
      notes.push({ midi: n.midi, on, off, velocity: run.givenVelocity ?? DEMO_VELOCITY });
      keys.push({ midi: n.midi, on, off, step: null, wrong: false });
    }
    for (const anchor of r.cursor)
      if (anchor.round === 0 && anchor.at >= w.start && anchor.at < w.end)
        steps.push({ step: anchor.step, at: anchor.at + shift });
    t += w.end - w.start;
    // Every pedal up before the next bar as written.
    for (const controller of TAKE_PEDALS) controls.push({ at: t, controller, value: 0 });
    t += COMPARE_GAP_MS;
  }
  const length = t - COMPARE_GAP_MS + PLAYBACK_TAIL_MS;
  notes.sort((x, y) => x.on - y.on || x.midi - y.midi);
  controls.sort((x, y) => x.at - y.at);
  steps.sort((x, y) => x.at - y.at);
  return {
    plan: {
      notes,
      steps,
      length,
      start: 0,
      loop: false,
      controls,
      cues: cuesOf(keys, parts),
    },
    steps: r.steps,
    keys: keys.sort((x, y) => x.on - y.on || x.midi - y.midi),
    parts,
    bars: barsAt,
  };
}

/** What sounds at `ms`: the keys down, the wrong ones among them, and the part playing. */
export function playbackAt(
  playback: TakePlayback,
  ms: number,
): {
  sounding: number[];
  wrong: number[];
  part: PlaybackPart | null;
} {
  const sounding = new Set<number>();
  const wrong = new Set<number>();
  for (const k of playback.keys) {
    if (k.on > ms) break;
    if (ms < k.off) sounding.add(k.midi);
    if (k.wrong && ms < Math.max(k.off, k.on + WRONG_SHOWN_MS)) wrong.add(k.midi);
  }
  const part = playback.parts.findLast((p) => p.at <= ms) ?? null;
  return { sounding: [...sounding], wrong: [...wrong], part };
}

/** The keys of `step` struck from the moment the cursor reached it up to `ms`. */
export function keysStruck(
  playback: TakePlayback,
  step: number,
  since: number,
  ms: number,
): number[] {
  const out = new Set<number>();
  for (const k of playback.keys) {
    if (k.on > ms) break;
    if (k.step === step && k.on >= since) out.add(k.midi);
  }
  return [...out];
}
