import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react';
import {
  answerNameOf,
  answerNames,
  getEarLevel,
  givenKey,
  parseItem,
  spellPrompt,
  type Prompt,
} from '../../core/earItems.ts';
import { accidentalMarks, spellInKey } from '../../core/earMelody.ts';
import { CADENCE_NUMERALS, isCadence } from '../../core/cadences.ts';
import type { EarCard } from '../../core/earSession.ts';
import { formatPitch, pitchToMidi, type Pitch } from '../../core/note.ts';
import { WHOLE_TUNE } from '../../core/tuneList.ts';
import { getTune, tunePitch, tuneSpan } from '../../core/tunes.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { Piano } from '../piano/Piano.tsx';
import { useReadFormat } from '../read/format.ts';
import { spelledName } from '../scales/format.ts';
import { MelodyStaff, NotesStaff } from '../staff/GrandStaff.tsx';
import { STAFF_HEIGHT, STAFF_WIDTH, type MelodyDrawing } from '../staff/draw.ts';
import type { EarController, EarView } from './controller.ts';
import { keyNames, useEarFormat } from './format.ts';
import { earShortcut, nameKey } from './shortcuts.ts';

const NONE: ReadonlySet<number> = new Set();

/** A tune's phrase drawn by Verovio: loaded when a tune is played, not with the page. */
const loadTuneStaff = () => import('./TuneStaff.tsx');
const TuneStaff = lazy(loadTuneStaff);

/** A phrase's notes are dots; a whole tune's (and a phrase longer than this) a bar and a count. */
const MAX_DOTS = 24;

interface EarSessionProps {
  view: EarView;
  controller: EarController;
}

/**
 * A melody played back wrong, as drawn: the melody in its key, the notes played right tinted,
 * and the wrong key at its note. Null for anything else.
 */
function melodyDrawing(card: EarCard): MelodyDrawing | null {
  const { prompt, answer } = card;
  const melody = prompt.melody;
  if (!melody || card.status !== 'wrong' || !Array.isArray(answer)) return null;
  const index = answer.length - 1;
  const played = spellInKey(answer[index]!, melody);
  const marks = accidentalMarks(melody.written, melody.fifths, { index, pitch: played });
  return {
    fifths: melody.fifths,
    notes: melody.written.map((pitch, i) => ({
      pitch,
      accidental: marks.line[i]!,
      right: i < index,
    })),
    wrong: { index, pitch: played, accidental: marks.extra },
  };
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
  const echo = item.family === 'echo';
  const cadence = item.family === 'cadence';
  const tune = item.family === 'tune' ? prompt.tune : undefined;
  /** Played back key by key: a melody of Echo, or a tune. */
  const melodic = echo || item.family === 'tune';
  // A melody gone wrong: its note, the key asked for and the key played, each named as the key
  // of the melody writes it (B♭4 in F major, not A♯4). A tune's note is counted in its phrase.
  const miss = useMemo(() => {
    const { melody } = prompt;
    if (status !== 'wrong' || !Array.isArray(card.answer)) return null;
    const index = card.answer.length - 1;
    const played = card.answer[index]!;
    const expected = prompt.notes[index]!;
    if (tune) {
      const data = getTune(tune.tune);
      const place = format.tunePlace(prompt.item, index);
      const key = tuneSpan(data, tune.part).from + index;
      const note = data.notes[key];
      if (!place || !note) return null;
      return {
        n: place.note,
        expected,
        played,
        expectedName: spelledName(tunePitch(data, note.pitch, tune.semitones)),
        playedName: spelledName(spellInKey(played, tune.key)),
        /** The phrase it went wrong in (1-based), and the key of the tune it was played for. */
        at: { phrase: place.phrase, key },
      };
    }
    if (!echo || !melody) return null;
    return {
      n: index + 1,
      expected,
      played,
      expectedName: spelledName(melody.written[index]!),
      playedName: spelledName(spellInKey(played, melody)),
      at: null,
    };
  }, [echo, tune, status, card.answer, prompt, format]);

  // A tune's first wrong answer is drawn by Verovio: fetch both while the first phrase plays.
  const isTune = tune !== undefined;
  useEffect(() => {
    if (!isTune) return;
    void loadTuneStaff().catch(() => undefined);
    let cancel: (() => void) | undefined;
    let cancelled = false;
    void import('../notation/verovio.ts').then((m) => {
      if (!cancelled) cancel = m.prefetchVerovio();
    });
    return () => {
      cancelled = true;
      cancel?.();
    };
  }, [isTune]);

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
    // A melody: its first key to start from, then only the key its wrong note should have been.
    if (melodic) {
      if (status === 'waiting') return new Set([givenKey(prompt)]);
      return miss ? new Set([miss.expected]) : NONE;
    }
    // A cadence is named: its sixteen keys would say nothing on the keyboard.
    if (cadence) return NONE;
    if (status !== 'waiting') return new Set(prompt.notes);
    return session.by === 'play' ? new Set([givenKey(prompt)]) : NONE;
  }, [melodic, cadence, status, prompt, session.by, miss]);
  const wrongKeys = useMemo(() => {
    if (miss) return new Set([miss.played]);
    return status === 'wrong' && Array.isArray(card.answer)
      ? new Set(card.answer.filter((midi) => !prompt.notes.includes(midi)))
      : NONE;
  }, [miss, status, card.answer, prompt.notes]);
  const columns = useMemo(() => staffColumns(prompt), [prompt]);
  const drawing = useMemo(() => melodyDrawing(card), [card]);

  const task =
    item.family === 'echo'
      ? t('ear.task.echo')
      : item.family === 'tune'
        ? t(item.part === WHOLE_TUNE ? 'ear.task.tune.whole' : 'ear.task.tune')
        : item.family === 'cadence'
          ? t('ear.task.cadence')
          : session.by === 'name'
            ? t('ear.task.name')
            : item.family === 'chord'
              ? t(
                  level.family === 'chord' && level.bassMatters
                    ? 'ear.task.chordBass'
                    : 'ear.task.chord',
                )
              : t(item.direction === 'down' ? 'ear.task.down' : 'ear.task.up');
  // After the answer the card names what it was: a melody's or a tune's key.
  const answerKey = prompt.melody ?? tune?.key;
  const answerName = answerKey
    ? format.key(answerKey.tonic, answerKey.scale)
    : format.capitalize(format.item(prompt.item, session.level));
  const count =
    item.family === 'tune'
      ? item.part === WHOLE_TUNE
        ? t('ear.tune.count.whole')
        : t('ear.tune.count', { n: item.part, total: session.length - 1 })
      : t(echo ? 'ear.echo.count' : 'ear.count', {
          n: Math.min(card.index + 1, session.length),
          total: session.length,
        });
  const notesPlayed = status === 'correct' ? prompt.notes.length : card.played.length;
  const title = status !== 'waiting' ? answerName : listening ? t('ear.listen') : t('ear.turn');

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
        <p className="read-count">{count}</p>
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
        {melodic &&
          (prompt.notes.length <= MAX_DOTS ? (
            <NoteDots
              total={prompt.notes.length}
              right={notesPlayed}
              wrong={status === 'wrong'}
              label={t('ear.echo.progress', { n: notesPlayed, total: prompt.notes.length })}
            />
          ) : (
            <NoteCount
              total={prompt.notes.length}
              right={notesPlayed}
              wrong={status === 'wrong'}
              label={t('ear.echo.progress', { n: notesPlayed, total: prompt.notes.length })}
            />
          ))}
        {status === 'waiting' && (
          <>
            <p className="ear-task">{task}</p>
            <HearAgain onClick={controller.hearAgain} />
          </>
        )}
        {tune && miss?.at && (
          <Suspense fallback={<div className="ear-tune-staff" data-state="loading" />}>
            <TuneStaff
              tune={tune.tune}
              phrase={miss.at.phrase - 1}
              semitones={tune.semitones}
              wrongKey={miss.at.key}
              wrongMidi={miss.played}
              label={t('ear.tune.staff', {
                phrase: miss.at.phrase,
                key: answerName,
                n: miss.n,
                played: miss.playedName,
                expected: miss.expectedName,
              })}
            />
          </Suspense>
        )}
        {drawing && prompt.melody && miss && (
          <MelodyStaff
            className="ear-staff ear-melody"
            drawing={drawing}
            label={t('ear.echo.staff', {
              key: answerName,
              notes: prompt.melody.written.map(spelledName).join(' '),
              n: miss.n,
              played: miss.playedName,
            })}
          />
        )}
        {cadence && status !== 'waiting' && prompt.cadence && (
          <CadenceLine
            text={format.cadenceLine(prompt.cadence.key, prompt.cadence.numerals)}
            chords={format.cadenceChords(prompt.cadence.key, prompt.cadence.numerals)}
            numerals={prompt.cadence.numerals}
          />
        )}
        {status === 'wrong' && !melodic && !cadence && (
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
            {/* How long a phrase took to play back says nothing of the ear. */}
            {item.family === 'tune'
              ? t('read.correct')
              : t('read.correct.time', { time: read.seconds(scored.ms) })}
          </p>
        )}
        {status === 'wrong' && scored && (
          <>
            <p className={miss ? 'read-result is-long' : 'read-result'}>
              <ResultIcon ok={false} />
              {miss
                ? miss.at && item.family === 'tune' && item.part === WHOLE_TUNE
                  ? t('ear.tune.wrong.whole', {
                      phrase: miss.at.phrase,
                      n: miss.n,
                      played: miss.playedName,
                      expected: miss.expectedName,
                    })
                  : t('ear.echo.wrong', {
                      n: miss.n,
                      played: miss.playedName,
                      expected: miss.expectedName,
                    })
                : typeof scored.answer === 'string'
                  ? t('ear.wrong.named', { name: format.name(scored.answer, session.level) })
                  : t('read.wrong', { played: keyNames(scored.answer) })}
            </p>
            {/* The sheet shows it; this is for screen readers. */}
            {!melodic && (
              <p className="visually-hidden">
                {t('ear.wrong.answer', { answer: format.item(prompt.item, session.level) })}
              </p>
            )}
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
                {isCadence(name) && (
                  <span className="ear-name-numerals" aria-hidden="true">
                    {CADENCE_NUMERALS[name]}
                  </span>
                )}
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

/**
 * The progression heard, after the answer: its numerals and chords in its key, the last two (the
 * cadence) set apart. Screen readers get the whole line.
 */
function CadenceLine({
  text,
  chords,
  numerals,
}: {
  text: string;
  chords: string;
  numerals: readonly string[];
}) {
  return (
    <p className="ear-cadence">
      <span className="visually-hidden">{text}</span>
      <span className="ear-cadence-numerals" aria-hidden="true">
        {numerals.map((n, i) => (
          <span key={i} className={i >= numerals.length - 2 ? 'is-cadence' : undefined}>
            {n}
          </span>
        ))}
      </span>
      <span className="ear-cadence-chords" aria-hidden="true">
        {chords}
      </span>
    </p>
  );
}

/** Columns for `count` answer buttons on a wide screen: rows as even as they can be, six at most. */
function nameColumns(count: number): number {
  if (count <= 4) return count;
  return count <= 8 ? Math.ceil(count / 2) : 6;
}

/**
 * A melody's notes as dots: filled for each key played right, the next one wrong when it was.
 * One label says it for assistive technology.
 */
function NoteDots({
  total,
  right,
  wrong,
  label,
}: {
  total: number;
  right: number;
  wrong: boolean;
  label: string;
}) {
  return (
    <ol className="ear-dots" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <li
          key={i}
          className={i < right ? 'is-right' : wrong && i === right ? 'is-wrong' : undefined}
        />
      ))}
    </ol>
  );
}

/**
 * A whole tune's notes, too many for dots: a bar that fills as they are played back, and the
 * count in words.
 */
function NoteCount({
  total,
  right,
  wrong,
  label,
}: {
  total: number;
  right: number;
  wrong: boolean;
  label: string;
}) {
  return (
    <div className={wrong ? 'ear-notes is-wrong' : 'ear-notes'}>
      <div className="ear-notes-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${total === 0 ? 0 : right / total})` }} />
      </div>
      <p className="ear-notes-count">{label}</p>
    </div>
  );
}

export function HearAgain({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="button ear-again" onClick={onClick} aria-keyshortcuts="Space">
      <SpeakerIcon />
      <span>{t('ear.hearAgain')}</span>
      <kbd>{t('ear.key.space')}</kbd>
    </button>
  );
}

export function ResultIcon({ ok }: { ok: boolean }) {
  return (
    <svg className="read-icon" viewBox="0 0 16 16" aria-hidden="true">
      {ok ? <path d="M3.5 8.5l3 3 6-7" /> : <path d="M4 4l8 8M12 4l-8 8" />}
    </svg>
  );
}

export function SpeakerIcon({ className = 'ear-icon' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" />
      <path className="ear-wave" d="M10.5 5.75a3 3 0 0 1 0 4.5" />
      <path className="ear-wave" d="M12.25 4a5.5 5.5 0 0 1 0 8" />
    </svg>
  );
}

/** Three keys of a keyboard, two black ones between them: it is the player's turn. */
export function KeyIcon() {
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
