import { useEffect, useState } from 'react';
import { baseTempo, performedNotes, timeline } from '../../core/playback.ts';
import { performanceOrder } from '../../core/repeats.ts';
import type { Score } from '../../core/score.ts';
import { loadBuiltIn, type BuiltInId } from '../../pieces/library/index.ts';
import { readScore } from '../../pieces/load.ts';
import { Choices, PlayButton } from './kit.tsx';
import { useCopy, useElementWidth, usePlayNotes, type TimedNote } from './lesson.ts';
import {
  FORMS,
  PERIOD_SPANS,
  PERIODS,
  COMPOSERS,
  formSegments,
  type ComposerId,
  type FormName,
  type Period,
} from './styles.ts';

// Figures for the lesson on styles and forms: the periods on a timeline with the library's
// composers; a passage of a library piece, played from its own file; and a piece's form as a row
// of its sections, bar by bar, repeats played, each section heard alone or all in turn.

const VELOCITY = 72;

/** Scores already read, so a figure opened twice reads its file once. */
const scores = new Map<BuiltInId, Promise<Score>>();

function libraryScore(id: BuiltInId): Promise<Score> {
  let score = scores.get(id);
  if (!score) {
    score = loadBuiltIn(id).then((xml) => readScore(xml));
    scores.set(id, score);
  }
  return score;
}

/** A library piece's score, read from its file when the figure first needs it. */
function useLibraryScore(id: BuiltInId): Score | null {
  const [loaded, setLoaded] = useState<{ id: BuiltInId; score: Score } | null>(null);
  useEffect(() => {
    let live = true;
    void libraryScore(id).then((score) => {
      if (live) setLoaded({ id, score });
    });
    return () => {
      live = false;
    };
  }, [id]);
  return loaded?.id === id ? loaded.score : null;
}

/**
 * The notes of the played bars `first`–`last` (positions in the order the piece is played, its
 * repeats unrolled), both hands, at `bpm` quarter notes a minute, from the first of them.
 */
function passage(score: Score, first: number, last: number, bpm: number): TimedNote[] {
  const order = performanceOrder(score.measures);
  const ms = timeline(score, order, bpm / baseTempo(score));
  const zero = ms(order[first]!.start);
  return performedNotes(score, order, (n) => n.hand !== null, first, last).map((n) => ({
    midi: n.midi,
    at: Math.round(ms(n.on) - zero),
    ms: Math.max(60, Math.round(ms(n.off) - ms(n.on)) - 25),
    velocity: VELOCITY,
  }));
}

/** Positions in the play order of the written bars numbered `from` to `to`, the first time through. */
function firstPass(score: Score, from: string, to: string): [number, number] {
  const order = performanceOrder(score.measures);
  const at = (n: string) => order.findIndex((p) => score.measures[p.measure]!.number === n);
  return [at(from), at(to)];
}

/**
 * A passage of a piece in the library, played from its file: a button to hear it (or stop it), and
 * where it comes from.
 */
export function Excerpt({
  piece,
  from,
  to,
  bpm,
  label,
  source,
}: {
  piece: BuiltInId;
  /** Written bar numbers, as printed. */
  from: string;
  to: string;
  bpm: number;
  label?: string;
  /** Said under the button: the piece and the bars. */
  source?: string;
}) {
  const copy = useCopy();
  const score = useLibraryScore(piece);
  const player = usePlayNotes();
  const [length, setLength] = useState(0);
  const playing = player.started !== null;
  const play = () => {
    if (!score) return;
    if (playing) {
      player.stop();
      return;
    }
    const [first, last] = firstPass(score, from, to);
    const notes = passage(score, first, last, bpm);
    setLength(Math.max(0, ...notes.map((n) => n.at + n.ms)));
    player.play(notes);
  };
  return (
    <div className="excerpt">
      <PlayButton onClick={play} label={playing ? copy('stop') : (label ?? copy('listen'))} />
      {source && <p className="excerpt-source">{source}</p>}
      {/* How far through it is: a bar that fills in the time the passage takes. */}
      <div className="excerpt-track" aria-hidden="true">
        {playing && <span style={{ animationDuration: `${length}ms` }} />}
      </div>
    </div>
  );
}

// The periods.

/** Roughly how wide a label is at 11px: wide for Chinese, Japanese and Korean, narrow otherwise. */
function textWidth(text: string): number {
  let width = 0;
  for (const ch of text) width += /[\u2e80-\uffff]/.test(ch) ? 11 : 6.3;
  return width;
}

/**
 * The periods from 1600 on a line of years, each a band, and under them the life of each
 * composer in the library. Drawn a unit to a pixel at the width it is given.
 */
export function PeriodTimeline({
  labels,
  composers,
  label,
}: {
  labels: Record<Period, string>;
  composers: Record<ComposerId, string>;
  label: string;
}) {
  const [box, width] = useElementWidth<HTMLDivElement>(640);
  const [picked, setPicked] = useState<Period | null>(null);
  const from = 1600;
  const to = 1950;
  const left = 8;
  const right = width - 8;
  const x = (year: number) => left + ((year - from) / (to - from)) * (right - left);
  const bandTop = 18;
  const bandHeight = 34;
  const rowTop = bandTop + bandHeight + 12;
  const row = 20;
  const height = rowTop + COMPOSERS.length * row + 18;
  const decades = [1600, 1650, 1700, 1750, 1800, 1850, 1900, 1950];
  const narrow = width < 480;
  return (
    <div className="period-timeline" ref={box}>
      <Choices<Period | 'all'>
        className="is-grid"
        label={label}
        value={picked ?? 'all'}
        onChange={(next) => setPicked(next === 'all' ? null : next)}
        options={PERIODS.map((p, i) => ({
          value: p,
          label: (
            <>
              <i className={`period-swatch is-${i}`} aria-hidden="true" />
              {labels[p]}
            </>
          ),
        }))}
      />
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {decades.map((year) => (
          <g key={year}>
            <line className="period-rule" x1={x(year)} x2={x(year)} y1={12} y2={height - 14} />
            {(!narrow || year % 100 === 0) && (
              <text className="period-year" x={x(year)} y={height - 2} textAnchor="middle">
                {year}
              </text>
            )}
          </g>
        ))}
        {PERIODS.map((p, i) => {
          const [a, b] = PERIOD_SPANS[p];
          const on = picked === null || picked === p;
          return (
            <g
              key={p}
              className={`period-band is-${i}${on ? ' is-on' : ''}`}
              onClick={() => setPicked(picked === p ? null : p)}
            >
              <rect
                x={x(a)}
                y={bandTop + (i % 2) * 4}
                width={x(b) - x(a)}
                height={bandHeight - 4}
                rx={3}
              />
              {textWidth(labels[p]) < x(b) - x(a) - 12 && (
                <text x={x(a) + 6} y={bandTop + (i % 2) * 4 + (bandHeight - 4) / 2}>
                  {labels[p]}
                </text>
              )}
            </g>
          );
        })}
        {COMPOSERS.map((c, i) => {
          const y = rowTop + i * row;
          const on = picked === null || picked === c.period;
          const end = x(c.died);
          const name = composers[c.id];
          const nameLeft = end + 6 + textWidth(name) > right;
          return (
            <g key={c.id} className={on ? 'period-life is-on' : 'period-life'}>
              <line x1={x(c.born)} x2={end} y1={y} y2={y} />
              <circle cx={x(c.born)} cy={y} r={2.5} />
              <circle cx={end} cy={y} r={2.5} />
              <text
                x={nameLeft ? x(c.born) - 6 : end + 6}
                y={y}
                textAnchor={nameLeft ? 'end' : 'start'}
              >
                {name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Forms.

/**
 * A piece's form as a row of its sections in the order they are played (repeats and all), each
 * as long as its bars: hear one, or the whole piece with the section sounding lit.
 */
export function FormTimeline({
  forms,
  labels,
  readouts,
}: {
  forms: readonly FormName[];
  labels: Record<FormName, string>;
  readouts: Record<FormName, string>;
}) {
  const copy = useCopy();
  const [form, setForm] = useState<FormName>(forms[0]!);
  const spec = FORMS[form];
  const score = useLibraryScore(spec.piece);
  const player = usePlayNotes();
  const [playing, setPlaying] = useState<{ first: number; starts: number[] } | null>(null);
  const segments = score ? formSegments(score, spec.starts) : [];
  // Which segment is sounding: the last one whose start has passed.
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (player.started === null) return;
    const started = player.started;
    const timer = setInterval(() => setNow(performance.now() - started), 100);
    return () => clearInterval(timer);
  }, [player.started]);
  let current: number | null = null;
  if (playing && player.started !== null) {
    playing.starts.forEach((at, i) => {
      if (now >= at) current = playing.first + i;
    });
  }

  const play = (first: number, last: number) => {
    if (!score) return;
    const order = performanceOrder(score.measures);
    const ms = timeline(score, order, spec.bpm / baseTempo(score));
    const zero = ms(order[segments[first]!.first]!.start);
    const starts = segments.slice(first, last + 1).map((s) => ms(order[s.first]!.start) - zero);
    setNow(0);
    setPlaying({ first, starts });
    player.play(passage(score, segments[first]!.first, segments[last]!.last, spec.bpm));
  };
  const letters = [...new Set(segments.map((s) => s.label.replace(/[′″]/g, '')))];

  return (
    <>
      <Choices
        className={forms.length > 3 ? 'is-grid' : undefined}
        value={form}
        onChange={(next) => {
          setForm(next);
          setPlaying(null);
          player.stop();
        }}
        options={forms.map((f) => ({ value: f, label: labels[f] }))}
      />
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">{segments.map((s) => s.label).join(' ')}</span>
        <span className="plate-readout-label">{readouts[form]}</span>
      </p>
      <ol className="form-row" aria-label={labels[form]}>
        {segments.map((s, i) => (
          <li
            key={i}
            style={{ flexGrow: s.ticks }}
            className={`form-part is-${letters.indexOf(s.label.replace(/[′″]/g, '')) % 4}${
              current === i ? ' is-current' : ''
            }`}
          >
            <button type="button" onClick={() => play(i, i)}>
              <b>{s.label}</b>
              <span>{s.from === s.to ? s.from : `${s.from}–${s.to}`}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="plate-actions">
        {player.started === null ? (
          <PlayButton onClick={() => play(0, segments.length - 1)} />
        ) : (
          <button type="button" className="button is-compact" onClick={player.stop}>
            {copy('stop')}
          </button>
        )}
      </div>
    </>
  );
}
