import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from 'wouter';
import { keyAnswered } from '../../core/instrument.ts';
import { parseMusicXml } from '../../core/musicxml.ts';
import { DEMO_VELOCITY, demoPlan } from '../../core/playback.ts';
import { performanceOrder } from '../../core/repeats.ts';
import type { StepTiming } from '../../core/rhythm.ts';
import { buildSteps } from '../../core/score.ts';
import { generateFragment, type SightFragment } from '../../core/sightFragment.ts';
import { beatsOf } from '../../core/sightLevels.ts';
import {
  inTimeShare,
  judgeTimeRun,
  judgeWaitRun,
  sightPlan,
  type BarFigures,
  type ReadAhead,
  type SightRun,
  type SightSessionState,
} from '../../core/sightRead.ts';
import { sightHands, sightMusicXml } from '../../core/sightXml.ts';
import { press, startWait, type StepRecord, type WaitState } from '../../core/wait.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { createDemoPlayer } from '../../output/demo.ts';
import { browserClock } from '../../output/scheduler.ts';
import { useInput } from '../input/context.ts';
import { readInstrumentKeys } from '../instrument.ts';
import { useMetronome } from '../metronome/context.ts';
import {
  ScoreView,
  type BarBoxes,
  type EventBoxes,
  type ScoreStatus,
} from '../notation/ScoreView.tsx';
import type { Engraving } from '../notation/verovio.ts';
import { useOutputState } from '../output/context.ts';
import { CalibrationSheet, TimingMark } from '../pieces/RhythmParts.tsx';
import type { LastNote } from '../pieces/rhythm.ts';
import { readClickVolume, readLatency, type Latency } from '../pieces/rhythmPrefs.ts';
import { sharedClickTrack, useRhythmPlayer } from '../pieces/useRhythmPlayer.ts';
import { useReadFormat } from './format.ts';
import { useRhythmFormat } from './rhythmFormat.ts';
import type { SightController } from './sightController.ts';
import { useSightFormat } from './sightFormat.ts';
import type { SightPrefs } from './sightPrefs.ts';

/** Every system stretched across the page; the second phrase of eight bars on a system of its own. */
const ENGRAVING: Engraving = { lastJustification: 0 };
const ENGRAVING_PHRASES: Engraving = { lastJustification: 0, phrases: true };
/** Offered once per browser, before the first run with a click (shared with Pieces and Scales). */
const CALIBRATION_OFFERED_PREF = 'dacapo.latency.offered';
const NO_KEYS: readonly number[] = [];

interface SightSessionProps {
  session: SightSessionState;
  controller: SightController;
  prefs: SightPrefs;
  /** Quarters a minute, for the whole session. */
  bpm: number;
}

/**
 * A session of sight-reading: the fragment on the grand staff, a look at it with a countdown, then
 * the run (in time: a bar of count-in and nothing waits; or in wait mode), bars covered as they are
 * played when reading ahead; then each note inked, each bar's figures and the run's, with Listen,
 * Again and Next.
 */
export function SightSession({ session, controller, prefs, bpm }: SightSessionProps) {
  const t = useT();
  const format = useSightFormat();
  const inTime = prefs.play === 'time';
  // Offered once per browser before the first run with a click, before the first look.
  const [calibration, setCalibration] = useState<'offer' | 'open' | null>(() =>
    inTime && !readLatency() && readPref(CALIBRATION_OFFERED_PREF) !== '1' ? 'offer' : null,
  );
  const [calibrating, setCalibrating] = useState(false);
  const [latency, setLatency] = useState<Latency | null>(readLatency);
  useEffect(() => {
    if (calibration === 'offer') writePref(CALIBRATION_OFFERED_PREF, '1');
  }, [calibration]);

  const record = session.fragments.at(-1)!;
  const fragment = useMemo(
    () => generateFragment(session.level, record.seed, record.version),
    [session.level, record.seed, record.version],
  );
  const index = session.fragments.length - 1;
  const [running, setRunning] = useState(false);

  return (
    <section
      className="read-session rhythm-session sight-session"
      aria-label={t('read.what.sight')}
    >
      <div className="read-bar">
        <p className="read-level">{format.level(session.level)}</p>
        <p className="read-count">{t('sight.fragment', { n: index + 1, total: session.length })}</p>
        <p className="read-count">
          {t('sight.keyMeter', { key: format.key(fragment.key), meter: fragment.meter })}
        </p>
        {inTime && <p className="read-count">{t('pieces.tempo.bpm', { bpm })}</p>}
        {/* While a run goes, its own Stop is the only one: the session ends between runs. */}
        {!running && (
          <button type="button" className="button" onClick={controller.stop}>
            {t('read.stop')}
          </button>
        )}
      </div>
      <div className="read-progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${index / session.length})` }} />
      </div>

      <FragmentRun
        key={`${session.id}:${index}`}
        fragment={fragment}
        session={session}
        controller={controller}
        prefs={prefs}
        bpm={bpm}
        paused={calibration !== null || calibrating}
        onRunning={setRunning}
        onCalibrate={() => setCalibration('open')}
        latency={latency}
      />

      {calibration && (
        <CalibrationSheet
          offer={calibration === 'offer'}
          onCalibrate={() => setCalibration('open')}
          onStart={() => setCalibration(null)}
          onRunning={setCalibrating}
          onChange={setLatency}
          onClose={() => setCalibration(null)}
        />
      )}
    </section>
  );
}

type Phase = 'look' | 'ready' | 'running' | 'result';

interface FragmentRunProps {
  fragment: SightFragment;
  session: SightSessionState;
  controller: SightController;
  prefs: SightPrefs;
  bpm: number;
  /** The calibration sheet is open: the look waits. */
  paused: boolean;
  /** Whether a run is going (the session's Stop gives way to the run's). */
  onRunning: (running: boolean) => void;
  onCalibrate: () => void;
  latency: Latency | null;
}

/** A run in time under way: its clock and what it has heard. */
interface TimeRun {
  origin: number;
  timings: StepTiming[];
}

/** A run in wait mode under way. */
interface WaitRun {
  state: WaitState;
  records: StepRecord[];
  /** Epoch ms of the first key, once pressed. */
  startedAt: number | null;
}

function FragmentRun({
  fragment,
  session,
  controller,
  prefs,
  bpm,
  paused,
  onRunning,
  onCalibrate,
  latency,
}: FragmentRunProps) {
  const t = useT();
  const format = useSightFormat();
  const { hub, output } = useInput();
  const metronome = useMetronome();
  const hasOutput = useOutputState().selected !== null;
  const inTime = prefs.play === 'time';
  const readAhead: ReadAhead = inTime ? prefs.readAhead : 'off';

  const xml = useMemo(() => sightMusicXml(fragment), [fragment]);
  const score = useMemo(
    () =>
      parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
        hands: sightHands(),
      }),
    [xml],
  );
  const steps = useMemo(() => buildSteps(score, 'both'), [score]);
  const plan = useMemo(() => sightPlan(score, steps, bpm), [score, steps, bpm]);
  const [status, setStatus] = useState<ScoreStatus>({ state: 'loading' });
  const ready = status.state === 'ready';

  const { player, snapshot: beat } = useRhythmPlayer(output.scheduler, output.onInterrupt, () =>
    metronome.block('reading'),
  );
  const [demo] = useState(() =>
    createDemoPlayer(output.scheduler, browserClock, output.onInterrupt),
  );
  const demoState = useSyncExternalStore(demo.subscribe, demo.getState);
  const demoStep = useSyncExternalStore(demo.subscribe, demo.currentStep);
  useEffect(() => () => demo.stop(), [demo]);

  const [phase, setPhase] = useState<Phase>('look');
  const [ended, setEnded] = useState(false);
  const [last, setLast] = useState<LastNote | null>(null);
  const timeRun = useRef<TimeRun | null>(null);
  const [origin, setOrigin] = useState<number | null>(null);
  const [wait, setWait] = useState<WaitRun | null>(null);
  const waitRef = useRef<WaitRun | null>(null);
  const changeWait = (next: WaitRun | null) => {
    waitRef.current = next;
    setWait(next);
  };
  const result = phase === 'result' ? session.last : null;
  useEffect(() => {
    onRunning(phase === 'running');
    return () => onRunning(false);
  }, [phase, onRunning]);

  // The look: a countdown from the moment the score is drawn (and no sheet is open); at its end
  // the run starts by itself.
  const [left, setLeft] = useState<number>(prefs.look);
  const beginNow = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (phase !== 'look' || !ready || paused) return;
    const ends = performance.now() + prefs.look * 1000;
    const tick = setInterval(
      () => setLeft(Math.max(0, Math.ceil((ends - performance.now()) / 1000))),
      LOOK_TICK_MS,
    );
    const timer = setTimeout(() => beginNow.current(), prefs.look * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(timer);
    };
  }, [phase, ready, paused, prefs.look]);

  function begin() {
    if (demo.getState() !== 'stopped') demo.stop();
    setEnded(false);
    setLast(null);
    if (!inTime) {
      const state = startWait(steps);
      if (!state) return;
      changeWait({ state, records: [], startedAt: null });
      setPhase('running');
      return;
    }
    const offset = readLatency()?.offset ?? 0;
    const current: TimeRun = { origin: 0, timings: [] };
    timeRun.current = current;
    setPhase('running');
    current.origin = player.start({
      plan,
      backing: null,
      velocity: 0,
      clickMode: prefs.countInOnly ? 'countIn' : 'on',
      volume: readClickVolume(),
      latency: offset,
      onSettled: (timings) => current.timings.push(...timings),
      onEnd: (reason) => {
        if (timeRun.current !== current) return;
        timeRun.current = null;
        setOrigin(null);
        if (reason !== 'done') {
          setEnded(true);
          setPhase('ready');
          return;
        }
        const zero = Date.now() - performance.now();
        const startedAt = Math.round(zero + current.origin);
        const run = judgeTimeRun(score, steps, current.timings, {
          bpm,
          readAhead,
          startedAt,
          endedAt: Math.max(startedAt, Math.round(Date.now())),
        });
        controller.recordRun(run);
        setPhase('result');
      },
    });
    setOrigin(current.origin);
  }

  useEffect(() => {
    beginNow.current = begin;
  });

  // Keys: to rhythm mode's player in time, to wait mode's step otherwise.
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type !== 'on') return;
        // A key the keyboard lacks is answered by the same note in another octave
        // (docs/PERSONAL.md, "The instrument's keys"): of the step the run is on, or in time
        // of that step and the ones either side.
        const keys = readInstrumentKeys();
        if (timeRun.current) {
          const at = player.getSnapshot().step;
          const near =
            at === null ? [] : [at - 1, at, at + 1].flatMap((i) => steps[i]?.midis ?? []);
          const res = player.press(keyAnswered(event.midi, near, keys), event.time);
          if (res.kind === 'hit') setLast({ kind: 'hit', deviation: res.deviation });
          else if (res.kind === 'extra') setLast({ kind: 'extra' });
          return;
        }
        const current = waitRef.current;
        if (!current || current.state.finished) return;
        const asked = steps[current.state.current]?.midis ?? [];
        const res = press(steps, current.state, keyAnswered(event.midi, asked, keys), event.time);
        if (res.kind === 'ignored') return;
        const epoch = Math.round(Date.now() - performance.now() + event.time);
        const next: WaitRun = {
          state: res.state,
          records: 'record' in res ? [...current.records, res.record] : current.records,
          startedAt: current.startedAt ?? epoch,
        };
        changeWait(next);
        if (res.kind === 'finished') {
          const run = judgeWaitRun(score, steps, next.records, {
            startedAt: next.startedAt!,
            endedAt: Math.max(next.startedAt!, epoch),
          });
          controller.recordRun(run);
          setPhase('result');
        }
      }),
    [hub, player, steps, score, controller],
  );

  function onStart() {
    // A gesture: the click can sound from here on, even when the next run starts by itself.
    sharedClickTrack();
    if (phase === 'running') {
      if (inTime) player.stop();
      else {
        changeWait(null);
        setEnded(true);
        setPhase('ready');
      }
      return;
    }
    begin();
  }

  function onNext() {
    sharedClickTrack();
    demo.stop();
    controller.next();
  }

  function onListen() {
    sharedClickTrack();
    const state = demo.getState();
    if (state === 'playing') demo.pause();
    else if (state === 'paused') demo.resume();
    else {
      const listen = demoPlan({
        score: { ...score, tempos: [{ tick: 0, bpm }] },
        order: performanceOrder(score.measures),
        steps,
        hands: 'both',
        loop: null,
        startBar: 0,
        scale: 1,
      });
      if (listen) demo.play(listen, DEMO_VELOCITY);
    }
  }

  // Where the run is, for the covers of read ahead.
  const position = usePosition(
    phase === 'running' && inTime && readAhead !== 'off' ? origin : null,
  );
  const barMs = (beatsOf(fragment.meter) * 60_000) / bpm;
  const covered =
    readAhead === 'off' || position === null
      ? -1
      : Math.floor((position + (readAhead === 'hard' ? barMs / 2 : 0)) / barMs + 1e-6);

  const running = phase === 'running';
  const cursor = running
    ? inTime
      ? beat.step === null || beat.state === 'counting'
        ? null
        : (steps[beat.step] ?? null)
      : wait
        ? (steps[wait.state.current] ?? null)
        : null
    : demoStep !== null && demoState !== 'stopped'
      ? (steps[demoStep] ?? null)
      : null;
  const pressed = running && !inTime && wait ? wait.state.pressed : NO_KEYS;

  const marks = useMemo(
    () =>
      result
        ? new Map([...result.ink].map(([id, ink]) => [id, `is-rhythm-${ink}`] as const))
        : undefined,
    [result],
  );

  const isLast = session.fragments.length >= session.length;
  let statusText: ReactNode;
  if (!ready) statusText = t('pieces.preparing');
  else if (phase === 'look')
    statusText = t(inTime ? 'sight.status.look' : 'sight.status.lookWait', { n: left });
  else if (running && inTime && beat.state === 'counting')
    statusText = (
      <strong className="piece-count">
        {beat.count === null ? '' : t('pieces.status.countIn', { beat: beat.count })}
      </strong>
    );
  else if (running && inTime)
    statusText = (
      <>
        {t(prefs.countInOnly ? 'sight.status.playingQuiet' : 'sight.status.playing')}{' '}
        <TimingMark last={last} />
      </>
    );
  else if (running) statusText = t('sight.status.wait');
  else if (result) statusText = t(isLast ? 'sight.status.doneLast' : 'sight.status.done');
  else if (ended) statusText = t('sight.status.stopped');
  else statusText = t('sight.status.ready');

  return (
    <>
      <div className="rhythm-head">
        <p className="rhythm-status" role="status">
          {statusText}
        </p>
        {phase !== 'result' && (
          <button
            type="button"
            className={
              running ? 'button is-compact piece-go' : 'button button-primary is-compact piece-go'
            }
            disabled={paused || !ready}
            onClick={onStart}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {running ? (
                <rect x="4" y="4" width="8" height="8" rx="1" className="is-filled" />
              ) : (
                <circle cx="8" cy="8" r="4.5" className="is-filled" />
              )}
            </svg>
            <span>
              {running
                ? t('pieces.rhythm.stop')
                : phase === 'look'
                  ? t('sight.startNow')
                  : t('pieces.rhythm.start')}
            </span>
          </button>
        )}
      </div>

      <div
        className="rhythm-sheet sight-sheet"
        // Development only: when each key is due, for driving a run from a script.
        data-plan={
          import.meta.env.DEV
            ? JSON.stringify({
                origin,
                steps: inTime
                  ? plan.steps.map((s) => [s.at, s.midis])
                  : steps.map((s) => [0, s.midis]),
              })
            : undefined
        }
      >
        <ScoreView
          xml={xml}
          score={score}
          title={t('sight.title', { key: format.key(fragment.key), meter: fragment.meter })}
          step={cursor}
          pressed={pressed}
          hands="both"
          onStatus={setStatus}
          marks={marks}
          engraving={fragment.phrases.length > 1 ? ENGRAVING_PHRASES : ENGRAVING}
          fillHeight={false}
          events
          above={(bars, events) => (
            <SheetOverlay
              bars={bars}
              events={events}
              count={fragment.bars}
              covered={running ? covered : -1}
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
          last={isLast}
          listening={demoState}
          canListen={hasOutput}
          onListen={onListen}
          onStopListening={() => demo.stop()}
          onAgain={onStart}
          onNext={onNext}
        />
      ) : null}

      {inTime && (
        <p className="rhythm-latency">
          <span>
            {latency ? t('pieces.latency', { ms: latency.offset }) : t('pieces.latency.none')}
          </span>
          <button
            type="button"
            className="button is-compact"
            disabled={running}
            onClick={onCalibrate}
          >
            {t('pieces.latency.calibrate')}
          </button>
        </p>
      )}
    </>
  );
}

/** How often the look's countdown is looked at. */
const LOOK_TICK_MS = 200;

/** Milliseconds from the run's first downbeat (negative in the count-in), or null; every frame. */
function usePosition(origin: number | null): number | null {
  // The position of the run that measured it: another run's (or none) is no position.
  const [position, setPosition] = useState<{ origin: number; at: number } | null>(null);
  useEffect(() => {
    if (origin === null) return;
    let frame = 0;
    const tick = () => {
      setPosition({ origin, at: performance.now() - origin });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [origin]);
  return origin !== null && position?.origin === origin ? position.at : null;
}

/** Room around a bar's staves that a cover also hides: notes on ledger lines, fingering. */
const COVER_BLEED = 22;
/** Room a cover leaves before a bar's first note. */
const COVER_GAP = 6;

/**
 * Laid over the score: while a run reads ahead, the bars played and the one being played covered;
 * after a run, each bar's figure above it.
 */
function SheetOverlay({
  bars,
  events,
  count,
  covered,
  result,
}: {
  bars: BarBoxes;
  events: EventBoxes;
  count: number;
  covered: number;
  result: SightRun | null;
}) {
  const boxes = Array.from({ length: count }, (_, i) => bars.get(i));
  return (
    <div className="rhythm-overlay sight-overlay" aria-hidden="true">
      {boxes.map((box, i) => {
        if (!box || i > covered) return null;
        // From the bar's first note or rest (its accidental included): a system's clef, key and
        // time signatures stay in sight.
        const first = Math.min(
          ...(events.get(i) ?? []).flatMap((staff) => staff.map((e) => e.whole.left)),
        );
        const left = Number.isFinite(first) ? Math.max(box.left, first - COVER_GAP) : box.left;
        return (
          <span
            key={`c${i}`}
            className="sight-cover"
            style={{
              left,
              top: box.top - COVER_BLEED,
              width: box.left + box.width - left,
              height: box.height + 2 * COVER_BLEED,
            }}
          />
        );
      })}
      {result?.bars.map((bar) => {
        const box = boxes[bar.bar];
        if (!box) return null;
        const { text, tone } = barLabel(bar, result.figures.mode === 'wait');
        return (
          <span
            key={`r${bar.bar}`}
            className={`sight-bar-label is-${tone}`}
            style={{ left: box.left + 4, top: box.top - COVER_BLEED }}
          >
            {text}
          </span>
        );
      })}
    </div>
  );
}

/** A bar's figure: its notes right and in time of those asked (wrong keys in wait mode). */
function barLabel(
  bar: BarFigures,
  waitMode: boolean,
): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (waitMode)
    return bar.wrong === 0 ? { text: '✓', tone: 'ok' } : { text: `×${bar.wrong}`, tone: 'warn' };
  const share = bar.notes === 0 ? 1 : bar.inTime / bar.notes;
  const clean = bar.extras === 0 && share === 1;
  return {
    text: clean ? '✓' : `${bar.inTime}/${bar.notes}${bar.extras > 0 ? ` +${bar.extras}` : ''}`,
    tone: clean ? 'ok' : share >= 0.5 ? 'warn' : 'bad',
  };
}

/** A run's result: its figures, the key to the ink, the bars in a table, Listen, Again and Next. */
function RunResult({
  run,
  last,
  listening,
  canListen,
  onListen,
  onStopListening,
  onAgain,
  onNext,
}: {
  run: SightRun;
  last: boolean;
  listening: 'stopped' | 'playing' | 'paused';
  canListen: boolean;
  onListen: () => void;
  onStopListening: () => void;
  onAgain: () => void;
  onNext: () => void;
}) {
  const t = useT();
  const read = useReadFormat();
  const rhythm = useRhythmFormat();
  const f = run.figures;
  return (
    <section className="rhythm-result sight-result" aria-labelledby="sight-result-title">
      <h2 id="sight-result-title" className="visually-hidden">
        {t('sight.result.title')}
      </h2>
      {f.mode === 'time' ? (
        <>
          <dl className="figures">
            <div>
              <dt>{t('sight.result.inTime')}</dt>
              <dd>{read.percent(inTimeShare(f))}</dd>
            </div>
            <div>
              <dt>{t('sight.result.notes')}</dt>
              <dd>{t('sight.result.notesValue', { right: f.inTime, total: f.notes })}</dd>
            </div>
            <div>
              <dt>{t('rhythm.result.median')}</dt>
              <dd>{rhythm.ms(f.medianDeviation)}</dd>
            </div>
          </dl>
          <p className="rhythm-tendency">{rhythm.tendency(f.tendency)}</p>
          {f.early + f.late + f.wrong + f.missed + f.extras > 0 && (
            <p className="rhythm-tendency">
              {t('sight.result.faults', {
                wrong: f.wrong,
                missed: f.missed,
                extras: f.extras,
                off: f.early + f.late,
              })}
            </p>
          )}
          <ul className="rhythm-key" aria-hidden="true">
            <li className="is-in">{t('rhythm.ink.inTime')}</li>
            <li className="is-early">{t('rhythm.ink.early')}</li>
            <li className="is-late">{t('rhythm.ink.late')}</li>
            <li className="is-missed">{t('sight.ink.missed')}</li>
          </ul>
        </>
      ) : (
        <>
          <dl className="figures">
            <div>
              <dt>{t('sight.result.keys')}</dt>
              <dd>{f.notes}</dd>
            </div>
            <div>
              <dt>{t('sight.result.wrongKeys')}</dt>
              <dd>{f.wrong}</dd>
            </div>
          </dl>
          <p className="rhythm-tendency muted">{t('sight.result.waitNote')}</p>
        </>
      )}
      <details className="sight-bars">
        <summary>{t('sight.bars.title')}</summary>
        <table className="sight-bars-table">
          <thead>
            <tr>
              <th scope="col">{t('sight.bars.bar')}</th>
              {f.mode === 'time' ? (
                <>
                  <th scope="col">{t('sight.bars.inTime')}</th>
                  <th scope="col">{t('sight.bars.off')}</th>
                  <th scope="col">{t('sight.bars.wrong')}</th>
                  <th scope="col">{t('sight.bars.missed')}</th>
                  <th scope="col">{t('sight.bars.extras')}</th>
                </>
              ) : (
                <th scope="col">{t('sight.bars.wrongKeys')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {run.bars.map((b) => (
              <tr key={b.bar}>
                <th scope="row">{b.bar + 1}</th>
                {f.mode === 'time' ? (
                  <>
                    <td>{`${b.inTime}/${b.notes}`}</td>
                    <td>{b.early + b.late}</td>
                    <td>{b.wrong}</td>
                    <td>{b.missed}</td>
                    <td>{b.extras}</td>
                  </>
                ) : (
                  <td>{b.wrong}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <div className="actions">
        <button
          type="button"
          className="button piece-listen"
          disabled={!canListen}
          onClick={onListen}
          aria-describedby="sight-listen-help"
        >
          {listening === 'playing'
            ? t('pieces.demo.pause')
            : listening === 'paused'
              ? t('pieces.demo.resume')
              : t('pieces.demo')}
        </button>
        {listening !== 'stopped' && (
          <button type="button" className="button" onClick={onStopListening}>
            {t('pieces.demo.stop')}
          </button>
        )}
        <button type="button" className="button" onClick={onAgain}>
          {t('rhythm.again')}
        </button>
        <button type="button" className="button button-primary" onClick={onNext} autoFocus>
          {t(last ? 'rhythm.finish' : 'sight.next')}
        </button>
      </div>
      <p id="sight-listen-help" className="help">
        {canListen ? (
          t('sight.listen.help')
        ) : (
          <Link href="/settings">{t('pieces.output.needed')}</Link>
        )}
      </p>
    </section>
  );
}
