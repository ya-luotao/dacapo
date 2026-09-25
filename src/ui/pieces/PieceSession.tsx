import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { Link } from 'wouter';
import { isBlack, midiName, PIANO_HIGHEST, PIANO_LOWEST } from '../../core/note.ts';
import { summarizeRun } from '../../core/pieceRun.ts';
import { accompanimentPlan, baseTempo, DEMO_VELOCITY, demoPlan } from '../../core/playback.ts';
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
import { usePieceFormat } from './format.ts';
import { RunSummary } from './RunSummary.tsx';
import { runReducer, startRun } from './run.ts';
import type { OpenPiece } from './usePiece.ts';

const HANDS_PREF = 'dacapo.pieces.hands';
const SHOW_KEYS_PREF = 'dacapo.pieces.showKeys';
const ACCOMPANY_PREF = 'dacapo.pieces.accompany';
/** Tempo choices, in percent of the score's tempo marks. */
const TEMPOS = [40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200];
const WRONG_FLASH_MS = 350;
const HAND_CHOICES = ['right', 'left', 'both'] as const;
const NO_KEYS: readonly number[] = [];

function readHands(): HandSelection {
  const value = readPref(HANDS_PREF);
  return value === 'left' || value === 'both' ? value : 'right';
}

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
  const showKeysId = useId();

  const [hands, setHandsState] = useState<HandSelection>(readHands);
  const [repeats, setRepeats] = useState<RepeatMode>('play');
  const [loop, setLoop] = useState<BarLoop | null>(null);
  const [startBar, setStartBar] = useState(0);
  const [showKeys, setShowKeysState] = useState(() => readPref(SHOW_KEYS_PREF) === '1');
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>({ state: 'loading' });
  const [tempo, setTempo] = useState(100);
  const [accompany, setAccompanyState] = useState(() => readPref(ACCOMPANY_PREF) !== '0');
  const [player] = useState(() =>
    createDemoPlayer(output.scheduler, browserClock, output.onInterrupt),
  );
  const [accompanist] = useState(() => createAccompanist(output.scheduler, browserClock));
  const demo = useSyncExternalStore(player.subscribe, player.getState);
  const demoStep = useSyncExternalStore(player.subscribe, player.currentStep);
  const listening = demo !== 'stopped';

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

  const [run, dispatch] = useReducer(runReducer, { steps, range }, startRun);
  // Any change of hands, bars or repeats starts over (React's pattern for state derived from
  // props: set during render, before anything is painted).
  if (run.steps !== steps || run.range !== range) dispatch({ type: 'restart', steps, range });

  /** Stops whatever the instrument is playing for us: the demo and the other hand. */
  function silence() {
    if (player.getState() !== 'stopped') player.stop();
    else output.scheduler.panic();
    accompanist.reset();
  }

  const restart = () => {
    silence();
    dispatch({ type: 'restart', steps, range });
    region.current?.focus({ preventScroll: true });
  };

  // A new run (other hands, bars or repeats) or a finished loop: silence. Not on mount.
  const runKey = useRef({ steps, range, ended: run.ended });
  useEffect(() => {
    const previous = runKey.current;
    if (previous.steps === steps && previous.range === range && previous.ended === run.ended)
      return;
    runKey.current = { steps, range, ended: run.ended };
    silence();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- silence only uses stable objects
  }, [steps, range, run.ended]);
  useEffect(
    () => () => {
      player.stop();
      output.scheduler.panic();
    },
    [player, output],
  );

  // Keys play the wait mode, except while the demo is playing.
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on' && player.getState() === 'stopped')
          dispatch({ type: 'press', midi: event.midi, time: event.time });
      }),
    [hub, player],
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
      player.play(plan, DEMO_VELOCITY);
    }
  }

  function changeTempo(next: number) {
    const state = player.getState();
    const at = player.position();
    setTempo(next);
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

  function setHands(next: HandSelection) {
    setHandsState(next);
    writePref(HANDS_PREF, next);
  }

  function setShowKeys(next: boolean) {
    setShowKeysState(next);
    writePref(SHOW_KEYS_PREF, next ? '1' : null);
  }

  const wait = run.wait;
  const waitStep = wait && !wait.finished ? (steps[wait.current] ?? null) : null;
  const step = listening ? (demoStep === null ? null : (steps[demoStep] ?? null)) : waitStep;
  const done = Boolean(wait?.finished || run.ended);
  const summary = useMemo(
    () => (done ? summarizeRun(run.records, run.startedAt) : null),
    [done, run.records, run.startedAt],
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
    return showKeys && step
      ? new Set(step.midis.filter((m) => !wait?.pressed.includes(m)))
      : new Set<number>();
  }, [listening, showKeys, step, wait?.pressed]);

  const barOptions = playedBars.map((index) => (
    <option key={index} value={index}>
      {format.barNumber(index)}
    </option>
  ));

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
          <span className="piece-control-label">{t('pieces.start')}</span>
          <select
            className="is-compact"
            aria-label={t('pieces.start.label')}
            value={startBar}
            onChange={(e) => {
              setStartBar(Number(e.target.value));
              settle();
            }}
          >
            {barOptions}
          </select>
        </label>

        {hasRepeats && (
          <fieldset className="piece-control">
            <legend className="visually-hidden">{t('pieces.repeats')}</legend>
            <span className="piece-control-label" aria-hidden="true">
              {t('pieces.repeats')}
            </span>
            <div className="segmented is-compact">
              {(['play', 'skip'] as const).map((mode) => (
                <label key={mode}>
                  <input
                    type="radio"
                    name={`${showKeysId}-repeats`}
                    value={mode}
                    checked={repeats === mode}
                    onChange={() => {
                      setRepeats(mode);
                      setLoop(null);
                    }}
                  />
                  <span>{t(`pieces.repeats.${mode}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="check piece-control">
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

        <div className="piece-control piece-transport">
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
              {t('pieces.tempo.bpm', { bpm: Math.round(baseTempo(score) * scale) })}
            </span>
          </label>
          <button
            type="button"
            className="button is-compact piece-listen"
            disabled={!hasOutput || !plan}
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
          {hands !== 'both' && (
            <label className="check piece-control">
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
        </div>
      </div>

      <div className="piece-stage">
        <ScoreView
          xml={piece.xml}
          score={score}
          title={piece.title}
          step={step}
          pressed={listening ? NO_KEYS : (wait?.pressed ?? NO_KEYS)}
          hands={hands}
          onStatus={setScoreStatus}
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
      </div>

      <div className="piece-status">
        <StatusLine
          demo={demo}
          bpm={Math.round(baseTempo(score) * scale)}
          wait={wait}
          step={step}
          started={run.startedAt !== null}
          nothing={!range}
          showKeys={showKeys}
          total={range ? range.last - range.first + 1 : 0}
          bar={step ? format.bar(step.measure) : ''}
          beat={step ? format.beat(step.beat) : ''}
        />
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
        </div>
      </div>

      <div className="piece-keys" style={{ '--piece-whites': whites } as CSSProperties}>
        <Piano
          held={held}
          sustained={sustained}
          pointer={pointer}
          marked={marked}
          wrong={wrong}
          range={keys}
          className="piece-piano"
        />
      </div>
    </section>
  );
}

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
