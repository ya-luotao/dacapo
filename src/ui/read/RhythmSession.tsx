import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { parseMusicXml } from '../../core/musicxml.ts';
import type { StepTiming } from '../../core/rhythm.ts';
import {
  barTicksOf,
  beatTicksOf,
  beatsPerBar,
  getRhythmLevel,
  timeSignature,
} from '../../core/rhythmCells.ts';
import {
  exerciseCounts,
  exercisePlan,
  LINE_KEYS,
  lineOfKey,
  msPerTick,
  type Count,
  type RhythmExercise,
} from '../../core/rhythmExercise.ts';
import {
  createTapFilter,
  inTime,
  isExtraTap,
  judgeRhythmRun,
  type RhythmRun,
  type RhythmSessionState,
  type Tap,
} from '../../core/rhythmRead.ts';
import { rhythmHands, rhythmMusicXml } from '../../core/rhythmXml.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { useInput } from '../input/context.ts';
import { useMetronome } from '../metronome/context.ts';
import { ScoreView, type ScoreStatus } from '../notation/ScoreView.tsx';
import type { Engraving } from '../notation/verovio.ts';
import { CalibrationSheet, TimingMark } from '../pieces/RhythmParts.tsx';
import type { LastNote } from '../pieces/rhythm.ts';
import { readClickVolume, readLatency, type Latency } from '../pieces/rhythmPrefs.ts';
import { useRhythmPlayer } from '../pieces/useRhythmPlayer.ts';
import { lineGeometry, type LineGeometry } from './rhythmLine.ts';
import { useRhythmFormat } from './rhythmFormat.ts';
import type { RhythmController } from './rhythmController.ts';
import type { RhythmPrefs } from './rhythmPrefs.ts';
import { CountDots, TapPads } from './RhythmPads.tsx';
import { tapKeysFor } from './tapKeys.ts';

/** A rhythm line is short: its last system is stretched once half full. */
const ENGRAVING: Engraving = { lastJustification: 0.5, rhythm: true };
/** Offered once per browser, before the first run with a click (shared with Pieces and Scales). */
const CALIBRATION_OFFERED_PREF = 'dacapo.latency.offered';

interface RhythmSessionProps {
  session: RhythmSessionState;
  controller: RhythmController;
  prefs: RhythmPrefs;
  onPrefs: (patch: Partial<RhythmPrefs>) => void;
}

/** A run under way: its clock and what it has heard so far. */
interface Run {
  origin: number;
  latency: number;
  timings: StepTiming[];
  extras: Tap[];
  counts: (line: number, time: number) => boolean;
}

/**
 * A session of rhythm lines: the line on its one-line staff, Start for a bar of count-in and the
 * run (the click, or only the count-in), the taps from any key, the pads or the computer keyboard
 * timed by rhythm mode's player; then every onset inked on the line and the run's figures, with
 * Again and Next.
 */
export function RhythmSession({ session, controller, prefs, onPrefs }: RhythmSessionProps) {
  const t = useT();
  const format = useRhythmFormat();
  const { hub, output, pointer, keyboard, monitor } = useInput();
  const metronome = useMetronome();
  const region = useRef<HTMLElement>(null);
  const { exercise, bpm } = session;
  const level = getRhythmLevel(session.level);
  const hands = level.hands;

  const xml = useMemo(() => rhythmMusicXml(exercise), [exercise]);
  const score = useMemo(
    () =>
      parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
        hands: rhythmHands(exercise),
      }),
    [xml, exercise],
  );
  const plan = useMemo(() => exercisePlan(exercise, bpm), [exercise, bpm]);
  const counts = useMemo(
    () => exerciseCounts(exercise, { trip: t('rhythm.count.trip'), let: t('rhythm.count.let') }),
    [exercise, t],
  );
  const [status, setStatus] = useState<ScoreStatus>({ state: 'loading' });

  // Rhythm mode's player: the count-in, the click, the taps against the plan; the metronome
  // paused meanwhile.
  const { player, snapshot: beat } = useRhythmPlayer(output.scheduler, output.onInterrupt, () =>
    metronome.block('reading'),
  );
  const running = beat.state !== 'stopped';
  const run = useRef<Run | null>(null);
  const [origin, setOrigin] = useState<number | null>(null);
  const [ended, setEnded] = useState<'stopped' | 'interrupted' | null>(null);
  const [last, setLast] = useState<LastNote | null>(null);
  const [latency, setLatency] = useState<Latency | null>(readLatency);
  const [calibration, setCalibration] = useState<'offer' | 'open' | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  // A run started again hides the last one's result until it has one of its own; one stopped
  // leaves none.
  const [stale, setStale] = useState(false);
  const result = running || stale ? null : session.last;

  // The taps: a key of the right hand's line or the left's (by middle C in two hands), a chord
  // counted once, timed by the player; what it takes for no onset is an extra tap.
  useEffect(
    () =>
      hub.onEvent((event) => {
        const current = run.current;
        if (event.type !== 'on' || !current) return;
        const line = lineOfKey(event.midi, hands);
        if (!current.counts(line, event.time)) return;
        const result = player.press(LINE_KEYS[line]!, event.time);
        const time = event.time - current.origin - current.latency;
        if (isExtraTap(plan, time, result)) {
          current.extras.push({ line, time });
          setLast({ kind: 'extra' });
        } else if (result.kind === 'hit') {
          setLast({ kind: 'hit', deviation: result.deviation });
        }
      }),
    [hub, player, plan, hands],
  );

  // While a run lasts, the computer keyboard taps: any letter or the space bar (by the half of
  // the keyboard in two hands), in place of its notes.
  useEffect(() => {
    if (!running) return;
    const resume = keyboard.suspend();
    const remove = hub.add(tapKeysFor(monitor));
    return () => {
      remove();
      resume();
    };
  }, [running, keyboard, hub, monitor]);

  function begin() {
    setCalibration(null);
    const offset = readLatency()?.offset ?? 0;
    const current: Run = {
      origin: 0,
      latency: offset,
      timings: [],
      extras: [],
      counts: createTapFilter(),
    };
    run.current = current;
    setEnded(null);
    setLast(null);
    setStale(true);
    // Off the buttons: the space bar taps.
    region.current?.focus({ preventScroll: true });
    current.origin = player.start({
      plan,
      backing: null,
      velocity: 0,
      clickMode: prefs.countInOnly ? 'countIn' : 'on',
      volume: readClickVolume(),
      latency: offset,
      onSettled: (timings) => current.timings.push(...timings),
      onEnd: (reason) => {
        if (run.current !== current) return;
        run.current = null;
        setOrigin(null);
        if (reason !== 'done') {
          setEnded(reason);
          return;
        }
        const judged = judgeRhythmRun(exercise, bpm, current.timings, current.extras);
        // The epoch of the run's first downbeat, for the answers' timestamps.
        const zeroAt = Math.round(Date.now() - performance.now() + current.origin);
        controller.recordRun(judged, zeroAt);
        setStale(false);
      },
    });
    setOrigin(current.origin);
  }

  function onStart() {
    if (player.getSnapshot().state !== 'stopped') {
      player.stop();
      return;
    }
    // Offered once, before the first run with a click in this browser.
    if (!readLatency() && readPref(CALIBRATION_OFFERED_PREF) !== '1') {
      writePref(CALIBRATION_OFFERED_PREF, '1');
      setCalibration('offer');
      return;
    }
    begin();
  }

  function stopSession() {
    player.stop();
    controller.stop();
  }

  const beatMs = beatTicksOf(exercise.meter) * msPerTick(exercise.meter, bpm);
  const perBar = timeSignature(exercise.meter)[0];
  const countMs = (beatMs * beatsPerBar(exercise.meter)) / perBar;
  const count = useCount(origin, countMs);
  const countsPerBeat = perBar / beatsPerBar(exercise.meter);
  const beatTick =
    count !== null && count >= 0
      ? Math.min(
          Math.floor(count / countsPerBeat) * beatTicksOf(exercise.meter),
          exercise.bars * barTicksOf(exercise.meter),
        )
      : null;

  // After a run, each note inked by its onset's timing (a tie's second note as its first).
  const marks = useMemo(
    () => (result ? inkMarks(score.notes, result) : undefined),
    [result, score],
  );

  const isLast = session.index + 1 >= session.length;
  const title = t('rhythm.line', { meter: exercise.meter });

  let statusText: ReactNode;
  if (beat.state === 'counting')
    statusText = (
      <strong className="piece-count">
        {beat.count === null ? '' : t('pieces.status.countIn', { beat: beat.count })}
      </strong>
    );
  else if (running)
    statusText = (
      <>
        {t(prefs.countInOnly ? 'rhythm.status.playingQuiet' : 'rhythm.status.playing')}{' '}
        <TimingMark last={last} />
      </>
    );
  else if (result) statusText = t(isLast ? 'rhythm.status.doneLast' : 'rhythm.status.done');
  else if (ended) statusText = t('rhythm.status.stopped');
  else statusText = t(hands ? 'rhythm.status.readyHands' : 'rhythm.status.ready');

  return (
    <section
      className={`read-session rhythm-session${hands ? ' is-hands' : ''}`}
      ref={region}
      tabIndex={-1}
      aria-label={t('read.what.rhythm')}
    >
      <div className="read-bar">
        <p className="read-level">{format.level(session.level)}</p>
        <p className="read-count">
          {t('rhythm.exercise', { n: session.index + 1, total: session.length })}
        </p>
        <p className="read-count">{format.tempo(exercise.meter, bpm)}</p>
        <label className="check">
          <input
            type="checkbox"
            checked={prefs.counts}
            onChange={(e) => onPrefs({ counts: e.target.checked })}
          />
          <span>{t('rhythm.counts')}</span>
        </label>
        {/* While a run goes, its own Stop is the only one: the session ends between runs. */}
        {!running && (
          <button type="button" className="button" onClick={stopSession}>
            {t('read.stop')}
          </button>
        )}
      </div>
      <div className="read-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${session.index / session.length})` }} />
      </div>

      <div className="rhythm-head">
        <p className="rhythm-status" role="status">
          {statusText}
        </p>
        <CountDots
          counts={perBar}
          lit={running ? count : null}
          compound={exercise.meter === '6/8'}
        />
        {/* After a run, Again and Next are the result's. */}
        {!result && (
          <button
            type="button"
            className={
              running ? 'button is-compact piece-go' : 'button button-primary is-compact piece-go'
            }
            disabled={calibrating || status.state !== 'ready'}
            onClick={onStart}
            autoFocus={!running}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {running ? (
                <rect x="4" y="4" width="8" height="8" rx="1" className="is-filled" />
              ) : (
                <circle cx="8" cy="8" r="4.5" className="is-filled" />
              )}
            </svg>
            <span>{running ? t('pieces.rhythm.stop') : t('pieces.rhythm.start')}</span>
          </button>
        )}
      </div>

      <div
        className="rhythm-sheet"
        // Development only: when each key is due, for driving a run from a script.
        data-plan={
          import.meta.env.DEV
            ? JSON.stringify({
                origin,
                steps: plan.steps.map((s) => [s.at, s.midis]),
              })
            : undefined
        }
      >
        <ScoreView
          xml={xml}
          score={score}
          title={title}
          step={null}
          pressed={NO_KEYS}
          hands="both"
          onStatus={setStatus}
          marks={marks}
          engraving={ENGRAVING}
          fillHeight={false}
          events
          above={(bars, events) => (
            <LineOverlay
              geometry={lineGeometry(exercise, bars, events)}
              exercise={exercise}
              counts={prefs.counts ? counts : null}
              cursor={running ? beatTick : null}
              result={result}
            />
          )}
        />
        {status.state !== 'ready' && (
          <div className="piece-overlay" role="status">
            <p className={status.state === 'failed' ? 'piece-error' : 'muted'}>
              {status.state === 'loading'
                ? t('pieces.preparing')
                : status.reason === 'engine'
                  ? t('pieces.engineFailed')
                  : t('pieces.renderFailed')}
            </p>
          </div>
        )}
      </div>

      {result ? (
        <RunResult
          run={result}
          exercise={exercise}
          last={isLast}
          onAgain={onStart}
          onNext={controller.next}
        />
      ) : (
        <TapPads hands={hands} pointer={pointer} />
      )}

      <p className="rhythm-latency">
        <span>
          {latency ? t('pieces.latency', { ms: latency.offset }) : t('pieces.latency.none')}
        </span>
        <button
          type="button"
          className="button is-compact"
          disabled={running}
          onClick={() => setCalibration('open')}
        >
          {t('pieces.latency.calibrate')}
        </button>
        <span className="muted">{t(hands ? 'rhythm.keys.hands' : 'rhythm.keys')}</span>
      </p>

      {calibration && (
        <CalibrationSheet
          offer={calibration === 'offer'}
          onCalibrate={() => setCalibration('open')}
          onStart={begin}
          onRunning={setCalibrating}
          onChange={setLatency}
          onClose={() => setCalibration(null)}
        />
      )}
    </section>
  );
}

const NO_KEYS: readonly number[] = [];
/** Room for a triplet's 3 between its beam and a timing: px of the score page. */
const TUPLET_ROOM = 14;

/** The count sounding (from the run's first downbeat; negative in the count-in), or null. */
function useCount(origin: number | null, countMs: number): number | null {
  // The count of the run that measured it: another run's (or none) is no count.
  const [count, setCount] = useState<{ origin: number; count: number } | null>(null);
  useEffect(() => {
    if (origin === null) return;
    let frame = 0;
    const tick = () => {
      const next = Math.floor((performance.now() - origin) / countMs + 1e-6);
      setCount((c) => (c?.origin === origin && c.count === next ? c : { origin, count: next }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [origin, countMs]);
  return origin !== null && count?.origin === origin ? count.count : null;
}

/** Each drawn note's ink after a run: in time, early, late or missed. */
function inkMarks(
  notes: readonly { id: string; hand: 'right' | 'left' | null; onset: number; tieStop: boolean }[],
  run: RhythmRun,
): Map<string, string> {
  const out = new Map<string, string>();
  const byLine = [0, 1].map((line) => run.onsets.filter((o) => o.line === line));
  for (const note of notes) {
    const line = note.hand === 'left' ? 1 : 0;
    // A tie's continuation belongs to the onset before it.
    const onset = byLine[line]!.findLast((o) => o.tick <= note.onset);
    if (!onset || (!note.tieStop && onset.tick !== note.onset)) continue;
    out.set(note.id, `is-rhythm-${timingClass(onset.deviation)}`);
  }
  return out;
}

function timingClass(deviation: number | null): 'in' | 'early' | 'late' | 'missed' {
  if (deviation === null) return 'missed';
  if (inTime(deviation)) return 'in';
  return deviation < 0 ? 'early' : 'late';
}

/**
 * What is laid over the line: the counts under it (the one on the beat lit while a run lasts),
 * the beat cursor, and after a run each onset's timing that was not in time (early ←, late →,
 * missed ×) and each extra tap (+), in the colours the notes are inked in.
 */
function LineOverlay({
  geometry,
  exercise,
  counts,
  cursor,
  result,
}: {
  geometry: LineGeometry | null;
  exercise: RhythmExercise;
  counts: readonly Count[] | null;
  cursor: number | null;
  result: RhythmRun | null;
}) {
  if (!geometry) return null;
  const g = geometry;
  const lastLine = exercise.lines.length - 1;
  return (
    <div className="rhythm-overlay" aria-hidden="true">
      {counts?.map((c) => (
        <span
          key={c.tick}
          className={`rhythm-count${c.held ? ' is-held' : ''}${c.tick === cursor ? ' is-now' : ''}`}
          style={{ left: g.x(c.tick), top: g.lineY(0, g.barOf(c.tick)) }}
        >
          {c.text}
        </span>
      ))}
      {cursor !== null && (
        <span
          className="rhythm-cursor"
          style={{
            left: g.x(cursor),
            top: g.lineY(0, g.barOf(cursor)),
            height: g.lineY(lastLine, g.barOf(cursor)) - g.lineY(0, g.barOf(cursor)),
          }}
        />
      )}
      {result?.onsets.map((o) => {
        const kind = timingClass(o.deviation);
        if (kind === 'in') return null;
        const bar = g.barOf(o.tick);
        const text =
          o.deviation === null
            ? '×'
            : o.deviation < 0
              ? `←${Math.abs(o.deviation)}`
              : `${o.deviation}→`;
        // Away from the stems: above the right hand's line, below the left hand's.
        const above = o.line === 0;
        // Clear of a triplet's 3, drawn over the beam on the upper line and under it on the lower.
        const triplet = exercise.lines[o.line]?.some((n) => n.tick === o.tick && n.triplet);
        const clear = triplet ? TUPLET_ROOM : 0;
        return (
          <span
            key={`${o.line}:${o.tick}`}
            className={`rhythm-timing is-${kind}${above ? ' is-above' : ''}`}
            style={{
              left: g.x(o.tick),
              top: above ? g.top(0, bar) - clear : g.bottom(o.line, bar) + clear,
            }}
          >
            {text}
          </span>
        );
      })}
      {result?.extras.map((e, i) => (
        <span
          key={i}
          className={e.line === 0 ? 'rhythm-extra' : 'rhythm-extra is-below'}
          style={{ left: g.x(e.tick), top: g.lineY(e.line, g.barOf(e.tick)) }}
        >
          +
        </span>
      ))}
    </div>
  );
}

/** A run's result: its figures in words, the key to the ink, and Again or Next. */
function RunResult({
  run,
  exercise,
  last,
  onAgain,
  onNext,
}: {
  run: RhythmRun;
  exercise: RhythmExercise;
  last: boolean;
  onAgain: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const format = useRhythmFormat();
  const wrong = run.cells.filter((c) => !c.correct);
  return (
    <section className="rhythm-result" aria-labelledby="rhythm-result-title">
      <h2 id="rhythm-result-title" className="visually-hidden">
        {t('rhythm.result.title')}
      </h2>
      <dl className="figures">
        <div>
          <dt>{t('rhythm.result.cells')}</dt>
          <dd>{t('rhythm.result.cellsValue', { right: run.right, total: run.cells.length })}</dd>
        </div>
        <div>
          <dt>{t('rhythm.result.median')}</dt>
          <dd>{format.ms(run.medianDeviation)}</dd>
        </div>
      </dl>
      <p className="rhythm-tendency">{format.tendency(run.tendency)}</p>
      <ul className="rhythm-key" aria-hidden="true">
        <li className="is-in">{t('rhythm.ink.inTime')}</li>
        <li className="is-early">{t('rhythm.ink.early')}</li>
        <li className="is-late">{t('rhythm.ink.late')}</li>
        <li className="is-missed">{t('rhythm.ink.missed')}</li>
        <li className="is-extra">{t('rhythm.ink.extra')}</li>
      </ul>
      {wrong.length > 0 && (
        <ul className="visually-hidden">
          {wrong.map((c) => (
            <li key={c.cell}>{format.cellResult(c, exercise)}</li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="button" onClick={onAgain}>
          {t('rhythm.again')}
        </button>
        <button type="button" className="button button-primary" onClick={onNext} autoFocus>
          {t(last ? 'rhythm.finish' : 'rhythm.next')}
        </button>
      </div>
    </section>
  );
}
