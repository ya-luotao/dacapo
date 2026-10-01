import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { isChordSymbolAnswer } from '../../core/answers.ts';
import {
  HARMONY_LEVEL_IDS,
  isHarmonyLevelId,
  nextHarmonyLevel,
  type HarmonyLevelId,
} from '../../core/chordSymbols.ts';
import { anyMastered } from '../../core/curriculum.ts';
import {
  harmonyLevelProgress,
  suggestedHarmonyLevel,
  summarizeHarmony,
  type HarmonyLevelProgress,
} from '../../core/harmonySession.ts';
import { DEFAULT_SESSION_LENGTH, type SessionLength } from '../../core/session.ts';
import { PEDALS_UP, type PedalPositions } from '../../core/takes.ts';
import { useT } from '../../i18n/index.ts';
import { isBuiltin } from '../../output/output.ts';
import { browserClock } from '../../output/scheduler.ts';
import { useInput } from '../input/context.ts';
import { InputNotice } from '../input/InputNotice.tsx';
import { LessonLine } from '../learn/LessonLine.tsx';
import { useMetronome } from '../metronome/context.ts';
import { useOutputSound, useOutputState } from '../output/context.ts';
import { ACCOMPANIMENT_LEVELS, readAccompanimentLevel } from '../output/prefs.ts';
import { readLatency } from '../pieces/rhythmPrefs.ts';
import { sharedClickTrack } from '../pieces/useRhythmPlayer.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';
import { ChordsSession } from './ChordsSession.tsx';
import { ChordsSetup } from './ChordsSetup.tsx';
import { ChordsSummary } from './ChordsSummary.tsx';
import { createHarmonyController } from './controller.ts';
import { createImprovController } from './improvController.ts';
import { ImprovFeedback } from './ImprovFeedback.tsx';
import { prefsSpec, readImprovPrefs, writeImprovPrefs, type ImprovPrefs } from './improvPrefs.ts';
import { ImprovSession } from './ImprovSession.tsx';
import { ImprovSetup } from './ImprovSetup.tsx';
import { HARMONY_PRACTICES, type HarmonyPractice } from './practices.ts';
import { readHarmonyPrefs, writeHarmonyPrefs, type HarmonyPrefs } from './prefs.ts';
import { ProgressionsSetup } from './ProgressionsSetup.tsx';
import { Segmented } from '../Segmented.tsx';
import { useRouteSearch } from '../hashRoute.ts';
import { parseLevelStart } from '../startParams.ts';

/** The Harmony page; opened with a level (a task of an assignment), it starts over on it. */
export function HarmonyPage() {
  const search = useRouteSearch();
  return <Harmony key={search} search={search} />;
}

/** The chord-symbol level a start names; null when it names none. */
function startLevel(search: string): HarmonyLevelId | null {
  const start = parseLevelStart(search);
  return start?.family === 'chordSymbol' && isHarmonyLevelId(start.level) ? start.level : null;
}

function Harmony({ search }: { search: string }) {
  const t = useT();
  const practice = usePracticeStore();
  const { answers } = usePractice();
  const { loaded } = useStorageStatus();
  const { hub, output } = useInput();
  const metronome = useMetronome();
  const [controller] = useState(() => createHarmonyController({ practice }));
  const session = useSyncExternalStore(controller.subscribe, controller.getState);
  const [improv] = useState(() =>
    createImprovController({
      practice,
      scheduler: output.scheduler,
      clock: browserClock,
      onInterrupt: output.onInterrupt,
      clicks: sharedClickTrack,
      hold: () => metronome.block('improv'),
    }),
  );
  const improvView = useSyncExternalStore(improv.subscribe, improv.getState);
  const [improvPrefs, setImprovPrefs] = useState(readImprovPrefs);
  const sound = useOutputSound();
  const { selected } = useOutputState();
  /** The pedals' positions, for a take that starts with one down. */
  const pedals = useRef<PedalPositions>(PEDALS_UP);
  useKeepAwake(session?.phase === 'running' || improvView.phase === 'running', KEEP_AWAKE_IDLE_MS);

  const progress = useMemo(() => {
    const own = answers.filter(isChordSymbolAnswer);
    return new Map<HarmonyLevelId, HarmonyLevelProgress>(
      HARMONY_LEVEL_IDS.map((id) => [id, harmonyLevelProgress(own, id)] as const),
    );
  }, [answers]);
  const suggested = suggestedHarmonyLevel(progress, HARMONY_LEVEL_IDS);
  // Follows the suggestion until the user picks a level.
  // Opened on a level: that one, on Chords, in place of the suggestion and the practice shown last.
  const [opened] = useState(() => startLevel(search));
  const [picked, setPicked] = useState<HarmonyLevelId | null>(opened);
  const level = picked ?? suggested;
  const [length, setLength] = useState<SessionLength>(DEFAULT_SESSION_LENGTH);
  const [hint, setHint] = useState(false);
  const [prefs, setPrefs] = useState(() => {
    const stored = readHarmonyPrefs();
    return opened ? { ...stored, practice: 'chords' as const } : stored;
  });
  const choose = useId();

  function changePrefs(patch: Partial<HarmonyPrefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeHarmonyPrefs(next);
  }

  function changeImprovPrefs(patch: Partial<ImprovPrefs>) {
    const next = { ...improvPrefs, ...patch };
    setImprovPrefs(next);
    writeImprovPrefs(next);
  }

  /** The level the backing plays at (Settings) and the channel it goes on (a MIDI port's). */
  const improvSound = {
    level: ACCOMPANIMENT_LEVELS[readAccompanimentLevel()],
    channel: selected && !isBuiltin(selected) ? improvPrefs.channel : 0,
  };

  function startImprov() {
    improv.start({
      spec: prefsSpec(improvPrefs),
      click: improvPrefs.click,
      ...improvSound,
      latency: readLatency()?.offset ?? 0,
      pedals: pedals.current,
    });
  }

  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => () => improv.dispose(), [improv]);
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') {
          controller.press(event.midi, event.time);
          improv.press(event.midi, event.velocity, event.time);
        } else if (event.type === 'off') {
          controller.release(event.midi, event.time);
          improv.release(event.midi, event.time);
        } else if (event.type === 'pedal') {
          pedals.current = { ...pedals.current, [event.controller]: event.value };
          improv.pedal(event.controller, event.value, event.time);
        }
      }),
    [hub, controller, improv],
  );

  const summary = useMemo(
    () => (session?.phase === 'done' ? summarizeHarmony(session) : null),
    [session],
  );

  function start(next: HarmonyLevelId) {
    setPicked(next);
    controller.start({ level: next, length, hint });
  }

  function onHint(next: boolean) {
    setHint(next);
    controller.setHint(next);
  }

  if (improvView.phase === 'running') {
    return (
      <section className="read harmony">
        <h1 className="visually-hidden">{t('harmony.title')}</h1>
        <ImprovSession view={improvView} controller={improv} />
      </section>
    );
  }

  if (session?.phase === 'running') {
    return (
      <section className="read harmony">
        <h1 className="visually-hidden">{t('harmony.title')}</h1>
        <ChordsSession session={session} controller={controller} onHint={onHint} />
      </section>
    );
  }

  return (
    <section className="read harmony">
      <h1>{t('harmony.title')}</h1>
      {!loaded ? (
        // Until stored progress is in, every level would look "not practised yet".
        <p className="muted" role="status">
          {t('storage.loading')}
        </p>
      ) : improvView.phase === 'done' ? (
        <ImprovFeedback
          view={improvView}
          controller={improv}
          sound={improvSound}
          onAgain={startImprov}
          onChange={improv.close}
        />
      ) : summary ? (
        <ChordsSummary
          summary={summary}
          progress={progress.get(summary.level)!}
          onAgain={() => start(summary.level)}
          onNextLevel={() => start(nextHarmonyLevel(summary.level) ?? summary.level)}
          onChooseLevel={controller.close}
        />
      ) : (
        <>
          <Segmented
            legend={t('harmony.practices')}
            name={`${choose}-practice`}
            className="harmony-practices"
            options={HARMONY_PRACTICES.map((p) => ({
              value: p,
              label: t(`harmony.practice.${p}`),
            }))}
            value={prefs.practice}
            onChange={(practice) => changePrefs({ practice })}
          />
          {prefs.practice === 'chords' ? (
            <PracticeSection practice="chords">
              <LessonLine practice="chordSymbol" known={anyMastered(progress.values())} />
              <ChordsSetup
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
            </PracticeSection>
          ) : prefs.practice === 'progressions' ? (
            <PracticeSection practice="progressions">
              <ProgressionsSetup prefs={prefs} onPrefs={changePrefs} />
            </PracticeSection>
          ) : (
            <PracticeSection practice="improvise">
              <ImprovSetup
                prefs={improvPrefs}
                onPrefs={changeImprovPrefs}
                onStart={startImprov}
                sound={sound}
                port={selected !== null && !isBuiltin(selected)}
                view={improvView}
                controller={improv}
                playback={improvSound}
              />
            </PracticeSection>
          )}
        </>
      )}
    </section>
  );
}

/** A practice of the page under its heading, with what it asks of you. */
function PracticeSection({
  practice,
  children,
}: {
  practice: HarmonyPractice;
  children: ReactNode;
}) {
  const t = useT();
  const id = useId();
  return (
    <section className="harmony-practice" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="harmony-practice-title">
        {t(`harmony.practice.${practice}`)}
      </h2>
      <p className="muted read-intro">{t(`harmony.intro.${practice}`)}</p>
      <InputNotice />
      {children}
    </section>
  );
}
