import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { midiToPitch } from '../../core/note.ts';
import { DEMO_VELOCITY, type DemoPlan } from '../../core/playback.ts';
import { isTextEntry } from '../../input/keyboard.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { createDemoPlayer } from '../../output/demo.ts';
import { browserClock } from '../../output/scheduler.ts';
import { useInput } from '../input/context.ts';
import { useNoteNames } from '../noteNames.ts';
import { NotesStaff } from '../staff/GrandStaff.tsx';
import {
  MAX_PHRASE_MS,
  type PhraseRecorder,
  type RecordedPhrase,
  buildPhrasePlan,
  createPhraseRecorder,
  formatDuration,
  soundingKeysAt,
} from './phraseRecorder.ts';
import './playDesk.css';

const SHOW_STAFF_PREF = 'dacapo.play.showStaff';
const EMPTY_KEYS: ReadonlySet<number> = new Set();

export interface PlayDeskProps {
  /** MIDI note numbers currently held down (via hub keyboard, MIDI, or pointer). */
  held: ReadonlySet<number>;
  /** MIDI note numbers of the most recently struck note/chord. */
  lastChord: ReadonlySet<number>;
  /** Syncs currently sounding playback keys back to the piano key highlights. */
  onMarkedKeys: (keys: ReadonlySet<number>) => void;
}

function readShowStaff(): boolean {
  const stored = readPref(SHOW_STAFF_PREF);
  return stored === '1' || stored === 'true';
}

/**
 * Free Play desk toolbar and live grand staff:
 * lets players view struck/replaying notes on a grand staff and record/loop a scratch phrase.
 */
export function PlayDesk({ held, lastChord, onMarkedKeys }: PlayDeskProps) {
  const t = useT();
  const { hub, output } = useInput();
  const noteNames = useNoteNames();

  const [showStaff, setShowStaff] = useState<boolean>(readShowStaff);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [phrase, setPhrase] = useState<RecordedPhrase | null>(null);
  const [loop, setLoop] = useState(false);
  const [activePlan, setActivePlan] = useState<DemoPlan | null>(null);

  const [player] = useState(() =>
    createDemoPlayer(output.scheduler, browserClock, output.onInterrupt),
  );
  const demoState = useSyncExternalStore(player.subscribe, player.getState);
  const demoCue = useSyncExternalStore(player.subscribe, player.cue);

  const recorderRef = useRef<PhraseRecorder | null>(null);
  const unsubHubRef = useRef<(() => void) | null>(null);
  const tickerRef = useRef<number | null>(null);
  const onMarkedKeysRef = useRef(onMarkedKeys);

  useEffect(() => {
    onMarkedKeysRef.current = onMarkedKeys;
  }, [onMarkedKeys]);

  const clearRecordingHooks = useCallback(() => {
    unsubHubRef.current?.();
    unsubHubRef.current = null;
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearRecordingHooks();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    if (!recorder) return;

    const finished = recorder.finish(performance.now());
    if (finished !== null) {
      setPhrase(finished);
    }
  }, [clearRecordingHooks]);

  const startRecording = useCallback(() => {
    clearRecordingHooks();
    if (player.getState() !== 'stopped') {
      player.stop();
      setActivePlan(null);
    }
    const recorder = createPhraseRecorder();
    recorderRef.current = recorder;
    setRecordingMs(0);
    setRecording(true);

    unsubHubRef.current = hub.onEvent((event) => {
      recorder.push(event);
      if (recorder.hasStarted()) {
        setRecordingMs(recorder.elapsed(event.time));
      }
    });

    tickerRef.current = window.setInterval(() => {
      if (!recorder.hasStarted()) return;
      const ms = recorder.elapsed(performance.now());
      setRecordingMs(ms);
      if (ms >= MAX_PHRASE_MS) {
        stopRecording();
      }
    }, 200);
  }, [clearRecordingHooks, hub, player, stopRecording]);

  const toggleRecord = useCallback(() => {
    if (recorderRef.current !== null) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  const togglePlayback = useCallback(() => {
    if (recorderRef.current !== null || phrase === null) return;
    const state = player.getState();
    if (state === 'playing') {
      player.pause();
      return;
    }
    if (state === 'paused') {
      player.resume();
      return;
    }
    const plan = buildPhrasePlan(phrase, loop);
    setActivePlan(plan);
    player.play(plan, DEMO_VELOCITY);
  }, [loop, phrase, player]);

  const handleLoopChange = useCallback(
    (nextLoop: boolean) => {
      setLoop(nextLoop);
      if (phrase === null) return;
      const state = player.getState();
      if (state === 'stopped') return;

      const pos = player.position();
      const plan = buildPhrasePlan(phrase, nextLoop);
      setActivePlan(plan);
      const from = pos && pos.ms >= 0 ? (nextLoop ? pos : { round: 0, ms: pos.ms }) : undefined;
      player.play(plan, DEMO_VELOCITY, from, state === 'paused');
    },
    [phrase, player],
  );

  const handleClear = useCallback(() => {
    if (recorderRef.current !== null) return;
    player.stop();
    setActivePlan(null);
    setPhrase(null);
    onMarkedKeys(EMPTY_KEYS);
  }, [onMarkedKeys, player]);

  const toggleShowStaff = useCallback((next: boolean) => {
    setShowStaff(next);
    writePref(SHOW_STAFF_PREF, next ? '1' : null);
  }, []);

  const replayingKeys = useMemo(() => {
    if (demoState !== 'playing' || activePlan === null || demoCue < 0) return EMPTY_KEYS;
    const pos = player.position();
    return pos ? soundingKeysAt(activePlan, pos.ms) : EMPTY_KEYS;
  }, [activePlan, demoCue, demoState, player]);

  useEffect(() => {
    onMarkedKeysRef.current(replayingKeys);
  }, [replayingKeys]);

  useEffect(
    () => () => {
      clearRecordingHooks();
      recorderRef.current = null;
      player.stop();
      onMarkedKeysRef.current(EMPTY_KEYS);
    },
    [clearRecordingHooks, player],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.isComposing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTextEntry(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;

      if (e.code === 'KeyR') {
        e.preventDefault();
        toggleRecord();
        return;
      }

      if (e.code === 'Space' || e.key === ' ') {
        if (
          e.target instanceof Element &&
          e.target.closest('button, a, select, input, textarea, [role="button"]') !== null
        ) {
          return;
        }
        if (recorderRef.current === null && phrase !== null) {
          e.preventDefault();
          togglePlayback();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phrase, togglePlayback, toggleRecord]);

  const staffMidis = useMemo(() => {
    if (!showStaff) return [];
    const midis = new Set<number>();
    if (demoState === 'playing') {
      for (const m of held) midis.add(m);
      for (const m of replayingKeys) midis.add(m);
    } else if (held.size > 0) {
      for (const m of held) midis.add(m);
    } else {
      for (const m of lastChord) midis.add(m);
    }
    return [...midis].sort((a, b) => a - b);
  }, [demoState, held, lastChord, replayingKeys, showStaff]);

  const staffPitches = useMemo(() => staffMidis.map((m) => midiToPitch(m)), [staffMidis]);
  const staffLabel = useMemo(() => {
    if (staffMidis.length === 0) return t('play.desk.staffEmpty');
    return t('play.desk.staffLabel', {
      notes: staffMidis.map((m) => noteNames.midiName(m)).join(' '),
    });
  }, [noteNames, staffMidis, t]);

  const isPlaying = demoState === 'playing';
  const statusText = recording
    ? t('play.desk.recording', { duration: formatDuration(recordingMs) })
    : phrase
      ? t('play.desk.ready', { duration: formatDuration(phrase.length) })
      : t('play.desk.empty');

  return (
    <section className="play-desk" aria-label={t('play.desk.phraseRegion')}>
      <div className="play-desk-bar">
        <div className="play-phrase" role="group" aria-label={t('play.desk.phraseRegion')}>
          <button
            type="button"
            className={recording ? 'button button-primary is-compact' : 'button is-compact'}
            aria-pressed={recording}
            aria-keyshortcuts="r"
            onClick={toggleRecord}
          >
            {recording ? t('play.desk.stopRecord') : t('play.desk.record')}
          </button>
          <button
            type="button"
            className="button is-compact"
            aria-pressed={isPlaying}
            aria-keyshortcuts="Space"
            disabled={recording || phrase === null}
            onClick={togglePlayback}
          >
            {isPlaying ? t('play.desk.pause') : t('play.desk.play')}
          </button>
          <label className="check play-phrase-loop">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => handleLoopChange(e.target.checked)}
            />
            <span>{t('play.desk.loop')}</span>
          </label>
          <button
            type="button"
            className="button is-compact"
            disabled={recording || phrase === null}
            onClick={handleClear}
          >
            {t('play.desk.clear')}
          </button>
          <span className="play-phrase-status" data-recording={recording || undefined}>
            {recording && <span className="play-rec-dot" aria-hidden="true" />}
            {statusText}
          </span>
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={showStaff}
            onChange={(e) => toggleShowStaff(e.target.checked)}
          />
          <span>{t('play.desk.showStaff')}</span>
        </label>
      </div>

      {showStaff && (
        <div className="play-desk-staff">
          <NotesStaff columns={[staffPitches]} label={staffLabel} className="play-staff" />
        </div>
      )}
    </section>
  );
}

export default PlayDesk;
