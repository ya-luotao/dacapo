import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { analyzeRun, type RunAnalysis } from '../../core/evenness.ts';
import { parseMusicXml } from '../../core/musicxml.ts';
import { summarizeRhythm } from '../../core/rhythmRun.ts';
import {
  clickTimings,
  scaleRhythmPlan,
  type ClickSettings,
  type GridPerBeat,
} from '../../core/scaleClick.ts';
import { scaleProgress } from '../../core/scaleProgress.ts';
import { dayKey } from '../../core/streak.ts';
import type { ScaleSession } from '../../core/scaleRecords.ts';
import { exerciseKey, handsPlaying, scaleNotes } from '../../core/scales.ts';
import type { ScaleExercise } from '../../core/scaleTypes.ts';
import {
  exerciseBeats,
  freePerBeat,
  layoutOf,
  scaleHands,
  scaleMusicXml,
} from '../../core/scaleXml.ts';
import { isTechnique } from '../../core/technique.ts';
import { buildSteps, keyRange, type Hand } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import type { MidiStatus } from '../../input/index.ts';
import { useHubState, useInput } from '../input/context.ts';
import { useMetronome, useMetronomeState } from '../metronome/context.ts';
import { usePractice, usePracticeStore } from '../practice/context.ts';
import { useNow } from '../progress/useNow.ts';
import { ScoreView, type ScoreStatus } from '../notation/ScoreView.tsx';
import { prefetchVerovio, type Engraving } from '../notation/verovio.ts';
import { Piano } from '../piano/Piano.tsx';
import { keyboardRange, whiteKeys } from '../piano/range.ts';
import { CalibrationSheet, TimingMark } from '../pieces/RhythmParts.tsx';
import type { LastNote } from '../pieces/rhythm.ts';
import { readLatency, type Latency } from '../pieces/rhythmPrefs.ts';
import { useRhythmPlayer } from '../pieces/useRhythmPlayer.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';
import { FocusBar, FocusEnter } from '../focus/FocusBar.tsx';
import { useFocusState } from '../focus/focus.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { stepNames, useExerciseTitle } from './format.ts';
import { KeyboardHint } from './KeyboardHint.tsx';
import { noteIdsOf, noteKey, type LoopPlace } from './loop.ts';
import {
  readClickPrefs,
  readExercise,
  startChoices,
  writeClickPrefs,
  writeExercise,
  type ClickPrefs,
} from './prefs.ts';
import { useRouteSearch } from '../hashRoute.ts';
import { parseScaleStart } from '../startParams.ts';
import { scaleRunRecord, useScaleRecorder, type SessionSlot } from './record.ts';
import {
  runClick,
  runInput,
  sessionStep,
  usedPedal,
  waitingRun,
  type ScaleRunState,
} from './run.ts';
import { ScaleLoop } from './ScaleLoop.tsx';
import { ScalePicker } from './ScalePicker.tsx';
import { ScaleProgress, YourScales } from './ScaleProgress.tsx';
import { ScaleSummary, type ClickResult } from './ScaleSummary.tsx';

/** How often a running run looks at the clock, for its idle end. */
const TICK_MS = 250;
/**
 * A short scale is one short system: drawn larger, and stretched across the sheet. Four octaves
 * take the whole width at the usual size.
 */
const ZOOM: Record<ScaleExercise['octaves'], number> = { 1: 1.6, 2: 1.3, 3: 1.15, 4: 1 };

/**
 * A technique exercise is drawn as large as a scale of about as many beats (a five-finger pattern
 * as one octave, a broken chord over an octave as two); Hanon's thirty bars take several systems at
 * the usual size.
 */
function zoomOf(e: ScaleExercise, perBeat: number | undefined): number {
  if (!isTechnique(e.type)) return ZOOM[e.octaves];
  const beats = exerciseBeats(e, perBeat);
  return beats <= 5 ? 1.6 : beats <= 9 ? 1.3 : beats <= 12 ? 1.15 : 1;
}
/**
 * A system at least a third full is stretched (one octave on one staff fills about 40 %); the last
 * bar alone on a line (about a quarter) is not. Octave lines read "8va", clear of the fingering.
 */
const ENGRAVING: Engraving = { lastJustification: 0.35, ottavaText: true };
/** Off: the keyboard marks only the keys to start on, not each next key. */
const GUIDE_PREF = 'dacapo.scales.guide';
/** Offered once per browser, before the first run with the click (shared with Pieces). */
const CALIBRATION_OFFERED_PREF = 'dacapo.latency.offered';

/** The Scales page; opened with an exercise (a task of an assignment), it starts over on it. */
export function ScalesPage() {
  const search = useRouteSearch();
  return <Scales key={search} search={search} />;
}

function Scales({ search }: { search: string }) {
  const t = useT();
  const title = useExerciseTitle();
  const [start] = useState(() => startChoices(parseScaleStart(search)));
  const [exercise, setExerciseState] = useState(() => start?.exercise ?? readExercise());
  const [click, setClickState] = useState(() => start?.click ?? readClickPrefs());
  const [loop, setLoop] = useState<LoopPlace | null>(null);
  // A clicked run is on: its settings stay put until it ends.
  const [clicking, setClicking] = useState(false);
  const focus = useFocusState();
  // In focus mode the choice of scale folds away until asked for.
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Folded again for the next time focus mode is entered.
  if (!focus.on && settingsOpen) setSettingsOpen(false);
  const pickerId = useId();
  const { sessions } = usePractice();
  const now = useNow();
  // Every scale played, least even first, from the sessions loaded at startup.
  // Again when the sessions change or the day does, not on every tick of the clock.
  const today = dayKey(now);
  const progress = useMemo(
    () => scaleProgress(sessions, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` counts only through its day
    [sessions, today],
  );
  // The notation engine is large: fetch it while the page is read.
  useEffect(prefetchVerovio, []);

  const stage = useRef<HTMLDivElement>(null);
  // One practice session per visit to the page, whatever scales are played in it.
  const session = useRef<ScaleSession | null>(null);
  const [slot] = useState<SessionSlot>(() => ({
    get: () => session.current,
    set: (next) => {
      session.current = next;
    },
  }));

  function setExercise(next: ScaleExercise) {
    setExerciseState(next);
    writeExercise(next);
    setLoop(null);
  }

  function setClick(next: ClickPrefs) {
    setClickState(next);
    writeClickPrefs(next);
    setLoop(null);
  }

  function startLoop(place: LoopPlace) {
    setLoop(place);
    stage.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    stage.current?.focus({ preventScroll: true });
  }

  // The grid as played: the notes to the beat chosen, or the exercise's own rhythm.
  const clickSettings: ClickSettings | null = click.on
    ? { bpm: click.bpm, perBeat: layoutOf(exercise, click.perBeat).perBeat as GridPerBeat }
    : null;
  // A new session view for another scale or another grid: its run and result belong to those.
  const sessionKey = `${exerciseKey(exercise)}:${clickSettings ? `${clickSettings.bpm}:${clickSettings.perBeat}` : 'free'}`;

  return (
    <section className={focus.on ? 'scales is-focus' : 'scales'}>
      <h1 className="visually-hidden">{t('scales.title')}</h1>
      {focus.on && (
        <FocusBar
          heading={<h2 className="focus-title">{title(exercise)}</h2>}
          settings={{
            open: settingsOpen,
            onToggle: () => setSettingsOpen((open) => !open),
            controls: pickerId,
          }}
        />
      )}
      <ScalePicker
        id={pickerId}
        hidden={focus.on && !settingsOpen}
        exercise={exercise}
        onChange={setExercise}
        click={click}
        onClick={setClick}
        disabled={clicking}
        // Selects take the computer keyboard's letters; after a choice, the keys play notes again.
        onChosen={() => stage.current?.focus({ preventScroll: true })}
      />
      <div className="scale-stage" ref={stage} tabIndex={-1}>
        {loop ? (
          <ScaleLoop
            key={`${exerciseKey(exercise)}:${loop.hand}:${loop.index}`}
            exercise={exercise}
            place={loop}
            perBeat={freePerBeat(exercise.type)}
            onStop={() => {
              setLoop(null);
              stage.current?.focus({ preventScroll: true });
            }}
          />
        ) : (
          <ScaleSession
            key={sessionKey}
            exercise={exercise}
            click={clickSettings}
            slot={slot}
            onLoop={startLoop}
            onClicking={setClicking}
          />
        )}
      </div>
      {!focus.on && (
        <>
          <ScaleProgress
            exercise={exercise}
            progress={progress.find((p) => p.exercise === exerciseKey(exercise)) ?? null}
            now={now}
            onLoop={startLoop}
          />
          <YourScales
            list={progress}
            now={now}
            current={exercise}
            onPick={(next) => {
              setExercise(next);
              stage.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
              stage.current?.focus({ preventScroll: true });
            }}
          />
        </>
      )}
    </section>
  );
}

/** How far a note was from the line through its neighbours, as a class for its ink on the score. */
function deviationMark(deviation: number | null): string | null {
  if (deviation === null) return null;
  const ms = Math.abs(deviation);
  if (ms < 10) return null;
  if (ms < 20) return 'is-dev-1';
  if (ms < 35) return 'is-dev-2';
  if (ms < 60) return 'is-dev-3';
  return 'is-dev-4';
}

function ScaleSession({
  exercise,
  click,
  slot,
  onLoop,
  onClicking,
}: {
  exercise: ScaleExercise;
  /** With the click: its tempo and notes per beat; null at free tempo. */
  click: ClickSettings | null;
  slot: SessionSlot;
  onLoop: (place: LoopPlace) => void;
  /** A clicked run starts or ends. */
  onClicking: (on: boolean) => void;
}) {
  const t = useT();
  const title = useExerciseTitle();
  const focus = useFocusState();
  const [guide, setGuideState] = useState(() => readPref(GUIDE_PREF) !== '0');
  const { hub, pointer, midi, output } = useInput();
  const store = usePracticeStore();
  const { held, sustained } = useHubState();
  const metronome = useMetronome();
  const { settings: metronomeSettings } = useMetronomeState();
  // Contrary motion is both hands, as the score, the steps and the keyboard see it.
  const hands = handsPlaying(exercise.hands);
  const perBeat = click?.perBeat;
  const notes = useMemo(() => scaleNotes(exercise), [exercise]);
  // The run: one hand's notes, or the right hand's then the left's (what the analysis takes).
  const expected = useMemo(
    () => (hands === 'both' ? [...notes.right, ...notes.left] : notes[hands]),
    [notes, hands],
  );
  // Each step by name, a chord by its keys.
  const names = useMemo(
    () => ({ right: stepNames(notes.right), left: stepNames(notes.left) }),
    [notes],
  );
  const xml = useMemo(
    () => scaleMusicXml(exercise, { notesPerBeat: perBeat }),
    [exercise, perBeat],
  );
  const score = useMemo(
    () =>
      parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
        hands: scaleHands(exercise),
      }),
    [xml, exercise],
  );
  const steps = useMemo(() => buildSteps(score, hands), [score, hands]);
  // With the click, the scale in time: rhythm mode's plan of the same score.
  const plan = useMemo(
    () => (click ? scaleRhythmPlan(score, hands, click.bpm) : null),
    [click, score, hands],
  );
  // The run's notes on the score: each hand's notes in the order played (a chord's lowest
  // first) are its run, note for note (scaleXml.test.ts holds it), and each belongs to the step
  // at its onset.
  const noteIds = useMemo(() => noteIdsOf(score, notes), [score, notes]);
  /** The score's note for a note of the run (an index into `expected`). */
  const idOf = useMemo(
    () => (n: number) => {
      const note = expected[n];
      return note ? noteIds.get(noteKey(note)) : undefined;
    },
    [expected, noteIds],
  );
  /** The score's notes of a step of a hand's run (a chord's keys). */
  const idsOfStep = useMemo(() => {
    const byStep = new Map<string, string[]>();
    for (const note of [...notes.right, ...notes.left]) {
      const id = noteIds.get(noteKey(note));
      if (!id) continue;
      const key = `${note.hand}:${note.index}`;
      byStep.set(key, [...(byStep.get(key) ?? []), id]);
    }
    return (hand: Hand, index: number) => byStep.get(`${hand}:${index}`) ?? [];
  }, [notes, noteIds]);
  const stepOfNote = useMemo(
    () => new Map(steps.flatMap((s) => s.noteIds.map((id) => [id, s] as const))),
    [steps],
  );
  const [status, setStatus] = useState<ScoreStatus>({ state: 'loading' });
  const [run, dispatch] = useReducer(sessionStep, expected, (notes) =>
    waitingRun(notes, hub.getState().sustain),
  );
  useScaleRecorder(run, exercise, slot, store, () => inputNames(midi.getStatus()));

  // With the click: rhythm mode's player (the count-in, the click, the notes against the grid),
  // the metronome paused meanwhile, the latency from the calibration.
  const { player: rhythm, snapshot: beat } = useRhythmPlayer(
    output.scheduler,
    output.onInterrupt,
    () => metronome.block('scales'),
  );
  const clicking = beat.state !== 'stopped';
  const [last, setLast] = useState<LastNote | null>(null);
  const [latency, setLatency] = useState<Latency | null>(readLatency);
  const [calibration, setCalibration] = useState<'offer' | 'open' | null>(null);
  const [calibrating, setCalibrating] = useState(false);
  useEffect(() => onClicking(clicking), [clicking, onClicking]);
  useEffect(() => () => onClicking(false), [onClicking]);

  // From the first run on; the page alone does not keep the screen on.
  useKeepAwake(run.phase !== 'waiting' || clicking, KEEP_AWAKE_IDLE_MS);

  // Keys go to the run; with the click, only those rhythm mode takes as the run's (not the
  // count-in's, not after the last beat), each also timed for the quiet mark.
  const keysTo = useRef({ click: click !== null, calibrating });
  useEffect(() => {
    keysTo.current = { click: click !== null, calibrating };
  });
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'sustain')
          dispatch({ type: 'pedal', down: event.down, time: event.time });
        else if (event.type === 'on') {
          if (keysTo.current.calibrating) return;
          if (keysTo.current.click) {
            const result = rhythm.press(event.midi, event.time);
            if (result.kind === 'ignored') return;
            // A scale has no ornaments: every key is a hit or an extra.
            if (result.kind !== 'ornament')
              setLast(
                result.kind === 'hit'
                  ? { kind: 'hit', deviation: result.deviation }
                  : { kind: 'extra' },
              );
          }
          dispatch({ ...event, type: 'on', at: Date.now() });
        } else if (event.type === 'off')
          dispatch({ type: 'off', midi: event.midi, time: event.time });
      }),
    [hub, rhythm],
  );
  const playing = run.phase === 'playing';
  useEffect(() => {
    if (!playing || click) return;
    const id = setInterval(() => dispatch({ type: 'tick', time: performance.now() }), TICK_MS);
    return () => clearInterval(id);
  }, [playing, click]);

  /** Starts a run with the click (from a click or a key: the sound needs a user gesture). */
  function startClicked() {
    if (!plan || !click) return;
    setCalibration(null);
    const offset = readLatency()?.offset ?? 0;
    setLast(null);
    const origin = rhythm.start({
      plan,
      backing: null,
      velocity: 0,
      clickMode: 'on',
      volume: metronomeSettings.volume,
      sound: metronomeSettings.sound,
      latency: offset,
      onSettled: () => {},
      onEnd: (reason) =>
        dispatch(reason === 'done' ? { type: 'over' } : { type: 'stop', time: performance.now() }),
    });
    dispatch({ type: 'arm', grid: { ...click, origin, latency: offset } });
  }

  function onStart() {
    if (rhythm.getSnapshot().state !== 'stopped') {
      rhythm.stop();
      return;
    }
    // Offered once, before the first run with the click in this browser.
    if (!readLatency() && readPref(CALIBRATION_OFFERED_PREF) !== '1') {
      writePref(CALIBRATION_OFFERED_PREF, '1');
      setCalibration('offer');
      return;
    }
    startClicked();
  }

  const analysis = useMemo(() => (run.phase === 'done' ? analyze(run) : null), [run]);
  const ok = analysis?.quality === 'ok';
  // With the click, the run against it, recomputed from its keys as its record would give it.
  const clickResult = useMemo((): ClickResult | null => {
    const grid = runClick(run);
    if (!plan || !grid || run.phase !== 'done') return null;
    return {
      settings: { bpm: grid.bpm, perBeat: grid.perBeat },
      summary: summarizeRhythm(clickTimings(plan, run.keys, grid)),
    };
  }, [plan, run]);

  // The score: the note to play next (with the click, the note due now), the notes played green;
  // after a run, each note inked by how far off the line it was, and the wrong and missed ones in
  // the error colour.
  const nextNote = run.steps[run.next]?.notes[0];
  const next = nextNote === undefined ? undefined : idOf(nextNote);
  const step =
    clicking && beat.step !== null
      ? (steps[beat.step] ?? null)
      : run.phase === 'done' || next === undefined
        ? null
        : (stepOfNote.get(next) ?? null);
  const marks = useMemo(() => {
    const out = new Map<string, string>();
    if (analysis && ok) {
      for (const hand of analysis.hands)
        for (const note of hand.notes) {
          const mark = note.outcome === 'played' ? deviationMark(note.deviation) : 'is-missed';
          if (mark) for (const id of idsOfStep(hand.hand, note.index)) out.set(id, mark);
        }
    } else if (run.phase !== 'done') {
      for (const n of run.played) {
        const id = idOf(n);
        if (id) out.set(id, 'is-pressed');
      }
    }
    return out;
  }, [analysis, ok, run.phase, run.played, idsOfStep, idOf]);

  const keys = useMemo(() => {
    const span = keyRange(score, hands) ?? [60, 72];
    return keyboardRange(span[0], span[1]);
  }, [score, hands]);
  const wrong = useMemo(() => new Set(run.wrongKey === null ? [] : [run.wrongKey]), [run.wrongKey]);
  // The keys to start on: the tonic of each hand played.
  const startNotes = run.steps[0]?.notes ?? [];
  // The unison of contrary motion is one key to name.
  const first = [...new Set(startNotes.map((n) => names[expected[n]!.hand][0]))].join(
    t('scales.status.and'),
  );
  const waiting = run.phase === 'waiting';
  // The keyboard marks the keys to start on, and with the guide each next key as the run goes,
  // with the finger to take it; a crossing just ahead is named too.
  const cue = waiting ? run.steps[0] : guide && playing ? run.steps[run.next] : null;
  const cueNotes = useMemo(() => (cue?.notes ?? []).map((n) => expected[n]!), [cue, expected]);
  const marked = useMemo(() => new Set(cueNotes.map((note) => note.midi)), [cueNotes]);
  const fingers = useMemo(
    () =>
      new Map(
        cueNotes.flatMap((note): [number, number][] =>
          note.finger === null ? [] : [[note.midi, note.finger]],
        ),
      ),
    [cueNotes],
  );
  const crossings = playing
    ? cueNotes.flatMap((note) => {
        if (!note.crossing || note.finger === null) return [];
        const what =
          note.crossing === 'thumbUnder'
            ? t('scales.guide.thumbUnder')
            : t('scales.guide.fingerOver', { finger: note.finger });
        return [
          hands === 'both'
            ? t('scales.guide.hand', { hand: t(`scales.hand.${note.hand}`), cue: what })
            : what,
        ];
      })
    : [];

  function setGuide(next: boolean) {
    setGuideState(next);
    writePref(GUIDE_PREF, next ? null : '0');
  }

  let statusText: ReactNode;
  if (click) {
    const tempo = t('pieces.tempo.bpm', { bpm: click.bpm });
    if (beat.state === 'counting')
      statusText = (
        <>
          <strong className="piece-count">
            {beat.count === null ? '' : t('pieces.status.countIn', { beat: beat.count })}
          </strong>{' '}
          <span className="muted">{tempo}</span>
        </>
      );
    else if (clicking)
      statusText = (
        <>
          {t('scales.status.playing', { n: run.played.length, total: expected.length })}{' '}
          <TimingMark last={last} />
        </>
      );
    else if (run.phase === 'done')
      statusText = ok ? t('scales.status.clickAgain') : t('scales.status.clickNotARun');
    else statusText = t('scales.status.clickStart', { key: first });
  } else {
    statusText =
      run.phase === 'waiting'
        ? t('scales.status.start', { key: first })
        : run.phase === 'playing'
          ? t('scales.status.playing', { n: run.played.length, total: expected.length })
          : ok
            ? t('scales.status.again', { key: first })
            : t('scales.status.notARun', { key: first });
  }

  return (
    <div className="scale-session">
      <div className="scale-head">
        {!focus.on && <h2 className="scale-title">{title(exercise)}</h2>}
        <p className="scale-status" role="status">
          {statusText}
        </p>
        {crossings.length > 0 && (
          <p className="scale-cue">
            {t('scales.guide.next', { cues: crossings.join(t('app.listSeparator')) })}
          </p>
        )}
        <div className="scale-head-tools">
          <label className="check">
            <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
            <span>{t('scales.guide')}</span>
          </label>
          {click ? (
            <button
              type="button"
              className={
                clicking
                  ? 'button is-compact piece-go'
                  : 'button button-primary is-compact piece-go'
              }
              disabled={!plan || calibrating}
              onClick={onStart}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                {clicking ? (
                  <rect x="4" y="4" width="8" height="8" rx="1" className="is-filled" />
                ) : (
                  <circle cx="8" cy="8" r="4.5" className="is-filled" />
                )}
              </svg>
              <span>{clicking ? t('pieces.rhythm.stop') : t('pieces.rhythm.start')}</span>
            </button>
          ) : (
            playing && (
              <button
                type="button"
                className="button is-compact"
                onClick={() => dispatch({ type: 'stop', time: performance.now() })}
              >
                {t('scales.stop')}
              </button>
            )
          )}
          {!focus.on && <FocusEnter />}
        </div>
      </div>
      {click && (
        <p className="scale-latency">
          <span>
            {latency ? t('pieces.latency', { ms: latency.offset }) : t('pieces.latency.none')}
          </span>
          <button
            type="button"
            className="button is-compact"
            disabled={clicking}
            onClick={() => setCalibration('open')}
          >
            {t('pieces.latency.calibrate')}
          </button>
          <span className="muted">{t('scales.click.sound')}</span>
        </p>
      )}

      <div className="scale-sheet">
        <ScoreView
          xml={xml}
          score={score}
          title={title(exercise)}
          step={step}
          pressed={[]}
          hands={hands}
          onStatus={setStatus}
          marks={marks}
          zoom={zoomOf(exercise, perBeat) * (focus.on ? focus.zoom : 1)}
          engraving={ENGRAVING}
          fillHeight={false}
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

      {(!focus.on || focus.keyboard) && (
        <div className="scale-keys" style={{ '--piece-whites': whiteKeys(keys) } as CSSProperties}>
          <Piano
            held={held}
            sustained={sustained}
            pointer={pointer}
            wrong={wrong}
            marked={marked}
            fingers={fingers}
            range={keys}
            className="piece-piano"
          />
        </div>
      )}

      {exercise.type === 'hanon' && (
        <p className="help scale-source">
          {t('scales.hanon.source', { n: exercise.variant ?? '' })}
        </p>
      )}

      <KeyboardHint />

      {calibration && (
        <CalibrationSheet
          offer={calibration === 'offer'}
          onCalibrate={() => setCalibration('open')}
          onStart={startClicked}
          onRunning={setCalibrating}
          onChange={setLatency}
          onClose={() => setCalibration(null)}
        />
      )}
      {analysis && !calibration && (
        <ScaleSummary
          analysis={analysis}
          names={names}
          end={run.end}
          pedal={usedPedal(run)}
          click={clickResult}
          onLoop={onLoop}
          kind={
            exercise.type === 'trill'
              ? 'trill'
              : exercise.type === 'repeatedNotes'
                ? 'repeats'
                : null
          }
          played={run.keys}
        />
      )}
      {import.meta.env.DEV && run.phase === 'done' && <SaveRun exercise={exercise} run={run} />}
    </div>
  );
}

function analyze(run: ScaleRunState): RunAnalysis {
  return analyzeRun(runInput(run));
}

/**
 * Development only: saves the raw run, for setting the loudness thresholds from real instruments
 * (docs/SCALES.md, "Still open for S1").
 */
function SaveRun({ exercise, run }: { exercise: ScaleExercise; run: ScaleRunState }) {
  const { midi } = useInput();
  function save() {
    const record = scaleRunRecord(exercise, run, inputNames(midi.getStatus()));
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(record)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `scale-run-${record.exercise.replaceAll(':', '-')}-${record.startedAt}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <p className="scale-dev">
      <button type="button" className="button" onClick={save}>
        Save this run (development)
      </button>
    </p>
  );
}

/** The MIDI inputs connected, by name: velocity curves differ between instruments. */
function inputNames(status: MidiStatus): string[] {
  return status.state === 'connected' ? [...status.names] : [];
}
