import { useEffect, useMemo, useRef, useState } from 'react';
import { pitchToMidi } from '../../core/note.ts';
import { EngravedStaff, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { bodyStart, WHOLE_WIDTH } from '../engraving/geometry.ts';
import { PedalLine, PedalMark } from '../engraving/marks.tsx';
import { useInput } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { ExerciseFrame } from './exercises.tsx';
import { judgePedalChanges, pedalDownAt, type PedalChange, type PedalEvent } from './expression.ts';
import { Choices, PlayButton } from './kit.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import {
  useCopy,
  useElementWidth,
  useExercise,
  useKeyEvents,
  usePlayNotes,
  type TimedNote,
} from './lesson.ts';
import { pitch } from './notes.ts';

// Figures for the lesson on the pedals: four chords with the pedal marked (Ped. and the star, or a
// line with a notch at each change) and heard without it, held through and changed; legato
// pedalling on a timeline of keys, pedal and sound, from your keyboard or a demo; and the
// exercise, four chords with the pedal changed after each.

// Four chords on the grand staff, C, F, G and C.

const CHORDS: readonly { treble: readonly string[]; bass: string }[] = [
  { treble: ['E4', 'G4', 'C5'], bass: 'C3' },
  { treble: ['F4', 'A4', 'C5'], bass: 'F2' },
  { treble: ['D4', 'G4', 'B4'], bass: 'G2' },
  { treble: ['E4', 'G4', 'C5'], bass: 'C3' },
];
/** From one chord to the next, in ms. */
const CHORD_MS = 1500;
/** How long after a new chord the pedal comes up, when it is changed. */
const LIFT_MS = 150;

export type PedalUse = 'none' | 'held' | 'changed';
export type PedalMarks = 'signs' | 'line';

/** The chords as played: each note held as long as it sounds, with the pedal or without. */
function chordNotes(use: PedalUse): TimedNote[] {
  return CHORDS.flatMap((chord, k) => {
    const last = k === CHORDS.length - 1;
    const ms =
      use === 'none'
        ? CHORD_MS * 0.7
        : use === 'held'
          ? (CHORDS.length - k) * CHORD_MS
          : last
            ? CHORD_MS
            : CHORD_MS + LIFT_MS;
    return [...chord.treble, chord.bass].map((p) => ({
      midi: pitchToMidi(pitch(p)),
      at: k * CHORD_MS,
      ms: Math.round(ms),
      velocity: 70,
    }));
  });
}

/**
 * Four chords, C, F, G and C, on the grand staff: played without the pedal, with it held through,
 * or changed at each chord, and its marks as Ped. and the star or as a line.
 */
export function PedalledChords({
  uses,
  marks,
  labels,
  readouts,
  staffLabel,
}: {
  /** The ways to play it to choose from; the first is shown first. */
  uses: readonly PedalUse[];
  /** Both ways of marking it to choose from, or one. */
  marks: readonly PedalMarks[];
  labels: Partial<Record<PedalUse | PedalMarks, string>>;
  readouts?: Partial<Record<PedalUse, string>>;
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const [use, setUse] = useState<PedalUse>(uses[0]!);
  const [style, setStyle] = useState<PedalMarks>(marks[0]!);
  const width = 340;
  const start = bodyStart('grand') + 12;
  const unit = (width - 30 - start) / CHORDS.length;
  const xs = CHORDS.map((_, k) => start + k * unit + (unit - WHOLE_WIDTH) / 2);
  const lit = (k: number) => [...player.lit].some((i) => Math.floor(i / 4) === k);
  const notes: StaffNote[] = CHORDS.flatMap((chord, k) => [
    ...chord.treble.map((p, i): StaffNote => ({
      id: `t${k}${i}`,
      pitch: pitch(p),
      clef: 'treble',
      x: xs[k]!,
      duration: 'whole',
      tone: lit(k) ? 'accent' : 'ink',
    })),
    {
      id: `b${k}`,
      pitch: pitch(chord.bass),
      clef: 'bass',
      x: xs[k]!,
      duration: 'whole',
      tone: lit(k) ? 'accent' : 'ink',
    },
  ]);
  const bars = CHORDS.slice(1).map((_, k) => start + (k + 1) * unit);
  const lineY = 196;
  const end = width - 16;
  const tone = 'engraved-note is-ink';

  let pedal = null;
  if (use === 'held') {
    pedal =
      style === 'line' ? (
        <PedalLine x1={xs[0]!} x2={end} y={lineY} className={tone} />
      ) : (
        <g className={tone}>
          <PedalMark kind="down" x={xs[0]! - 2} y={lineY} />
          <PedalMark kind="up" x={end - 6} y={lineY} />
        </g>
      );
  } else if (use === 'changed') {
    // Each change a little after its chord: the pedal comes up once the new chord sounds.
    const changes = xs.slice(1).map((x) => x + WHOLE_WIDTH / 2);
    pedal =
      style === 'line' ? (
        <PedalLine x1={xs[0]!} x2={end} y={lineY} changes={changes} className={tone} />
      ) : (
        <g className={tone}>
          <PedalMark kind="down" x={xs[0]! - 2} y={lineY} />
          {changes.map((x) => (
            <g key={x}>
              <PedalMark kind="up" x={x - 11} y={lineY} />
              <PedalMark kind="down" x={x - 2} y={lineY} />
            </g>
          ))}
          <PedalMark kind="up" x={end - 6} y={lineY} />
        </g>
      );
  }

  return (
    <>
      <div className="plate-toolbar">
        {uses.length > 1 && (
          <Choices
            value={use}
            onChange={(next) => {
              setUse(next);
              player.stop();
            }}
            options={uses.map((u) => ({ value: u, label: labels[u]! }))}
          />
        )}
        {marks.length > 1 && (
          <Choices
            value={style}
            onChange={setStyle}
            options={marks.map((m) => ({ value: m, label: labels[m]! }))}
          />
        )}
      </div>
      {readouts?.[use] && (
        <p className="plate-readout is-small" aria-live="polite">
          <span className="plate-readout-label">{readouts[use]}</span>
        </p>
      )}
      <EngravedStaff
        system="grand"
        width={width}
        below={20}
        className="plate-staff is-grand"
        label={staffLabel}
        notes={notes}
        bars={bars}
      >
        {pedal}
      </EngravedStaff>
      <div className="plate-actions">
        <PlayButton onClick={() => player.play(chordNotes(use))} />
      </div>
    </>
  );
}

// Keys, pedal and sound on a timeline.

/** Three close chords for the right hand, C, F, G and C, in reach without moving. */
const HAND_CHORDS: readonly (readonly number[])[] = [
  [60, 64, 67],
  [60, 65, 69],
  [59, 62, 67],
  [60, 64, 67],
];

interface Key {
  midi: number;
  on: number;
  off: number | null;
}

interface Take {
  keys: readonly Key[];
  pedal: readonly PedalEvent[];
  /** When each chord was played: its last key down. */
  chords: readonly number[];
  start: number;
}

const EMPTY: Take = { keys: [], pedal: [], chords: [], start: 0 };

interface LaneMark {
  kind: 'gap' | 'blur' | 'clean';
  a: number;
  b: number;
  key: number;
}
/** Keys going down this close together are one chord. */
const CHORD_SPREAD_MS = 80;

/** A take with a key gone down: a new chord, or the chord it belongs to played later. */
function withKey(take: Take, midi: number, time: number): Take {
  const keys = [...take.keys, { midi, on: time, off: null }];
  const previous = take.keys.at(-1);
  const same = previous && time - previous.on < CHORD_SPREAD_MS && take.chords.length > 0;
  const chords = same ? [...take.chords.slice(0, -1), time] : [...take.chords, time];
  return { ...take, keys, chords };
}

function withKeyUp(take: Take, midi: number, time: number): Take {
  const i = take.keys.findLastIndex((k) => k.midi === midi && k.off === null);
  if (i < 0) return take;
  const keys = [...take.keys];
  keys[i] = { ...keys[i]!, off: time };
  return { ...take, keys };
}

/** When a key's sound ends: at its release, or when the pedal next comes up if it was down. */
function soundEnd(key: Key, pedal: readonly PedalEvent[], now: number): number {
  const off = key.off ?? now;
  if (!pedalDownAt(pedal, off)) return off;
  return pedal.find((e) => !e.down && e.time > off)?.time ?? now;
}

/** Keys, the pedal and what sounds, on one timeline, with each change's gap or blur marked. */
function PedalLanes({ take, now, end }: { take: Take; now: number; end?: number }) {
  const copy = useCopy();
  const [box, width] = useElementWidth<HTMLDivElement>(560);
  const left = 64;
  const t0 = take.start - 150;
  const last = Math.max(
    now,
    ...take.keys.map((k) => k.off ?? now),
    ...take.pedal.map((e) => e.time),
  );
  const t1 = Math.max(end ?? last + 300, t0 + 5200);
  const x = (t: number) =>
    left + ((Math.min(Math.max(t, t0), t1) - t0) / (t1 - t0)) * (width - left - 8);
  const rows = [...new Set(take.keys.map((k) => k.midi))].sort((a, b) => b - a);
  const keysTop = 6;
  const keysHeight = 40;
  const rowHeight = Math.min(8, keysHeight / Math.max(rows.length, 1));
  const pedalY = 60;
  const soundY = 86;
  const height = 124;
  const changes = judgePedalChanges(take.chords, take.pedal, now);

  // The pedal's down spans.
  const spans: [number, number][] = [];
  let downAt: number | null = null;
  for (const e of take.pedal) {
    if (e.down && downAt === null) downAt = e.time;
    else if (!e.down && downAt !== null) {
      spans.push([downAt, e.time]);
      downAt = null;
    }
  }
  if (downAt !== null) spans.push([downAt, now]);

  // Each chord's sound, from its first key to its last sound's end, in two rows so that chords
  // sounding together show as two bars one over the other.
  const sounds = take.chords.map((at, k) => {
    const from = take.chords[k - 1] ?? -Infinity;
    const keys = take.keys.filter((key) => key.on > from && key.on <= at);
    const begin = Math.min(...keys.map((key) => key.on));
    const stop = Math.max(...keys.map((key) => soundEnd(key, take.pedal, now)));
    return { begin, stop };
  });

  // A gap from the lift to the chord; a blur from the chord to the lift; a clean change's lift.
  const marks = changes.flatMap((change, i): LaneMark[] => {
    const at = take.chords[i + 1]!;
    const next = take.chords[i + 2] ?? now;
    switch (change.kind) {
      case 'early':
        return [{ kind: 'gap', a: at - change.ms, b: at, key: i }];
      case 'late':
        return [{ kind: 'blur', a: at, b: at + change.ms, key: i }];
      case 'held':
        return [{ kind: 'blur', a: at, b: next, key: i }];
      case 'clean':
        return [{ kind: 'clean', a: at + change.up, b: 0, key: i }];
      default:
        return [];
    }
  });

  return (
    <div className="pedal-lanes" ref={box}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy('pedalLane')}>
        <text className="pedal-lane-name" x={0} y={keysTop + keysHeight / 2}>
          {copy('keysLane')}
        </text>
        <text className="pedal-lane-name" x={0} y={pedalY + 5}>
          {copy('pedalLane')}
        </text>
        <text className="pedal-lane-name" x={0} y={soundY + 9}>
          {copy('soundLane')}
        </text>
        <line
          className="pedal-lane-rule"
          x1={left}
          x2={width - 8}
          y1={pedalY + 10}
          y2={pedalY + 10}
        />
        <line
          className="pedal-lane-rule"
          x1={left}
          x2={width - 8}
          y1={soundY + 20}
          y2={soundY + 20}
        />
        {take.keys.map((k, i) => (
          <rect
            key={i}
            className="pedal-key"
            x={x(k.on)}
            y={keysTop + rows.indexOf(k.midi) * rowHeight + 0.5}
            width={Math.max(2, x(k.off ?? now) - x(k.on))}
            height={rowHeight - 1}
            rx={1.5}
          />
        ))}
        {spans.map(([a, b]) => (
          <rect
            key={a}
            className="pedal-down"
            x={x(a)}
            y={pedalY}
            width={Math.max(2, x(b) - x(a))}
            height={10}
            rx={2}
          />
        ))}
        {sounds.map((s, k) =>
          Number.isFinite(s.begin) ? (
            <rect
              key={k}
              className="pedal-sound"
              x={x(s.begin)}
              y={soundY + (k % 2) * 10}
              width={Math.max(2, x(s.stop) - x(s.begin))}
              height={9}
              rx={2}
            />
          ) : null,
        )}
        {marks.map((m) =>
          m.kind === 'clean' ? (
            <circle key={m.key} className="pedal-mark is-clean" cx={x(m.a)} cy={pedalY + 5} r={3} />
          ) : (
            <g key={m.key} className={`pedal-mark is-${m.kind}`}>
              <rect
                x={x(m.a)}
                y={soundY - 2}
                width={Math.max(3, x(m.b) - x(m.a))}
                height={23}
                rx={2}
              />
              <text x={(x(m.a) + x(m.b)) / 2} y={soundY + 33} textAnchor="middle">
                {m.kind === 'gap' ? copy('gapMark') : copy('blurMark')}
              </text>
            </g>
          ),
        )}
      </svg>
    </div>
  );
}

/** Calls back every frame while `on`, with the time. */
function useClock(on: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!on) return;
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [on]);
  return now;
}

/**
 * Your keys and pedal as you play, a take at a time: after three seconds with nothing held and the
 * pedal up, the next key or pedal starts a new one.
 */
function useLiveTake(): Take {
  const [take, setTake] = useState<Take>(EMPTY);
  const lastEvent = useRef(0);
  useKeyEvents((event, demo) => {
    if (demo) return;
    const quiet = event.time - lastEvent.current > 3000;
    lastEvent.current = event.time;
    setTake((now) => {
      const idle = now.keys.every((k) => k.off !== null) && !(now.pedal.at(-1)?.down ?? false);
      let t = now.start === 0 || (idle && quiet) ? { ...EMPTY, start: event.time } : now;
      if (event.type === 'on') t = withKey(t, event.midi, event.time);
      else if (event.type === 'off') t = withKeyUp(t, event.midi, event.time);
      else if (event.type === 'sustain')
        t = { ...t, pedal: [...t.pedal, { down: event.down, time: event.time }] };
      return t;
    });
  });
  return take;
}

/** A take as far as `time`: what had happened by then. */
function upTo(take: Take, time: number): Take {
  return {
    ...take,
    keys: take.keys
      .filter((k) => k.on <= time)
      .map((k) => (k.off !== null && k.off > time ? { ...k, off: null } : k)),
    pedal: take.pedal.filter((e) => e.time <= time),
    chords: take.chords.filter((c) => c <= time),
  };
}

export type PedalDemo = 'clean' | 'early' | 'late';

/** A demo of four chords, the fingers leaving each a little before the next, the pedal changed. */
function demoTake(kind: PedalDemo, start: number): Take {
  const gap = 1200;
  const keys: Key[] = HAND_CHORDS.flatMap((chord, k) =>
    chord.map((midi) => ({ midi, on: start + k * gap, off: start + k * gap + gap - 220 })),
  );
  const pedal: PedalEvent[] = [{ down: true, time: start + 250 }];
  for (let k = 1; k < HAND_CHORDS.length; k++) {
    const at = start + k * gap;
    const [up, down] =
      kind === 'clean'
        ? [at + 110, at + 250]
        : kind === 'early'
          ? [at - 180, at + 150]
          : [at + 620, at + 760];
    pedal.push({ down: false, time: up }, { down: true, time: down });
  }
  pedal.push({ down: false, time: start + HAND_CHORDS.length * gap + 300 });
  return {
    keys,
    pedal,
    chords: HAND_CHORDS.map((_, k) => start + k * gap),
    start,
  };
}

/** What the demo sounds like: each key held as long as it rings, the pedal's part included. */
function demoNotes(take: Take): TimedNote[] {
  const end = take.pedal.at(-1)!.time;
  return take.keys.map((k) => ({
    midi: k.midi,
    at: k.on - take.start,
    ms: Math.max(80, soundEnd(k, take.pedal, end) - k.on),
    velocity: 64,
  }));
}

/**
 * Legato pedalling on a timeline: keys, the pedal and what sounds. Watch plays four chords with the
 * pedal changed in time, too early or too late; playing on your own keyboard and pedal, it follows
 * you instead.
 */
export function LegatoPedalling({
  labels,
  readouts,
  live,
}: {
  labels: Record<PedalDemo, string> & { watch: string };
  readouts: Record<PedalDemo, string>;
  /** Said over the timeline while it follows your playing. */
  live: string;
}) {
  const player = usePlayNotes();
  const [kind, setKind] = useState<PedalDemo>('clean');
  const [demo, setDemo] = useState<Take>(() => demoTake('clean', 0));
  const take = useLiveTake();
  const playing = player.started !== null;
  // Played since the demo: the timeline follows you.
  const following = take.start > demo.start && !playing;
  const holding = take.keys.some((k) => k.off === null) || (take.pedal.at(-1)?.down ?? false);
  const now = useClock(playing || (following && holding));
  const demoEnd = demo.pedal.at(-1)!.time + 200;

  const watch = (next: PedalDemo) => {
    const run = demoTake(next, performance.now());
    setDemo(run);
    player.play(demoNotes(run));
  };

  return (
    <>
      <div className="plate-toolbar">
        <Choices
          value={kind}
          onChange={(next) => {
            setKind(next);
            watch(next);
          }}
          options={(['clean', 'early', 'late'] as const).map((k) => ({
            value: k,
            label: labels[k],
          }))}
        />
        <PlayButton onClick={() => watch(kind)} label={labels.watch} />
      </div>
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-label">{following ? live : readouts[kind]}</span>
      </p>
      {following ? (
        <PedalLanes take={take} now={now} />
      ) : (
        <PedalLanes
          take={playing ? upTo(demo, now) : demo}
          now={playing ? now : demoEnd}
          end={demoEnd}
        />
      )}
    </>
  );
}

// The exercise.

/**
 * Four chords with the pedal changed after each: judged on when it comes up after each new chord
 * and how soon it goes down again. It needs a sustain pedal on a MIDI keyboard, so it can always be
 * skipped; the lesson ends with an exercise everyone can do.
 */
export function PedalExercise({
  prompt,
  verdicts,
  summary,
  needsPedal,
  skipTo,
}: {
  prompt: string;
  /** What each change was, with {n} (which change) and {ms}, {up}, {down}. */
  verdicts: Record<PedalChange['kind'], string>;
  /** When all are done: {clean} of {total} changes clean. */
  summary: string;
  needsPedal: string;
  skipTo: string;
}) {
  const copy = useCopy();
  const { hub } = useInput();
  const exercise = useExercise();
  const fallback = useKeyboardFallback();
  const [take, setTake] = useState<Take | null>(null);
  const chordCount = take?.chords.length ?? 0;
  const pedalNow = take?.pedal.at(-1)?.down ?? false;
  const now = useClock(exercise.active || pedalNow);
  const changes = take ? judgePedalChanges(take.chords, take.pedal, now) : [];
  const decided =
    changes.length === HAND_CHORDS.length - 1 && changes.every((c) => c.kind !== 'pending');
  const target = HAND_CHORDS[Math.min(chordCount, HAND_CHORDS.length - 1)]!;

  // A chord counts once all its keys are down together; it is played when the last one goes down.
  useKeyEvents((event, demo) => {
    if (!exercise.active || demo) return;
    // The keys held now, this key included: the hub has taken it in before telling anyone.
    const down = new Set(hub.getState().held.keys());
    setTake((t) => {
      if (!t) return t;
      if (event.type === 'sustain') {
        return { ...t, pedal: [...t.pedal, { down: event.down, time: event.time }] };
      }
      if (event.type === 'off') return withKeyUp(t, event.midi, event.time);
      const keys = [...t.keys, { midi: event.midi, on: event.time, off: null }];
      const chord = HAND_CHORDS[t.chords.length];
      const complete = chord !== undefined && chord.every((m) => down.has(m));
      return { ...t, keys, chords: complete ? [...t.chords, event.time] : t.chords };
    });
  });

  useEffect(() => {
    if (decided && exercise.active) exercise.stop();
  }, [decided, exercise]);

  const start = () => {
    const time = performance.now();
    setTake({ keys: [], pedal: [{ down: hub.getState().sustain, time }], chords: [], start: time });
    exercise.start();
  };
  const skip = () => {
    exercise.stop();
    document.getElementById(skipTo)?.scrollIntoView({
      behavior: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  };
  const clean = changes.filter((c) => c.kind === 'clean').length;
  const marked = useMemo(
    () =>
      exercise.active && chordCount < HAND_CHORDS.length ? new Set(target) : new Set<number>(),
    [exercise.active, chordCount, target],
  );
  const says = (c: PedalChange, i: number) => {
    const vars: Record<string, number> = { n: i + 1 };
    if ('ms' in c) vars.ms = c.ms;
    if (c.kind === 'clean') Object.assign(vars, { up: c.up, down: c.down });
    return verdicts[c.kind].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
  };

  return (
    <ExerciseFrame
      active={exercise.active}
      keys={false}
      prompt={prompt}
      progress={copy('chordProgress', {
        n: Math.min(chordCount + 1, HAND_CHORDS.length),
        total: HAND_CHORDS.length,
      })}
      message={
        decided
          ? summary.replace('{clean}', String(clean)).replace('{total}', String(changes.length))
          : exercise.active
            ? copy('listening')
            : copy('ready')
      }
      action={
        exercise.active ? null : { label: take ? copy('again') : copy('start'), onClick: start }
      }
    >
      {take && take.chords.length > 0 && <PedalLanes take={take} now={now} />}
      {changes.length > 0 && (
        <ol className="pedal-changes">
          {changes.map((c, i) => (
            <li key={i} className={`is-${c.kind}`}>
              {says(c, i)}
            </li>
          ))}
        </ol>
      )}
      <LessonPiano range={[48, 71]} marked={marked} />
      <div className="exercise-skip">
        {fallback && <p className="plate-note">{needsPedal}</p>}
        <button type="button" className="button is-compact" onClick={skip}>
          {copy('skip')}
        </button>
      </div>
    </ExerciseFrame>
  );
}
