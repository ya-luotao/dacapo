import { useState } from 'react';
import { pitchToMidi } from '../../core/note.ts';
import { EngravedStaff, type Duration, type StaffNote } from '../engraving/EngravedStaff.tsx';
import { bodyStart, HEAD_WIDTH } from '../engraving/geometry.ts';
import { formatMessage } from '../../i18n/locale.ts';
import { Choices } from './kit.tsx';
import { LessonPiano } from './LessonPiano.tsx';
import { keyName, usePlayNotes, useStaticPage } from './lesson.ts';
import { pitch } from './notes.ts';
import { splitMinutes, tempoLadder } from './practice.ts';

// Figures for the lesson on practising: a phrase climbing a ladder of tempos to the one you aim
// for, and a practice session of any length split into its parts.

/** The Ode to Joy, its first four bars: pitch and length in beats. */
const PHRASE: readonly [string, number][] = [
  ['E4', 1],
  ['E4', 1],
  ['F4', 1],
  ['G4', 1],
  ['G4', 1],
  ['F4', 1],
  ['E4', 1],
  ['D4', 1],
  ['C4', 1],
  ['C4', 1],
  ['D4', 1],
  ['E4', 1],
  ['E4', 1.5],
  ['D4', 0.5],
  ['D4', 2],
];

const DURATIONS: Record<number, { duration: Duration; dotted?: boolean }> = {
  0.5: { duration: 'eighth' },
  1: { duration: 'quarter' },
  1.5: { duration: 'quarter', dotted: true },
  2: { duration: 'half' },
};

const KEYS = PHRASE.map(([p]) => pitchToMidi(pitch(p)));
const NAMES = new Map(KEYS.map((k) => [k, keyName(k)]));
const WIDTH = 500;

/** Room for a note on the line, by its length in beats: longer notes a little wider. */
const ROOM: Record<number, number> = { 0.5: 0.8, 1: 1, 1.5: 1.3, 2: 1.6 };

/** Where each note of the phrase goes (with room at each barline), and on which beat it falls. */
const LAYOUT = (() => {
  const start = bodyStart('treble', 0, true) + 6;
  const rooms = PHRASE.map(([, length]) => ROOM[length]!);
  const unit = (WIDTH - 24 - start) / (rooms.reduce((a, b) => a + b, 0) + 3 * 0.6);
  const beats: number[] = [];
  const notes: StaffNote[] = [];
  let beat = 0;
  let at = start;
  for (const [i, [p, length]] of PHRASE.entries()) {
    if (beat > 0 && beat % 4 === 0) at += 0.6 * unit;
    beats.push(beat);
    notes.push({
      id: `${i}`,
      pitch: pitch(p),
      clef: 'treble',
      x: at,
      ...DURATIONS[length],
      stem: 'up',
    });
    beat += length;
    at += rooms[i]! * unit;
  }
  // Each barline halfway between the last note of a bar and the first of the next.
  const bars = [4, 8, 12].map((b) => {
    const first = beats.indexOf(b);
    return (notes[first - 1]!.x + HEAD_WIDTH + notes[first]!.x) / 2;
  });
  return { notes, beats, bars };
})();

const RUNGS = [60, 70, 80, 90, 100];
const TARGETS = ['80', '100', '120'] as const;

/**
 * A ladder of tempos to a target: the phrase heard at 60, 70, 80 and 90 per cent of it, and at
 * the target itself, each rung a step you take only once the one below is clean.
 */
export function TempoLadder({
  labels,
  staffLabel,
}: {
  labels: {
    target: string;
    /** '{percent}%: ♩ = {bpm}'. */
    rung: string;
    readout: string;
  };
  staffLabel: string;
}) {
  const player = usePlayNotes();
  const staticPage = useStaticPage();
  const [target, setTarget] = useState<(typeof TARGETS)[number]>('100');
  const [rung, setRung] = useState(0);
  const bpms = tempoLadder(Number(target), RUNGS);
  const notes: StaffNote[] = LAYOUT.notes.map((note, i) => ({
    ...note,
    tone: player.lit.has(i) ? 'accent' : 'ink',
  }));
  const play = (i: number) => {
    setRung(i);
    const beatMs = 60_000 / bpms[i]!;
    player.play(
      LAYOUT.beats.map((b, j) => ({
        midi: KEYS[j]!,
        at: b * beatMs,
        ms: PHRASE[j]![1] * beatMs - 40,
        velocity: 72,
      })),
    );
  };
  const lit = new Set([...player.lit].map((i) => KEYS[i]!));
  const classes = new Map(KEYS.map((k) => [k, lit.has(k) ? 'lk-same' : 'lk-named']));

  return (
    <>
      {!staticPage && (
        <div className="plate-toolbar">
          <span className="plate-select">{labels.target}</span>
          <Choices
            value={target}
            onChange={(next) => {
              setTarget(next);
              player.stop();
            }}
            options={TARGETS.map((t) => ({ value: t, label: `♩ = ${t}` }))}
          />
        </div>
      )}
      <p className="plate-readout is-small" aria-live="polite">
        <span className="plate-readout-name">
          {formatMessage(labels.rung, { percent: RUNGS[rung]!, bpm: bpms[rung]! })}
        </span>
        <span className="plate-readout-label">{labels.readout}</span>
      </p>
      <EngravedStaff
        system="treble"
        width={WIDTH}
        className="plate-staff is-phrase"
        label={staffLabel}
        notes={notes}
        bars={LAYOUT.bars}
        time={[4, 4]}
      />
      <ol className="tempo-ladder" aria-label={labels.target}>
        {RUNGS.map((percent, i) => (
          <li key={percent}>
            {staticPage ? (
              formatMessage(labels.rung, { percent, bpm: bpms[i]! })
            ) : (
              <button
                type="button"
                className={rung === i ? 'button is-compact is-current' : 'button is-compact'}
                aria-pressed={rung === i}
                onClick={() => play(i)}
              >
                <svg className="button-glyph" viewBox="0 0 10 12" aria-hidden="true">
                  <path d="M1 1l8 5-8 5z" />
                </svg>
                {formatMessage(labels.rung, { percent, bpm: bpms[i]! })}
              </button>
            )}
          </li>
        ))}
      </ol>
      <LessonPiano range={[48, 83]} keyNames={NAMES} keyClasses={classes} />
    </>
  );
}

export interface PlanPart {
  id: string;
  name: string;
  what: string;
  /** Its share of the session. */
  weight: number;
}

const LENGTHS = ['10', '20', '30', '45'] as const;

/** A practice session of 10 to 45 minutes, split into its parts in whole minutes. */
export function PracticePlan({
  parts,
  labels,
}: {
  parts: readonly PlanPart[];
  labels: { length: string; minutes: string; total: string };
}) {
  const [length, setLength] = useState<(typeof LENGTHS)[number]>('20');
  const staticPage = useStaticPage();
  const minutes = splitMinutes(
    Number(length),
    parts.map((p) => p.weight),
  );
  return (
    <>
      {!staticPage && (
        <div className="plate-toolbar">
          <span className="plate-select">{labels.length}</span>
          <Choices
            value={length}
            onChange={setLength}
            options={LENGTHS.map((l) => ({
              value: l,
              label: formatMessage(labels.minutes, { n: l }),
            }))}
          />
        </div>
      )}
      <div className="plan-bar" aria-hidden="true">
        {parts.map((part, i) => (
          <span
            key={part.id}
            className={`plan-part is-${i}`}
            style={{ flexGrow: minutes[i] }}
            title={part.name}
          />
        ))}
      </div>
      <ol className="plan-list" aria-label={formatMessage(labels.total, { n: length })}>
        {parts.map((part, i) => (
          <li key={part.id}>
            <span className={`plan-swatch is-${i}`} aria-hidden="true" />
            <b>{formatMessage(labels.minutes, { n: minutes[i]! })}</b>
            <span>
              <strong>{part.name}</strong> {part.what}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
