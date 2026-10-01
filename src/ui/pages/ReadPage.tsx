import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { isRhythmAnswer, isTheoryAnswer } from '../../core/answers.ts';
import { LEVEL_IDS, nextLevel, type LevelId } from '../../core/levels.ts';
import { levelProgress, suggestedLevel } from '../../core/mastery.ts';
import { nextRhythmLevel, RHYTHM_LEVEL_IDS, type RhythmLevelId } from '../../core/rhythmCells.ts';
import {
  rhythmLevelProgress,
  suggestedRhythmLevel,
  summarizeRhythmSession,
  type RhythmLevelProgress,
} from '../../core/rhythmRead.ts';
import { DEFAULT_SESSION_LENGTH, summarize, type SessionLength } from '../../core/session.ts';
import { nextSightLevel, SIGHT_LEVEL_IDS, type SightLevelId } from '../../core/sightLevels.ts';
import {
  sightLevelProgress,
  suggestedSightLevel,
  summarizeSightSession,
  type SightLevelProgress,
} from '../../core/sightRead.ts';
import {
  getTheoryLevel,
  nextTheoryLevel,
  THEORY_LEVELS,
  type TheoryFamily,
  type TheoryLevelId,
} from '../../core/theoryItems.ts';
import {
  suggestedTheoryLevel,
  summarizeTheory,
  theoryLevelProgress,
  type TheoryLevelProgress,
} from '../../core/theorySession.ts';
import { useT } from '../../i18n/index.ts';
import { useInput } from '../input/context.ts';
import { CalibrationSheet } from '../pieces/RhythmParts.tsx';
import { readLatency, type Latency } from '../pieces/rhythmPrefs.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { createReadController } from '../read/controller.ts';
import {
  READ_CHOICE_GROUPS,
  readReadPrefs,
  writeReadPrefs,
  type ReadChoice,
  type ReadPrefs,
} from '../read/prefs.ts';
import { ReadSession } from '../read/ReadSession.tsx';
import { ReadSetup } from '../read/ReadSetup.tsx';
import { ReadSummary } from '../read/ReadSummary.tsx';
import { createRhythmController } from '../read/rhythmController.ts';
import {
  readRhythmPrefs,
  tempoOf,
  withTempo,
  writeRhythmPrefs,
  type RhythmPrefs,
} from '../read/rhythmPrefs.ts';
import { RhythmSession } from '../read/RhythmSession.tsx';
import { RhythmSetup } from '../read/RhythmSetup.tsx';
import { RhythmSummary } from '../read/RhythmSummary.tsx';
import { createTheoryController } from '../read/theoryController.ts';
import { TheorySession } from '../read/TheorySession.tsx';
import { TheorySetup } from '../read/TheorySetup.tsx';
import { TheorySummary } from '../read/TheorySummary.tsx';
import { createSightController } from '../read/sightController.ts';
import {
  readSightPrefs,
  sightTempoOf,
  withSightTempo,
  writeSightPrefs,
  type SightPrefs,
} from '../read/sightPrefs.ts';
import { SightSession } from '../read/SightSession.tsx';
import { SightSetup } from '../read/SightSetup.tsx';
import { SightSummary } from '../read/SightSummary.tsx';
import { sharedClickTrack } from '../pieces/useRhythmPlayer.ts';
import { loadMusicFont } from '../staff/font.ts';
import { prefetchVerovio } from '../notation/verovio.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';

export function ReadPage() {
  const t = useT();
  const practice = usePracticeStore();
  const { attempts, answers, sessions } = usePractice();
  const { loaded } = useStorageStatus();
  const { hub } = useInput();
  const [controller] = useState(() => createReadController({ practice }));
  const [theory] = useState(() => createTheoryController({ practice }));
  const [rhythm] = useState(() => createRhythmController({ practice }));
  const [sight] = useState(() => createSightController({ practice }));
  const session = useSyncExternalStore(controller.subscribe, controller.getState);
  const theorySession = useSyncExternalStore(theory.subscribe, theory.getState);
  const rhythmSession = useSyncExternalStore(rhythm.subscribe, rhythm.getState);
  const sightSession = useSyncExternalStore(sight.subscribe, sight.getState);
  useKeepAwake(
    session?.phase === 'running' ||
      theorySession?.phase === 'running' ||
      rhythmSession?.phase === 'running' ||
      sightSession?.phase === 'running',
    KEEP_AWAKE_IDLE_MS,
  );

  const [prefs, setPrefs] = useState(readReadPrefs);
  const { choice } = prefs;

  const progress = useMemo(
    () => new Map(LEVEL_IDS.map((id) => [id, levelProgress(attempts, id)] as const)),
    [attempts],
  );
  const suggested = suggestedLevel([...progress.values()]);
  // Follows the suggestion until the user picks a level.
  const [picked, setPicked] = useState<LevelId | null>(null);
  const level = picked ?? suggested;
  const [length, setLength] = useState<SessionLength>(DEFAULT_SESSION_LENGTH);
  const [hint, setHint] = useState(false);

  const theoryProgress = useMemo(() => {
    const ofTheory = answers.filter(isTheoryAnswer);
    return new Map<TheoryLevelId, TheoryLevelProgress>(
      THEORY_LEVELS.map((l) => [l.id, theoryLevelProgress(ofTheory, l.id)] as const),
    );
  }, [answers]);
  // Each kind of card follows its suggestion until a level of it is picked.
  const [theoryPicked, setTheoryPicked] = useState<Partial<Record<TheoryFamily, TheoryLevelId>>>(
    {},
  );
  const rhythmProgress = useMemo(() => {
    const ofRhythm = answers.filter(isRhythmAnswer);
    return new Map<RhythmLevelId, RhythmLevelProgress>(
      RHYTHM_LEVEL_IDS.map((id) => [id, rhythmLevelProgress(ofRhythm, id)] as const),
    );
  }, [answers]);
  const [rhythmPicked, setRhythmPicked] = useState<RhythmLevelId | null>(null);
  const rhythmLevel = rhythmPicked ?? suggestedRhythmLevel(rhythmProgress);
  const [rhythmPrefs, setRhythmPrefs] = useState(readRhythmPrefs);
  const sightProgress = useMemo(() => {
    const ofSight = sessions.filter((s) => s.kind === 'sight');
    return new Map<SightLevelId, SightLevelProgress>(
      SIGHT_LEVEL_IDS.map((id) => [id, sightLevelProgress(ofSight, id)] as const),
    );
  }, [sessions]);
  const [sightPicked, setSightPicked] = useState<SightLevelId | null>(null);
  const sightLevel = sightPicked ?? suggestedSightLevel(sightProgress);
  const [sightPrefs, setSightPrefs] = useState(readSightPrefs);
  // The latency is read afresh when the setup shows (a session may have calibrated meanwhile).
  const [, setLatency] = useState<Latency | null>(null);
  const [calibrating, setCalibrating] = useState(false);

  const family = choice === 'notes' || choice === 'rhythm' || choice === 'sight' ? null : choice;
  const theoryLevel = family
    ? (theoryPicked[family] ?? suggestedTheoryLevel(family, theoryProgress))
    : null;

  // Fetch the notation font while the user picks a level, so the first card is not delayed.
  useEffect(loadMusicFont, []);
  // The rhythm lines and the fragments are drawn by Verovio: fetched while the setup is open.
  const timed = choice === 'rhythm' || choice === 'sight';
  useEffect(() => (timed ? prefetchVerovio() : undefined), [timed]);
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => () => theory.dispose(), [theory]);
  useEffect(() => () => rhythm.dispose(), [rhythm]);
  useEffect(() => () => sight.dispose(), [sight]);

  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') {
          controller.press(event.midi, event.time);
          theory.press(event.midi, event.time);
        } else if (event.type === 'off') {
          theory.release(event.midi, event.time);
        }
      }),
    [hub, controller, theory],
  );

  const summary = useMemo(() => (session?.phase === 'done' ? summarize(session) : null), [session]);
  const theorySummary = useMemo(
    () => (theorySession?.phase === 'done' ? summarizeTheory(theorySession) : null),
    [theorySession],
  );
  const rhythmSummary = useMemo(
    () =>
      rhythmSession?.phase === 'done' && rhythmSession.answers.length > 0
        ? summarizeRhythmSession(rhythmSession)
        : null,
    [rhythmSession],
  );
  const sightSummary = useMemo(
    () => (sightSession?.phase === 'done' ? summarizeSightSession(sightSession) : null),
    [sightSession],
  );
  // A session stopped before any run was played leaves nothing to sum up.
  useEffect(() => {
    if (rhythmSession?.phase === 'done' && rhythmSession.answers.length === 0) rhythm.close();
  }, [rhythmSession, rhythm]);
  useEffect(() => {
    if (sightSession?.phase === 'done' && !summarizeSightSession(sightSession)) sight.close();
  }, [sightSession, sight]);

  function changePrefs(patch: Partial<ReadPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeReadPrefs(next);
  }

  function start(next: LevelId) {
    setPicked(next);
    controller.start(next, length, hint);
  }

  function startTheory(next: TheoryLevelId) {
    const nextFamily = getTheoryLevel(next).family;
    setTheoryPicked((p) => ({ ...p, [nextFamily]: next }));
    theory.start({ level: next, by: prefs.chordBy, length, hint });
  }

  function changeRhythmPrefs(patch: Partial<RhythmPrefs>) {
    setRhythmPrefs((prefs) => {
      const next = { ...prefs, ...patch };
      writeRhythmPrefs(next);
      return next;
    });
  }

  function startRhythm(next: RhythmLevelId) {
    setRhythmPicked(next);
    rhythm.start({ level: next, bpm: tempoOf(rhythmPrefs, next), length: rhythmPrefs.length });
  }

  function changeSightPrefs(patch: Partial<SightPrefs>) {
    setSightPrefs((prefs) => {
      const next = { ...prefs, ...patch };
      writeSightPrefs(next);
      return next;
    });
  }

  function startSight(next: SightLevelId) {
    // From the click: the click track can sound when a run starts after the look by itself.
    sharedClickTrack();
    setSightPicked(next);
    sight.start({ level: next, length: sightPrefs.length });
  }

  function onHint(next: boolean) {
    setHint(next);
    controller.setHint(next);
  }

  function onTheoryHint(next: boolean) {
    setHint(next);
    theory.setHint(next);
  }

  if (session?.phase === 'running') {
    return (
      <section className="read">
        <h1 className="visually-hidden">{t('read.title')}</h1>
        <ReadSession session={session} controller={controller} onHint={onHint} />
      </section>
    );
  }

  if (rhythmSession?.phase === 'running') {
    return (
      <section className="read">
        <h1 className="visually-hidden">{t('read.title')}</h1>
        <RhythmSession
          key={rhythmSession.id}
          session={rhythmSession}
          controller={rhythm}
          prefs={rhythmPrefs}
          onPrefs={changeRhythmPrefs}
        />
      </section>
    );
  }

  if (sightSession?.phase === 'running') {
    return (
      <section className="read">
        <h1 className="visually-hidden">{t('read.title')}</h1>
        <SightSession
          key={sightSession.id}
          session={sightSession}
          controller={sight}
          prefs={sightPrefs}
          bpm={sightTempoOf(sightPrefs, sightSession.level)}
        />
      </section>
    );
  }

  if (theorySession?.phase === 'running') {
    return (
      <section className="read">
        <h1 className="visually-hidden">{t('read.title')}</h1>
        <TheorySession session={theorySession} controller={theory} onHint={onTheoryHint} />
      </section>
    );
  }

  return (
    <section className="read">
      <h1>{t('read.title')}</h1>
      {!loaded ? (
        // Until stored progress is in, every level would look "not practised yet".
        <p className="muted" role="status">
          {t('storage.loading')}
        </p>
      ) : summary ? (
        <ReadSummary
          summary={summary}
          progress={progress.get(summary.level)!}
          onAgain={() => start(summary.level)}
          onNextLevel={() => start(nextLevel(summary.level) ?? summary.level)}
          onChooseLevel={controller.close}
        />
      ) : rhythmSummary ? (
        <RhythmSummary
          summary={rhythmSummary}
          progress={rhythmProgress.get(rhythmSummary.level)!}
          onAgain={() => startRhythm(rhythmSummary.level)}
          onNextLevel={() =>
            startRhythm(nextRhythmLevel(rhythmSummary.level) ?? rhythmSummary.level)
          }
          onChooseLevel={rhythm.close}
        />
      ) : sightSummary ? (
        <SightSummary
          summary={sightSummary}
          progress={sightProgress.get(sightSummary.level)!}
          onAgain={() => startSight(sightSummary.level)}
          onNextLevel={() => startSight(nextSightLevel(sightSummary.level) ?? sightSummary.level)}
          onChooseLevel={sight.close}
        />
      ) : theorySummary ? (
        <TheorySummary
          summary={theorySummary}
          progress={theoryProgress.get(theorySummary.level)!}
          onAgain={() => startTheory(theorySummary.level)}
          onNextLevel={() =>
            startTheory(nextTheoryLevel(theorySummary.level) ?? theorySummary.level)
          }
          onChooseLevel={theory.close}
        />
      ) : (
        <>
          <ReadChooser choice={choice} onChoice={(next) => changePrefs({ choice: next })} />
          <p className="muted read-intro">
            {t(
              choice === 'rhythm'
                ? 'rhythm.intro'
                : choice === 'sight'
                  ? 'sight.intro'
                  : family
                    ? `theory.intro.${family}`
                    : 'read.intro',
            )}
          </p>
          {choice === 'rhythm' ? (
            <>
              <RhythmSetup
                level={rhythmLevel}
                prefs={rhythmPrefs}
                progress={rhythmProgress}
                suggested={suggestedRhythmLevel(rhythmProgress)}
                latency={readLatency()}
                onLevel={setRhythmPicked}
                onTempo={(bpm) => changeRhythmPrefs(withTempo(rhythmPrefs, rhythmLevel, bpm))}
                onPrefs={changeRhythmPrefs}
                onCalibrate={() => setCalibrating(true)}
                onStart={() => startRhythm(rhythmLevel)}
              />
              {calibrating && (
                <CalibrationSheet
                  offer={false}
                  onCalibrate={() => undefined}
                  onStart={() => {
                    setCalibrating(false);
                    startRhythm(rhythmLevel);
                  }}
                  onRunning={() => undefined}
                  onChange={setLatency}
                  onClose={() => setCalibrating(false)}
                />
              )}
            </>
          ) : choice === 'sight' ? (
            <>
              <SightSetup
                level={sightLevel}
                prefs={sightPrefs}
                progress={sightProgress}
                suggested={suggestedSightLevel(sightProgress)}
                latency={readLatency()}
                onLevel={setSightPicked}
                onTempo={(bpm) => changeSightPrefs(withSightTempo(sightPrefs, sightLevel, bpm))}
                onPrefs={changeSightPrefs}
                onCalibrate={() => setCalibrating(true)}
                onStart={() => startSight(sightLevel)}
              />
              {calibrating && (
                <CalibrationSheet
                  offer={false}
                  onCalibrate={() => undefined}
                  onStart={() => {
                    setCalibrating(false);
                    startSight(sightLevel);
                  }}
                  onRunning={() => undefined}
                  onChange={setLatency}
                  onClose={() => setCalibrating(false)}
                />
              )}
            </>
          ) : family && theoryLevel ? (
            <TheorySetup
              family={family}
              level={theoryLevel}
              length={length}
              hint={hint}
              chordBy={prefs.chordBy}
              progress={theoryProgress}
              suggested={suggestedTheoryLevel(family, theoryProgress)}
              onLevel={(id) => setTheoryPicked((p) => ({ ...p, [family]: id }))}
              onLength={setLength}
              onHint={setHint}
              onChordBy={(chordBy) => changePrefs({ chordBy })}
              onStart={() => startTheory(theoryLevel)}
            />
          ) : (
            <ReadSetup
              level={level}
              length={length}
              hint={hint}
              progress={progress}
              suggested={suggested}
              onLevel={setPicked}
              onLength={setLength}
              onHint={setHint}
              onStart={() => start(level)}
            />
          )}
        </>
      )}
    </section>
  );
}

/**
 * What to read: single notes, a kind of theory card or a rhythm line, like the tabs of a method
 * book. The choices come in groups (the cards; what is read in time), each a row of its own.
 */
function ReadChooser({
  choice,
  onChoice,
}: {
  choice: ReadChoice;
  onChoice: (choice: ReadChoice) => void;
}) {
  const t = useT();
  const id = useId();
  return (
    <fieldset className="field read-what">
      <legend>{t('read.what')}</legend>
      {READ_CHOICE_GROUPS.map((group) => (
        <div
          key={group.id}
          className="segmented read-what-group"
          role="group"
          aria-label={t(`read.what.${group.id}`)}
        >
          {group.choices.map((value) => (
            <label key={value}>
              <input
                type="radio"
                name={`${id}-what`}
                value={value}
                checked={choice === value}
                onChange={() => onChoice(value)}
              />
              <span>{t(`read.what.${value}`)}</span>
            </label>
          ))}
        </div>
      ))}
    </fieldset>
  );
}
