import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  answerNameOf,
  answerNames,
  getEarLevel,
  givenKey,
  parseItem,
  spellPrompt,
  type Prompt,
} from '../../core/earItems.ts';
import { formatPitch, pitchToMidi, type Pitch } from '../../core/note.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { Piano } from '../piano/Piano.tsx';
import { useReadFormat } from '../read/format.ts';
import { NotesStaff } from '../staff/GrandStaff.tsx';
import { STAFF_HEIGHT, STAFF_WIDTH } from '../staff/draw.ts';
import type { EarController, EarView } from './controller.ts';
import { keyNames, useEarFormat } from './format.ts';
import { earShortcut, nameKey } from './shortcuts.ts';

const NONE: ReadonlySet<number> = new Set();

interface EarSessionProps {
  view: EarView;
  controller: EarController;
}

/** The prompt as written: a melodic interval note after note, the rest stacked. */
function staffColumns(prompt: Prompt): Pitch[][] {
  const pitches = spellPrompt(prompt);
  if (!pitches) return [];
  const item = parseItem(prompt.item);
  if (item?.family === 'interval' && item.direction !== 'harm') {
    return prompt.notes.map((midi) => pitches.filter((p) => pitchToMidi(p) === midi));
  }
  return [pitches];
}

export function EarSession({ view, controller }: EarSessionProps) {
  const t = useT();
  const format = useEarFormat();
  const read = useReadFormat();
  const region = useRef<HTMLElement>(null);
  const { pointer } = useInput();
  const { held, sustained } = useHubState();
  const { session, listening } = view;
  const { card } = session;
  const { prompt, status } = card;
  const level = getEarLevel(session.level);
  const item = parseItem(prompt.item)!;
  const names = useMemo(() => answerNames(level), [level]);
  const answer = session.answers.at(-1);
  const scored = answer && status !== 'waiting' ? answer : null;
  const turn = status === 'waiting' && !listening;

  // Moving focus off the Start button means Enter or Space cannot trigger a control by accident.
  useEffect(() => region.current?.focus({ preventScroll: true }), []);

  // Space hears again, Enter goes on after a wrong answer, 1–9 and 0 choose a name.
  const latest = useRef({ view, names });
  useLayoutEffect(() => {
    latest.current = { view, names };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = earShortcut(e);
      if (!shortcut) return;
      const { view: current, names: choices } = latest.current;
      const now = current.session.card.status;
      switch (shortcut.kind) {
        case 'hearAgain':
          e.preventDefault();
          controller.hearAgain();
          return;
        case 'next':
          // Otherwise Enter does what it does on the focused control.
          if (now !== 'wrong') return;
          e.preventDefault();
          controller.next();
          return;
        case 'name': {
          const name = choices[shortcut.index];
          if (current.session.by !== 'name' || !name) return;
          e.preventDefault();
          controller.choose(name, e.timeStamp);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller]);

  const marked = useMemo(() => {
    if (status !== 'waiting') return new Set(prompt.notes);
    return session.by === 'play' ? new Set([givenKey(prompt)]) : NONE;
  }, [status, prompt, session.by]);
  const wrongKeys = useMemo(
    () =>
      status === 'wrong' && Array.isArray(card.answer)
        ? new Set(card.answer.filter((midi) => !prompt.notes.includes(midi)))
        : NONE,
    [status, card.answer, prompt.notes],
  );
  const columns = useMemo(() => staffColumns(prompt), [prompt]);

  const task =
    session.by === 'name'
      ? t('ear.task.name')
      : item.family === 'chord'
        ? t(level.family === 'chord' && level.bassMatters ? 'ear.task.chordBass' : 'ear.task.chord')
        : t(item.direction === 'down' ? 'ear.task.down' : 'ear.task.up');
  const title =
    status !== 'waiting'
      ? format.capitalize(format.item(prompt.item, session.level))
      : listening
        ? t('ear.listen')
        : t('ear.turn');

  return (
    <section
      className="read-session ear-session"
      ref={region}
      tabIndex={-1}
      aria-label={t('ear.session')}
      style={{ '--staff-aspect': STAFF_WIDTH / STAFF_HEIGHT } as CSSProperties}
    >
      <div className="read-bar">
        <p className="read-level">{format.level(session.level)}</p>
        <p className="read-count">
          {t('ear.count', {
            n: Math.min(card.index + 1, session.length),
            total: session.length,
          })}
        </p>
        <button type="button" className="button ear-stop" onClick={controller.stop}>
          {t('read.stop')}
        </button>
      </div>
      <div className="read-progress" aria-hidden="true">
        <span
          style={{
            transform: `scaleX(${Math.min(card.index, session.length) / session.length})`,
          }}
        />
      </div>

      {/* The sheet: what to do while waiting, then what it was (drawn after a wrong answer). */}
      <div className={`read-card ear-card is-${status}`}>
        <div className="ear-state">
          {status === 'waiting' &&
            (listening ? <SpeakerIcon className="ear-state-icon is-sounding" /> : <KeyIcon />)}
          <p className="ear-title">{title}</p>
        </div>
        {status === 'waiting' && (
          <>
            <p className="ear-task">{task}</p>
            <HearAgain onClick={controller.hearAgain} />
          </>
        )}
        {status === 'wrong' && (
          <NotesStaff
            className="ear-staff"
            columns={columns}
            label={t('ear.staff.label', {
              notes: columns
                .flat()
                .map((p) => formatPitch(p))
                .join(' '),
            })}
          />
        )}
      </div>

      <div className={`read-feedback ear-feedback is-${status}`} role="status">
        {/* The card says it already; this is for screen readers. */}
        {status === 'waiting' && (
          <p className="visually-hidden">{listening ? t('ear.listen') : task}</p>
        )}
        {status === 'correct' && scored && (
          <p className="read-result">
            <ResultIcon ok />
            {t('read.correct.time', { time: read.seconds(scored.ms) })}
          </p>
        )}
        {status === 'wrong' && scored && (
          <>
            <p className="read-result">
              <ResultIcon ok={false} />
              {typeof scored.answer === 'string'
                ? t('ear.wrong.named', { name: format.name(scored.answer, session.level) })
                : t('read.wrong', { played: keyNames(scored.answer) })}
            </p>
            {/* The sheet shows it; this is for screen readers. */}
            <p className="visually-hidden">
              {t('ear.wrong.answer', { answer: format.item(prompt.item, session.level) })}
            </p>
            <div className="ear-next">
              <button
                type="button"
                className="button button-primary"
                onClick={controller.next}
                aria-keyshortcuts="Enter"
              >
                {t('ear.next')}
                <kbd>{t('ear.key.enter')}</kbd>
              </button>
              <HearAgain onClick={controller.hearAgain} />
            </div>
            <p className="help ear-next-help">{t('ear.next.help')}</p>
          </>
        )}
      </div>

      {session.by === 'name' && (
        <div
          className="ear-names"
          role="group"
          aria-label={t('ear.names')}
          style={{ '--columns': nameColumns(names.length) } as CSSProperties}
        >
          {names.map((name, i) => {
            const key = nameKey(i);
            const right = status !== 'waiting' && name === answerNameOf(item);
            const chosen = status !== 'waiting' && name === card.answer && !right;
            const inactive = !turn;
            return (
              <button
                key={name}
                type="button"
                className={`button ear-name${right ? ' is-right' : ''}${chosen ? ' is-chosen' : ''}`}
                aria-disabled={inactive || undefined}
                aria-keyshortcuts={key ?? undefined}
                data-name={name}
                onClick={(e) => {
                  if (!inactive) controller.choose(name, e.timeStamp);
                }}
              >
                {right && <ResultIcon ok />}
                {chosen && <ResultIcon ok={false} />}
                <span>{format.button(name, session.level)}</span>
                {key && <kbd aria-hidden="true">{key}</kbd>}
              </button>
            );
          })}
        </div>
      )}

      <Piano
        held={held}
        sustained={sustained}
        pointer={pointer}
        marked={marked}
        wrong={wrongKeys}
      />
      <KeyboardLine />
    </section>
  );
}

/** Columns for `count` answer buttons on a wide screen: rows as even as they can be, six at most. */
function nameColumns(count: number): number {
  if (count <= 4) return count;
  return count <= 8 ? Math.ceil(count / 2) : 6;
}

function HearAgain({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="button ear-again" onClick={onClick} aria-keyshortcuts="Space">
      <SpeakerIcon />
      <span>{t('ear.hearAgain')}</span>
      <kbd>{t('ear.key.space')}</kbd>
    </button>
  );
}

function ResultIcon({ ok }: { ok: boolean }) {
  return (
    <svg className="read-icon" viewBox="0 0 16 16" aria-hidden="true">
      {ok ? <path d="M3.5 8.5l3 3 6-7" /> : <path d="M4 4l8 8M12 4l-8 8" />}
    </svg>
  );
}

function SpeakerIcon({ className = 'ear-icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" />
      <path className="ear-wave" d="M10.5 5.75a3 3 0 0 1 0 4.5" />
      <path className="ear-wave" d="M12.25 4a5.5 5.5 0 0 1 0 8" />
    </svg>
  );
}

/** Three keys of a keyboard, two black ones between them: it is the player's turn. */
function KeyIcon() {
  return (
    <svg className="ear-state-icon" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="10" rx="1" />
      <path d="M5.83 8.5V13M10.17 8.5V13" />
      <rect className="ear-black-key" x="4.63" y="3" width="2.4" height="5.5" rx="0.3" />
      <rect className="ear-black-key" x="8.97" y="3" width="2.4" height="5.5" rx="0.3" />
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
