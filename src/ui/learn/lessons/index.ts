import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { LessonLanguage } from '../../../learn/lessons.ts';

// Each lesson's text, per language, loaded when it is opened (src/learn/lessons.ts lists them).

type Loader = () => Promise<{ default: ComponentType }>;

const LOADERS: Readonly<Record<string, Readonly<Record<LessonLanguage, Loader>>>> = {
  keyboard: {
    en: () => import('./keyboard.en.tsx'),
    'zh-CN': () => import('./keyboard.zh-CN.tsx'),
    'zh-TW': () => import('./keyboard.zh-TW.tsx'),
  },
  staff: {
    en: () => import('./staff.en.tsx'),
    'zh-CN': () => import('./staff.zh-CN.tsx'),
    'zh-TW': () => import('./staff.zh-TW.tsx'),
  },
  landmarks: {
    en: () => import('./landmarks.en.tsx'),
    'zh-CN': () => import('./landmarks.zh-CN.tsx'),
    'zh-TW': () => import('./landmarks.zh-TW.tsx'),
  },
  rhythm: {
    en: () => import('./rhythm.en.tsx'),
    'zh-CN': () => import('./rhythm.zh-CN.tsx'),
    'zh-TW': () => import('./rhythm.zh-TW.tsx'),
  },
  'sharps-and-flats': {
    en: () => import('./sharps-and-flats.en.tsx'),
    'zh-CN': () => import('./sharps-and-flats.zh-CN.tsx'),
    'zh-TW': () => import('./sharps-and-flats.zh-TW.tsx'),
  },
  'major-scale': {
    en: () => import('./major-scale.en.tsx'),
    'zh-CN': () => import('./major-scale.zh-CN.tsx'),
    'zh-TW': () => import('./major-scale.zh-TW.tsx'),
  },
  inside: {
    en: () => import('./inside.en.tsx'),
    'zh-CN': () => import('./inside.zh-CN.tsx'),
    'zh-TW': () => import('./inside.zh-TW.tsx'),
  },
  posture: {
    en: () => import('./posture.en.tsx'),
    'zh-CN': () => import('./posture.zh-CN.tsx'),
    'zh-TW': () => import('./posture.zh-TW.tsx'),
  },
  'rhythm-2': {
    en: () => import('./rhythm-2.en.tsx'),
    'zh-CN': () => import('./rhythm-2.zh-CN.tsx'),
    'zh-TW': () => import('./rhythm-2.zh-TW.tsx'),
  },
  'minor-keys': {
    en: () => import('./minor-keys.en.tsx'),
    'zh-CN': () => import('./minor-keys.zh-CN.tsx'),
    'zh-TW': () => import('./minor-keys.zh-TW.tsx'),
  },
  dynamics: {
    en: () => import('./dynamics.en.tsx'),
    'zh-CN': () => import('./dynamics.zh-CN.tsx'),
    'zh-TW': () => import('./dynamics.zh-TW.tsx'),
  },
  pedals: {
    en: () => import('./pedals.en.tsx'),
    'zh-CN': () => import('./pedals.zh-CN.tsx'),
    'zh-TW': () => import('./pedals.zh-TW.tsx'),
  },
  ornaments: {
    en: () => import('./ornaments.en.tsx'),
    'zh-CN': () => import('./ornaments.zh-CN.tsx'),
    'zh-TW': () => import('./ornaments.zh-TW.tsx'),
  },
  chords: {
    en: () => import('./chords.en.tsx'),
    'zh-CN': () => import('./chords.zh-CN.tsx'),
    'zh-TW': () => import('./chords.zh-TW.tsx'),
  },
  practising: {
    en: () => import('./practising.en.tsx'),
    'zh-CN': () => import('./practising.zh-CN.tsx'),
    'zh-TW': () => import('./practising.zh-TW.tsx'),
  },
  styles: {
    en: () => import('./styles.en.tsx'),
    'zh-CN': () => import('./styles.zh-CN.tsx'),
    'zh-TW': () => import('./styles.zh-TW.tsx'),
  },
};

/** The lessons' texts as components that load on first render. */
export const LESSON_TEXTS: Readonly<
  Record<string, Readonly<Record<LessonLanguage, LazyExoticComponent<ComponentType>>>>
> = Object.fromEntries(
  Object.entries(LOADERS).map(([slug, byLanguage]) => [
    slug,
    {
      en: lazy(byLanguage.en),
      'zh-CN': lazy(byLanguage['zh-CN']),
      'zh-TW': lazy(byLanguage['zh-TW']),
    },
  ]),
);
