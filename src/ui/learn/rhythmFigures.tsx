import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { beginPractice } from '../../lib/shell.ts';
import type { ClickEvent } from '../../output/click.ts';
import {
  EngravedStaff,
  type Duration,
  type StaffLabel,
  type StaffNote,
} from '../engraving/EngravedStaff.tsx';
import { bodyStart, HEAD_WIDTH, STEM_WIDTH, stemTop } from '../engraving/geometry.ts';
import { sharedClickTrack } from '../pieces/useRhythmPlayer.ts';
import { ExerciseFrame } from './exercises.tsx';
import { Choices } from './kit.tsx';
import { useCopy, useExercise, useNoteOn, usePlayKey } from './lesson.ts';

// The rhythm lesson: a beat to hear and tap along with, rhythms written on a single line with
// their counts under them, played back with the click, and an exercise that times your taps.

export interface Beat {
  duration: Duration;
  dotted?: boolean;
  rest?: boolean;
}

const BEATS: Record<Duration, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5 };
const BEAT_WIDTH = 64;
const NOTE_KEY = 72; // C5: what a rhythm plays on the built-in piano

function beatsOf(b: Beat): number {
  return BEATS[b.duration] * (b.dotted ? 1.5 : 1);
}

interface Placed extends Beat {
  /** Where it starts, in beats from the start. */
  at: number;
}

function place(rhythm: readonly Beat[]): Placed[] {
  let at = 0;
  return rhythm.map((b) => {
    const placed = { ...b, at };
    at += beatsOf(b);
    return placed;
  });
}

/** What a rhythm occupies: its notes placed in beats, its length, where its bars end. */
function layout(rhythm: readonly Beat[], perBar: number) {
  const placed = place(rhythm);
  const total = placed.length === 0 ? 0 : placed.at(-1)!.at + beatsOf(placed.at(-1)!);
  const bars = Math.max(1, Math.ceil(total / perBar - 1e-9));
  return { placed, total, bars };
}

/**
 * A rhythm on one line: time signature, notes spaced by how long they last, eighths beamed in
 * pairs within a beat, the count under each beat ("1 & 2 &" when there are eighths).
 */
export function RhythmLine({
  rhythm,
  time = [4, 4],
  label,
  current = null,
  tones,
  counts = true,
}: {
  rhythm: readonly Beat[];
  time?: readonly [number, number];
  label: string;
  /** The note sounding, drawn in the accent. */
  current?: number | null;
  /** A colour for each note, after an exercise run. */
  tones?: readonly (StaffNote['tone'] | undefined)[];
  counts?: boolean;
}) {
  const perBar = time[0];
  const { placed, bars } = layout(rhythm, perBar);
  const x0 = bodyStart('rhythm', 0, true);
  // Two bars or more are set closer, so they stay legible at a phone's width.
  const beatWidth = bars > 1 ? 46 : BEAT_WIDTH;
  const xAt = (beat: number) => x0 + beat * beatWidth + 8;
  const width = x0 + bars * perBar * beatWidth + 24;
  const notes: StaffNote[] = placed.map((b, i) => ({
    id: `${i}`,
    pitch: b.rest ? null : { letter: 'B', accidental: 0, octave: 4 },
    clef: 'treble',
    x: xAt(b.at),
    duration: b.duration,
    dotted: b.dotted,
    flag: false,
    tone: tones?.[i] ?? (current === i ? 'accent' : 'ink'),
  }));
  const barlines = Array.from({ length: bars - 1 }, (_, i) => xAt((i + 1) * perBar) - 14);
  const hasEighths = placed.some((b) => b.duration === 'eighth');
  const labels: StaffLabel[] = [];
  if (counts) {
    for (let beat = 0; beat < bars * perBar; beat += hasEighths ? 0.5 : 1) {
      labels.push({
        clef: 'treble',
        position: -1,
        x: xAt(beat) + HEAD_WIDTH / 2,
        text: Number.isInteger(beat) ? String((beat % perBar) + 1) : '&',
      });
    }
  }
  // Eighths beamed in pairs: an eighth on a beat followed by one on its "&".
  const beams: [number, number][] = [];
  const flags: number[] = [];
  placed.forEach((b, i) => {
    if (b.duration !== 'eighth' || b.rest) return;
    const next = placed[i + 1];
    const prev = placed[i - 1];
    if (
      Number.isInteger(b.at) &&
      next?.duration === 'eighth' &&
      !next.rest &&
      next.at === b.at + 0.5
    ) {
      beams.push([i, i + 1]);
    } else if (!(prev && beams.some(([, end]) => end === i))) {
      flags.push(i);
    }
  });
  for (const i of flags) notes[i] = { ...notes[i]!, flag: true };

  return (
    <EngravedStaff
      system="rhythm"
      width={width}
      className="plate-staff is-rhythm"
      label={label}
      time={time}
      notes={notes}
      bars={barlines}
      labels={labels}
    >
      {beams.map(([a, b]) => {
        const from = stemTop('rhythm', notes[a]!.x);
        const to = stemTop('rhythm', notes[b]!.x);
        const tone = notes[a]!.tone === notes[b]!.tone ? notes[a]!.tone : 'ink';
        return (
          <rect
            key={a}
            className={`engraved-note is-${tone ?? 'ink'} engraved-beam`}
            x={from.x - STEM_WIDTH}
            y={from.y}
            width={to.x - from.x + STEM_WIDTH}
            height={5}
          />
        );
      })}
    </EngravedStaff>
  );
}

/** The clicks of a steady beat from `origin`, accenting the first of each bar. */
function beatSource(origin: number, period: number, perBar: number, count: number | null) {
  return (from: number, to: number): ClickEvent[] => {
    const clicks: ClickEvent[] = [];
    const first = Math.max(0, Math.ceil((from - origin) / period));
    for (let i = first; ; i++) {
      if (count !== null && i >= count) break;
      const time = origin + i * period;
      if (time >= to) break;
      clicks.push({ time, accent: i % perBar === 0 });
    }
    return clicks;
  };
}

/** How many beats have gone by since `origin` (negative before it), every frame while it runs. */
function useBeatPosition(origin: number | null, period: number): number | null {
  const [position, setPosition] = useState<number | null>(null);
  useEffect(() => {
    if (origin === null) return;
    let frame = 0;
    const tick = () => {
      setPosition((performance.now() - origin) / period);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      setPosition(null);
    };
  }, [origin, period]);
  return position;
}

/** The beat sounding (0 for the first), or null before it and when stopped. */
function useBeatIndex(origin: number | null, period: number): number | null {
  const position = useBeatPosition(origin, period);
  return position === null || position < 0 ? null : Math.floor(position);
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
  const [run, setRun] = useState<{ origin: number; period: number; placed: Placed[] } | null>(null);
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

  const play = (rhythm: readonly Beat[], bpm: number, perBar: number, countIn = true) => {
    stop();
    const period = 60_000 / bpm;
    const lead = countIn ? perBar : 0;
    const origin = performance.now() + LEAD_MS;
    const { placed, bars } = layout(rhythm, perBar);
    const total = lead + bars * perBar;
    clicks.start(id, beatSource(origin, period, perBar, total));
    const start = origin + lead * period;
    for (const b of placed) {
      if (b.rest) continue;
      const at = start + b.at * period - performance.now();
      timers.current.push(
        setTimeout(() => playKey(NOTE_KEY, Math.max(120, beatsOf(b) * period - 60)), at),
      );
    }
    timers.current.push(setTimeout(stop, start + bars * perBar * period - performance.now() + 200));
    setRun({ origin: start, period, placed });
  };

  const position = useBeatPosition(run?.origin ?? null, run?.period ?? 1);
  let current: number | null = null;
  if (run && position !== null) {
    run.placed.forEach((b, i) => {
      if (!b.rest && position >= b.at && position < b.at + beatsOf(b)) current = i;
    });
  }
  return { play, stop, playing: run !== null, current };
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
    clicks.start(exercise.id, beatSource(at, period, 4, null));
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

  const beat = useBeatIndex(running ? origin : null, period);
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

/** Rhythms to hear: each written on a line, played with a bar of clicks to count in. */
export function RhythmRows({
  rows,
  bpm = 72,
}: {
  rows: readonly { title: string; rhythm: readonly Beat[]; time?: readonly [number, number] }[];
  bpm?: number;
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
                player.play(row.rhythm, bpm, (row.time ?? [4, 4])[0]);
              }}
            >
              <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
                <path d="M1 1l8 5-8 5z" />
              </svg>
              {player.playing && playing === i ? copy('stop') : copy('listen')}
            </button>
          </div>
          <RhythmLine
            rhythm={row.rhythm}
            time={row.time}
            label={row.title}
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
          onClick={() => (player.playing ? player.stop() : player.play(rhythm, 88, perBar, false))}
        >
          <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
            <path d="M1 1l8 5-8 5z" />
          </svg>
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

const GOOD_MS = 110;
const WINDOW_MS = 220;

interface Judged {
  offsets: (number | null)[];
}

function judge(
  placed: readonly Placed[],
  start: number,
  period: number,
  taps: readonly number[],
): Judged {
  const left = [...taps];
  const offsets = placed.map((b) => {
    if (b.rest) return null;
    const due = start + b.at * period;
    let best = -1;
    for (let i = 0; i < left.length; i++) {
      if (
        Math.abs(left[i]! - due) <= WINDOW_MS &&
        (best < 0 || Math.abs(left[i]! - due) < Math.abs(left[best]! - due))
      )
        best = i;
    }
    if (best < 0) return Number.POSITIVE_INFINITY;
    const off = left[best]! - due;
    left.splice(best, 1);
    return off;
  });
  return { offsets };
}

/** Notes in time, notes in all, and the offsets of the notes played, over every bar's last run. */
function score(results: readonly (Judged | undefined)[]) {
  const offsets: number[] = [];
  let total = 0;
  for (const r of results) {
    if (!r) continue;
    for (const o of r.offsets) {
      if (o === null) continue;
      total++;
      if (Number.isFinite(o)) offsets.push(o);
    }
  }
  return { good: offsets.filter((o) => Math.abs(o) <= GOOD_MS).length, total, offsets };
}

/**
 * Tap the rhythm: a bar of clicks to count in, then tap any key on each note while the click goes
 * on. Every note is marked in time, early, late or missed.
 */
export function RhythmTap({
  rhythms,
  bpm = 66,
  prompt,
  onComplete,
}: {
  rhythms: readonly (readonly Beat[])[];
  bpm?: number;
  prompt: string;
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
  const period = 60_000 / bpm;
  const done = at >= rhythms.length;
  const rhythm = rhythms[Math.min(at, rhythms.length - 1)]!;
  const { placed, bars } = useMemo(() => layout(rhythm, 4), [rhythm]);
  const beat = useBeatIndex(run ? run.start - 4 * period : null, period);

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
    const start = origin + 4 * period;
    const end = start + bars * 4 * period;
    clicks.start(exercise.id, beatSource(origin, period, 4, 4 + bars * 4));
    release.current = beginPractice();
    setRun({ start, end });
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        finish();
        const judged = judge(placed, start, period, taps.current);
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

  const tones = result?.offsets.map((o) =>
    o === null
      ? undefined
      : !Number.isFinite(o)
        ? 'faint'
        : Math.abs(o) <= GOOD_MS
          ? 'good'
          : 'bad',
  );
  const counting = run !== null && beat !== null && beat < 4;
  const scores = score(results);
  const mean =
    scores.offsets.length === 0
      ? 0
      : scores.offsets.reduce((a, b) => a + b, 0) / scores.offsets.length;
  const tendency =
    Math.abs(mean) < 35 ? copy('tendsEven') : mean < 0 ? copy('tendsEarly') : copy('tendsLate');

  let message: string;
  if (done) message = copy('rhythmDone', { good: scores.good, total: scores.total, tendency });
  else if (counting) message = `${copy('countIn')} ${(beat ?? 0) + 1}`;
  else if (run) message = copy('listening');
  else if (result) {
    const good = result.offsets.filter(
      (o) => o !== null && Number.isFinite(o) && Math.abs(o) <= GOOD_MS,
    ).length;
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
      <div className="lesson-beats is-small" aria-hidden="true">
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
      <RhythmLine rhythm={rhythm} label={prompt} tones={tones} />
      {result && (
        <button type="button" className="button-link retry" onClick={go}>
          {copy('again')}
        </button>
      )}
    </ExerciseFrame>
  );
}
