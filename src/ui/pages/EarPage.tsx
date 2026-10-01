import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'wouter';
import {
  directionsOf,
  EAR_LEVELS,
  getEarLevel,
  nextEarLevel,
  PROMPT_VELOCITY,
  type EarLevelId,
} from '../../core/earItems.ts';
import {
  earLevelProgress,
  summarizeEar,
  suggestedEarLevel,
  type EarLevelProgress,
} from '../../core/earSession.ts';
import { isEarAnswer, isRhythmEarAnswer } from '../../core/answers.ts';
import {
  nextRhythmEarLevel,
  rhythmEarLevelProgress,
  RHYTHM_EAR_LEVEL_IDS,
  summarizeRhythmEar,
  suggestedRhythmEarLevel,
  type RhythmEarLevelId,
  type RhythmEarLevelProgress,
} from '../../core/rhythmEar.ts';
import { useT } from '../../i18n/index.ts';
import { readPref, writePref } from '../../lib/localPrefs.ts';
import { createEarController, type EarSound } from '../ear/controller.ts';
import { EarSession } from '../ear/EarSession.tsx';
import { EarSetup } from '../ear/EarSetup.tsx';
import { EarSummary } from '../ear/EarSummary.tsx';
import { readEarPrefs, writeEarPrefs, type EarPrefs } from '../ear/prefs.ts';
import { createRhythmEarController } from '../ear/rhythmController.ts';
import { RhythmEarSession } from '../ear/RhythmEarSession.tsx';
import { RhythmEarSummary } from '../ear/RhythmEarSummary.tsx';
import { useInput } from '../input/context.ts';
import { useMetronome } from '../metronome/context.ts';
import { useOutputSound } from '../output/context.ts';
import { CalibrationSheet } from '../pieces/RhythmParts.tsx';
import { readClickVolume, readLatency } from '../pieces/rhythmPrefs.ts';
import { createRhythmPlayer } from '../pieces/useRhythmPlayer.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { readRhythmPrefs, tempoOf, withTempo, writeRhythmPrefs } from '../read/rhythmPrefs.ts';
import { tapKeysFor } from '../read/tapKeys.ts';
import { loadMusicFont } from '../staff/font.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';
import { earStart } from '../ear/start.ts';
import { useRouteSearch } from '../hashRoute.ts';
import { parseLevelStart } from '../startParams.ts';

/** Offered once per browser, before the first run with a click (shared with Pieces and Read). */
const CALIBRATION_OFFERED_PREF = 'dacapo.latency.offered';

/** The Ear page; opened with a level (a task of an assignment), it starts over on it. */
export function EarPage() {
  const search = useRouteSearch();
  return <Ear key={search} search={search} />;
}

function Ear({ search }: { search: string }) {
  const t = useT();
  const practice = usePracticeStore();
  const { answers: allAnswers } = usePractice();
  const answers = useMemo(() => allAnswers.filter(isEarAnswer), [allAnswers]);
  const rhythmAnswers = useMemo(() => allAnswers.filter(isRhythmEarAnswer), [allAnswers]);
  const { loaded } = useStorageStatus();
  const { hub, output, keyboard, monitor } = useInput();
  const metronome = useMetronome();
  const sound = useOutputSound();
  const [controller] = useState(() => {
    // A new prompt ends ours still sounding (`cut`), without resetting the instrument: the
    // player may still be holding keys or the pedal. Only stopping silences everything.
    let sounding: number[] = [];
    const earSound: EarSound = {
      play(notes, start) {
        for (const id of sounding) output.scheduler.cut(id);
        sounding = output.scheduler.playAll(
          notes.map((n) => ({
            midi: n.midi,
            velocity: PROMPT_VELOCITY,
            on: start + n.on,
            off: start + n.off,
          })),
        );
      },
      silence() {
        sounding = [];
        output.scheduler.panic();
      },
    };
    return createEarController({ practice, sound: earSound });
  });
  // Rhythm dictation: rhythm mode's player (the click, the bar on the output, the taps timed),
  // the header's metronome paused while it plays.
  const [rhythmController] = useState(() =>
    createRhythmEarController({
      practice,
      player: createRhythmPlayer(output.scheduler, output.onInterrupt, () =>
        metronome.block('dictation'),
      ),
      latency: () => readLatency()?.offset ?? 0,
      clickVolume: readClickVolume,
    }),
  );
  const view = useSyncExternalStore(controller.subscribe, controller.getState);
  const rhythmView = useSyncExternalStore(rhythmController.subscribe, rhythmController.getState);
  const running = view?.session.phase === 'running';
  const rhythmRunning = rhythmView?.session.phase === 'running';
  useKeepAwake(running || rhythmRunning, KEEP_AWAKE_IDLE_MS);

  // What the page was opened on, in place of what it remembers and what it would suggest.
  const [opened] = useState(() => earStart(parseLevelStart(search)));
  const [prefs, setPrefs] = useState(() => {
    const stored = readEarPrefs();
    return opened ? { ...stored, family: opened.family } : stored;
  });
  const [rhythmPrefs, setRhythmPrefs] = useState(readRhythmPrefs);
  const progress = useMemo(
    () =>
      new Map<EarLevelId, EarLevelProgress>(
        EAR_LEVELS.map((level) => [level.id, earLevelProgress(answers, level.id)] as const),
      ),
    [answers],
  );
  const rhythmProgress = useMemo(
    () =>
      new Map<RhythmEarLevelId, RhythmEarLevelProgress>(
        RHYTHM_EAR_LEVEL_IDS.map((id) => [id, rhythmEarLevelProgress(rhythmAnswers, id)] as const),
      ),
    [rhythmAnswers],
  );
  const earFamily = prefs.family === 'rhythmEar' ? 'interval' : prefs.family;
  const suggested = suggestedEarLevel(earFamily, progress);
  const rhythmSuggested = suggestedRhythmEarLevel(rhythmProgress);
  // Follows the suggestion until the user picks a level (one per family).
  const [picked, setPicked] = useState<Partial<Record<EarPrefs['family'], EarLevelId>>>(
    opened && opened.family !== 'rhythmEar' ? { [opened.family]: opened.level } : {},
  );
  const [rhythmPicked, setRhythmPicked] = useState<RhythmEarLevelId | null>(
    opened?.family === 'rhythmEar' ? opened.level : null,
  );
  const level = picked[earFamily] ?? suggested;
  const rhythmLevel = rhythmPicked ?? rhythmSuggested;
  const [calibration, setCalibration] = useState<'offer' | 'open' | null>(null);

  // Fetch the notation font while the user chooses, for the answer drawn after a wrong one.
  useEffect(loadMusicFont, []);
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => () => rhythmController.dispose(), [rhythmController]);
  // A hidden page or another route cuts the sound (output.ts): nothing plays any more.
  useEffect(
    () =>
      output.onInterrupt(() => {
        controller.interrupted();
        rhythmController.interrupted();
      }),
    [output, controller, rhythmController],
  );

  useEffect(
    () =>
      hub.onEvent((event) => {
        if (rhythmRunning) {
          // Any key taps a bar back; nothing else is answered on the keys.
          if (event.type === 'on') rhythmController.tap(event.time);
          return;
        }
        if (event.type === 'on') controller.press(event.midi, event.time);
        else if (event.type === 'off') controller.release(event.midi);
      }),
    [hub, controller, rhythmController, rhythmRunning],
  );

  // While rhythm is practised, the computer keyboard plays no notes: its letters tap a bar back
  // (the space bar hears again), and in Choose it the number keys choose.
  const tapping = rhythmRunning && rhythmView?.session.by === 'play';
  useEffect(() => {
    if (!rhythmRunning) return;
    const resume = keyboard.suspend();
    const remove = tapping ? hub.add(tapKeysFor(monitor, false)) : null;
    return () => {
      remove?.();
      resume();
    };
  }, [rhythmRunning, tapping, keyboard, hub, monitor]);

  const summary = useMemo(
    () => (view?.session.phase === 'done' ? summarizeEar(view.session) : null),
    [view],
  );
  const rhythmSummary = useMemo(
    () => (rhythmView?.session.phase === 'done' ? summarizeRhythmEar(rhythmView.session) : null),
    [rhythmView],
  );

  function changePrefs(patch: Partial<EarPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeEarPrefs(next);
  }

  function start(id: EarLevelId) {
    const family = getEarLevel(id).family;
    setPicked((p) => ({ ...p, [family]: id }));
    controller.start({
      level: id,
      // A melody is only ever played back, a cadence only named.
      by: family === 'echo' ? 'play' : family === 'cadence' ? 'name' : prefs.by,
      directions: family === 'interval' ? directionsOf(prefs.direction) : [],
      chordStyle: prefs.chordStyle,
      length: family === 'echo' ? prefs.echoLength : prefs.length,
    });
  }

  function startRhythm(id: RhythmEarLevelId, offer = true) {
    setRhythmPicked(id);
    setCalibration(null);
    // Tapping back is timed: the latency is offered once, before the first run with a click.
    if (
      offer &&
      prefs.rhythmBy === 'play' &&
      !readLatency() &&
      readPref(CALIBRATION_OFFERED_PREF) !== '1'
    ) {
      writePref(CALIBRATION_OFFERED_PREF, '1');
      setCalibration('offer');
      return;
    }
    rhythmController.start({
      level: id,
      by: prefs.rhythmBy,
      bpm: tempoOf(rhythmPrefs, id),
      length: prefs.rhythmLength,
    });
  }

  if (view && running) {
    return (
      <section className="read ear">
        <h1 className="visually-hidden">{t('ear.title')}</h1>
        <EarSession view={view} controller={controller} />
      </section>
    );
  }
  if (rhythmView && rhythmRunning) {
    return (
      <section className="read ear">
        <h1 className="visually-hidden">{t('ear.title')}</h1>
        <RhythmEarSession view={rhythmView} controller={rhythmController} />
      </section>
    );
  }

  return (
    <section className="read ear">
      <h1>{t('ear.title')}</h1>
      {!loaded ? (
        // Until stored progress is in, every level would look "not practised yet".
        <p className="muted" role="status">
          {t('storage.loading')}
        </p>
      ) : rhythmSummary ? (
        <RhythmEarSummary
          summary={rhythmSummary}
          progress={rhythmProgress.get(rhythmSummary.level)!}
          onAgain={() => startRhythm(rhythmSummary.level)}
          onNextLevel={() =>
            startRhythm(nextRhythmEarLevel(rhythmSummary.level) ?? rhythmSummary.level)
          }
          onChooseLevel={rhythmController.close}
        />
      ) : summary ? (
        <EarSummary
          summary={summary}
          progress={progress.get(summary.level)!}
          onAgain={() => start(summary.level)}
          onNextLevel={() => start(nextEarLevel(summary.level) ?? summary.level)}
          onChooseLevel={controller.close}
        />
      ) : calibration ? (
        <CalibrationSheet
          offer={calibration === 'offer'}
          onCalibrate={() => setCalibration('open')}
          onStart={() => startRhythm(rhythmLevel, false)}
          onRunning={() => undefined}
          onChange={() => undefined}
          onClose={() => setCalibration(null)}
        />
      ) : (
        <>
          <p className="muted read-intro">{t('ear.intro')}</p>
          {sound === 'none' && (
            <p className="ear-sound" role="status">
              <span>{t('ear.sound.needed')}</span>{' '}
              <Link href="/settings">{t('ear.sound.link')}</Link>
            </p>
          )}
          <EarSetup
            prefs={prefs}
            level={level}
            progress={progress}
            suggested={suggested}
            onPrefs={changePrefs}
            onLevel={(id) => setPicked((p) => ({ ...p, [earFamily]: id }))}
            onStart={() => {
              if (sound === 'none') return;
              if (prefs.family === 'rhythmEar') startRhythm(rhythmLevel);
              else start(level);
            }}
            startDisabled={sound === 'none'}
            rhythm={{
              level: rhythmLevel,
              progress: rhythmProgress,
              suggested: rhythmSuggested,
              onLevel: setRhythmPicked,
              bpm: tempoOf(rhythmPrefs, rhythmLevel),
              onTempo: (bpm) => {
                const next = withTempo(readRhythmPrefs(), rhythmLevel, bpm);
                setRhythmPrefs(next);
                writeRhythmPrefs(next);
              },
            }}
          />
        </>
      )}
    </section>
  );
}
