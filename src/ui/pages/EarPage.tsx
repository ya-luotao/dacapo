import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link } from 'wouter';
import { sessionMastery, toPractise } from '../../core/advice.ts';
import { anyMastered } from '../../core/curriculum.ts';
import {
  DIRECTIONS,
  directionsOf,
  EAR_LEVELS,
  getEarLevel,
  levelsOf,
  nextEarLevel,
  parseItem,
  PROMPT_VELOCITY,
  type Direction,
  type EarLevelId,
} from '../../core/earItems.ts';
import {
  EAR_TARGET_MS,
  earLevelProgress,
  earStats,
  summarizeEar,
  suggestedEarLevel,
  type EarLevelProgress,
} from '../../core/earSession.ts';
import { isEarAnswer, isRhythmEarAnswer } from '../../core/answers.ts';
import { openingLevel } from '../../core/levelChoice.ts';
import { practiceLevelItems } from '../../core/practiceLevels.ts';
import { isTuneId } from '../../core/tuneList.ts';
import { getTune, tuneKey } from '../../core/tunes.ts';
import { noteWeight } from '../../core/weakness.ts';
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
import {
  practiceOf,
  sessionAdvice,
  takeAdvice,
  useFamilyAfter,
  type Practise,
} from '../cardAdvice.ts';
import { createEarController, type EarSound } from '../ear/controller.ts';
import { EarSession } from '../ear/EarSession.tsx';
import { EarSetup } from '../ear/EarSetup.tsx';
import { EarSummary } from '../ear/EarSummary.tsx';
import { readEarPrefs, writeEarPrefs, type EarPrefs, type TuneKeyChoice } from '../ear/prefs.ts';
import { createRhythmEarController } from '../ear/rhythmController.ts';
import { RhythmEarSession } from '../ear/RhythmEarSession.tsx';
import { RhythmEarSummary } from '../ear/RhythmEarSummary.tsx';
import { useInput } from '../input/context.ts';
import { InputNotice } from '../input/InputNotice.tsx';
import { LessonLine } from '../learn/LessonLine.tsx';
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
  // Opened with items of the level (Progress's "Practise these"): a session of those starts.
  const [openedItems] = useState(() => parseLevelStart(search)?.items ?? null);
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
  // Each family opens on what the page was opened with, else on the level picked last until
  // that one is mastered, else on the suggestion; a level picked or started here stays while the
  // page does.
  const [picked, setPicked] = useState<Partial<Record<EarPrefs['family'], EarLevelId>>>(
    opened && opened.family !== 'rhythmEar' ? { [opened.family]: opened.level } : {},
  );
  const [rhythmPicked, setRhythmPicked] = useState<RhythmEarLevelId | null>(
    opened?.family === 'rhythmEar' ? opened.level : null,
  );
  const level =
    picked[earFamily] ??
    openingLevel(
      prefs.levels[earFamily],
      suggested,
      levelsOf(earFamily).map((l) => l.id),
      (id) => progress.get(id)!.mastered,
    );
  const rhythmLevel =
    rhythmPicked ??
    openingLevel(
      prefs.levels.rhythmEar,
      rhythmSuggested,
      RHYTHM_EAR_LEVEL_IDS,
      (id) => rhythmProgress.get(id)!.mastered,
    );
  // A level of the family shown is mastered: its lesson is not named any more (LessonLine).
  const known = anyMastered(
    prefs.family === 'rhythmEar'
      ? rhythmProgress.values()
      : levelsOf(prefs.family).map((l) => progress.get(l.id)),
  );
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

  /** A level picked (on the setup, or as the next level): kept for the next visit. */
  function keepLevel(family: EarPrefs['family'], id: string) {
    changePrefs({ levels: { ...prefs.levels, [family]: id } });
  }

  function start(id: EarLevelId, tuneKey: TuneKeyChoice = prefs.tuneKey) {
    const family = getEarLevel(id).family;
    setPicked((p) => ({ ...p, [family]: id }));
    controller.start({
      level: id,
      // A melody or a tune is only ever played back, a cadence only named.
      by:
        family === 'echo' || family === 'tune' ? 'play' : family === 'cadence' ? 'name' : prefs.by,
      directions: family === 'interval' ? directionsOf(prefs.direction) : [],
      chordStyle: prefs.chordStyle,
      length: family === 'echo' ? prefs.echoLength : prefs.length,
      tuneKey,
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

  // "Practise these" (docs/ADVICE.md), where a session draws its items by weight: intervals
  // (in the directions given) and chords. What a list of items becomes as a short session.
  function practiceItemsOf(
    id: EarLevelId,
    listed: readonly string[],
    directions: readonly Direction[],
  ): Practise | null {
    const { family } = getEarLevel(id);
    const own = practiceLevelItems(family, id);
    if (!own) return null;
    const inDirections = own.filter((item) => {
      const parsed = parseItem(item);
      return parsed?.family !== 'interval' || directions.includes(parsed.direction);
    });
    const of = earStats(answers);
    return practiceOf(listed, inDirections, (item) => noteWeight(of[item], EAR_TARGET_MS));
  }

  /** The directions the intervals among `items` are played in. */
  const directionsIn = (items: readonly string[]) =>
    DIRECTIONS.filter((d) =>
      items.some((item) => {
        const parsed = parseItem(item);
        return parsed?.family === 'interval' && parsed.direction === d;
      }),
    );

  /** A session of some of the level's items: of the level like any other, and shorter. */
  function startItems(id: EarLevelId, practise: Practise) {
    controller.start({
      level: id,
      by: prefs.by,
      // Intervals: in the directions the items have.
      directions: directionsIn(practise.items),
      chordStyle: prefs.chordStyle,
      length: practise.length,
      items: practise.items,
    });
  }

  // Opened with items: once the stored answers are in, a session of those the level has starts
  // (the page is on that level already, and intervals are filled up in the directions the items
  // have); with none of them the level's, or without a sound, the level as usual.
  useEffect(() => {
    if (!loaded || !opened || !openedItems) return;
    if (opened.family === 'rhythmEar' || sound === 'none') return;
    const practise = practiceItemsOf(opened.level, openedItems, directionsIn(openedItems));
    if (practise) startItems(opened.level, practise);
    // Once, when the records are in: what the page was opened with never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // What to work on next after a session (docs/ADVICE.md, "Cards").
  const after = useFamilyAfter();
  const advice = summary
    ? sessionAdvice({
        family: summary.family,
        level: summary.level,
        ...sessionMastery(
          answers,
          (a) => a.sessionId === summary.id,
          (of) => earLevelProgress(of, summary.level).mastered,
        ),
        isMastered: (id) => progress.get(id as EarLevelId)?.mastered === true,
        answers: summary.items,
        correct: summary.correct,
        complete: summary.items >= summary.length,
        // Ear's mastery draws no line for the time: the missed items alone.
        practise: practiceItemsOf(
          summary.level,
          toPractise(
            summary.missed.map((m) => m.item),
            [],
            null,
          ),
          view?.session.directions ?? [],
        )?.items,
        familyAfter: after,
      })
    : null;
  const rhythmAdvice = rhythmSummary
    ? sessionAdvice({
        family: 'rhythmEar',
        level: rhythmSummary.level,
        ...sessionMastery(
          rhythmAnswers,
          (a) => a.sessionId === rhythmSummary.id,
          (of) => rhythmEarLevelProgress(of, rhythmSummary.level).mastered,
        ),
        isMastered: (id) => rhythmProgress.get(id as RhythmEarLevelId)?.mastered === true,
        answers: rhythmSummary.items,
        correct: rhythmSummary.correct,
        complete: rhythmSummary.questions >= rhythmSummary.length,
        familyAfter: after,
      })
    : null;

  /** Again: a tune in the key it was just played in, its own or another one drawn anew. */
  function again(summary: { level: EarLevelId; key?: { tonic: string } }) {
    if (!isTuneId(summary.level) || !summary.key) return start(summary.level);
    const own = tuneKey(getTune(summary.level), 0).tonic === summary.key.tonic;
    start(summary.level, own ? 'own' : 'other');
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
          onNextLevel={() => {
            const next = nextRhythmEarLevel(rhythmSummary.level) ?? rhythmSummary.level;
            keepLevel('rhythmEar', next);
            startRhythm(next);
          }}
          onChooseLevel={rhythmController.close}
          advice={rhythmAdvice}
          onAdvice={(action) =>
            takeAdvice(
              action,
              (id) => {
                keepLevel('rhythmEar', id);
                startRhythm(id as RhythmEarLevelId);
              },
              () => undefined,
            )
          }
        />
      ) : summary ? (
        <EarSummary
          summary={summary}
          progress={progress.get(summary.level)!}
          onAgain={() => again(summary)}
          onNextLevel={() => {
            const next = nextEarLevel(summary.level) ?? summary.level;
            keepLevel(getEarLevel(next).family, next);
            start(next);
          }}
          onChooseLevel={controller.close}
          onAnotherKey={() => start(summary.level, 'other')}
          advice={advice}
          onAdvice={(action) =>
            takeAdvice(
              action,
              (id) => {
                keepLevel(summary.family, id);
                start(id as EarLevelId);
              },
              (items) => startItems(summary.level, items),
            )
          }
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
          <InputNotice />
          <LessonLine practice={prefs.family} known={known} />
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
            onLevel={(id) => {
              setPicked((p) => ({ ...p, [earFamily]: id }));
              keepLevel(earFamily, id);
            }}
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
              onLevel: (id) => {
                setRhythmPicked(id);
                keepLevel('rhythmEar', id);
              },
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
