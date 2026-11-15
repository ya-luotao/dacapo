import type { StoredPiece } from '../core/storedPiece.ts';
import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
import { EXTRAS, lessonLanguage, LESSONS } from '../learn/lessons.ts';
import { TERM_GROUPS, TERMS, type TermGroup } from '../learn/terms.ts';
import { BUILT_IN } from '../pieces/library/index.ts';

export type JumpGroup = 'pages' | 'practices' | 'pieces' | 'lessons' | 'terms';

export const JUMP_GROUPS: readonly JumpGroup[] = [
  'pages',
  'practices',
  'pieces',
  'lessons',
  'terms',
];

export interface JumpEntry {
  id: string;
  group: JumpGroup;
  title: string;
  subtitle?: string;
  keywords?: string;
  href: string;
}

const READ_FAMILIES = [
  'notes',
  'readInterval',
  'keySignature',
  'readChord',
  'rhythm',
  'sight',
] as const;

const EAR_FAMILIES = ['interval', 'chord', 'echo', 'cadence', 'tune', 'rhythmEar'] as const;

const HARMONY_PRACTICES = ['chords', 'progressions', 'improvise'] as const;

const PAGE_DEFS: readonly { href: string; label: MessageKey; keywords?: string }[] = [
  { href: '/', label: 'nav.today', keywords: 'today home' },
  { href: '/pieces', label: 'nav.pieces' },
  { href: '/scales', label: 'nav.scales' },
  { href: '/read', label: 'nav.read' },
  { href: '/ear', label: 'nav.ear' },
  { href: '/harmony', label: 'nav.harmony' },
  { href: '/learn', label: 'nav.learn' },
  { href: '/learn/terms', label: 'terms.title', keywords: 'glossary terms dictionary' },
  { href: '/play', label: 'nav.play' },
  { href: '/metronome', label: 'nav.metronome' },
  { href: '/progress', label: 'nav.progress' },
  { href: '/assignments', label: 'nav.assignments' },
  { href: '/settings', label: 'nav.settings' },
];

/** Builds all searchable Quick Jump entries in the active locale. */
export function buildJumpEntries({
  t,
  locale,
  customPieces,
}: {
  t: Translate;
  locale: Locale;
  customPieces: readonly StoredPiece[];
}): JumpEntry[] {
  const lang = lessonLanguage(locale);
  const groupTitles = Object.fromEntries(TERM_GROUPS.map((g) => [g.id, g.title[lang]])) as Record<
    TermGroup,
    string
  >;

  const pages: JumpEntry[] = PAGE_DEFS.map((page) => ({
    id: `page:${page.href}`,
    group: 'pages',
    title: t(page.label),
    subtitle: page.href === '/learn/terms' ? t('nav.learn') : undefined,
    keywords: page.keywords,
    href: page.href,
  }));

  const practices: JumpEntry[] = [
    ...READ_FAMILIES.map((family) => ({
      id: `read:${family}`,
      group: 'practices' as const,
      title: t(`read.what.${family}`),
      subtitle: t('nav.read'),
      keywords: `read ${family}`,
      href: `/read?family=${family}`,
    })),
    ...EAR_FAMILIES.map((family) => ({
      id: `ear:${family}`,
      group: 'practices' as const,
      title: t(`ear.family.${family}`),
      subtitle: t('nav.ear'),
      keywords: `ear ${family}`,
      href: `/ear?family=${family}`,
    })),
    ...HARMONY_PRACTICES.map((practice) => ({
      id: `harmony:${practice}`,
      group: 'practices' as const,
      title: t(`harmony.practice.${practice}`),
      subtitle: t('nav.harmony'),
      keywords: `harmony ${practice}`,
      href: `/harmony?practice=${practice}`,
    })),
  ];

  const pieces: JumpEntry[] = [
    ...BUILT_IN.map((piece) => ({
      id: `piece:${piece.id}`,
      group: 'pieces' as const,
      title: t(`library.${piece.id}.title`),
      subtitle: `${t(`library.${piece.id}.composer`)} · ${t(`library.${piece.id}.style`)}`,
      keywords: `${piece.id} ${piece.work} ${piece.composer}`,
      href: `/pieces/${piece.id}`,
    })),
    ...customPieces.map((piece) => ({
      id: `custom-piece:${piece.id}`,
      group: 'pieces' as const,
      title: piece.title,
      subtitle: piece.composer || undefined,
      keywords: piece.fileName,
      href: `/pieces/${encodeURIComponent(piece.id)}`,
    })),
  ];

  const lessons: JumpEntry[] = [...LESSONS, ...EXTRAS]
    .filter((lesson) => lesson.ready)
    .map((lesson) => ({
      id: `lesson:${lesson.slug}`,
      group: 'lessons' as const,
      title: lesson.title[lang],
      subtitle: lesson.summary[lang],
      keywords: lesson.slug,
      href: `/learn/${lesson.slug}`,
    }));

  const terms: JumpEntry[] = TERMS.map((term) => ({
    id: `term:${term.slug}`,
    group: 'terms' as const,
    title: term.title[lang],
    subtitle: term.summary[lang],
    keywords: [term.slug, groupTitles[term.group], ...(term.also?.[lang] ?? [])].join(' '),
    href: `/learn/terms/${term.slug}`,
  }));

  return [...pages, ...practices, ...pieces, ...lessons, ...terms];
}

/** Filters Quick Jump entries case-insensitively across title, subtitle, and keywords. */
export function filterJumpEntries(
  entries: readonly JumpEntry[],
  rawQuery: string,
): readonly JumpEntry[] {
  const tokens = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return entries;
  return entries.filter((entry) => {
    const haystack = `${entry.title} ${entry.subtitle ?? ''} ${entry.keywords ?? ''}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}
