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
  landmarks: {
    en: () => import('./landmarks.en.tsx'),
    'zh-CN': () => import('./landmarks.zh-CN.tsx'),
  },
  rhythm: {
    en: () => import('./rhythm.en.tsx'),
    'zh-CN': () => import('./rhythm.zh-CN.tsx'),
  },
  'sharps-and-flats': {
    en: () => import('./sharps-and-flats.en.tsx'),
    'zh-CN': () => import('./sharps-and-flats.zh-CN.tsx'),
  },
  'major-scale': {
    en: () => import('./major-scale.en.tsx'),
    'zh-CN': () => import('./major-scale.zh-CN.tsx'),
  },
  posture: {
    en: () => import('./posture.en.tsx'),
    'zh-CN': () => import('./posture.zh-CN.tsx'),
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
