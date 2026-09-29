import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { midiName } from '../../core/note.ts';
import type { LessonLanguage } from '../../learn/lessons.ts';
import { formatMessage } from '../../i18n/locale.ts';
import { useInput } from '../input/context.ts';
import { markDone } from './progress.ts';

// What every lesson's figures share: the lesson's language and the words they use, a way to hear
// a key played, and one exercise listening at a time (kit.tsx has the parts of the page).

const COPY = {
  en: {
    plate: 'Plate',
    start: 'Start',
    again: 'Again',
    progress: '{n} of {total}',
    found: '{n} of {total} found',
    allFound: 'All found. Well done.',
    right: 'Right: {name}.',
    notIt: 'That was {name}.',
    wrong: 'That was {played}. The answer is {answer}, marked on the keyboard.',
    done: 'Finished: {right} of {total} right the first time.',
    howToPlay:
      'Play on your MIDI keyboard, click or tap the keys, or use your computer keys: A plays C4, and Z and X change the octave.',
    listening: 'Listening: play on your keyboard.',
    ready: 'Press Start when you are ready.',
    lastPlayed: 'You played',
    playAny: 'Play any key',
    middleC: 'middle C',
    listen: 'Listen',
    line: 'Line {n}',
    space: 'Space {n}',
    next: 'Next: {name}',
    sequenceDone: 'Played through: {total} notes, with {slips} wrong keys on the way.',
    choiceRight: 'Right.',
    choiceWrong: 'Not quite: it is {answer}.',
    nextQuestion: 'Next',
    stop: 'Stop',
    tapAlong: 'Tap any key with the beat.',
    early: 'early',
    late: 'late',
    onTime: 'on time',
    offBy: '{ms} ms {side}',
    rhythmDone: '{good} of {total} in time. {tendency}',
    tendsEarly: 'You tend to be a little early.',
    tendsLate: 'You tend to be a little late.',
    tendsEven: 'Nicely even.',
    countIn: 'Count-in…',
    another: 'Another',
    halfStep: 'Half step',
    wholeStep: 'Whole step',
  },
  'zh-CN': {
    plate: '图',
    start: '开始',
    again: '再来一次',
    progress: '第 {n} 题，共 {total} 题',
    found: '已找到 {n} / {total}',
    allFound: '全部找到了，很好。',
    right: '对了：{name}。',
    notIt: '这是 {name}。',
    wrong: '你弹的是 {played}。正确答案是 {answer}，已在键盘上标出。',
    done: '完成：{total} 题中有 {right} 题一次答对。',
    howToPlay: '用 MIDI 键盘弹，点屏幕上的琴键，或者用电脑键盘：A 键是 C4，Z 和 X 切换八度。',
    listening: '正在听：请在键盘上弹。',
    ready: '准备好了就点「开始」。',
    lastPlayed: '你弹的是',
    playAny: '随便弹一个键',
    middleC: '中央 C',
    listen: '听一听',
    line: '第 {n} 线',
    space: '第 {n} 间',
    next: '下一个：{name}',
    sequenceDone: '弹完了：一共 {total} 个音，途中按错 {slips} 次。',
    choiceRight: '对了。',
    choiceWrong: '不对，答案是 {answer}。',
    nextQuestion: '下一题',
    stop: '停止',
    tapAlong: '跟着拍子，随便按一个键。',
    early: '早了',
    late: '晚了',
    onTime: '准',
    offBy: '{side} {ms} 毫秒',
    rhythmDone: '{total} 个音里有 {good} 个在拍子上。{tendency}',
    tendsEarly: '你整体稍微偏早。',
    tendsLate: '你整体稍微偏晚。',
    tendsEven: '很均匀。',
    countIn: '预备拍……',
    another: '换一个',
    halfStep: '半音',
    wholeStep: '全音',
  },
} as const satisfies Record<LessonLanguage, Record<string, string>>;

export type LessonCopyKey = keyof (typeof COPY)['en'];

export interface LessonContextValue {
  slug: string;
  language: LessonLanguage;
  /** The active exercise, or null: only it hears the keys. */
  active: string | null;
  setActive: (id: string | null) => void;
}

export const LessonContext = createContext<LessonContextValue>({
  slug: '',
  language: 'en',
  active: null,
  setActive: () => undefined,
});

export function useLessonLanguage(): LessonLanguage {
  return useContext(LessonContext).language;
}

/** The words the figures use, in the lesson's language. */
export function useCopy(): (key: LessonCopyKey, vars?: Record<string, string | number>) => string {
  const { language } = useContext(LessonContext);
  return useCallback((key, vars) => formatMessage(COPY[language][key], vars), [language]);
}

/** Marks the lesson finished: for its last exercise. */
export function useCompleteLesson(): () => void {
  const { slug } = useContext(LessonContext);
  return useCallback(() => markDone(slug), [slug]);
}

/** A key's name as printed: C4, F♯3. */
export function keyName(midi: number): string {
  return midiName(midi).replace('#', '♯');
}

/** Keys a figure is sounding by itself (a demo, Listen): not the player's, so never an answer. */
const demoKeys = new Set<number>();

/**
 * Calls `listener` with every key the player presses, from any keyboard, and when
 * (performance.now()). Keys a figure plays by itself are left out.
 */
export function useNoteOn(listener: (midi: number, time: number) => void, enabled = true): void {
  const { hub } = useInput();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    if (!enabled) return;
    return hub.onEvent((event) => {
      if (event.type === 'on' && !demoKeys.has(event.midi)) latest.current(event.midi, event.time);
    });
  }, [hub, enabled]);
}

/**
 * An exercise that listens only while it is the active one, so a key pressed for one exercise
 * never answers another on the same page. Starting one stops the others.
 */
export function useExercise(): {
  id: string;
  active: boolean;
  start: () => void;
  stop: () => void;
} {
  const id = useId();
  const { active, setActive } = useContext(LessonContext);
  const start = useCallback(() => setActive(id), [id, setActive]);
  const stop = useCallback(() => setActive(null), [setActive]);
  return { id, active: active === id, start, stop };
}

/** Plays a key for a moment, as if it were clicked: the built-in piano sounds it and it lights. */
export function usePlayKey(): (midi: number, ms?: number) => void {
  const { pointer } = useInput();
  // Each key sounding, by the timer that lets it go.
  const sounding = useRef(new Map<ReturnType<typeof setTimeout>, number>());
  useEffect(() => {
    const keys = sounding.current;
    // Leaving the page lets go of every key at once: a key never released would stay held, and
    // pressing it for real would then not count as a new note.
    return () => {
      for (const [timer, id] of keys) {
        clearTimeout(timer);
        pointer.release(id, performance.now());
        demoKeys.delete(-1000 - id);
      }
      keys.clear();
    };
  }, [pointer]);
  return useCallback(
    (midi, ms = 450) => {
      // A pointer id of its own, below the ones real pointers use.
      const id = -1000 - midi;
      // Marked before the press, which reaches the listeners at once.
      demoKeys.add(midi);
      pointer.press(id, midi, performance.now());
      const timer = setTimeout(() => {
        sounding.current.delete(timer);
        pointer.release(id, performance.now());
        demoKeys.delete(midi);
      }, ms);
      sounding.current.set(timer, id);
    },
    [pointer],
  );
}

/**
 * Starts an exercise when one of its keys is clicked, so that very click is its first answer.
 * Only a key: a button in the exercise (Listen) does not start it.
 */
export function useStartOnPress(
  exercise: ReturnType<typeof useExercise>,
  done: boolean,
): { onPointerDownCapture: (e: PointerEvent) => void; listening: () => boolean } {
  const pending = useRef(false);
  const onPointerDownCapture = (e: PointerEvent) => {
    if (exercise.active || done) return;
    if (!(e.target as Element).closest?.('[data-midi]')) return;
    pending.current = true;
    exercise.start();
  };
  useEffect(() => {
    if (exercise.active) pending.current = false;
  }, [exercise.active]);
  const listening = () => exercise.active || pending.current;
  return { onPointerDownCapture, listening };
}

/** Keys flashed for a moment, as a wrong key is. */
export function useFlash(): [ReadonlySet<number>, (midi: number) => void] {
  const [keys, setKeys] = useState<ReadonlySet<number>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const flash = (midi: number) => {
    setKeys(new Set([midi]));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setKeys(new Set()), 700);
  };
  return [keys, flash];
}

/**
 * Plays keys one after another (a chord when a step holds several), lighting them as it goes, and
 * says which step is sounding. Playing again, or leaving, stops the last run.
 */
export function usePlaySequence(): {
  play: (steps: readonly (number | readonly number[])[], gapMs?: number) => void;
  stop: () => void;
  at: number | null;
} {
  const playKey = usePlayKey();
  const [at, setAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const stop = useCallback(() => {
    clearTimeout(timer.current);
    setAt(null);
  }, []);
  const play = useCallback(
    (steps: readonly (number | readonly number[])[], gapMs = 480) => {
      clearTimeout(timer.current);
      const next = (i: number) => {
        if (i >= steps.length) {
          setAt(null);
          return;
        }
        setAt(i);
        const step = steps[i]!;
        for (const midi of typeof step === 'number' ? [step] : step) playKey(midi, gapMs - 60);
        timer.current = setTimeout(() => next(i + 1), gapMs);
      };
      next(0);
    },
    [playKey],
  );
  return { play, stop, at };
}
