import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { isSeventh } from '../../core/earItems.ts';
import { midiOf } from '../../core/musicxml.ts';
import { LETTERS, pitchClass, type Letter } from '../../core/note.ts';
import { signatureTonic, tonicPitch } from '../../core/keys.ts';
import {
  chordAnswerName,
  getTheoryLevel,
  INTERVAL_NUMBERS,
  parseChordName,
  parseIntervalName,
  QUALITIES,
  qualitiesOf,
  writtenKeys,
  type IntervalNumber,
  type Quality,
  type ReadChordLevel,
  type TheoryPrompt,
} from '../../core/theoryItems.ts';
import {
  rightKeys,
  rightName,
  storedPrompt,
  type TheorySessionState,
} from '../../core/theorySession.ts';
import { useT } from '../../i18n/index.ts';
import { useHubState, useInput, useKeyboardOctave } from '../input/context.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { Piano } from '../piano/Piano.tsx';
import { spelledName } from '../scales/format.ts';
import type { StaffState } from '../staff/GrandStaff.tsx';
import { TheoryStaff } from '../staff/GrandStaff.tsx';
import { theoryBox, type TheoryDrawing } from '../staff/draw.ts';
import { useReadFormat } from './format.ts';
import type { TheoryController } from './theoryController.ts';
import { letterOf, playedNames, rootName, useTheoryFormat } from './theoryFormat.ts';
import {
  chordKey,
  chordShortcut,
  intervalShortcut,
  type TheoryShortcut,
} from './theoryShortcuts.ts';

const NONE: ReadonlySet<number> = new Set();

const STAFF_STATE: Record<TheorySessionState['card']['status'], StaffState> = {
  waiting: 'neutral',
  wrong: 'wrong',
  correct: 'correct',
};

/** What the card writes on the staff: a melodic interval note after note, the rest stacked. */
function drawingOf(prompt: TheoryPrompt): TheoryDrawing {
  if (prompt.family === 'keySignature') return { kind: 'signature', fifths: prompt.fifths };
  const melodic = prompt.family === 'readInterval' && !prompt.item.endsWith(':harm');
  return {
    kind: 'notes',
    clef: prompt.clef,
    columns: melodic ? prompt.notes.map((note) => [note]) : [prompt.notes],
  };
}

/** The hint: the letter names under each column (low to high in a stack), or the signature's. */
function hintNames(
  prompt: TheoryPrompt,
  signatureLetters: (fifths: number) => string,
  none: string,
) {
  if (prompt.family === 'keySignature') {
    return [prompt.fifths === 0 ? none : signatureLetters(prompt.fifths)];
  }
  const { columns } = drawingOf(prompt) as Extract<TheoryDrawing, { kind: 'notes' }>;
  return columns.map((column) =>
    [...column]
      .sort((a, b) => midiOf(a) - midiOf(b))
      .map(letterOf)
      .join(' '),
  );
}

/** The key signature's tonic nearest to `near`: where to point after a wrong key. */
function nearestTonic(fifths: number, mode: 'major' | 'minor', near: number): number {
  const pc = pitchClass(midiOf(tonicPitch(signatureTonic(fifths, mode), 4)));
  const below = near - pitchClass(near - pc);
  return near - below <= 6 ? below : below + 12;
}

interface TheorySessionProps {
  session: TheorySessionState;
  controller: TheoryController;
  onHint: (hint: boolean) => void;
}

export function TheorySession({ session, controller, onHint }: TheorySessionProps) {
  const t = useT();
  const read = useReadFormat();
  const format = useTheoryFormat();
  const hintId = useId();
  const region = useRef<HTMLElement>(null);
  const { pointer, keyboard } = useInput();
  const { held, sustained } = useHubState();
  const { card } = session;
  const { index, prompt, status } = card;
  const level = getTheoryLevel(session.level);
  const named = session.by === 'name';

  // Moving focus off the Start button means Enter or Space cannot trigger a control by accident.
  useEffect(() => region.current?.focus({ preventScroll: true }), []);
  // Answered by name, the letters and digits choose names: the computer keyboard plays nothing.
  useEffect(() => (named ? keyboard.suspend() : undefined), [keyboard, named]);

  const onPainted = useCallback(
    (time: number) => controller.painted(index, time),
    [controller, index],
  );

  const drawing = useMemo(() => drawingOf(prompt), [prompt]);
  // One staff for intervals and chords, the grand staff for key signatures: the staff's size.
  const [boxWidth, boxHeight] = theoryBox(drawing.kind);
  const aspect = boxWidth / boxHeight;
  const names = useMemo(
    () =>
      session.hint ? hintNames(prompt, format.signatureLetters, t('theory.signature.none')) : null,
    [session.hint, prompt, format, t],
  );

  const answer = session.answers.at(-1);
  const scored = answer && status !== 'waiting' ? answer : null;
  const right = rightName(session);
  const wrongKeys = Array.isArray(card.wrong) ? card.wrong : null;

  const marked = useMemo(() => {
    if (status === 'waiting') return NONE;
    if (prompt.family === 'keySignature') {
      const near = wrongKeys?.[0];
      return status === 'wrong' && near !== undefined
        ? new Set([nearestTonic(prompt.fifths, prompt.mode, near)])
        : NONE;
    }
    return new Set(rightKeys(prompt));
  }, [status, prompt, wrongKeys]);
  const wrong = useMemo(() => {
    if (status !== 'wrong' || !wrongKeys) return NONE;
    const written = new Set(prompt.family === 'keySignature' ? [] : writtenKeys(prompt.notes));
    return new Set(wrongKeys.filter((midi) => !written.has(midi)));
  }, [status, wrongKeys, prompt]);

  const task =
    prompt.family === 'keySignature'
      ? t('theory.task.keySignature')
      : prompt.family === 'readChord'
        ? t(named ? 'theory.task.readChord.name' : 'theory.task.readChord.play')
        : t(
            level.family === 'readInterval' && level.numberOnly
              ? 'theory.task.readInterval.number'
              : 'theory.task.readInterval',
          );

  const staffLabel = t(`theory.staff.${prompt.family}`);
  const writtenNotes =
    prompt.family === 'keySignature' ? '' : prompt.notes.map(spelledName).join(' ');

  return (
    <section
      className={`read-session theory-session${named ? ' is-named' : ''}${drawing.kind === 'notes' ? ' is-one-staff' : ''}`}
      ref={region}
      tabIndex={-1}
      aria-label={t(`read.what.${session.family}`)}
      style={{ '--staff-aspect': aspect } as CSSProperties}
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
          <span>{t('read.hint')}</span>
        </label>
        <span id={hintId} className="visually-hidden">
          {t(
            session.family === 'keySignature'
              ? 'theory.hint.help.keySignature'
              : 'theory.hint.help',
          )}
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

      {/* The card and what it says; the answer buttons beside it on a wide screen. */}
      <div className="theory-stage">
        <div className="theory-main">
          <div className={`read-card theory-card is-${status}`}>
            {prompt.family === 'keySignature' && (
              <p className="theory-mode">{t(`theory.mode.${prompt.mode}`)}</p>
            )}
            <TheoryStaff
              drawing={drawing}
              label={staffLabel}
              state={STAFF_STATE[status]}
              onPainted={onPainted}
              names={names}
            />
            {names && (
              <p className="visually-hidden">
                {t('theory.hint.label', { names: names.join(', ') })}
              </p>
            )}
          </div>

          <div className={`read-feedback theory-feedback is-${status}`} role="status">
            {status === 'waiting' && <p className="read-prompt">{task}</p>}
            {status === 'correct' && (
              <p className="read-result">
                <ResultIcon ok />
                {scored?.correct
                  ? t('read.correct.time', { time: read.seconds(scored.ms) })
                  : t('read.correct.after')}
              </p>
            )}
            {status === 'wrong' && card.wrong !== null && (
              <>
                <p className="read-result">
                  <ResultIcon ok={false} />
                  {typeof card.wrong === 'string'
                    ? t('theory.chose', { name: format.name(card.wrong, session.level) })
                    : t('read.wrong', {
                        played: playedNames(card.wrong, storedPrompt(prompt)),
                      })}
                </p>
                <p className="read-target">
                  {prompt.family === 'keySignature'
                    ? t('theory.wrong.key', {
                        key: format.key(prompt.fifths, prompt.mode),
                        tonic: rootName(tonicPitch(signatureTonic(prompt.fifths, prompt.mode), 4)),
                      })
                    : named && right
                      ? t('theory.wrong.name', {
                          name:
                            prompt.family === 'readChord'
                              ? format.chordName(right, session.level)
                              : format.interval(right),
                        })
                      : t('theory.wrong.chord', { notes: writtenNotes })}
                </p>
              </>
            )}
          </div>
        </div>

        {named && level.family === 'readInterval' && (
          <IntervalNames
            key={`${index}:${String(card.wrong)}`}
            numberOnly={level.numberOnly}
            active={status !== 'correct'}
            right={status === 'waiting' ? null : right}
            chosen={typeof card.wrong === 'string' && status === 'wrong' ? card.wrong : null}
            onChoose={controller.choose}
          />
        )}
        {named && level.family === 'readChord' && (
          <ChordNames
            key={`${index}:${String(card.wrong)}`}
            level={level}
            active={status !== 'correct'}
            right={status === 'waiting' ? null : right}
            chosen={typeof card.wrong === 'string' && status === 'wrong' ? card.wrong : null}
            onChoose={controller.choose}
          />
        )}
      </div>

      <Piano held={held} sustained={sustained} pointer={pointer} marked={marked} wrong={wrong} />
      {!named && <KeyboardLine />}
    </section>
  );
}

// --- Naming an interval ------------------------------------------------------------------------

interface NamesProps {
  /** The card waits for an answer (it is not answered right yet). */
  active: boolean;
  /** The right name once the card was answered, to mark it. */
  right: string | null;
  /** The wrong name chosen last, to mark it. */
  chosen: string | null;
  onChoose: (name: string, time: number) => void;
}

/**
 * Two rows of buttons, the quality and the number, chosen in either order: the answer is given
 * when both are (RI1: the number alone). A number the quality cannot have is not offered.
 */
function IntervalNames({
  numberOnly,
  active,
  right,
  chosen,
  onChoose,
}: NamesProps & { numberOnly: boolean }) {
  const t = useT();
  const format = useTheoryFormat();
  const [{ quality, number }, picked, setPicked] = useSelection<{
    quality: Quality | null;
    number: IntervalNumber | null;
  }>({ quality: null, number: null });
  const rightName = right ? parseIntervalName(right) : null;
  const chosenName = chosen ? parseIntervalName(chosen) : null;
  const rightNumber = right && numberOnly ? Number(right) : rightName?.number;
  const chosenNumber = chosen && numberOnly ? Number(chosen) : chosenName?.number;

  const fits = (q: Quality | null, n: IntervalNumber | null) =>
    q === null || n === null || qualitiesOf(n).includes(q);

  // Read from the ref: two keys typed within one frame see each other's choice.
  function give(name: string, time: number) {
    setPicked({ quality: null, number: null });
    onChoose(name, time);
  }

  function pickQuality(q: Quality, time: number) {
    const current = picked.current;
    if (!active || !fits(q, current.number)) return;
    if (current.number !== null) give(`${q}${current.number}`, time);
    else setPicked({ ...current, quality: current.quality === q ? null : q });
  }

  function pickNumber(n: IntervalNumber, time: number) {
    const current = picked.current;
    if (!active || !fits(current.quality, n)) return;
    if (numberOnly) give(String(n), time);
    else if (current.quality !== null) give(`${current.quality}${n}`, time);
    else setPicked({ ...current, number: current.number === n ? null : n });
  }

  useShortcuts(intervalShortcut, (shortcut, time) => {
    if (shortcut.kind === 'quality' && !numberOnly) pickQuality(shortcut.quality, time);
    if (shortcut.kind === 'number') pickNumber(shortcut.number, time);
  });

  return (
    <div className="theory-names" role="group" aria-label={t('theory.names')}>
      {!numberOnly && (
        <NameRow className="theory-qualities" label={t('theory.quality')}>
          {QUALITIES.map((q) => (
            <NameButton
              key={q}
              label={format.capitalize(t(`theory.quality.${q}`))}
              shortcut={q}
              pressed={quality === q}
              disabled={!active || !fits(q, number)}
              right={rightName?.quality === q}
              chosen={chosenName?.quality === q && rightName?.quality !== q}
              onClick={(time) => pickQuality(q, time)}
            />
          ))}
        </NameRow>
      )}
      <NameRow className="theory-numbers" label={t('theory.number')}>
        {INTERVAL_NUMBERS.map((n) => (
          <NameButton
            key={n}
            label={format.capitalize(t(`theory.number.${n}`))}
            shortcut={String(n)}
            pressed={number === n}
            disabled={!active || !fits(quality, n)}
            right={rightNumber === n}
            chosen={chosenNumber === n && rightNumber !== n}
            onClick={(time) => pickNumber(n, time)}
          />
        ))}
      </NameRow>
    </div>
  );
}

// --- Naming a chord ----------------------------------------------------------------------------

const ALTERS = [-1, 0, 1] as const;
const ALTER_SIGNS = { [-1]: '♭', 0: '♮', 1: '♯' } as const;
const ALTER_KEYS = { [-1]: '−', 0: 'N', 1: '#' } as const;
const ALTER_NAMES = { [-1]: 'flat', 0: 'natural', 1: 'sharp' } as const;

/**
 * The root by its letter and sign, and the chord (with its position in the inversion levels) by
 * the level's buttons: the answer is given once a letter and a chord are chosen, the sign natural
 * unless ♭ or ♯ was chosen first.
 */
function ChordNames({
  level,
  active,
  right,
  chosen,
  onChoose,
}: NamesProps & { level: ReadChordLevel }) {
  const t = useT();
  const format = useTheoryFormat();
  const [{ letter, alter, chord }, picked, setPicked] = useSelection<{
    letter: Letter | null;
    alter: -1 | 0 | 1;
    chord: number | null;
  }>({ letter: null, alter: 0, chord: null });
  const rightChord = right ? parseChordName(right) : null;
  const chosenChord = chosen ? parseChordName(chosen) : null;
  const same = (
    a: { quality: string; inversion: string } | null | undefined,
    b: { quality: string; inversion: string },
  ) => !!a && a.quality === b.quality && a.inversion === b.inversion;

  // Read from the ref: keys typed within one frame see each other's choice.
  function give(l: Letter, c: number, time: number) {
    const { quality, inversion } = level.chords[c]!;
    const root = { step: l, alter: picked.current.alter };
    setPicked({ letter: null, alter: 0, chord: null });
    onChoose(chordAnswerName(root, quality, inversion), time);
  }

  function pickLetter(l: Letter, time: number) {
    const current = picked.current;
    if (!active) return;
    if (current.chord !== null) give(l, current.chord, time);
    else setPicked({ ...current, letter: current.letter === l ? null : l });
  }

  function pickChord(c: number, time: number) {
    const current = picked.current;
    if (!active || c >= level.chords.length) return;
    if (current.letter !== null) give(current.letter, c, time);
    else setPicked({ ...current, chord: current.chord === c ? null : c });
  }

  function pickAlter(a: -1 | 0 | 1) {
    const current = picked.current;
    if (active) setPicked({ ...current, alter: current.alter === a && a !== 0 ? 0 : a });
  }

  useShortcuts(chordShortcut, (shortcut, time) => {
    if (shortcut.kind === 'letter') pickLetter(shortcut.letter, time);
    if (shortcut.kind === 'accidental') pickAlter(shortcut.alter);
    if (shortcut.kind === 'chord') pickChord(shortcut.index, time);
  });

  // In the inversion levels a triad's button says its position, shortened; its name says it whole.
  const label = ({ quality, inversion }: ReadChordLevel['chords'][number], short: boolean) =>
    level.withPosition && !isSeventh(quality)
      ? t('ear.chord.withInversion', {
          chord: t(`ear.chord.${quality}.short`),
          inversion: t(short ? `theory.inversion.${inversion}` : `ear.inversion.${inversion}`),
        })
      : t(`ear.chord.${quality}.short`);

  return (
    <div className="theory-names is-chord" role="group" aria-label={t('theory.names')}>
      <NameRow
        className="theory-roots"
        label={t('theory.root')}
        picked={letter ? rootName({ step: letter, alter }) : null}
      >
        {LETTERS.map((l) => (
          <NameButton
            key={l}
            label={l}
            pressed={letter === l}
            disabled={!active}
            right={rightChord?.root.step === l}
            chosen={chosenChord?.root.step === l && rightChord?.root.step !== l}
            onClick={(time) => pickLetter(l, time)}
          />
        ))}
        <span className="theory-signs">
          {ALTERS.map((a) => (
            <NameButton
              key={a}
              label={ALTER_SIGNS[a]}
              ariaLabel={t(`theory.accidental.${ALTER_NAMES[a]}`)}
              shortcut={ALTER_KEYS[a]}
              pressed={alter === a}
              disabled={!active}
              right={rightChord?.root.alter === a}
              chosen={chosenChord?.root.alter === a && rightChord?.root.alter !== a}
              onClick={() => pickAlter(a)}
            />
          ))}
        </span>
      </NameRow>
      <NameRow className="theory-chords" label={t('theory.chord')}>
        {level.chords.map((c, i) => (
          <NameButton
            key={`${c.quality}:${c.inversion}`}
            label={format.capitalize(label(c, true))}
            ariaLabel={format.capitalize(label(c, false))}
            shortcut={chordKey(i)}
            pressed={chord === i}
            disabled={!active}
            right={same(rightChord, c)}
            chosen={same(chosenChord, c) && !same(rightChord, c)}
            onClick={(time) => pickChord(i, time)}
          />
        ))}
      </NameRow>
    </div>
  );
}

// --- Shared ------------------------------------------------------------------------------------

/**
 * A choice being built (a quality before its number, a root before its chord): the state to
 * render, and a ref that is current at once, for keys that come faster than renders.
 */
function useSelection<T>(initial: T) {
  const [value, setValue] = useState(initial);
  const ref = useRef(initial);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, ref, set] as const;
}

/** Listens for the name keys while mounted; the handler is always the latest render's. */
function useShortcuts(
  read: (e: KeyboardEvent) => TheoryShortcut | null,
  handle: (shortcut: TheoryShortcut, time: number) => void,
) {
  const latest = useRef(handle);
  useLayoutEffect(() => {
    latest.current = handle;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const shortcut = read(e);
      if (!shortcut) return;
      e.preventDefault();
      latest.current(shortcut, e.timeStamp);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [read]);
}

/** A labelled row of answer buttons; `picked`, what is chosen in it so far. */
function NameRow({
  label,
  picked = null,
  className,
  children,
}: {
  label: string;
  picked?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div
      className={className ? `theory-row ${className}` : 'theory-row'}
      role="group"
      aria-labelledby={id}
    >
      <p className="theory-row-label" id={id}>
        {label}
        {picked && <span className="theory-picked"> {picked}</span>}
      </p>
      <div className="theory-buttons">{children}</div>
    </div>
  );
}

interface NameButtonProps {
  label: string;
  ariaLabel?: string;
  shortcut?: string | null;
  pressed: boolean;
  disabled: boolean;
  right: boolean;
  chosen: boolean;
  onClick: (time: number) => void;
}

function NameButton({
  label,
  ariaLabel,
  shortcut,
  pressed,
  disabled,
  right,
  chosen,
  onClick,
}: NameButtonProps) {
  return (
    <button
      type="button"
      className={`button ear-name theory-name${right ? ' is-right' : ''}${chosen ? ' is-chosen' : ''}`}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      aria-keyshortcuts={shortcut ?? undefined}
      onClick={(e) => {
        if (!disabled) onClick(e.timeStamp);
      }}
    >
      <span>{label}</span>
      {/* The mark takes the key's place, so nothing moves when the card is answered. */}
      {right || chosen ? (
        <ResultIcon ok={right} />
      ) : (
        shortcut && <kbd aria-hidden="true">{shortcut}</kbd>
      )}
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

/** Without a MIDI keyboard the octave of the computer keyboard decides the answer. */
function KeyboardLine() {
  const t = useT();
  const octave = useKeyboardOctave();
  if (!useKeyboardFallback()) return null;
  return <p className="help read-keyboard">{t('read.keyboard', { octave })}</p>;
}
