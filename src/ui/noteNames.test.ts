// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOTE_NAMINGS, WORD_JOINER, type NoteNaming } from '../core/noteNames.ts';
import { en } from '../i18n/en.ts';
import { I18nProvider, useI18n } from '../i18n/index.ts';
import { ja } from '../i18n/ja.ts';
import type { LoadedLocale } from '../i18n/locale.ts';
import type { PointerInput } from '../input/index.ts';
import { LessonProvider } from './learn/kit.tsx';
import { keyName } from './learn/lesson.ts';
import { LetterNames } from './LetterNames.tsx';
import { useNoteNames } from './noteNames.ts';
import { Piano } from './piano/Piano.tsx';

// Note names (docs/PERSONAL.md): the hook follows the setting at once, a lesson keeps the
// letters, and nothing in ui/ names a note without the hook.

let root: Root | null = null;
let host: HTMLElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  // jsdom has no layout: the piano scrolls to middle C when it mounts.
  Element.prototype.scrollTo = () => undefined;
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  localStorage.clear();
});

const EN: LoadedLocale = { locale: 'en', dictionary: en };
const JA: LoadedLocale = { locale: 'ja', dictionary: ja };

function mount(initial: LoadedLocale, children: ReactNode) {
  root = createRoot(host);
  act(() => root!.render(createElement(I18nProvider, { initial, children })));
}

/** A note, a key, a written note and a dictionary's string with notes in it, as the page says them. */
function Probe({ id }: { id: string }) {
  const { t, setNoteNaming } = useI18n();
  const names = useNoteNames();
  const text = [
    names.midiName(66),
    names.formatPitch({ letter: 'B', accidental: -1, octave: 3 }),
    names.spelledName({ step: 'F', alter: 2, octave: 5 }),
    t('read.level.L2'),
    t('read.wrong.target', { target: names.midiName(60) }),
  ].join(' | ');
  return createElement(
    'div',
    null,
    createElement('p', { id }, text),
    NOTE_NAMINGS.map((naming) =>
      createElement('button', {
        key: naming,
        id: `${id}-${naming}`,
        onClick: () => setNoteNaming(naming),
      }),
    ),
  );
}

const choose = (id: string, naming: NoteNaming) =>
  act(() => host.querySelector<HTMLButtonElement>(`#${id}-${naming}`)!.click());

const POINTER: PointerInput = {
  press: () => undefined,
  release: () => undefined,
  isDown: () => false,
} as unknown as PointerInput;

const piano = () =>
  createElement(Piano, {
    held: new Map<number, number>(),
    sustained: new Set<number>(),
    pointer: POINTER,
    range: [48, 72] as const,
  });

/** The text as it is seen: without the joiners that keep a Japanese name on one line. */
const textOf = (id: string) =>
  host.querySelector(`#${id}`)?.textContent.replaceAll(WORD_JOINER, '');
const keyLabel = (el: ParentNode, midi: number) =>
  el.querySelector(`[data-midi="${midi}"]`)?.getAttribute('aria-label');

describe('useNoteNames', () => {
  it('names notes by letter until do re mi is asked for, then at once, with no reload', () => {
    mount(EN, createElement(Probe, { id: 'probe' }));
    expect(textOf('probe')).toBe(
      'F♯4 | B♭3 | F𝄪5 | Treble: C4 to C5 | The note is C4. Press the marked key.',
    );
    choose('probe', 'solfege');
    expect(textOf('probe')).toBe(
      'Fa♯4 | Si♭3 | Fa𝄪5 | Treble: Do4 to Do5 | The note is Do4. Press the marked key.',
    );
    expect(localStorage.getItem('dacapo.noteNames')).toBe('solfege');
    choose('probe', 'letters');
    expect(textOf('probe')).toContain('F♯4 | B♭3');
    expect(localStorage.getItem('dacapo.noteNames')).toBeNull();
  });

  it('reads the naming kept on the device, and writes it in the language’s script', () => {
    localStorage.setItem('dacapo.locale', 'ja');
    localStorage.setItem('dacapo.noteNames', 'solfege');
    mount(JA, createElement(Probe, { id: 'probe' }));
    expect(textOf('probe')).toContain('ファ♯4 | シ♭3 | ファ𝄪5 | ト音記号：ド4〜ド5');
  });

  it('ignores a naming it does not know', () => {
    localStorage.setItem('dacapo.noteNames', 'numbers');
    mount(EN, createElement(Probe, { id: 'probe' }));
    expect(textOf('probe')).toContain('F♯4 | B♭3');
  });

  it('names the keys of the keyboard for a screen reader, and middle C on its key', () => {
    localStorage.setItem('dacapo.noteNames', 'solfege');
    mount(EN, piano());
    expect(keyLabel(host, 62)).toBe('Re4');
    expect(keyLabel(host, 61)).toBe('Do♯4 / Re♭4');
    expect(keyLabel(host, 60)).toBe('Do4, middle Do');
    expect(host.querySelector('.piano')?.getAttribute('aria-label')).toBe(
      'Piano keyboard, Do3 to Do5',
    );
    expect(host.querySelector('[data-midi="60"] .key-mark')?.textContent).toBe('Do4');
    // The octave is a part of its own, which a narrow key leaves out with do re mi (styles.css).
    expect(host.querySelector('.key-mark-octave')?.textContent).toBe('4');
    expect(host.querySelector('.piano')?.getAttribute('data-naming')).toBe('solfege');
  });
});

describe('a lesson', () => {
  it('keeps the letters whatever the setting: its words, its figures and their keyboard', () => {
    localStorage.setItem('dacapo.noteNames', 'solfege');
    mount(
      EN,
      createElement(
        'div',
        null,
        createElement(Probe, { id: 'page' }),
        createElement(LessonProvider, {
          slug: 'keyboard',
          language: 'en',
          children: createElement(
            'div',
            { id: 'lesson' },
            createElement(Probe, { id: 'figure' }),
            piano(),
          ),
        }),
      ),
    );
    expect(textOf('page')).toContain('Fa♯4 | Si♭3');
    expect(textOf('figure')).toBe(
      'F♯4 | B♭3 | F𝄪5 | Treble: C4 to C5 | The note is C4. Press the marked key.',
    );
    const lesson = host.querySelector('#lesson')!;
    expect(keyLabel(lesson, 62)).toBe('D4');
    expect(keyLabel(lesson, 61)).toBe('C♯4 / D♭4');
    expect(keyLabel(lesson, 60)).toBe('C4, middle C');
    expect(lesson.querySelector('.piano')?.getAttribute('aria-label')).toBe(
      'Piano keyboard, C3 to C5',
    );
    expect(lesson.querySelector('[data-midi="60"] .key-mark')?.textContent).toBe('C4');
    expect(lesson.querySelector('.piano')?.getAttribute('data-naming')).toBe('letters');
    // The names its figures print are the letters' own.
    expect(keyName(66)).toBe('F♯4');
  });

  it('pins the letters for anything else that asks: LetterNames', () => {
    localStorage.setItem('dacapo.locale', 'ja');
    localStorage.setItem('dacapo.noteNames', 'solfege');
    mount(JA, createElement(LetterNames, null, createElement(Probe, { id: 'pinned' })));
    expect(textOf('pinned')).toContain('F♯4 | B♭3 | F𝄪5 | ト音記号：C4〜C5');
  });
});

// --- Nothing names a note on its own ------------------------------------------------------------

const SOURCES = import.meta.glob<string>('/src/ui/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** The code of a source without its comments (a `//` inside a string ends the line too: fine here). */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const isTest = (path: string) => /\.test\.tsx?$/.test(path);

/**
 * The files of `ui/` that may take a note's name in letters from `core/note.ts`. The lessons teach
 * the letters, and every name their figures print comes from `keyName` here.
 */
const LETTERS_FROM_CORE = ['/src/ui/learn/lesson.ts'];

/**
 * The files of `ui/` that may write a sharp or a flat themselves, each for a name that keeps its
 * letters or for a sign that is no name at all.
 */
const OWN_SIGNS: Readonly<Record<string, string>> = {
  '/src/ui/harmony/SymbolText.tsx': 'a chord symbol',
  '/src/ui/progress/heatmap/StaffView.tsx': 'the accidental drawn before a note on the staff',
  '/src/ui/read/TheorySession.tsx': 'the buttons that choose a chord’s root: ♭ ♮ ♯',
  '/src/ui/read/theoryFormat.ts': 'a chord’s root, in the chord’s name',
  '/src/ui/scales/exerciseName.ts': 'the tonic in the name of a key or a scale',
};
const LESSONS = '/src/ui/learn/';

describe('the note names of ui/', () => {
  it('are scanned from the sources', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(200);
    expect(SOURCES['/src/ui/noteNames.ts']).toBeDefined();
  });

  it('come from useNoteNames: only the lessons take letter names from core/note.ts', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => !isTest(path) && !LETTERS_FROM_CORE.includes(path))
      .filter(([, text]) =>
        [...code(text).matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*core\/note\.ts'/g)].some(
          (match) => /\b(letterName|formatPitch|midiName)\b/.test(match[1]!),
        ),
      )
      .map(([path]) => path);
    // A note or a key of the keyboard is named through useNoteNames (ui/noteNames.ts), so that it
    // follows the note names chosen in Settings. Only what keeps its letters may be listed above.
    expect(offenders).toEqual([]);
    for (const path of LETTERS_FROM_CORE) expect(SOURCES[path], path).toBeDefined();
  });

  it('are not put together by hand: a sharp or a flat is written only where a name keeps its letters', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => !isTest(path) && !path.startsWith(LESSONS) && !(path in OWN_SIGNS))
      .filter(([, text]) => /[♯♭𝄪𝄫]/u.test(code(text)))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
    // The list stays true: a file that no longer writes a sign leaves it.
    for (const path of Object.keys(OWN_SIGNS)) {
      expect(/[♯♭𝄪𝄫]/u.test(code(SOURCES[path] ?? '')), path).toBe(true);
    }
  });
});
