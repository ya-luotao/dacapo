import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'wouter';
import { barHeatmap, weakestLoop, type BarMetric } from '../../core/barHeatmap.ts';
import { isBlack, midiName, PIANO_HIGHEST, PIANO_LOWEST } from '../../core/note.ts';
import type { PracticeMode } from '../../core/pieceRecords.ts';
import { summarizeRun } from '../../core/pieceRun.ts';
import {
  accompanimentPlan,
  baseTempo,
  DEMO_VELOCITY,
  demoPlan,
  otherHand,
} from '../../core/playback.ts';
import { rhythmPlan } from '../../core/rhythm.ts';
import { summarizeRhythm } from '../../core/rhythmRun.ts';
import { playOrder, type RepeatMode } from '../../core/repeats.ts';
import { buildSteps, keyRange, type HandSelection } from '../../core/score.ts';
import { waitRange, type BarLoop, type WaitState } from '../../core/wait.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { createAccompanist } from '../../output/accompany.ts';
import { createDemoPlayer, type DemoState } from '../../output/demo.ts';
import { browserClock } from '../../output/scheduler.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { ScoreView, type ScoreStatus } from '../notation/ScoreView.tsx';
import { useOutputState } from '../output/context.ts';
import { ACCOMPANIMENT_LEVELS, readAccompanimentLevel } from '../output/prefs.ts';
import { Piano } from '../piano/Piano.tsx';
import { usePieceSteps, usePracticeStore } from '../practice/context.ts';
import { usePieceFormat } from './format.ts';
import { readPiecePrefs, TEMPOS, writePiecePrefs } from './prefs.ts';
import { useRunRecorder, waitRecording, type RecordableRun, type RecordInput } from './record.ts';
import { RunSummary } from './RunSummary.tsx';
import { runReducer, startRun } from './run.ts';
import { idleRhythm, rhythmReducer } from './rhythm.ts';
import { CalibrationSheet, RhythmStatus } from './RhythmParts.tsx';
import {
  CLICK_MODES,
  readClickMode,
  readClickVolume,
  readLatency,
  writeClickMode,
  writeClickVolume,
} from './rhythmPrefs.ts';
import { RhythmSummary } from './RhythmSummary.tsx';
import { useRhythmPlayer } from './useRhythmPlayer.ts';
import type { OpenPiece } from './usePiece.ts';
import { useBarFormat } from './barFormat.ts';
import { BarTargets, BarTints, WeakBarsBar, WeakBarsTable } from './WeakBars.tsx';

const SHOW_KEYS_PREF = 'dacapo.pieces.showKeys';
const ACCOMPANY_PREF = 'dacapo.pieces.accompany';
const WEAK_BARS_PREF = 'dacapo.pieces.weakBars';
/** Offered once per browser: the calibration before the first rhythm run. */
const CALIBRATION_OFFERED_PREF = 'dacapo.latency.offered';
const MODES: readonly PracticeMode[] = ['wait', 'rhythm'];
const metricOf = (mode: PracticeMode): BarMetric => (mode === 'rhythm' ? 'timing' : 'hesitation');
const WRONG_FLASH_MS = 350;
const HAND_CHOICES = ['right', 'left', 'both'] as const;
const NO_KEYS: readonly number[] = [];
const newRunId = () => crypto.randomUUID();

/** The piece's range on a short keyboard: at least two octaves, white keys at both ends. */
function keyboardRange(low: number, high: number): [number, number] {
  let lo = low - 2;
  let hi = high + 2;
  while (hi - lo < 24) {
    lo--;
    hi++;
  }
  lo = Math.max(PIANO_LOWEST, lo);
  hi = Math.min(PIANO_HIGHEST, hi);
  while (isBlack(lo)) lo--;
  while (isBlack(hi)) hi++;
  return [lo, hi];
}

export function PieceSession({ piece }: { piece: OpenPiece }) {
  const t = useT();
  const { score } = piece;
  const format = usePieceFormat(score.measures);
  const { hub, pointer, output } = useInput();
  const hasOutput = useOutputState().selected !== null;
  const { held, sustained } = useHubState();
  const region = useRef<HTMLElement>(null);
  const options = useRef<HTMLDetailsElement>(null);
  const showKeysId = useId();

  const store = usePracticeStore();
  const [prefs] = useState(() => readPiecePrefs(piece.id));
  const [mode, setModeState] = useState<PracticeMode>(prefs.mode);
  const [hands, setHandsState] = useState<HandSelection>(prefs.hands);
  const [repeats, setRepeats] = useState<RepeatMode>('play');
  const [loop, setLoop] = useState<BarLoop | null>(null);
  const [startBar, setStartBar] = useState(0);
  const [showKeys, setShowKeysState] = useState(() => readPref(SHOW_KEYS_PREF) === '1');
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>({ state: 'loading' });
  const [tempo, setTempo] = useState(prefs.tempo);
  const [weakBars, setWeakBarsState] = useState(() => readPref(WEAK_BARS_PREF) === '1');
  const [metric, setMetric] = useState<BarMetric>(metricOf(prefs.mode));
  const [table, setTable] = useState(false);
  const [accompany, setAccompanyState] = useState(() => readPref(ACCOMPANY_PREF) !== '0');
  const [clickMode, setClickModeState] = useState(readClickMode);
  const [volume, setVolumeState] = useState(readClickVolume);
  const [latency, setLatency] = useState(readLatency);
  /** The sheet offering (or running) the calibration before a rhythm run. */
  const [calibration, setCalibration] = useState<'offer' | 'open' | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  const [player] = useState(() =>
    createDemoPlayer(output.scheduler, browserClock, output.onInterrupt),
  );
  const [accompanist] = useState(() => createAccompanist(output.scheduler, browserClock));
  const demo = useSyncExternalStore(player.subscribe, player.getState);
  const demoStep = useSyncExternalStore(player.subscribe, player.currentStep);
  const listening = demo !== 'stopped';
  const { player: rhythmPlayer, snapshot: beat } = useRhythmPlayer(
    output.scheduler,
    output.onInterrupt,
  );
  const [rhythm, dispatchRhythm] = useReducer(rhythmReducer, newRunId(), idleRhythm);
  const inTime = beat.state !== 'stopped';
  const rhythmMode = mode === 'rhythm';

  const hasRepeats = score.measures.some(
    (m) => m.repeat.backwardTimes !== null || m.repeat.ending.length > 0,
  );
  const order = useMemo(() => playOrder(score.measures, repeats), [score, repeats]);
  const steps = useMemo(() => buildSteps(score, hands, order), [score, hands, order]);
  const range = useMemo(
    () => waitRange(steps, order, loop, startBar),
    [steps, order, loop, startBar],
  );
  const playedBars = useMemo(() => {
    const bars = [...new Set(order.map((p) => p.measure))];
    return bars.sort((a, b) => a - b);
  }, [order]);

  const scale = tempo / 100;
  const plan = useMemo(
    () => demoPlan({ score, order, steps, hands, loop, startBar, scale }),
    [score, order, steps, hands, loop, startBar, scale],
  );
  const backing = useMemo(
    () =>
      hands === 'both'
        ? null
        : accompanimentPlan({ score, order, steps, hand: hands, loop, scale }),
    [score, order, steps, hands, loop, scale],
  );
  const accompanying = accompany && hasOutput && backing !== null && !listening;
  const timed = useMemo(
    () => (rhythmMode ? rhythmPlan({ score, order, steps, loop, startBar, scale }) : null),
    [rhythmMode, score, order, steps, loop, startBar, scale],
  );
  // In rhythm mode the other hand plays in time, from the same timeline.
  const timedBacking = useMemo(
    () =>
      rhythmMode && hands !== 'both' && accompany && hasOutput
        ? demoPlan({ score, order, steps, hands, loop, startBar, scale, include: otherHand(hands) })
        : null,
    [rhythmMode, hands, accompany, hasOutput, score, order, steps, loop, startBar, scale],
  );

  const [run, dispatch] = useReducer(runReducer, { id: newRunId(), steps, range }, startRun);
  // Any change of hands, bars or repeats starts over (React's pattern for state derived from
  // props: set during render, before anything is painted).
  if (run.steps !== steps || run.range !== range)
    dispatch({ type: 'restart', id: newRunId(), steps, range });

  const recorded = useMemo<RecordableRun>(
    () =>
      rhythmMode
        ? {
            id: rhythm.id,
            // A run is practice once a key was played: a Start left to run alone is not.
            records: rhythm.last ? rhythm.records : NO_RECORDS,
            startedEpoch: rhythm.startedEpoch,
            // Played to the end, or a loop ended with Stop (a loop only ends that way).
            ended:
              rhythm.status === 'ended'
                ? {
                    completed: rhythm.end === 'done' || (rhythm.end === 'stopped' && loop !== null),
                  }
                : null,
          }
        : waitRecording(run),
    [rhythmMode, rhythm, run, loop],
  );
  useRunRecorder(
    recorded,
    {
      pieceId: piece.id,
      checksum: piece.facts.checksum,
      title: piece.title,
      hands,
      loop: loop && {
        ...loop,
        fromLabel: score.measures[loop.from]?.number ?? String(loop.from + 1),
        toLabel: score.measures[loop.to]?.number ?? String(loop.to + 1),
      },
      repeats,
      tempo,
      ...(rhythmMode && { mode: 'rhythm' as const }),
    },
    store,
  );

  // The measure heatmap: this piece's step records, read when the page opens.
  const records = usePieceSteps(piece.id);
  const handBars = useMemo(
    () => [...new Set(steps.map((s) => s.measure))].sort((a, b) => a - b),
    [steps],
  );
  const heat = useMemo(
    () =>
      barHeatmap(records ?? [], {
        checksum: piece.facts.checksum,
        hands,
        bars: handBars,
        metric,
      }),
    [records, piece.facts.checksum, hands, handBars, metric],
  );
  const weakest = useMemo(() => weakestLoop(heat.cells, order), [heat, order]);
  const barFormat = useBarFormat(format, metric);

  /** Stops whatever the instrument is playing for us: the demo, the other hand, a rhythm run. */
  function silence() {
    if (rhythmPlayer.getSnapshot().state !== 'stopped') {
      rhythmPlayer.stop();
      // Not a result to look at: the settings changed under it.
      dispatchRhythm({ type: 'hide' });
    }
    if (player.getState() !== 'stopped') player.stop();
    else output.scheduler.panic();
    accompanist.reset();
  }

  const restart = () => {
    silence();
    dispatch({ type: 'restart', id: newRunId(), steps, range });
    region.current?.focus({ preventScroll: true });
  };

  // A new run (other hands, bars, repeats, mode or tempo) or a finished loop: silence. Not on mount.
  const runKey = useRef({ steps, range, ended: run.ended, timed });
  useEffect(() => {
    const previous = runKey.current;
    if (
      previous.steps === steps &&
      previous.range === range &&
      previous.ended === run.ended &&
      previous.timed === timed
    )
      return;
    runKey.current = { steps, range, ended: run.ended, timed };
    silence();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- silence only uses stable objects
  }, [steps, range, run.ended, timed]);
  useEffect(
    () => () => {
      player.stop();
      output.scheduler.panic();
    },
    [player, output],
  );

  // Keys play the wait mode (except while the demo plays), or are timed in a rhythm run.
  const keysTo = useRef({ rhythmMode, calibrating });
  useLayoutEffect(() => {
    keysTo.current = { rhythmMode, calibrating };
  });
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type !== 'on' || keysTo.current.calibrating) return;
        if (keysTo.current.rhythmMode) {
          const result = rhythmPlayer.press(event.midi, event.time);
          if (result.kind !== 'ignored') dispatchRhythm({ type: 'played', result });
          return;
        }
        if (player.getState() === 'stopped')
          dispatch({ type: 'press', midi: event.midi, time: event.time, at: Date.now() });
      }),
    [hub, player, rhythmPlayer],
  );

  // Each completed step sets off the other hand's notes that belong to it.
  const handled = useRef(0);
  useEffect(() => {
    const records = run.records;
    // A new run starts with no records.
    const from = records.length < handled.current ? 0 : handled.current;
    handled.current = records.length;
    if (!accompanying || !backing) return;
    const velocity = ACCOMPANIMENT_LEVELS[readAccompanimentLevel()];
    for (const record of records.slice(from))
      accompanist.complete(backing, record.step, record.at, velocity);
  }, [run.records, accompanying, backing, accompanist]);

  function setAccompany(next: boolean) {
    setAccompanyState(next);
    writePref(ACCOMPANY_PREF, next ? null : '0');
    silence();
  }

  function onListen() {
    // The player's own state: a click can come before React has rendered the last change.
    const state = player.getState();
    if (state === 'playing') player.pause();
    else if (state === 'paused') player.resume();
    else if (plan) {
      accompanist.reset();
      if (rhythmPlayer.getSnapshot().state !== 'stopped') {
        rhythmPlayer.stop();
        dispatchRhythm({ type: 'hide' });
      }
      // Listening is not hesitation: the step's clock starts again at the next key.
      dispatch({ type: 'pauseClock' });
      player.play(plan, DEMO_VELOCITY);
    }
  }

  /** Starts a rhythm run (from a click: the click needs a user gesture to sound). */
  function startRhythm() {
    if (!timed) return;
    setCalibration(null);
    if (player.getState() !== 'stopped') player.stop();
    accompanist.reset();
    const id = newRunId();
    const origin = rhythmPlayer.start({
      plan: timed,
      backing: timedBacking,
      velocity: ACCOMPANIMENT_LEVELS[readAccompanimentLevel()],
      clickMode,
      volume,
      latency: readLatency()?.offset ?? 0,
      onSettled: (timings) => dispatchRhythm({ type: 'settled', timings }),
      onEnd: (reason) => dispatchRhythm({ type: 'end', reason }),
    });
    dispatchRhythm({ type: 'start', id, epochOrigin: Date.now() - performance.now() + origin });
    region.current?.focus({ preventScroll: true });
  }

  function onStart() {
    if (rhythmPlayer.getSnapshot().state !== 'stopped') {
      rhythmPlayer.stop();
      return;
    }
    if (!readLatency() && readPref(CALIBRATION_OFFERED_PREF) !== '1') {
      writePref(CALIBRATION_OFFERED_PREF, '1');
      setCalibration('offer');
      return;
    }
    startRhythm();
  }

  function setMode(next: PracticeMode) {
    // The run's last steps are recorded before the mode (and the recorded run) changes.
    if (rhythmPlayer.getSnapshot().state !== 'stopped') flushSync(silence);
    else silence();
    setModeState(next);
    setMetric(metricOf(next));
    writePiecePrefs(piece.id, { mode: next });
    dispatch({ type: 'restart', id: newRunId(), steps, range });
    dispatchRhythm({ type: 'reset', id: newRunId() });
  }

  function changeTempo(next: number) {
    const state = player.getState();
    const at = player.position();
    setTempo(next);
    writePiecePrefs(piece.id, { tempo: next });
    if (state === 'stopped' || !at) return;
    const retimed = demoPlan({ score, order, steps, hands, loop, startBar, scale: next / 100 });
    if (!retimed) {
      player.stop();
      return;
    }
    // Milliseconds scale inversely with the tempo; the place in the music stays.
    player.play(
      retimed,
      DEMO_VELOCITY,
      { round: at.round, ms: (at.ms * tempo) / next },
      state === 'paused',
    );
  }

  const wrongKey = run.wrongKey;
  useEffect(() => {
    if (!wrongKey) return;
    const id = setTimeout(() => dispatch({ type: 'clearWrong', key: wrongKey }), WRONG_FLASH_MS);
    return () => clearTimeout(id);
  }, [wrongKey]);
  const wrong = useMemo(() => new Set(wrongKey ? [wrongKey.midi] : []), [wrongKey]);

  // Selects take keyboard input; after a choice, the keys play notes again.
  const settle = () => region.current?.focus({ preventScroll: true });

  // The options panel closes on Escape and on a click elsewhere.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = options.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  function setHands(next: HandSelection) {
    setHandsState(next);
    writePiecePrefs(piece.id, { hands: next });
  }

  function setWeakBars(next: boolean) {
    setWeakBarsState(next);
    writePref(WEAK_BARS_PREF, next ? '1' : null);
    if (!next) setTable(false);
  }

  function loopWeakest() {
    if (!weakest) return;
    setLoop(weakest);
    setStartBar(weakest.from);
    settle();
  }

  function setShowKeys(next: boolean) {
    setShowKeysState(next);
    writePref(SHOW_KEYS_PREF, next ? '1' : null);
  }

  const wait = run.wait;
  const waitStep = wait && !wait.finished ? (steps[wait.current] ?? null) : null;
  const step = inTime
    ? beat.step === null
      ? null
      : (steps[beat.step] ?? null)
    : listening
      ? demoStep === null
        ? null
        : (steps[demoStep] ?? null)
      : waitStep;
  const done = !rhythmMode && Boolean(wait?.finished || run.ended);
  const summary = useMemo(() => (done ? summarizeRun(run.records) : null), [done, run.records]);
  const rhythmSummary = useMemo(
    () =>
      rhythmMode && rhythm.status === 'ended' && !rhythm.hidden && rhythm.timings.length > 0
        ? summarizeRhythm(rhythm.timings)
        : null,
    [rhythmMode, rhythm],
  );

  const keys = useMemo(() => {
    const span = keyRange(score, 'both') ?? [60, 72];
    return keyboardRange(span[0], span[1]);
  }, [score]);
  const whites = useMemo(() => {
    let n = 0;
    for (let m = keys[0]; m <= keys[1]; m++) if (!isBlack(m)) n++;
    return n;
  }, [keys]);
  const marked = useMemo(() => {
    // While listening the keyboard shows what sounds; otherwise, with Show keys, what to play.
    if (listening) return new Set(step?.midis ?? []);
    if (rhythmMode) return showKeys && step ? new Set(step.midis) : new Set<number>();
    return showKeys && step
      ? new Set(step.midis.filter((m) => !wait?.pressed.includes(m)))
      : new Set<number>();
  }, [listening, rhythmMode, showKeys, step, wait?.pressed]);

  const barOptions = playedBars.map((index) => (
    <option key={index} value={index}>
      {format.barNumber(index)}
    </option>
  ));
  const bpm = Math.round(baseTempo(score) * scale);

  return (
    <section
      className="piece-session"
      ref={region}
      tabIndex={-1}
      aria-labelledby={`${showKeysId}-title`}
    >
      <header className="piece-head">
        <Link href="/pieces" className="piece-back-link">
          {t('pieces.back')}
        </Link>
        <h1 id={`${showKeysId}-title`} className="piece-title">
          {piece.title}
          {piece.composer && <span className="piece-composer">{piece.composer}</span>}
        </h1>
      </header>

      <div className="piece-controls" role="group" aria-label={t('pieces.controls')}>
        <fieldset className="piece-control piece-mode" aria-describedby={`${showKeysId}-mode`}>
          <legend className="visually-hidden">{t('pieces.mode')}</legend>
          <div className="segmented is-compact">
            {MODES.map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name={`${showKeysId}-mode`}
                  value={choice}
                  checked={mode === choice}
                  onChange={() => setMode(choice)}
                />
                <span>{t(`pieces.mode.${choice}`)}</span>
              </label>
            ))}
          </div>
          <span id={`${showKeysId}-mode`} className="visually-hidden">
            {t('pieces.mode.help')}
          </span>
        </fieldset>

        <fieldset className="piece-control">
          <legend className="visually-hidden">{t('pieces.hand')}</legend>
          <div className="segmented is-compact">
            {HAND_CHOICES.map((choice) => (
              <label key={choice}>
                <input
                  type="radio"
                  name={`${showKeysId}-hands`}
                  value={choice}
                  checked={hands === choice}
                  onChange={() => setHands(choice)}
                />
                <span>{t(`pieces.hand.${choice}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="piece-control">
          <span className="piece-control-label" aria-hidden="true">
            {t('pieces.loop')}
          </span>
          <select
            className="is-compact"
            aria-label={t('pieces.loop.from')}
            value={loop?.from ?? ''}
            onChange={(e) => {
              const from = e.target.value === '' ? null : Number(e.target.value);
              setLoop(from === null ? null : { from, to: Math.max(from, loop?.to ?? from) });
              settle();
            }}
          >
            <option value="">{t('pieces.loop.off')}</option>
            {barOptions}
          </select>
          <span aria-hidden="true">–</span>
          <select
            className="is-compact"
            aria-label={t('pieces.loop.to')}
            value={loop?.to ?? ''}
            disabled={!loop}
            onChange={(e) => {
              if (loop) setLoop({ from: loop.from, to: Number(e.target.value) });
              settle();
            }}
          >
            {!loop && <option value="">–</option>}
            {playedBars
              .filter((index) => !loop || index >= loop.from)
              .map((index) => (
                <option key={index} value={index}>
                  {format.barNumber(index)}
                </option>
              ))}
          </select>
          {loop && (
            <button
              type="button"
              className="button-icon"
              aria-label={t('pieces.loop.clear')}
              title={t('pieces.loop.clear')}
              onClick={() => {
                setLoop(null);
                settle();
              }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>

        <label className="piece-control">
          <span className="piece-control-label">{t('pieces.tempo')}</span>
          <select
            className="is-compact"
            aria-label={t('pieces.tempo.label')}
            aria-describedby={`${showKeysId}-bpm`}
            value={tempo}
            onChange={(e) => {
              changeTempo(Number(e.target.value));
              settle();
            }}
          >
            {TEMPOS.map((percent) => (
              <option key={percent} value={percent}>
                {t('pieces.tempo.percent', { percent })}
              </option>
            ))}
          </select>
          <span id={`${showKeysId}-bpm`} className="piece-bpm">
            {t('pieces.tempo.bpm', { bpm })}
          </span>
        </label>

        <details
          className="piece-options"
          ref={options}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && options.current?.open) {
              options.current.open = false;
              options.current.querySelector('summary')?.focus();
            }
          }}
        >
          <summary className="button is-compact">{t('pieces.options')}</summary>
          <div className="piece-options-panel">
            <label className="piece-option">
              <span className="piece-control-label">{t('pieces.start')}</span>
              <select
                className="is-compact"
                aria-label={t('pieces.start.label')}
                value={startBar}
                onChange={(e) => setStartBar(Number(e.target.value))}
              >
                {barOptions}
              </select>
            </label>

            {hasRepeats && (
              <fieldset className="piece-option">
                <legend className="visually-hidden">{t('pieces.repeats')}</legend>
                <span className="piece-control-label" aria-hidden="true">
                  {t('pieces.repeats')}
                </span>
                <div className="segmented is-compact">
                  {(['play', 'skip'] as const).map((choice) => (
                    <label key={choice}>
                      <input
                        type="radio"
                        name={`${showKeysId}-repeats`}
                        value={choice}
                        checked={repeats === choice}
                        onChange={() => {
                          setRepeats(choice);
                          setLoop(null);
                        }}
                      />
                      <span>{t(`pieces.repeats.${choice}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {rhythmMode && (
              <fieldset className="piece-option">
                <legend className="visually-hidden">{t('pieces.click')}</legend>
                <span className="piece-control-label" aria-hidden="true">
                  {t('pieces.click')}
                </span>
                <div className="segmented is-compact">
                  {CLICK_MODES.map((choice) => (
                    <label key={choice}>
                      <input
                        type="radio"
                        name={`${showKeysId}-click`}
                        value={choice}
                        checked={clickMode === choice}
                        onChange={() => {
                          setClickModeState(choice);
                          writeClickMode(choice);
                        }}
                      />
                      <span>{t(`pieces.click.${choice}`)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {rhythmMode && (
              <label className="piece-option">
                <span className="piece-control-label">{t('pieces.click.volume')}</span>
                <input
                  type="range"
                  className="piece-volume"
                  min={0}
                  max={100}
                  step={5}
                  value={volume}
                  disabled={clickMode === 'off'}
                  onChange={(e) => {
                    setVolumeState(Number(e.target.value));
                    writeClickVolume(Number(e.target.value));
                  }}
                />
              </label>
            )}

            <div className="piece-option-checks">
              {hands !== 'both' && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={accompany && hasOutput}
                    disabled={!hasOutput}
                    onChange={(e) => setAccompany(e.target.checked)}
                    aria-describedby={`${showKeysId}-accompany`}
                  />
                  <span>{t('pieces.accompany')}</span>
                </label>
              )}
              <span id={`${showKeysId}-accompany`} className="visually-hidden">
                {t('pieces.accompany.help')}
              </span>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showKeys}
                  onChange={(e) => setShowKeys(e.target.checked)}
                  aria-describedby={`${showKeysId}-keys`}
                />
                <span>{t('pieces.showKeys')}</span>
              </label>
              <span id={`${showKeysId}-keys`} className="visually-hidden">
                {t('pieces.showKeys.help')}
              </span>
              <label className="check">
                <input
                  type="checkbox"
                  checked={weakBars}
                  onChange={(e) => setWeakBars(e.target.checked)}
                  aria-describedby={`${showKeysId}-weak`}
                />
                <span>{t('pieces.weak')}</span>
              </label>
              <span id={`${showKeysId}-weak`} className="visually-hidden">
                {t('pieces.weak.help')}
              </span>
            </div>

            {rhythmMode && (
              <p className="piece-option piece-latency">
                <span>
                  {latency ? t('pieces.latency', { ms: latency.offset }) : t('pieces.latency.none')}
                </span>
                <button
                  type="button"
                  className="button is-compact"
                  disabled={inTime}
                  onClick={() => {
                    if (options.current) options.current.open = false;
                    setCalibration('open');
                  }}
                >
                  {t('pieces.latency.calibrate')}
                </button>
              </p>
            )}
          </div>
        </details>
      </div>

      {weakBars && (
        <WeakBarsBar
          format={barFormat}
          loading={records === null}
          staleRuns={heat.staleRuns}
          loopLabel={
            weakest &&
            (weakest.from === weakest.to
              ? format.barNumber(weakest.from)
              : `${format.barNumber(weakest.from)}–${format.barNumber(weakest.to)}`)
          }
          onLoop={loopWeakest}
          onTable={() => setTable(true)}
          onMetric={setMetric}
        />
      )}

      <div className="piece-stage">
        <ScoreView
          xml={piece.xml}
          score={score}
          title={piece.title}
          step={step}
          pressed={listening || rhythmMode ? NO_KEYS : (wait?.pressed ?? NO_KEYS)}
          hands={hands}
          onStatus={setScoreStatus}
          behind={
            weakBars
              ? (boxes) => <BarTints cells={heat.cells} boxes={boxes} format={barFormat} />
              : undefined
          }
          above={
            weakBars
              ? (boxes) => <BarTargets cells={heat.cells} boxes={boxes} format={barFormat} />
              : undefined
          }
        />
        {scoreStatus.state !== 'ready' && (
          <div className="piece-overlay" role="status">
            <p className={scoreStatus.state === 'failed' ? 'piece-error' : 'muted'}>
              {scoreStatus.state === 'loading'
                ? t('pieces.preparing')
                : scoreStatus.reason === 'engine'
                  ? t('pieces.engineFailed')
                  : t('pieces.renderFailed')}
            </p>
          </div>
        )}
        {table && weakBars && !summary && !rhythmSummary && (
          <WeakBarsTable
            cells={heat.cells}
            format={barFormat}
            onClose={() => {
              setTable(false);
              settle();
            }}
          />
        )}
        {summary && (
          <RunSummary
            summary={summary}
            looped={run.ended}
            format={format}
            onAgain={restart}
            onLoopBar={(bar) => {
              setLoop({ from: bar, to: bar });
              settle();
            }}
          />
        )}
        {rhythmSummary && !calibration && (
          <RhythmSummary
            summary={rhythmSummary}
            done={rhythm.end === 'done'}
            looped={loop !== null}
            format={format}
            onAgain={startRhythm}
            onLoopBars={(from, to) => {
              setLoop({ from, to });
              setStartBar(from);
              dispatchRhythm({ type: 'reset', id: newRunId() });
              settle();
            }}
            onClose={() => {
              dispatchRhythm({ type: 'hide' });
              settle();
            }}
          />
        )}
        {calibration && (
          <CalibrationSheet
            offer={calibration === 'offer'}
            onCalibrate={() => setCalibration('open')}
            onStart={startRhythm}
            onRunning={setCalibrating}
            onChange={setLatency}
            onClose={() => {
              setCalibration(null);
              settle();
            }}
          />
        )}
      </div>

      <div className="piece-status">
        {rhythmMode ? (
          <RhythmStatus
            beat={beat}
            ended={rhythm.status === 'ended' && rhythm.timings.length === 0}
            last={rhythm.last}
            nothing={!range || !timed}
            click={clickMode}
            bpm={bpm}
            step={step}
            bar={step ? format.bar(step.measure) : ''}
            beatLabel={step ? format.beat(step.beat) : ''}
          />
        ) : (
          <StatusLine
            demo={demo}
            bpm={bpm}
            wait={wait}
            step={step}
            started={run.startedAt !== null}
            nothing={!range}
            showKeys={showKeys}
            total={range ? range.last - range.first + 1 : 0}
            bar={step ? format.bar(step.measure) : ''}
            beat={step ? format.beat(step.beat) : ''}
          />
        )}
        <div className="piece-notes">
          {scoreStatus.state === 'ready' && scoreStatus.unplaced > 0 && (
            <p className="muted">{t('pieces.unplaced', { n: scoreStatus.unplaced })}</p>
          )}
          <KeyboardLine />
          {!hasOutput && (
            <p className="muted">
              <Link href="/settings">{t('pieces.output.needed')}</Link>
            </p>
          )}
        </div>
        <div className="piece-actions">
          <button
            type="button"
            className="button is-compact piece-listen"
            disabled={!hasOutput || !plan || inTime}
            aria-describedby={`${showKeysId}-listen`}
            onClick={onListen}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              {demo === 'playing' ? (
                <path d="M5 3.5v9M11 3.5v9" />
              ) : (
                <path d="M5 3l8 5-8 5z" className="is-filled" />
              )}
            </svg>
            <span>
              {demo === 'playing'
                ? t('pieces.demo.pause')
                : demo === 'paused'
                  ? t('pieces.demo.resume')
                  : t('pieces.demo')}
            </span>
          </button>
          <span id={`${showKeysId}-listen`} className="visually-hidden">
            {t('pieces.demo.help')}
          </span>
          {listening && (
            <button
              type="button"
              className="button-icon"
              aria-label={t('pieces.demo.stop')}
              title={t('pieces.demo.stop')}
              onClick={() => {
                player.stop();
                settle();
              }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="4" y="4" width="8" height="8" rx="1" className="is-filled" />
              </svg>
            </button>
          )}
          {rhythmMode ? (
            <button
              type="button"
              className={
                inTime ? 'button is-compact piece-go' : 'button button-primary is-compact piece-go'
              }
              disabled={!timed || calibrating}
              aria-describedby={`${showKeysId}-go`}
              onClick={onStart}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                {inTime ? (
                  <rect x="4" y="4" width="8" height="8" rx="1" className="is-filled" />
                ) : (
                  <circle cx="8" cy="8" r="4.5" className="is-filled" />
                )}
              </svg>
              <span>{inTime ? t('pieces.rhythm.stop') : t('pieces.rhythm.start')}</span>
            </button>
          ) : (
            <>
              {loop && run.startedAt !== null && !done && (
                <button
                  type="button"
                  className="button is-compact"
                  onClick={() => dispatch({ type: 'end' })}
                >
                  {t('pieces.finish')}
                </button>
              )}
              <button type="button" className="button is-compact" onClick={restart}>
                {t('pieces.restart')}
              </button>
            </>
          )}
          {rhythmMode && (
            <span id={`${showKeysId}-go`} className="visually-hidden">
              {t('pieces.rhythm.help')}
            </span>
          )}
        </div>
      </div>

      <div className="piece-keys" style={{ '--piece-whites': whites } as CSSProperties}>
        <Piano
          held={held}
          sustained={sustained}
          pointer={pointer}
          marked={marked}
          wrong={rhythmMode ? NO_WRONG : wrong}
          range={keys}
          className="piece-piano"
        />
      </div>
    </section>
  );
}

const NO_WRONG: ReadonlySet<number> = new Set();
const NO_RECORDS: readonly RecordInput[] = [];

function StatusLine({
  demo,
  bpm,
  wait,
  step,
  started,
  nothing,
  showKeys,
  total,
  bar,
  beat,
}: {
  demo: DemoState;
  bpm: number;
  wait: WaitState | null;
  step: { pass: number; midis: number[] } | null;
  started: boolean;
  nothing: boolean;
  showKeys: boolean;
  total: number;
  bar: string;
  beat: string;
}) {
  const t = useT();
  if (nothing) return <p className="piece-status-main">{t('pieces.nothing')}</p>;
  if (demo !== 'stopped') {
    const parts = [t(demo === 'paused' ? 'pieces.status.demoPaused' : 'pieces.status.demo')];
    if (step) {
      parts.push(
        `${t('pieces.status.bar', { bar })}${step.pass > 1 ? ` (${t('pieces.status.repeat')})` : ''}`,
        t('pieces.status.beat', { beat }),
      );
    }
    parts.push(t('pieces.tempo.bpm', { bpm }));
    return (
      <p className="piece-status-main">
        <span>{parts.join(' · ')}</span>
      </p>
    );
  }
  if (!wait || !step) return <p className="piece-status-main" />;
  const parts = [
    `${t('pieces.status.bar', { bar })}${step.pass > 1 ? ` (${t('pieces.status.repeat')})` : ''}`,
    t('pieces.status.beat', { beat }),
    t('pieces.status.step', { n: wait.current - wait.first + 1, total }),
  ];
  if (wait.wrong > 0) parts.push(t('pieces.status.wrong', { n: wait.wrong }));
  if (wait.laps > 0) parts.push(t('pieces.status.lap', { n: wait.laps + 1 }));
  return (
    <p className="piece-status-main">
      <span>{parts.join(' · ')}</span>
      {showKeys && (
        <strong className="piece-status-keys">
          {t('pieces.status.keys', { notes: step.midis.map((m) => midiName(m)).join(' ') })}
        </strong>
      )}
      {!started && <span className="muted piece-status-ready">{t('pieces.status.ready')}</span>}
    </p>
  );
}

/** Without a MIDI keyboard the octave of the computer keyboard decides the key. */
function KeyboardLine() {
  const t = useT();
  const octave = useKeyboardOctave();
  if (!useKeyboardFallback()) return null;
  return <p className="muted">{t('read.keyboard', { octave })}</p>;
}
