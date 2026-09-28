import { useEffect, useId, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { analyzeRun, type RunAnalysis } from '../../core/evenness.ts';
import { parseMusicXml } from '../../core/musicxml.ts';
import { scaleProgress } from '../../core/scaleProgress.ts';
import { dayKey } from '../../core/streak.ts';
import type { ScaleSession } from '../../core/scaleRecords.ts';
import { exerciseKey, scaleNotes, tonicsOf } from '../../core/scales.ts';
import { SCALE_OCTAVES, SCALE_TYPES, type ScaleExercise } from '../../core/scaleTypes.ts';
import { scaleHands, scaleMusicXml } from '../../core/scaleXml.ts';
import { buildSteps, keyRange, type Hand } from '../../core/score.ts';
import { useT } from '../../i18n/index.ts';
import type { MidiStatus } from '../../input/index.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { usePractice, usePracticeStore } from '../practice/context.ts';
import { useNow } from '../progress/useNow.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { ScoreView, type ScoreStatus } from '../notation/ScoreView.tsx';
import { prefetchVerovio, type Engraving } from '../notation/verovio.ts';
import { Piano } from '../piano/Piano.tsx';
import { keyboardRange, whiteKeys } from '../piano/range.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';
import { FocusBar, FocusEnter } from '../focus/FocusBar.tsx';
import { useFocusState } from '../focus/focus.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { spelledName, tonicName, useExerciseName } from './format.ts';
import { readExercise, writeExercise } from './prefs.ts';
import { scaleRunRecord, useScaleRecorder, type SessionSlot } from './record.ts';
import { runInput, sessionStep, usedPedal, waitingRun, type ScaleRunState } from './run.ts';
import { ScaleProgress, YourScales } from './ScaleProgress.tsx';
import { ScaleSummary } from './ScaleSummary.tsx';

/** How often a running run looks at the clock, for its idle end. */
const TICK_MS = 250;
/**
 * A short scale is one short system: drawn larger, and stretched across the sheet. Four octaves
 * take the whole width at the usual size.
 */
const ZOOM: Record<ScaleExercise['octaves'], number> = { 1: 1.6, 2: 1.3, 3: 1.15, 4: 1 };
/**
 * A system at least a third full is stretched (one octave on one staff fills about 40 %); the last
 * bar alone on a line (about a quarter) is not. Octave lines read "8va", clear of the fingering.
 */
const ENGRAVING: Engraving = { lastJustification: 0.35, ottavaText: true };
const HANDS: readonly ScaleExercise['hands'][] = ['right', 'left', 'both'];
/** Off: the keyboard marks only the keys to start on, not each next key. */
const GUIDE_PREF = 'dacapo.scales.guide';

export function ScalesPage() {
  const t = useT();
  const name = useExerciseName();
  const [exercise, setExerciseState] = useState(readExercise);
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
  }

  return (
    <section className={focus.on ? 'scales is-focus' : 'scales'}>
      <h1 className="visually-hidden">{t('scales.title')}</h1>
      {focus.on && (
        <FocusBar
          heading={<h2 className="focus-title">{name(exercise)}</h2>}
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
        // Selects take the computer keyboard's letters; after a choice, the keys play notes again.
        onChosen={() => stage.current?.focus({ preventScroll: true })}
      />
      <div className="scale-stage" ref={stage} tabIndex={-1}>
        <ScaleSession key={exerciseKey(exercise)} exercise={exercise} slot={slot} />
      </div>
      {!focus.on && (
        <>
          <ScaleProgress
            exercise={exercise}
            progress={progress.find((p) => p.exercise === exerciseKey(exercise)) ?? null}
            now={now}
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

function ScalePicker({
  id: pickerId,
  hidden,
  exercise,
  onChange,
  onChosen,
}: {
  id: string;
  hidden: boolean;
  exercise: ScaleExercise;
  onChange: (next: ScaleExercise) => void;
  /** A choice was made in a select. */
  onChosen: () => void;
}) {
  const t = useT();
  const id = useId();

  function setType(type: ScaleExercise['type']) {
    // The same tonic if the new type has it, else the one at the same place in the circle.
    const before = tonicsOf(exercise.type);
    const after = tonicsOf(type);
    const tonic = after.includes(exercise.tonic)
      ? exercise.tonic
      : (after[Math.max(0, before.indexOf(exercise.tonic))] ?? after[0]!);
    onChange({ ...exercise, type, tonic });
  }

  return (
    <div className="scale-picker" id={pickerId} hidden={hidden}>
      <div className="field">
        <label htmlFor={`${id}-type`}>{t('scales.pick.type')}</label>
        <select
          id={`${id}-type`}
          value={exercise.type}
          onChange={(e) => {
            setType(e.target.value as ScaleExercise['type']);
            onChosen();
          }}
        >
          {SCALE_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`scales.type.${type}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-tonic`}>{t('scales.pick.tonic')}</label>
        <select
          id={`${id}-tonic`}
          value={exercise.tonic}
          onChange={(e) => {
            onChange({ ...exercise, tonic: e.target.value });
            onChosen();
          }}
        >
          {tonicsOf(exercise.type).map((tonic) => (
            <option key={tonic} value={tonic}>
              {tonicName(tonic)}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="field">
        <legend>{t('scales.pick.octaves')}</legend>
        <div className="segmented">
          {SCALE_OCTAVES.map((octaves) => (
            <label key={octaves}>
              <input
                type="radio"
                name={`${id}-octaves`}
                checked={exercise.octaves === octaves}
                onChange={() => onChange({ ...exercise, octaves })}
              />
              <span>{octaves}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>{t('scales.pick.hand')}</legend>
        <div className="segmented">
          {HANDS.map((hand) => (
            <label key={hand}>
              <input
                type="radio"
                name={`${id}-hand`}
                checked={exercise.hands === hand}
                onChange={() => onChange({ ...exercise, hands: hand })}
              />
              <span>{t(`scales.hand.${hand}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
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

function ScaleSession({ exercise, slot }: { exercise: ScaleExercise; slot: SessionSlot }) {
  const t = useT();
  const name = useExerciseName();
  const focus = useFocusState();
  const [guide, setGuideState] = useState(() => readPref(GUIDE_PREF) !== '0');
  const { hub, pointer, midi } = useInput();
  const store = usePracticeStore();
  const { held, sustained } = useHubState();
  const hands = exercise.hands;
  const notes = useMemo(() => scaleNotes(exercise), [exercise]);
  // The run: one hand's notes, or the right hand's then the left's (what the analysis takes).
  const expected = useMemo(
    () => (hands === 'both' ? [...notes.right, ...notes.left] : notes[hands]),
    [notes, hands],
  );
  const names = useMemo(
    () => ({
      right: notes.right.map((note) => spelledName(note.pitch)),
      left: notes.left.map((note) => spelledName(note.pitch)),
    }),
    [notes],
  );
  const xml = useMemo(() => scaleMusicXml(exercise), [exercise]);
  const score = useMemo(
    () =>
      parseMusicXml(new DOMParser().parseFromString(xml, 'application/xml'), {
        hands: scaleHands(exercise),
      }),
    [xml, exercise],
  );
  const steps = useMemo(() => buildSteps(score, hands), [score, hands]);
  // The run's notes on the score: each hand's notes in the order played are its run, note for
  // note (scaleXml.test.ts holds it), and each belongs to the step at its onset.
  const noteIds = useMemo(() => {
    const of = (hand: Hand) =>
      score.notes
        .filter((n) => n.hand === hand)
        .sort((a, b) => a.onset - b.onset)
        .map((n) => n.id);
    return { right: of('right'), left: of('left') };
  }, [score]);
  /** The score's note for a note of the run (an index into `expected`). */
  const idOf = useMemo(
    () => (n: number) => {
      const note = expected[n];
      return note ? noteIds[note.hand][note.index] : undefined;
    },
    [expected, noteIds],
  );
  const stepOfNote = useMemo(
    () => new Map(steps.flatMap((s) => s.noteIds.map((id) => [id, s] as const))),
    [steps],
  );
  const [status, setStatus] = useState<ScoreStatus>({ state: 'loading' });
  const [run, dispatch] = useReducer(sessionStep, expected, (notes) =>
    waitingRun(notes, hub.getState().sustain),
  );
  useScaleRecorder(run, exercise, slot, store, () => inputNames(midi.getStatus()));
  // From the first run on; the page alone does not keep the screen on.
  useKeepAwake(run.phase !== 'waiting', KEEP_AWAKE_IDLE_MS);

  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'sustain')
          dispatch({ type: 'pedal', down: event.down, time: event.time });
        else if (event.type === 'on') dispatch({ ...event, type: 'on', at: Date.now() });
        else dispatch({ type: 'off', midi: event.midi, time: event.time });
      }),
    [hub],
  );
  const playing = run.phase === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => dispatch({ type: 'tick', time: performance.now() }), TICK_MS);
    return () => clearInterval(id);
  }, [playing]);

  const analysis = useMemo(() => (run.phase === 'done' ? analyze(run) : null), [run]);
  const ok = analysis?.quality === 'ok';

  // The score: the note to play next, the notes played green; after a run, each note inked by
  // how far off the line it was, and the wrong and missed ones in the error colour.
  const nextNote = run.steps[run.next]?.notes[0];
  const next = nextNote === undefined ? undefined : idOf(nextNote);
  const step = run.phase === 'done' || next === undefined ? null : (stepOfNote.get(next) ?? null);
  const marks = useMemo(() => {
    const out = new Map<string, string>();
    if (analysis && ok) {
      for (const hand of analysis.hands)
        for (const note of hand.notes) {
          const id = noteIds[hand.hand][note.index];
          const mark = note.outcome === 'played' ? deviationMark(note.deviation) : 'is-missed';
          if (id && mark) out.set(id, mark);
        }
    } else if (run.phase !== 'done') {
      for (const n of run.played) {
        const id = idOf(n);
        if (id) out.set(id, 'is-pressed');
      }
    }
    return out;
  }, [analysis, ok, run.phase, run.played, noteIds, idOf]);

  const keys = useMemo(() => {
    const span = keyRange(score, hands) ?? [60, 72];
    return keyboardRange(span[0], span[1]);
  }, [score, hands]);
  const wrong = useMemo(() => new Set(run.wrongKey === null ? [] : [run.wrongKey]), [run.wrongKey]);
  // The keys to start on: the tonic of each hand played.
  const startNotes = run.steps[0]?.notes ?? [];
  const first = startNotes.map((n) => names[expected[n]!.hand][0]).join(t('scales.status.and'));
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

  return (
    <div className="scale-session">
      <div className="scale-head">
        {!focus.on && <h2 className="scale-title">{name(exercise)}</h2>}
        <p className="scale-status" role="status">
          {run.phase === 'waiting'
            ? t('scales.status.start', { key: first })
            : run.phase === 'playing'
              ? t('scales.status.playing', { n: run.played.length, total: expected.length })
              : ok
                ? t('scales.status.again', { key: first })
                : t('scales.status.notARun', { key: first })}
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
          {playing && (
            <button
              type="button"
              className="button is-compact"
              onClick={() => dispatch({ type: 'stop', time: performance.now() })}
            >
              {t('scales.stop')}
            </button>
          )}
          {!focus.on && <FocusEnter />}
        </div>
      </div>

      <div className="scale-sheet">
        <ScoreView
          xml={xml}
          score={score}
          title={name(exercise)}
          step={step}
          pressed={[]}
          hands={hands}
          onStatus={setStatus}
          marks={marks}
          zoom={ZOOM[exercise.octaves] * (focus.on ? focus.zoom : 1)}
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

      <KeyboardHint />

      {analysis && (
        <ScaleSummary analysis={analysis} names={names} end={run.end} pedal={usedPedal(run)} />
      )}
      {import.meta.env.DEV && run.phase === 'done' && <SaveRun exercise={exercise} run={run} />}
    </div>
  );
}

/** Without a MIDI keyboard: which octave the computer keyboard plays, and how to change it. */
function KeyboardHint() {
  const t = useT();
  const octave = useKeyboardOctave();
  if (!useKeyboardFallback()) return null;
  return <p className="muted scale-keyboard">{t('read.keyboard', { octave })}</p>;
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
