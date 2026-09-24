import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { LEVEL_IDS, nextLevel, type LevelId } from '../../core/levels.ts';
import { levelProgress, suggestedLevel } from '../../core/mastery.ts';
import { DEFAULT_SESSION_LENGTH, summarize, type SessionLength } from '../../core/session.ts';
import { useT } from '../../i18n/index.ts';
import { useInput } from '../input/context.ts';
import { usePractice, usePracticeStore } from '../practice/context.ts';
import { createReadController } from '../read/controller.ts';
import { ReadSession } from '../read/ReadSession.tsx';
import { ReadSetup } from '../read/ReadSetup.tsx';
import { ReadSummary } from '../read/ReadSummary.tsx';
import { loadMusicFont } from '../staff/font.ts';

export function ReadPage() {
  const t = useT();
  const practice = usePracticeStore();
  const { attempts } = usePractice();
  const { hub } = useInput();
  const [controller] = useState(() => createReadController({ practice }));
  const session = useSyncExternalStore(controller.subscribe, controller.getState);

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

  // Fetch the notation font while the user picks a level, so the first card is not delayed.
  useEffect(loadMusicFont, []);
  useEffect(() => () => controller.dispose(), [controller]);

  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') controller.press(event.midi, event.time);
      }),
    [hub, controller],
  );

  const summary = useMemo(() => (session?.phase === 'done' ? summarize(session) : null), [session]);

  function start(next: LevelId) {
    setPicked(next);
    controller.start(next, length, hint);
  }

  function onHint(next: boolean) {
    setHint(next);
    controller.setHint(next);
  }

  if (session?.phase === 'running') {
    return (
      <section className="read">
        <h1 className="visually-hidden">{t('read.title')}</h1>
        <ReadSession session={session} controller={controller} onHint={onHint} />
      </section>
    );
  }

  return (
    <section className="read">
      <h1>{t('read.title')}</h1>
      {summary ? (
        <ReadSummary
          summary={summary}
          progress={progress.get(summary.level)!}
          onAgain={() => start(summary.level)}
          onNextLevel={() => start(nextLevel(summary.level) ?? summary.level)}
          onChooseLevel={controller.close}
        />
      ) : (
        <>
          <p className="muted read-intro">{t('read.intro')}</p>
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
        </>
      )}
    </section>
  );
}
