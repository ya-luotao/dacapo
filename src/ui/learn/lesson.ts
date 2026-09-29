import { createContext, useCallback, useContext, useEffect, useId, useRef } from 'react';
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

/** Calls `listener` with every key pressed, from any keyboard. */
export function useNoteOn(listener: (midi: number) => void, enabled = true): void {
  const { hub } = useInput();
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    if (!enabled) return;
    return hub.onEvent((event) => {
      if (event.type === 'on') latest.current(event.midi);
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
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);
  return useCallback(
    (midi, ms = 450) => {
      // A pointer id of its own, below the ones real pointers use.
      const id = -1000 - midi;
      pointer.press(id, midi, performance.now());
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        pointer.release(id, performance.now());
      }, ms);
      timers.current.add(timer);
    },
    [pointer],
  );
}
