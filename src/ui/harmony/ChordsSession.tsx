import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef } from 'react';
import {
  bassMissing,
  bassTone,
  formatSymbol,
  symbolPitchClasses,
  symbolVoicing,
  type ChordSymbol,
} from '../../core/chordSymbols.ts';
import type { HarmonySessionState } from '../../core/harmonySession.ts';
import { pitchClass } from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { useNoteNames } from '../noteNames.ts';
import { Piano } from '../piano/Piano.tsx';
import { useReadFormat } from '../read/format.ts';
import type { HarmonyController } from './controller.ts';
import { createLatchedPointer } from './latch.ts';
import { chordToneNames, heldNames, useHarmonyFormat } from './format.ts';
import { SymbolText } from './SymbolText.tsx';

/** The small keyboard under the symbol: C3–B5, where the chords are marked. */
const CHORD_KEYS: readonly [number, number] = [48, 83];

const NONE: ReadonlySet<number> = new Set();
const NO_CLASSES: ReadonlyMap<number, string> = new Map();

interface ChordsSessionProps {
  session: HarmonySessionState;
  controller: HarmonyController;
  onHint: (hint: boolean) => void;
}

export function ChordsSession({ session, controller, onHint }: ChordsSessionProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useHarmonyFormat();
  const names = useNoteNames();
  const hintId = useId();
  const region = useRef<HTMLElement>(null);
  const { pointer } = useInput();
  const { held, sustained } = useHubState();
  const { card } = session;
  const { index, symbol, status } = card;

  // Moving focus off the Start button means Enter or Space cannot trigger a control by accident.
  useEffect(() => region.current?.focus({ preventScroll: true }), []);

  // A click or tap latches a key on the screen's keyboard, so a mouse can build a chord; the keys
  // latched for a card are let go when the next one comes (and when the session ends).
  const latch = useMemo(() => createLatchedPointer(pointer), [pointer]);
  useEffect(() => () => latch.releaseAll(performance.now()), [latch, index]);

  const onPainted = useCallback(
    (time: number) => controller.painted(index, time),
    [controller, index],
  );

  const voicing = useMemo(() => symbolVoicing(symbol), [symbol]);
  const bass = bassTone(symbol);
  const written = formatSymbol(symbol);
  const answer = session.answers.at(-1);
  const scored = answer && status !== 'waiting' ? answer : null;
  const wrongKeys = status === 'wrong' ? card.wrong : null;
  const waitingForBass = status !== 'correct' && bassMissing(symbol, card.held);

  // After a wrong answer the chord is marked; with the hint, its notes are marked lightly.
  const marked = useMemo(() => (wrongKeys ? new Set(voicing) : NONE), [wrongKeys, voicing]);
  const wrong = useMemo(() => {
    if (!wrongKeys) return NONE;
    const pcs = symbolPitchClasses(symbol);
    return new Set(wrongKeys.filter((midi) => !pcs.has(pitchClass(midi))));
  }, [wrongKeys, symbol]);
  const hinted = session.hint && status === 'waiting';
  const keyClasses = useMemo(
    () => (hinted ? new Map(voicing.map((midi) => [midi, 'is-hint'])) : NO_CLASSES),
    [hinted, voicing],
  );

  return (
    <section
      className="read-session harmony-session"
      ref={region}
      tabIndex={-1}
      aria-label={t('harmony.practice.chords')}
    >
      <div className="read-bar">
        <p className="read-level">{format.level(session.level)}</p>
        <p className="read-count">
          {t('read.card', { n: Math.min(index + 1, session.length), total: session.length })}
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={session.hint}
            onChange={(e) => onHint(e.target.checked)}
            aria-describedby={hintId}
          />
          <span>{t('harmony.hint')}</span>
        </label>
        <span id={hintId} className="visually-hidden">
          {t('harmony.hint.help')}
        </span>
        <button type="button" className="button" onClick={controller.stop}>
          {t('read.stop')}
        </button>
      </div>
      <div className="read-progress" aria-hidden="true">
        <span
          style={{ transform: `scaleX(${Math.min(index, session.length) / session.length})` }}
        />
      </div>

      <div className={`read-card harmony-card is-${status}`}>
        <PaintedSymbol symbol={symbol} label={format.words(symbol)} onPainted={onPainted} />
        {session.hint && (
          <p className="harmony-tones">
            <span aria-hidden="true">{format.notes(symbol)}</span>
            <span className="visually-hidden">
              {t('harmony.hint.label', { notes: format.notes(symbol) })}
            </span>
          </p>
        )}
      </div>

      <div className={`read-feedback harmony-feedback is-${status}`} role="status">
        {status === 'waiting' && !waitingForBass && (
          <p className="read-prompt">
            {bass ? t('harmony.task.slash', { bass: names.letterOf(bass) }) : t('harmony.task')}
          </p>
        )}
        {waitingForBass && bass && status === 'waiting' && (
          <p className="read-prompt">{t('harmony.bass', { bass: names.letterOf(bass) })}</p>
        )}
        {status === 'correct' && (
          <p className="read-result">
            <ResultIcon ok />
            {scored?.correct
              ? t('read.correct.time', { time: read.seconds(scored.ms) })
              : t('read.correct.after')}
          </p>
        )}
        {status === 'wrong' && wrongKeys && (
          <>
            <p className="read-result">
              <ResultIcon ok={false} />
              {t('read.wrong', { played: heldNames(wrongKeys, symbol, names) })}
            </p>
            <p className="read-target">
              {bass
                ? t('harmony.wrong.slash', {
                    symbol: written,
                    notes: chordToneNames(symbol, names),
                    bass: names.letterOf(bass),
                  })
                : t('harmony.wrong', { symbol: written, notes: chordToneNames(symbol, names) })}
            </p>
          </>
        )}
      </div>

      <Piano
        className="harmony-piano"
        held={held}
        sustained={sustained}
        pointer={latch}
        range={CHORD_KEYS}
        marked={marked}
        wrong={wrong}
        keyClasses={keyClasses}
      />
      <p className="help harmony-latch">{t('harmony.latch')}</p>
      <KeyboardLine />
    </section>
  );
}

/**
 * The symbol, large, and when it is on screen: the frame after it was laid out, as the staff
 * reports its cards (a new callback, for the next card, reports again).
 */
function PaintedSymbol({
  symbol,
  label,
  onPainted,
}: {
  symbol: ChordSymbol;
  label: string;
  onPainted: (time: number) => void;
}) {
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => onPainted(performance.now()));
    return () => cancelAnimationFrame(frame);
  }, [onPainted]);
  return (
    <p className="harmony-symbol">
      <SymbolText symbol={symbol} label={label} />
    </p>
  );
}

function ResultIcon({ ok }: { ok: boolean }) {
  return (
    <svg className="read-icon" viewBox="0 0 16 16" aria-hidden="true">
      {ok ? <path d="M3.5 8.5l3 3 6-7" /> : <path d="M4 4l8 8M12 4l-8 8" />}
    </svg>
  );
}

/** Without a MIDI keyboard, the octave the computer keyboard plays in. */
function KeyboardLine() {
  const t = useT();
  const octave = useKeyboardOctave();
  if (!useKeyboardFallback()) return null;
  return <p className="help read-keyboard">{t('read.keyboard', { octave })}</p>;
}
