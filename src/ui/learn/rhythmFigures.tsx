import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { beginPractice } from '../../lib/shell.ts';
import type { ClickEvent } from '../../output/click.ts';
import { EngravedStaff } from '../engraving/EngravedStaff.tsx';
import { RhythmLine as EngravedRhythm, type Tone } from '../engraving/RhythmLine.tsx';
import {
  layout,
  meterOf,
  QUARTER,
  soundingTicks,
  type Beat,
  type Meter,
  type Placed,
  type Time,
} from '../engraving/rhythmLayout.ts';
import { sharedClickTrack } from '../pieces/useRhythmPlayer.ts';
import { ExerciseFrame, ExerciseLine } from './exercises.tsx';
import { Choices } from './kit.tsx';
import { useCopy, useExercise, useNoteOn, usePlayKey, useStaticPage } from './lesson.ts';

// The rhythm lessons: a beat to hear and tap along with, rhythms written on a single line with
// their counts under them, played back with the click, and an exercise that times your taps.
//
// Time is counted in ticks, twelve to a quarter note (`engraving/RhythmLine.tsx`), so that an
// eighth (6), a sixteenth (3) and an eighth of a triplet (4) are all whole numbers; every sound
// and every click is placed at `origin + ticks × ms per tick`, so nothing drifts, however long a
// rhythm runs.

export type { Beat, Time } from '../engraving/rhythmLayout.ts';

/**
 * A rhythm on one line, as the lessons write it (`engraving/RhythmLine.tsx`), its counts in the
 * lesson's language.
 */
export function RhythmLine(props: Omit<ComponentProps<typeof EngravedRhythm>, 'words'>) {
  const copy = useCopy();
  return <EngravedRhythm {...props} words={{ trip: copy('countTrip'), let: copy('countLet') }} />;
}

const NOTE_KEY = 72; // C5: what a rhythm plays on the built-in piano

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
  const staticPage = useStaticPage();
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

  // Tapping with the beat is an exercise: a page without scripts says so in its place.
  if (staticPage) return <ExerciseLine />;
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
  const staticPage = useStaticPage();
  const player = usePlayRhythm();
  const [playing, setPlaying] = useState<number | null>(null);
  return (
    <div className="rhythm-rows">
      {rows.map((row, i) => (
        <div key={row.title} className="rhythm-row">
          <div className="rhythm-row-head">
            <p>{row.title}</p>
            {!staticPage && (
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
            )}
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
  const staticPage = useStaticPage();
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
        {!staticPage && (
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
        )}
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
  const staticPage = useStaticPage();
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
        {!staticPage && (
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
        )}
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
