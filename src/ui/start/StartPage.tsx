import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { midiName, PIANO_HIGHEST, PIANO_LOWEST } from '../../core/note.ts';
import { DEFAULT_START } from '../../core/startingPoint.ts';
import { SENTENCE_GAP, useI18n, useT } from '../../i18n/index.ts';
import { audioContext } from '../../output/audio.ts';
import { isBuiltin } from '../../output/output.ts';
import { useHubState, useInput } from '../input/context.ts';
import { useTouchOnly } from '../input/touchOnly.ts';
import { useKeyboardFallback } from '../input/useKeyboardFallback.ts';
import { useOutputState, useSampleStatus } from '../output/context.ts';
import { Piano } from '../piano/Piano.tsx';
import { DeviceHelp, DeviceStatus } from '../play/DeviceStatus.tsx';
import { Keycaps } from '../play/KeyboardHint.tsx';
import { writeReturning } from '../today/prefs.ts';
import { useBeginPath } from './begin.ts';
import { readStartPref, writeStartPref } from './prefs.ts';
import { StartingPointFields } from './StartingPointFields.tsx';

function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 16 10" aria-hidden="true" focusable="false">
      <path d="M1 5h13M10 1l4 4-4 4" />
    </svg>
  );
}

/**
 * The start page (docs/START.md), between the first click and the first practice: where you
 * start from, and whether your keys arrive. Two parts on one screen and a button; nothing here
 * must be answered, and every other page works the same for someone who never came.
 */
export function StartPage() {
  const t = useT();
  const [, navigate] = useLocation();
  // The answer kept on this device, for someone who comes again; a newcomer's until one is given.
  const [start, setStart] = useState(() => readStartPref() ?? DEFAULT_START);
  // A newcomer who comes again begins at the next lesson: worked out when Begin is pressed, from
  // the lessons ticked in the practice store, and the Learn page while those are not read.
  const beginPath = useBeginPath();

  function begin(event: FormEvent) {
    event.preventDefault();
    writeStartPref(start);
    // Whoever answered is no first visitor: the home page opens on Today from here on.
    writeReturning(true);
    navigate(beginPath(start));
  }

  return (
    <form className="start-page" onSubmit={begin}>
      <header className="start-head">
        <h1>{t('start.title')}</h1>
        <p className="muted read-intro">{t('start.intro')}</p>
      </header>
      <StartingPointFields value={start} onChange={setStart} />
      <Keys />
      <div className="start-end">
        <button type="submit" className="button button-primary button-large">
          {t('start.begin')}
          <Arrow />
        </button>
        <p>{t('start.change')}</p>
      </div>
    </form>
  );
}

/** The keys the small keyboard draws until one beyond them is pressed: C3 to C6. */
const KEYS: readonly [low: number, high: number] = [48, 84];

/** `range` with `midi` in it: grown to the C below or above when the key is beyond it. */
function reaching(range: readonly [number, number], midi: number): readonly [number, number] {
  const [low, high] = range;
  if (midi >= low && midi <= high) return range;
  return [
    Math.max(PIANO_LOWEST, Math.floor(Math.min(low, midi) / 12) * 12),
    Math.min(PIANO_HIGHEST, Math.ceil(Math.max(high, midi) / 12) * 12),
  ];
}

/**
 * What will you play on: the page listens while it is open and says what it finds, through the
 * app's own input (a MIDI keyboard, the computer keys, the keys on the screen), with Play's
 * status line and help. A small keyboard lights the key pressed, and grows to reach it.
 */
function Keys() {
  const { t, locale } = useI18n();
  const { hub, pointer } = useInput();
  const { held, sustained } = useHubState();
  const fallback = useKeyboardFallback();
  // Played by touch alone, a device has no computer keys to draw: the keys on the screen play.
  const touch = useTouchOnly();
  // The last key that arrived, from any keyboard: it is heard.
  const [heard, setHeard] = useState<number | null>(null);
  const [range, setRange] = useState(KEYS);
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type !== 'on') return;
        setHeard(event.midi);
        setRange((shown) => reaching(shown, event.midi));
      }),
    [hub],
  );

  return (
    <section className="start-keys" aria-labelledby="start-keys-title">
      <h2 id="start-keys-title">{t('start.play')}</h2>
      <DeviceStatus />
      <DeviceHelp />
      <Piano
        held={held}
        sustained={sustained}
        pointer={pointer}
        range={range}
        className="start-piano"
      />
      <p className={heard === null ? 'start-heard' : 'start-heard is-heard'} role="status">
        {heard === null ? (
          fallback && touch ? (
            t('start.press.touch')
          ) : (
            <>
              {t('start.press')}
              {fallback && SENTENCE_GAP[locale] + t('start.keys')}
            </>
          )
        ) : (
          <>
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M3.5 8.5l3 3 6-7" />
            </svg>
            <strong>{midiName(heard)}</strong> <span>{t('start.heard')}</span>
          </>
        )}
      </p>
      {fallback && !touch && <Keycaps held={held} />}
      <SoundCheck />
    </section>
  );
}

/**
 * One note through the output in effect: the instrument, or the built-in piano, whose sound is
 * loaded when the button is pressed if it is not in yet (nothing is fetched for this page alone).
 */
function SoundCheck() {
  const t = useT();
  const { output, samples } = useInput();
  const { selected } = useOutputState();
  const status = useSampleStatus();
  const builtin = isBuiltin(selected);
  const [asked, setAsked] = useState(false);
  /** Stops the wait for the samples that the button began. */
  const waiting = useRef<(() => void) | null>(null);
  useEffect(() => () => waiting.current?.(), []);

  function test() {
    waiting.current?.();
    waiting.current = null;
    setAsked(true);
    if (!builtin) {
      output.testNote();
      return;
    }
    // Made here, in the click, so that it may start.
    audioContext();
    if (samples.getStatus() === 'ready') {
      output.testNote();
      return;
    }
    // Asked for before the samples were loaded: the note plays once they are.
    samples.load();
    const off = samples.subscribe(() => {
      if (samples.getStatus() === 'loading') return;
      off();
      waiting.current = null;
      if (samples.getStatus() === 'ready') output.testNote();
    });
    waiting.current = off;
  }

  // Where the note sounds is said by the status line above, when it is not the keyboard itself.
  return (
    <div className="start-sound">
      <button type="button" className="button" disabled={!selected} onClick={test}>
        {t('settings.output.test')}
      </button>
      <p className="help start-sound-help">
        {asked && builtin && status === 'loading' && (
          <span role="status">{t('settings.piano.loading')} </span>
        )}
        {asked && builtin && status === 'failed' && (
          <span role="alert">{t('settings.piano.failed')} </span>
        )}
        {t('start.sound.nothing')} <Link href="/settings">{t('start.sound.link')}</Link>
      </p>
    </div>
  );
}
