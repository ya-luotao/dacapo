import { useEffect, useId, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'wouter';
import { isBlack, midiName, PIANO_HIGHEST, PIANO_LOWEST } from '../../core/note.ts';
import { summarizeRun } from '../../core/pieceRun.ts';
import { playOrder, type RepeatMode } from '../../core/repeats.ts';
import { buildSteps, keyRange, type HandSelection } from '../../core/score.ts';
import { waitRange, type BarLoop, type WaitState } from '../../core/wait.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { ScoreView, type ScoreStatus } from '../notation/ScoreView.tsx';
import { Piano } from '../piano/Piano.tsx';
import { usePieceFormat } from './format.ts';
import { RunSummary } from './RunSummary.tsx';
import { runReducer, startRun } from './run.ts';
import type { OpenPiece } from './usePiece.ts';

const HANDS_PREF = 'dacapo.pieces.hands';
const SHOW_KEYS_PREF = 'dacapo.pieces.showKeys';
const WRONG_FLASH_MS = 350;
const HAND_CHOICES = ['right', 'left', 'both'] as const;

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
  const { hub, pointer } = useInput();
  const { held, sustained } = useHubState();
  const region = useRef<HTMLElement>(null);
  const showKeysId = useId();

  const [hands, setHandsState] = useState<HandSelection>(readHands);
  const [repeats, setRepeats] = useState<RepeatMode>('play');
  const [loop, setLoop] = useState<BarLoop | null>(null);
  const [startBar, setStartBar] = useState(0);
  const [showKeys, setShowKeysState] = useState(() => readPref(SHOW_KEYS_PREF) === '1');
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus>({ state: 'loading' });

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

  const [run, dispatch] = useReducer(runReducer, { steps, range }, startRun);
  // Any change of hands, bars or repeats starts over (React's pattern for state derived from
  // props: set during render, before anything is painted).
  if (run.steps !== steps || run.range !== range) dispatch({ type: 'restart', steps, range });

  const restart = () => {
    dispatch({ type: 'restart', steps, range });
    region.current?.focus({ preventScroll: true });
  };

  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') dispatch({ type: 'press', midi: event.midi, time: event.time });
      }),
    [hub],
  );

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
  const step = wait && !wait.finished ? (steps[wait.current] ?? null) : null;
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
  const marked = useMemo(
    () =>
      showKeys && step
        ? new Set(step.midis.filter((m) => !wait?.pressed.includes(m)))
        : new Set<number>(),
    [showKeys, step, wait?.pressed],
  );

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
      </div>

      <div className="piece-stage">
        <ScoreView
          xml={piece.xml}
          score={score}
          title={piece.title}
          step={step}
          pressed={wait?.pressed ?? []}
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
  wait,
  step,
  started,
  nothing,
  showKeys,
  total,
  bar,
  beat,
}: {
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
