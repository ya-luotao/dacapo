import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { LessonLanguage } from '../../../learn/lessons.ts';

// Each lesson's text, per language, loaded when it is opened (src/learn/lessons.ts lists them).

type Loader = () => Promise<{ default: ComponentType }>;

const LOADERS: Readonly<Record<string, Readonly<Record<LessonLanguage, Loader>>>> = {
  keyboard: {
    en: () => import('./keyboard.en.tsx'),
    'zh-CN': () => import('./keyboard.zh-CN.tsx'),
  },
  staff: {
    en: () => import('./staff.en.tsx'),
    'zh-CN': () => import('./staff.zh-CN.tsx'),
  },
};

/** The lessons' texts as components that load on first render. */
export const LESSON_TEXTS: Readonly<
  Record<string, Readonly<Record<LessonLanguage, LazyExoticComponent<ComponentType>>>>
> = Object.fromEntries(
  Object.entries(LOADERS).map(([slug, byLanguage]) => [
    slug,
    { en: lazy(byLanguage.en), 'zh-CN': lazy(byLanguage['zh-CN']) },
  ]),
);
