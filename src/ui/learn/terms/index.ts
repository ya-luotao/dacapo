import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { LessonLanguage } from '../../../learn/lessons.ts';
import { TERMS, type TermGroup, type TermInfo } from '../../../learn/terms.ts';

// The glossary's texts, one module per group and language, loaded when one of its terms is opened
// (src/learn/terms.ts lists them). Each module is a record of the group's terms by slug.

export type TermTexts = Readonly<Record<string, ComponentType>>;

type Loader = () => Promise<{ default: TermTexts }>;

const LOADERS: Readonly<Record<TermGroup, Readonly<Record<LessonLanguage, Loader>>>> = {
  intervals: {
    en: () => import('./intervals.en.tsx'),
    'zh-CN': () => import('./intervals.zh-CN.tsx'),
    'zh-TW': () => import('./intervals.zh-TW.tsx'),
  },
  keys: {
    en: () => import('./keys.en.tsx'),
    'zh-CN': () => import('./keys.zh-CN.tsx'),
    'zh-TW': () => import('./keys.zh-TW.tsx'),
  },
  roadmap: {
    en: () => import('./roadmap.en.tsx'),
    'zh-CN': () => import('./roadmap.zh-CN.tsx'),
    'zh-TW': () => import('./roadmap.zh-TW.tsx'),
  },
  tempo: {
    en: () => import('./tempo.en.tsx'),
    'zh-CN': () => import('./tempo.zh-CN.tsx'),
    'zh-TW': () => import('./tempo.zh-TW.tsx'),
  },
};

const NOTHING: ComponentType = () => null;

/** A term's text in a language, as a component that loads its group on first render. */
const textOf = (term: TermInfo, language: LessonLanguage) =>
  lazy(() =>
    LOADERS[term.group][language]().then((m) => ({ default: m.default[term.slug] ?? NOTHING })),
  );

/** Every term's text, by slug and language; nothing for a term not yet written. */
export const TERM_TEXTS: Readonly<
  Record<string, Readonly<Record<LessonLanguage, LazyExoticComponent<ComponentType>>>>
> = Object.fromEntries(
  TERMS.map((term) => [
    term.slug,
    { en: textOf(term, 'en'), 'zh-CN': textOf(term, 'zh-CN'), 'zh-TW': textOf(term, 'zh-TW') },
  ]),
);
