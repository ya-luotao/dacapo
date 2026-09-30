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
import { isEarAnswer } from '../../core/answers.ts';
import { useT } from '../../i18n/index.ts';
import { SETTLE_MS } from '../../output/output.ts';
import { createEarController, type EarSound } from '../ear/controller.ts';
import { EarSession } from '../ear/EarSession.tsx';
import { EarSetup } from '../ear/EarSetup.tsx';
import { EarSummary } from '../ear/EarSummary.tsx';
import { readEarPrefs, writeEarPrefs, type EarPrefs } from '../ear/prefs.ts';
import { useInput } from '../input/context.ts';
import { useOutputState } from '../output/context.ts';
import { usePractice, usePracticeStore, useStorageStatus } from '../practice/context.ts';
import { loadMusicFont } from '../staff/font.ts';
import { KEEP_AWAKE_IDLE_MS, useKeepAwake } from '../useKeepAwake.ts';

/**
 * Whether prompts can sound: an output is selected. Right after the app starts, "auto" may still
 * be waiting for MIDI (up to `SETTLE_MS`), so no output yet is not taken for none until then.
 */
function useSound(): 'ready' | 'none' | 'waiting' {
  const { selected, choice } = useOutputState();
  const [settled, setSettled] = useState(() => performance.now() > SETTLE_MS + 500);
  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => setSettled(true), SETTLE_MS + 500 - performance.now());
    return () => clearTimeout(timer);
  }, [settled]);
  if (selected) return 'ready';
  return choice.kind === 'none' || settled ? 'none' : 'waiting';
}

export function EarPage() {
  const t = useT();
  const practice = usePracticeStore();
  const { answers: allAnswers } = usePractice();
  const answers = useMemo(() => allAnswers.filter(isEarAnswer), [allAnswers]);
  const { loaded } = useStorageStatus();
  const { hub, output } = useInput();
  const sound = useSound();
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
  const view = useSyncExternalStore(controller.subscribe, controller.getState);
  const running = view?.session.phase === 'running';
  useKeepAwake(running, KEEP_AWAKE_IDLE_MS);

  const [prefs, setPrefs] = useState(readEarPrefs);
  const progress = useMemo(
    () =>
      new Map<EarLevelId, EarLevelProgress>(
        EAR_LEVELS.map((level) => [level.id, earLevelProgress(answers, level.id)] as const),
      ),
    [answers],
  );
  const suggested = suggestedEarLevel(prefs.family, progress);
  // Follows the suggestion until the user picks a level (one per family).
  const [picked, setPicked] = useState<Partial<Record<EarPrefs['family'], EarLevelId>>>({});
  const level = picked[prefs.family] ?? suggested;

  // Fetch the notation font while the user chooses, for the answer drawn after a wrong one.
  useEffect(loadMusicFont, []);
  useEffect(() => () => controller.dispose(), [controller]);
  // A hidden page or another route cuts the sound (output.ts): nothing plays any more.
  useEffect(() => output.onInterrupt(() => controller.interrupted()), [output, controller]);

  useEffect(
    () =>
      hub.onEvent((event) => {
        if (event.type === 'on') controller.press(event.midi, event.time);
        else if (event.type === 'off') controller.release(event.midi);
      }),
    [hub, controller],
  );

  const summary = useMemo(
    () => (view?.session.phase === 'done' ? summarizeEar(view.session) : null),
    [view],
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
      // A melody is only ever played back.
      by: family === 'echo' ? 'play' : prefs.by,
      directions: family === 'interval' ? directionsOf(prefs.direction) : [],
      chordStyle: prefs.chordStyle,
      length: family === 'echo' ? prefs.echoLength : prefs.length,
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

  return (
    <section className="read ear">
      <h1>{t('ear.title')}</h1>
      {!loaded ? (
        // Until stored progress is in, every level would look "not practised yet".
        <p className="muted" role="status">
          {t('storage.loading')}
        </p>
      ) : summary ? (
        <EarSummary
          summary={summary}
          progress={progress.get(summary.level)!}
          onAgain={() => start(summary.level)}
          onNextLevel={() => start(nextEarLevel(summary.level) ?? summary.level)}
          onChooseLevel={controller.close}
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
            onLevel={(id) => setPicked((p) => ({ ...p, [prefs.family]: id }))}
            onStart={() => {
              if (sound !== 'none') start(level);
            }}
            startDisabled={sound === 'none'}
          />
        </>
      )}
    </section>
  );
}
