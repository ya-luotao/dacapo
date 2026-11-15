import { exerciseKey, handsAllowed, octavesOf, tonicsFor } from '../core/scales.ts';
import {
  SCALE_TYPES,
  TECHNIQUE_TYPES,
  type ExerciseType,
  type ScaleExercise,
  type ScaleHands,
} from '../core/scaleTypes.ts';
import type { StoredPiece } from '../core/storedPiece.ts';
import { isTechnique, techniqueRules } from '../core/technique.ts';
import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
import { EXTRAS, lessonLanguage, LESSONS } from '../learn/lessons.ts';
import { TERM_GROUPS, TERMS, type TermGroup } from '../learn/terms.ts';
import { readPref, writePref } from '../lib/localPrefs.ts';
import { BUILT_IN } from '../pieces/library/index.ts';
import { scaleStartPath } from './startParams.ts';

export type JumpGroup = 'recent' | 'pages' | 'practices' | 'pieces' | 'lessons' | 'terms';

export const JUMP_GROUPS: readonly JumpGroup[] = [
  'recent',
  'pages',
  'practices',
  'pieces',
  'lessons',
  'terms',
];

export const JUMP_RECENT_KEY = 'dacapo.jumpRecent';
export const MAX_RECENT_JUMPS = 5;

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

/** Default valid scale/technique configuration used for Quick Jump deep-links. */
function defaultScaleExercise(type: ExerciseType): ScaleExercise {
  const forms = isTechnique(type) ? techniqueRules(type).variants : [];
  const variant = forms.length > 0 ? forms[0] : undefined;
  const tonics = tonicsFor(type, variant);
  const tonic = tonics.includes('C') ? 'C' : tonics[0]!;
  const lengths = octavesOf(type);
  const octaves = lengths.includes(2) ? 2 : lengths[0]!;
  const hands: ScaleHands = handsAllowed({ type, octaves }, 'right') ? 'right' : 'both';
  return variant === undefined
    ? { type, tonic, octaves, hands }
    : { type, tonic, octaves, hands, variant };
}

function buildScalePracticeEntries(
  types: readonly ExerciseType[],
  groupLabel: string,
  extraKeyword: string,
  t: Translate,
): JumpEntry[] {
  return types.map((type) => ({
    id: `scale:${type}`,
    group: 'practices',
    title: t(`scales.type.${type}`),
    subtitle: `${t('nav.scales')} · ${groupLabel}`,
    keywords: `${extraKeyword} ${type}`,
    href: scaleStartPath({ exercise: exerciseKey(defaultScaleExercise(type)), click: null }),
  }));
}

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
    ...buildScalePracticeEntries(SCALE_TYPES, t('scales.pick.group.scales'), 'scales', t),
    ...buildScalePracticeEntries(
      TECHNIQUE_TYPES,
      t('scales.pick.group.technique'),
      'scales technique',
      t,
    ),
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

/** Parses stored recent Quick Jump hrefs, discarding non-strings and deduping up to MAX_RECENT_JUMPS. */
export function parseRecentJumps(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of parsed) {
      if (typeof item !== 'string' || item.length === 0 || seen.has(item)) continue;
      seen.add(item);
      result.push(item);
      if (result.length >= MAX_RECENT_JUMPS) break;
    }
    return result;
  } catch {
    return [];
  }
}

/** Reads stored recent Quick Jump hrefs from local preferences. */
export function readRecentJumps(): string[] {
  return parseRecentJumps(readPref(JUMP_RECENT_KEY));
}

/** Writes recent Quick Jump hrefs (or removes the pref when empty). */
export function writeRecentJumps(hrefs: readonly string[]): void {
  writePref(
    JUMP_RECENT_KEY,
    hrefs.length > 0 ? JSON.stringify(hrefs.slice(0, MAX_RECENT_JUMPS)) : null,
  );
}

/** Prepends `href` to recent Quick Jump history (deduped, capped at 5) and returns the new list. */
export function recordRecentJump(href: string): string[] {
  const next = [href, ...readRecentJumps().filter((item) => item !== href)].slice(
    0,
    MAX_RECENT_JUMPS,
  );
  writeRecentJumps(next);
  return next;
}

/** Clears stored recent Quick Jump history. */
export function clearRecentJumps(): void {
  writePref(JUMP_RECENT_KEY, null);
}

/** Resolves stored recent hrefs against `entries` in recency order, cloning each into `recent`. */
export function resolveRecentEntries(
  recentHrefs: readonly string[],
  entries: readonly JumpEntry[],
): JumpEntry[] {
  const byHref = new Map<string, JumpEntry>();
  for (const entry of entries) {
    if (!byHref.has(entry.href)) byHref.set(entry.href, entry);
  }
  const resolved: JumpEntry[] = [];
  const seen = new Set<string>();
  for (const href of recentHrefs) {
    if (seen.has(href)) continue;
    const match = byHref.get(href);
    if (!match) continue;
    seen.add(href);
    resolved.push({
      ...match,
      id: `recent:${match.id}`,
      group: 'recent',
    });
    if (resolved.length >= MAX_RECENT_JUMPS) break;
  }
  return resolved;
}
