import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { beginPractice } from '../../lib/shell.ts';
import type { ClickEvent } from '../../output/click.ts';
import {
  EngravedStaff,
  type Duration,
  type StaffLabel,
  type StaffNote,
} from '../engraving/EngravedStaff.tsx';
import {
  bodyStart,
  GLYPH,
  HEAD_WIDTH,
  SPACE,
  staffY,
  STEM_WIDTH,
  stemTop,
} from '../engraving/geometry.ts';
import { TUPLET_3 } from '../engraving/glyphs.ts';
import { sharedClickTrack } from '../pieces/useRhythmPlayer.ts';
import { ExerciseFrame } from './exercises.tsx';
import { Choices } from './kit.tsx';
import { useCopy, useExercise, useNoteOn, usePlayKey } from './lesson.ts';

// The rhythm lessons: a beat to hear and tap along with, rhythms written on a single line with
// their counts under them, played back with the click, and an exercise that times your taps.
//
// Time is counted in ticks, twelve to a quarter note, so that an eighth (6), a sixteenth (3) and
// an eighth of a triplet (4) are all whole numbers; every sound and every click is placed at
// `origin + ticks × ms per tick`, so nothing drifts, however long a rhythm runs.

export interface Beat {
  duration: Duration;
  dotted?: boolean;
  rest?: boolean;
  /** Tied to the next note: one sound, held through both; the next is not played again. */
  tie?: boolean;
  /** One of three in the time of two: an eighth of a triplet lasts a third of a beat. */
  triplet?: boolean;
}

/** A time signature, as [beats, beat unit]: [4, 4], [6, 8]. */
export type Time = readonly [number, number];

const QUARTER = 12;
const TICKS: Record<Duration, number> = {
  whole: 48,
  half: 24,
  quarter: 12,
  eighth: 6,
  sixteenth: 3,
};
const NOTE_KEY = 72; // C5: what a rhythm plays on the built-in piano

function ticksOf(b: Beat): number {
  const written = TICKS[b.duration] * (b.dotted ? 1.5 : 1);
  return b.triplet ? (written * 2) / 3 : written;
}

/**
 * How a time signature divides the bar, in ticks: the counts (one per unit of the bottom number)
 * and the beat. In 6/8 the beat is a dotted quarter, three eighths: two beats of three counts.
 */
interface Meter {
  bar: number;
  /** Ticks per count: a quarter in 4/4, an eighth in 6/8. */
  count: number;
  /** Counts in a bar: the top number. */
  counts: number;
  beat: number;
  compound: boolean;
}

function meterOf([top, bottom]: Time): Meter {
  const count = (QUARTER * 4) / bottom;
  const compound = bottom === 8 && top % 3 === 0 && top > 3;
  return { bar: top * count, count, counts: top, beat: compound ? 3 * count : count, compound };
}

interface Placed extends Beat {
  /** Where it starts, in ticks from the start. */
  at: number;
  length: number;
  /** The second half of a tie: it sounds on from the note before, and is not played. */
  held: boolean;
}

function place(rhythm: readonly Beat[]): Placed[] {
  let at = 0;
  return rhythm.map((b, i) => {
    const length = ticksOf(b);
    const placed = { ...b, at, length, held: !b.rest && Boolean(rhythm[i - 1]?.tie) };
    at += length;
    return placed;
  });
}

/** What a rhythm occupies: its notes placed in ticks, its length, how many bars. */
function layout(rhythm: readonly Beat[], meter: Meter) {
  const placed = place(rhythm);
  const total = placed.length === 0 ? 0 : placed.at(-1)!.at + placed.at(-1)!.length;
  const bars = Math.max(1, Math.ceil(total / meter.bar - 1e-9));
  return { placed, total, bars };
}

/** How long a struck note sounds: through every note it is tied to. */
function soundingTicks(placed: readonly Placed[], i: number): number {
  let length = placed[i]!.length;
  for (let j = i; placed[j]?.tie && placed[j + 1] && !placed[j + 1]!.rest; j++) {
    length += placed[j + 1]!.length;
  }
  return length;
}

/** The count said at a tick of a beat, when the beat is divided into `step` ticks. */
function countText(
  meter: Meter,
  tick: number,
  step: number,
  words: { trip: string; let: string },
): string {
  const inBar = tick % meter.bar;
  if (inBar % meter.count === 0) return String(inBar / meter.count + 1);
  if (meter.compound) return '&';
  const offset = inBar % meter.count;
  if (step === 4) return offset === 4 ? words.trip : words.let;
  if (step === 3) return offset === 3 ? 'e' : offset === 6 ? '&' : 'a';
  return '&';
}

/**
 * The counts under a line, beat by beat. Each beat is divided as finely as the notes in it need:
 * "1", "1 &", "1 trip let", "1 e & a" (in 6/8, "1 2 3"). `bracket` counts only what each beat
 * needs and puts the ones not played on in brackets, "1 (2) & 3"; without it every beat of a line
 * with eighths says its "&", as in the first rhythm lesson.
 */
function countLabels(
  placed: readonly Placed[],
  meter: Meter,
  bars: number,
  bracket: boolean,
  words: { trip: string; let: string },
): { tick: number; text: string; held: boolean }[] {
  const struck = new Set(placed.filter((b) => !b.rest && !b.held).map((b) => b.at));
  const starts = placed.map((b) => b.at);
  const hasEighths = placed.some((b) => b.duration === 'eighth' && !b.triplet);
  const out: { tick: number; text: string; held: boolean }[] = [];
  for (let from = 0; from < bars * meter.bar; from += meter.beat) {
    const offsets = starts.filter((t) => t >= from && t < from + meter.beat).map((t) => t - from);
    const steps = meter.compound ? [meter.beat, meter.count, meter.count / 2] : [12, 6, 4, 3];
    let step = steps.find((s) => offsets.every((o) => o % s === 0)) ?? steps.at(-1)!;
    // Lesson 4's rule: in a line with eighths, every beat of simple time says its "&".
    if (!bracket && hasEighths && step === 12) step = 6;
    if (!bracket && meter.compound) step = Math.min(step, meter.count);
    for (let t = from; t < from + meter.beat; t += step) {
      const text = countText(meter, t, step, words);
      const held = bracket && !struck.has(t);
      out.push({ tick: t, text: held ? `(${text})` : text, held });
    }
  }
  return out;
}

type Tone = NonNullable<StaffNote['tone']>;

/** A tie under two noteheads (the stems are up), as a crescent: thin at its ends, full mid-way. */
function tiePath(x1: number, x2: number, y: number): string {
  const depth = Math.min(7, Math.max(3.5, (x2 - x1) * 0.12));
  const thick = 0.22 * SPACE;
  const d = (x2 - x1) / 4;
  const outer = y + depth / 0.75;
  const inner = y + (depth - thick) / 0.75;
  return (
    `M${x1} ${y}C${x1 + d} ${outer} ${x2 - d} ${outer} ${x2} ${y}` +
    `C${x2 - d} ${inner} ${x1 + d} ${inner} ${x1} ${y}Z`
  );
}

const BEAM = 0.5 * SPACE;
const BEAM_GAP = 0.25 * SPACE;
/** Room over the stems for a triplet's bracket and its 3. */
const TUPLET_ROOM = 18;

/**
 * A rhythm on one line: time signature, notes spaced by how long they last, beamed by the beat
 * (in threes in 6/8), ties, triplets with their bracket, and the count under each beat.
 */
export function RhythmLine({
  rhythm,
  time = [4, 4],
  label,
  current = null,
  tones,
  counts = true,
  bracket = false,
  spacing,
}: {
  rhythm: readonly Beat[];
  time?: Time;
  label: string;
  /** The note sounding, drawn in the accent. */
  current?: number | null;
  /** A colour for each note, after an exercise run. */
  tones?: readonly (Tone | undefined)[];
  counts?: boolean;
  /** Counts only what each beat needs, the ones not played on in brackets: "1 (2) & 3". */
  bracket?: boolean;
  /** The width of a quarter note, when lines set one under another should share it. */
  spacing?: number;
}) {
  const copy = useCopy();
  const meter = meterOf(time);
  const { placed, bars } = layout(rhythm, meter);
  const fine = placed.some((b) => b.duration === 'sixteenth' || b.triplet);
  const triplets = placed.some((b) => b.triplet);
  const x0 = bodyStart('rhythm', 0, true);
  // Two bars or more are set closer, so they stay legible at a phone's width; sixteenths and
  // triplets need more room. Short notes get more room before each barline too.
  const quarterWidth = spacing ?? (fine ? (bars > 1 ? 64 : 88) : bars > 1 ? 46 : 64);
  const barGap = placed.some((b) => TICKS[b.duration] <= TICKS.eighth) ? 14 : 0;
  const tickWidth = quarterWidth / QUARTER;
  const xAt = (tick: number) =>
    x0 + tick * tickWidth + 8 + Math.floor(tick / meter.bar + 1e-9) * barGap;
  const width = x0 + bars * meter.bar * tickWidth + (bars - 1) * barGap + 24;
  const above = triplets ? TUPLET_ROOM : 0;

  // A tie's second note takes the colour of its first.
  const toneOf = (i: number): Tone => {
    const own = tones?.[i];
    if (own) return own;
    if (tones && placed[i]?.held) return toneOf(i - 1);
    return current === i ? 'accent' : 'ink';
  };
  const notes: StaffNote[] = placed.map((b, i) => ({
    id: `${i}`,
    pitch: b.rest ? null : { letter: 'B', accidental: 0, octave: 4 },
    clef: 'treble',
    x: xAt(b.at),
    duration: b.duration,
    dotted: b.dotted,
    flag: false,
    tone: toneOf(i),
  }));
  // A barline goes half-way between the last note of a bar (and its dot) and the next downbeat.
  const barlines = Array.from({ length: bars - 1 }, (_, i) => {
    const downbeat = xAt((i + 1) * meter.bar);
    const before = placed.findLast((b) => b.at < (i + 1) * meter.bar);
    if (!barGap || !before) return downbeat - 14;
    const end = xAt(before.at) + HEAD_WIDTH + (before.dotted ? 8 : 0);
    return (end + downbeat) / 2;
  });

  const labels: StaffLabel[] = counts
    ? countLabels(placed, meter, bars, bracket, {
        trip: copy('countTrip'),
        let: copy('countLet'),
      }).map(({ tick, text, held }) => ({
        clef: 'treble',
        position: -1,
        x: xAt(tick) + HEAD_WIDTH / 2,
        text,
        held,
      }))
    : [];

  // Beams: notes of an eighth or shorter, one after another within a beat, are joined; a note
  // alone in its beat keeps its flag.
  const beamable = (b: Placed) => !b.rest && TICKS[b.duration] <= TICKS.eighth;
  const groups: number[][] = [];
  placed.forEach((b, i) => {
    const beat = Math.floor(b.at / meter.beat);
    const fits = beamable(b) && b.at + b.length <= (beat + 1) * meter.beat;
    const last = groups.at(-1);
    const prev = placed[i - 1];
    if (
      fits &&
      last &&
      last.at(-1) === i - 1 &&
      prev &&
      Math.floor(prev.at / meter.beat) === beat
    ) {
      last.push(i);
    } else if (fits) {
      groups.push([i]);
    }
  });
  for (const group of groups) {
    if (group.length === 1) notes[group[0]!] = { ...notes[group[0]!]!, flag: true };
  }
  const beamed = groups.filter((g) => g.length > 1);

  const toneAcross = (a: number, b: number) =>
    notes[a]!.tone === notes[b]!.tone ? notes[a]!.tone : 'ink';
  const beamRects: { key: string; x: number; y: number; width: number; tone: Tone }[] = [];
  for (const group of beamed) {
    const first = group[0]!;
    const last = group.at(-1)!;
    const from = stemTop('rhythm', notes[first]!.x);
    const to = stemTop('rhythm', notes[last]!.x);
    beamRects.push({
      key: `${first}`,
      x: from.x - STEM_WIDTH,
      y: from.y,
      width: to.x - from.x + STEM_WIDTH,
      tone: toneAcross(first, last) ?? 'ink',
    });
    // The sixteenths' second beam: across neighbouring sixteenths, or a stub a notehead long,
    // pointing into the beat (back towards a dotted eighth).
    const y = from.y + BEAM + BEAM_GAP;
    group.forEach((i, k) => {
      if (placed[i]!.duration !== 'sixteenth') return;
      const x = stemTop('rhythm', notes[i]!.x).x;
      const next = group[k + 1];
      const prev = group[k - 1];
      const nextSixteenth = next !== undefined && placed[next]!.duration === 'sixteenth';
      const prevSixteenth = prev !== undefined && placed[prev]!.duration === 'sixteenth';
      if (nextSixteenth) {
        const nx = stemTop('rhythm', notes[next]!.x).x;
        beamRects.push({
          key: `${i}s`,
          x: x - STEM_WIDTH,
          y,
          width: nx - x + STEM_WIDTH,
          tone: toneAcross(i, next) ?? 'ink',
        });
      } else if (!prevSixteenth) {
        const left = next === undefined || (prev !== undefined && placed[prev]!.dotted);
        const stub = HEAD_WIDTH * 0.9;
        beamRects.push({
          key: `${i}s`,
          x: left ? x - stub : x - STEM_WIDTH,
          y,
          width: stub + (left ? 0 : STEM_WIDTH),
          tone: notes[i]!.tone ?? 'ink',
        });
      }
    });
  }

  // Ties, under the heads.
  const lineY = staffY('rhythm', 'treble', 4);
  const ties = placed.flatMap((b, i) => {
    if (!b.tie || b.rest || !placed[i + 1] || placed[i + 1]!.rest) return [];
    const x1 = notes[i]!.x + HEAD_WIDTH * 0.62;
    const x2 = notes[i + 1]!.x + HEAD_WIDTH * 0.38;
    return [{ key: i, d: tiePath(x1, x2, lineY + SPACE * 0.5 + 2), tone: toneAcross(i, i + 1) }];
  });

  // Triplets: three notes in one beat, under a bracket with a 3.
  const tuplets: number[][] = [];
  placed.forEach((b, i) => {
    if (!b.triplet) return;
    const last = tuplets.at(-1);
    const prev = placed[i - 1];
    if (
      last &&
      last.at(-1) === i - 1 &&
      prev &&
      Math.floor(prev.at / meter.beat) === Math.floor(b.at / meter.beat)
    )
      last.push(i);
    else tuplets.push([i]);
  });
  const bracketY = -9;
  const three = { width: 1.224 * SPACE * 0.8, height: 1.5 * SPACE * 0.8 };

  return (
    <EngravedStaff
      system="rhythm"
      width={width}
      above={above}
      className={triplets ? 'plate-staff is-rhythm is-tall' : 'plate-staff is-rhythm'}
      label={label}
      time={time}
      notes={notes}
      bars={barlines}
      labels={labels}
    >
      {beamRects.map((r) => (
        <rect
          key={r.key}
          className={`engraved-note is-${r.tone} engraved-beam`}
          x={r.x}
          y={r.y}
          width={r.width}
          height={BEAM}
        />
      ))}
      {ties.map((t) => (
        <path key={t.key} className={`engraved-note is-${t.tone ?? 'ink'} engraved-tie`} d={t.d} />
      ))}
      {tuplets.map((group) => {
        const left = notes[group[0]!]!.x;
        const right = notes[group.at(-1)!]!.x + HEAD_WIDTH;
        const mid = (left + right) / 2;
        const gap = three.width / 2 + 3;
        return (
          <g key={group[0]} className="engraved-tuplet">
            <path
              d={`M${left} ${bracketY + 5}V${bracketY}H${mid - gap}M${mid + gap} ${bracketY}H${right}V${bracketY + 5}`}
            />
            <path
              className="engraved-tuplet-number"
              d={TUPLET_3}
              transform={`translate(${mid - three.width / 2} ${bracketY + three.height / 2}) scale(${GLYPH * 0.8})`}
            />
          </g>
        );
      })}
    </EngravedStaff>
  );
}

/**
 * The clicks of a steady beat from `origin`, `step` ticks apart, until `end` ticks (or forever):
 * the first of each bar accented, the beats plain, anything between them (the eighths of 6/8,
 * when asked for) a quieter subdivision.
 */
function clickSource(
  origin: number,
  msPerTick: number,
  meter: Meter,
  end: number | null,
  subdivide = false,
) {
  const step = subdivide ? (meter.compound ? meter.count : meter.beat / 2) : meter.beat;
  const period = step * msPerTick;
  return (from: number, to: number): ClickEvent[] => {
    const clicks: ClickEvent[] = [];
    const first = Math.max(0, Math.ceil((from - origin) / period));
    for (let i = first; ; i++) {
      const tick = i * step;
      if (end !== null && tick >= end) break;
      const time = origin + tick * msPerTick;
      if (time >= to) break;
      clicks.push({ time, accent: tick % meter.bar === 0, sub: tick % meter.beat !== 0 });
    }
    return clicks;
  };
}

/** How many ticks have gone by since `origin` (negative before it), every frame while it runs. */
function useTickPosition(origin: number | null, msPerTick: number): number | null {
  const [position, setPosition] = useState<number | null>(null);
  useEffect(() => {
    if (origin === null) return;
    let frame = 0;
    const tick = () => {
      setPosition((performance.now() - origin) / msPerTick);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setPosition(null);
    };
  }, [origin, msPerTick]);
  return position;
}

/** The count sounding (0 for the first), or null before it and when stopped. */
function useCountIndex(origin: number | null, msPerTick: number, count: number): number | null {
  const position = useTickPosition(origin, msPerTick);
  return position === null || position < 0 ? null : Math.floor(position / count);
}

/** Ms per tick at a tempo given in quarter notes a minute: an eighth is as fast in 6/8 as in 4/4. */
function tickMs(bpm: number): number {
  return 60_000 / bpm / QUARTER;
}

const LEAD_MS = 400;

/**
 * The page's click track, shared by the figures: whoever started it last owns it, so a figure
 * that stops never silences one that has just started.
 */
const clicks = {
  owner: null as string | null,
  start(owner: string, source: (from: number, to: number) => ClickEvent[]) {
    const track = sharedClickTrack();
    if (!track) return;
    clicks.owner = owner;
    track.start(source);
  },
  stop(owner: string) {
    if (clicks.owner !== owner) return;
    clicks.owner = null;
    sharedClickTrack()?.stop();
  },
};

/**
 * Plays a rhythm: a bar of clicks to count in, then the notes on the built-in piano with the click
 * going on under them. Says which note is sounding.
 */
function usePlayRhythm() {
  const playKey = usePlayKey();
  const id = useId();
  const [run, setRun] = useState<{ origin: number; msPerTick: number; placed: Placed[] } | null>(
    null,
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  };
  const stop = useCallback(() => {
    clear();
    clicks.stop(id);
    setRun(null);
  }, [id]);
  useEffect(() => () => stop(), [stop]);

  const play = (
    rhythm: readonly Beat[],
    time: Time,
    bpm: number,
    { countIn = true, subdivide = false }: { countIn?: boolean; subdivide?: boolean } = {},
  ) => {
    stop();
    const meter = meterOf(time);
    const msPerTick = tickMs(bpm);
    const lead = countIn ? meter.bar : 0;
    const origin = performance.now() + LEAD_MS;
    const { placed, bars } = layout(rhythm, meter);
    clicks.start(id, clickSource(origin, msPerTick, meter, lead + bars * meter.bar, subdivide));
    const start = origin + lead * msPerTick;
    placed.forEach((b, i) => {
      if (b.rest || b.held) return;
      const at = start + b.at * msPerTick - performance.now();
      const ms = Math.max(120, soundingTicks(placed, i) * msPerTick - 60);
      timers.current.push(setTimeout(() => playKey(NOTE_KEY, ms), at));
    });
    timers.current.push(
      setTimeout(stop, start + bars * meter.bar * msPerTick - performance.now() + 200),
    );
    setRun({ origin: start, msPerTick, placed });
  };

  const position = useTickPosition(run?.origin ?? null, run?.msPerTick ?? 1);
  let current: number | null = null;
  if (run && position !== null) {
    run.placed.forEach((b, i) => {
      if (!b.rest && position >= b.at && position < b.at + b.length) current = i;
    });
  }
  return { play, stop, playing: run !== null, current };
}

function PlayGlyph() {
  return (
    <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
      <path d="M1 1l8 5-8 5z" />
    </svg>
  );
}

/** The counts of a bar as numbered dots, the one sounding lit; beat 1 (and 4 in 6/8) ringed. */
function CountDots({
  counts,
  lit,
  compound,
}: {
  counts: number;
  lit: number | null;
  compound: boolean;
}) {
  return (
    <div className="lesson-beats is-small" aria-hidden="true">
      {Array.from({ length: counts }, (_, i) => (
        <span
          key={i}
          className={
            (lit !== null && lit % counts === i ? 'is-on' : '') +
            (i === 0 || (compound && i % 3 === 0) ? ' is-accent' : '')
          }
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}

// Figures.

/** A steady beat: pick a tempo, start it, and tap any key along with it to see how close you are. */
export function BeatPulse({ labels }: { labels: { tempo: string } }) {
  const copy = useCopy();
  const exercise = useExercise();
  const [bpm, setBpm] = useState(72);
  const [origin, setOrigin] = useState<number | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const period = 60_000 / bpm;
  const release = useRef<(() => void) | null>(null);

  // Running only while it is the exercise listening: starting another stops it.
  const running = origin !== null && exercise.active;
  const stop = () => {
    exercise.stop();
    setOrigin(null);
  };
  const start = () => {
    exercise.start();
    const at = performance.now() + LEAD_MS;
    clicks.start(exercise.id, clickSource(at, tickMs(bpm), meterOf([4, 4]), null));
    release.current?.();
    release.current = beginPractice();
    setTaps([]);
    setOrigin(at);
  };
  useEffect(() => {
    if (running) return;
    clicks.stop(exercise.id);
    release.current?.();
    release.current = null;
  }, [running, exercise.id]);
  // Leaving the page stops the beat too (the exercise is not turned off then).
  useEffect(
    () => () => {
      clicks.stop(exercise.id);
      release.current?.();
      release.current = null;
    },
    [exercise.id],
  );

  useNoteOn((_midi, time) => {
    if (!running || origin === null || time < origin - period / 2) return;
    const nearest = Math.round((time - origin) / period);
    setTaps((t) => [...t, time - (origin + nearest * period)].slice(-8));
  });

  const beat = useCountIndex(running ? origin : null, tickMs(bpm), QUARTER);
  const last = taps.at(-1);
  const verdict =
    last === undefined
      ? !running
        ? copy('ready')
        : copy('tapAlong')
      : Math.abs(last) <= 40
        ? copy('onTime')
        : copy('offBy', {
            ms: Math.round(Math.abs(last)),
            side: last < 0 ? copy('early') : copy('late'),
          });

  return (
    <div className={exercise.active ? 'exercise is-active' : 'exercise'}>
      <div className="beat-row">
        <div className="lesson-beats" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={
                (beat !== null && beat % 4 === i ? 'is-on' : '') + (i === 0 ? ' is-accent' : '')
              }
            >
              {i + 1}
            </span>
          ))}
        </div>
        <label className="beat-tempo">
          <span>
            {labels.tempo} <b>{bpm}</b>
          </span>
          <input
            type="range"
            min={50}
            max={120}
            step={2}
            value={bpm}
            disabled={running}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="tap-meter" aria-hidden="true">
        <span className="tap-centre" />
        {taps.map((off, i) => (
          <span
            key={i}
            className={Math.abs(off) <= 40 ? 'tap is-good' : 'tap'}
            style={{
              left: `${50 + Math.max(-1, Math.min(1, off / (period / 2))) * 50}%`,
              opacity: (i + 1) / taps.length,
            }}
          />
        ))}
      </div>
      <div className="tap-scale" aria-hidden="true">
        <span>{copy('early')}</span>
        <span>{copy('late')}</span>
      </div>
      <div className="exercise-foot">
        <p className="exercise-message" aria-live="polite">
          {verdict}
        </p>
        <button
          type="button"
          className="button button-primary is-compact"
          onClick={running ? stop : start}
        >
          {running ? copy('stop') : copy('start')}
        </button>
      </div>
    </div>
  );
}

/**
 * Rhythms to hear: each written on a line, played with a bar of clicks to count in (in 6/8 the
 * eighths click too, quieter than the beats). The tempo is in quarter notes a minute.
 */
export function RhythmRows({
  rows,
  bpm = 72,
  bracket = false,
  spacing,
}: {
  rows: readonly { title: string; rhythm: readonly Beat[]; time?: Time }[];
  bpm?: number;
  /** Counts in brackets where nothing is played: "1 (2) & 3". */
  bracket?: boolean;
  /** One width of a quarter note for every row, so that their beats line up. */
  spacing?: number;
}) {
  const copy = useCopy();
  const player = usePlayRhythm();
  const [playing, setPlaying] = useState<number | null>(null);
  return (
    <div className="rhythm-rows">
      {rows.map((row, i) => (
        <div key={row.title} className="rhythm-row">
          <div className="rhythm-row-head">
            <p>{row.title}</p>
            <button
              type="button"
              className="button is-compact"
              onClick={() => {
                if (player.playing && playing === i) {
                  player.stop();
                  return;
                }
                setPlaying(i);
                const time = row.time ?? [4, 4];
                player.play(row.rhythm, time, bpm, { subdivide: meterOf(time).compound });
              }}
            >
              <PlayGlyph />
              {player.playing && playing === i ? copy('stop') : copy('listen')}
            </button>
          </div>
          <RhythmLine
            rhythm={row.rhythm}
            time={row.time}
            label={row.title}
            bracket={bracket}
            spacing={spacing}
            current={player.playing && playing === i ? player.current : null}
          />
        </div>
      ))}
    </div>
  );
}

/** The same beat grouped in bars of four, three or two: the first beat of each bar is the strong one. */
export function TimeSignatures() {
  const copy = useCopy();
  const player = usePlayRhythm();
  const [time, setTime] = useState<'4' | '3' | '2'>('4');
  const perBar = Number(time);
  const rhythm = useMemo(
    () => Array.from({ length: perBar * 2 }, (): Beat => ({ duration: 'quarter' })),
    [perBar],
  );
  return (
    <>
      <div className="plate-toolbar">
        <Choices
          value={time}
          onChange={(t) => {
            player.stop();
            setTime(t);
          }}
          options={[
            { value: '4', label: '4/4' },
            { value: '3', label: '3/4' },
            { value: '2', label: '2/4' },
          ]}
        />
        <button
          type="button"
          className="button is-compact"
          onClick={() =>
            player.playing
              ? player.stop()
              : player.play(rhythm, [perBar, 4], 88, { countIn: false })
          }
        >
          <PlayGlyph />
          {player.playing ? copy('stop') : copy('listen')}
        </button>
      </div>
      <RhythmLine
        rhythm={rhythm}
        time={[perBar, 4]}
        label={`${perBar}/4`}
        current={player.playing ? player.current : null}
      />
    </>
  );
}

const SIX_EIGHTHS: readonly Beat[] = Array.from({ length: 12 }, () => ({ duration: 'eighth' }));

/**
 * Six eighths a bar, two ways: in 3/4 three beats of two eighths, in 6/8 two beats of three. The
 * eighths go at the same speed in both; only the grouping, and so the click, changes.
 */
export function CompoundTime({
  labels,
}: {
  labels: { beats: string; eighths: string; clicks: string };
}) {
  const copy = useCopy();
  const player = usePlayRhythm();
  const [time, setTime] = useState<'3/4' | '6/8'>('6/8');
  const [click, setClick] = useState<'beats' | 'eighths'>('beats');
  const signature: Time = time === '3/4' ? [3, 4] : [6, 8];
  return (
    <>
      <div className="plate-toolbar">
        <Choices
          value={time}
          onChange={(t) => {
            player.stop();
            setTime(t);
          }}
          options={[
            { value: '3/4', label: '3/4' },
            { value: '6/8', label: '6/8' },
          ]}
        />
        <Choices
          label={labels.clicks}
          value={click}
          onChange={(c) => {
            player.stop();
            setClick(c);
          }}
          options={[
            { value: 'beats', label: labels.beats },
            { value: 'eighths', label: labels.eighths },
          ]}
        />
        <button
          type="button"
          className="button is-compact"
          onClick={() =>
            player.playing
              ? player.stop()
              : player.play(SIX_EIGHTHS, signature, 96, {
                  countIn: false,
                  subdivide: click === 'eighths',
                })
          }
        >
          <PlayGlyph />
          {player.playing ? copy('stop') : copy('listen')}
        </button>
      </div>
      <RhythmLine
        rhythm={SIX_EIGHTHS}
        time={signature}
        label={time}
        bracket
        current={player.playing ? player.current : null}
      />
    </>
  );
}

/** One note or rest on a line, for a question about how long it lasts. */
export function ValueCard({ beat, label }: { beat: Beat; label: string }) {
  return (
    <EngravedStaff
      system="rhythm"
      width={120}
      className="plate-staff is-card is-value"
      label={label}
      notes={[
        {
          id: 'v',
          pitch: beat.rest ? null : { letter: 'B', accidental: 0, octave: 4 },
          clef: 'treble',
          x: 54,
          duration: beat.duration,
          dotted: beat.dotted,
        },
      ]}
    />
  );
}

// Exercise.

/** In time when this close to the note, however far apart the notes are. */
const GOOD_MS = 110;
/** A tap further than this from a note is not taken for it. */
const WINDOW_MS = 220;

interface Judged {
  /** Per note: the tap's offset in ms, +∞ for a note missed, null for a rest or a tie's end. */
  offsets: (number | null)[];
  /** Per note: played in time. */
  inTime: boolean[];
}

/**
 * Matches taps to the notes that are struck. Each note takes the nearest tap within its window:
 * 220 ms, or half the gap to the nearer neighbouring note when they are closer (sixteenths), so
 * one tap never answers two notes. "In time" narrows with it.
 */
function judge(
  placed: readonly Placed[],
  start: number,
  msPerTick: number,
  taps: readonly number[],
): Judged {
  const left = [...taps];
  const struck = placed.map((b) => !b.rest && !b.held);
  const dues = placed.map((b) => start + b.at * msPerTick);
  const onsets = dues.filter((_, i) => struck[i]);
  const inTime: boolean[] = [];
  const offsets = placed.map((_, i) => {
    inTime.push(false);
    if (!struck[i]) return null;
    const due = dues[i]!;
    const gap = Math.min(
      ...onsets.filter((t) => t !== due).map((t) => Math.abs(t - due)),
      Number.POSITIVE_INFINITY,
    );
    const window = Math.min(WINDOW_MS, gap / 2);
    const good = Math.min(GOOD_MS, window * 0.75);
    let best = -1;
    for (let k = 0; k < left.length; k++) {
      if (
        Math.abs(left[k]! - due) <= window &&
        (best < 0 || Math.abs(left[k]! - due) < Math.abs(left[best]! - due))
      )
        best = k;
    }
    if (best < 0) return Number.POSITIVE_INFINITY;
    const off = left[best]! - due;
    left.splice(best, 1);
    inTime[i] = Math.abs(off) <= good;
    return off;
  });
  return { offsets, inTime };
}

/** Notes in time, notes in all, and the offsets of the notes played, over every bar's last run. */
function score(results: readonly (Judged | undefined)[]) {
  const offsets: number[] = [];
  let total = 0;
  let good = 0;
  for (const r of results) {
    if (!r) continue;
    r.offsets.forEach((o, i) => {
      if (o === null) return;
      total++;
      if (r.inTime[i]) good++;
      if (Number.isFinite(o)) offsets.push(o);
    });
  }
  return { good, total, offsets };
}

/** A bar (or two) to tap: a plain list of notes is in 4/4. */
export type TapRhythm = readonly Beat[] | { rhythm: readonly Beat[]; time: Time };

function tapItem(item: TapRhythm): { rhythm: readonly Beat[]; time: Time } {
  return 'rhythm' in item ? item : { rhythm: item, time: [4, 4] };
}

/**
 * Tap the rhythm: a bar of clicks to count in, then tap any key on each note while the click goes
 * on (in 6/8 the eighths click too). Every note is marked in time, early, late or missed. The tempo
 * is in quarter notes a minute.
 */
export function RhythmTap({
  rhythms,
  bpm = 66,
  prompt,
  bracket = false,
  onComplete,
}: {
  rhythms: readonly TapRhythm[];
  bpm?: number;
  prompt: string;
  /** Counts in brackets where nothing is played: "1 (2) & 3". */
  bracket?: boolean;
  onComplete?: () => void;
}) {
  const copy = useCopy();
  const exercise = useExercise();
  const [at, setAt] = useState(0);
  const [run, setRun] = useState<{ start: number; end: number } | null>(null);
  const [result, setResult] = useState<Judged | null>(null);
  // Each bar's last run: trying a bar again replaces its result.
  const [results, setResults] = useState<readonly Judged[]>([]);
  const taps = useRef<number[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const release = useRef<(() => void) | null>(null);
  const msPerTick = tickMs(bpm);
  const done = at >= rhythms.length;
  const { rhythm, time } = tapItem(rhythms[Math.min(at, rhythms.length - 1)]!);
  const meter = meterOf(time);
  const { placed, bars } = useMemo(() => layout(rhythm, meterOf(time)), [rhythm, time]);
  const count = useCountIndex(
    run ? run.start - meter.bar * msPerTick : null,
    msPerTick,
    meter.count,
  );

  const finish = useCallback(() => {
    clicks.stop(exercise.id);
    release.current?.();
    release.current = null;
  }, [exercise.id]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      finish();
    },
    [finish],
  );

  const go = () => {
    exercise.start();
    setResult(null);
    taps.current = [];
    const origin = performance.now() + LEAD_MS;
    const start = origin + meter.bar * msPerTick;
    const end = start + bars * meter.bar * msPerTick;
    clicks.start(
      exercise.id,
      clickSource(origin, msPerTick, meter, (bars + 1) * meter.bar, meter.compound),
    );
    release.current = beginPractice();
    setRun({ start, end });
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        finish();
        const judged = judge(placed, start, msPerTick, taps.current);
        setResults((all) => {
          const next = [...all];
          next[at] = judged;
          return next;
        });
        setResult(judged);
        setRun(null);
        exercise.stop();
      },
      end - performance.now() + WINDOW_MS + 60,
    );
  };

  useNoteOn((_midi, time) => {
    if (!run || !exercise.active) return;
    if (time >= run.start - WINDOW_MS && time <= run.end + WINDOW_MS) taps.current.push(time);
  });

  const next = () => {
    setResult(null);
    const n = at + 1;
    setAt(n);
    if (n >= rhythms.length) onComplete?.();
  };
  const restart = () => {
    setAt(0);
    setResult(null);
    setResults([]);
  };

  const tones = result?.offsets.map((o, i): Tone | undefined =>
    o === null ? undefined : !Number.isFinite(o) ? 'faint' : result.inTime[i] ? 'good' : 'bad',
  );
  const counting = run !== null && count !== null && count < meter.counts;
  const scores = score(results);
  const mean =
    scores.offsets.length === 0
      ? 0
      : scores.offsets.reduce((a, b) => a + b, 0) / scores.offsets.length;
  const tendency =
    Math.abs(mean) < 35 ? copy('tendsEven') : mean < 0 ? copy('tendsEarly') : copy('tendsLate');

  let message: string;
  if (done) message = copy('rhythmDone', { good: scores.good, total: scores.total, tendency });
  else if (counting) message = `${copy('countIn')} ${(count ?? 0) + 1}`;
  else if (run) message = copy('listening');
  else if (result) {
    const good = result.inTime.filter(Boolean).length;
    const notes = result.offsets.filter((o) => o !== null).length;
    message = copy('rhythmDone', { good, total: notes, tendency: '' }).trim();
  } else message = copy('ready');

  return (
    <ExerciseFrame
      active={exercise.active}
      prompt={prompt}
      progress={copy('progress', { n: Math.min(at + 1, rhythms.length), total: rhythms.length })}
      message={message}
      action={
        run
          ? null
          : done
            ? { label: copy('again'), onClick: restart }
            : result
              ? { label: copy('nextQuestion'), onClick: next }
              : { label: copy('start'), onClick: go }
      }
    >
      <CountDots counts={meter.counts} lit={run ? count : null} compound={meter.compound} />
      <RhythmLine rhythm={rhythm} time={time} label={prompt} tones={tones} bracket={bracket} />
      {result && (
        <button type="button" className="button-link retry" onClick={go}>
          {copy('again')}
        </button>
      )}
    </ExerciseFrame>
  );
}
