import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { formatPitch, letterName, midiName } from '../../core/note.ts';
import type { SessionState } from '../../core/session.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { Piano } from '../piano/Piano.tsx';
import { GrandStaff, type StaffState } from '../staff/GrandStaff.tsx';
import type { ReadController } from './controller.ts';
import { useReadFormat } from './format.ts';

const STAFF_STATE: Record<SessionState['card']['status'], StaffState> = {
  waiting: 'neutral',
  wrong: 'wrong',
  correct: 'correct',
};

interface ReadSessionProps {
  session: SessionState;
  controller: ReadController;
  onHint: (hint: boolean) => void;
}

export function ReadSession({ session, controller, onHint }: ReadSessionProps) {
  const t = useT();
  const format = useReadFormat();
  const hintId = useId();
  const region = useRef<HTMLElement>(null);
  const { pointer } = useInput();
  const { held, sustained } = useHubState();
  const { card } = session;
  const { index, note } = card;

  // Moving focus off the Start button means Enter or Space cannot trigger a control by accident.
  useEffect(() => region.current?.focus({ preventScroll: true }), []);

  const onPainted = useCallback(
    (time: number) => controller.painted(index, time),
    [controller, index],
  );

  const marked = useMemo(
    () => (card.status === 'wrong' ? new Set([note.midi]) : new Set<number>()),
    [card.status, note.midi],
  );

  const attempt = session.attempts.at(-1);
  const scored = attempt && card.status !== 'waiting' ? attempt : null;

  return (
    <section className="read-session" ref={region} tabIndex={-1} aria-label={t('read.session')}>
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
          <span>{t('read.hint')}</span>
        </label>
        <span id={hintId} className="visually-hidden">
          {t('read.hint.help')}
        </span>
        <button type="button" className="button" onClick={controller.stop}>
          {t('read.stop')}
        </button>
      </div>

      <div className={`read-card is-${card.status}`}>
        <GrandStaff
          pitch={note.pitch}
          clef={note.clef}
          state={STAFF_STATE[card.status]}
          onPainted={onPainted}
        />
        <p className="read-hint">
          {session.hint && (
            <>
              <span aria-hidden="true">{letterName(note.pitch)}</span>
              <span className="visually-hidden">
                {t('read.hint.label', { name: letterName(note.pitch) })}
              </span>
            </>
          )}
        </p>
      </div>

      <div className={`read-feedback is-${card.status}`} role="status">
        {card.status === 'waiting' && <p className="read-prompt">{t('read.prompt')}</p>}
        {card.status === 'correct' && (
          <p className="read-result">
            <ResultIcon ok />
            {scored?.correct
              ? t('read.correct.time', { time: format.seconds(scored.ms) })
              : t('read.correct.after')}
          </p>
        )}
        {card.status === 'wrong' && card.wrongKey !== null && (
          <>
            <p className="read-result">
              <ResultIcon ok={false} />
              {t('read.wrong', { played: midiName(card.wrongKey) })}
            </p>
            <p className="read-target">
              {t('read.wrong.target', { target: formatPitch(note.pitch) })}
            </p>
          </>
        )}
      </div>

      <Piano held={held} sustained={sustained} pointer={pointer} marked={marked} />
      <KeyboardLine />
    </section>
  );
}

function ResultIcon({ ok }: { ok: boolean }) {
  return (
    <svg className="read-icon" viewBox="0 0 16 16" aria-hidden="true">
      {ok ? <path d="M3.5 8.5l3 3 6-7" /> : <path d="M4 4l8 8M12 4l-8 8" />}
    </svg>
  );
}

/** Without a MIDI keyboard the octave of the computer keyboard decides the answer. */
function KeyboardLine() {
  const t = useT();
  const octave = useKeyboardOctave();
  if (!useKeyboardFallback()) return null;
  return <p className="help read-keyboard">{t('read.keyboard', { octave })}</p>;
}
