import { useEffect, useId, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { isChordSymbolAnswer } from '../../core/answers.ts';
import {
  HARMONY_LEVEL_IDS,
  nextHarmonyLevel,
  type HarmonyLevelId,
} from '../../core/chordSymbols.ts';
import {
  harmonyLevelProgress,
  suggestedHarmonyLevel,
  summarizeHarmony,
  type HarmonyLevelProgress,
} from '../../core/harmonySession.ts';
import { DEFAULT_SESSION_LENGTH, type SessionLength } from '../../core/session.ts';
import { useT } from '../../i18n/index.ts';
import { useInput } from '../input/context.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';
import { ChordsSession } from './ChordsSession.tsx';
import { ChordsSetup } from './ChordsSetup.tsx';
import { ChordsSummary } from './ChordsSummary.tsx';
import { createHarmonyController } from './controller.ts';
import type { HarmonyPractice } from './practices.ts';

export function HarmonyPage() {
  const t = useT();
  const practice = usePracticeStore();
  const { answers } = usePractice();
  const { loaded } = useStorageStatus();
  const { hub } = useInput();
  const [controller] = useState(() => createHarmonyController({ practice }));
  const session = useSyncExternalStore(controller.subscribe, controller.getState);
  useKeepAwake(session?.phase === 'running', KEEP_AWAKE_IDLE_MS);

  const progress = useMemo(() => {
    const own = answers.filter(isChordSymbolAnswer);
    return new Map<HarmonyLevelId, HarmonyLevelProgress>(
      HARMONY_LEVEL_IDS.map((id) => [id, harmonyLevelProgress(own, id)] as const),
    );
  }, [answers]);
  const suggested = suggestedHarmonyLevel(progress, HARMONY_LEVEL_IDS);
  // Follows the suggestion until the user picks a level.
  const [picked, setPicked] = useState<HarmonyLevelId | null>(null);
  const level = picked ?? suggested;
  const [length, setLength] = useState<SessionLength>(DEFAULT_SESSION_LENGTH);
  const [hint, setHint] = useState(false);

  useEffect(() => () => controller.dispose(), [controller]);
  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') controller.press(event.midi, event.time);
        else if (event.type === 'off') controller.release(event.midi, event.time);
      }),
    [hub, controller],
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
      ) : summary ? (
        <ChordsSummary
          summary={summary}
          progress={progress.get(summary.level)!}
          onAgain={() => start(summary.level)}
          onNextLevel={() => start(nextHarmonyLevel(summary.level) ?? summary.level)}
          onChooseLevel={controller.close}
        />
      ) : (
        <PracticeSection practice="chords">
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
      {children}
    </section>
  );
}
