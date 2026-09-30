import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { isTheoryAnswer } from '../../core/answers.ts';
import { LEVEL_IDS, nextLevel, type LevelId } from '../../core/levels.ts';
import { levelProgress, suggestedLevel } from '../../core/mastery.ts';
import { DEFAULT_SESSION_LENGTH, summarize, type SessionLength } from '../../core/session.ts';
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
import { createTheoryController } from '../read/theoryController.ts';
import { TheorySession } from '../read/TheorySession.tsx';
import { TheorySetup } from '../read/TheorySetup.tsx';
import { TheorySummary } from '../read/TheorySummary.tsx';
import { loadMusicFont } from '../staff/font.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';

export function ReadPage() {
  const t = useT();
  const practice = usePracticeStore();
  const { attempts, answers } = usePractice();
  const { loaded } = useStorageStatus();
  const { hub } = useInput();
  const [controller] = useState(() => createReadController({ practice }));
  const [theory] = useState(() => createTheoryController({ practice }));
  const session = useSyncExternalStore(controller.subscribe, controller.getState);
  const theorySession = useSyncExternalStore(theory.subscribe, theory.getState);
  useKeepAwake(
    session?.phase === 'running' || theorySession?.phase === 'running',
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
  const family = choice === 'notes' ? null : choice;
  const theoryLevel = family
    ? (theoryPicked[family] ?? suggestedTheoryLevel(family, theoryProgress))
    : null;

  // Fetch the notation font while the user picks a level, so the first card is not delayed.
  useEffect(loadMusicFont, []);
  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(() => () => theory.dispose(), [theory]);

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
          <p className="muted read-intro">{t(family ? `theory.intro.${family}` : 'read.intro')}</p>
          {family && theoryLevel ? (
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
 * What to read: single notes or a kind of theory card, like the tabs of a method book. The
 * choices come in groups (the cards; later the choices read in time), each a row of its own.
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
        <div key={group.id} className="segmented read-what-group">
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
