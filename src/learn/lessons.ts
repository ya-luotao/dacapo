import type { Locale } from '../i18n/index.ts';

// The basics: short lessons for someone who has never read music, each with figures to play with
// and a little exercise. They are written in English and Simplified Chinese; the other languages
// read the English (docs/LEARN.md).

export type LessonLanguage = 'en' | 'zh-CN';

export interface LessonInfo {
  slug: string;
  title: Readonly<Record<LessonLanguage, string>>;
  summary: Readonly<Record<LessonLanguage, string>>;
  /** Minutes to read it and do the exercises. */
  minutes: number;
  /** False while a lesson is planned but not written: listed, not opened. */
  ready: boolean;
  /** Where to practise what it teaches. */
  practice?: string;
}

export const LESSONS: readonly LessonInfo[] = [
  {
    slug: 'keyboard',
    title: { en: 'Finding your way around the keyboard', 'zh-CN': '认识键盘' },
    summary: {
      en: 'Eighty-eight keys, one pattern: the black keys in twos and threes, the seven letters, middle C and the octaves.',
      'zh-CN':
        '88 个键，其实是同一个图案反复出现：黑键两个一组、三个一组，七个字母，中央 C 和八度。',
    },
    minutes: 10,
    ready: true,
    practice: '/play',
  },
  {
    slug: 'staff',
    title: { en: 'The staff and the clefs', 'zh-CN': '五线谱与谱号' },
    summary: {
      en: 'Five lines and four spaces, the treble and the bass clef, and the grand staff that joins them at middle C.',
      'zh-CN': '五条线、四个间，高音谱号和低音谱号，以及在中央 C 处连成一体的大谱表。',
    },
    minutes: 15,
    ready: true,
    practice: '/read',
  },
  {
    slug: 'landmarks',
    title: { en: 'Landmark notes and intervals', 'zh-CN': '地标音与音程读谱' },
    summary: {
      en: 'Read by landmarks and steps instead of counting lines from the bottom.',
      'zh-CN': '用地标音和音程来读谱，不再从最底下一条线数起。',
    },
    minutes: 12,
    ready: true,
    practice: '/read',
  },
  {
    slug: 'rhythm',
    title: { en: 'Rhythm and the beat', 'zh-CN': '节奏与拍子' },
    summary: {
      en: 'Note values, rests, time signatures, and how to count them.',
      'zh-CN': '音符时值、休止符、拍号，以及怎么数拍子。',
    },
    minutes: 15,
    ready: true,
    practice: '/metronome',
  },
  {
    slug: 'sharps-and-flats',
    title: { en: 'Sharps, flats, whole and half steps', 'zh-CN': '升降号、全音与半音' },
    summary: {
      en: 'What the black keys are called, and the smallest steps in music.',
      'zh-CN': '黑键叫什么名字，以及音乐里最小的一步。',
    },
    minutes: 12,
    ready: true,
    practice: '/read',
  },
  {
    slug: 'major-scale',
    title: { en: 'The major scale and key signatures', 'zh-CN': '大调音阶与调号' },
    summary: {
      en: 'The pattern behind every major scale, and why a piece names its sharps once, at the start.',
      'zh-CN': '所有大调音阶背后的同一个规律，以及乐曲为什么在开头一次写明升降号。',
    },
    minutes: 15,
    ready: true,
    practice: '/scales',
  },
  {
    slug: 'posture',
    title: { en: 'Posture, hand shape and fingering', 'zh-CN': '坐姿、手型与指法' },
    summary: {
      en: 'How to sit, how to hold your hands, and what the finger numbers mean.',
      'zh-CN': '怎么坐，手怎么放，以及指法数字是什么意思。',
    },
    minutes: 10,
    ready: true,
    practice: '/play',
  },
  {
    slug: 'rhythm-2',
    title: { en: 'Dots, ties, triplets and syncopation', 'zh-CN': '附点、延音线、三连音与切分音' },
    summary: {
      en: 'Dotted notes and ties, sixteenths, triplets, rhythms off the beat, and 6/8 time.',
      'zh-CN': '附点和延音线，十六分音符，三连音，落在两拍之间的节奏，以及 6/8 拍。',
    },
    minutes: 20,
    ready: true,
    practice: '/pieces',
  },
  {
    slug: 'minor-keys',
    title: { en: 'Minor scales and minor keys', 'zh-CN': '小调音阶与小调' },
    summary: {
      en: 'The relative minor, the natural, harmonic and melodic minor scales, and how to tell a minor key from its major.',
      'zh-CN':
        '关系小调，自然、和声、旋律三种小调音阶，以及怎么分辨一首曲子是大调还是它的关系小调。',
    },
    minutes: 18,
    ready: true,
    practice: '/scales',
  },
];

/**
 * Pages beside the lessons: read like one (the same page, contents and languages) but not
 * numbered, nor in the lessons' order.
 */
export const EXTRAS: readonly LessonInfo[] = [
  {
    slug: 'inside',
    title: { en: 'Inside the piano', 'zh-CN': '钢琴里面是什么样的' },
    summary: {
      en: 'What happens between your finger and the string: the hammer, the jack that lets it fly, the damper, and why only the speed of your press counts.',
      'zh-CN':
        '从手指到琴弦之间发生了什么：琴槌、让它飞出去的顶杆、制音器，以及为什么只有按键的速度才算数。',
    },
    minutes: 8,
    ready: true,
    practice: '/play',
  },
];

/** The language a lesson is read in: Simplified Chinese for zh-CN, English otherwise. */
export function lessonLanguage(locale: Locale): LessonLanguage {
  return locale === 'zh-CN' ? 'zh-CN' : 'en';
}

export function lessonBySlug(slug: string): LessonInfo | undefined {
  return LESSONS.find((lesson) => lesson.slug === slug) ?? EXTRAS.find((e) => e.slug === slug);
}

export function isExtra(slug: string): boolean {
  return EXTRAS.some((e) => e.slug === slug);
}

/** The next and the previous lesson that can be opened. */
export function neighbours(slug: string): { previous?: LessonInfo; next?: LessonInfo } {
  const ready = LESSONS.filter((lesson) => lesson.ready);
  const at = ready.findIndex((lesson) => lesson.slug === slug);
  if (at < 0) return {};
  return { previous: ready[at - 1], next: ready[at + 1] };
}
