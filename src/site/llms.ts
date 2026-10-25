// `llms.txt` (https://llmstxt.org): the site as one plain file for a language model to read, which
// runs no script and so finds little in the app's own page. Written by the build beside the
// sitemap, from the same list of pages and the same words as the pages, so it cannot drift from
// them. In English, as such files are; the other languages' pages are named at the end.

import { DEFAULT_GOAL_MINUTES } from '../core/goal.ts';
import { LOCALE_NAMES, LOCALES } from '../i18n/locale.ts';
import { lessonBySlug } from '../learn/lessons.ts';
import { builtInPiece } from '../pieces/library/index.ts';
import { PRINCIPLES, QUESTIONS } from '../ui/home/questions.ts';
import { createPieceFormat } from '../ui/pieces/format.ts';
import { appPath, homePath, lessonsPath, piecesPath } from './addresses.ts';
import { CONTENTS } from './Landing.tsx';
import { pageForRoute, type SitePage } from './pages.ts';
import { translator } from './words.ts';

/** Where the source is: the one address that is not the site's. */
const SOURCE = 'https://github.com/ya-luotao/dacapo';

/** `llms.txt` for `pages`; `url` makes a path the whole address. The same pages, the same bytes. */
export function llmsText(pages: readonly SitePage[], url: (path: string) => string): string {
  const t = translator('en');
  const level = createPieceFormat(t, 'en', []).level;
  const link = (name: string, path: string) => `[${name}](${url(path)})`;
  const english = (kind: SitePage['kind']) =>
    pages.filter((page) => page.kind === kind && page.locale === 'en');

  const lines: string[] = [
    '# dacapo',
    '',
    `> A piano practice app that runs in the browser. ${t('home.lede')}`,
    '',
    `${t('home.facts')}. ${link('Open the app', '')}.`,
    '',
    '## What there is to practise',
    '',
    ...CONTENTS.map((item) => {
      const values = item.path === '/progress' ? { n: DEFAULT_GOAL_MINUTES } : item.values;
      const path = pageForRoute('en', item.path) ?? appPath('en', item.path);
      return `- ${link(t(item.title), path)}: ${t(item.text)} (${t(item.meta, values)})`;
    }),
    '',
    '## What it holds to',
    '',
    ...PRINCIPLES.map(([title, text]) => `- ${t(title)}: ${t(text)}`),
    '',
    '## Questions',
    '',
    ...QUESTIONS.map(([question, answer]) => `- ${t(question)} ${t(answer)}`),
    '',
    '## Lessons',
    '',
    ...english('lesson').map((page) => {
      const lesson = lessonBySlug(page.id ?? '');
      if (!lesson) throw new Error(`No lesson for the page ${page.path}.`);
      return `- ${link(lesson.title.en, page.path)}: ${page.description}`;
    }),
    '',
    '## Pieces, with their scores',
    '',
    ...english('piece').map((page) => {
      const piece = builtInPiece(page.id ?? '');
      if (!piece) throw new Error(`No piece for the page ${page.path}.`);
      const name = `${t(`library.${piece.id}.title`)}, ${t(`library.${piece.id}.composer`)}`;
      return `- ${link(name, page.path)}: ${level(piece.level)}, ${t(`library.${piece.id}.style`)}. ${page.description}`;
    }),
    '',
    '## In other languages',
    '',
    ...LOCALES.filter((locale) => locale !== 'en').map((locale) => {
      const lists = [
        link(t('site.lessons'), lessonsPath(locale)),
        link(t('pieces.title'), piecesPath(locale)),
      ];
      // Japanese and Korean readers are given the English lessons: not theirs to name.
      if (lessonsPath(locale) === lessonsPath('en')) lists.shift();
      return `- ${link(LOCALE_NAMES[locale], homePath(locale))}: ${lists.join(', ')}`;
    }),
    '',
    '## Optional',
    '',
    `- [Source code](${SOURCE}): MIT, with the specifications under \`docs/\``,
    '',
  ];
  return lines.join('\n');
}
