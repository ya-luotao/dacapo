import { useState } from 'react';
import { pitchToMidi } from '../../core/note.ts';
import { MAX_BPM, MIN_BPM } from '../../core/pulse.ts';
import { TEMPO_NAMES, tempoRange, tempoWord, type TempoName } from '../../core/tempoNames.ts';
import { PlayButton } from './kit.tsx';
import { usePlayNotes, useStaticPage, type TimedNote } from './lesson.ts';
import { pitch } from './notes.ts';
import { OrnamentStaff, type LineNote } from './ornamentFigures.tsx';

// The glossary's figures for tempo (docs/GLOSSARY.md): the metronome's tempo marks on its scale,
// each heard at its pace; beats slowing down, speeding up and coming back; and a pause held.

/** A beat's sound: a short, high key, the first of a run a little louder. */
const BEAT_KEY = 84; // C6
const BEAT_MS = 70;

/** Beats at the given times (ms from the start). */
const beatsAt = (times: readonly number[]): TimedNote[] =>
  times.map((at, i) => ({ midi: BEAT_KEY, at, ms: BEAT_MS, velocity: i === 0 ? 96 : 64 }));

/** Where a tempo sits across the scale, in per cent: by its logarithm, so the slow marks have room. */
const across = (bpm: number) =>
  ((Math.log(bpm) - Math.log(MIN_BPM)) / (Math.log(MAX_BPM) - Math.log(MIN_BPM))) * 100;

/** A tempo well inside a mark's range: its middle, or a little above the start of the last. */
function tempoInside(name: TempoName): number {
  const { from, to } = tempoRange(name);
  return to === null ? from + 20 : Math.round((from + to) / 2);
}

const TICKS = [20, 40, 60, 80, 120, 160, 200, 300] as const;
const BEATS = 8;

/**
 * The metronome's tempo marks, each a band over the range of beats a minute it covers, `mark`
 * picked out. Listen plays eight beats at a tempo inside the picked mark; in the app a mark is
 * picked, and heard, by pressing its row.
 */
export function TempoScale({ mark, label }: { mark: TempoName; label: string }) {
  const staticPage = useStaticPage();
  const player = usePlayNotes();
  const [shown, setShown] = useState<TempoName>(mark);
  const bpm = tempoInside(shown);
  const play = (name: TempoName) => {
    const step = 60_000 / tempoInside(name);
    player.play(beatsAt(Array.from({ length: BEATS }, (_, i) => i * step)));
  };
  const lit = player.lit.size > 0 ? Math.max(...player.lit) : null;

  return (
    <div className="tempo-band" role="group" aria-label={label}>
      <p className="plate-readout is-small">
        <span className="plate-readout-name">{tempoWord(shown)}</span>
        <span className="plate-readout-label">♩ = {bpm}</span>
      </p>
      <ol className="tempo-band-rows">
        {TEMPO_NAMES.map((name) => {
          const { from, to } = tempoRange(name);
          const left = across(from);
          const right = across(to === null ? MAX_BPM : to + 1);
          const body = (
            <>
              <span className="tempo-band-name">{tempoWord(name)}</span>
              <span className="tempo-band-track">
                <span
                  className="tempo-band-bar"
                  style={{ left: `${left}%`, width: `${right - left}%` }}
                />
              </span>
              <span className="tempo-band-range">{to === null ? `${from}+` : `${from}–${to}`}</span>
            </>
          );
          return (
            <li key={name} className={name === shown ? 'is-current' : undefined}>
              {staticPage ? (
                <div className="tempo-band-row">{body}</div>
              ) : (
                <button
                  type="button"
                  className="tempo-band-row"
                  aria-pressed={name === shown}
                  onClick={() => {
                    setShown(name);
                    play(name);
                  }}
                >
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="tempo-band-axis" aria-hidden="true">
        <span />
        <span className="tempo-band-ticks">
          {TICKS.map((tick) => (
            <span key={tick} style={{ left: `${across(tick)}%` }}>
              {tick}
            </span>
          ))}
        </span>
        <span />
      </div>
      <div className="plate-actions tempo-band-actions">
        <PlayButton onClick={() => play(shown)} />
        <span className="tempo-beats" aria-hidden="true">
          {Array.from({ length: BEATS }, (_, i) => (
            <span key={i} className={i === lit ? 'is-lit' : undefined} />
          ))}
        </span>
      </div>
    </div>
  );
}

export type TempoChangeKind = 'rit' | 'accel' | 'atempo';

/**
 * Each beat's time, in ms: four steady beats, then the change. A ritardando's beats each come a
 * little later than the last, an accelerando's a little sooner; a tempo slows for four and then
 * takes up the first pace again.
 */
function changeTimes(kind: TempoChangeKind): { times: number[]; words: [number, string][] } {
  const gaps: number[] = [];
  const steady = (n: number, ms: number) => {
    for (let i = 0; i < n; i++) gaps.push(ms);
  };
  const growing = (n: number, from: number, factor: number) => {
    for (let i = 1; i <= n; i++) gaps.push(Math.round(from * factor ** i));
  };
  let words: [number, string][];
  switch (kind) {
    case 'rit':
      steady(4, 500);
      growing(6, 500, 1.14);
      words = [[4, 'rit.']];
      break;
    case 'accel':
      steady(4, 700);
      growing(6, 700, 0.88);
      words = [[4, 'accel.']];
      break;
    case 'atempo':
      steady(4, 500);
      growing(4, 500, 1.16);
      steady(4, 500);
      words = [
        [4, 'rit.'],
        [8, 'a tempo'],
      ];
      break;
  }
  const times = [0];
  for (const gap of gaps) times.push(times.at(-1)! + gap);
  return { times, words };
}

/**
 * Beats as dots on a line, as far apart as they are in time: the gaps widen through a rit.,
 * close up through an accel., and are even again at a tempo. Listen plays them as they are drawn.
 */
export function TempoChange({ kind, label }: { kind: TempoChangeKind; label: string }) {
  const player = usePlayNotes();
  const { times, words } = changeTimes(kind);
  const width = 560;
  const end = times.at(-1)!;
  const x = (ms: number) => 24 + (ms / end) * (width - 48);
  return (
    <>
      <svg className="tempo-change" viewBox={`0 0 ${width} 72`} role="img" aria-label={label}>
        <line className="tempo-change-line" x1={12} x2={width - 12} y1={46} y2={46} />
        {words.map(([at, text]) => (
          <text key={text} className="tempo-change-word" x={x(times[at]!)} y={22}>
            {text}
          </text>
        ))}
        {times.map((at, i) => (
          <circle
            key={i}
            className={player.lit.has(i) ? 'tempo-change-beat is-lit' : 'tempo-change-beat'}
            cx={x(at)}
            cy={46}
            r={6}
          />
        ))}
      </svg>
      <div className="plate-actions">
        <PlayButton onClick={() => player.play(beatsAt(times))} />
      </div>
    </>
  );
}

/** A phrase that stops on a held note: four quarters' worth, the last note under a fermata. */
const PAUSE: readonly LineNote[] = [
  { pitch: 'C5', length: 8 },
  { pitch: 'B4', length: 8 },
  { pitch: 'A4', length: 8 },
  { pitch: 'G4', length: 8, fermata: true },
  { pitch: 'C5', length: 16 },
];

/** A 32nd, in ms: a quarter is about 85 a minute. */
const UNIT = 88;

/**
 * A short phrase with a fermata on its fourth note, heard held (twice its length and a breath) or
 * as if the sign were not there.
 */
export function FermataPhrase({
  label,
  labels,
}: {
  label: string;
  labels: { held: string; plain: string };
}) {
  const player = usePlayNotes();
  const play = (held: boolean) => {
    let at = 0;
    const notes: TimedNote[] = PAUSE.map((note) => {
      const length = note.length * UNIT * (held && note.fermata ? 2.2 : 1);
      const timed = {
        midi: pitchToMidi(pitch(note.pitch as string)),
        at,
        ms: Math.round(length - 30),
        velocity: 72,
      };
      at += length + (held && note.fermata ? 180 : 0);
      return timed;
    });
    player.play(notes);
  };
  return (
    <>
      <OrnamentStaff notes={PAUSE} lit={player.lit} label={label} />
      <div className="plate-actions">
        <PlayButton onClick={() => play(true)} label={labels.held} />
        <PlayButton onClick={() => play(false)} label={labels.plain} />
      </div>
    </>
  );
}
