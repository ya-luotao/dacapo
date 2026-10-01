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
import { analyzeExpression, type Melody } from '../../core/expression.ts';
import { leftHandFor, leftHandPatterns, type LeftHandChoice } from '../../core/leadSheet.ts';
import { parseMeter, tempoForMeter } from '../../core/metronomeSettings.ts';
import { midiName } from '../../core/note.ts';
import { pieceFacts, type PieceFacts, type PracticeMode } from '../../core/pieceRecords.ts';
import { summarizeRun } from '../../core/pieceRun.ts';
import {
  accompanimentPlan,
  baseTempo,
  DEMO_VELOCITY,
  demoPlan,
  otherHand,
} from '../../core/playback.ts';
import type { TrillStart } from '../../core/ornaments.ts';
import { isProgressionPieceId } from '../../core/progressions.ts';
import { rhythmPlan } from '../../core/rhythm.ts';
import {
  PEDALS_UP,
  type PedalPositions,
  type TakeEvent,
  type TakeInput,
} from '../../core/takes.ts';
import {
  comparePlayback,
  keysStruck,
  playbackAt,
  takePlayback,
  type PlaybackRun,
  type TakePlayback,
} from '../../core/takePlayback.ts';
import { summarizeRhythm } from '../../core/rhythmRun.ts';
import { playOrder, type RepeatMode } from '../../core/repeats.ts';
import { buildSteps, keyRange, type HandSelection, type Score } from '../../core/score.ts';
import { waitRange, type BarLoop, type WaitState } from '../../core/wait.ts';
import type { TakeState } from '../../core/takes.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { withLeftHand } from '../../pieces/derive.ts';
import { createAccompanist } from '../../output/accompany.ts';
import { createDemoPlayer, type DemoState } from '../../output/demo.ts';
import { browserClock } from '../../output/scheduler.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { useMetronome, useOfferTempo } from '../metronome/context.ts';
import { ScoreView, type ScoreStatus } from '../notation/ScoreView.tsx';
import { useOutputState } from '../output/context.ts';
import { ACCOMPANIMENT_LEVELS, readAccompanimentLevel } from '../output/prefs.ts';
import { Piano } from '../piano/Piano.tsx';
import { keyboardRange, whiteKeys } from '../piano/range.ts';
import { usePieceSteps, usePracticeStore } from '../practice/context.ts';
import { usePieceFormat } from './format.ts';
import { readPiecePrefs, TEMPOS, writePiecePrefs } from './prefs.ts';
import { useRunRecorder, waitRecording, type RecordableRun, type RecordInput } from './record.ts';
import { RunSummary } from './RunSummary.tsx';
import { runReducer, startRun, takeDone } from './run.ts';
import { idleRhythm, rhythmReducer, rhythmTakeDone } from './rhythm.ts';
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
import { FocusBar, FocusEnter } from '../focus/FocusBar.tsx';
import { useFocusState } from '../focus/focus.ts';
import { BarTargets, BarTints, WeakBarsBar, WeakBarsTable } from './WeakBars.tsx';
import { ExpressionPanel } from './ExpressionPanel.tsx';
import {
  EXPRESSION_ASPECTS,
  readExpressionAspects,
  writeExpressionAspects,
  type ExpressionAspect,
} from './expressionPrefs.ts';
import { SaveTake } from './SaveTake.tsx';
import { usePieceRuns } from './runs.ts';
import { YourRuns } from './YourRuns.tsx';
import { PlaybackBar, type CompareChoice } from './PlaybackBar.tsx';
import { useLogFormat } from '../progress/format.ts';
import {
  hiddenBars,
  PROMPT_SHOW_MS,
  promptsByBar,
  randomPhraseStart,
  START_SHOW_MS,
  type MemoryStage,
} from '../../core/memory.ts';
import { HiddenBarNumbers, MemoryStageSelect } from './MemoryParts.tsx';
import { usePieceReview, useReviewOut } from './review.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';

const SHOW_KEYS_PREF = 'dacapo.pieces.showKeys';
const ACCOMPANY_PREF = 'dacapo.pieces.accompany';
const WEAK_BARS_PREF = 'dacapo.pieces.weakBars';
/** Offered once per browser: the calibration before the first rhythm run. */
const CALIBRATION_OFFERED_PREF = 'dacapo.latency.offered';
const MODES: readonly PracticeMode[] = ['wait', 'rhythm', 'memory'];
const metricOf = (mode: PracticeMode): BarMetric =>
  mode === 'rhythm' ? 'timing' : mode === 'memory' ? 'memory' : 'hesitation';
const WRONG_FLASH_MS = 350;
const HAND_CHOICES = ['right', 'left', 'both'] as const;
const NO_KEYS: readonly number[] = [];
const opposite = (hand: 'right' | 'left') => (hand === 'right' ? 'left' : 'right');
const newRunId = () => crypto.randomUUID();

/** Where the page's back link goes: the Pieces page, or the page a generated piece came from. */
export interface PieceBack {
  href: string;
  label: string;
}

export function PieceSession({ piece, back }: { piece: OpenPiece; back?: PieceBack }) {
  const t = useT();
  const backTo = back ?? { href: '/pieces', label: t('pieces.back') };
  const [prefs] = useState(() => readPiecePrefs(piece.id));
  // The left hand: as written, or a pattern made from the chord symbols and written into the
  // score (docs/HARMONY.md, "Lead sheets (H3)"). A progression's pattern is its own.
  // (The piece is a new object whenever the page renders: its parts are what stays the same.)
  const { xml: writtenXml, score: written, facts: writtenFacts } = piece;
  const patterns = useMemo(
    () => (isProgressionPieceId(piece.id) ? [] : leftHandPatterns(written)),
    [piece.id, written],
  );
  const [leftHandChoice, setLeftHandState] = useState<LeftHandChoice | null>(prefs.leftHand);
  const practised = useMemo(
    () =>
      practise(
        { xml: writtenXml, score: written, facts: writtenFacts },
        patterns.length > 0 ? leftHandFor(written, leftHandChoice ?? undefined) : 'written',
      ),
    [writtenXml, written, writtenFacts, patterns, leftHandChoice],
  );
  const { score, leftHand } = practised;
  const { checksum } = practised.facts;
  const format = usePieceFormat(score.measures);
  const { hub, pointer, output } = useInput();
  const hasOutput = useOutputState().selected !== null;
  const { held, sustained } = useHubState();
  const region = useRef<HTMLElement>(null);
  const options = useRef<HTMLDetailsElement>(null);
  const showKeysId = useId();
  const focus = useFocusState();
  // In focus mode the controls fold away until asked for.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Folded again for the next time focus mode is entered.
  if (!focus.on && settingsOpen) setSettingsOpen(false);

  const store = usePracticeStore();
  const review = usePieceReview(piece.id, piece.facts);
  const reviewOut = useReviewOut(piece.id);
  const [mode, setModeState] = useState<PracticeMode>(prefs.mode);
  const [handsChoice, setHandsState] = useState<HandSelection>(prefs.hands);
  // A hand the piece has nothing for cannot be chosen: the other one is practised instead (a
  // lead sheet with its left hand as written has only the right; Both is then the right hand).
  const playable = {
    right: practised.facts.bars.right > 0,
    left: practised.facts.bars.left > 0,
    both: true,
  };
  const hands: HandSelection =
    handsChoice !== 'both' && !playable[handsChoice] && playable[opposite(handsChoice)]
      ? opposite(handsChoice)
      : handsChoice;
  const [repeats, setRepeats] = useState<RepeatMode>('play');
  const [loop, setLoop] = useState<BarLoop | null>(null);
  const [startBar, setStartBar] = useState(0);
  const [showKeys, setShowKeysState] = useState(() => readPref(SHOW_KEYS_PREF) === '1');
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>({ state: 'loading' });
  const [tempo, setTempo] = useState(prefs.tempo);
  const [melody, setMelodyState] = useState<Melody>(prefs.melody);
  /** Where the piece's trills start: its setting, for the demo, the other hand and rhythm mode. */
  const [trillStart, setTrillStartState] = useState<TrillStart>(prefs.trillStart);
  const hasTrill = useMemo(
    () => score.notes.some((n) => n.ornaments?.some((o) => o.kind === 'trill')),
    [score],
  );
  /** The aspects of expression judged, per browser. */
  const [aspects, setAspectsState] = useState<ExpressionAspect[]>(readExpressionAspects);
  /** "Your runs", laid over the score. */
  const [runsOpen, setRunsOpen] = useState(false);
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
  const demoCue = useSyncExternalStore(player.subscribe, player.cue);
  /** A run played back (docs/PIECES.md, "Play back your run"): the sheets give way to the score. */
  const [playback, setPlayback] = useState<OpenPlayback | null>(null);
  const log = useLogFormat();
  const listening = demo !== 'stopped';
  const metronome = useMetronome();
  const { player: rhythmPlayer, snapshot: beat } = useRhythmPlayer(
    output.scheduler,
    output.onInterrupt,
    () => metronome.block('rhythm'),
  );
  const [rhythm, dispatchRhythm] = useReducer(rhythmReducer, newRunId(), idleRhythm);
  /** What the rhythm run was started with: its result is read against it, whatever changes since. */
  const [rhythmSettings, setRhythmSettings] = useState<RunSettings | null>(null);
  const inTime = beat.state !== 'stopped';
  const rhythmMode = mode === 'rhythm';
  const memoryMode = mode === 'memory';
  /** Memory mode: how much of the score is shown (per piece, in this browser). */
  const [stage, setStageState] = useState<MemoryStage>(prefs.memoryStage);

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
    () => demoPlan({ score, order, steps, hands, loop, startBar, scale, trillStart }),
    [score, order, steps, hands, loop, startBar, scale, trillStart],
  );
  const backing = useMemo(
    () =>
      hands === 'both'
        ? null
        : accompanimentPlan({ score, order, steps, hand: hands, loop, scale, trillStart }),
    [score, order, steps, hands, loop, scale, trillStart],
  );
  const accompanying = accompany && hasOutput && backing !== null && !listening;
  const timed = useMemo(
    () =>
      rhythmMode ? rhythmPlan({ score, order, steps, loop, startBar, scale, trillStart }) : null,
    [rhythmMode, score, order, steps, loop, startBar, scale, trillStart],
  );
  // In rhythm mode the other hand plays in time, from the same timeline.
  const timedBacking = useMemo(
    () =>
      rhythmMode && hands !== 'both' && accompany && hasOutput
        ? demoPlan({
            score,
            order,
            steps,
            hands,
            loop,
            startBar,
            scale,
            include: otherHand(hands),
            trillStart,
          })
        : null,
    [
      rhythmMode,
      hands,
      accompany,
      hasOutput,
      score,
      order,
      steps,
      loop,
      startBar,
      scale,
      trillStart,
    ],
  );

  // Memory mode: the bars hidden at the stage, for a run from its first bar (P7).
  const firstBar = range ? (steps[range.start ?? range.first]?.measure ?? startBar) : startBar;
  const memory = useMemo(
    () => (memoryMode ? { stage, hidden: hiddenBars(score.measures, stage, firstBar) } : null),
    [memoryMode, stage, score, firstBar],
  );
  const [run, dispatch] = useReducer(
    runReducer,
    { id: newRunId(), steps, range, memory },
    startRun,
  );
  // Any change of hands, bars, repeats or what is hidden starts over (React's pattern for state
  // derived from props: set during render, before anything is painted).
  if (run.steps !== steps || run.range !== range || run.memory !== memory)
    dispatch({ type: 'restart', id: newRunId(), steps, range, memory });

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
            take: rhythm.take,
            takeDone: rhythmTakeDone(rhythm),
          }
        : waitRecording(run),
    [rhythmMode, rhythm, run, loop],
  );
  useRunRecorder(
    recorded,
    {
      pieceId: piece.id,
      checksum,
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
      ...(memoryMode && { mode: 'memory' as const }),
      ...(leftHand !== 'written' && { leftHand }),
    },
    store,
  );

  // The measure heatmap: this piece's step records, read when the page opens.
  const allRecords = usePieceSteps(piece.id);
  // Runs with another left hand are runs of other notes: neither counted nor an older version.
  const runs = usePieceRuns(piece.id);
  const records = useMemo(() => {
    if (!allRecords) return null;
    const others = new Set(
      runs.filter((run) => (run.leftHand ?? 'written') !== leftHand).map((run) => run.id),
    );
    return others.size === 0 ? allRecords : allRecords.filter((r) => !others.has(r.sessionId));
  }, [allRecords, runs, leftHand]);
  const handBars = useMemo(
    () => [...new Set(steps.map((s) => s.measure))].sort((a, b) => a - b),
    [steps],
  );
  const heat = useMemo(
    () =>
      barHeatmap(records ?? [], {
        checksum,
        hands,
        bars: handBars,
        metric,
      }),
    [records, checksum, hands, handBars, metric],
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
    setPlayback(null);
  }

  const restart = () => {
    silence();
    dispatch({ type: 'restart', id: newRunId(), steps, range, memory });
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

  // Keys play the wait mode (except while the demo plays), or are timed in a rhythm run. Key-ups
  // and pedals go to the run's take while it may be open (from a key sent to the run until a
  // render says otherwise), so nothing else re-renders the page.
  const keysTo = useRef({ rhythmMode, calibrating, playingBack: false });
  const takeOpen = useRef(false);
  const pedals = useRef<PedalPositions>(PEDALS_UP);
  useLayoutEffect(() => {
    keysTo.current = { rhythmMode, calibrating, playingBack: playback !== null };
    takeOpen.current = rhythmMode
      ? rhythm.take !== null && !rhythmTakeDone(rhythm)
      : run.take !== null && !takeDone(run);
  });
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'pedal')
          pedals.current = { ...pedals.current, [event.controller]: event.value };
        if (event.type === 'sustain' || keysTo.current.calibrating) return;
        if (event.type !== 'on') {
          if (!takeOpen.current) return;
          const input: TakeInput =
            event.type === 'pedal'
              ? {
                  type: 'pedal',
                  controller: event.controller,
                  value: event.value,
                  time: event.time,
                }
              : { type: 'off', midi: event.midi, time: event.time };
          if (keysTo.current.rhythmMode) dispatchRhythm({ type: 'input', input });
          else if (player.getState() === 'stopped') dispatch({ type: 'input', input });
          return;
        }
        if (keysTo.current.rhythmMode) {
          if (rhythmPlayer.getSnapshot().state === 'stopped') return;
          const result = rhythmPlayer.press(event.midi, event.time);
          const { midi, velocity, time } = event;
          dispatchRhythm({ type: 'played', result, midi, velocity, time });
          return;
        }
        // Not while the demo or a run played back is on (or the transport is open).
        if (player.getState() !== 'stopped' || keysTo.current.playingBack) return;
        takeOpen.current = true;
        dispatch({
          type: 'press',
          midi: event.midi,
          velocity: event.velocity,
          time: event.time,
          at: Date.now(),
          pedals: pedals.current,
        });
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
    const latency = readLatency()?.offset ?? 0;
    const origin = rhythmPlayer.start({
      plan: timed,
      backing: timedBacking,
      velocity: ACCOMPANIMENT_LEVELS[readAccompanimentLevel()],
      clickMode,
      volume,
      latency,
      onSettled: (timings) => dispatchRhythm({ type: 'settled', timings }),
      onEnd: (reason) => dispatchRhythm({ type: 'end', reason }),
    });
    takeOpen.current = true;
    setRhythmSettings({ hands, repeats, loop, tempo, latency });
    dispatchRhythm({
      type: 'start',
      id,
      epochOrigin: Date.now() - performance.now() + origin,
      origin,
      latency,
      pedals: pedals.current,
    });
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
    // The memory of the new mode is set as the page renders again: a restart follows there.
    dispatch({ type: 'restart', id: newRunId(), steps, range, memory });
    dispatchRhythm({ type: 'reset', id: newRunId() });
  }

  function changeTempo(next: number) {
    const state = player.getState();
    const at = player.position();
    setTempo(next);
    writePiecePrefs(piece.id, { tempo: next });
    if (state === 'stopped' || !at || playback) return;
    const retimed = demoPlan({
      score,
      order,
      steps,
      hands,
      loop,
      startBar,
      scale: next / 100,
      trillStart,
    });
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

  // Memory mode (docs/PIECES.md, "Memorising"): a wrong key in a hidden bar shows the step's notes
  // for a moment; Peek (the P key, or the button, held) shows the bar; Start anywhere shows its
  // first bar for two seconds. Each prompt is counted by the run.
  /** The step a wrong key fell on in a hidden bar, shown for a moment: its notes and keys. */
  const [prompt, setPrompt] = useState<{ noteIds: string[]; midis: number[] } | null>(null);
  const promptNotes = prompt?.noteIds ?? null;
  const [peeking, setPeeking] = useState(false);
  const [startShown, setStartShown] = useState<number | null>(null);
  // Set as the page renders (React's pattern for state derived from a change), on each wrong key.
  const [prompted, setPrompted] = useState(wrongKey);
  if (wrongKey !== prompted) {
    setPrompted(wrongKey);
    const fell = wrongKey ? run.steps[wrongKey.step] : undefined;
    // A new object each time, so a second wrong key shows them for as long again.
    if (fell && run.memory?.hidden.has(fell.measure))
      setPrompt({ noteIds: fell.noteIds, midis: fell.midis });
  }
  useEffect(() => {
    if (!prompt) return;
    const id = setTimeout(() => setPrompt(null), PROMPT_SHOW_MS);
    return () => clearTimeout(id);
  }, [prompt]);
  useEffect(() => {
    if (startShown === null) return;
    const id = setTimeout(() => setStartShown(null), START_SHOW_MS);
    return () => clearTimeout(id);
  }, [startShown]);
  // A new run or another stage forgets what was shown.
  const [shownFor, setShownFor] = useState(run.id);
  if (shownFor !== run.id) {
    setShownFor(run.id);
    setPrompt(null);
  }

  function peek(held: boolean) {
    if (held && !peeking) dispatch({ type: 'peek' });
    setPeeking(held);
  }
  const peekRef = useRef(peek);
  useLayoutEffect(() => {
    peekRef.current = peek;
  });
  useEffect(() => {
    if (!memoryMode) return;
    const typing = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName));
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'KeyP' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target))
        return;
      e.preventDefault();
      peekRef.current(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') peekRef.current(false);
    };
    const onBlur = () => peekRef.current(false);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [memoryMode]);

  /** A random phrase start of the bars practised, to play from: as a teacher asks at a lesson. */
  function startAnywhere() {
    const bars = range
      ? [...new Set(steps.slice(range.first, range.last + 1).map((s) => s.measure))]
      : playedBars;
    const next = randomPhraseStart(score.measures, bars, firstBar);
    if (next === null) return;
    silence();
    setStartBar(next);
    setStartShown(next);
    settle();
  }

  function setStage(next: MemoryStage) {
    setStageState(next);
    writePiecePrefs(piece.id, { memoryStage: next });
    settle();
  }

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

  function setLeftHand(next: LeftHandChoice) {
    setLeftHandState(next);
    writePiecePrefs(piece.id, { leftHand: next });
    settle();
  }

  // The library's line for the piece counts its steady bars without opening the file: it is
  // told the checksum and the bars of the piece with this left hand.
  const practisedFacts = leftHand === 'written' ? null : practised.facts;
  useEffect(() => {
    const kept = readPiecePrefs(piece.id).practised;
    if ((kept?.checksum ?? null) === (practisedFacts?.checksum ?? null)) return;
    writePiecePrefs(piece.id, {
      practised: practisedFacts && { checksum: practisedFacts.checksum, bars: practisedFacts.bars },
    });
  }, [piece.id, practisedFacts]);

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

  function setAspect(aspect: ExpressionAspect, on: boolean) {
    const next = EXPRESSION_ASPECTS.filter((a) => (a === aspect ? on : aspects.includes(a)));
    setAspectsState(next);
    writeExpressionAspects(next);
  }

  function setMelody(next: Melody) {
    setMelodyState(next);
    writePiecePrefs(piece.id, { melody: next });
  }

  function setTrillStart(next: TrillStart) {
    setTrillStartState(next);
    writePiecePrefs(piece.id, { trillStart: next });
  }

  /** Loops written bars from an Expression panel: the next run plays them. */
  function loopBars(from: number, to: number) {
    setRunsOpen(false);
    setLoop({ from, to });
    setStartBar(from);
    dispatchRhythm({ type: 'reset', id: newRunId() });
    settle();
  }

  /** The plan of a run played back: as it was played, or compared with the score as written. */
  function playbackOf(source: PlaybackSource, compare: CompareChoice): TakePlayback | null {
    const input: PlaybackRun = {
      score,
      hands: source.settings.hands,
      repeats: source.settings.repeats,
      loop: source.settings.loop,
      mode: source.mode,
      tempo: source.settings.tempo,
      latency: source.settings.latency,
      events: source.events,
      trillStart,
    };
    return compare === 'off' ? takePlayback(input) : comparePlayback(input, compare);
  }

  /** Plays a run back: whatever plays stops, and listening is no hesitation. */
  function startPlayback(source: PlaybackSource) {
    const data = playbackOf(source, 'off');
    if (!data) return;
    silence();
    dispatch({ type: 'pauseClock' });
    setPlayback({ source, compare: 'off', data });
    player.play(data.plan, DEMO_VELOCITY);
  }

  function togglePlayback() {
    if (!playback) return;
    const state = player.getState();
    if (state === 'playing') player.pause();
    else if (state === 'paused') player.resume();
    else player.play(playback.data.plan, DEMO_VELOCITY);
  }

  function playbackFrom(measure: number) {
    const bar = playback?.data.bars.find((b) => b.measure === measure);
    if (!playback || !bar) return;
    player.play(playback.data.plan, DEMO_VELOCITY, { round: 0, ms: bar.at });
  }

  function comparePlaybackBy(compare: CompareChoice) {
    if (!playback) return;
    const data = playbackOf(playback.source, compare);
    if (!data) return;
    setPlayback({ ...playback, compare, data });
    player.play(data.plan, DEMO_VELOCITY);
  }

  function closePlayback() {
    player.stop();
    setPlayback(null);
    settle();
  }

  function setShowKeys(next: boolean) {
    setShowKeysState(next);
    writePref(SHOW_KEYS_PREF, next ? '1' : null);
  }

  const wait = run.wait;
  const waitStep = wait && !wait.finished ? (steps[wait.current] ?? null) : null;
  // A run played back: its own steps (its hands and repeats), the keys of the step struck so far,
  // and what sounds at this moment (read again as each key of the plan goes down or up).
  const playing = playback && demo !== 'stopped' ? playback.data : null;
  const playbackStep = playing && demoStep !== null ? (playing.steps[demoStep] ?? null) : null;
  const playbackView = useMemo(() => {
    if (!playing) return null;
    const ms = player.position()?.ms ?? 0;
    const since = playing.plan.steps.findLast((s) => s.at <= ms)?.at ?? 0;
    return {
      ...playbackAt(playing, ms),
      pressed: demoStep === null ? NO_KEYS : keysStruck(playing, demoStep, since, ms),
      cue: demoCue,
    };
  }, [playing, player, demoStep, demoCue]);
  // Bars a peek or Start anywhere shows (memory mode).
  const revealedBars = useMemo(() => {
    const bars = new Set<number>();
    if (peeking && waitStep) bars.add(waitStep.measure);
    if (startShown !== null) bars.add(startShown);
    return bars;
  }, [peeking, waitStep, startShown]);
  const step = playback
    ? playbackStep
    : inTime
      ? beat.step === null
        ? null
        : (steps[beat.step] ?? null)
      : listening
        ? demoStep === null
          ? null
          : (steps[demoStep] ?? null)
        : waitStep;
  const done = !rhythmMode && Boolean(wait?.finished || run.ended);
  // The screen stays on while the instrument plays (a demo, a rhythm run) and during a wait-mode
  // run, which waits for the player. A paused demo lets it sleep.
  useKeepAwake(demo === 'playing' || inTime);
  useKeepAwake(!rhythmMode && run.startedAt !== null && !done, KEEP_AWAKE_IDLE_MS);
  const summary = useMemo(() => (done ? summarizeRun(run.records) : null), [done, run.records]);
  const prompts = useMemo(
    () => (done && run.memory ? promptsByBar(run.records) : null),
    [done, run.memory, run.records],
  );
  const rhythmSummary = useMemo(
    () =>
      rhythmMode && rhythm.status === 'ended' && !rhythm.hidden && rhythm.timings.length > 0
        ? summarizeRhythm(rhythm.timings)
        : null,
    [rhythmMode, rhythm],
  );

  // The run's expression, from its take (docs/EXPRESSION.md): once it is over, and again as the
  // keys held at the end are let go.
  const waitTake = done ? run.take : null;
  const waitExpression = useMemo(
    () =>
      waitTake
        ? analyzeExpression({
            score,
            hands,
            repeats,
            loop,
            mode: 'wait',
            events: waitTake.events,
            melody,
          })
        : null,
    [waitTake, score, hands, repeats, loop, melody],
  );
  const rhythmTake = rhythmSummary ? rhythm.take : null;
  const rhythmExpression = useMemo(
    () =>
      rhythmTake && rhythmSettings
        ? analyzeExpression({
            score,
            hands: rhythmSettings.hands,
            repeats: rhythmSettings.repeats,
            loop: rhythmSettings.loop,
            mode: 'rhythm',
            scale: rhythmSettings.tempo / 100,
            latency: rhythmSettings.latency,
            events: rhythmTake.events,
            melody,
          })
        : null,
    [rhythmTake, rhythmSettings, score, melody],
  );
  const expressionPanel = (
    analysis: ReturnType<typeof analyzeExpression> | null,
    settings: RunSettings,
    take: TakeState | null,
    mode: PracticeMode,
  ) =>
    analysis &&
    aspects.length > 0 && (
      <ExpressionPanel
        analysis={analysis}
        format={format}
        hands={settings.hands}
        melody={melody}
        aspects={aspects}
        onMelody={setMelody}
        onLoopBars={loopBars}
        footer={
          import.meta.env.DEV &&
          take && (
            <SaveTake
              run={{
                pieceId: piece.id,
                checksum,
                title: piece.title,
                mode,
                hands: settings.hands,
                repeats: settings.repeats,
                loop: settings.loop,
                tempo: settings.tempo,
                latency: settings.latency,
                startedAt: take.startedAt,
                events: take.events.map((e) => [...e]),
              }}
            />
          )
        }
      />
    );

  const keys = useMemo(() => {
    const span = keyRange(score, 'both') ?? [60, 72];
    return keyboardRange(span[0], span[1]);
  }, [score]);
  const whites = useMemo(() => whiteKeys(keys), [keys]);
  const marked = useMemo(() => {
    // A run played back shows the keys it pressed, its wrong ones apart.
    if (playbackView)
      return new Set(playbackView.sounding.filter((m) => !playbackView.wrong.includes(m)));
    if (playback) return new Set<number>();
    // While listening the keyboard shows what sounds; otherwise, with Show keys, what to play.
    if (listening) return new Set(step?.midis ?? []);
    if (rhythmMode) return showKeys && step ? new Set(step.midis) : new Set<number>();
    // By heart: the keys are shown only while a wrong key shows the step's notes.
    if (memoryMode) return new Set(prompt?.midis ?? []);
    return showKeys && step
      ? new Set(step.midis.filter((m) => !wait?.pressed.includes(m)))
      : new Set<number>();
  }, [
    playbackView,
    playback,
    listening,
    rhythmMode,
    memoryMode,
    prompt,
    showKeys,
    step,
    wait?.pressed,
  ]);
  const playbackWrong = useMemo(() => new Set(playbackView?.wrong ?? []), [playbackView]);

  // With Show keys, an ornament's other keys in a lighter mark (docs/EXPRESSION.md).
  const hinted = useMemo(() => {
    if (listening || memoryMode || !showKeys || !step?.ornaments) return NO_HINTS;
    return new Set(step.ornaments.flatMap((o) => o.keys).filter((k) => !marked.has(k)));
  }, [listening, memoryMode, showKeys, step, marked]);

  // The fingers printed for the keys marked (a piece without fingering has none).
  const notesById = useMemo(() => new Map(score.notes.map((n) => [n.id, n])), [score]);
  const fingers = useMemo(() => {
    const out = new Map<number, number>();
    for (const id of step?.noteIds ?? []) {
      const note = notesById.get(id);
      if (note?.finger != null && !out.has(note.midi)) out.set(note.midi, note.finger);
    }
    return out;
  }, [step, notesById]);

  const barOptions = playedBars.map((index) => (
    <option key={index} value={index}>
      {format.barNumber(index)}
    </option>
  ));
  const bpm = Math.round(baseTempo(score) * scale);
  // In wait mode the metronome can take the piece's tempo, in the start bar's meter (one it can
  // count; otherwise in quarter notes, keeping its own).
  const startMeasure = score.measures[startBar] ?? score.measures[0];
  const meter = startMeasure ? parseMeter(`${startMeasure.beats}/${startMeasure.beatType}`) : null;
  useOfferTempo(
    rhythmMode
      ? null
      : {
          bpm: tempoForMeter(baseTempo(score) * scale, meter ?? { numerator: 4, denominator: 4 }),
          meter,
        },
  );

  return (
    <section
      className={focus.on ? 'piece-session is-focus' : 'piece-session'}
      ref={region}
      tabIndex={-1}
      aria-labelledby={`${showKeysId}-title`}
    >
      {focus.on ? (
        <FocusBar
          heading={
            <h1 id={`${showKeysId}-title`} className="focus-title">
              {piece.title}
              {piece.composer && <span className="piece-composer">{piece.composer}</span>}
            </h1>
          }
          back={backTo}
          settings={{
            open: settingsOpen,
            onToggle: () => setSettingsOpen((open) => !open),
            controls: `${showKeysId}-controls`,
          }}
        />
      ) : (
        <header className="piece-head">
          <Link href={backTo.href} className="piece-back-link">
            {backTo.label}
          </Link>
          <h1 id={`${showKeysId}-title`} className="piece-title">
            {piece.title}
            {piece.composer && <span className="piece-composer">{piece.composer}</span>}
          </h1>
          <FocusEnter />
        </header>
      )}

      <div
        className="piece-controls"
        id={`${showKeysId}-controls`}
        role="group"
        aria-label={t('pieces.controls')}
        hidden={focus.on && !settingsOpen}
      >
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
              <label key={choice} title={playable[choice] ? undefined : t('pieces.hand.none')}>
                <input
                  type="radio"
                  name={`${showKeysId}-hands`}
                  value={choice}
                  checked={hands === choice}
                  disabled={!playable[choice]}
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
              e.preventDefault();
              options.current.open = false;
              options.current.querySelector('summary')?.focus();
            }
          }}
        >
          <summary className="button is-compact">{t('pieces.options')}</summary>
          <div className="piece-options-panel">
            {memoryMode && <MemoryStageSelect stage={stage} onChange={setStage} />}

            {patterns.length > 0 && (
              <label className="piece-option">
                <span className="piece-control-label">{t('pieces.leftHand')}</span>
                <select
                  className="is-compact"
                  aria-describedby={`${showKeysId}-lefthand`}
                  value={leftHand}
                  onChange={(e) => setLeftHand(e.target.value as LeftHandChoice)}
                >
                  <option value="written">{t('pieces.leftHand.written')}</option>
                  <optgroup label={t('pieces.leftHand.symbols')}>
                    {patterns.map((pattern) => (
                      <option key={pattern} value={pattern}>
                        {t(`harmony.pattern.${pattern}`)}
                      </option>
                    ))}
                  </optgroup>
                </select>
                <span id={`${showKeysId}-lefthand`} className="visually-hidden">
                  {t('pieces.leftHand.help')}
                </span>
              </label>
            )}

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

            {hasTrill && (
              <fieldset className="piece-option">
                <legend className="visually-hidden">{t('pieces.trillStart')}</legend>
                <span className="piece-control-label" aria-hidden="true">
                  {t('pieces.trillStart')}
                </span>
                <div className="segmented is-compact">
                  {(['principal', 'upper'] as const).map((choice) => (
                    <label key={choice}>
                      <input
                        type="radio"
                        name={`${showKeysId}-trill`}
                        value={choice}
                        checked={trillStart === choice}
                        onChange={() => setTrillStart(choice)}
                      />
                      <span>{t(`pieces.trillStart.${choice}`)}</span>
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
              {EXPRESSION_ASPECTS.map((aspect) => (
                <label key={aspect} className="check">
                  <input
                    type="checkbox"
                    checked={aspects.includes(aspect)}
                    onChange={(e) => setAspect(aspect, e.target.checked)}
                    aria-describedby={`${showKeysId}-judge`}
                  />
                  <span>{t(`pieces.expression.judge.${aspect}`)}</span>
                </label>
              ))}
              <span id={`${showKeysId}-judge`} className="visually-hidden">
                {t('pieces.expression.judge.help')}
              </span>
            </div>

            <p className="piece-option piece-review-option">
              <label className="check">
                <input
                  type="checkbox"
                  checked={!reviewOut}
                  onChange={(e) => store.setPieceReview(piece.id, e.target.checked)}
                  aria-describedby={`${showKeysId}-review`}
                />
                <span>{t('pieces.review.option')}</span>
              </label>
              <span id={`${showKeysId}-review`} className="muted">
                {reviewOut
                  ? t('pieces.review.out.help')
                  : !review
                    ? t('pieces.review.none')
                    : review.status.isDue
                      ? t('pieces.review.due.help')
                      : t('pieces.review.next.date', {
                          date: format.date(Date.parse(`${review.schedule.due}T12:00:00`)),
                        })}
              </span>
            </p>

            <p className="piece-option">
              <button
                type="button"
                className="button is-compact"
                disabled={inTime}
                onClick={() => {
                  if (options.current) options.current.open = false;
                  setRunsOpen(true);
                }}
              >
                {t('pieces.runs')}
              </button>
            </p>

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
          loopLabel={weakest && format.barRange(weakest.from, weakest.to)}
          onLoop={loopWeakest}
          onTable={() => setTable(true)}
          onMetric={setMetric}
        />
      )}

      <div className="piece-stage">
        <ScoreView
          xml={practised.xml}
          score={score}
          title={piece.title}
          step={step}
          pressed={
            playback
              ? (playbackView?.pressed ?? NO_KEYS)
              : listening || rhythmMode
                ? NO_KEYS
                : (wait?.pressed ?? NO_KEYS)
          }
          cursorWrong={(playbackView?.wrong.length ?? 0) > 0}
          hiddenBars={playback ? undefined : run.memory?.hidden}
          revealedBars={revealedBars}
          revealedNotes={promptNotes ?? NO_NOTES}
          hands={playback ? playback.source.settings.hands : hands}
          onStatus={setScoreStatus}
          zoom={focus.on ? focus.zoom : 1}
          behind={
            weakBars
              ? (boxes) => <BarTints cells={heat.cells} boxes={boxes} format={barFormat} />
              : undefined
          }
          above={
            weakBars || (run.memory && !playback)
              ? (boxes) => (
                  <>
                    {run.memory && !playback && (
                      <HiddenBarNumbers
                        hidden={shownHidden(run.memory.hidden, revealedBars)}
                        boxes={boxes}
                        format={format}
                      />
                    )}
                    {weakBars && <BarTargets cells={heat.cells} boxes={boxes} format={barFormat} />}
                  </>
                )
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
        {table && weakBars && !summary && !rhythmSummary && !runsOpen && (
          <WeakBarsTable
            cells={heat.cells}
            format={barFormat}
            onClose={() => {
              setTable(false);
              settle();
            }}
          />
        )}
        <div className="piece-sheets" hidden={playback !== null}>
          {summary && !runsOpen && (
            <RunSummary
              summary={summary}
              prompts={prompts}
              looped={run.ended}
              format={format}
              onAgain={restart}
              onLoopBar={(bar) => {
                setLoop({ from: bar, to: bar });
                settle();
              }}
              expression={expressionPanel(
                waitExpression,
                { hands, repeats, loop, tempo, latency: 0 },
                run.take,
                'wait',
              )}
              onPlayBack={
                run.take && hasOutput
                  ? () =>
                      startPlayback({
                        events: run.take!.events,
                        mode: 'wait',
                        settings: { hands, repeats, loop, tempo, latency: 0 },
                        startedAt: null,
                      })
                  : undefined
              }
            />
          )}
          {rhythmSummary && !calibration && !runsOpen && (
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
              expression={
                rhythmSettings &&
                expressionPanel(rhythmExpression, rhythmSettings, rhythm.take, 'rhythm')
              }
              onPlayBack={
                rhythm.take && rhythmSettings && hasOutput
                  ? () =>
                      startPlayback({
                        events: rhythm.take!.events,
                        mode: 'rhythm',
                        settings: rhythmSettings,
                        startedAt: null,
                      })
                  : undefined
              }
            />
          )}
          {runsOpen && (
            <YourRuns
              pieceId={piece.id}
              checksum={checksum}
              leftHand={leftHand}
              score={score}
              format={format}
              melody={melody}
              aspects={aspects}
              onMelody={setMelody}
              onLoopBars={loopBars}
              onPlayBack={
                hasOutput
                  ? (session, take) =>
                      startPlayback({
                        events: take.events,
                        mode: session.mode === 'rhythm' ? 'rhythm' : 'wait',
                        settings: {
                          hands: session.hands,
                          repeats: session.repeats,
                          loop: session.loop,
                          tempo: session.tempo,
                          latency: take.latency,
                        },
                        startedAt: session.startedAt,
                      })
                  : undefined
              }
              onClose={() => {
                setRunsOpen(false);
                settle();
              }}
            />
          )}
        </div>
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

      {playback ? (
        <div className="piece-status">
          <PlaybackBar
            playback={playback.data}
            compare={playback.compare}
            state={demo}
            title={
              playback.source.startedAt === null
                ? t('pieces.playback.this')
                : t('pieces.playback.run', { when: log.dateTime(playback.source.startedAt) })
            }
            part={playbackView?.part ?? null}
            bar={step ? format.barStatus(step.measure, step.pass) : ''}
            wrong={playbackView?.wrong ?? NO_KEYS}
            format={format}
            onToggle={togglePlayback}
            onFrom={playbackFrom}
            onCompare={comparePlaybackBy}
            onClose={closePlayback}
          />
        </div>
      ) : (
        <div className="piece-status">
          {rhythmMode ? (
            <RhythmStatus
              beat={beat}
              ended={rhythm.status === 'ended' && rhythm.timings.length === 0}
              last={rhythm.last}
              nothing={!range || !timed}
              click={clickMode}
              bpm={bpm}
              bar={step ? format.barStatus(step.measure, step.pass) : ''}
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
              showKeys={showKeys && !memoryMode}
              prompts={run.memory ? run.prompts : null}
              total={range ? range.last - range.first + 1 : 0}
              bar={step ? format.barStatus(step.measure, step.pass) : ''}
              beat={step ? format.beat(step.beat) : ''}
            />
          )}
          <div className="piece-notes">
            {scoreStatus.state === 'ready' && scoreStatus.unplaced > 0 && (
              <p className="muted">{t('pieces.unplaced', { n: scoreStatus.unplaced })}</p>
            )}
            {patterns.length > 0 && leftHand === 'written' && !playable.left && (
              <p className="muted">{t('pieces.leftHand.none')}</p>
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
                  inTime
                    ? 'button is-compact piece-go'
                    : 'button button-primary is-compact piece-go'
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
                {memoryMode && (
                  <>
                    <button
                      type="button"
                      className={
                        peeking
                          ? 'button is-compact memory-peek is-held'
                          : 'button is-compact memory-peek'
                      }
                      aria-pressed={peeking}
                      aria-describedby={`${showKeysId}-peek`}
                      disabled={!waitStep}
                      onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        peek(true);
                      }}
                      onPointerUp={() => peek(false)}
                      onPointerCancel={() => peek(false)}
                      onKeyDown={(e) => {
                        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                          e.preventDefault();
                          peek(true);
                        }
                      }}
                      onKeyUp={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') peek(false);
                      }}
                    >
                      {t('pieces.memory.peek')}
                    </button>
                    <span id={`${showKeysId}-peek`} className="visually-hidden">
                      {t('pieces.memory.peek.help')}
                    </span>
                    <button type="button" className="button is-compact" onClick={startAnywhere}>
                      {t('pieces.memory.anywhere')}
                    </button>
                  </>
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
      )}

      {(!focus.on || focus.keyboard) && (
        <div className="piece-keys" style={{ '--piece-whites': whites } as CSSProperties}>
          <Piano
            held={held}
            sustained={sustained}
            pointer={pointer}
            marked={marked}
            hinted={hinted}
            wrong={playback ? playbackWrong : rhythmMode ? NO_WRONG : wrong}
            fingers={fingers}
            range={keys}
            className="piece-piano"
          />
        </div>
      )}
    </section>
  );
}

/** The piece as it is practised: its score with the left hand chosen, and that score's facts. */
interface PractisedPiece {
  xml: string;
  score: Score;
  facts: PieceFacts;
  /** The left hand in effect: `written` too when the pattern could not be written. */
  leftHand: LeftHandChoice;
}

function practise(
  piece: Pick<OpenPiece, 'xml' | 'score' | 'facts'>,
  leftHand: LeftHandChoice,
): PractisedPiece {
  if (leftHand !== 'written') {
    try {
      const made = withLeftHand(piece.xml, piece.score, leftHand);
      return { ...made, facts: pieceFacts(made.score), leftHand };
    } catch {
      // A score the pattern cannot be written into is practised as written.
    }
  }
  return { xml: piece.xml, score: piece.score, facts: piece.facts, leftHand: 'written' };
}

/** A run to play back: what was played and how it was practised. */
interface PlaybackSource {
  events: readonly TakeEvent[];
  mode: 'wait' | 'rhythm';
  settings: RunSettings;
  /** When it was played (epoch ms), or null for the run just played. */
  startedAt: number | null;
}

interface OpenPlayback {
  source: PlaybackSource;
  compare: CompareChoice;
  data: TakePlayback;
}

/** What a run was practised with, for reading its take. */
interface RunSettings {
  hands: HandSelection;
  repeats: RepeatMode;
  loop: BarLoop | null;
  /** Percent of the score's tempo. */
  tempo: number;
  /** Rhythm mode: the latency taken off every key. */
  latency: number;
}

const NO_WRONG: ReadonlySet<number> = new Set();
const NO_NOTES: readonly string[] = [];

/** The hidden bars not shown at the moment: their numbers stand in the middle of the staff. */
function shownHidden(hidden: ReadonlySet<number>, revealed: ReadonlySet<number>): Set<number> {
  return new Set([...hidden].filter((bar) => !revealed.has(bar)));
}
const NO_HINTS: ReadonlySet<number> = new Set();
const NO_RECORDS: readonly RecordInput[] = [];

function StatusLine({
  demo,
  bpm,
  wait,
  step,
  started,
  nothing,
  showKeys,
  prompts,
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
  /** Memory mode: the prompts on the step so far; null in wait mode. */
  prompts: number | null;
  total: number;
  bar: string;
  beat: string;
}) {
  const t = useT();
  if (nothing) return <p className="piece-status-main">{t('pieces.nothing')}</p>;
  if (demo !== 'stopped') {
    const parts = [t(demo === 'paused' ? 'pieces.status.demoPaused' : 'pieces.status.demo')];
    if (step) {
      parts.push(bar, t('pieces.status.beat', { beat }));
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
    bar,
    t('pieces.status.beat', { beat }),
    t('pieces.status.step', { n: wait.current - wait.first + 1, total }),
  ];
  if (wait.wrong > 0) parts.push(t('pieces.status.wrong', { n: wait.wrong }));
  if (prompts) parts.push(t('pieces.status.prompts', { n: prompts }));
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
